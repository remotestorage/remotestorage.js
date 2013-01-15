if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs', 'fs', 'localStorage'], function(requirejs, fs, localStorage) {
  var suites = [];

  var curry = null;

  // suites.push({
  //   name: "store/localStorage.js tests",
  //   desc: "localStorage StorageAdapter",
  //   setup: function(env) {
  //     var _this = this;
  //     requirejs([
  //       './src/lib/util',
  //       './src/lib/store/localStorage'
  //     ], function(util, localStorageAdapter) {
  //       curry = util.curry;
  //       env.adapter = localStorageAdapter(localStorage);
  //       _this.result(true);
  //     });
  //   },
  //   takedown: function(env) {
  //     this.result(true);
  //   },
  //   beforeEach: function(env) {
  //     var _this = this;
  //     env.adapter.forgetAll().
  //       then(function() {
  //         _this.result(true);
  //       });
  //   },
  //   tests: [

  //     {
  //       desc: "all methods return promises",
  //       run: function(env) {
  //         this.assertTypeAnd(
  //           env.adapter.transaction(true, function() {}).then, 'function'
  //         );
  //         this.assertType(
  //           env.adapter.forgetAll().then, 'function'
  //         );
  //       }
  //     },

  //     {
  //       desc: "transactions yield a get/set/remove object",
  //       run: function(env) {
  //         var _this = this;
  //         env.adapter.transaction(true, function(transaction) {
  //           _this.assertTypeAnd(transaction.get, 'function');
  //           _this.assertTypeAnd(transaction.set, 'function');
  //           _this.assertType(transaction.remove, 'function');
  //         });
  //       }
  //     },

  //     {
  //       desc: "results are consistent",
  //       run: function(env) {

  //         var _this = this;

  //         function assertAnd(a) {
  //           return curry(_this.assertAnd.bind(_this), a);
  //         }

  //         env.adapter.transaction(true, function(transaction) {
  //           // set
  //           transaction.set('/one-path', 'data').
  //             // get
  //             then(curry(transaction.get, '/one-path')).
  //             then(assertAnd('data')).
  //             then(curry(transaction.get, '/other-path')).
  //             then(assertAnd(undefined)).
  //             // remove
  //             then(curry(transaction.remove, '/one-path')).
  //             then(curry(transaction.get, '/one-path')).
  //             then(assertAnd(undefined)).
  //             // forgetAll
  //             then(curry(transaction.set, '/a', 1)).
  //             then(curry(transaction.set, '/b', 2));
  //         }).then(function() {
  //           return env.adapter.forgetAll().
  //             then(function() {
  //               env.adapter.transaction(true, function(transaction) {
  //                 transaction.get('/a').
  //                   then(assertAnd(undefined)).
  //                   then(curry(transaction.get, '/b')).
  //                   then(assertAnd(undefined)).
  //                   // final result
  //                   then(curry(_this.result.bind(_this), true),   // success
  //                        curry(_this.result.bind(_this), false)); // error
  //               });
  //             });
  //         });
  //       }
  //     }

  //   ]
  // });

  return suites;
});
