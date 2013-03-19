define(['../util'], function(util) {
  
  /**
   * Class: LocalStore
   *
   * Manages directory listings and provides a <Store> interface.
   * Forwards all requests to it's <backend>, which is expected to
   * implement the <Store> and <Store.Transactions> interfaces.
   */
  var LocalStore = function(backend) {
    /**
     * Property: backend
     * A <Store> implementation to forward to.
     */
    this.backend = backend;
  };

  LocalStore.prototype = {

    /**
     * Method: get
     * See <Store.get>
     */
    get: function(path) {
      return this.backend.get(path);
    },

    /**
     * Method: set
     * See <Store.set>
     */
    set: function(path, node) {
      return this.backend.transaction(util.bind(function(transaction) {
        transaction.set(path, node).
          then(
            util.curry(
              util.bind(this._updateAncestors, this),
              transaction, path, node
            )
          ).then(
            util.bind(transaction.commit, transaction)
          );
      }, this));
    },
    
    /**
     * Method: remove
     * See <Store.remove>
     */
    remove: function(path) {
      return this.backend.transaction(util.bind(function(transaction) {
        transaction.remove(path).
          then(
            util.curry(
              util.bind(this._updateAncestors, this),
              transaction, path, undefined, true
            )
          ).then(
            util.bind(transaction.commit, transaction)
          );
      }, this));
    },

    _updateAncestors: function(transaction, path, node, remove) {
      var parts = util.pathParts(path);
      if(parts.length === 1) {
        return;
      }
      var parentPath = parts.splice(0, parts.length - 1).join('');
      var baseName = parts.shift();
      return transaction.get(parentPath).then(util.bind(function(parent) {
        if(! parent) {
          parent = { mimeType: 'application/json', data: {} };
        }
        if(remove) {
          delete parent.data[baseName];
        } else {
          parent.data[baseName] = node.version;
          parent.version = node.version;
        }
        var removeNext = Object.keys(parent.data).length === 0;
        var updateNext = util.curry(
          util.bind(this._updateAncestors, this),
          transaction, parentPath, parent, removeNext
        );
        if(removeNext) {
          return transaction.remove(parentPath).then(updateNext);
        } else {
          return transaction.set(parentPath, parent).then(updateNext);
        }
      }, this));
    }
    
  };

  return LocalStore;
  
});
