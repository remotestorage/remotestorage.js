define(['../util', './common', './transactions'], function(util, common, Transactions) {

  // Namespace: store.localStorage
  // <StorageAdapter> implementation that keeps data localStorage.

  var LocalStorageStore = function(prefix, localStorage) {
    this.prefix = prefix;
    this.localStorage = (
      localStorage || (
        typeof(window) !== 'undefined' ? window : global
      ).localStorage
    );

    this.transactions = new Transactions();
  };

  LocalStorageStore.prototype = {
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

    remove: function(path) {
      return util.getPromise(util.bind(function(promise) {
        this.localStorage.removeItem(this.prefixNode(path));
        this.localStorage.removeItem(this.prefixData(path));
        promise.fulfill();
      }, this));
    },

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

