if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs', 'fs'], function(requirejs, fs) {
  var suites = [];

  var curry = null;

  suites.push({
    name: "store/memory.js tests",
    desc: "in-memory StorageAdapter",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/lib/store/memory'
      ], function(util, memoryAdapter) {
        curry = util.curry;
        env.memory = memoryAdapter();
        _this.result(true);
      });
    },
    takedown: function(env) {
      this.result(true);
    },
    beforeEach: function(env) {
      var _this = this;
      env.memory.forgetAll().
        then(function() {
          _this.result(true);
        });
    },
    tests: [
      {
        desc: "all methods return promises",
        run: function(env) {
          this.assertTypeAnd(
            env.memory.get('/foo').then, 'function'
          );
          this.assertTypeAnd(
            env.memory.set('/foo', { data: 'bar' }).then, 'function'
          );
          this.assertTypeAnd(
            env.memory.remove('/foo').then, 'function'
          );
          this.assertType(
            env.memory.forgetAll().then, 'function'
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

          env.memory.
            // set
            set('/one-path', 'data').
            // get
            then(curry(env.memory.get, '/one-path')).
            then(assertAnd('data')).
            then(curry(env.memory.get, '/other-path')).
            then(assertAnd(undefined)).
            // remove
            then(curry(env.memory.remove, '/one-path')).
            then(curry(env.memory.get, '/one-path')).
            then(assertAnd(undefined)).
            // forgetAll
            then(curry(env.memory.set, '/a', 1)).
            then(curry(env.memory.set, '/b', 2)).
            then(env.memory.forgetAll).
            then(curry(env.memory.get, '/a')).
            then(assertAnd(undefined)).
            then(curry(env.memory.get, '/b')).
            then(assertAnd(undefined)).
            // final result
            then(curry(this.result.bind(this), true),   // success
                 curry(this.result.bind(this), false)); // error
        }
      }
    ]
  });

  return suites;
});
