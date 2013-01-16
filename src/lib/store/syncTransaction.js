define(['../util'], function(util) {

  // Namespace: syncTranscation
  //
  // Shared transaction implementation for synchronous storage backends (memory, localStorage).
  // Takes a 'store' (methods: get, set, remove) and a logger.
  // Makes sure that only one transaction runs at the same time.

  // Method: syncTransaction
  // Returns a new syncTransactionAdapter.
  //
  // You can extend it with your own stuff (to create a proper storageAdapter you
  // at least need 'forgetAll' and 'on')
  //
  // Parameters:
  //   store  - actual store implementation (get, set, remove)
  //   logger - a logger, to log begin / end of transaction and implicit commits.
  return function(store, logger) {

    var errorStub = function() { throw new Error("Transaction already committed!"); };
    var staleStore = { get: errorStub, set: errorStub, remove: errorStub, commit: errorStub };

    var tid = 0;

    function makeTransaction(write, body) {
      var promise = util.getPromise();
      var transaction = util.extend({
        id: ++tid,
        commit: function() {
          finish();
        }
      }, store);

      if(! write) {
        delete transaction.set;
        delete transaction.remove;
      }

      function finish(implicit) {
        logger.debug(transaction.id, 'FINISH Transaction (', write ? 'read-write' : 'read-only', ')');
        busy = false;
        util.extend(transaction, staleStore);
        promise.fulfill();
        runIfReady();
      }

      return {
        run: function() {
          busy = true;
          logger.debug(transaction.id, 'BEGIN Transaction (', write ? 'read-write' : 'read-only', ')');
          var result = body(transaction);
          if(! write) {
            logger.debug(transaction.id, 'schedule implicit commit (read-only transaction)');
            finish(true);
          }
        },
        promise: promise
      };
    }

    var busy = false;
    var transactions = [];

    function runIfReady() {
      if(! busy) {
        var transaction = transactions.shift();
        if(transaction) {
          logger.debug('SHIFT TRANSACTION', transactions.length, 'left');
          transaction.run();
        }
      }
    }

    return {

      // Object: syncTransactionAdapter

      // Method: transaction
      //
      // Parameters:
      //   write - boolean. whether this is a write or read-only transaction.
      //   body  - method to call with the actual transaction object
      transaction: function(write, body) {
        var transaction = makeTransaction(write, body);
        transactions.push(transaction);
        util.nextTick(runIfReady);
        return transaction.promise;
      },

      // Method: get
      // Forwarded from store (to simplify transaction-less 'get's in tests).
      get: store.get
    };
  };
});
