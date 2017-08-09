if (typeof(define) !== 'function') {
  var define = require('amdefine');
}
define(['./src/remotestorage', './src/modules'], function(RemoteStorage, modules) {
  var suites = [];

  suites.push({
    name: "modules",
    desc: "RemoteStorage modules",
    setup: function(env, test) {
      global.XMLHttpRequest = require('xhr2');

      RemoteStorage.prototype.remote = {
        connected: false
      };
      RemoteStorage.BaseClient = function() {};
      test.done();
      env.rs = new RemoteStorage();
    },

    tests: [
      {
        desc: "addModule creates a module",
        run: function(env, test) {
          env.rs.addModule({name: 'foo', builder: function() {
            return {
              exports: {
                it: 'worked'
              }
            };
          }});
          test.assertAnd(env.rs.foo.it, 'worked');
          test.done();
        }
      },
      {
        desc: "addModule allows hyphens",
        run: function(env, test) {
          env.rs.addModule({name: 'foo-bar', builder: function() {
            return {
              exports: {
                it: 'worked'
              }
            };
          }});
          test.assertAnd(env.rs.fooBar.it, 'worked');
          test.done();
        }
      },
      {
        desc: "addModule called from rs constructor",
        run: function(env, test) {
          var rs = new RemoteStorage({modules: [{name: 'bar', builder: function(){
            return {
              exports: {
                it: 'worked'
              }
            };
          }}]});
          test.assertAnd(rs.bar.it, 'worked');
          test.done();
        }

      }
    ]
  });

  return suites;
});
