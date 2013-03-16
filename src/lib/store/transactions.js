define(['../util'], function(util) {

  /**
   * Class: Store.Transactions
   *
   * Transaction layer for backends that don't have native transaction support.
   */
  var Transactions = function(store) {
    this.store = store;
    this.queue = [];
    this.running = false;
  };

  Transactions.prototype = {

    /**
     * Method: transaction
     *
     * Implementation of <Store.transaction> that can be delegated to by stores
     * that utilize this module.
     */
    transaction: function(block) {
      return util.getPromise(util.bind(function(promise) {
        if(this.running) {
          this.queue.push({
            promise: promise,
            block: block
          });
        } else {
          this._run(promise, block);
        }
      }, this));
    },

    _run: function(promise, block) {
      promise.then(util.bind(function() {
        this.running = false;
        var next = this.queue.shift();
        if(next) {
          this._run(next.promise, next.block);
        }
      }, this));
      block(new Transactions.Transaction(this.store, promise));
    }

  };

  /**
   * Error: Store.Transactions.AlreadyCommitted
   *
   * Thrown when get / set / remove is called on a <Store.Transactions.Transaction>
   * that is already committed.
   *
   * Attributes:
   *   method - The method that was attempted. 
   *   path   - The path passed to the method. 
   */
  util.declareError(Transactions, 'AlreadyCommitted', function(method, path) {
    this.method = method;
    this.path = path;
    return "Can't process " + method + "(" + path + ")  request, transaction already committed!";
  });

  /**
   * Class: Store.Transactions.Transaction
   *
   * Transaction implementation. Implements the <Store> interface, and additionally
   * brings a <commit> method that concludes the transaction.
   *
   * Parameters:
   *   store   - The <Store> to delegate <get> / <set> / <remove> to.
   *   promise - Promise to fulfill, when <commit> is called.
   */
  Transactions.Transaction = function(store, promise) {
    this.store = store;
    this.promise = promise;
  };

  var CommittedTransactionMethods = {
    get: function(path) {
      throw new Transactions.AlreadyCommitted('get', path);
    },
    set: function(path) {
      throw new Transactions.AlreadyCommitted('set', path);
    },
    remove: function(path) {
      throw new Transactions.AlreadyCommitted('remove', path);
    },
    commit: function() {
      throw new Transactions.AlreadyCommitted('commit', null);
    }
  };

  Transactions.Transaction.prototype = {

    /**
     * Method: get
     *
     * See <Store.get>
     */
    get: function(path) {
      return this.store.get(path);
    },

    /**
     * Method: set
     *
     * See <Store.set>
     */
    set: function(path, node) {
      return this.store.set(path, node);
    },

    /**
     * Method: remove
     *
     * See <Store.remove>
     */
    remove: function(path) {
      return this.store.remove(path);
    },

    /**
     * Method: commit
     *
     * Concludes the transaction by fulfilling the promise passed to the
     * constructor.
     * After commit has been called, all methods of this Transaction will throw a
     * <Store.Transactions.AlreadyCommitted> error.
     */
    commit: function() {
      this.promise.fulfill();
      this.__proto__ = CommittedTransactionMethods;
    }

  };

  return Transactions;

});
