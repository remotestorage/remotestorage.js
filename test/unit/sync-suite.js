if(typeof(define) !== 'function') {
  var define = require('amdefine').define;
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  var util;
  var Sync, Caching, Access;

  suites.push({
    name: "Sync",
    desc: "provides synchronization between two stores",
    setup: function(env, test) {
      requirejs([
        './src/lib/util',
        './src/lib/sync',
        './src/lib/caching',
        './src/lib/access',
      ], function(_util, _Sync, _Caching, _Access) {
        util = _util;
        Sync = _Sync;
        Caching = _Caching;
        Access = _Access;
        test.result(true);
      });
    },

    beforeEach: function(env, test) {
      env.controller = {
        platform: {
          http: function() {},
          localStore: {}
        },
        caching: new Caching(),
        access: new Access()
      };
      env.sync = new Sync(env.controller);
      test.result(true);
    },

    tests: [

      {
        desc: "initializes a remote store",
        run: function(env, test) {
          test.assertTypeAnd(env.sync.remote, 'object');
          test.assertTypeAnd(env.sync.remote.get, 'function');
          test.assertTypeAnd(env.sync.remote.set, 'function');
          test.assertType(env.sync.remote.remove, 'function');
        }
      },

      {
        desc: "initializes a local store",
        run: function(env, test) {
          test.assertTypeAnd(env.sync.local, 'object');
          test.assertTypeAnd(env.sync.local.get, 'function');
          test.assertTypeAnd(env.sync.local.set, 'function');
          test.assertType(env.sync.local.remove, 'function');
        }
      },

      {
        desc: "#get() forwards to remote store, when caching is disabled",
        run: function(env, test) {
          env.sync.remote.get = function(path) {
            test.assert(path, '/foo');
          };
          env.sync.get('/foo');
        }
      },

      {
        desc: "#set() forwards to remote store, when caching is disabled",
        run: function(env, test) {
          var testNode = {
            mimeType: 'text/plain',
            data: 'hello'
          };
          env.sync.remote.set = function(path, node) {
            test.assertAnd(path, '/foo');
            test.assert(node, testNode);
          };
          env.sync.set('/foo', testNode);
        }
      },

      {
        desc: "#remove() forwards to remote store, when caching is disabled",
        run: function(env, test) {
          env.sync.remote.remove = function(path) {
            test.assert('/foo', path);
          };
          env.sync.remove('/foo');
        }
      },

      {
        desc: "#get() forwards to the local store, when caching is enabled",
        run: function(env, test) {
          env.controller.caching.cachePath = function() { return true; };
          env.sync.local.get = function(path) {
            test.assert('/foo', path);
          };
          env.sync.get('/foo');
        }
      },

      {
        desc: "#set() forwards to the local and remote store, when caching is enabled",
        run: function(env, test) {
          env.controller.caching.cachePath = function() { return true; };
          var testNode = {
            mimeType: 'text/plain',
            data: 'Hello World!'
          };
          var localCalled, remoteCalled;
          env.sync.remote.set = function(path, node) {
            remoteCalled = true;
            test.assertAnd(path, '/hello');
            test.assertAnd(node, testNode);
            return util.getPromise().fulfill();
          };
          env.sync.local.set = function(path, node) {
            localCalled = true;
            test.assertAnd(path, '/hello');
            test.assertAnd(node, testNode);
            return util.getPromise().fulfill();
          };
          env.sync.set('/hello', testNode).
            then(function() {
              test.result(localCalled && remoteCalled);
            });
        }
      },

      {
        desc: "#remove() forwards to the local and remote store, when caching is enabled",
        run: function(env, test) {
          env.controller.caching.cachePath = function() { return true; };
          var localCalled, remoteCalled;
          env.sync.remote.remove = function(path) {
            remoteCalled = true;
            test.assertAnd(path, '/hello');
            return util.getPromise().fulfill();
          };
          env.sync.local.remove = function(path) {
            localCalled = true;
            test.assertAnd(path, '/hello');
            return util.getPromise().fulfill();
          };
          env.sync.remove('/hello').then(function() {
            test.result(localCalled && remoteCalled);
          });
        }
      },

      {
        desc: "#computeSyncSettings() computes the correct paths and modes",
        run: function(env, test) {
          env.controller.caching.set('/a/foo/', { data: true });
          env.controller.caching.set('/a/bar/', { data: true });
          env.controller.caching.set('/b/', { data: true });
          env.controller.caching.set('/no-access/', { data: true });
          env.controller.access.claim('a', 'rw');
          env.controller.access.claim('b', 'r');
          test.assert(env.sync.computeSyncSettings(), [
            { path: '/a/foo/', access: 'rw', caching: { data: true } },
            { path: '/a/bar/', access: 'rw', caching: { data: true } },
            { path: '/b/', access: 'r', caching: { data: true } }
          ]);
        }
      },

      {
        desc: "#syncPath() with full access & caching loads a remote file node and stores it locally",
        run: function(env, test) {
          var testNode = {
            mimeType: 'text/plain',
            data: 'Hello World!'
          };
          var localCalled, remoteCalled;
          env.sync.remote.get = function(path) {
            remoteCalled = true;
            test.assertAnd(path, '/hello');
            return util.getPromise().fulfill(testNode);
          };
          env.sync.local.set = function(path, node) {
            localCalled = true;
            test.assertAnd(path, '/hello');
            test.assertAnd(node, testNode);
            return util.getPromise().fulfill();
          };
          env.sync.syncPath('/hello', 'rw', { data: true }).
            then(function() {
              test.result(remoteCalled && localCalled);
            });
        }
      },

      {
        desc: "#syncPath() with full access & caching descends into directories and syncs files",
        run: function(env, test) {
          var testDir = {
            mimeType: 'application/json',
            data: { 'hello': '123' }
          };
          var testFile = {
            mimeType: 'text/plain',
            data: 'Hello World!',
            version: '123'
          };
          var localCalled, remoteCalled;
          env.sync.remote.get = function(path) {
            var promise = util.getPromise();
            if(path === '/test/') {
              return promise.fulfill(testDir);
            } else if(path === '/test/hello') {
              remoteCalled = true;
              return promise.fulfill(testFile);
            } else {
              test.result(false, "didn't expect remote to be asked for '" + path + "'");
            }
          };
          env.sync.local.set = function(path, node) {
            if(path === '/test/') {
              test.result(false, "directory nodes should not be set!");
            } else if(path === '/test/hello') {
              localCalled = true;
              test.assertAnd(node, testFile);
            } else {
              test.result(false, "didn't expect local to be given a node for '" + path + "'");
            }
            return util.getPromise().fulfill();
          };
          env.sync.syncPath('/test/', 'rw', { data: true }).
            then(function() {
              test.result(localCalled && remoteCalled);
            });
        }
      },

      {
        desc: "#syncPath() with tree-only caching doesn't GET files from remote, but still stores the version locally",
        run: function(env, test) {
          var testDir = {
            mimeType: 'application/json',
            data: { 'hello': '123' }
          };
          var localCalled, remoteCalled;
          env.sync.remote.get = function(path) {
            var promise = util.getPromise();
            if(path === '/test/') {
              remoteCalled = true;
              return promise.fulfill(testDir);
            } else if(path === '/test/hello') {
              test.result(false, "remote was asked for a file");
            } else {
              test.result(false, "didn't expect remote to be asked for '" + path + "'");
            }
          };
          env.sync.local.set = function(path, node) {
            if(path === '/test/') {
              test.assertAnd(node, testDir);
            } else if(path === '/test/hello') {
              test.assertAnd(node, {
                version: '123'
              });
              localCalled = true;
            } else {
              test.result(false, "didn't expect local to be given a node for '" + path + "'");
            }
            return util.getPromise().fulfill();
          };
          env.sync.syncPath('/test/', 'rw', { data: false }).
            then(function() {
              test.result(localCalled && remoteCalled);
            });
        }
      },

      {
        desc: "#sync() syncs all paths computed by #computeSyncSettings()",
        run: function(env, test) {
          env.controller.caching.set('/a/foo/', { data: true });
          env.controller.caching.set('/a/bar/', { data: true });
          env.controller.caching.set('/b/', { data: true });
          env.controller.caching.set('/no-access/', { data: true });
          env.controller.access.claim('a', 'rw');
          env.controller.access.claim('b', 'r');
          var expected = { '/a/foo/':true, '/a/bar/':true, '/b/':true };
          env.sync.syncPath = function(path, accessMode, cachingMode) {
            delete expected[path];
            if(path === '/a/foo/') {
              test.assertAnd(accessMode, 'rw');
              test.assertAnd(cachingMode, { data: true });
            } else if(path === '/a/bar/') {
              test.assertAnd(accessMode, 'rw');
              test.assertAnd(cachingMode, { data: true });
            } else if(path === '/b/') {
              test.assertAnd(accessMode, 'r');
              test.assertAnd(cachingMode, { data: true });
            } else {
              test.result(false, "Unexpected path given to #syncPath: " + path);
            }
            return util.getPromise().fulfill();
          };
          env.sync.sync().then(function() {
            test.assert(Object.keys(expected).length, 0, "There are still paths left which haven't been synced: " + Object.keys(expected).join(', '));
          });
        }
      }

    ]
  });

  return suites;
});
