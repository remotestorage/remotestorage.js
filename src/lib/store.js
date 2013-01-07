/*global window */
/*global console */

define([
  './util',
  './platform',
  './store/memory',
  './store/localStorage',
  './store/pending'
], function (util, platform, memoryAdapter, localStorageAdapter, pendingAdapter) {

  "use strict";

  // Namespace: store
  //
  // The store stores data locally. It treats all data as raw nodes, that have *metadata* and *payload*.
  // Where the actual data is stored is determined by the <StorageAdapter> that is being used.


  var logger = util.getLogger('store');

  // foreign nodes are prefixed with a user address
  var userAddressRE = /^[^@]+@[^:]+:\//;

  var events = util.getEventEmitter('error', 'change', 'foreign-change');

  var dataStore;

  // Method: setAdapter
  // Set the storage adapter. See <StorageAdapter> for a description of
  // the required interface.
  function setAdapter(adapter) {
    dataStore = adapter;
    // forward changes from data store (e.g. made in other tabs)
    dataStore.on('change', function(event) {
      if(! util.isDir(event.path)) {
        fireChange('device', event.path, event.oldValue);
      }
    });
  }

  // DEBUG
  var directoryUpdates = [];

  // (function() {
  //   if(typeof(window) !== 'undefined') {
  //     var idb = indexedDbAdapter.detect();
  //     if(idb) {
  //       setAdapter(indexedDbAdapter(idb));
  //     } else if(typeof(window.openDatabase) !== 'undefined') {
  //       setAdapter(webSqlAdapter());
  //     } else if(typeof(window.localStorage) !== 'undefined') {
  //       setAdapter(localStorageAdapter(window.localStorage));
  //     } else {
  //       throw "Running in browser, but no storage adapter supported!";
  //     }
  //   } else {
  //     console.error("WARNING: falling back to in-memory storage");
  //     setAdapter(memoryAdapter());
  //   }
  // })();

  if(typeof(window) !== 'undefined') {
    setAdapter(localStorageAdapter(window.localStorage));
  } else {
    console.error("WARNING: falling back to in-memory storage");
    setAdapter(memoryAdapter());
  }

  //
  // Type: Node
  //
  // Represents a node within the local store.
  //
  // Properties:
  //   startAccess    - either "r" or "rw". Flag means, that this node has been claimed access on (see <remoteStorage.claimAccess>) (default: null)
  //   startForce     - boolean flag to indicate that this node shall always be synced. (see <BaseClient.use> and <BaseClient.release>) (default: null)
  //   startForceTree - boolean flag that all directory children of this node shall be synced.
  //   timestamp      - last time this node was (apparently) updated (default: 0)
  //   lastUpdatedAt  - Last time this node was upated from remotestorage
  //   mimeType       - MIME media type
  //   diff           - (directories only) marks children that have been modified.
  //   data           - Actual data of the node. A String, a JSON-Object or an ArrayBuffer.
  //   binary         - boolean indicating if this node is binary. If true, 'data' is an ArrayBuffer.
  //

  // Event: change
  // See <BaseClient.Events>

  function fireChange(origin, path, oldValue) {
    return getNode(path).
      get('data', 'timestamp').
      then(function(newValue, timestamp) {
        events.emit('change', {
          path: path,
          origin: origin,
          oldValue: oldValue,
          newValue: newValue,
          timestamp: timestamp
        });
      });
  }

  // Event: foreign-change
  // Fired when a foreign node is updated.

  function fireForeignChange(path, oldValue) {
    return getNode(path).
      get('data', 'timestamp').
      then(function(newValue, timestamp) {
        events.emit('foreign-change', {
          path: path,
          oldValue: oldValue,
          newValue: newValue,
          timestamp: timestamp
        });
      });
  }
  
  //
  // Event: error
  // See <BaseClient.Events>

  //
  // Method: on
  //
  // Install an event handler
  // See <util.EventEmitter.on> for documentation.

  // Method: getNode
  // Get a node.
  //
  // Parameters:
  //   path - absolute path
  //
  // Returns:
  //   a node object. If no node is found at the given path, a new empty
  //   node object is constructed instead.
  function getNode(path) {
    logger.info('getNode', path);
    if(! path) {
      // FIXME: fail returned promise instead.
      throw new Error("No path given!");
    }
    validPath(path);
    return dataStore.get(path).then(function(node) {
      if(! node) {
        node = {//this is what an empty node looks like
          startAccess: null,
          startForce: null,
          startForceTree: null,
          timestamp: 0,
          lastUpdatedAt: 0,
          mimeType: "application/json"
        };
        if(util.isDir(path)) {
          node.diff = {};
          node.data = {};
        }
      }
      
      return node;
    });
  }
  

  // Method: forgetAll
  // Forget all data stored by <store>.
  //
  function forgetAll() {
    return dataStore.forgetAll();
  }

  // Function: setNodeData
  //
  // update a node's payload
  //
  // Parameters:
  //   path      - absolute path from the storage root
  //   data      - node data to set, or undefined to delete the node
  //   outgoing  - boolean, whether this update is to be propagated
  //   timestamp - timestamp to set for the update
  //   mimeType  - MIME media type of the node's data
  //
  // Fires:
  //   change w/ origin=remote - unless this is an outgoing change
  //
  function setNodeData(path, data, outgoing, timestamp, mimeType) {
    logger.debug('PUT', path, { data: data, mimeType: mimeType });
    return getNode(path).then(function(node) {

      var oldValue = node.data;

      node.data = data;

      if(! outgoing) {
        if(typeof(timestamp) !== 'number') {
          throw "Attempted to set non-number timestamp in incoming change: " + timestamp + ' (' + typeof(timestamp) + ')';
        }
        node.lastUpdatedAt = timestamp;

        delete node.error;
      }
      
      if(! mimeType) {
        mimeType = 'application/json';
      }
      node.mimeType = mimeType;

      return updateNode(path, (node.data ? node : undefined), outgoing, false, timestamp, oldValue);
    });
  }

  function setLastSynced(path, timestamp) {
    return getNode(path).then(function(node) {
      node.lastUpdatedAt = timestamp;
      return updateNode(path, node, false, true);
    });
  }

  function removeNode(path, timestamp) {
    return setNodeData(path, undefined, false, timestamp || getCurrTimestamp());
  }

  function updateMetadata(path, attributes, node) {
    function doUpdate(node) {
      util.extend(node, attributes);
      return updateNode(path, node, false, true);
    }
    if(node) {
      return doUpdate(node);
    } else {
      return getNode(path).then(doUpdate);
    }
  }

  // Method: setNodeAccess
  //
  // Set startAccess flag on a node.
  //
  // Parameters:
  //   path  - absolute path to the node
  //   claim - claim to set. Either "r" or "rw"
  //
  function setNodeAccess(path, claim) {
    logger.debug('setNodeAccess', path, claim);
    return getNode(path).then(function(node) {
      if((claim !== node.startAccess) &&
         (claim === 'rw' || node.startAccess === null)) {
        return updateMetadata(path, {
          startAccess: claim
        }, node);
      }
    });
  }

  function setNodeError(path, error) {
    logger.debug('setNodeError', path, error);
    return updateMetadata(path, {
      error: error
    });
  }

  // Method: setNodeForce
  //
  // Set startForce and startForceTree flags on a node.
  //
  // Parameters:
  //   path      - absolute path to the node
  //   dataFlag  - whether to sync data
  //   treeFlag  - whether to sync the tree
  //
  function setNodeForce(path, dataFlag, treeFlag) {
    logger.debug('setNodeForce', path, dataFlag, treeFlag);
    return updateMetadata(path, {
      startForce: dataFlag,
      startForceTree: treeFlag
    });
  }

  // Method: clearDiff
  //
  // Clear diff flag of given node on it's parent.
  //
  // Recurses upwards, when the parent's diff becomes empty.
  //
  // Clearing the diff is usually done, once the changes have been
  // propagated through sync.
  //
  // Parameters:
  //   path      - absolute path to the node
  //   timestamp - new timestamp (received from remote) to set on the node.
  //
  function clearDiff(path, timestamp) {
    logger.debug('clearDiff', path);
    return getNode(path).then(function(node) {

      function clearDiffOnParent() {
        var parentPath = util.containingDir(path);
        if(parentPath) {
          var baseName = util.baseName(path);
          return getNode(parentPath).then(function(parent) {
            delete parent.diff[baseName];
            if(Object.keys(parent.diff).length === 0) {
              parent.lastUpdatedAt = parent.timestamp;
            }
            return updateNode(parentPath, parent, false, true).then(function() {
              if(Object.keys(parent.diff).length === 0) {
                return clearDiff(parentPath, timestamp);
              }
            });
          });
        }
      }

      if(util.isDir(path) && Object.keys(node.data).length === 0 &&
         !(node.startAccess || node.startForce || node.startForceTree)) {
        // remove empty dir
        return updateNode(path, undefined, false, false).then(clearDiffOnParent);
      } else if(timestamp) {
        // set last updated
        node.timestamp = node.lastUpdatedAt = timestamp;
        return updateNode(path, node, false, true).then(clearDiffOnParent);
      } else {
        return clearDiffOnParent();
      }
    });
  }

  // Method: fireInitialEvents
  //
  // Fire a change event with origin=device for each node present in store.
  //
  // This is so apps don't need to add event handlers *and* initially request
  // listings to fill their views.
  //
  function fireInitialEvents() {
    logger.info('fire initial events');

    function iter(path) {
      if(util.isDir(path)) {
        return getNode(path).then(function(node) {
          if(node.data) {
            var keys = Object.keys(node.data);
            var next = function() {
              if(keys.length > 0) {
                return iter(path + keys.shift()).then(next);
              }
            };
            return next();
          }
        });
      } else {
        return fireChange('device', path);
      }
    }

    return iter('/');
  }

  function getFileName(path) {
    var parts = path.split('/');
    if(util.isDir(path)) {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

  function getCurrTimestamp() {
    return new Date().getTime();
  }

  function validPath(path) {
    if(! (path[0] == '/' || userAddressRE.test(path))) {
      throw new Error("Invalid path: " + path);
    }
  }

  function isForeign(path) {
    return path[0] != '/';
  }

  function determineDirTimestamp(path, transaction) {
    return getNode(path, transaction).
      get('data').then(function(data) {
        var t = 0;
        if(data) {
          for(var key in data) {
            if(data[key] > t) {
              t = data[key];
            }
          }
        }
        return t > 0 ? t : getCurrTimestamp();
      });
  }

  // FIXME: this argument list is getting too long!!!
  function updateNode(path, node, outgoing, meta, timestamp, oldValue,
                      transaction) {
    logger.info('updateNode', path, node, outgoing, meta, timestamp);

    validPath(path);

    if(util.isDir(path)) {
      directoryUpdates.push([path, node.data, oldValue, !!transaction]);
    }

    function adjustTimestamp(transaction) {
      logger.debug('updateNode.adjustTimestamp', transaction);
      return util.makePromise(function(promise) {
        function setTimestamp(t) {
          if(t) { timestamp = t; }
          if(node && typeof(timestamp) == 'number') {
            node.timestamp = timestamp;
          }
          promise.fulfill();
        }
        if((!meta) && (! timestamp)) {
          if(outgoing) {
            timestamp = getCurrTimestamp();
            setTimestamp();
          } else if(util.isDir(path)) {
            determineDirTimestamp(path, transaction).then(setTimestamp);
          } else {
            throw new Error('no timestamp given for node ' + path);
          }
        } else {
          setTimestamp();
        }
      });
    }

    function storeNode(transaction) {
      logger.debug('updateNode.storeNode', transaction, node);
      if(node) {
        return transaction.set(path, node);
      } else {
        return transaction.remove(path);
      }
    }

    function updateParent(transaction) {
      var parentPath = util.containingDir(path);
      var baseName = util.baseName(path);
      if(parentPath) {
        return getNode(parentPath, transaction).
          then(function(parent) {
            if(meta) { // META
              if(! parent.data[baseName]) {
                logger.debug('-> meta, create');
                parent.data[baseName] = 0;
                return updateNode(parentPath, parent, false, true, timestamp, undefined, transaction);
              }
            } else if(outgoing) { // OUTGOING
              if(node) {
                logger.debug('-> outgoing, set');
                parent.data[baseName] = timestamp;
              } else {
                logger.debug('-> outgoing, remove');
                delete parent.data[baseName];
              }
              parent.diff[baseName] = timestamp;
              logger.debug('-> diff, update');
              return updateNode(parentPath, parent, true, false, timestamp, undefined, transaction);
            } else { // INCOMING
              if(node) { // add or change
                if((! parent.data[baseName]) || parent.data[baseName] < timestamp) {
                  logger.debug('-> incoming, set');
                  parent.data[baseName] = timestamp;
                  delete parent.diff[baseName];
                  return updateNode(parentPath, parent, false, false, timestamp, undefined, transaction);
                }
              } else { // deletion
                logger.debug('-> incoming, remove');
                delete parent.data[baseName];
                delete parent.diff[baseName];
                return updateNode(parentPath, parent, false, false, timestamp, undefined, transaction);
              }
            }
          });
      }
    }

    function fireEvents() {
      if((! outgoing) && (! util.isDir(path))) {
        // fire changes
        if(isForeign(path)) {
          return fireForeignChange(path, oldValue);
        } else {
          return fireChange('remote', path, oldValue);
        }
      }
    }

    function doUpdate(transaction, dontCommit) {
      return adjustTimestamp(transaction).
        then(util.curry(storeNode, transaction)).
        then(util.curry(updateParent, transaction)).
        then(function() {
          if(! dontCommit) {
            transaction.commit();
          }
        }).
        then(fireEvents);
    };

    if(transaction) {
      return doUpdate(transaction, true);
    } else {
      return dataStore.transaction(true, doUpdate);
    }
  }

  return {

    memory: memoryAdapter,
    localStorage: localStorageAdapter,
    pending: pendingAdapter,
    
    events: events,

    // method         , local              , used by
                                           
    getNode           : getNode,          // sync
    setNodeData       : setNodeData,      // sync
    clearDiff         : clearDiff,        // sync
    removeNode        : removeNode,       // sync
    setLastSynced     : setLastSynced,    // sync

    on                : events.on,
    setNodeAccess     : setNodeAccess,
    setNodeForce      : setNodeForce,
    setNodeError      : setNodeError,
    
    forgetAll         : forgetAll,        // widget
    fireInitialEvents : fireInitialEvents,// widget

    setAdapter        : setAdapter,
    getAdapter        : function() { return dataStore; },

    // DEBUG
    directoryUpdates: directoryUpdates
  };

  // Interface: StorageAdapter
  //
  // Backend for the <store>.
  //
  // Currently supported:
  // * memory
  // * localStorage
  // * indexedDB
  //
  // Planned:
  // * WebSQL
  //
  // Method: get(path)
  // Get node from given path
  // Returns a promise.
  //
  // Method: set(path, node)
  // Create / update node at given path. See <store.Node> for a reference on how nodes look.
  // Returns a promise.
  //
  // Method: remove(path)
  // Remove node from given path
  // Returns a promise.
  //
  // Method: forgetAll()
  // Remove all data.
  // Returns a promise.
  //
  // Method: on(eventName)
  // Install an event handler.
  //
  // Event: change
  // Fired when the store changes from another source (such as another tab / window).
  //

});
