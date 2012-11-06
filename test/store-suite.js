if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs', 'fs'], function(requirejs, fs) {
  var suites = [];

  suites.push({
    name: "store.js tests",
    desc: "collection of tests for store.js",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/store', './src/lib/store/memory'
      ], function(store, memoryAdapter) {
        env.store = store;
        _this.assertTypeAnd(env.store.setAdapter, 'function');
        env.storageAdapter = memoryAdapter();
        env.store.setAdapter(env.storageAdapter);
        _this.result(true);
      });
    },
    takedown: function(env) {
      this.result(true);
    },
    beforeEach: function(env) {
      var _this = this;
      env.storageAdapter.forgetAll().
        then(function() {
          _this.result(true);
        });
    },
    tests: [
      {
        desc: "store.getNode returns a promise",
        run: function(env) {
          this.assertType(env.store.getNode('/foo').then, 'function');
        }
      },
      {
        desc: "store.getNode builds a new node",
        run: function(env) {
          var _this = this;
          env.store.getNode('/foo/bar').
            then(function(node) {
              _this.assertAnd(node.startAccess, null);
              _this.assertAnd(node.startForce, null);
              _this.assertAnd(node.startForceTree, null);
              _this.assertAnd(node.timestamp, 0);
              _this.assertAnd(node.lastUpdatedAt, 0);
              _this.assert(node.mimeType, "application/json");
            });
        }
      },
      {
        desc: "store.getNode initializes directory data and diff",
        run: function(env) {
          var _this = this;
          env.store.getNode('/foo/').
            get('data', 'diff').
            then(function(data, diff) {
              _this.assertAnd(data, {});
              _this.assert(diff, {});
            });
        }
      },
      {
        desc: "store.getNode forwards the node received from storage",
        run: function(env) {
          var _this = this;
          var t = new Date().getTime();
          env.storageAdapter.set("/foo/bar", {
            timestamp: t,
            mimeType: "text/plain",
            data: 'some text'
          });

          env.store.getNode('/foo/bar').
            then(function(node) {
              _this.assertAnd(node.timestamp, t);
              _this.assertAnd(node.mimeType, 'text/plain');
              _this.assert(node.data, 'some text');
            });
        }
      },
      {
        desc: "store.getNode unpacks JSON data",
        run: function(env) {
          var _this = this;
          var t = new Date().getTime();
          env.storageAdapter.set("/foo/bar", {
            timestamp: t,
            mimeType: "application/json",
            data: '{"foo":"bar"}'
          });

          env.store.getNode('/foo/bar').
            then(function(node) {
              _this.assertTypeAnd(node.data, 'object');
              _this.assert(node.data, { foo: 'bar' });
            });
        }
      }
    ]
  });

  return suites;
});
