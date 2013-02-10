define([
  '../util', '../wireClient', './memory'
], function(util, wireClient, memoryAdapter) {

  var logger = util.getLogger('store::remote_cache');

  var remoteClient = wireClient;

  return function() {
    var cache = memoryAdapter('store::remote_cache_backend');

    function determineTimestamp(path) {
      return util.getPromise(function(promise) {
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
                promise.reject(error);
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
          logger.debug('GET HIT', path);
          return cache.get(path);
        } else {
          logger.debug('GET MISS', path);
          var node = {};
          return wireClient.get(path).
            // build node
            then(function(data, mimeType) {
              node.data = data;
              node.mimeType = mimeType;
              node.binary = data instanceof ArrayBuffer;
              if(typeof(data) === 'undefined') {
                node.deleted = true;
                return undefined;
              } else {
                node.deleted = false;
                return determineTimestamp(path);
              }
            }).then(function(timestamp) {
              node.timestamp = timestamp;
              return cache.set(path, node);
            }).then(function() {
              return node;
            });
        }
      },

      set: function(path, node) {
        logger.debug('SET', path);
        return cache.set(path, node).
          then(util.curry(wireClient.set, path, node.data, node.mimeType));
      },

      remove: function(path) {
        logger.debug('REMOVE', path);
        return cache.remove(path).
          then(util.curry(wireClient.remove, path));
      },

      getState: function() {
        return wireClient.getState();
      },

      expireKey: function(path) {
        logger.debug('EXPIRE', path);
        return cache.remove(path);
      },

      clearCache: function() {
        return cache.forgetAll();
      }
    };
  };
});
