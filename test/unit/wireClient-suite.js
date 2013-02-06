if(typeof(define) !== 'function') {
  var define = require('amdefine').define;
}
define(['requirejs', 'localStorage'], function(requirejs, localStorage) {

  global.localStorage = localStorage;

  var suites = [];

  suites.push({
    name: "wireClient suite",
    desc: "the wireClient holds storage information and queries the storage",
    setup: function(env, test) {
      requirejs([
        './src/lib/wireClient'
      ], function(wireClient) {
        env.wireClient = wireClient;
        test.result(true);
      });
    },

    afterEach: function(env, test) {
      env.wireClient.disconnectRemote();
      // resets event handlers
      env.wireClient.reset();
      test.result(true);
    },

    tests: [

      {
        desc: "setting storage info & token fires a 'connected' event",
        run: function(env, test) {
          env.wireClient.on('connected', function() {
            test.result(true);
          });
          env.wireClient.setStorageInfo({ type: 'foo', href: 'bar' });
          env.wireClient.setBearerToken('token');
        }
      },

      {
        desc: "recalculating the state doesn't fire 'connected' again",
        run: function(env, test) {
          env.wireClient.setStorageInfo({ type: 'foo', href: 'bar' });
          env.wireClient.setBearerToken('token');
          env.wireClient.on('connected', function() {
            test.result(false, "expected 'connect' not to be fired, but it was");
          });
          env.wireClient.calcState();
          setTimeout(function() {
            test.result(true);
          }, 50);
        }
      }

    ]
  });

  return suites;
});