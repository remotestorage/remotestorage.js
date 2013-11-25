if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs', 'fs'], function(requirejs, fs, undefined) {
  var suites = [];

  require('./lib/promising');

  suites.push({
    name: "Sync",
    desc: "Sync",
    setup: function(env, test) {
      global.RemoteStorage = function() {
        return {
          local: {
            changesBelow: function() {
              console.log('local changesBelow');
            },
          },
          remote: {
            changesBelow: function() {
              console.log('remote changesBelow');
            },
          },
        };
      };
      RemoteStorage.log = function() {};
      require('./src/sync');

      test.done();
    },

    beforeEach: function(env, test) {
      test.done();
    },

    tests: [

      {
        desc: "Default value ",
        run: function(env, test) {
          test.assert(RemoteStorage.Sync.getSyncInterval(), 10000);
        }
      },

      {
        desc: "Update value",
        run: function(env, test) {
          RemoteStorage.Sync.setSyncInterval(60000);
          test.assert(RemoteStorage.Sync.getSyncInterval(), 60000);
        }
      },

      {
        desc: "#set a wrong value throws an error",
        run: function (env, test) {
          try {
            RemoteStorage.Sync.setSyncInterval('60000');
            test.result(false, "setSyncInterval() didn't fail");
          } catch (e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#sync calls local.changesBelow",
        run: function(env, test) {
          local = {
            changesBelow: function() {
              test.result(true);
              return promising().fulfill();
            }
          };
          var remote = {
          };
          RemoteStorage.Sync.sync(remote, local, '');
        }
      }
    ]
  });

  return suites;
});
