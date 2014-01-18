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
    this.checkPath = function(path, mode) {
      if (path.substring(0, '/foo/'.length) === '/foo/') {
        return true;
      }
      if (path.substring(0, '/read/access/'.length) === '/read/access/' && mode === 'r') {
        return true;
      }
      if (path.substring(0, '/write/access/'.length) === '/write/access/') {
        return true;
      }
      return false;
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
      env.rs.local = new RemoteStorage.InMemoryStorage();
      env.rs.caching = new FakeCaching();
      env.rs.remote = new FakeRemote();
      env.rs.access = new FakeAccess();
      env.rs.sync = new RemoteStorage.Sync(env.rs.local, env.rs.remote, env.rs.access);
      test.done();
    },

    tests: [
      {
        desc: "getParentPath works correctly",
        run: function(env,test){
          test.assertAnd(env.rs.sync.getParentPath('/a'), '/');
          test.assertAnd(env.rs.sync.getParentPath('/a/'), '/');
          test.assertAnd(env.rs.sync.getParentPath('/a/b'), '/a/');
          test.assertAnd(env.rs.sync.getParentPath('/a/b/'), '/a/');
          test.assertAnd(env.rs.sync.getParentPath('/a/b/c'), '/a/b/');
          test.assertAnd(env.rs.sync.getParentPath('/a/b/c/'), '/a/b/');
          test.done();
        }
      },
      
      {
        desc: "RemoteStorage.sync() returns immediately if not connected",
        run: function(env,test){
          var failed = false;
          env.rs.remote.connected = false;
          env.rs.on('sync-busy', function(){
            failed = true;
          });

          env.rs.doSync().then(function(){
            test.assert(failed, false);
          });
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
      {
        desc: "Sync calls doTasks, and goes to findTasks only if necessary",
        run: function(env, test) {
           var doTasksCalled = 0, findTasksCalled = 0, addTaskCalled = 0,
             tmpDoTasks = env.rs.sync.doTasks,
             tmpFindTasks = env.rs.sync.findTasks,
             tmpAddTasks = env.rs.sync.addTasks;
           
           env.rs.sync.doTasks = function() {
             doTasksCalled++;
             if (addTaskCalled) {
               return true;
             } else {
               return false;
             }
           }
           env.rs.sync.findTasks = function() {
             findTasksCalled++;
             return promising().fulfill();
           }
           env.rs.sync.addTask = function() {
             addTaskCalled++;
           }
           env.rs.sync.sync().then(function() {
             test.assertAnd(doTasksCalled, 2);
             test.assertAnd(findTasksCalled, 1);
             env.rs.sync.addTask('/foo', function() {});
             return env.rs.sync.sync();
           }).then(function() {
             test.assertAnd(doTasksCalled, 3);
             test.assertAnd(findTasksCalled, 1);
             env.rs.sync.doTasks = tmpDoTasks;
             env.rs.sync.findTasks = tmpFindTasks;
             env.rs.sync.addTasks = tmpAddTasks;
             test.done();
           });
        }
      },

      {
        desc: "findTasks calls checkDiffs and goes to checkRefresh only if necessary",
        run: function(env, test) {
           var checkDiffsCalled = 0, checkRefreshCalled = 0,
             tmpCheckDiffs = env.rs.sync.checkDiffs,
             tmpCheckRefresh = env.rs.sync.checkRefresh,
             haveDiffs = [];
           env.rs.sync.checkDiffs = function() {
             checkDiffsCalled++;
             return haveDiffs;
           }
           env.rs.sync.checkRefresh = function() {
             checkRefreshCalled++;
             return promising().fulfill([]);
           }
           env.rs.sync.findTasks();
           test.assertAnd(checkDiffsCalled, 1);
           test.assertAnd(checkRefreshCalled, 1);
           haveDiffs = ['/foo'];
           env.rs.sync.findTasks();
           test.assertAnd(checkDiffsCalled, 2);
           test.assertAnd(checkRefreshCalled, 1);
           env.rs.sync.checkDiffs = tmpCheckDiffs;
           env.rs.sync.checkRefresh = tmpCheckRefresh;
           test.done();
        }
      },

      {
        desc: "checkRefresh gives preference to caching parent",
        run: function(env, test) {
          var tmpForAllNodes = env.rs.local.forAllNodes,
            tmpNow = env.rs.sync.now;
          env.rs.sync.now = function() {
            return 1234568654321;
          }
          env.rs.local.forAllNodes = function(cb) {
            cb({
              path: '/foo/ba/and/then/some/sub/path', //should be overruled by ancestor /foo/ba/
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            });
            cb({
              path: '/foo/ba/', //should retrieve /foo/ to get its new revision
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            });
            cb({
              path: '/read/access/', // should retrieve
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            });
            cb({
              path: '/no/access/', // no access
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            });
            return promising().fulfill();
          };
          env.rs.sync.checkRefresh().then(function() {
            test.assertAnd(env.rs.sync._tasks, {
             '/foo/': true,
             '/read/access/': true
            });
            env.rs.local.forAllNodes = tmpForAllNodes;
            env.rs.sync.now = tmpNow;
            test.done();
          });
        }
      },

      {
        desc: "go through the request-queue with 4-8 requests at a time",
        run: function(env, test) {
          env.rs.sync.numThreads = 5;
          env.rs.sync.remote.connected = true;
          env.rs.sync.remote.online = true;
          env.rs.sync._tasks = {
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
          env.rs.sync._running = {};
          env.rs.sync.doTasks();
          test.assertAnd(env.rs.sync._tasks, {
            '/foo1/': true,
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true,
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          });
          test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).sort(), [
            '/foo1/',
            '/foo2/',
            '/foo3',
            '/foo4/',
            '/foo/5'
          ].sort());
         test.done();
        }
      },

      {
        desc: "sync will attempt only one request, at low frequency, when not online",
        run: function(env, test) {
          env.rs.sync.numThreads = 5;
          env.rs.sync.remote.connected = true;
          env.rs.sync.remote.online = false;
          env.rs.sync._tasks = {
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
          env.rs.sync._running = {};
          env.rs.sync.doTasks();
          test.assertAnd(env.rs.sync._tasks, {
            '/foo1/': true,
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true,
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          });
          test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).sort(), [
            '/foo1/'
          ]);
         test.done();
        }
      },

      {
        desc: "sync will not attempt any requests when not connected",
        run: function(env, test) {
          env.rs.sync.numThreads = 5;
          env.rs.remote.connected = false;
          env.rs.sync._tasks = {
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
          env.rs.sync._running = {};
          env.rs.sync.doTasks();
          test.assertAnd(env.rs.sync._tasks, {
            '/foo1/': true,
            '/foo2/': true,
            '/foo3': true,
            '/foo4/': true,
            '/foo/5': true,
            '/foo/6/': true,
            '/foo7/': true,
            '/foo8': true,
            '/fo/o/9/': true
          });
          test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).sort(), [
          ]);
         test.done();
        }
      },

      {
        desc: "checkRefresh requests the parent rather than the stale node itself, if it is not an access root",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/read/access/f/o/o/': {
              path: '/read/access/f/o/o/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            }
          }).then(function() {
            return env.rs.sync.checkRefresh();
          }).then(function() {
            test.assertAnd(env.rs.sync._tasks, {
              '/read/access/f/o/': true
            });
            test.done();
          });
        }
      },

      {
        desc: "an incoming folder listing creates subfolder nodes if it's under a env.rs.caching.SEEN_AND_FOLDERS root",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar/': { official: {} }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar/',
                                 { ifNoneMatch: undefined } ]] =
                [200, {'baz/': '123', 'baf': '456'}, 'application/json', '123'];
            env.rs.caching.rootPaths = {
              '/foo/': env.rs.caching.SEEN_AND_FOLDERS
            };
            env.rs.sync._tasks = {'/foo/bar/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar/baz/', '/foo/bar/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baf'], undefined);
                test.done();
              });
            }, 100);
          });
        }
      },

], nothing: [
      {
        desc: "an incoming folder listing creates subfolder nodes if it's under a env.rs.caching.ALL root",
        run: function(env, test) {
          env.rs.remote._responses[['get', '/foo/bar/',
                                 { ifNoneMatch: undefined } ]] =
            [200, {'baz/': '123', 'baf': '456'}, 'application/json', '123'];
          env.rs.caching.rootPaths = {
            '/foo/': env.rs.caching.ALL
          };
          env.rs.sync._tasks = {'/foo/': true};
          env.rs.sync.doTasks();
          setTimeout(function() {
            env.rs.local.getNodes(['/foo/bar/baz/', '/foo/bar/baf']).then(function(objs) {
              test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
              test.assertAnd(objs['/foo/bar/baf'], undefined);
              test.done();
            });
          }, 100);
        }
      },

      {
        desc: "an incoming folder listing creates document nodes if it's under a env.rs.caching.ALL root",
        run: function(env, test) {
          env.rs.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
            [200, {'baz/': '123', 'baf': '456'}, 'application/json', '123'];
          env.rs.caching.rootPaths = {
            '/foo/': env.rs.caching.ALL
          };
          env.rs.sync._tasks = {'/foo/': true};
          env.rs.sync.doTasks();
          setTimeout(function() {
            env.rs.local.getNodes(['/foo/bar/baz/', '/foo/bar/baf']).then(function(objs) {
              test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
              test.assertAnd(objs['/foo/bar/baf'].official.revision, '456');
              test.done();
            });
          }, 100);
        }
      },

      {
        desc: "an incoming folder listing doesn't store unchanged revisions to its children",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/baz/': {
              official: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              official: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
              [200, {'baz/': '123', 'baf': '456'}, 'application/json', '123'];
            env.rs.caching.rootPaths = {
              '/foo/': env.rs.caching.ALL
            };
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baz/'].remote, undefined);
                test.assertAnd(objs['/foo/bar/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/bar/baf'].remote, undefined);
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a env.rs.caching.ALL root",
        run: function(env, test) {
          env.caching.set('/foo/', env.rs.caching.ALL);
          env.rs.local.setNodes({
            '/foo/baz/': {
              official: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              official: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
              [200, {'baz/': '129', 'baf': '459'}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/bar/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/bar/baf'].remote.revision, '459');
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a env.rs.caching.SEEN_AND_FOLDERS root",
        run: function(env, test) {
          env.caching.set('/foo/', env.rs.caching.SEEN_AND_FOLDERS);
          env.rs.local.setNodes({
            '/foo/baz/': {
              official: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              official: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
              [200, {'baz/': '129', 'baf': '459'}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/bar/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/bar/baf'].remote.revision, '459');
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a env.rs.caching.SEEN root",
        run: function(env, test) {
          env.caching.set('/foo/', env.rs.caching.SEEN);
          env.rs.local.setNodes({
            '/foo/baz/': {
              official: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              official: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
              [200, {'baz/': '129', 'baf': '459'}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/bar/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/bar/baf'].remote.revision, '459');
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "sub item new revisions stored as official if local exists and onConflict is local",
        run: function(env, test) {
          env.rs.onConflict = function() {
            return 'local';
          };
          env.rs.local.setNodes({
            '/foo/baz/': {
              official: { revision: '123', timestamp: 1234567890123 },
              local: { itemsMap: {a: true}, timestamp: 1234567891000 }
            },
            '/foo/baf': {
              official: { revision: '456', timestamp: 1234567890123 },
              local: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
              [200, {'baz/': '129', 'baf': '459'}, 'application/json', '123'];
            env.rs.caching.rootPaths = ['/foo/'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '129');
                test.assertAnd(objs['/foo/bar/baz/'].remote, undefined);
                test.assertAnd(objs['/foo/bar/baz/'].local,
                    { itemsMap: {a: true}, timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar/baf'].official.revision, '459');
                test.assertAnd(objs['/foo/bar/baf'].remote, undefined);
                test.assertAnd(objs['/foo/bar/baf'].local,
                    { body: 'a', contentType: 'b', timestamp: 1234567891000 });
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "sub item new revisions stored as remote if local exists and onConflict is remote",
        run: function(env, test) {
          env.rs.onConflict = function() {
            return 'remote';
          };
          env.rs.local.setNodes({
            '/foo/baz/': {
              official: { revision: '123', timestamp: 1234567890123 },
              local: { itemsMap: {a: true}, timestamp: 1234567891000 }
            },
            '/foo/baf': {
              official: { revision: '456', timestamp: 1234567890123 },
              local: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
              [200, {'baz/': '129', 'baf': '459'}, 'application/json', '123'];
            env.rs.caching.rootPaths = ['/foo/'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/bar/baz/'].local,
                    { itemsMap: {a: true}, timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/bar/baf'].remote.revision, '459');
                test.assertAnd(objs['/foo/bar/baf'].local,
                    { body: 'a', contentType: 'b', timestamp: 1234567891000 });
                test.done();
              });
            }, 100);
          });
        }
      },


      {
        desc: "sub item new revisions left in conflict if local exists and undefined onConflict",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/baz/': {
              official: { revision: '123', timestamp: 1234567890123 },
              local: { itemsMap: {a: true}, timestamp: 1234567891000 }
            },
            '/foo/baf': {
              official: { revision: '456', timestamp: 1234567890123 },
              local: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
              [200, {'baz/': '129', 'baf': '459'}, 'application/json', '123'];
            env.rs.caching.rootPaths = ['/foo/'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/bar/baz/'].local,
                    { itemsMap: {a: true}, timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/bar/baf'].remote.revision, '459');
                test.assertAnd(objs['/foo/bar/baf'].local,
                    { body: 'a', contentType: 'b', timestamp: 1234567891000 });
                test.done();
              });
            }, 100);
          });
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
            env.rs.remote._responses[['put', '/foo/bar',
                                   { ifNoneMatch: undefined } ]] =
              [200, '', '', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
        desc: "when push completes but local changes exist since, the push version (not the local) becomes official",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar',
                                   { ifNoneMatch: undefined } ]] =
              [200, '', '', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            //delete the local version while it's being pushed out:
            objs['/foo/bar/'].local = { timestamp: 1234567899999 };
            return env.rs.local.setNodes({
              '/foo/bar': objs['/foo/bar']
            });
          }).then(function() {
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'asdf');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'qwer');
                //check that racing local is preserved:
                test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567899999 });
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
            env.rs.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [200, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
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
            env.rs.remote._responses[['get', '/foo/', { } ]] =
              [200, '{"items":{"a":{"ETag":"3"}}}', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
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
              official: { itemsMap: {}, timestamp: 1234567891000 },
              local: { itemsMap: {a: true, b: {'ETag': 'aaa'}}, timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/', { } ]] =
              [200, '{"items":{"a":{"ETag":"3"}}}', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
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
            env.rs.remote._responses[['get', '/foo/bar', { } ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
            env.rs.remote._responses[['get', '/foo/bar', { } ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: 'fff' });
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
          env.rs.onConflict = function() {
            return 'remote';
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar', { } ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: 'fff' });
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
        desc: "a success response to a document GET becomes a conflict if local exists and onConflict doesn't resolve it",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar', { } ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: 'fff' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            //now add a local while the request is running:
            objs['/foo/bar'].local = { body: 'ab', contentType: 'bb', timestamp: 1234567891001 };
            return env.rs.local.setNodes({
              '/foo/bar': objs['/foo/bar']
            });
          }).then(function() {
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, '123');
                test.assertAnd(objs['/foo/bar'].remote.body, 'zz');
                test.assertAnd(objs['/foo/bar'].remote.contentType, 'application/ld+json');
                test.assertAnd(objs['/foo/bar'].local, { body: 'ab', contentType: 'bb', timestamp: 1234567891001 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "when a document or folder is fetched, pending requests from all windows are resolved",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            //with maxAge:true this will get queued since official has no revision:
            env.rs.local.get('/foo/bar', true).then(function(status, body, contentType) {
              test.assertAnd(status, 200);
              test.assertAnd(body, 'zz');
              test.assertAnd(contentType, 'application/ld+json');
              test.done();
            });
            env.rs.remote._responses[['get', '/foo/bar', { } ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
          });
        }
      },

      {
        desc: "a success response to a document GET resolves pending maxAge requests",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar', { } ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
        desc: "a failure response to a PUT removes the push version",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [573, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a failure response to a DELETE removes the push version",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [480, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
        desc: "a failure response to a document GET leaves things as they are",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              remote: { revision: '988' }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar',
                                   { } ]] =
              ['a', '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: '988' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, { revision: '988' });
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a failure response to a folder GET leaves things as they are",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar/': {
              official: { itemsMap: {asdf: 'qwer'}, revision: '987', timestamp: 1234567890123 },
              remote: { revision: '988' }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar',
                                   { } ]] =
              [685, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: '988' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync.running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official,
                    { itemsMap: {asdf: 'qwer'}, revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, { revision: '988' });
                test.assertAnd(env.rs.sync.running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a PUT obeys a 'local' conflict handler if there is one",
        run: function(env, test) {
          env.rs.onConflict = function(path) {
            return 'local';
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
            env.rs.remote._responses[['put', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
            env.rs.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
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
            '/public/readings/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.sync.checkDiffs();
            test.assertAnd(env.rs.sync._tasks, {});
            test.done();
          });
        }
      },

      {
        desc: "checkDiffs retrieves body and Content-Type when a new remote revision is set inside access scope",
        run: function(env, test) {
          env.rs.access.set('readings', 'r');
          env.rs.access.set('writings', 'rw');
          env.rs.local.setNodes({
            '/readings/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              remote: { revision: '900' }
            },
            '/public/writings/bar': {
              official: { revision: '987', timestamp: 1234567890123 },
              remote: { revision: 'a' }
            }
          }).then(function() {
            env.rs.sync.checkDiffs();
            test.assertAnd(env.rs.sync._tasks, {
              '/writings/bar': true,
              '/public/writings/bar': true
            });
            test.done();
          });
        }
      },

      {
        desc: "sync will discard corrupt cache nodes",
        run: function(env, test) {
          env.rs.access.set('readings', 'r');
          env.rs.access.set('writings', 'rw');
          env.rs.local.setNodes({
            '/readings/bar': {
              official: { body: function() {}, contentType: 3, revision: '987', timestamp: 1234567890123 },
              remote: 'no'
            }
          }).then(function() {
            env.rs.sync.checkDiffs();
            return env.rs.local.getNodes(['/readings/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/readings/bar'], undefined);
            test.done();
          });
        }
      },

      {
        desc: "sync will reject its promise if the cache is not available",
        run: function(env, test) {
          var tmp = env.rs.getNodes;
          env.rs.getNodes = function() {
            var promise;
            promise.reject('i am broken, deal with it!');
            return promise;
          };
          env.rs.sync().then(function() {
            test.done(false, 'sync was supposed to reject its promise');
          }, function(err) {
            test.asserAnd(err, 'local store unavailable');
            test.done();
          });
          env.rs.getNodes = tmp;
        }
      },

      {
        desc: "sync will fulfill its promise as long as the cache is available",
        run: function(env, test) {
          env.rs.sync().then(function() {
            test.done();
          }, function(err) {
            test.done(false, 'sync was supposed to fulfill its promise');
          });
          env.rs.getNodes = tmp;
        }
      },

      {
        desc: "checkDiffs does not push local if a remote exists",
        run: function(env, test) {
          env.rs.access.set('writings', 'rw');
          env.rs.local.setNodes({
            '/writings/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 },
              remote: { revision: 'fetch-me-first' }
            }
          }).then(function() {
            env.rs.sync.checkDiffs();
            test.assertAnd(env.rs.sync._tasks, {});
            test.done();
          });
        }
      },

      {
        desc: "when a conflict is resolved as remote, a change event is sent out",
        run: function(env, test) {
          env.rs.on('change', function(evt) {
            test.assertAnd(evt, {
              oldValue: undefined,
              newValue: 'asdf',
              path: '/foo/bar'
            });
            test.done();
          });
          env.rs.onConflict = function(path) {
            return 'remote';
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
          });
        }
      },

      {
        desc: "when a conflict is resolved as local, no change event is sent out",
        run: function(env, test) {
          var changeCalled = false;
          env.rs.on('change', function(evt) {
            changeCalled = true;
          });
          env.rs.onConflict = function(path) {
            return 'local';
          };
          env.rs.local.setNodes({
            '/foo/bar': {
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar',
                                   { ifMatch: '987' } ]] =
              [412, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              test.assertAnd(changeCalled, false);
              test.done();
            }, 100);
          });
        }
      },

      {
        desc: "when a document is missing from an incoming folder and it has no local changes, it is removed",
        run: function(env, test) {
          test.done(false, 'TODO 1');
        }
      },

      {
        desc: "when a document is missing from an incoming folder and it has local changes, and resolution is 'local', official is set to empty",
        run: function(env, test) {
          test.done(false, 'TODO 2');
        }
      },

      {
        desc: "when a document is missing from an incoming folder and it has local changes, and resolution is 'remote', official is set to empty and local is removed",
        run: function(env, test) {
          test.done(false, 'TODO 3');
        }
      },

      {
        desc: "when a document is missing from an incoming folder and it has local changes, and resolution is 'wait/fetch', remote is set to empty",
        run: function(env, test) {
          test.done(false, 'TODO 4');
        }
      },

      {
        desc: "when a sub folder is missing from an incoming folder, the parts of its subtree have no local changes, are removed recursively",
        run: function(env, test) {
          test.done(false, 'TODO 5');
        }
      },

      {
        desc: "when a sub folder is missing from an incoming folder, documents in its subtree that have local changes, are resolved as individual remote deletions",
        run: function(env, test) {
          test.done(false, 'TODO 6');
        }
      },

      {
        desc: "when a document comes back 404, and it has no local changes, it is removed",
        run: function(env, test) {
          test.done(false, 'TODO 7');
        }
      },

      {
        desc: "when a document comes back 404, and it has local changes, it is resolved according to its conflict handling",
        run: function(env, test) {
          test.done(false, 'TODO 8');
        }
      },

      {
        desc: "when a folder comes back 404, the parts of its subtree have no local changes, are removed recursively",
        run: function(env, test) {
          test.done(false, 'TODO 9');
        }
      },

      {
        desc: "when a document comes back 404, and it has local changes, documents in its subtree that have local changes, are resolved as individual remote deletions",
        run: function(env, test) {
          test.done(false, 'TODO 10');
        }
      },
    ]
  });

  return suites;
});
