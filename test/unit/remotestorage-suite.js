if(typeof(define) !== 'function') {
  var define = require('amdefine');
}
define([], function() {
  
  var suites = [];

  var consoleLog, fakeLogs;

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