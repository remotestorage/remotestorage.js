if (typeof(define) !== 'function') {
  var define = require('amdefine.js');
}
define(['bluebird', 'requirejs', 'tv4'], function (Promise, requirejs, tv4) {

  global.Promise = Promise;
  global.tv4 = tv4;

  var suites = [];

  var consoleLog, fakeLogs;

  function FakeRemote(connected) {
    this.connected = (typeof connected === 'boolean') ? connected : true;
    this.configure = function() {};
    this.stopWaitingForToken = function() {
      if (!this.connected) {
        this._emit('not-connected');
      }
    };
    RemoteStorage.eventHandling(this, 'connected', 'disconnected', 'not-connected');
  }

  function fakeRequest(path) {
    console.log('GET CALLED');
    if (path === '/testing403') {
      return Promise.resolve({statusCode: 403});
    } else {
      return Promise.resolve({statusCode: 200});
    }
  }

  FakeRemote.prototype = {
    get: fakeRequest,
    put: fakeRequest,
    delete: fakeRequest
  };

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
    name: "remoteStorage",
    desc: "the RemoteStorage instance",
    setup:  function(env, test) {
      require('./src/remotestorage');
      if (global.rs_rs) {
        global.RemoteStorage = global.rs_rs;
      } else {
        global.rs_rs = RemoteStorage;
      }
      require('./src/eventhandling.js');
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      RemoteStorage.Discover = function(userAddress) {
        var pending = Promise.defer();
        if (userAddress === "someone@somewhere") {
          pending.reject('in this test, discovery fails for that address');
        }
        return  pending.promise;
      };
      global.localStorage = {};
      RemoteStorage.prototype.remote = new FakeRemote();
      test.done();
    },

    beforeEach: function(env, test) {
      var remoteStorage = new RemoteStorage();
      env.rs = remoteStorage;
      RemoteStorage.config.cordovaRedirectUri = undefined;
      test.done();
    },

    tests: [
      {
        desc: "#get emiting error RemoteStorage.Unauthorized on 403",
        run: function (env, test) {
          var success = false;
          env.rs.on('error', function (e) {
            if (e instanceof RemoteStorage.Unauthorized) {
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
        desc: "#put emiting error RemoteStorage.Unauthorized on 403",
        run: function(env, test) {
          var success = false;
          env.rs.on('error', function(e) {
            if (e instanceof RemoteStorage.Unauthorized) {
              success = true;
            }
          });
          env.rs.put('/testing403').then(function(status) {
            test.assert(success, true);
          });
        }
      },

      {
        desc: "#delete emiting error RemoteStorage.Unauthorized on 403",
        run: function (env, test) {
          var success = false;
          env.rs.on('error', function (e) {
            if (e instanceof RemoteStorage.Unauthorized) {
              success = true;
            }
          });
          env.rs.delete('/testing403').then(function (status) {
            test.assert(success, true);
          });
        }
      },

      {
        desc: "#get #put #delete not emmitting Error when getting 200",
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
        desc: "#connect throws unauthorized when userAddress doesn't contain an @",
        run: function(env, test) {
          env.rs.on('error', function(e) {
            test.assert(e instanceof RemoteStorage.DiscoveryError, true);
          });
          env.rs.connect('somestring');
        }
      },

      {
        desc: "#connect sets the backend to remotestorage",
        run: function(env, test) {
          global.localStorage = {};
          env.rs.connect('user@ho.st');
          test.assert(localStorage, {'remotestorage:backend': 'remotestorage'});
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
        desc: "#connect throws DiscoveryError on empty href",
        run: function(env, test) {
          env.rs.on('error', function(e) {
            test.assertAnd(e instanceof RemoteStorage.DiscoveryError, true);
            test.assertAnd(e.message, "Failed to contact storage server.", "wrong error message : "+e.message);
            test.done();
          });
          env.rs.connect('someone@somewhere');
        }
      },

      {
        desc: "#connect throws DiscoveryError on timeout of RemoteStorage.Discover",
        run: function(env, test) {
          RemoteStorage.config.discoveryTimeout = 500;
          env.rs.on('error', function(e) {
            test.assertAnd(e instanceof RemoteStorage.DiscoveryError, true);
            test.assertAnd(e.message, "No storage information found at that user address.", "wrong error message : "+e.message);
            test.done();
          });
          env.rs.connect("someone@timeout");
        }
      },

      {
        desc: "maxAge defaults to false when not connected",
        run: function(env, test) {
          var rs = {
            get: RemoteStorage.SyncedGetPutDelete.get,
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
            get: RemoteStorage.SyncedGetPutDelete.get,
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
            get: RemoteStorage.SyncedGetPutDelete.get,
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
          test.assert(RemoteStorage.config.cordovaRedirectUri, 'https://hyperchannel.kosmos.org');
        }
      },

      {
        desc: "Set Cordova redirect URI config with invalid argument",
        run: function(env, test) {
          try {
            env.rs.setCordovaRedirectUri('yolo');
          } catch(e) {
            test.assert(typeof RemoteStorage.config.cordovaRedirectUri, 'undefined');
            test.done();
            throw(e);
          }
        }
      },
    ]
  });

  suites.push({
    name: "RemoteStorage",
    desc: "The global RemoteStorage namespace",
    setup: function(env, test) {
      require('./src/remotestorage.js');
      test.done();
    },

    beforeEach: function(env, test) {
      fakeLogs = [];
      test.done();
    },

    tests: [
      {
        desc: "exports the global RemoteStorage function",
        run: function(env, test) {
          test.assertType(global.RemoteStorage, 'function');
        }
      },

      {
        desc: "#log doesn't call console.log by default",
        run: function(env, test) {
          replaceConsoleLog();
          try {
            RemoteStorage.log('message');
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
            RemoteStorage.config.logging = true;
            RemoteStorage.log('foo', 'bar', 'baz');
            assertConsoleLog(test, 'foo', 'bar', 'baz');
          } catch(e) {
            restoreConsoleLog();
            RemoteStorage.config.logging = false;
            throw e;
          }
          restoreConsoleLog();
        }
      }
    ]
  },

  {
    name: "remoteStorage",
    desc: "the RemoteStorage instance - without a connected remote",
    setup: function(env, test) {
      require('./src/remotestorage');
      if (global.rs_rs) {
        global.RemoteStorage = global.rs_rs;
      } else {
        global.rs_rs = RemoteStorage;
      }

      require('./src/util');
      if (global.rs_util) {
        RemoteStorage.util = global.rs_util;
      } else {
        global.rs_util = RemoteStorage.util;
      }

      require('./src/eventhandling');
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }

      require('./src/wireclient');
      if (global.rs_wireclient) {
        RemoteStorage.WireClient = global.rs_wireclient;
      } else {
        global.rs_wireclient = RemoteStorage.WireClient;
      }

      require('./lib/Math.uuid');
      require('./src/baseclient');
      require('./src/baseclient/types');
      if (global.rs_baseclient_with_types) {
        RemoteStorage.BaseClient = global.rs_baseclient_with_types;
      } else {
        global.rs_baseclient_with_types = RemoteStorage.BaseClient;
      }

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
