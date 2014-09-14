if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  suites.push({
    name: "BaseClient.Types",
    desc: "Type and schema handling",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      RemoteStorage.log = function() {};
      RemoteStorage.prototype = {
        onChange: function() {},
        caching: {
          _rootPaths: {},
          set: function(path, value) {
            this._rootPaths[path] = value;
          }
        }
      };

      require('src/util');
      if (global.rs_util) {
        RemoteStorage.util = global.rs_util;
      } else {
        global.rs_util = RemoteStorage.util;
      }

      require('src/eventhandling');
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      require('src/wireclient');
      if (global.rs_wireclient) {
        RemoteStorage.WireClient = global.rs_wireclient;
      } else {
        global.rs_wireclient = RemoteStorage.WireClient;
      }

      require('src/baseclient.js');
      require('src/baseclient/types');
      if (global.rs_baseclient_with_types) {
        RemoteStorage.BaseClient = global.rs_baseclient_with_types;
      } else {
        global.rs_baseclient_with_types = RemoteStorage.BaseClient;
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
      },

      {
        desc: "_attachType attaches default context to objects",
        run: function(env, test) {
          var obj = {
            some: 'value'
          };
          env.storage = new RemoteStorage();
          env.client = new RemoteStorage.BaseClient(env.storage, '/contacts/');
          env.client._attachType(obj, 'contact');
          test.assertAnd(obj, {
            some: 'value',
            '@context': 'http://remotestorage.io/spec/modules/contacts/contact'
          });
          test.done();
        }
      },

      {
        desc: "_attachType encodes special characters in type names for @context URI",
        run: function(env, test) {
          var obj = {
            some: 'value'
          };
          env.storage = new RemoteStorage();
          env.client = new RemoteStorage.BaseClient(env.storage, '/foo/');
          env.client._attachType(obj, 'ba/F');
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
