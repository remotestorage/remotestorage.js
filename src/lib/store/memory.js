define(['../util'], function(util) {

  // Namespace: store.memory
  // <StorageAdapter> implementation that keeps data in memory.

  var nodes = {};

  return function() {
    return {
      on: function() {},

      get: function(path) {
        return util.getPromise().fulfillLater(nodes[path]);
      },

      set: function(path, node) {
        nodes[path] = node;
        return util.getPromise().fulfillLater();
      },

      remove: function(path) {
        delete nodes[path];
        return util.getPromise().fulfillLater();
      },

      forgetAll: function() {
        nodes = {};
        return util.getPromise().fulfillLater();
      }
    };
  };
});