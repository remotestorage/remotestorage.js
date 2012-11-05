define(['./util', './platform', './dataStore'], function (util, platform, dataStore) {

  "use strict";

  /*
    Methods that got a callback:
      - getNode
      - forget
      - forgetAll
      - setNodeData
      - getNodeData
      - setNodeAccess
      - setNodeForce
      - clearDiff
      - determineDirTimestamp
      - updateNodeData (not implemented)
      - updateNode (not implemented)
   */

  // Namespace: store
  //
  // The store stores data locally. It treats all data as raw nodes, that have *metadata* and *payload*.
  // Metadata and payload are stored under separate keys.


  var logger = util.getLogger('store');

  // foreign nodes are prefixed with a user address
  var userAddressRE = /^[^@]+@[^:]+:\//;

  var events = util.getEventEmitter('error', 'change', 'foreign-change');

  //
  // Type: Node
  //
  // Represents a node within the local store.
  //
  // Properties:
  //   startAccess - either "r" or "rw". Flag means, that this node has been claimed access on (see <remoteStorage.claimAccess>) (default: null)
  //   startForce  - boolean flag to indicate that this node shall always be synced. (see <BaseClient.use> and <BaseClient.release>) (default: null)
  //   timestamp   - last time this node was (apparently) updated (default: 0)
  //   lastUpdatedAt - Last time this node was upated from remotestorage
  //   mimeType    - MIME media type
  //   diff        - (directories only) marks children that have been modified.
  //


  // Event: change
  // See <BaseClient.Events>

  function fireChange(origin, path, oldValue) {
    getNode(path, function(node) {
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
    getNode(path, function(node) {
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

  dataStore.on('change', function(event) {
    if(! util.isDir(event.path)) {
      fireChange('device', event.path, event.oldValue);
    }
  });

  // Method: getNode
  // get a node's metadata
  //
  // Parameters:
  //   path - absolute path
  //
  // Returns:
  //   a node object. If no node is found at the given path, a new empty
  //   node object is constructed instead.
  function getNode(path, callback) {
    if(! path) {
      throw new Error("No path given!");
    }
    validPath(path);
    dataStore.getNode(path, function(node) {
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
      callback(node);
    });
  }


  // Method: forget
  // Forget node at given path
  //
  // Parameters:
  //   path - absolute path
  function forget(path, callback) {
    validPath(path);
    dataStore.remove(path, callback || function() {});
  }

  // Method: forgetAll
  // Forget all data stored by <store>.
  //
  function forgetAll(callback) {
    dataStore.forgetAll(callback || function() {});
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
  function setNodeData(path, data, outgoing, timestamp, mimeType, callback) {
    logger.debug('PUT', path, { data: data, mimeType: mimeType });
    getNode(path, function(node) {
      if(! outgoing) {
        if(typeof(timestamp) !== 'number') {
          throw "Attempted to set non-number timestamp in incoming change: " + timestamp + ' (' + typeof(timestamp) + ')';
        }
        node.lastUpdatedAt = timestamp;
      }

      if(! mimeType) {
        mimeType = 'application/json';
      }
      node.mimeType = mimeType;

      if(typeof(data) == 'object' && data instanceof ArrayBuffer) {
        metadata.binary = true;
        data = util.encodeBinary(data);
      } else {
        metadata.binary = false;
      }

      node.data = data;
      updateNode(path, (data ? metadata : undefined), outgoing, false, timestamp, oldValue, callback);
    });
  }

  // Method: getNodeData
  // get a node's data
  //
  // Parameters:
  //   path - absolute path
  //   raw  - (optional) don't attempt to unpack JSON data
  //   callback - called with result
  //
  function getNodeData(path, raw, callback) {
    logger.debug('GET', path);
    validPath(path);

    if(typeof(raw) === 'function') {
      callback = raw, raw = false;
    }

    getNode(path, function(node) {
      var data = node.data;
      if(data) {
        if(node.binary) {
          data = util.decodeBinary(node.data);
        } else if((!raw) && (node.mimeType == "application/json")) {
          try {
            data = JSON.parse(node.data);
          } catch(exc) {
            events.emit('error', "Invalid JSON node at " + path + ": " + node.data);
          }
        }
      }
      callback(data);
    });
  }

  function removeNode(path, timestamp) {
    setNodeData(path, undefined, false, timestamp || getCurrTimestamp());
  }

  function updateMetadata(path, attributes, callback, node) {
    function doUpdate(node) {
      util.extend(node, attributes);
      updateNode(path, node, false, true, undefined, undefined, callback);
    }
    if(node) {
      doUpdate(node);
    } else {
      getNode(path, doUpdate);
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
  function setNodeAccess(path, claim, callback) {
    getNode(path, function(node) {
      if((claim !== node.startAccess) &&
         (claim === 'rw' || node.startAccess === null)) {
        updateMetadata(path, {
          startAccess: claim
        }, callback, node);
      } else {
        callback();
      }
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
  //   callback  - called when node is updated
  //
  function setNodeForce(path, dataFlag, treeFlag, callback) {
    updateMetadata(path, {
      startForce: dataFlag,
      startForceTree = treeFrag
    }, callback);
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
  function clearDiff(path, timestamp, callback) {
    logger.debug('clearDiff', path);
    getNode(path, function(node) {

      function clearDiffOnParent() {
        var parentPath = util.containingDir(path);
        if(parentPath) {
          var baseName = util.baseName(path);
          getNode(parentPath, function(parent) {
            delete parent.diff[baseName];
            updateNode(
              parentPath, parent, false, true, undefined, undefined, function() {
                if(Object.keys(parent.diff).length === 0) {
                  clearDiff(parentPath, timestamp, callback);
                } else {
                  callback();
                }
              }
            );
          });
        } else {
          callback();
        }
      }

      if(util.isDir(path) && Object.keys(node.data).length === 0 &&
         !(node.startAccess || node.startForce || node.startForceTree)) {
        // remove empty dir
        updateNode(
          path, undefined, false, false, undefined, undefined, clearDiffOnParent
        );
      } else if(timestamp) {
        // set last updated
        node.timestamp = node.lastUpdatedAt = timestamp;
        updateNode(
          path, node, false, true, undefined, undefined, clearDiffOnParent
        );
      } else {
        clearDiffOnParent();
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
        getNode(path, function(node) {
          if(node.data) {
            for(var key in node.data) {
              iter(path + key);
            }
          }
        });
      } else {
        fireChange('device', path);
      }
    }

    iter('/');
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

  function determineDirTimestamp(path, callback) {
    getNode(path, function(node) {
      if(node.data) {
        var times = [];
        for(var key in node.data) {
          times.push(node.data[key]);
        }
        callback(Math.max.apply(Math, times));
      } else {
        callback(getCurrTimestamp());
      }
    });
  }

  function updateNodeData(path, data) {
    validPath(path);
    if(! path) {
      throw new Error("Path is required!");
    }
    var encodedData;
    if(typeof(data) !== 'undefined') {
      if(typeof(data) === 'object') {
        encodedData = JSON.stringify(data);
      } else {
        encodedData = data;
      }
      dataStore.setData(path, encodedData);
    } else {
      dataStore.removeData(path);
    }
  }

  // FIXME: this argument list is getting too long!!!
  function updateNode(path, node, outgoing, meta, timestamp, oldValue, callback) {
    validPath(path);

    if((!meta) && (! timestamp)) {
      if(outgoing) {
        timestamp = getCurrTimestamp();
      } else if(util.isDir(path)) {
        timestamp = determineDirTimestamp(path);
      } else {
        timestamp = 0;
        throw new Error('no timestamp given for node ' + path);
      }
    }

    if(node && typeof(timestamp) == 'number') {
      node.timestamp = timestamp;
    }

    if(node) {
      dataStore.setNode(path, JSON.stringify(node));
    } else {
      dataStore.removeNode(path);
    }
    var containingDir = util.containingDir(path);

    if(containingDir) {

      var parentNode = getNode(containingDir);
      var parentData = getNodeData(containingDir) || {};
      var baseName = getFileName(path);

      if(meta) {
        if(! (parentData && parentData[baseName])) {
          parentData[baseName] = 0;
          updateNodeData(containingDir, parentData);
        }
        updateNode(containingDir, parentNode, false, true, timestamp);
      } else if(outgoing) {
        // outgoing
        if(node) {
          parentData[baseName] = timestamp;
        } else {
          delete parentData[baseName];
        }
        parentNode.diff[baseName] = timestamp;
        updateNodeData(containingDir, parentData);
        updateNode(containingDir, parentNode, true, false, timestamp);
      } else {
        // incoming
        if(node) {
          // incoming add or change
          if(!parentData[baseName] || parentData[baseName] < timestamp) {
            parentData[baseName] = timestamp;
            delete parentNode.diff[baseName];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        } else {
          // incoming deletion
          if(parentData[baseName]) {
            delete parentData[baseName];
            delete parentNode.diff[baseName];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        }
        if(! util.isDir(path)) {
          // fire changes
          if(isForeign(path)) {
            fireForeignChange(path, oldValue);
          } else {
            fireChange('remote', path, oldValue);
          }
        }
      }
    }
  }

  return {
    
    events: events,

    // method         , local              , used by
                                           
    getNode           : getNode,          // sync
    getNodeData       : getNodeData,      // sync
    setNodeData       : setNodeData,      // sync
    clearDiff         : clearDiff,        // sync
    removeNode        : removeNode,       // sync

    on                : events.on,
    setNodeAccess     : setNodeAccess,
    setNodeForce      : setNodeForce,
    forget            : forget,
    
    forgetAll         : forgetAll,        // widget
    fireInitialEvents : fireInitialEvents // widget
  };

});
