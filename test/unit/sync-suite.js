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
        './src/lib/access',
        './src/lib/caching',
        './src/lib/store',
        './src/lib/sync',
        './src/lib/store/memory'
      ], function(_util, Access, Caching, store, sync, memoryAdapter) {
        util = _util;
        env.Access = Access;
        env.Caching = Caching;
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
    beforeEach: function(env, test) {
      env.access = new env.Access();
      env.caching = new env.Caching();
      env.sync.setAccess(env.access);
      env.sync.setCaching(env.caching);
      if(env.conflicts.length > 0) {
        console.error("UNRESOLVED CONFLICTS: ", env.conflicts);
        test.result(false);
        return;
      }
      try {
        env.store.forgetAll().
          then(env.remoteAdapter.forgetAll.bind(env.remoteAdapter)).
          then(function() {
            test.result(true);
          });
      } catch(exc) {
        console.error(exc.stack);
      }
    },
    tests: [

      {
        desc: "sync~traverseTree yields each local and remote node",
        run: function(env) {
          util.silenceLogger('store::memory');
          util.setLogLevel('debug');
          var _this = this;
          var traverseTree = env.sync.getInternal('traverseTree');
          // env.sync.setRemoteAdapter(env.remoteAdapter);
          util.getPromise(function(promise) {
            env.remoteAdapter.init({
              'a' : {
                'a' : { 'x' : 'foo' },
                'b' : { 'y' : 'bar' },
                'z' : 'baz'
              }
            }, 'text/plain', 12345, { '/a/' : 'rw' });
            
            env.sync.setRemoteAdapter(env.remoteAdapter);

            var calls = [];

            env.caching.set('/a/', { data: true });

            return traverseTree('/a/', function(local, remote) {
              calls.push([local, remote]);
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

          env.access.set('foo', 'rw');
          
          return env.store.setNodeData(
            '/foo/bar', 'some-text', true, 12345, 'text/plain'
          ).then(function() {
            return needsSync();
          }).then(function(result) {
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

          env.access.set('foo', 'rw');

          return env.store.setNodeData(
            '/foo/bar', 'some-text', false, 12345, 'text/plain'
          ).
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
