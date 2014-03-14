if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];

  function FakeCaching(){
    this.FLUSH = 0;
    this.SEEN = 1;
    this.ALL = 7;
    
    this._responses = {};
    this.checkPath = function(path) {
      if (typeof(this._responses[path]) === 'undefined') {
        throw new Error('no FakeCaching response for path ' + path);
      }
      return this._responses[path];
    };
    this.onActivate = function() {};
  }

  function FakeAccess(){
    this._data = {};
    this.set = function(moduleName, value) {
      this._data[moduleName] = value;
    };
    this.get = function(moduleName) {
      return this._data[moduleName];
    };
    this.checkPathPermission = function(path, mode) {
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
          };
          env.rs.sync.findTasks = function() {
            findTasksCalled++;
            return promising().fulfill();
          };
          env.rs.sync.addTask = function() {
            addTaskCalled++;
          };
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
          };
          env.rs.sync.checkRefresh = function() {
            checkRefreshCalled++;
            return promising().fulfill([]);
          };
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
          };
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
          var tmp = env.rs.forAllNodes;
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
          env.rs.forAllNodes = tmp;
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
      }
    ]
  });

  return suites;
});
