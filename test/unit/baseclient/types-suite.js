if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
if(typeof global === 'undefined') global = window
global.RemoteStorage = function() {};
global.RemoteStorage.BaseClient = function() {};
RemoteStorage.BaseClient.prototype.extend = function() {};

requirejs.config({
  paths: {
    basceclientTypes: '../../src/baseclient/types'
  },
  shim: {
    baseclientTypes: []
  }
})

define(['basceclientTypes'], function() {
  var suites = [];

  suites.push({
    name: "BaseClient.Types",
    desc: "Type and schema handling",
    setup: function(env, test) {
      if (global.rs_types) {
        RemoteStorage.BaseClient.Types = global.rs_types;
      } else {
        global.rs_types = RemoteStorage.BaseClient.Types;
      }
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
      }
    ]
  });

  return suites;
});
