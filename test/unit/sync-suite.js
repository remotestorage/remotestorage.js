if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];

  function FakeCaching(){
    this.FLUSH = 0;
    this.SEEN = 1;
    this.FOLDERS = 2;
    this.SEEN_AND_FOLDERS = 3;
    this.DOCUMENTS = 4;
    this.ALL = 7;
    
    this._responses = {};
    this.checkPath = function(path) {
      if (typeof(this._responses[path]) === 'undefined') {
        throw new Error('no FakeCaching response for path ' + path);
      }
      return this._responses[path];
    };
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
      if (path.substring(0, '/readings/'.length) === '/readings/' && mode === 'r') {
        return true;
      }
      if (path.substring(0, '/public/readings/'.length) === '/public/readings/' && mode === 'r') {
        return true;
      }
      if (path.substring(0, '/writings/'.length) === '/writings/') {
        return true;
      }
      if (path.substring(0, '/public/writings/'.length) === '/public/writings/') {
        return true;
      }
      return false;
    };
  }

  function FakeRemote(){
    function GPD(target, path, body, contentType, options) {
      var args = Array.prototype.slice.call(arguments);
      this['_'+target+'s'].push([path, body, contentType, options]);
      var p = promising();
      if (typeof(this._responses[args]) === 'undefined') {
        throw new Error('no FakeRemote response for args ' + JSON.stringify(args) + ' - have: ' + JSON.stringify(Object.getOwnPropertyNames(this._responses)));
      }
      var resp = this._responses[args] || [200];
      if(resp === 'timeout') {
        return p.reject.apply(p, resp);
      } else {
        return p.fulfill.apply(p, resp);
      }
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
        RemoteStorage.InMemoryStorage = global.rs_ims;
      } else {
        global.rs_ims = RemoteStorage.InMemoryStorage;
      }

      require('src/sync.js');
      if (global.rs_sync) {
        RemoteStorage.Sync = global.rs_sync;
      } else {
        global.rs_sync = RemoteStorage.Sync;
      }
      test.done();
    },

    beforeEach: function(env, test){
      env.rs = new RemoteStorage();
      env.rs.local = new RemoteStorage.InMemoryStorage(env.rs);
      env.rs.remote = new FakeRemote();
      env.rs.access = new FakeAccess();
      env.rs.caching = new FakeCaching();
      env.rs.sync = new RemoteStorage.Sync(env.rs.local, env.rs.remote, env.rs.access, env.rs.caching);
      global.remoteStorage = env.rs;
      
      env.rs.sync.numThreads = 5;
      env.rs.remote.connected = true;
      env.rs.remote.online = true;
      env.rs.sync._tasks = {};
      env.rs.sync._running = {};
      
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

          env.rs.sync.sync().then(function(){
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
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
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
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
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
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
           var checkDiffsCalled = 0, checkRefreshCalled = 0,
             tmpCheckDiffs = env.rs.sync.checkDiffs,
             tmpCheckRefresh = env.rs.sync.checkRefresh,
             haveDiffs = 0;
           env.rs.sync.checkDiffs = function() {
             checkDiffsCalled++;
             return promising().fulfill(haveDiffs);
           }
           env.rs.sync.checkRefresh = function() {
             checkRefreshCalled++;
             return promising().fulfill([]);
           }
           env.rs.sync.findTasks().then(function() {
             test.assertAnd(checkDiffsCalled, 1);
             test.assertAnd(checkRefreshCalled, 1);
             haveDiffs = 1;
             return env.rs.sync.findTasks();
           }).then(function() {
             test.assertAnd(checkDiffsCalled, 2);
             test.assertAnd(checkRefreshCalled, 1);
             env.rs.sync.checkDiffs = tmpCheckDiffs;
             env.rs.sync.checkRefresh = tmpCheckRefresh;
             test.done();
           });
        }
      },
     
      {
        desc: "checkRefresh gives preference to caching parent",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          var tmpForAllNodes = env.rs.local.forAllNodes,
            tmpNow = env.rs.sync.now;
          env.rs.sync.now = function() {
            return 1234568654321;
          }
          env.rs.local.forAllNodes = function(cb) {
            cb({
              path: '/foo/ba/and/then/some/sub/path', //should be overruled by ancestor /foo/ba/
              common: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            });
            cb({
              path: '/foo/ba/', //should retrieve /foo/ to get its new revision
              common: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            });
            cb({
              path: '/read/access/', // should retrieve
              common: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            });
            cb({
              path: '/no/access/', // no access
              common: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890124
              }
            });
            return promising().fulfill();
          };
          env.rs.sync.checkRefresh().then(function() {
            test.assertAnd(env.rs.sync._tasks, {
             '/foo/': [],
             '/read/access/': []
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
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          var tmpDoTask = env.rs.sync.doTask;
          env.rs.sync.doTask = function() {
            return promising().fulfill({
              action: undefined,
              promise: promising().fulfill()
            });
          };
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
         env.rs.sync.doTask = tmpDoTask;
        }
      },

      {
        desc: "sync will attempt only one request, at low frequency, when not online",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          var tmpDoTask = env.rs.sync.doTask;
          env.rs.sync.doTask = function() {
            return promising().fulfill({
              action: undefined,
              promise: promising().fulfill()
            });
          };
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
         env.rs.sync.doTask = tmpDoTask;
        }
      },

      {
        desc: "sync will not attempt any requests when not connected",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
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
          test.assertAnd(env.rs.sync._running, {});
          test.done();
        }
      },
      {
        desc: "when a document is fetched, pending requests are resolved",
        run: function(env, test) {
          var syncDone;
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          env.rs.remote.connected = true;
          env.rs.remote.online = true;
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              remote: { revision: 'fff' },
              common: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.sync.on('done', function() {
              syncDone = true;
            });
            //with maxAge:1000000 this will get queued since common has no revision:
            env.rs.local.get('/foo/bar', 1000000).then(function(status, body, contentType) {
              test.assertAnd(status, 200);
              test.assertAnd(body, 'zz');
              test.assertAnd(contentType, 'application/ld+json');
              test.assertAnd(syncDone, true);
              test.done();
            });
            env.rs.remote._responses[['get', '/foo/bar' ]] = [200, 'zz', 'application/ld+json', '123'];
            //no need to call sync or doTasks explicitly, that will be triggered by enqueueGetRequest.
          });
        }
      },
      {
        desc: "when a folder is fetched, pending requests are resolved",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          var done1, done2;
          env.rs.remote.connected = true;
          env.rs.remote.online = true;
          env.rs.caching._responses = {
            '/foo/bar/': env.rs.caching.ALL,
            '/foo/bar/a': env.rs.caching.SEEN_AND_FOLDERS
          };
          env.rs.local.setNodes({
            '/foo/bar/': {
              path: '/foo/bar/',
              remote: { revision: 'fff' },
              common: { itemsMap: {a: {ETag: '1'}}, timestamp: 1234567891000 }
            }
          }).then(function() {
            var syncDone;
            env.rs.sync.on('done', function() {
              syncDone = true;
              if (done1 && done2) {
                test.done();
              }
            });
            //with maxAge:1000000 this will get queued since common has no revision:
            env.rs.local.get('/foo/bar/', 1000000).then(function(status, itemsMap) {
              test.assertAnd(status, 200);
              test.assertAnd(itemsMap, {});
              done1 = true;
              if (done2 && syncDone) {
                env.rs.sync.on('done', function() {
                  test.done();
                });
              }
            });
            env.rs.local.get('/foo/bar/', 2000000).then(function(status, itemsMap) {
              test.assertAnd(status, 200);
              test.assertAnd(itemsMap, {});
              done2 = true;
              if (done1 && syncDone) {
                test.done();
              }
            });
            env.rs.remote._responses[['get', '/foo/bar/' ]] = [200, {}, 'application/ld+json', '123'];
            //no need to call sync or doTasks explicitly, that will be triggered by enqueueGetRequest.
          });
        }
      },
      {
        desc: "document fetch GET requests that time out get cancelled",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          env.rs.remote._responses [['get', '/foo/bar1', { IfNoneMatch: '987' }]] = ['timeout'];
          env.rs.remote._responses [['get', '/foo/bar1']] = ['timeout'];
          env.rs.local.setNodes({
            '/foo/bar1': {
              path: '/foo/bar1',
              common: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              remote: { revision: '1234' }
            }
          }).then(function() {
            env.rs.sync._tasks = {'/foo/bar1': []};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar1']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar1'].common,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar1'].local, undefined);
            test.assertAnd(objs['/foo/bar1'].push, undefined);
            test.assertAnd(objs['/foo/bar1'].remote, {revision: '1234'});
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar1']).then(function(objs) {
                test.assertAnd(objs['/foo/bar1'].common,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar1'].local, undefined);
                test.assertAnd(objs['/foo/bar1'].push, undefined);
                test.assertAnd(objs['/foo/bar1'].remote, {revision: '1234'});
                //don't know much about what's running here
                env.rs.remote._responses [['get', '/foo/bar1', { IfNoneMatch: '987' }]] = [200, 'you are done', 'thank', 'you'];
                env.rs.remote._responses [['get', '/foo/bar1']] = [200, 'you are done', 'thank', 'you'];
                env.rs.sync.on('done', function() {
                  test.done();
                });
              });
            }, 100);
          });
        }
      },
      {
        desc: "document refresh GET requests that time out get cancelled",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          env.rs.remote._responses [['get', '/foo/bar', { IfNoneMatch: '987' }]] = ['timeout'];
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              common: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 }
            }
          }).then(function() {
            //checkRefresh would enqueue the parent folder here, but we explicitly enqueue a refresh
            //of the document itself here:
            env.rs.sync._tasks = {'/foo/bar': []};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].common,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].common,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                //don't know much about what's running here
                env.rs.remote._responses [['get', '/foo/bar', { IfNoneMatch: '987' }]] = [200, 'you are done', 'thank', 'you'];
                env.rs.remote._responses [['get', '/foo/bar']] = [200, 'you are done', 'thank', 'you'];
                env.rs.sync.on('done', function() {
                  test.assertAnd(env.rs.sync._tasks, {});
                  test.assertAnd(env.rs.sync._running, {});
                  test.done();
                });
              });
            }, 100);
          });
        }
      },
      {
        desc: "document non-existing GET requests that time out get restarted",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          env.rs.remote._responses [['get', '/foo/bar']] = ['timeout'];
          env.rs.sync._tasks = {'/foo/bar': []};
          env.rs.sync.doTasks();
          env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
            test.assertAnd(objs['/foo/bar'], undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running), ['/foo/bar']);
            setTimeout(function() {
              env.rs.remote._responses [['get', '/foo/bar']] = [200];
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'], undefined);
                //don't know much about what's running here
                env.rs.remote._responses [['get', '/foo/bar', { IfNoneMatch: '987' }]] = [200, 'you are done', 'thank', 'you'];
                env.rs.remote._responses [['get', '/foo/bar']] = [200, 'you are done', 'thank', 'you'];
                env.rs.sync.on('done', function() {
                  test.assertAnd(env.rs.sync._tasks, {});
                  test.assertAnd(env.rs.sync._running, {});
                  test.done();
                });
              });
            }, 100);
          });
        }
      },
      {
        desc: "folder fetch GET requests that time out get restarted",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          env.rs.remote._responses [['get', '/foo/', { ifNoneMatch: '987' }]] = ['timeout'];
          env.rs.remote._responses [['get', '/foo/']] = ['timeout'];
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: { itemsMap: {a: {ETag: 'zzz'}}, revision: '987', timestamp: 1234567890123 },
              remote: {revision: '123'}
            }
          }).then(function() {
            env.rs.sync._tasks = {'/foo/': []};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/'], {
              path: '/foo/',
              common: { itemsMap: {a: {ETag: 'zzz'}}, revision: '987', timestamp: 1234567890123 },
              remote: {revision: '123'}
            });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running), ['/foo/']);
            setTimeout(function() {
              var stored;
              //don't know much about what's running here
              env.rs.remote._responses [['get', '/foo/', { IfNoneMatch: '987' }]] = [200, {}, '', 'thank you'];
              env.rs.remote._responses [['get', '/foo/']] = [200, {}, '', 'thank you'];
              env.rs.sync.on('done', function() {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
                test.assertAnd(stored, true);
                test.done();
              });
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'], {
                  path: '/foo/',
                  common: { itemsMap: {a: {ETag: 'zzz'}}, revision: '987', timestamp: 1234567890123 },
                  remote: {revision: '123'}
                });
                stored = true;
              });
            }, 100);
          });
        }
      },
      {
        desc: "folder refresh GET requests that time out get cancelled",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          env.rs.remote._responses [['get', '/foo/', { ifNoneMatch: '987' }]] = ['timeout'];
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: { itemsMap: {a: {ETag: 'zzz'}}, revision: '987', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.sync._tasks = {'/foo/': []};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/'], {
              path: '/foo/',
              common: { itemsMap: {a: {ETag: 'zzz'}}, revision: '987', timestamp: 1234567890123 }
            });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running), ['/foo/']);
            setTimeout(function() {
              //don't know much about what's running here
              env.rs.remote._responses [['get', '/foo/', { ifNoneMatch: '987' }]] = [200];
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'], {
                  path: '/foo/',
                  common: { itemsMap: {a: {ETag: 'zzz'}}, revision: '987', timestamp: 1234567890123 }
                });
                env.rs.remote._responses [['get', '/foo/', { IfNoneMatch: '987' }]] = [200, {}, '', 'thank you'];
                env.rs.remote._responses [['get', '/foo/']] = [200, {}, '', 'thank you'];
                env.rs.sync.on('done', function() {
                  test.assertAnd(env.rs.sync._tasks, {});
                  test.assertAnd(env.rs.sync._running, {});
                  test.done();
                });
              });
            }, 100);
          });
        }
      },
      {
        desc: "folder non-existing GET requests that time out get restarted",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          env.rs.remote._responses [['get', '/foo/']] = ['timeout'];
          env.rs.sync._tasks = {'/foo/': []};
          env.rs.sync.doTasks();
          env.rs.local.getNodes(['/foo/']).then(function(objs) {
            test.assertAnd(objs['/foo/'], undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running), ['/foo/']);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                //don't know much about what's running here
                env.rs.remote._responses [['get', '/foo/']] = [200];
                test.assertAnd(objs['/foo/'], undefined);
                test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running), ['/foo/']);
                env.rs.remote._responses [['get', '/foo/', { IfNoneMatch: '987' }]] = [200, {}, '', 'thank you'];
                env.rs.remote._responses [['get', '/foo/']] = [200, {}, '', 'thank you'];
                env.rs.sync.on('done', function() {
                  test.assertAnd(env.rs.sync._tasks, {});
                  test.assertAnd(env.rs.sync._running, {});
                  test.done();
                });
              });
            }, 100);
          });
        }
      },
      {
        desc: "PUT requests that time out get cancelled and restarted",
        run: function(env, test) {
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
          env.rs.access.set('foo', 'rw');
          env.rs.remote._responses [['put', '/foo/bar', 'asdfz', 'qwerz', { ifMatch: '987' }]] = ['timeout'];
          env.rs.local.setNodes({
            '/': {
              path: '/',
              common: {},
              local: { itemsMap: {'foo/': true} }
            },
            '/foo/': {
              path: '/foo/',
              common: {},
              local: { itemsMap: {'bar': true} }
            },
            '/foo/bar': {
              path: '/foo/bar',
              common: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 }
            }
          }).then(function() {
            return env.rs.local.put('/foo/bar', 'asdfz', 'qwerz');
          }).then(function() {
            //no need to call sync or doTasks explicitly, that will be triggered by _updateNodes.
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            var done;
            test.assertAnd(objs['/foo/bar'].common,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local.body, 'asdfz');
            test.assertAnd(objs['/foo/bar'].local.contentType, 'qwerz');
            test.assertAnd(objs['/foo/bar'].push.body, 'asdfz');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwerz');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            env.rs.remote._responses [['put', '/foo/bar', 'asdfz', 'qwerz', { ifMatch: '987' }]] = [200, undefined, undefined, '383a'];
            env.rs.sync.on('done', function() {
              test.assertAnd(env.rs.sync._tasks, {});
              test.assertAnd(env.rs.sync._running, {});
              if (done) {
                test.done();
              } else {
                done = true;
              }
            });
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].common.body, 'asdfz');
                test.assertAnd(objs['/foo/bar'].common.contentType, 'qwerz');
                test.assertAnd(objs['/foo/bar'].common.revision, '383a');
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                //don't know much about what's running here
                if (done) {
                  test.done();
                } else {
                  done = true;
                }
              }.bind(this));
            }.bind(this), 200);
          });
        }
      },
      {
        desc: "DELETE requests that time out get cancelled and retried",
        run: function(env, test) {
          env.rs.access.set('foo', 'rw');
          env.rs.remote._responses [['delete', '/foo/bar', { ifMatch: '987' }]] = ['timeout'];
          env.rs.local.setNodes({
            '/': {
              path: '/',
              common: {},
              local: { itemsMap: {'foo/': true} }
            },
            '/foo/': {
              path: '/foo/',
              common: {},
              local: { itemsMap: {'bar': true} }
            },
            '/foo/bar': {
              path: '/foo/bar',
              common: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 }
            }
          }).then(function() {
            return env.rs.local.delete('/foo/bar');
          }).then(function() {
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            //check that .local.body: false was set by the delete action:
            test.assertAnd(objs['/foo/bar'].local.body, false);
            //no need to call sync or doTasks explicitly, that will be triggered by _updateNodes.
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            var done;
            env.rs.sync.on('done', function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'], undefined);
                test.assertAnd(env.rs.sync._tasks, {});
                test.assertAnd(env.rs.sync._running, {});
                if (done) {
                  test.done();
                } else {
                  done = true;
                }
              });
            });
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].common,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local.body, false);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                //don't know much about what's running and pushing here
                env.rs.remote._responses [['delete', '/foo/bar', { ifMatch: '987' }]] = [200];
                if (done) {
                  test.done();
                } else {
                  done = true;
                }
              });
            }, 100);
          });
        }
      },
      {
        desc: "checkDiffs will not enqueue requests outside the access scope",
        run: function(env, test) {
          env.rs.sync.numThreads = 5;
          env.rs.remote.connected = true;
          env.rs.remote.online = true;
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              common: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { body: false, timestamp: 1234567891000 }
            },
            '/public/nothings/bar': {
              path: '/public/nothings/bar',
              common: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.sync.checkDiffs();
            test.assertAnd(env.rs.sync._tasks, {'/foo/bar': []});
            //env.rs.sync.on('done', function() {
            test.done();
            //});
          });
        }
      },

      {
        desc: "checkDiffs retrieves body and Content-Type when a new remote revision is set inside rw access scope",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/nothings/bar': {
              path: '/nothings/bar',
              common: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              remote: { revision: '900' }
            },
            '/public/writings/bar': {
              path: '/public/writings/bar',
              common: { revision: '987', timestamp: 1234567890123 },
              remote: { revision: 'a' }
            }
          }).then(function() {
            return env.rs.sync.checkDiffs();
          }).then(function() {
            test.assertAnd(env.rs.sync._tasks, {
              '/public/writings/bar': []
            });
            //env.rs.sync.on('done', function() {
            test.done();
            //});
          });
        }
      },

      {
        desc: "sync will discard corrupt cache nodes but try to retrieve them if node.path is readable",
        run: function(env, test) {
          env.rs.access.set('writings', 'r');
          env.rs.access.set('writings', 'rw');
          env.rs.local.setNodes({
            '/writings/bar': {
              path: '/writings/bar',
              common: { body: function() {}, contentType: 3, revision: '987', timestamp: 1234567890123 },
              remote: { revision: 'yes' },
              push: 'no'
            },
            '/writings/baz': {
              common: { body: function() {}, contentType: 3, revision: '987', timestamp: 1234567890123 },
              remote: { revision: 'yes' },
              push: 'no'
            },
            '/writings/baf': {
              path: '/writings/baf',
              remote: { revision: 'yes' }
            }
          }).then(function() {
            return env.rs.sync.checkDiffs();
          }).then(function(num) {
            test.assertAnd(num, 2);
            test.assertAnd(env.rs.sync._tasks, {
              '/writings/bar': [],
              '/writings/baf': []
            });
            test.done();
          });
        }
      },

      {
        desc: "sync will reject its promise if the cache is not available",
        run: function(env, test) {
          var tmp = env.rs.getNodes;
          env.rs.local.forAllNodes = function(cb) {
            var promise = promising();
            promise.reject('i am broken, deal with it!');
            return promise;
          };
          env.rs.sync.sync().then(function() {
            test.result(false, 'sync was supposed to reject its promise');
          }, function(err) {
            test.assertAnd(err, new Error('local cache unavailable'));
            test.done();
          });
          env.rs.getNodes = tmp;
        }
      },

      {
        desc: "sync will fulfill its promise as long as the cache is available",
        run: function(env, test) {
          env.rs.sync.sync().then(function() {
            test.done();
          }, function(err) {
            test.result(false, 'sync was supposed to fulfill its promise');
          });
        }
      },
      {
        desc: "get with maxAge requirement is rejected if remote is not connected",
        run: function(env, test) {
          env.rs.remote.connected = false;
          env.rs.local.get('asdf', 2).then(function() {
            test.result(false, 'should have been rejected');
          }, function(err) {
            test.done();
          });
        }
      },

      {
        desc: "get with maxAge requirement is rejected if remote is not online",
        run: function(env, test) {
          env.rs.remote.online = false;
          env.rs.local.get('asdf', 2).then(function() {
            test.result(false, 'should have been rejected');
          }, function(err) {
            test.done();
          });
        }
      },
      {
        desc: "when a running requests finishes, the next task from the queue is started, until the queue is empty",
        run: function(env, test) {
          var done1, done2, syncDone, syncReturned;
          env.rs.sync._running = {};
          env.rs.sync._tasks = {};
          env.rs.remote.connected = true;
          env.rs.remote.online = true;
          var p1 = promising();
          var p2 = promising();
          env.rs.sync.on('done', function() {
            if (done1 && done2 && syncReturned) {
              test.done();
            } else {
              syncDone = true;
            }
          });
          p1.then(function() {
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._tasks), ['/2']);
            if (done2 && syncDone && syncReturned) {
              test.done();
            } else {
              done1 = true;
            }
          });
          p2.then(function() {
            if (done1 && syncDone && syncReturned) {
              test.done();
            } else {
              done2 = true;
            }
          });
          env.rs.remote._responses[['get', '/1']] = [200, 'asdf', 'qwer', '123'];
          env.rs.remote._responses[['get', '/2']] = [200, 'asdf', 'qwer', '123'];
          env.rs.sync.numThreads = 1;
          remoteStorage.sync.queueGetRequest('/1', p1);
          remoteStorage.sync.queueGetRequest('/2', p2);
          env.rs.sync.sync().then(function() {
            if (done1 && done2 && syncDone) {
              test.done();
            } else {
              syncReturned = true;
            }
          });
        }
      },

   ], nothing:[
      {
        desc: "a fetch resolution calls addTask and doTasks",
        run: function(env, test) {
          test.result(false, 'TODO 7');
        }
      },

      {
        desc: "markChildren calls addTask and doTasks",
        run: function(env, test) {
          test.result(false, 'TODO 8');
        }
      },

      {
        desc: "newly created children call addTask and doTasks",
        run: function(env, test) {
          test.result(false, 'TODO 9');
        }
      },

      {
        desc: "caching.set calls addTask and doTasks if strategy is FOLDERS",
        run: function(env, test) {
          test.result(false, 'TODO 10');
        }
      },

      {
        desc: "caching.set calls addTask and doTasks if strategy is SEEN_AND_FOLDERS",
        run: function(env, test) {
          test.result(false, 'TODO 11');
        }
      },
      
      {
        desc: "caching.set calls addTask and doTasks if strategy is ALL",
        run: function(env, test) {
          test.result(false, 'TODO 12');
        }
      }
    ]
  });

  return suites;
});
