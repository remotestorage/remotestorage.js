if(typeof(define) !== 'function') {
  var define = require('amdefine').define;
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  var util;

  suites.push({
    name: "sync internals",
    desc: "synchronizes remote storage and local cache",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/lib/store',
        './src/lib/sync',
        './src/lib/store/memory'
      ], function(_util, store, sync, memoryAdapter) {
        util = _util;
        env.store = store;
        env.store.setAdapter(memoryAdapter());
        env.sync = sync;
        env.remoteAdapter = memoryAdapter();
        env.remoteAdapter.getState = function() { return 'connected'; };
        env.remoteAdapter.expireKey = function() {};
        env.remoteAdapter.clearCache = function() {
          return env.remoteAdapter.forgetAll();
        };
        env.conflicts = [];
        env.sync.on('conflict', function(event) {
          env.conflicts.push(event);
        });
        _this.result(true);
      });
    },
    beforeEach: function(env) {
      var _this = this;
      if(env.conflicts.length > 0) {
        console.error("UNRESOLVED CONFLICTS: ", env.conflicts);
        this.result(false);
        return;
      }
      try {
        env.store.forgetAll().
          then(env.remoteAdapter.forgetAll.bind(env.remoteAdapter)).
          then(util.curry(this.result.bind(this), true));
      } catch(exc) {
        console.error(exc.stack);
      }
    },
    tests: [

      {
        desc: "sync~findRoots works for the root node",
        run: function(env) {
          var _this = this;
          var findRoots = env.sync.getInternal('findRoots');
          env.store.setNodeAccess('/', 'rw').
            then(findRoots).
            then(function(roots) {
              _this.assert(roots, ['/']);
            }, function(error) {
              console.error('findRoots failed', error);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~findRoots works for top-level nodes",
        run: function(env) {
          var _this = this;
          var findRoots = env.sync.getInternal('findRoots');
          env.store.setNodeAccess('/foo/', 'rw').
            then(function() {
              return env.store.setNodeAccess('/public/foo/', 'rw');
            }).
            then(findRoots).
            then(function(roots) {
              _this.assert(roots, ['/foo/', '/public/foo/']);
            }, function(error) {
              console.error("findRoots failed", error);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~findAccess works for direct access nodes",
        run: function(env) {
          var _this = this;
          var findAccess = env.sync.getInternal('findAccess');
          env.store.setNodeAccess('/foo/', 'r').
            then(function() {
              return findAccess('/foo/');
            }).then(function(access) {
              _this.assert(access, 'r');
            }, function(error) {
              console.error('findAccess failed', error);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~findAccess works for deeply nested nodes",
        run: function(env) {
          var _this = this;
          var findAccess = env.sync.getInternal('findAccess');
          env.store.setNodeAccess('/foo/', 'rw').
            then(function() {
              return findAccess('/foo/bar/baz/blubb');
            }).then(function(access) {
              _this.assert(access, 'rw');
            }, function(error) {
              console.error('findAccess failed', error);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~findNextForceRoots finds direct descendents",
        run: function(env) {
          var _this = this;
          var findNextForceRoots = env.sync.getInternal('findNextForceRoots');
          env.store.setNodeForce('/foo/bar/', true, true).
            then(function() {
              return env.store.setNodeForce('/foo/baz/', false, true);
            }).
            then(util.curry(findNextForceRoots, '/foo/')).
            then(function(roots) {
              _this.assert(roots, ['/foo/bar/', '/foo/baz/']);
            }, function(error) {
              console.error('findNextForceRoots failed', error);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~findNextForceRoots finds nested nodes on different levels",
        run: function(env) {
          var _this = this;
          var findNextForceRoots = env.sync.getInternal('findNextForceRoots');
          env.store.setNodeForce('/foo/bar/baz/', true, true).
            then(function() {
              return env.store.setNodeForce('/foo/a/b/c/d/', true, true);
            }).
            then(util.curry(findNextForceRoots, '/foo/')).
            then(function(roots) {
              _this.assert(roots, ['/foo/bar/baz/', '/foo/a/b/c/d/']);
            }, function(error) {
              console.error('findNextForceRoots failed', error);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~traverseTree yields each local and remote node",
        run: function(env) {
          util.silenceLogger('store::memory');
          util.setLogLevel('debug');
          var _this = this;
          var traverseTree = env.sync.getInternal('traverseTree');
          // env.sync.setRemoteAdapter(env.remoteAdapter);
          util.makePromise(function(promise) {
            env.remoteAdapter.init({
              'a' : {
                'a' : { 'x' : 'foo' },
                'b' : { 'y' : 'bar' },
                'z' : 'baz'
              }
            }, 'text/plain', 12345, { '/a/' : 'rw' });
            
            env.sync.setRemoteAdapter(env.remoteAdapter);

            var calls = [];

            env.store.setNodeForce('/a/', true, true).
              then(function() {
                return traverseTree('/a/', function(local, remote) {
                  calls.push([local, remote]);
                });
              }).
              then(function() {
                _this.assertAnd(calls.length, 3);
                calls = calls.map(function(call) { return call[0]; });
                _this.assert(
                  calls.sort(),
                  ['/a/a/x', '/a/b/y', '/a/z']
                );
              }, function(error) {
                console.error("caught error in test: ", error, error.stack);
                _this.result(false);
              });
            
          });
        }
      },

      {
        desc: "sync~processNode updates remote nodes",
        run: function(env) {
          var _this = this;
          var processNode = env.sync.getInternal('processNode');
          env.remoteAdapter.init({}, undefined, undefined, {});
          env.sync.setRemoteAdapter(env.remoteAdapter);
          env.store.setNodeData('/foo/bar', 'some text', true, 12345, 'text/plain').
            // make sure that diff was set.
            then(function() {
              return env.store.getNode('/foo/');
            }).then(function(parentNode) {
              _this.assertAnd(parentNode.diff, { 'bar': 12345 });
            }).then(function() {
              return env.store.getNode('/foo/bar');
            }).then(function(localNode) {
              return processNode('/foo/bar', localNode, { timestamp: 0 });
            }).then(function() {
              return env.remoteAdapter.get('/foo/bar');
            }).then(function(remoteNode) {
              // check remote node
              _this.assertTypeAnd(remoteNode, 'object');
              _this.assertAnd(remoteNode.timestamp, 12345);
              _this.assertAnd(remoteNode.data, 'some text');
              _this.assertAnd(remoteNode.mimeType, 'text/plain');
              // check that diff was cleared.
              return env.store.getNode('/foo/');
            }).then(function(parentNode) {
              _this.assert(parentNode.diff, {});
            }, function(error) {
              console.error("processNode failed: ", error, error.stack);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~processNode updates local nodes",
        run: function(env) {
          var _this = this;
          var processNode = env.sync.getInternal('processNode');
          env.remoteAdapter.init({}, undefined, undefined, {});
          env.sync.setRemoteAdapter(env.remoteAdapter);
          processNode('/foo/bar', { // local
            timestamp: 0,
            lastUpdatedAt: 0,
            deleted: false
          }, { // remote
            timestamp: 12345,
            data: 'some text',
            mimeType: 'text/plain',
            binary: false
          }).then(function() {
            return env.store.getNode('/foo/bar');
          }).then(function(localNode) {
            _this.assertAnd(localNode.timestamp, 12345);
            _this.assertAnd(localNode.data, 'some text');
            _this.assert(localNode.mimeType, 'text/plain');
          }, function(error) {
            console.error("processNode failed: ", error, error.stack);
            _this.result(false);
          });
        }
      },

      {
        desc: "sync~processNode deletes remote nodes",
        run: function(env) {
          var _this = this;
          var processNode = env.sync.getInternal('processNode');
          env.remoteAdapter.init({
            'foo': {
              'bar': 'some text'
            }
          }, 'text/plain', 12345, {});
          env.sync.setRemoteAdapter(env.remoteAdapter);
          env.remoteAdapter.get('/foo/bar').
            then(function(remoteNode) {
              return processNode('/foo/bar', { // local
                timestamp: 23456,
                lastUpdatedAt: 12345,
                deleted: true
              }, remoteNode);
            }).then(function() {
              return env.remoteAdapter.get('/foo/bar');
            }).then(function(remoteNode) {
              _this.assertType(remoteNode, 'undefined');
            }, function(error) {
              console.error("processNode failed: ", error, error.stack);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~processNode fires conflict events when both sides are updated",
        run: function(env) {
          var _this = this;
          var processNode = env.sync.getInternal('processNode');
          env.remoteAdapter.init({
            'foo': {
              'bar': 'some-txt'
            }
          }, 'text/plain', 23456, {});
          env.sync.setRemoteAdapter(env.remoteAdapter);
          env.remoteAdapter.get('/foo/bar').
            then(function(remoteNode) {
              return processNode('/foo/bar', {
                timestamp: 34567,
                lastUpdatedAt: 12345,
                deleted: false,
                data: 'some-local-text',
                mimeType: 'text/plain'
              }, remoteNode);
            }).then(function() {
              _this.assertAnd(env.conflicts.length, 1);
              var conflict = env.conflicts.shift();
              _this.assertAnd(conflict.path, '/foo/bar');
              _this.assertAnd(conflict.remoteTime, new Date(23456));
              _this.assertAnd(conflict.localTime, new Date(34567));
              _this.assert(true, true);
            }, function(error) {
              console.error("processNode failed: ", error, error.stack);
              _this.result(false);
            });
        }
      },
      
      {
        desc: "sync~needsSync yields true, when there is a diff",
        run: function(env) {
          var _this = this;
          var needsSync = env.sync.getInternal('needsSync');
          env.store.setNodeAccess('/foo/', 'rw').
            then(function() {
              return env.store.setNodeData(
                '/foo/bar', 'some-text', true, 12345, 'text/plain'
              );
            }).
            then(function() {
              return needsSync();
            }).
            then(function(result) {
              _this.result(result);
            }, function(error) {
              console.error('needsSync failed: ', error, error.stack);
              _this.result(false);
            });
        }
      },

      {
        desc: "sync~needsSync yields false, when there is no diff",
        run: function(env) {
          var _this = this;
          var needsSync = env.sync.getInternal('needsSync');
          env.store.setNodeAccess('/foo/', 'rw').
            then(function() {
              return env.store.setNodeData(
                '/foo/bar', 'some-text', false, 12345, 'text/plain'
              );
            }).
            then(function() {
              return needsSync();
            }).
            then(function(result) {
              _this.result(!result);
            }, function(error) {
              console.error('needsSync failed: ', error, error.stack);
              _this.result(false);
            });
        }
      }

    ]
  });

  return suites;
});
