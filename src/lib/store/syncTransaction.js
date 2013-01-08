define(['../util'], function(util) {

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
      function finish(implicit) {
        logger.debug(transaction.id, 'FINISH Transaction (', write ? 'read-write' : 'read-only', ')');
        busy = false;
        util.extend(transaction, staleStore);
        promise.fulfill();
        runIfReady();
      };

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

      transaction: function(write, body) {
        var transaction = makeTransaction(write, body);
        transactions.push(transaction);
        util.nextTick(runIfReady);
        return transaction.promise;
      },

      get: store.get,
    };
  };
});
