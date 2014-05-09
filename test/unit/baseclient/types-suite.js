if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define([], function() {
  var suites = [];

  suites.push({
    name: "BaseClient.Types",
    desc: "Type and schema handling",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      RemoteStorage.BaseClient = function() {
        this.moduleName = 'foo';
      };
      RemoteStorage.BaseClient.prototype.extend = function(obj) {
        console.log('extending', obj);
        for (var field in obj) {
          this[field] = obj[field];
        }
        return this;
      };
      require('./src/baseclient/types');
      if (global.rs_types) {
        RemoteStorage.BaseClient.Types = global.rs_types;
      } else {
        global.rs_types = RemoteStorage.BaseClient.Types;
      }
      env.storage = new RemoteStorage();
      env.client = new RemoteStorage.BaseClient(env.storage, '/foo/');
      console.log('client', env.client);
      test.done();
    },

    tests: [
      {
        desc: "#inScope returns all schemas defined for the given module",
        run: function(env, test) {
          var Types = RemoteStorage.BaseClient.Types;
          Types.declare('foo', 'a', 'http://foo/a', { type: 'object' });
          Types.declare('foo', 'b', 'http://foo/b', { type: 'object' });
          Types.declare('bar', 'c', 'http://bar/c', { type: 'object' });

          var fooResult = Types.inScope('foo');
          test.assertTypeAnd(fooResult, 'object');
          test.assertTypeAnd(fooResult['http://foo/a'], 'object');
          test.assertTypeAnd(fooResult['http://foo/b'], 'object');
          test.assertTypeAnd(fooResult['http://bar/c'], 'undefined');

          var barResult = Types.inScope('bar');
          test.assertTypeAnd(barResult, 'object');
          test.assertTypeAnd(barResult['http://foo/a'], 'undefined');
          test.assertTypeAnd(barResult['http://foo/b'], 'undefined');
          test.assertTypeAnd(barResult['http://bar/c'], 'object');

          test.done();
        }
      },

      {
        desc: "default @context is http://remotestorage.io/spec/modules/{module}/{type}",
        run: function(env, test) {
          var obj = {
            some: 'value'
          };
          env.client._attachType(obj, 'ba/F');
          console.log('obj', obj);
          test.assertAnd(obj, {
            some: 'value',
            '@context': 'http://remotestorage.io/spec/modules/foo/ba%2FF'
          });
          test.done();
        }
      }
    ]
  });

  return suites;
});
