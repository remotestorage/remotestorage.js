if (typeof(define) !== 'function') {
  var define = require('amdefine');
}
define(['./src/init'], function(RemoteStorage) {

  var suites = [];

  suites.push({
    name: "modules",
    desc: "RemoteStorage modules",
    setup: function(env, test) {
      global.Promise = require('./lib/bluebird.js');
      if (global.rs_rs) {
        global.RemoteStorage = global.rs_rs;
      } else {
        global.rs_rs = RemoteStorage;
      }

      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }

      if (global.rs_util) {
        RemoteStorage.util = global.rs_util;
      } else {
        global.rs_util = RemoteStorage.util;
      }

      RemoteStorage.prototype.remote = {
        connected: false
      };
      RemoteStorage.BaseClient = function() {};
      test.done();
    },

    tests: [
      {
        desc: "defineModule creates a module",
        run: function(env, test) {
          RemoteStorage.defineModule('foo', function() {
            return {
              exports: {
                it: 'worked'
              }
            };
          });
          env.rs = new RemoteStorage();
          test.assertAnd(env.rs.foo.it, 'worked');
          test.done();
        }
      },

      {
        desc: "defineModule allows hyphens",
        run: function(env, test) {
          RemoteStorage.defineModule('foo-bar', function() {
            return {
              exports: {
                it: 'worked'
              }
            };
          });
          test.assertAnd(env.rs.fooBar.it, 'worked');
          test.done();
        }
      }
    ]
  });

  return suites;
});
