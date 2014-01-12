if (typeof(define) !== 'function') {
  var define = require('amdefine');
}
define([], function() {

  var suites = [];

  var consoleLog, fakeLogs;

  function FakeRemote() {
    this.connected = true;
    this.configure = function() {};
    RemoteStorage.eventHandling(this, 'connected', 'disconnected', 'not-connected');
  }

  function fakeRequest(path) {
    var promise = promising();
    console.log('GET CALLED');
    if (path === '/testing403') {
      promise.fulfill(403);
    } else {
      promise.fulfill(200);
    }
    return promise;
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
      require('./src/eventhandling');
      require('./lib/promising');
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      RemoteStorage.Discover = function(userAddress, callback) {
        if (userAddress === "someone@somewhere") {
          callback();
        }
      };
      global.localStorage = {};
      RemoteStorage.prototype.remote = new FakeRemote();
      //RemoteStorage.prototype.local = new FakeLocal();
      test.done();
    },

    beforeEach: function(env, test) {
      var remoteStorage = new RemoteStorage();
      //remoteStorage._emit('ready');
      env.rs = remoteStorage;
      test.done();
    },

    tests: [
      {
        desc: "#get emiting error RemoteStorage.Unauthorized on 403",
        run: function(env, test) {
          var success = false;
          env.rs.on('error', function(e) {
            if (e instanceof RemoteStorage.Unauthorized) {
              success = true;
            }
          });
          env.rs.get('/testing403').then(function(status) {
            test.assertAnd(status, 403);
            test.assertAnd(success, true);
            test.done();
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
        run: function(env, test) {
          var success = false;
          env.rs.on('error', function(e) {
            if (e instanceof RemoteStorage.Unauthorized) {
              success = true;
            }
          });
          env.rs.delete('/testing403').then(function(status) {
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
            test.assertAnd(success, true);
            test_done();
          });
          env.rs.put('/testing200').then(function() {
            test.assertAnd(success, true);
            test_done();
          });
          env.rs.delete('/testing200').then(function() {
            test.assertAnd(success, true);
            test_done();
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
          localStorage = {};
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
          env.rs.on('error', function(e) {
            test.assertAnd(e instanceof RemoteStorage.DiscoveryError, true);
            test.assertAnd(e.message, "No storage information found at that user address.", "wrong error message : "+e.message);
            test.done();
          });
          env.rs.connect("someone@timeout");
        }
      }
    ]
  });

  suites.push({
    name: "RemoteStorage",
    desc: "The global RemoteStorage namespace",
    setup: function(env, test) {
      require('./src/remotestorage');
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
        desc: "#log calls console.log, when _log is true",
        run: function(env, test) {
          replaceConsoleLog();
          try {
            RemoteStorage._log = true;
            RemoteStorage.log('foo', 'bar', 'baz');
            assertConsoleLog(test, 'foo', 'bar', 'baz');
          } catch(e) {
            restoreConsoleLog();
            RemoteStorage._log = false;
            throw e;
          }
          restoreConsoleLog();
        }
      }
    ]
  });

  return suites;
});
