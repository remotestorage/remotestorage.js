if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {

  var suites = [];

  var util;
  var Controller, Access, Caching, Sync;

  suites.push({
    name: 'Controller',
    desc: 'propagates configuration, initializes all components',
    setup: function(env, test) {
      requirejs([
        './src/lib/util',
        './src/lib/controller',
        './src/lib/access',
        './src/lib/caching',
        './src/lib/sync'
      ], function(_util, _Controller, _Access, _Caching, _Sync) {
        util = _util;
        Controller = _Controller;
        Access = _Access;
        Caching = _Caching;
        Sync = _Sync;
        test.result(true);
      });
    },

    beforeEach: function(env, test) {
      env.platform = {};
      env.controller = new Controller(env.platform);
      test.result(true);
    },

    tests: [

      {
        desc: "contains access and caching settings",
        run: function(env, test) {
          test.assertTypeAnd(env.controller.access, 'object');
          test.assertAnd(
            env.controller.access instanceof Access, true
          );
          test.assertTypeAnd(env.controller.caching, 'object');
          test.assertAnd(
            env.controller.caching instanceof Caching, true
          );
          test.result(true);
        }
      },

      {
        desc: "provides access to 'platform' object",
        run: function(env, test) {
          test.assert(env.controller.platform, env.platform);
        }
      },

      {
        desc: "initializes sync",
        run: function(env, test) {
          test.assertTypeAnd(env.controller.sync, 'object');
          test.assert(env.controller.sync instanceof Sync, true);
        }
      },

      {
        desc: "#setStorageInfo() sets the storage info",
        run: function(env, test) {
          test.assertTypeAnd(env.controller.storageInfo, 'undefined');
          env.controller.setStorageInfo({
            type: 'remotestorage-00',
            href: 'https://local.dev/storage/me',
            properties: {
              'auth-method': 'something',
            }
          });
          test.assertTypeAnd(env.controller.storageInfo, 'object');
          test.assert(env.controller.storageInfo.type, 'remotestorage-00');
        }
      },

      {
        desc: "#setBearerToken() throws an error, when there is no storageInfo set",
        run: function(env, test) {
          try {
            env.controller.setBearerToken('foo');
            test.result(false, 'nothing was thrown');
          } catch(exc) {
            test.result(true);
          }
        }
      },

      {
        desc: "#setBearerToken() sets the bearer token",
        run: function(env, test) {
          env.controller.setStorageInfo({
            type: 'remotestorage-00',
            href:'https://local.dev/storage/me',
            properties: {}
          });
          env.controller.setBearerToken('foo');
          test.assert(env.controller.bearerToken, 'foo');
        }
      },

      {
        desc: "#setStorageInfo() and #setBearerToken() configure the RemoteStore",
        run: function(env, test) {
          test.assertAnd(env.controller.sync.remote.state, 'anonymous');
          env.controller.setStorageInfo({
            type: 'remotestorage-00',
            href:'https://local.dev/storage/me',
            properties: {}
          });
          test.assertAnd(env.controller.sync.remote.state, 'connecting');
          env.controller.setBearerToken('foo');
          test.assertAnd(env.controller.sync.remote.state, 'connected');
          test.done();
        }
      },

      {
        desc: "#reset() resets #sync",
        timeout: 500,
        run: function(env, test) {
          env.controller.sync.reset = function() {
            test.result(true);
          };
          env.controller.reset();
        }
      },

      {
        desc: "#reset() resets #caching",
        timeout: 500,
        run: function(env, test) {
          env.controller.caching.reset = function() {
            test.result(true);
          };
          env.controller.reset();
        }
      }

    ]
  });

  return suites;

});
