if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['requirejs', 'fs'], function(requirejs, fs, undefined) {
  var suites = [];

  suites.push({
    name: "Authorize",
    desc: "OAuth dance",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      require('./src/authorize');

      test.done();
    },

    beforeEach: function(env, test) {
      RemoteStorage.prototype = {
        _handlers: {
          'features-loaded': []
        },
        on: function(eventName, handler) {
          this._handlers[eventName].push(handler);
        }
      };

      global.document = { location: { hash: '' } };
      test.done();
    },

    afterEach: function(env, test) {
      delete global.document;
      test.done();
    },

    tests: [

      {
        desc: "_rs_init removes params from the fragment",
        run: function(env, test) {
          document.location.hash = '#foo=bar';
          RemoteStorage.Authorize._rs_init(new RemoteStorage);
          test.assert(document.location.hash, '');
        }
      },

      {
        desc: "_rs_init sets up a features-loaded handler",
        run: function(env, test) {
          var storage = new RemoteStorage;
          RemoteStorage.Authorize._rs_init(storage);
          test.assert(storage._handlers['features-loaded'].length, 1);
        }
      },

      {
        desc: "the 'features-loaded' handler configures the WireClient if it sees an access token",
        run: function(env, test) {
          var storage = new RemoteStorage;
          document.location.hash = '#access_token=my-token';
          RemoteStorage.Authorize._rs_init(storage);
          storage.remote = {
            configure: function(href, type, token) {
              test.assert(token, 'my-token');
            }
          };
          storage._handlers['features-loaded'][0]();
        }
      },

      {
        desc: "the 'features-loaded' handler initiates a connection attempt, when it sees a user address",
        run: function(env, test) {
          var storage = new RemoteStorage;
          document.location.hash = '#user_address=nil%40heahdk.net';
          RemoteStorage.Authorize._rs_init(storage);
          storage.connect = function(userAddress) {
            test.assert(userAddress, 'nil@heahdk.net');
          };
          storage._handlers['features-loaded'][0]();
        }
      }

    ]

  });


  return suites;
});
