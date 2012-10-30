module.exports = function() {
  var suites = [];

  suites.push({
    name: "remoteStorage.js file tests",
    desc: "a collection of tests for remoteStorage.js",
    setup: function(env) {
      if (typeof define !== 'function') {
        var define = require('amdefine')(module);
      }
      var requirejs = require('requirejs');
      requirejs.config({
        // can't we specify the base repository dir instead of having to
        // juggle relative paths?
        baseUrl: __dirname+'/../src/',
        nodeRequire: require
      });

      global.localStorage = require('localStorage');
      var _this = this;
      requirejs(['remoteStorage'], function(remoteStorage) {
        _this.assertTypeAnd(remoteStorage.defineModule, 'function');
        global.remoteStorage = remoteStorage;
        // define test module
        var moduleName = 'test';
        remoteStorage.defineModule(moduleName, function(privateClient, publicClient) {
          return {
            name: 'test',
            exports: {
              makePath: function(path) {
                return privateClient.makePath(path);
              }
            }
          };
        });
        var moduleList = remoteStorage.getModuleList();

        _this.assert(moduleList, ['test']);
      });
    },
    takedown: function(env) {
      env = '';
      this.result(true);
    },
    tests: [
      {
        desc: "claimAccess()",
        run: function(env) {
          remoteStorage.claimAccess('test', 'rw');
          this.assertAnd(remoteStorage.getClaimedModuleList, ['test']);
          env.tm = remoteStorage.getClient();
          this.assertType(env.tm, 'object');
        }
      },
      {
        desc: "makePath()",
        run: function(env) {
          var ret = env.tm.makePath('this/is/a/path');
          console.log(ret);
          this.assert(ret, '/test/this/is/a/path');
        }
      }
    ]
  });
  return suites;
}();
