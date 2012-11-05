define(['./util'], function(util) {

  "use strict";

  var events = util.getEventEmitter('change', 'ready');

  // Interface: dataStore
  //
  // Backend for the <store>.
  //
  // Currently supported:
  // * localStorage
  //
  // Planned:
  // * indexedDB
  // * WebSQL
  //
  // Method: get(path, callback)
  // Get node metadata and payload for given path
  //
  // Method: set(path, metadata, payload, callback)
  // Set node metadata and payload for given path
  //
  // Method: remove(path, callback)
  // Remove node metadata and payload for given path
  //
  // Method: forgetAll(callback)
  // Remove all data.
  //
  // Method: on(eventName, callback)
  // Install an event handler.
  //
  // Event: change
  // Fired when the store changes from another source (such as another tab / window).
  //
  // Event: ready
  // Fired when the store is ready.
  //

  function localStorageAdapter() {
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
          event.path = event.key;
          events.emit('change', event);
        }
      });
    }

    return {

      on: function(eventName, handler) {
        if(eventName == 'ready') {
          // localStorage is immediately ready.
          setTimeout(handler, 0);
        } else {
          events.on(eventName, handler);
        }
      },

      get: function(path, callback) {
        var rawMetadata = localStorage.getItem(prefixNode(path));
        var payload = localStorage.getItem(prefixData(path));
        var metadata;
        try {
          metadata = JSON.parse(rawMetadata);
        } catch(exc) {
          metadata = null;
        }
        callback(metadata, payload);
      },

      set: function(path, metadata, payload, callback) {
        var rawMetadata = JSON.stringify(metadata);
        localStorage.setItem(prefixNode(path), rawMetadata);
        localStorage.setItem(prefixData(path), payload);
        callback();
      },

      remove: function(path, callback) {
        localStorage.removeItem(prefixNode(path));
        localStorage.removeItem(prefixData(path));
        callback();
      },

      forgetAll: function(callback) {
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
        callback();
      }
    }
  }

  var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;

  function indexedDbAdapter() {
    var dbRequest = indexedDB.open("remoteStorage", 1);

    dbRequest.onsuccess = function() {
      
    }

    return {
      on: events.on,

      get: function(path) {
        
      },

      set: function(path, value) {
      },

      remove: function(path) {
      },

      forgetAll: function() {
      }
    }    
  }

  function webSqlAdapter() {
    return {
      on: events.on,

      get: function(path) {
        
      },

      set: function(path, value) {
      },

      remove: function(path) {
      },

      forgetAll: function() {
      }
    }    
  }

  if(typeof(indexedDB) !== 'undefined') {
    return indexedDbAdapter();
  } else if(typeof(openDatabase) === 'function') {
    return webSqlAdapter();
  } else {
    return localStorageAdapter();
  }
});
