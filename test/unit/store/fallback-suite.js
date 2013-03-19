if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {

  var suites = [];

  var util;
  var Caching;
  var FallbackStore;
  var StubStore;

  suites.push({
    name: 'FallbackStore',
    desc: 'A node store proxy forwarding to a local store, when remote is not available',

    setup: function(env, test) {
      requirejs([
        './src/lib/util',
        './src/lib/caching',
        './src/lib/store/stub',
        './src/lib/store/fallback'
      ], function(_util, _Caching, _StubStore, _FallbackStore) {
        util = _util;
        Caching = _Caching;
        StubStore = _StubStore;
        FallbackStore = _FallbackStore;
        test.result(true);
      });
    },

    beforeEach: function(env, test) {
      env.remote = new StubStore();
      env.local = new StubStore();
      env.caching = new Caching();
      env.store = new FallbackStore(env.remote, env.local, env.caching);

      test.result(true);
    },

    tests: [

      {
        desc: "#get() forwards to the remote store",
        run: function(env, test) {
          env.store.get('/foo');
          env.remote.expect(test, 'get', '/foo');
          test.result(true);
        }
      },

      {
        desc: "#get() doesn't forward to the local store, when the remote request succeeds",
        run: function(env, test) {
          env.store.get('/foo');
          var call = env.remote.expect(test, 'get');
          call.promise.fulfill();
          util.nextTick(function() {
            test.assert(env.local.calls.length, 0);
          });
        }
      },

      {
        desc: "#get() forwards to the local store, when the remote request fails and caching is enabled",
        run: function(env, test) {
          env.caching.set('/', { data: true });
          env.store.get('/foo');
          var call = env.remote.expect(test, 'get');
          call.promise.reject();
          util.nextTick(function() {
            env.local.expect(test, 'get', '/foo');
            test.result(true);
          });
        }
      },

      {
        desc: "#get() propagates the error, when remote request fails and caching is disabled",
        run: function(env, test) {
          env.store.get('/foo').
            then(function() {
              test.result(false, '#get() succeeded');
            }, function(error) {
              test.assert(error, 'my-error');
            });
          env.remote.expect(test, 'get').promise.reject('my-error');
        }
      },

      {
        desc: "#set() forwards to the remote store",
        run: function(env, test) {
          var testNode = {
            mimeType: 'text/plain',
            data: 'bar'
          };
          env.store.set('/foo', testNode);
          env.remote.expect(test, 'set', '/foo', testNode);
          test.result(true);
        }
      },

      {
        desc: "#set() with failing remote and caching enabled forwards to local",
        run: function(env, test) {
          env.caching.set('/', { data: true });
          var testNode = {
            mimeType: 'text/plain',
            data: 'bar'
          };
          env.store.set('/foo', testNode);
          env.remote.expect(test, 'set').promise.reject('my-error');
          util.nextTick(function() {
            var localCall = env.local.expect(test, 'set');
            if(! localCall) {
              return;
            }
            test.assertAnd(localCall.args[0], '/foo');
            test.assertType(localCall.args[1], 'object');
          });
        }
      },

      {
        desc: "#set() adds a 'pending' flag to the node, when forwarding to local",
        run: function(env, test) {
          env.caching.set('/', { data: true });
          var testNode = {
            mimeType: 'text/plain',
            data: 'bar'
          };
          env.store.set('/foo', testNode);
          env.remote.expect(test, 'set').promise.reject();
          util.nextTick(function() {
            env.local.expect(test, 'set', '/foo', {
              mimeType: 'text/plain',
              data: 'bar',
              pending: true
            });
            test.assertType(testNode.pending, 'undefined', "#set() altered it's input node!");
          });
        }
      },

      {
        desc: "#set() propagates the error from remote, when caching is disabled",
        run: function(env, test) {
          var testNode = {
            mimeType: 'text/plain',
            data: 'bar'
          };
          env.store.set('/foo', testNode).
            then(function() {
              test.result(false, "#set() succeeded, but it shouldn't!");
            }, function(error) {
              test.assert(error, 'my-error');
            });
          env.remote.expect(test, 'set').promise.reject('my-error');
        }
      },

      {
        desc: "#remove() forwards to the remote store",
        run: function(env, test) {
          env.store.remove('/foo');
          env.remote.expect(test, 'remove', '/foo');
          test.result(true);
        }
      },

      {
        desc: "#remove() propagates errors from remote, when caching is disabled",
        run: function(env, test) {
          env.store.remove('/foo').
            then(function(value) {
              test.result(false, '#remove() succeeded');
            }, function(error) {
              test.assert(error, 'my-error');
            });
          env.remote.expect(test, 'remove').promise.reject('my-error');
        }
      },

      {
        desc: "#remove() forwards to local with the 'cache' flag, when caching is enabled and remote fails",
        run: function(env, test) {
          env.caching.set('/', { data: true });
          env.store.remove('/foo').
            then(function(value) {
              test.assert(value, 123);
            });
          env.remote.expect(test, 'remove').
            promise.reject();
          util.nextTick(function() {
            env.local.expect(test, 'remove', '/foo', true).
              promise.fulfill(123);
          });
        }
      },

      {
        desc: "#configure() is forwarded to remote",
        timeout: 500,
        run: function(env, test) {
          env.store.remote.configure = function(cfg) {
            test.assert(cfg, { foo: 'bar' });
          };
          env.store.configure({ foo: 'bar' });
        }
      },

      {
        desc: "#reset() is forwarded to remote",
        timeout: 500,
        run: function(env, test) {
          env.store.remote.reset = function() {
            test.result(true);
          };
          env.store.reset();
        }
      },

      {
        desc: "#state is equal to the remote state",
        run: function(env, test) {
          env.store.remote.state = 'anonymous';
          test.assertAnd(env.store.state, 'anonymous');
          env.store.remote.state = 'connecting';
          test.assert(env.store.state, 'connecting');
        }
      }

    ]
  });

  return suites;
});
