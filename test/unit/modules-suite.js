if (typeof(define) !== 'function') {
  var define = require('amdefine');
}
define([], function() {

  var suites = [];

  suites.push({
    name: "modules",
    desc: "RemoteStorage modules",
    setup: function(env, test) {
      require('./src/remotestorage');
      if (global.rs_rs) {
        RemoteStorage = global.rs_rs;
      } else {
        global.rs_rs = RemoteStorage;
      }

      require('./src/eventhandling');
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }

      RemoteStorage.prototype.remote = {
        connected: false
      };
      RemoteStorage.BaseClient = function() {};
      require('./src/modules');
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
