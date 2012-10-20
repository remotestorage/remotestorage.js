define(['./util'], function (util) {

  "use strict";

  // Namespace: store
  //
  // The store stores data locally. It treats all data as raw nodes, that have *metadata* and *payload*.
  // Metadata and payload are stored under separate keys.


  var logger = util.getLogger('store');

  // node metadata key prefix
  var prefixNodes = 'remote_storage_nodes:';
  // note payload data key prefix
  var prefixNodesData = 'remote_storage_node_data:';
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
  //   startForce  - boolean flag to indicate that this node shall always be synced. (see <BaseClient.sync>) (default: null)
  //   timestamp   - last time this node was (apparently) updated (default: 0)
  //   lastUpdatedAt - Last time this node was upated from remotestorage
  //   mimeType    - MIME media type
  //   diff        - (directories only) marks children that have been modified.
  //


  // Event: change
  // See <BaseClient.Events>

  function fireChange(origin, path, oldValue) {
    var node = getNode(path);
    events.emit('change', {
      path: path,
      origin: origin,
      oldValue: oldValue,
      newValue: getNodeData(path),
      timestamp: node.timestamp
    });
  }

  // Event: foreign-change
  // Fired when a foreign node is updated.

  function fireForeignChange(path, oldValue) {
    var node = getNode(path);
    events.emit('foreign-change', {
      path: path,
      oldValue: oldValue,
      newValue: getNodeData(path),
      timestamp: node.timestamp
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

  // forward events from other tabs
  if(typeof(window) !== 'undefined') {
    window.addEventListener('storage', function(event) {
      if(isPrefixed(event.key)) {
        if(! util.isDir(event.key)) {
          fireChange('device', event.key.substring(prefixNodes.length), event.oldValue);
        }
      }
    });
  }

  // Method: getNode
  // get a node's metadata
  //
  // Parameters:
  //   path - absolute path
  //
  // Returns:
  //   a node object. If no node is found at the given path, a new empty
  //   node object is constructed instead.
  function getNode(path) {
    if(! path) {
      throw new Error("No path given!");
    }
    validPath(path);
    var valueStr = localStorage.getItem(prefixNodes+path);
    var value;
    if(valueStr) {
      try {
        value = JSON.parse(valueStr);
      } catch(e) {
        logger.error("Invalid node data in store: ", valueStr);
        // invalid JSON data is treated like a node that doesn't exist.
      }
    }
    if(!value) {
      value = {//this is what an empty node looks like
        startAccess: null,
        startForce: null,
        startForceTree: null,
        timestamp: 0,
        lastUpdatedAt: 0,
        mimeType: "application/json"
      };
      if(util.isDir(path)) {
        value.diff = {};
      }
    }
    return value;
  }


  // Method: forget
  // Forget node at given path
  //
  // Parameters:
  //   path - absolute path
  function forget(path) {
    validPath(path);
    localStorage.removeItem(prefixNodes+path);
    localStorage.removeItem(prefixNodesData+path);
  }

  // Method: forgetAll
  // Forget all data stored by <store>.
  //
  function forgetAll() {
    for(var i=0; i<localStorage.length; i++) {
      if(localStorage.key(i).substr(0, prefixNodes.length) == prefixNodes ||
         localStorage.key(i).substr(0, prefixNodesData.length) == prefixNodesData) {
        localStorage.removeItem(localStorage.key(i));
        i--;
      }
    }
  }

  // Function: setNodeData
  //
  // update a node's metadata
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
    var node = getNode(path);
    var oldValue;

    if(! outgoing) {
      node.lastUpdatedAt = timestamp;
      oldValue = getNodeData(path);
    }

    if(!mimeType) {
      mimeType='application/json';
    }
    node.mimeType = mimeType;
    updateNodeData(path, data);
    updateNode(path, (data ? node : undefined), outgoing, false, timestamp, oldValue);
  }

  // Method: getNodeData
  // get a node's data
  //
  // Parameters:
  //   path - absolute path
  //   raw  - (optional) if given and true, don't attempt to unpack JSON data
  //
  function getNodeData(path, raw) {
    logger.info('GET', path);
    validPath(path);
    var valueStr = localStorage.getItem(prefixNodesData+path);
    var node = getNode(path);
    if(valueStr) {
      if((!raw) && (node.mimeType == "application/json")) {
        try {
          return JSON.parse(valueStr);
        } catch(exc) {
          events.emit('error', "Invalid JSON node at " + path + ": " + valueStr);
        }
      }

      return valueStr;
    } else {
      return undefined;
    }
  }

  function removeNode(path, timestamp) {
    setNodeData(path, undefined, false, timestamp || getCurrTimestamp());
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
    var node = getNode(path);
    if((claim != node.startAccess) && (claim == 'rw' || node.startAccess == null)) {
      node.startAccess = claim;
      updateNode(path, node, false, true);//meta
    }
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
    var node = getNode(path);
    node.startForce = dataFlag;
    node.startForceTree = treeFlag;
    updateNode(path, node, false, true);//meta
  }

  function setNodeError(path, error) {
    var node = getNode(path);
    if(! error) {
      delete node.error;
    } else {
      node.error = error;
    }
    updateNode(path, node, false, true);
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
    var node = getNode(path);
    if(timestamp) {
      node.timestamp = node.lastUpdatedAt = timestamp;
      updateNode(path, node, false, true);
    }
    var parentPath = util.containingDir(path);
    var baseName = util.baseName(path);
    if(parentPath) {
      var parent = getNode(parentPath);
      delete parent.diff[baseName];
      
      updateNode(parentPath, parent, false, true);

      if(Object.keys(parent.diff).length === 0) {
        clearDiff(parentPath);
      }
    }
  }

  // Method: fireInitialEvents
  //
  // Fire a change event with origin=device for each node present in localStorage.
  //
  // This is so apps don't need to add event handlers *and* initially request
  // listings to fill their views.
  //
  function fireInitialEvents() {
    logger.info('fire initial events');

    function iter(path) {
      if(util.isDir(path)) {
        var listing = getNodeData(path);
        if(listing) {
          for(var key in listing) {
            iter(path + key);
          }
        }
      } else {
        fireChange('device', path);
      }
    }

    iter('/');

  }




  function isPrefixed(key) {
    return key.substring(0, prefixNodes.length) == prefixNodes;
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


  function determineDirTimestamp(path) {
    var data = getNodeData(path);
    if(data) {
      var times = [];
      for(var key in data) {
        times.push(data[key]);
      }
      return Math.max.apply(Math, times);
    } else {
      return getCurrTimestamp();
    }
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
      localStorage.setItem(prefixNodesData+path, encodedData)
    } else {
      localStorage.removeItem(prefixNodesData+path)
    }
  }

  function updateNode(path, node, outgoing, meta, timestamp, oldValue) {
    validPath(path);

    if((!meta) && (! timestamp)) {
      if(outgoing) {
        timestamp = getCurrTimestamp();
      } else if(util.isDir(path)) {
        timestamp = determineDirTimestamp(path)
      } else {
        throw new Error('no timestamp given for node ' + path);
        timestamp = 0;
      }
    }

    if(node && typeof(timestamp) !== 'undefined') {
      node.timestamp = timestamp;
    }

    if(node) {
      localStorage.setItem(prefixNodes+path, JSON.stringify(node));
    } else {
      localStorage.removeItem(prefixNodes+path);
    }
    var containingDir = util.containingDir(path);

    if(containingDir) {

      var parentNode=getNode(containingDir);
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

    // method         , local              , used by
                                           
    getNode           : getNode,          // sync
    getNodeData       : getNodeData,      // sync
    setNodeData       : setNodeData,      // sync
    clearDiff         : clearDiff,        // sync
    removeNode        : removeNode,       // sync

    setNodeError: setNodeError,

    on                : events.on,
    setNodeAccess     : setNodeAccess,
    setNodeForce      : setNodeForce,
    forget            : forget,
    
    forgetAll         : forgetAll,        // widget
    fireInitialEvents : fireInitialEvents // widget
  };

});
