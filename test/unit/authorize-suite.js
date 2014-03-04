if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
if(typeof global === 'undefined') global = window;
global.RemoteStorage = function() {};

define([], function() {
  var suites = [];

  suites.push({
    name: "Authorize",
    desc: "OAuth dance",
    setup: function(env, test) {
      RemoteStorage.log = function() {};
      require(['./src/eventhandling', './src/authorize'], function(){
        if (global.rs_eventhandling) {
          RemoteStorage.eventHandling = global.rs_eventhandling;
        } else {
          global.rs_eventhandling = RemoteStorage.eventHandling;
        }
        test.done();
      });
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

      if(typeof window !== undefined) {
        global.myDocument = {
          location: {
            href: ''
          }
        };
        global.rs_setLocation = RemoteStorage.Authorize.setLocation;
        global.rs_getLocation = RemoteStorage.Authorize.getLocation;
        RemoteStorage.Authorize.setLocation = function(location) {
          if (typeof location === 'string') {
            global.myDocument.location.href = location;
          } else if (typeof location === 'object') {
            global.myDocument.location.href = location.href;
          } else {
            throw "Invalid location " + location;
          }
        };
        RemoteStorage.Authorize.getLocation = function () {
          return global.myDocument.location;
        };
      } else {
        global.document = { location: { href: '' } };
        global.myDocument = global.document;
      }

      RemoteStorage.Authorize.setLocation({ href: 'http://foo/bar' } );
      test.done();
    },

    afterEach: function(env, test) {
      if(typeof window === 'undefined' ) {
        delete global.document;
      } else {
        delete global.myDocument;
        RemoteStorage.Authorize.setLocation = global.rs_setLocation;
        RemoteStorage.Authorize.getLocation = global.rs_getLocation;
      }
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
          myDocument.location.href = 'http://foo/bar#foo=bar';
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
          myDocument.location.href = 'http://foo/bar#access_token=my-token';
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
          myDocument.location.href = 'http://foo/bar#remotestorage=nil%40heahdk.net';
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
          myDocument.location.href = 'http://foo/bar#a=b';
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
          myDocument.location.href = 'http://foo/bar#a=b';
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
          myDocument.location.href = 'http://foo/bar#access_token=my-token';
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
