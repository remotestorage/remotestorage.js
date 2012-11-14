if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define([
  'requirejs', 'sqlite3', 'jsindexeddb'
], function(requirejs, sqlite3, jsindexeddb) {
  var suites = [];

  var curry = null;

  suites.push({
    name: "store/indexedDb.js tests",
    desc: "indexedDB StorageAdapter",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/lib/store/indexedDb'
      ], function(util, indexedDbAdapter) {
        curry = util.curry;
        var sqliteDB = new sqlite3.Database(':memory:');
        indexedDbAdapter(jsindexeddb.indexedDB('sqlite3', sqliteDB)).
          then(function(adapter) {
            env.adapter = adapter;
            _this.result(true);
          }, function(error) {
            console.error("Failed to get adapter: ", adapter);
            _this.result(false);
          });
      });
    },
    takedown: function(env) {
      this.result(true);
    },
    beforeEach: function(env) {
      var _this = this;
      env.adapter.forgetAll().
        then(function() {
          _this.result(true);
        });
    },
    tests: [
      {
        desc: "all methods return promises",
        run: function(env) {
          this.assertTypeAnd(
            env.adapter.get('/foo').then, 'function'
          );
          this.assertTypeAnd(
            env.adapter.set('/foo', { data: 'bar' }).then, 'function'
          );
          this.assertTypeAnd(
            env.adapter.remove('/foo').then, 'function'
          );
          this.assertType(
            env.adapter.forgetAll().then, 'function'
          );
        }
      },
      {
        desc: "results are consistent",
        run: function(env) {

          var _this = this;

          function assertAnd(a) {
            return curry(_this.assertAnd.bind(_this), a);
          }

          env.adapter.
            // set
            set('/one-path', { some: 'data' }).
            // get
            then(curry(env.adapter.get, '/one-path')).
            then(assertAnd({ some: 'data' })).
            then(curry(env.adapter.get, '/other-path')).
            then(assertAnd(undefined)).
            // remove
            then(curry(env.adapter.remove, '/one-path')).
            then(curry(env.adapter.get, '/one-path')).
            then(assertAnd(undefined)).
            // forgetAll
            then(curry(env.adapter.set, '/a', { val: 1 })).
            then(curry(env.adapter.set, '/b', { val: 2 })).
            then(env.adapter.forgetAll).
            then(curry(env.adapter.get, '/a')).
            then(assertAnd(undefined)).
            then(curry(env.adapter.get, '/b')).
            then(assertAnd(undefined)).
            // final result
            then(curry(this.result.bind(this), true),   // success
                 function(error) {
                   console.error("FAILED", error);
                   _this.result(false);
                 }); // error
        }
      }
    ]
  });

  return suites;
});
