if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs, undefined) {
  var suites = [];

  suites.push({
    name: "remoteStorage.js file tests",
    desc: "a collection of tests for remoteStorage.js",
    setup: function(env) {

      global.localStorage = require('localStorage');
      var _this = this;
      requirejs(['./src/remoteStorage'], function(remoteStorage) {
        _this.assertTypeAnd(remoteStorage.defineModule, 'function');
        env.remoteStorage = remoteStorage;
        // define test module
        var moduleName = 'test';
        env.remoteStorage.defineModule(moduleName, function(privateClient, publicClient) {
          return {
            name: 'test',
            exports: {
              makePath: function(path) {
                return privateClient.makePath(path);
              }
            }
          };
        });
        _this.result(true);
      });
    },
    takedown: function(env) {
      env = '';
      this.result(true);
    },
    tests: [
      {
        desc: "claimAccess()",
        run: function(env, test) {
          var _this = this;
          env.remoteStorage.claimAccess('test', 'rw');
          test.assertAnd(env.remoteStorage.access.scopes, ['test'], JSON.stringify(env.remoteStorage.access.scopes) + ' vs. ' + '["test"]');
          test.assertType(env.remoteStorage.test, 'object');
        }
      }
    ]
  });
  return suites;
});
