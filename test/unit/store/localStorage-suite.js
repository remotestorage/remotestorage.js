if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs', 'fs', 'localStorage'], function(requirejs, fs, localStorage) {
  var suites = [];

  var curry = null;

  suites.push({
    name: "store/localStorage.js tests",
    desc: "localStorage StorageAdapter",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/lib/store/localStorage'
      ], function(util, localStorageAdapter) {
        curry = util.curry;
        env.adapter = localStorageAdapter(localStorage);
        _this.result(true);
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
            set('/one-path', 'data').
            // get
            then(curry(env.adapter.get, '/one-path')).
            then(assertAnd('data')).
            then(curry(env.adapter.get, '/other-path')).
            then(assertAnd(undefined)).
            // remove
            then(curry(env.adapter.remove, '/one-path')).
            then(curry(env.adapter.get, '/one-path')).
            then(assertAnd(undefined)).
            // forgetAll
            then(curry(env.adapter.set, '/a', 1)).
            then(curry(env.adapter.set, '/b', 2)).
            then(env.adapter.forgetAll).
            then(curry(env.adapter.get, '/a')).
            then(assertAnd(undefined)).
            then(curry(env.adapter.get, '/b')).
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
