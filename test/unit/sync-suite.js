if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];

  function FakeCaching(){
    this.rootPaths = [];
  }

  function FakeAccess(){
    this._data = {};
    this.set = function(moduleName, value) {
      this._data[moduleName] = value;
    };
    this.get = function(moduleName) {
      return this._data[moduleName];
    };
  }

  function FakeRemote(){
    function GPD(target, path, body, contentType, options) {
      var args = Array.prototype.slice.call(arguments);
      console.log('GPD called with : ', args);
      this['_'+target+'s'].push([path, body, contentType, options]);
      var p = promising();
      var resp = this._responses[args] || [200];
      return p.fulfill.apply(p, resp);
    }
    this.connected = true;
    this._puts = [];
    this.put = GPD.bind(this, 'put');
    this._deletes = [];
    this.delete = GPD.bind(this, 'delete');
    this._gets = [];
    this.get = GPD.bind(this, 'get');
    this._responses = {};
  }

  function flatten(array){
    var flat = [];
    for (var i = 0, l = array.length; i < l; i++){
      var type = Object.prototype.toString.call(array[i]).split(' ').pop().split(']').shift().toLowerCase();
      if (type) { flat = flat.concat(/^(array|collection|arguments|object)$/.test(type) ? flatten(array[i]) : array[i]); }
    }
    return flat;
  }

  suites.push({
    name: "Sync Suite",
    desc: "testing the sync adapter instance",

    setup: function(env, test){
      require('./lib/promising');
      global.RemoteStorage = function(){
        RemoteStorage.eventHandling(this, 'sync-busy', 'sync-done', 'ready');
      };
      global.RemoteStorage.log = function() {};

      require('./src/eventhandling');
      if (global.rs_eventhandling){
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }

      require('./src/cachinglayer');
      if (global.rs_cachinglayer) {
        RemoteStorage.cachingLayer = global.rs_cachinglayer;
      } else {
        global.rs_cachinglayer = RemoteStorage.cachingLayer;
      }

      require('./src/inmemorystorage.js');
      if (global.rs_ims) {
        RemoteStorage.InMemoryCaching = global.rs_ims;
      } else {
        global.rs_ims = RemoteStorage.InMemoryStorage;
      }

      require('src/sync.js');
      test.done();
    },

    beforeEach: function(env, test){
      env.rs = new RemoteStorage();
      env.rs.local = env.local = new RemoteStorage.InMemoryStorage();
      env.rs.caching = new FakeCaching();
      env.rs.remote = env.remote = new FakeRemote();
      env.rs.access = new FakeAccess();
      test.done();
    },

    tests: [
      {
        desc: "RemoteStorage.sync() returns immediately if not connected",
        run: function(env,test){
          var failed = false;
          env.rs.remote.connected = false;
          env.rs.on('sync-busy', function(){
            failed = true;
          });

          env.rs.sync().then(function(){
            test.assert(failed, false);
          });
        }
      },

      {
        desc: "RemoteStorage.sync() sets cached path ready",
        run: function(env,test){
          env.local.put('/foo/bar/baz', 'body', 'text/plain');
          env.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
            [200, {'bar/': 123}, 'application/json', 123];
          env.remote._responses[['get', '/foo/bar/',
                                 { ifNoneMatch: undefined } ]] =
            [200, {'baz': 123}, 'application/json', 123];

          env.remote._responses[['get', '/foo/bar/baz',
                                 { ifNoneMatch: undefined } ]] =
            [200, "body", 'text/plain', 123];
          env.rs.caching.rootPaths = ['/foo/'];
          env.rs.caching.get = function(path) {
            return { data: true };
          };
          env.rs.caching.set = function(path, obj) {
            test.assertAnd(path, '/foo/');
            test.assertType(obj, 'object');
            test.assert(obj.ready, true);
          };
          env.rs.sync();
        }
      },

      {
        desc : "Sync adapter sets and removes all event listeners",
        run : function(env, test) {
          function allHandlers() {
            var handlers = env.rs._handlers;
            var l = 0;
            for (var k in handlers) {
              l += handlers[k].length;
            }
            return l;
          }

          test.assertAnd(allHandlers(), 0, "before init found "+allHandlers()+" handlers");

          RemoteStorage.Sync._rs_init(env.rs);
          test.assertAnd(allHandlers(), 1, "after init found "+allHandlers()+" handlers");

          RemoteStorage.Sync._rs_cleanup(env.rs);
          test.assertAnd(allHandlers(), 0, "after cleanup found "+allHandlers()+" handlers");

          test.done();
        }
      },

      {
        desc: "Default sync interval",
        run: function(env, test) {
          test.assert(env.rs.getSyncInterval(), 10000);
        }
      },

      {
        desc: "Update sync interval",
        run: function(env, test) {
          env.rs.setSyncInterval(60000);
          test.assert(env.rs.getSyncInterval(), 60000);
        }
      },

      {
        desc: "Setting a wrong sync interval throws an error",
        run: function(env, test) {
          try {
            env.rs.setSyncInterval('60000');
            test.result(false, "setSyncInterval() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      },
], nothing: [
      {
        desc: "Sync calls doTasks, and goes to findTasks only if necessary",
        run: function(env, test) {
           var doTasksCalled = 0, findTasksCalled = 0,
             tmpDoTasks = env.sync.doTasks,
             tmpFindTasks = env.sync.findTasks;
           
           env.sync.doTasks = function() {
             doTasksCalled++;
           }
           env.sync.findTasks = function() {
             findTasksCalled++;
           }
           env.sync.sync();
           test.assertAnd(doTasksCalled, 1);
           test.assertAnd(findTasksCalled, 1);
           env.sync.addTask('/foo', function() {});
           env.sync.sync();
           test.assertAnd(doTasksCalled, 2);
           test.assertAnd(findTasksCalled, 1);
           env.sync.doTasks = tmpDoTasks;
           env.sync.findTasks = tmpFindTasks;
        }
      },

      {
        desc: "findTasks calls checkDiffs and goes to checkRefresh only if necessary",
        run: function(env, test) {
           var checkDiffsCalled = 0, checkRefreshCalled = 0,
             tmpCheckDiffs = env.sync.checkDiffs,
             tmCheckRefresh = env.sync.checkRefresh;
           env.sync.checkDiffs = function() {
             checkDiffsCalled++;
           }
           env.sync.checkRefresh = function() {
             checkRefreshCalled++;
           }
           env.sync.findTasks();
           test.assertAnd(checkDiffsCalled, 1);
           test.assertAnd(checkRefreshCalled, 1);
           env.local.set('/foo', 'something', 'new');
           env.sync.findTasks();
           test.assertAnd(checkDiffsCalled, 2);
           test.assertAnd(checkRefreshCalled, 1);
           env.sync.checkDiffs = tmpCheckDiffs;
           env.sync.checkRefresh = tmpCheckRefresh;
        }
      },

      {
        desc: "checkRefresh gives preference to caching parent",
        run: function(env, test) {
          var tmpForAllNodes = env.rs.local.forAllNodes;
          env.rs.local.forAllNodes = function(cb) {
            cb({
              path: '/foo/bar/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            });
            cb({
              path: '/foo/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            });
          };
          env.sync.checkRefresh();
          test.assertAnd(env.sync.fetchQueue, {
           '/foo/': true
          });
          env.rs.local.forAllNodes = tmpForAllNodes;
          test.done();
        }
      },

      {
        desc: "checkRefresh gives preference to caching rootPaths",
        run: function(env, test) {
          var tmpForAllNodes = env.rs.local.forAllNodes;
          env.rs.caching.rootPaths = ['/foo/'];
          env.rs.local.forAllNodes = function(cb) {
            cb({
              path: '/bar/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            });
          };
          env.sync.checkRefresh();
          test.assertAnd(env.sync.fetchQueue, {
           '/foo/': true
          });
          env.rs.local.forAllNodes = function(cb) {
            cb({
              path: '/bar/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            });
            cb({
              path: '/foo/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            });
          };
          env.sync.checkRefresh();
          test.assertAnd(env.sync.fetchQueue, {
           '/foo/': true,
           '/bar/': true
          });
          env.rs.local.forAllNodes = tmpForAllNodes;
          test.done();
        }
      },


      {
        desc: "go through the request-queue with 4-8 requests at a time",
        run: function(env, test) {
          env.rs.sync.numThreads = 5;
          env.rs.sync.fetchQueue = {
            '/foo1/': true,
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true,
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          };
          env.rs.sync.doTasks();
          test.assertAnd(env.rs.sync.fetchQueue, {
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          });
          test.assertAnd(env.rs.sync.running, {
            '/foo1/': true,
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true
          });
         test.done();
        }
      },

      {
        desc: "sync will attempt only one request, at low frequency, when offline",
        run: function(env, test) {
          env.rs.sync.numThreads = 5;
          env.rs.sync.offline = true;
          env.rs.sync.fetchQueue = {
            '/foo1/': true,
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true,
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          };
          env.rs.sync.doTasks();
          test.assertAnd(env.rs.sync.fetchQueue, {
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          });
          test.assertAnd(env.rs.sync.running, {
            '/foo1/': true,
          });
         test.done();
        }
      },

      {
        desc: "sync will not attempt any requests when not connected",
        run: function(env, test) {
          env.rs.sync.numThreads = 5;
          env.rs.remote.connected = false;
          env.rs.sync.fetchQueue = {
            '/foo1/': true,
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true,
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          };
          env.rs.sync.doTasks();
          test.assertAnd(env.rs.sync.fetchQueue, {
            '/foo1/': true,
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          });
          test.assertAnd(env.rs.sync.running, {
          });
         test.done();
        }
      },

      {
        desc: "checkRefresh flushes cache for caching=false rootPaths",
        run: function(env, test) {
          env.rs.caching.rootPaths = ['/foo/'];
          env.rs.local.setNodes({
            '/bar/': {
              path: '/bar/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            },
            '/foo/': {
              path: '/foo/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            }
          }).then(function() {
            env.sync.checkRefresh();
            return env.rs.local.getNodes(['/bar/', '/foo/']);
          }).then(function(objs) {
            test.assertAnd(objs, {
              '/bar/': {
                path: '/bar/',
                official: {
                  body: 'off',
                  contentType: 'cT',
                  timestamp: 1234567890123
                }
              },
              '/foo/': undefined
            });
            test.done();
          });
        }
      },

      {
        desc: "checkRefresh requests the parent rather than the stale node itself, unless it is an access root",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/f/o/o/': {
              path: '/f/o/o/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            }
          }).then(function() {
            env.sync.checkRefresh();
            test.assertAnd(env.rs.sync.fetchQueue, {
              '/f/': true
            });
            test.done();
          });
        }
      },

      {
        desc: "an incoming folder listing creates subfolder nodes if it's under a cache root",
        run: function(env, test) {
          env.remote._responses[['get', '/foo/bar/',
                                 { ifNoneMatch: undefined } ]] =
            [200, {'baz/': 123, 'baf': 456}, 'application/json', 123];
          env.rs.caching.rootPaths = ['/foo/'];
          env.sync.fetchQueue = ['/foo/'];
          env.sync.doTasks();
          setTimeout(function() {
            env.rs.local.getNodes(['/foo/bar/baz/', '/foo/bar/baf']).then(function(objs) {
              test.assertAnd(objs['/foo/bar/baz/'].official.revision, 123);
              test.assertAnd(objs['/foo/bar/baf'], undefined);
              test.done();
            });
          }, 100);
        }
      },

      {
        desc: "an incoming folder listing creates document nodes if it's under a cache root that's not treeOnly",
        run: function(env, test) {
          env.remote._responses[['get', '/foo/bar/',
                                 { ifNoneMatch: undefined } ]] =
            [200, {'baz/': 123, 'baf': 456}, 'application/json', 123];
          env.rs.caching.rootPaths = ['/foo/'];
          env.sync.fetchQueue = ['/foo/'];
          env.sync.doTasks();
          setTimeout(function() {
            env.rs.local.getNodes(['/foo/bar/baz/', '/foo/bar/baf']).then(function(objs) {
              test.assertAnd(objs['/foo/bar/baz/'].official.revision, 123);
              test.assertAnd(objs['/foo/bar/baf'].official.revision, 456);
              test.done();
            });
          }, 100);
        }
      },

      {
        desc: "an incoming folder listing doesn't store unchanged revisions to subfolder nodes",
        run: function(env, test) {
          test.done(false, 'TODO 25');
        }
      },

      {
        desc: "an incoming folder listing stores new revisions to subfolder nodes if it's under a cache root",
        run: function(env, test) {
          test.done(false, 'TODO 24');
        }
      },

      {
        desc: "subfolder new revisions stored as official if local exists and onConflict is local",
        run: function(env, test) {
          test.done(false, 'TODO 23');
        }
      },

      {
        desc: "subfolder new revisions stored as remote if local exists and onConflict is remote",
        run: function(env, test) {
          test.done(false, 'TODO 22');
        }
      },


      {
        desc: "subfolder new revisions stored as remote if local exists and no onConflict",
        run: function(env, test) {
          test.done(false, 'TODO 21');
        }
      },

      {
        desc: "a success response to a PUT moves local to official",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['put', '/foo/bar',
                                   { ifNoneMatch: undefined } ]] =
              [200, '', '', '123'];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'asdf');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'qwer');
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a DELETE moves local to official",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [200, '', '', ''];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, undefined);
                test.assertAnd(objs['/foo/bar'].official.body, undefined);
                test.assertAnd(objs['/foo/bar'].official.contentType, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a folder GET moves remote to official if no local exists",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/': {
              remote: { revision: 'fff' },
              official: { itemsMap: {}, timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['get', '/foo/', { } ]] =
              [200, '{"items":{"a":{"ETag":"3"}}}', 'application/ld+json', '123'];
            env.sync.pushQueue = ['/foo/'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/'].official, { itemsMap: {}, timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/'].local, undefined);
            test.assertAnd(objs['/foo/'].push, undefined);
            test.assertAnd(objs['/foo/'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.itemsMap, {a: {'ETag': '3'}});
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a folder GET fires no conflict even if a local exists",
        run: function(env, test) {
          env.rs.onConflict = function() {
            test.done(false, 'onConflict was fired');
          };
          env.rs.local.setNodes({
            '/foo/': {
              remote: { revision: 'fff' },
              official: { itemsMap: {}, timestamp: 1234567891000 }
              local: { itemsMap: {a: true, b: {'ETag': 'aaa'}}, timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['get', '/foo/', { } ]] =
              [200, '{"items":{"a":{"ETag":"3"}}}', 'application/ld+json', '123'];
            env.sync.pushQueue = ['/foo/'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/'].official, { itemsMap: {}, timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/'].local, undefined);
            test.assertAnd(objs['/foo/'].push, undefined);
            test.assertAnd(objs['/foo/'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.itemsMap, {a: {'ETag': '3'}});
                test.assertAnd(objs['/foo/bar'].local,
                    { itemsMap: {a: true, b: {'ETag': 'aaa'}}, timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a document GET moves remote to official if no local exists",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['get', '/foo/bar', { } ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'zz');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'b');
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a document GET can resolve conflicts as 'local' if local exists",
        run: function(env, test) {
          env.rs.onConflict = function() {
            return 'local';
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['get', '/foo/bar', { } ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            //now add a local while the request is running:
            return env.rs.local.setNodes({
              '/foo/bar': {
                remote: { revision: 'fff' },
                official: { body: 'a', contentType: 'b', timestamp: 1234567891000 },
                local: { body: 'ab', contentType: 'bb', timestamp: 1234567891001 }
              }
            });
          }).then(function() {
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'zz');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'application/ld+json');
                test.assertAnd(objs['/foo/bar'].local, { body: 'ab', contentType: 'bb', timestamp: 1234567891001 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a document GET can resolve conflicts as 'remote' if local exists",
        run: function(env, test) {
          test.done(false, 'TODO 20');
        }
      },

      {
        desc: "a success response to a document GET can resolve conflicts as default ('remote') if local exists",
        run: function(env, test) {
          test.done(false, 'TODO 19');
        }
      },

      {
        desc: "a failure response to a PUT removes the push version and marks offline",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['put', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [573, '', '', ''];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local,
                { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official,
                    { revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local,
                    { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.offline, true);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a failure response to a DELETE removes the push version and marks offline",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [480, '', '', ''];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.offline, true);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a failure response to a document GET leaves things as they are and marks offline",
        run: function(env, test) {
                test.assertAnd(env.rs.sync.offline, true);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
          test.done(false, 'TODO 18');
        }
      },

      {
        desc: "a failure response to a folder GET leaves things as they are and marks offline",
        run: function(env, test) {
                test.assertAnd(env.rs.sync.offline, true);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
          test.done(false, 'TODO 17');
        }
      },

      {
        desc: "a conflict response to a PUT obeys a 'local' conflict handler if there is one",
        run: function(env, test) {
          env.rs.onConflict = function(path) {
            return 'local';
          });
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['put', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', 'fff'];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local,
                { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              //to make local win, the revision should be made official, so that the request goes through next time
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].local,
                    { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a DELETE obeys a 'local' conflict handler if there is one",
        run: function(env, test) {
          env.rs.onConflict = function(path) {
            return 'local';
          });
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', ''];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              //to make local win, the revision should be made official, so that the request goes through next time
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a PUT obeys a 'remote' conflict handler if there is one",
        run: function(env, test) {
          env.rs.onConflict = function(path) {
            return 'remote';
          });
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['put', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', 'fff'];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local,
                { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              //to make remote win, the revision should be made remote, and local should be deleted
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].official,
                    { revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a DELETE obeys a 'remote' conflict handler if there is one",
        run: function(env, test) {
          env.rs.onConflict = function(path) {
            return 'remote';
          });
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', ''];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              //to make remote win, the revision should be made remote, and local should be deleted
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a PUT obeys 'remote' if there is no conflict handler",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['put', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', 'fff'];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local,
                { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              //to make remote win, the revision should be made remote, and local should be deleted
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].official,
                    { revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a DELETE obeys 'remote' if there is no conflict handler",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', ''];
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              //to make remote win, the revision should be made remote, and local should be deleted
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "DELETE requests that time out get cancelled",
        run: function(env, test) {
          env.rs.remote.get = function(path) {
            var promise = promising();
            promise.reject('timeout');
            return promise;
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.sync.pushQueue = ['/foo/bar'];
            env.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "checkDiffs will not enqueue requests outside the access scope",
        run: function(env, test) {
          env.rs.access.set('readings', 'r');
          env.rs.access.set('writings', 'rw');
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            },
            '/public/foo/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            test.assertAnd(env.rs.sync.pushQueue, {});
            test.done();
          });
        }
      },

      {
        desc: "checkDiffs handles PUTs inside rw access scope",
        run: function(env, test) {
          test.done(false, 'TODO 16');
        }
      },

      {
        desc: "checkDiffs handles DELETEs inside rw access scope",
        run: function(env, test) {
          test.done(false, 'TODO 15');
        }
      },

      {
        desc: "checkDiffs retrieves body and Content-Type when a new remote revision is set inside access scope",
        run: function(env, test) {
          test.done(false, 'TODO 14');
        }
      },

      {
        desc: "sync will discard corrupt cache nodes",
        run: function(env, test) {
          test.done(false, 'TODO 13');
        }
      },

      {
        desc: "sync will reject its promise if the cache is not available",
        run: function(env, test) {
          test.done(false, 'TODO 12');
        }
      },

      {
        desc: "sync will fulfill its promise as long as the cache is available",
        run: function(env, test) {
          test.done(false, 'TODO 11');
        }
      },


      {
        desc: "checkDiffs does not queue request if one for the same node exists (whether push or fetch)",
        run: function(env, test) {
          test.done(false, 'TODO 10');
        }
      },

      {
        desc: "checkRefresh does not queue request if one for the same node exists (whether push or fetch)",
        run: function(env, test) {
          test.done(false, 'TODO 9');
        }
      },

      {
        desc: "checkDiffs does not push local if a remote exists",
        run: function(env, test) {
          test.done(false, 'TODO 8');
        }
      },

      {
        desc: "when push completes but local changes exist since, the push version (not the local) becomes official",
        run: function(env, test) {
          test.done(false, 'TODO 7');
        }
      },

      {
        desc: "when a document or folder is fetched, pending requests from all windows are resolved",
        run: function(env, test) {
          test.done(false, 'TODO 6');
        }
      },

      {
        desc: "changes in unsynced folders are still pushed out",
        run: function(env, test) {
          test.done(false, 'TODO 5');
        }
      },

      {
        desc: "when a conflict is resolved as remote, a change event is sent out",
        run: function(env, test) {
          test.done(false, 'TODO 4');
        }
      },

      {
        desc: "when a conflict is resolved as local, no change event is sent out",
        run: function(env, test) {
          test.done(false, 'TODO 3');
        }
      },

      {
        desc: "items that have been accessed once, will remain synced until they are deleted, or the session is disconnected",
        run: function(env, test) {
          test.done(false, 'TODO 2');
        }
      },

      {
        desc: "",
        run: function(env, test) {
          test.done(false, 'TODO 1');
        }
      }
    ]
  });

  return suites;
});
