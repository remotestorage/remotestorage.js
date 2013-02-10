define(['../util', './common', './syncTransaction'], function(util, common, syncTransactionAdapter) {

  // Namespace: store.localStorage
  // <StorageAdapter> implementation that keeps data localStorage.

  var localStorage;

  var logger = util.getLogger('store::localStorage');

  var events = util.getEventEmitter('change');

  // node metadata key prefix
  var prefixNodes = 'remote_storage_nodes:';
  // note payload data key prefix
  var prefixNodesData = 'remote_storage_node_data:';

  function isMetadataKey(key) {
    return key.substring(0, prefixNodes.length) == prefixNodes;
  }

  function prefixNode(path) {
    return prefixNodes + path;
  }

  function prefixData(path) {
    return prefixNodesData + path;
  }

  // forward events from other tabs
  if(typeof(window) !== 'undefined') {
    window.addEventListener('storage', function(event) {
      if(isMetadataKey(event.key)) {
        event.path = event.key.replace(new RegExp('^' + prefixNodes), '');
        events.emit('change', event);
      }
    });
  }

  return function(_localStorage) {
    localStorage = _localStorage || (typeof(window) !== 'undefined' && window.localStorage);

    if(! localStorage) {
      throw new Error("Not supported: localStorage not found.");
    }

    var store = {
      get: function(path) {
        logger.debug('GET', path);
        return util.getPromise(function(promise) {
          var rawMetadata = localStorage.getItem(prefixNode(path));
          if(! rawMetadata) {
            promise.fulfill(undefined);
            return;
          }
          var payload = localStorage.getItem(prefixData(path));
          var node;
          try {
            node = JSON.parse(rawMetadata);
          } catch(exc) {
          }
          if(node) {
            node.data = payload;
          }
          promise.fulfill(common.unpackData(node));
        });
      },

      set: function(path, node) {
        logger.debug('SET', path, node);
        return util.getPromise(function(promise) {
          var metadata = common.packData(node);
          var rawData = metadata.data;
          delete metadata.data;
          var rawMetadata = JSON.stringify(metadata);
          localStorage.setItem(prefixNode(path), rawMetadata);
          if(rawData) {
            localStorage.setItem(prefixData(path), rawData);
          }
          promise.fulfill();
        });
      },

      remove: function(path) {
        logger.debug('SET', path);
        return util.getPromise(function(promise) {
          localStorage.removeItem(prefixNode(path));
          localStorage.removeItem(prefixData(path));
          promise.fulfill();
        });
      }
    };

    return util.extend({

      on: events.on,

      forgetAll: function() {
        return util.getPromise(function(promise) {
          var numLocalStorage = localStorage.length;
          var keys = [];
          for(var i=0; i<numLocalStorage; i++) {
            if(localStorage.key(i).substr(0, prefixNodes.length) == prefixNodes ||
               localStorage.key(i).substr(0, prefixNodesData.length) == prefixNodesData) {
              keys.push(localStorage.key(i));
            }
          }

          keys.forEach(function(key) {
            localStorage.removeItem(key);
          });

          promise.fulfill();
        });
      }
    }, syncTransactionAdapter(store, logger));
  };
});

