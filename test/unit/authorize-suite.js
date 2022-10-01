if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([ 'require', './build/authorize', './build/unauthorized-error', 'test/helpers/mocks'], function(require, Authorize, UnauthorizedError, mocks) {
  var suites = [];

  suites.push({
    name: "Authorize",
    desc: "OAuth dance",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      RemoteStorage.log = function() {};
      env.Authorize = Authorize;
      env.UnauthorizedError = UnauthorizedError;
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
      }

      global.document = {
        location: {
          href: ''
        }
      };
      env.Authorize.setLocation({ href: 'http://foo/bar' } );
      mocks.defineMocks(env);
      mocks.defineFetchMock(env);
      test.done();
    },

    afterEach: function(env, test) {
      mocks.undefineMocks(env);
      delete global.document;
      test.done();
    },

    tests: [
      {
        desc: "#authorize redirects to the provider's OAuth location",
        run: function(env, test) {
          var authURL = 'http://storage.provider.com/oauth';
          var scope = 'contacts:r';
          var redirectUri = 'http://awesome.app.com/#custom/path';
          var clientId = 'http://awesome.app.com/';

          this.localStorageAvailable = function() { return true; };

          env.Authorize.authorize(this, {authURL, scope, redirectUri, clientId});

          var expectedUrl = 'http://storage.provider.com/oauth?redirect_uri=http%3A%2F%2Fawesome.app.com%2F&scope=contacts%3Ar&client_id=http%3A%2F%2Fawesome.app.com%2F&state=custom%2Fpath&response_type=token';
          test.assert(document.location.href, expectedUrl);
        }
      },

      {
        desc: "#authorize redirects to the provider's OAuth location with empty fragment",
        run: function(env, test) {
          var authURL = 'http://storage.provider.com/oauth';
          var scope = 'contacts:r';
          var redirectUri = 'http://awesome.app.com/#';
          var clientId = 'http://awesome.app.com/';

          this.localStorageAvailable = function() { return true; };

          env.Authorize.authorize(this, {authURL, scope, redirectUri, clientId});

          var expectedUrl = 'http://storage.provider.com/oauth?redirect_uri=http%3A%2F%2Fawesome.app.com%2F&scope=contacts%3Ar&client_id=http%3A%2F%2Fawesome.app.com%2F&response_type=token';
          test.assert(document.location.href, expectedUrl);
        }
      },

      {
        desc: "#authorize doesn't redirect, but opens an in-app-browser window",
        run: function(env, test) {
          document.location.href = 'file:///some/cordova/path';
          var authURL = 'http://storage.provider.com/oauth';
          var scope = 'contacts:r';
          var redirectUri = 'http://awesome.app.com/#';
          var clientId = 'http://awesome.app.com/';

          global.cordova = { foo: 'bar' }; // Pretend we run in Cordova

          this.localStorageAvailable = function() { return true; };

          env.Authorize.openWindow = function(url, uri) {
            test.assertAnd(uri, redirectUri);
            delete global.cordova;
            test.done();
          };

          env.Authorize.authorize(this, {authURL, scope, redirectUri, clientId});

          test.assertAnd(document.location.href, 'file:///some/cordova/path');
        }
      },

      {
        desc: "#authorize fails with useful error when there's no scope provided",
        run: function(env, test) {
          var authURL = 'http://storage.provider.com/oauth';
          var scope = undefined;
          var redirectUri = 'http://awesome.app.com/#custom/path';
          var clientId = 'http://awesome.app.com/';

          this.localStorageAvailable = function() { return true; };

          var sawError = false;
          try {
            env.Authorize.authorize(this, {authURL, scope, redirectUri, clientId});
          } catch (e) {
            test.assert(e.message.includes("scope"), true, "Thrown Error must have a message mentioning 'scope'");
            sawError = true;
          }
          test.assert(sawError, true, "Must throw an error when scope is not set");
        }
      },

      {
        desc: "document.location getter",
        run: function(env, test) {
          document.location.href = 'http://foo/bar';
          test.assert(env.Authorize.getLocation().href, "http://foo/bar");
        }
      },

      {
        desc: "document.location setter",
        run: function(env, test) {
          document.location.href = 'http://foo/bar';
          env.Authorize.setLocation("https://bar/foo");
          test.assert(env.Authorize.getLocation().href, "https://bar/foo");
        }
      },

      {
        desc: "_rs_init removes params from the fragment",
        run: function(env, test) {
          document.location.href = 'http://foo/bar#foo=bar';
          env.Authorize._rs_init(new RemoteStorage());
          test.assert(env.Authorize.getLocation().hash, '');
        }
      },

      {
        desc: "_rs_init sets up a features-loaded handler",
        run: function(env, test) {
          var storage = new RemoteStorage();
          env.Authorize._rs_init(storage);
          test.assert(storage._handlers['features-loaded'].length, 1);
        }
      },

      {
        desc: "_rs_init extracts rsDiscovery data param for configuring the WireClient",
        run: function(env, test) {
          var storage = new RemoteStorage();

          // mock the atob function, as it's not available in node
          global.atob = function(param) {
            return JSON.stringify({
              userAddress: 'user@host.com',
              href: 'https://storage.host.com',
              storageApi: 'storage-api',
              properties: {}
            });
          };

          storage.remote = {
            configure: function(settings) {
              if (settings.token) {
                test.assertAnd(settings.token, 'my-token');
              } else {
                test.assertAnd(settings.userAddress, 'user@host.com');
                test.assertAnd(settings.href, 'https://storage.host.com');
                test.assertAnd(settings.storageApi, 'storage-api');
                test.assertAnd(settings.properties, {});
              }
            }
          };

          document.location.href = 'http://foo/bar#access_token=my-token&state=foo%3Dbar%26rsDiscovery%3Dencodeddata';
          env.Authorize._rs_init(storage);

          storage._handlers['features-loaded'][0]();

          test.assertAnd(env.Authorize.getLocation().href, 'http://foo/bar#foo=bar');
          test.done();
        }
      },
      {
        desc: "the 'features-loaded' handler configures the WireClient if it sees an access token",
        run: function(env, test) {
          var storage = new RemoteStorage();
          document.location.href = 'http://foo/bar#access_token=my-token';
          env.Authorize._rs_init(storage);
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
          env.Authorize._rs_init(storage);
          storage.remote = {
            configure: function(settings) {}
          };
          storage._handlers['features-loaded'][0]();

          test.assert(document.location.href, 'http://foo/bar#custom/path');
        }
      },
      {
        desc: "the 'features-loaded' handler initiates a connection attempt, when it sees a user address",
        run: function(env, test) {
          var storage = new RemoteStorage();
          document.location.href = 'http://foo/bar#remotestorage=nil%40heahdk.net';
          env.Authorize._rs_init(storage);
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
          env.Authorize._rs_init(storage);
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
          env.Authorize._rs_init(storage);
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
          env.Authorize._rs_init(storage);
          test.assertAnd(storage._handlers['features-loaded'].length, 1);
          env.Authorize._rs_cleanup(storage);
          test.assertAnd(storage._handlers['features-loaded'].length, 0);
          test.done();
        }
      },

      {
        desc: "the Unauthorized error accepts an error code",
        run: function(env, test) {
          let error = new env.UnauthorizedError('error message', { code: 'error_code' });
          test.assertAnd(error.message, 'error message');
          test.assert(error.code, 'error_code');
        }
      }
    ]
  });

  return suites;
});
