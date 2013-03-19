if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  var util, Transactions, StubStore;

  suites.push({
    name: "Store.Transactions",
    desc: "Transaction layer for backends that don't have native transaction support.",

    setup: function(env, test) {
      requirejs([
        './src/lib/util',
        './src/lib/store/transactions',
        './src/lib/store/stub'
      ], function(_util, _Transactions, _StubStore) {
        util = util;
        Transactions = _Transactions;
        StubStore = _StubStore;
        test.done();
      });
    },

    beforeEach: function(env, test) {
      env.store = new StubStore();
      env.transactions = new Transactions(env.store);
      test.done();
    },

    tests: [

      {
        desc: "#transaction() returns a promise",
        run: function(env, test) {
          var result = env.transactions.transaction(function() {});
          test.assertTypeAnd(result, 'object');
          test.assertTypeAnd(result.then, 'function');
          test.done();
        }
      },

      {
        desc: "#transaction() yields a Transaction",
        run: function(env, test) {
          env.transactions.transaction(function(transaction) {
            test.assertTypeAnd(transaction, 'object');
            test.assertTypeAnd(transaction.get, 'function');
            test.assertTypeAnd(transaction.set, 'function');
            test.assertTypeAnd(transaction.remove, 'function');
            test.assertTypeAnd(transaction.commit, 'function');
            test.assertAnd(transaction.store, env.store);
            test.done();
          });
        }
      }

    ]
  });

  suites.push({
    name: "Store.Transactions.Transaction",
    desc: "Transaction object, implementing <Store> interface",

    setup: function(env, test) {
      requirejs([
        './src/lib/util',
        './src/lib/store/transactions',
        './src/lib/store/stub'
      ], function(_util, _Transactions, _StubStore) {
        util = util;
        Transactions = _Transactions;
        StubStore = _StubStore;
        test.done();
      });
    },


    beforeEach: function(env, test) {
      env.store = new StubStore();
      env.transactions = new Transactions(env.store);

      env.transactionPromise = env.transactions.transaction(function(transaction) {
        env.transaction = transaction;
        test.done();
      });
    },

    tests: [

      {
        desc: "#promise holds the same promise as returned by #transaction()",
        run: function(env, test) {
          test.assert(env.transactionPromise, env.transaction.promise);
        }
      },

      {
        desc: "#get() forwards to the store and returns a promise",
        run: function(env, test) {
          var result = env.transaction.get('/something');
          test.assertTypeAnd(result, 'object');
          test.assertTypeAnd(result.then, 'function');
          env.store.expect(test, 'get', '/something');
          env.store.expectNoMore(test);
        }
      },

      {
        desc: "#set() forwards to the store and returns a promise",
        run: function(env, test) {
          var result = env.transaction.set('/something', { foo: 'bar' });
          test.assertTypeAnd(result, 'object');
          test.assertTypeAnd(result.then, 'function');
          env.store.expect(test, 'set', '/something', { foo: 'bar' });
          env.store.expectNoMore(test);
        }
      },

      {
        desc: "#remove() forwards to the store and returns a promise",
        run: function(env, test) {
          var result = env.transaction.remove('/something');
          test.assertTypeAnd(result, 'object');
          test.assertTypeAnd(result.then, 'function');
          env.store.expect(test, 'remove', '/something');
          env.store.expectNoMore(test);
        }
      },

      {
        desc: "#commit() fulfills the promise",
        run: function(env, test) {
          env.transaction.promise.then(function() {
            test.done();
          });
          env.transaction.commit();
        }
      },

      {
        desc: "#commit() causes #get(), #set() and #remove() to throw AlreadyCommitted errors",
        run: function(env, test) {
          function expectError(method, args) {
            try {
              env.transaction[method].apply(env.transaction, args);
              test.result(false, 'nothing was thrown when calling ' + method);
            } catch(exc) {
              test.assertAnd(
                exc instanceof Transactions.AlreadyCommitted, 
                true,
                'something was thrown, but not Transactions.AlreadyCommitted'
              );
              test.assertAnd(exc.method, method);
              test.assertAnd(exc.path, args[0]);
            }
          }
          env.transaction.commit();
          expectError('get', ['/foo']);
          expectError('set', ['/foo', { foo: 'bar' }]);
          expectError('remove', ['/foo']);
          test.done();
        }
      }

    ]
  });

  return suites;
});
