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
  //   lastUpdatedAt  - Last time this node was upated from remote storage
  //   mimeType       - MIME media type
  //   diff           - (directories only) marks children that have been modified.
  //   data           - Actual data of the node. A String, a JSON-Object or an ArrayBuffer.
  //   binary         - boolean indicating if this node is binary. If true, 'data' is an ArrayBuffer.
  //

  // Event: change
  // See <BaseClient.Events>

  function fireChange(origin, path, oldValue) {
    return getNode(path).
      then(function(node) {
        events.emit('change', {
          path: path,
          origin: origin,
          oldValue: oldValue,
          newValue: node.data,
          timestamp: node.timestamp
        });
      });
  }

  // Event: foreign-change
  // Fired when a foreign node is updated.

  function fireForeignChange(path, oldValue) {
    return getNode(path).
      then(function(node) {
        events.emit('foreign-change', {
          path: path,
          oldValue: oldValue,
          newValue: node.data,
          timestamp: node.timestamp
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
    return dataStore.transaction(true, function(transaction) {
      return getNode(path, transaction).then(function(node) {

        var oldValue = node.data;

        node.data = data;

        if(! outgoing) {
          if(typeof(timestamp) !== 'number') {
            throw "Attempted to set non-number timestamp in incoming change: " + timestamp + ' (' + typeof(timestamp) + ') at path ' + path;
          }
          node.lastUpdatedAt = timestamp;

          delete node.error;
        }

        if(! mimeType) {
          mimeType = 'application/json';
        }
        node.mimeType = mimeType;

        // FIXME: only set this when incoming data is set?
        delete node.pending;

        return updateNode(path, (typeof(node.data) !== 'undefined' ? node : undefined), outgoing, false, timestamp, oldValue, transaction).
          then(function() {
            transaction.commit();
          });
      });      
    });
  }

  function setNodePending(path, timestamp) {
    return dataStore.transaction(true, function(transaction) {
      return isForced(util.containingDir(path), transaction).
        then(function(isForced) {
          var paths = [path];
          if(! isForced) {
            var parts = util.pathParts(path);
            var pl = parts.length;
            for(var i=parts.length - 1;i>0;i--) {
              paths.unshift(parts.slice(0, i).join(''));
            }
          }
          return util.asyncEach(paths, function(p) {
            return getNode(p, transaction).then(function(node) {
              // clear only data nodes (we want to preserve pending listings)
              if(! util.isDir(p)) {
                delete node.data;
              }
              node.pending = true;
              return updateNode(p, node, false, false, timestamp, undefined, transaction);
            });
          });
        }).
        then(function() {
          transaction.commit();
        });
    });
  }

  function setLastSynced(path, timestamp) {
    logger.info('setLastSynced', path, 'requested');
    return dataStore.transaction(true, function(transaction) {
      logger.info('setLastSynced', path, 'started');
      return getNode(path, transaction).then(function(node) {
        node.lastUpdatedAt = timestamp;
        return updateNode(path, node, false, true, undefined, undefined, transaction).
          then(function() {
            logger.info('setLastSynced', path, 'done', timestamp);
            transaction.commit();
          });
      });
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
      then(function(node) {
        var t = 0;
        if(node.data) {
          for(var key in node.data) {
            if(node.data[key] > t) {
              t = node.data[key];
            }
          }
        }
        return t > 0 ? t : getCurrTimestamp();
      });
  }

  function touchNode(path) {
    return dataStore.transaction(true, function(transaction) {
      logger.info("touchNode", path);
      return getNode(path, transaction).
        then(function(node) {
          if(typeof(node.data) === 'undefined') {
            node.pending = true;
          }
          return updateNode(path, node, false, true, undefined, undefined, transaction).
            then(transaction.commit);
        });
    });
  }

  // FIXME: this argument list is getting too long!!!
  function updateNode(path, node, outgoing, meta, timestamp, oldValue,
                      transaction) {
    logger.debug('updateNode', path, node, outgoing, meta, timestamp);

    validPath(path);

    function adjustTimestamp(transaction) {
      return util.getPromise(function(promise) {
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
                parent.data[baseName] = 0;
                return updateNode(parentPath, parent, false, true, timestamp, undefined, transaction);
              }
            } else if(outgoing) { // OUTGOING
              if(node) {
                parent.data[baseName] = timestamp;
              } else {
                delete parent.data[baseName];
              }
              parent.diff[baseName] = timestamp;
              return updateNode(parentPath, parent, true, false, timestamp, undefined, transaction);
            } else { // INCOMING
              if(node) { // add or change
                if((! parent.data[baseName]) || parent.data[baseName] < timestamp) {
                  parent.data[baseName] = timestamp;
                  delete parent.diff[baseName];
                  return updateNode(parentPath, parent, false, false, timestamp, undefined, transaction);
                }
              } else { // deletion
                delete parent.data[baseName];
                delete parent.diff[baseName];
                return updateNode(parentPath, parent, false, false, timestamp, undefined, transaction);
              }
            }
          });
      }
    }

    function fireEvents() {
      if((!meta) && (! outgoing) && (! util.isDir(path)) && (! node.pending)) {
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
    }

    if(transaction) {
      return doUpdate(transaction, true);
    } else {
      return dataStore.transaction(true, doUpdate);
    }
  }

  function isForced(path, transaction) {
    var parts = util.pathParts(path);

    return util.getPromise(function(promise) {

      function checkOne(node) {
        if(node.startForce || node.startForceTree) {
          promise.fulfill(true);
        } else {
          parts.pop();
          checkNext();
        }
      }

      function checkNext() {
        if(parts.length === 0) {
          promise.fulfill(false);
        } else {
          getNode(parts.join('')).
            then(checkOne, promise.reject);
        }
      }

      checkNext();

    });
  }

  return {

    memory: memoryAdapter,
    localStorage: localStorageAdapter,
    pending: pendingAdapter,

    events: events,

    // method         , local              , used by

    getNode           : getNode,          // sync
    setNodeData       : setNodeData,      // sync
    setNodePending    : setNodePending,   // sync
    clearDiff         : clearDiff,        // sync
    removeNode        : removeNode,       // sync
    setLastSynced     : setLastSynced,    // sync

    isForced          : isForced,         // baseClient

    on                : events.on,
    emit              : events.emit,
    setNodeAccess     : setNodeAccess,
    setNodeForce      : setNodeForce,
    setNodeError      : setNodeError,
    touchNode         : touchNode,

    forgetAll         : forgetAll,        // widget
    fireInitialEvents : fireInitialEvents,// widget

    setAdapter        : setAdapter,
    getAdapter        : function() { return dataStore; }
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
