define(['../util', './common', './transactions'], function(util, common, Transactions) {

  /**
   * Class: LocalStorageStore
   * <Store> implementation that keeps data localStorage.
   *
   * Parameters:
   *   prefix       - String to prefix all keys in localStorage with.
   *   localStorage - (optional) Actual <Web Storage at http://dev.w3.org/html5/webstorage/> implementation.
   *                  Defaults to window.localStorage or global.localStorage. This parameter can for example
   *                  be used to cache to sessionStorage instead of localStorage or to use a custom
   *                  implementation for platforms that don't support localStorage.
   */
  var LocalStorageStore = function(prefix, localStorage) {
    this.prefix = prefix;
    this.localStorage = (
      localStorage || (
        typeof(window) !== 'undefined' ? window : global
      ).localStorage
    );

    /**
     * Property: transactions
     * A <Transactions> instance.
     */
    this.transactions = new Transactions();
  };

  LocalStorageStore.prototype = {

    /**
     * Method: get
     * See <Store.get>
     */
    get: function(path) {
      return util.getPromise(util.bind(function(promise) {
        var rawMetadata = this.localStorage.getItem(this.prefixNode(path));
        if(! rawMetadata) {
          promise.fulfill(undefined);
          return;
        }
        var payload = this.localStorage.getItem(this.prefixData(path));
        var node;
        try {
          node = JSON.parse(rawMetadata);
        } catch(exc) {
        }
        if(node) {
          node.data = payload;
        }
        promise.fulfill(common.unpackData(node));
      }, this));
    },

    /**
     * Method: set
     * See <Store.set>
     */
    set: function(path, node) {
      return util.getPromise(util.bind(function(promise) {
        var metadata = common.packData(node);
        var rawData = metadata.data;
        delete metadata.data;
        var rawMetadata = JSON.stringify(metadata);
        this.localStorage.setItem(this.prefixNode(path), rawMetadata);
        if(rawData) {
          this.localStorage.setItem(this.prefixData(path), rawData);
        }
        promise.fulfill();
      }, this));
    },

    /**
     * Method: remove
     * See <Store.remove>
     */
    remove: function(path) {
      return util.getPromise(util.bind(function(promise) {
        this.localStorage.removeItem(this.prefixNode(path));
        this.localStorage.removeItem(this.prefixData(path));
        promise.fulfill();
      }, this));
    },

    /**
     * Method: transaction
     * Delegates to <Transactions.transaction> (via <transactions>)
     */
    transaction: function(block) {
      return this.transactions.transaction(block);
    },

    _prefixNode: function(path) {
      return this.prefix + ':meta:' + path;
    }

    _prefixData: function(path) {
      return this.prefix + ':data:' + path;
    }

  };
});

