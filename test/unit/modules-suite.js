if (typeof(define) !== 'function') {
  var define = require('amdefine');
}
define(['./src/remotestorage', './src/modules'], function(RemoteStorage, modules) {

  var suites = [];

  suites.push({
    name: "modules",
    desc: "RemoteStorage modules",
    setup: function(env, test) {
      global.Promise = require('./lib/bluebird.js');
      global.XMLHttpRequest = require('xmlhttprequest');
 
      RemoteStorage.prototype.remote = {
        connected: false
      };
      RemoteStorage.BaseClient = function() {};
      test.done();
    },

    tests: [
      {
        desc: "defineModule creates a module",
        run: function(env, test) {
          RemoteStorage.defineModule('foo', function() {
            return {
              exports: {
                it: 'worked'
              }
            };
          });
          env.rs = new RemoteStorage();
          test.assertAnd(env.rs.foo.it, 'worked');
          test.done();
        }
      },

      {
        desc: "defineModule allows hyphens",
        run: function(env, test) {
          RemoteStorage.defineModule('foo-bar', function() {
            return {
              exports: {
                it: 'worked'
              }
            };
          });
          test.assertAnd(env.rs.fooBar.it, 'worked');
          test.done();
        }
      }
    ]
  });

  return suites;
});
