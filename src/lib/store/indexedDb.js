define([
  '../util', './pending', '../../vendor/IndexedDBShim'
], function(util, pendingAdapter, _) {

  var DB_NAME = 'remoteStorage';
  var DB_VERSION = 1;
  var OBJECT_STORE_NAME = 'nodes';

  var logger = util.getLogger('store::indexed_db');

  var adapter = function(indexedDB) {
    if(! indexedDB) {
      throw new Error("Not supported: indexedDB not found");
    }

    var DB = undefined;

    function removeDatabase() {
      return util.getPromise(function(promise) {
        if(DB) {
          try {
            DB.close();
          } catch(exc) {
            // ignored.
          };
          DB = undefined;
        }
        var request = indexedDB.deleteDatabase(DB_NAME);

        request.onsuccess = function() {
          promise.fulfill();
        };

        request.onerror = function() {
          promise.reject('indexedDB.deleteDatabase failed!', request.error);
        };
      });
    }

    function openDatabase() {
      logger.info("Opening database " + DB_NAME + '@' + DB_VERSION);
      return util.getPromise(function(promise) {
        var dbRequest = indexedDB.open(DB_NAME, DB_VERSION);

        function upgrade(db) {
          logger.debug("Upgrade database: ", db);
          db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'key' });
        }

        dbRequest.onupgradeneeded = function(event) {
          upgrade(event.target.result);
        };
        
        dbRequest.onsuccess = function(event) {
          logger.debug("DB REQUEST SUCCESS", event);
          try {
            var database = event.target.result;
            if(typeof(database.setVersion) === 'function') {
              logger.debug("setVersion supported");
              if(database.version != DB_VERSION) {
                var versionRequest = database.setVersion(DB_VERSION);
                versionRequest.onsuccess = function(event) {
                  logger.debug("VERSION REQUEST SUCCESS");
                  upgrade(database);
                  event.target.transaction.oncomplete = function() {
                    promise.fulfill(database);
                  };
                };
                versionRequest.onerror = function(event) {
                  logger.error("Version request failed", event);
                  promise.reject("Version request failed!");
                };
              } else {
                promise.fulfill(database);
              }
            } else {
              // assume onupgradeneeded is supported.
              logger.debug("onupgradeneeded supported");
              promise.fulfill(database);
            }
          } catch(exc) {
            promise.reject(exc);
          };
        };

        dbRequest.onerror = dbRequest.onfailure = function(event) {
          logger.error("indexedDB.open failed: ", event);
          promise.reject(new Error("Failed to open database!"));
        }; 
      });
    }

    function storeRequest(methodName) {
      var args = Array.prototype.slice.call(arguments, 1);
      return util.getPromise(function(promise) {
        var store = DB.transaction(OBJECT_STORE_NAME, 'readwrite').
          objectStore(OBJECT_STORE_NAME);
        var request = store[methodName].apply(store, args);
        request.onsuccess = function() {
          promise.fulfill(request.result);
        };
        request.onerror = function(event) {
          promise.reject(event.error);
        };
      });
    }

    function wrapStore(store) {
      function req(method) {
        var args = Array.prototype.slice.call(arguments, 1);
        return util.getPromise(function(promise) {
          var request = store[method].apply(store, args);
          request.onsuccess = function() {
            promise.fulfill(request.result);
          };
          request.onerror  = function(event) {
            promise.reject(event.error);
          };
        });
      }
      return {
        get: util.curry(req, 'get'),
        set: function(key, value) {
          value.key = key;
          return req('put', value);
        },
        remove: util.curry(req, 'remove')
      };
    }

    function makeTransaction(mode, body) {
      return util.getPromise(function(promise) {
        var transaction = DB.transaction(OBJECT_STORE_NAME, mode);
        var store = transaction.objectStore(OBJECT_STORE_NAME);
        transaction.oncomplete = promise.fulfill;
        transaction.onerror = promise.reject;
        body(wrapStore(store));
      });
    }

    var indexedDbStore = {
      transaction: function(write, body) {
        return makeTransaction(write ? 'readwrite' : 'readonly', body);
      },

      on: function(eventName, handler) {
        logger.debug("WARNING: indexedDB event handling not implemented");
      },
      // get: function(key) {
      //   logger.debug("GET " + key);
      //   return storeRequest('get', key);
      // },
      // set: function(key, value) {
      //   logger.debug("SET " + key);
      //   var node = value;
      //   node.key = key;
      //   return storeRequest('put', node);
      // },
      // remove: function(key) {
      //   logger.debug("REMOVE " + key);
      //   return storeRequest('delete', key);
      // },
      forgetAll: function() {
        logger.debug("FORGET ALL");
        return removeDatabase().then(doOpenDatabase);
      }
    };

    var tempStore = pendingAdapter();

    function replaceAdapter() {
      if(tempStore.flush) {
        tempStore.flush(indexedDbStore);
        util.extend(tempStore, indexedDbStore);
      }
    }

    function doOpenDatabase() {
      openDatabase().
        then(function(db) {
          logger.info("Database opened.");
          DB = db;
          replaceAdapter();
        });
    }

    doOpenDatabase();

    return tempStore;
  };

  adapter.detect = function() {
    var indexedDB;
    if(typeof(window) !== 'undefined') {
      // indexedDB = (window.indexedDB || window.webkitIndexedDB ||
      //              window.mozIndexedDB || window.msIndexedDB);
      if(window.webkitIndexedDB) {
        window.shimIndexedDB.__useShim();
      }
      indexedDB = window.indexedDB;
    }
    return indexedDB;
  };

  return adapter;
});
