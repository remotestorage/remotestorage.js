if (typeof(define) !== 'function') {
  var define = require('amdefine.js');
}
define(['require', 'tv4', './build/eventhandling', './build/util'],
       function (require, tv4, EventHandling, util) {
  var suites = [];

  var consoleLog, fakeLogs;
  global.XMLHttpRequest = require('xhr2').XMLHttpRequest;

  function fakeRequest(path) {
    if (path === '/testing403') {
      return Promise.resolve({statusCode: 403});
    } else {
      return Promise.resolve({statusCode: 200});
    }
  }

  class FakeRemote {
    constructor(connected) {
      this.fakeRemote = true;
      this.connected = (typeof connected === 'boolean') ? connected : true;
      this.configure = function() {};
      this.stopWaitingForToken = function() {
        if (!this.connected) { this._emit('not-connected'); }
      };
      this.addEvents(['connected', 'disconnected', 'not-connected']);
    }
  }
  FakeRemote.prototype.get = fakeRequest;
  FakeRemote.prototype.put = fakeRequest;
  FakeRemote.prototype.delete = fakeRequest;
  util.applyMixins(FakeRemote, [EventHandling.EventHandling]);

  function FakeLocal() {}

  FakeLocal.prototype = {
    fireInitial: function() {/*ignore*/}
  };

  function fakeConsoleLog() {
    fakeLogs.push(Array.prototype.slice.call(arguments));
  }

  function replaceConsoleLog() {
    consoleLog = console.log;
    console.log = fakeConsoleLog;
  }

  function restoreConsoleLog() {
    console.log = consoleLog;
    consoleLog = undefined;
  }

  function assertNoConsoleLog(test) {
    test.assert(fakeLogs.length, 0);
  }

  function assertConsoleLog(test) {
    var expected = Array.prototype.slice.call(arguments, 1);
    test.assert(fakeLogs[0], expected);
  }

  suites.push({
    // abortOnFail: true,
    name: "remoteStorage",
    desc: "the RemoteStorage instance",
    setup:  function(env, test) {
      global.XMLHttpRequest = require('xhr2').XMLHttpRequest;
      global.SyncedGetPutDelete = require('./build/syncedgetputdelete');
      global.Authorize = require('./build/authorize').Authorize;
      global.UnauthorizedError = require('./build/unauthorized-error');
      global.Sync = require('./build/sync').Sync;
      global.config = require('./build/config');
      global.log = require('./build/log');
      global.Dropbox = require('./build/dropbox');
      global.RemoteStorage = require('./build/remotestorage').RemoteStorage;
      global.localStorage = {};
      global.RemoteStorage.prototype.remote = new FakeRemote();
      test.done();
    },

    beforeEach: function(env, test) {
      var remoteStorage = new RemoteStorage({cache: false, disableFeatures: ['WireClient'] });
      env.rs = remoteStorage;
      config.cordovaRedirectUri = undefined;
      remoteStorage.on('ready', test.done);
    },

    tests: [
      {
        desc: "#get raises UnauthorizedError on 403",
        run: function (env, test) {
          var success = false;

          env.rs.on('error', function (e) {
            if (e instanceof UnauthorizedError) {
              success = true;
            }
          });
          env.rs.get('/testing403').then(function (r) {
            test.assertAnd(r.statusCode, 403);
            test.assert(success, true);
          });
        }
      },

      {
        desc: "#put raises UnauthorizedError on 403",
        run: function(env, test) {
          var success = false;
          env.rs.on('error', function(e) {
            if (e instanceof UnauthorizedError) {
              success = true;
            }
          });
          env.rs.put('/testing403').then(function(status) {
            test.assert(success, true);
          });
        }
      },

      {
        desc: "#delete raises UnauthorizedError on 403",
        run: function (env, test) {
          var success = false;
          env.rs.on('error', function (e) {
            if (e instanceof UnauthorizedError) {
              success = true;
            }
          });
          env.rs.delete('/testing403').then(function (status) {
            test.assert(success, true);
          });
        }
      },

      {
        desc: "#get #put #delete not emitting Error when getting 200",
        run: function(env, test) {
          var success = true;
          var c = 0;
          function test_done() {
            c += 1;
            if (c === 3) {
              test.done();
            }
          }
          env.rs.on('error', function(e) {
            success = false;
          });
          env.rs.get('/testing200').then(function() {
            test.assert(success, true);
          });
          env.rs.put('/testing200').then(function() {
            test.assert(success, true);
          });
          env.rs.delete('/testing200').then(function() {
            test.assert(success, true);
          });
        }
      },

      {
        desc: "#reconnect with remotestorage backend clears the token and connects again",
        run: function(env, test) {

          env.rs.backend = 'remotestorage';

          const oldConnect = env.rs.connect;

          env.rs.remote = new FakeRemote(false);
          env.rs.remote.userAddress = 'test@foo.bar';
          env.rs.remote.configure = function(options) {
            test.assertAnd(options.token, null);
            env.rs.remote.configure = function() {};
          }
          env.rs.connect = function(params) {
            test.assert(params, 'test@foo.bar');

            // reset everything
            env.rs.connect = oldConnect;
            env.rs.remote = new FakeRemote(false);
          }

          env.rs.reconnect();
        }
      },

      {
        desc: "#reconnect with dropbox backend clears the token and connects again",
        run: function(env, test) {

          env.rs.backend = 'dropbox';

          env.rs.remote = new FakeRemote(false);
          env.rs.remote.configure = function(options) {
            test.assertAnd(options.token, null);
            env.rs.remote.configure = function() {};
          }
          env.rs.remote.connect = function(params) {
            test.assertType(params, 'undefined');

            env.rs.remote = new FakeRemote(false);
          }

          env.rs.reconnect();
        }
      },

      {
        desc: "#disconnect fires disconnected",
        run: function(env, test) {
          env.rs.on('disconnected', function() {
            test.done();
          });
          env.rs.disconnect();
        }
      },

      {
        desc: "#disconnect waits for cleanup promises to resolve before marking them as done",
        run: function(env, test) {
          var promiseResolved = false;

          var promiseMock = {
            then: function(callback) {
              promiseResolved = true;
              callback();
            }
          };

          env.rs._cleanups = [function() { return promiseMock; }];

          env.rs.on('disconnected', function() {
            if (promiseResolved) {
              test.done();
            } else {
              test.fail('Cleanup promise was not resolved.');
            }
          });

          env.rs.disconnect();
          // config.cache = true
        }
      },

      {
        desc: "cleanup functions don't bloat up on repeated initialization",
        run: function(env, test) {
          var initsCalled = 0;
          // // Mock feature to be loaded on initialization
          // Sync._rs_init = function Sync_rs_init() {};
          // Sync._rs_cleanup = function Sync_rs_cleanup() {};

          // TODO Please someone document this test. It is incomprehensible as is.

          var loadedHandler = function() {
            initsCalled++;

            if (initsCalled === 1) { // ignore first init, as that's from original initialization
              test.assertAnd(env.rs._cleanups.length, 4);
            } else {
              test.assertAnd(env.rs._cleanups.length, 4);
            }

            if (initsCalled === 2) {
              env.rs._init();
            } else if (initsCalled === 3) {
              env.rs.removeEventListener('features-loaded', loadedHandler);
              // delete Sync;
              test.done();
            }
          };

          env.rs.on('features-loaded', loadedHandler);
          env.rs._init();
        }
      },

      {
        desc: "remote connected fires connected",
        run: function(env, test) {
          env.rs.on('connected', function() {
            test.done();
          });
          env.rs.remote._emit('connected');
        }
      },

      {
        desc: "remote not-connected fires not-connected",
        run: function(env, test) {
          env.rs.on('not-connected', function() {
            test.done();
          });
          env.rs.remote._emit('not-connected');
        }
      },

      {
        desc: "fires connected when remote already connected",
        run: function(env, test) {
          env.rs.on('connected', function() {
            test.done();
          });
          env.rs._init();
        }
      },

      {
        desc: "connected fires ready only once",
        run: function(env, test) {
          var times = 0;
          env.rs.on('ready', function(e) {
            test.assertAnd(times, 0);
            times++;
          });
          setTimeout(function() {
            env.rs.remote._emit('connected');
            env.rs.remote._emit('connected');
            env.rs.remote._emit('connected');
            env.rs.remote._emit('connected');
            setTimeout(function() {
              test.assert(times, 1);
            }, 10);
          }, 10);
        }
      },

      {
        desc: "maxAge defaults to false when not connected",
        run: function(env, test) {
          var rs = {
            get: SyncedGetPutDelete.get,
            local: {
              get: function(path, maxAge) {
                test.assertAnd(path, 'foo');
                test.assertAnd(maxAge, false);
                test.done();
              }
            },
            sync: {
              queueGetRequest: function() {
              }
            },
            connected: false
          };
          rs.get('foo');
        }
      },

      {
        desc: "maxAge defaults to false when not online",
        run: function(env, test) {
          var rs = {
            get: SyncedGetPutDelete.get,
            local: {
              get: function(path, maxAge) {
                test.assertAnd(path, 'foo');
                test.assertAnd(maxAge, false);
                test.done();
              }
            },
            sync: {
              queueGetRequest: function() {
              }
            },
            remote: {
              connected: true,
              online: false
            }
          };
          rs.get('foo');
        }
      },

      {
        desc: "maxAge defaults to 2*getSyncInterval when connected",
        run: function(env, test) {
          var rs = {
            get: SyncedGetPutDelete.get,
            local: {
              get: function(path, maxAge) {
                test.assertAnd(path, 'foo');
                test.assertAnd(maxAge, 34222);
                test.done();
              }
            },
            sync: {
              queueGetRequest: function() {
              }
            },
            connected: true,
            remote: {
              connected: true,
              online: true
            },
            getSyncInterval: function() {
              return 17111;
            }
          };
          rs.get('foo');
        }
      },

      {
        desc: "Set Cordova redirect URI config with valid URI",
        run: function(env, test) {
          env.rs.setCordovaRedirectUri('https://hyperchannel.kosmos.org');
          test.assert(config.cordovaRedirectUri, 'https://hyperchannel.kosmos.org');
        }
      },

      {
        desc: "Set Cordova redirect URI config with invalid argument",
        run: function(env, test) {
          try {
            env.rs.setCordovaRedirectUri('yolo');
          } catch(e) {
            test.assert(typeof config.cordovaRedirectUri, 'undefined');
            test.done();
            throw(e);
          }
        }
      },

      {
        desc: "Setting and getting the request timeout",
        run: function(env, test) {
          // check the default value
          test.assertAnd(env.rs.getRequestTimeout(), 30000);

          env.rs.setRequestTimeout(5000);
          test.assertAnd(env.rs.getRequestTimeout(), 5000);

          // setting back to default
          env.rs.setRequestTimeout(30000);
          test.assert(env.rs.getRequestTimeout(), 30000);
        }
      },

      {
        desc: "#syncCycle registers an event handler to schedule periodic sync",
        run: function (env, test) {
          env.rs.sync = { sync: function(){} };
          env.rs.syncCycle();

          test.assert(env.rs._handlers["sync-done"].length, 1);
        }
      },

      {
        desc: "#syncCycle does not register any event handlers when there is no sync instance",
        run: function (env, test) {
          env.rs.syncCycle();

          test.assert(env.rs._handlers["sync-done"].length, 0);
        }
      },

      {
        desc: "sync-done handler does not reschedule a new sync when sync is stopped",
        run: function (env, test) {
          env.rs.sync = { sync: function() {} };
          env.rs.syncCycle();

          env.rs.sync.stopped = true;

          env.rs._emit('sync-done');

          test.assert(env.rs._syncTimer, undefined);
        }
      },

      {
        desc: "sync-done handler does not reschedule a new sync when there is no sync instance",
        run: function (env, test) {
          env.rs.sync = { sync: function() {} };
          env.rs.syncCycle();

          env.rs.sync = undefined;

          env.rs._emit('sync-done');

          test.assert(env.rs._syncTimer, undefined);
        }
      },

      {
        desc: "#stopSync clears any scheduled sync calls",
        run: function (env, test) {
          // This timeout should not be called because it gets cancelled by stopSync()
          env.rs._syncTimer = setTimeout(function() {
            test.result(false, "This should not have been called after stopSync");
          }, 10);

          // This timeout ends the test successfully when the previous timeout
          // doesn't get called
          setTimeout(function() {
            test.result(true);
          }, 20);

          env.rs.stopSync();

          test.assertAnd(env.rs._syncTimer, undefined);
        }
      },

      {
        desc: "#authorize redirects to the OAuth provider",
        run: function (env, test) {
          global.document = {
            location: {
              origin: 'https://app.com:5000',
              pathname: '/foo/bar',
              href: 'https://app.com:5000/foo/bar',
              toString: function() { return this.href; }
            }
          };

          const authURL = 'https://provider.com/oauth';
          env.rs.access.claim('contacts', 'r');

          env.rs.authorize({ authURL });

          test.assert(document.location.href, 'https://provider.com/oauth?redirect_uri=https%3A%2F%2Fapp.com%3A5000%2Ffoo%2Fbar&scope=contacts%3Ar&client_id=https%3A%2F%2Fapp.com%3A5000&response_type=token');

          delete global.document;
        }
      },

      {
        desc: "#authorize uses the given scope",
        run: function (env, test) {
          global.document = {
            location: {
              origin: 'https://app.com:5000',
              pathname: '/foo/bar',
              href: 'https://app.com:5000/foo/bar',
              toString: function() { return this.href; }
            }
          };

          const authURL = 'https://provider.com/oauth';

          env.rs.authorize({ authURL, scope: 'custom-scope' });

          test.assert(document.location.href, 'https://provider.com/oauth?redirect_uri=https%3A%2F%2Fapp.com%3A5000%2Ffoo%2Fbar&scope=custom-scope&client_id=https%3A%2F%2Fapp.com%3A5000&response_type=token');

          delete global.document;
        }
      },

      {
        desc: "#authorize uses the cordovaRedirectUri when in Cordova",
        run: function (env, test) {
          global.document = {
            location: {
              origin: 'https://app.com:5000',
              pathname: '/foo/bar',
              href: 'https://app.com:5000/foo/bar',
              toString: function() { return this.href; }
            }
          };

          global.cordova = { foo: 'bar' }; // Pretend we run in Cordova

          global.Authorize.openWindow = function(url, redirectUri) {
            test.assertAnd(url, 'https://provider.com/oauth?redirect_uri=https%3A%2F%2Fmy.custom-redirect.url&scope=contacts%3Ar&client_id=https%3A%2F%2Fmy.custom-redirect.url&response_type=token');
            test.assertAnd(redirectUri, 'https://my.custom-redirect.url');
            delete global.cordova;
            delete global.document;
            test.done();
          };

          const authURL = 'https://provider.com/oauth';

          env.rs.access.claim('contacts', 'r');
          env.rs.setCordovaRedirectUri('https://my.custom-redirect.url');
          env.rs.authorize({ authURL });
        }
      },

      {
        desc: "#authorize uses the given clientId",
        run: function (env, test) {
          global.document = {
            location: {
              origin: 'https://app.com:5000',
              pathname: '/foo/bar',
              href: 'https://app.com:5000/foo/bar',
              toString: function() { return this.href; }
            }
          };

          const authURL = 'https://provider.com/oauth';
          env.rs.access.claim('contacts', 'r');

          env.rs.authorize({ authURL, clientId: 'my-client-id' });

          test.assert(document.location.href, 'https://provider.com/oauth?redirect_uri=https%3A%2F%2Fapp.com%3A5000%2Ffoo%2Fbar&scope=contacts%3Ar&client_id=my-client-id&response_type=token');

          delete global.document;
        }
      },

      {
        desc: "#authorize does not add a trailing slash as only pathname to redirectUri",
        run: function (env, test) {
            global.document = {
              location: {
                origin: 'https://app.com:5000',
                pathname: '/',
                href: 'https://app.com:5000/',
                toString: function() { return this.href; }
              }
            };

            const authURL = 'https://provider.com/oauth';

            env.rs.authorize({ authURL, scope: 'custom-scope' });

            test.assert(document.location.href, 'https://provider.com/oauth?redirect_uri=https%3A%2F%2Fapp.com%3A5000&scope=custom-scope&client_id=https%3A%2F%2Fapp.com%3A5000&response_type=token');

            delete global.document;
        }
      },

    ]
  });

  suites.push({
    name: "RemoteStorage",
    // abortOnFail: true,
    desc: "The global RemoteStorage namespace",
    setup: function(env, test) {
      test.done();
    },

    beforeEach: function(env, test) {
      global.log = require('./build/log');
      fakeLogs = [];
      test.done();
    },

    tests: [
      {
        desc: "exports the global RemoteStorage function",
        run: function(env, test) {
          test.assertType(RemoteStorage, 'function');
        }
      },

      {
        desc: "#log doesn't call console.log by default",
        run: function(env, test) {
          replaceConsoleLog();
          try {
            log('message');
            assertNoConsoleLog(test);
          } catch(e) {
            restoreConsoleLog();
            throw e;
          }
          restoreConsoleLog();
        }
      },

      {
        desc: "#log calls console.log, when config.logging is true",
        run: function(env, test) {
          replaceConsoleLog();
          try {
            config.logging = true;
            log('foo', 'bar', 'baz');
            assertConsoleLog(test, 'foo', 'bar', 'baz');
          } catch(e) {
            restoreConsoleLog();
            config.logging = false;
            throw e;
          }
          restoreConsoleLog();
          config.logging = false;
        }
      }
    ]
  },

  {
    name: "remoteStorage",
    desc: "the RemoteStorage instance - without a connected remote",
    setup: function(env, test) {
      RemoteStorage.prototype.remote = new FakeRemote(false);
      test.assertType(RemoteStorage, 'function');
    },
    tests: [
      {
        desc: "ready event fires",
        run: function(env, test) {
          env.remoteStorage = new RemoteStorage();
          env.remoteStorage.on('ready', function(e) {
            test.done();
          });
        }
      },
      {
        desc: "#hasFeature BaseClient [true]",
        run: function(env, test) {
          test.assert(env.remoteStorage.hasFeature('BaseClient'), true);
        }
      },
      {
        desc: "#hasFeature Authorize [false]",
        run: function(env, test) {
          test.assert(env.remoteStorage.hasFeature('Authorize'), false);
        }
      },
      {
        desc: "remote not connected",
        run: function(env, test) {
          test.assert(env.remoteStorage.remote.connected, false);
        }
      },
    ]
  });

  return suites;
});
