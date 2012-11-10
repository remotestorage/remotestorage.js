define(['../util'], function(util) {

  // Namespace: store.localStorage
  // <StorageAdapter> implementation that keeps data localStorage.

  var localStorage;

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

    return {

      on: events.on,

      get: function(path) {
        var rawMetadata = localStorage.getItem(prefixNode(path));
        var payload = localStorage.getItem(prefixData(path));
        var node;
        try {
          node = JSON.parse(rawMetadata);
        } catch(exc) {
        }
        if(node) {
          node.data = payload;
        }
        
        return util.getPromise().fulfillLater(node);
      },

      set: function(path, node) {
        var metadata = util.extend({}, node);
        delete metadata.data;
        var rawMetadata = JSON.stringify(metadata);
        localStorage.setItem(prefixNode(path), rawMetadata);
        localStorage.setItem(prefixData(path), node.data);
        return util.getPromise().fulfillLater();
      },

      remove: function(path) {
        localStorage.removeItem(prefixNode(path));
        localStorage.removeItem(prefixData(path));
        return util.getPromise().fulfillLater();
      },

      forgetAll: function() {
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
        return util.getPromise().fulfillLater();
      }
    }
  }
});

