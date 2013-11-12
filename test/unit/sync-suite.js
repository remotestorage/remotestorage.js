if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs', 'fs'], function(requirejs, fs, undefined) {
  var suites = [];

  suites.push({
    name: "Sync",
    desc: "Sync",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
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
      }
    ]
  });

  return suites;
});
