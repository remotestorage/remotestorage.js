define(['../util', './memory'], function(util, memoryAdapter) {

  var logger = util.getLogger('store::indexed_db');

  var adapter = function(indexedDB) {
    if(! indexedDB) {
      throw new Error("Not supported: indexedDB not found");
    }


    function openDatabase(dbName, version, objectStoreName) {
      return util.makePromise(function(promise) {
        var database = undefined;
      });
    }

    var DB = undefined;
    var store = undefined;

    function wrapRequest(method) {
      var args = Array.prototype.slice.call(arguments, 1);
      return util.makePromise(function(promise) {
        var request = method.apply(null, args);
        request.onsuccess = function() {
          promise.fulfill.apply(promise, arguments);
        }
        request.onerror = function() {
          promise.fail.apply(promise, arguments);
        }
      });
    }

    var adapterPromise = util.getPromise();

    var indexedDbStore = {
      get: function(key) {
        logger.info("GET " + key);
        return wrapRequest(store.get.bind(store), key);
      },
      set: function(key, value) {
        logger.info("SET " + key);
        var node = value;
        node.key = key;
        return wrapRequest(store.put.bind(store), node);
      },
      remove: function(key) {
        logger.info("REMOVE " + key);
        return wrapRequest(store.delete.bind(store), key);
      },
      forgetAll: function() {
        logger.info("FORGET ALL");
        return wrapRequest(store.clear.bind(store));
      }
    };

    var dbRequest = indexedDB.open('remoteStorage', 1);
    
    dbRequest.onupgradeneeded = function(event) {
      DB = event.target.result;
      store = DB.createObjectStore('nodes', { keyPath: 'key' });
      adapterPromise.fulfill(indexedDbStore);
    }

    dbRequest.onsuccess = function(event) {
      DB = event.target.result;
      store = DB.transaction(null, 'readwrite').objectStore('nodes');
      adapterPromise.fulfill(indexedDbStore);
    }

    dbRequest.onerror = function(event) {
      console.error("indexedDB.open failed: ", event);
      adapterPromise.fail(new Error("Failed to open database!"));
    };

    return adapterPromise;
  };

  adapter.detect = function() {
    var indexedDB = undefined;
    if(typeof(window) !== 'undefined') {
      indexedDB = (window.indexedDB || window.webkitIndexedDB ||
                   window.mozIndexedDB || window.msIndexedDB);
    }
    return indexedDB;
  }

  return adapter;
});