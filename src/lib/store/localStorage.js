define(['../util', './common'], function(util, common) {

  // Namespace: store.localStorage
  // <StorageAdapter> implementation that keeps data localStorage.

  var localStorage;

  var logger = util.getLogger('store::localStorage');

  var events = util.getEventEmitter('change', 'debug');

  //BEGIN-DEBUG
  function debugEvent(method, path) {
    events.emit('debug', {
      method: method,
      path: path,
      timestamp: new Date()
    });
  }
  
  events.enableEventCache('debug');
  //END-DEBUG

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
        //BEGIN-DEBUG
        debugEvent('GET', path);
        //END-DEBUG
        logger.debug('GET', path);
        return util.makePromise(function(promise) {
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
        //BEGIN-DEBUG
        debugEvent('SET', path);
        //END-DEBUG
        logger.debug('SET', path, node);
        return util.makePromise(function(promise) {
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
        //BEGIN-DEBUG
        debugEvent('REMOVE', path);
        //END-DEBUG
        logger.debug('SET', path);
        return util.makePromise(function(promise) {
          localStorage.removeItem(prefixNode(path));
          localStorage.removeItem(prefixData(path));
          promise.fulfill();
        });
      }
    };

    var errorStub = function() { throw new Error("Transaction already committed!"); };
    var staleStore = { get: errorStub, set: errorStub, remove: errorStub, commit: errorStub };

    var tid = 0;

    function makeTransaction(write, body) {
      var promise = util.getPromise();
      var transaction = util.extend({
        id: ++tid,
        commit: function() {
          finish();
        }
      }, store);
      function finish(implicit) {
        //BEGIN-DEBUG
        debugEvent('END TRANSACTION #' + transaction.id + ' (' + (implicit ? 'implicit' : 'explicit') + ')');
        //END-DEBUG
        logger.debug(transaction.id, 'FINISH Transaction (', write ? 'read-write' : 'read-only', ')');
        busy = false;
        util.extend(transaction, staleStore);
        promise.fulfill();
        runIfReady();
      };

      return {
        run: function() {
          busy = true;
          //BEGIN-DEBUG
          debugEvent('BEGIN TRANSACTION #' + transaction.id);
          //END-DEBUG
          logger.debug(transaction.id, 'BEGIN Transaction (', write ? 'read-write' : 'read-only', ')');
          var result = body(transaction);
          if(! write) {
            logger.debug(transaction.id, 'schedule implicit commit (read-only transaction)');
            finish(true);
          }
        },
        promise: promise
      };
    }

    var busy = false;
    var transactions = [];

    function runIfReady() {
      if(! busy) {
        var transaction = transactions.shift();
        if(transaction) {
          logger.debug('SHIFT TRANSACTION', transactions.length, 'left');
          transaction.run();
        }
      }
    }

    return {

      transaction: function(write, body) {
        var transaction = makeTransaction(write, body);
        transactions.push(transaction);
        util.nextTick(runIfReady);
        return transaction.promise;
      },

      on: events.on,

      get: store.get,

      forgetAll: function() {
        return util.makePromise(function(promise) {
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
    }
  }
});

