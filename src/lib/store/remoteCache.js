define([
  '../util', '../wireClient', './memory'
], function(util, wireClient, memoryAdapter) {

  var logger = util.getLogger('store::remote_cache');

  var remoteClient = wireClient;

  return function() {
    var cache = memoryAdapter();

    function determineTimestamp(path) {
      return util.makePromise(function(promise) {
        var parentPath = util.containingDir(path);
        if(parentPath && cache.hasKey(parentPath)) {
          var baseName = util.baseName(path)
          cache.get(parentPath).
            then(function(parentNode) {
              promise.fulfill(parentNode.data[baseName] || 0);
            }, function(error) {
              if(typeof(error) === 'undefined') {
                promise.fulfill(new Date().getTime());
              } else {
                promise.fail(error);
              }
            });
        } else {
          promise.fulfill(new Date().getTime());
        }
      });
    }

    return {
      get: function(path) {
        if(cache.hasKey(path)) {
          logger.info('GET HIT', path);
          return cache.get(path);
        } else {
          logger.info('GET MISS', path);
          var node = {};
          return wireClient.get(path).
            then(function(data, mimeType) {
              logger.info("WIRE CLIENT GET RETURNED", data, mimeType);
              node.data = data;
              node.mimeType = mimeType;
              node.binary = data instanceof ArrayBuffer;
              if(typeof(data) === 'undefined') {
                return 0;
              } else {
                return determineTimestamp(path);
              }
            }).then(function(timestamp) {
              logger.info("GOT TIMESTAMP", timestamp);
              node.timestamp = timestamp;
              return cache.set(path, node);
            }).then(function() {
              return node;
            });
        }
      },

      set: function(path, node) {
        logger.info('SET', path);
        return cache.set(path, node).
          then(util.curry(wireClient.set, path, node.data, node.mimeType));
      },

      remove: function(path) {
        logger.info('REMOVE', path);
        return cache.remove(path).
          then(util.curry(wireClient.remove, path));
      },

      getState: function() {
        return wireClient.getState();
      },

      clearCache: function() {
        return cache.forgetAll();
      }
    }
  };
});
