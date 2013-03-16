/*global window */
/*global console */

define([], function() {

  "use strict";

  /**
   * Class: Store
   *
   * The store interface, which is used by <LocalStore>, <RemoteStore>,
   * <FallbackStore> and <Sync>.
   *
   * This code is not actually included in any final build, but just here for
   * documentation purposes.
   *
   */
  var Store = function() {};

  Store.prototype = {

    /**
     * Method: get
     *
     * Fetch a node from this Store.
     *
     * Returns: a Promise
     *
     * Parameters:
     *   path - Absolute path to the node
     */
    get: function(path) {},

    /**
     * Method: set
     *
     * Store a node in this Store.
     *
     * Returns: a Promise
     *
     * Parameters:
     *   path - Absolute path to the node
     *   node - Node object to store. Can be an arbitrary Object.
     */
    set: function(path, node) {}

    /**
     * Method: remove
     *
     * Remove a node from this Store.
     *
     * Returns: a Promise
     *
     * Parameters:
     *   path - Absolute path to the node
     */
    remove: function(path) {},

    /**
     * Method: transaction
     *
     * Enqueues a new transaction to be run in the future.
     * During the execution of a transaction block the store is guaranteed not to
     * process any other requests, until the transaction is committed or the
     * transaction block causes an error.
     *
     * Returns: a Promise, fulfilled as soon as the transaction is committed.
     *
     * Parameters:
     *   block - a Function that is passed the Transaction
     *
     * Block parameters:
     *   transaction - a <Store.Transactions.Transaction> Object
     */
    transaction: function(block) {},

  };

});
