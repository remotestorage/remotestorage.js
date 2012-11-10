define(['../util'], function(util) {

  // Namespace: store.memory
  // <StorageAdapter> implementation that keeps data in memory.

  var logger = util.getLogger('store::memory');

  var nodes = {};

  return function() {
    return {
      on: function() {},

      get: function(path) {
        logger.info('get', path);
        return util.getPromise().fulfillLater(nodes[path]);
      },

      set: function(path, node) {
        logger.info('set', path);
        nodes[path] = node;
        return util.getPromise().fulfillLater();
      },

      remove: function(path) {
        logger.info('remove', path);
        delete nodes[path];
        return util.getPromise().fulfillLater();
      },

      forgetAll: function() {
        logger.info('forgetAll');
        nodes = {};
        return util.getPromise().fulfillLater();
      }
    };
  };
});