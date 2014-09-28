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
      require('./src/eventhandling');
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }

      require('./src/authorize');
      if (global.rs_authorize) {
        RemoteStorage.authorize = global.rs_authorize;
      } else {
        global.rs_authorize = RemoteStorage.authorize;
      }


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
        desc: "Authorize redirects to the provider's OAuth location",
        run: function(env, test) {
          var authUrl = 'http://storage.provider.com/oauth';
          var scope = 'contacts:r';
          var redirectUri = 'http://awesome.app.com/#custom/path';
          var clientId = 'http://awesome.app.com/';

          RemoteStorage.Authorize(authUrl, scope, redirectUri, clientId);

          var expectedUrl = 'http://storage.provider.com/oauth?redirect_uri=http%3A%2F%2Fawesome.app.com%2F&scope=contacts%3Ar&client_id=http%3A%2F%2Fawesome.app.com%2F&state=custom%2Fpath&response_type=token';
          test.assert(document.location.href, expectedUrl);
        }
      },

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
            configure: function(settings) {
              test.assert(settings.token, 'my-token');
            }
          };
          storage._handlers['features-loaded'][0]();
        }
      },

      {
        desc: "the 'features-loaded' handler adds the state param to the location when given",
        run: function(env, test) {
          var storage = new RemoteStorage();
          document.location.href = 'http://foo/bar#access_token=my-token&state=custom%2Fpath';
          RemoteStorage.Authorize._rs_init(storage);
          storage.remote = {
            configure: function(settings) {}
          };
          storage._handlers['features-loaded'][0]();

          test.assert(document.location.href, '#custom/path');
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
        desc: "the 'features-loaded' handler calls remote.stopWaitingForToken when it sees no access_token and no user address",
        run: function(env, test) {
          var storage = new RemoteStorage();
          document.location.href = 'http://foo/bar#a=b';
          RemoteStorage.Authorize._rs_init(storage);
          storage.connect = function(userAddress) {
            test.assert(userAddress, 'nil@heahdk.net');
          };
          storage.remote = {
            stopWaitingForToken: function() {
              test.done();
            }
          };
          storage._handlers['features-loaded'][0]();
        }
      },

      {
        desc: "the 'features-loaded' handler calls remote.stopWaitingForToken when there are no params",
        run: function(env, test) {
          var storage = new RemoteStorage();
          document.location.href = 'http://foo/bar#a=b';
          RemoteStorage.Authorize._rs_init(storage);
          storage.connect = function(userAddress) {
            test.assert(userAddress, 'nil@heahdk.net');
          };
          storage.remote = {
            stopWaitingForToken: function() {
              test.done();
            }
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
