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
      RemoteStorage.log = function() {};
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
        },
        removeEventListener: function(eventName, handler) {
          var hl = this._handlers[eventName].length;
          for (var i=0;i<hl;i++) {
            if (this._handlers[eventName][i] === handler) {
              this._handlers[eventName].splice(i, 1);
              return;
            }
          }
        }
      };

      global.document = {
        location: {
          href: ''
        }
      };
      RemoteStorage.Authorize.setLocation({ href: 'http://foo/bar' } );
      test.done();
    },

    afterEach: function(env, test) {
      delete global.document;
      test.done();
    },

    tests: [
      {
        desc: "document.location getter",
        run: function(env, test) {
          test.assert(RemoteStorage.Authorize.getLocation().href, "http://foo/bar");
        }
      },

      {
        desc: "document.location setter",
        run: function(env, test) {
          RemoteStorage.Authorize.setLocation("https://bar/foo");
          test.assert(RemoteStorage.Authorize.getLocation().href, "https://bar/foo");
        }
      },

      {
        desc: "_rs_init removes params from the fragment",
        run: function(env, test) {
          document.location.href = 'http://foo/bar#foo=bar';
          RemoteStorage.Authorize._rs_init(new RemoteStorage());
          test.assert(RemoteStorage.Authorize.getLocation().hash, '');
        }
      },

      {
        desc: "_rs_init sets up a features-loaded handler",
        run: function(env, test) {
          var storage = new RemoteStorage();
          RemoteStorage.Authorize._rs_init(storage);
          test.assert(storage._handlers['features-loaded'].length, 1);
        }
      },

      {
        desc: "the 'features-loaded' handler configures the WireClient if it sees an access token",
        run: function(env, test) {
          var storage = new RemoteStorage();
          document.location.href = 'http://foo/bar#access_token=my-token';
          RemoteStorage.Authorize._rs_init(storage);
          storage.remote = {
            configure: function(userAddress, href, type, token) {
              test.assert(token, 'my-token');
            }
          };
          storage._handlers['features-loaded'][0]();
        }
      },

      {
        desc: "the 'features-loaded' handler initiates a connection attempt, when it sees a user address",
        run: function(env, test) {
          var storage = new RemoteStorage();
          document.location.href = 'http://foo/bar#remotestorage=nil%40heahdk.net';
          RemoteStorage.Authorize._rs_init(storage);
          storage.connect = function(userAddress) {
            test.assert(userAddress, 'nil@heahdk.net');
          };
          storage._handlers['features-loaded'][0]();
        }
      },

      {
        desc: "the 'features-loaded' handler is removed after cleanup",
        run: function(env, test) {
          var storage = new RemoteStorage();
          document.location.href = 'http://foo/bar#access_token=my-token';
          RemoteStorage.Authorize._rs_init(storage);
          test.assertAnd(storage._handlers['features-loaded'].length, 1);
          RemoteStorage.Authorize._rs_cleanup(storage);
          test.assertAnd(storage._handlers['features-loaded'].length, 0);
          test.done();
        }
      }
    ]
  });

  return suites;
});
