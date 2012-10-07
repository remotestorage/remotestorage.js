define(['./util'], function (util) {

  "use strict";

  // Namespace: store
  //
  // The store stores data locally. It treats all data as raw nodes, that have *metadata* and *payload*.
  // Metadata and payload are stored under separate keys.
  //
  // This is what a node's metadata looks like:
  //   startAccess - either "r" or "rw". Flag means, that this node has been claimed access on (see <remoteStorage.claimAccess>) (default: null)
  //   startForce  - boolean flag to indicate that this node shall always be synced. (see <BaseClient.sync>) (default: null)
  //   timestamp   - last time this node was (apparently) updated (default: 0)
  //   keep        - A flag to indicate, whether this node should be kept in cache. Currently unused. (default: true)
  //   diff        - difference in the node's data since the last synchronization.
  //   mimeType    - MIME media type
  //
  // Event: change
  // See <BaseClient.Events>
  //
  // Event: error
  // See <BaseClient.Events>

  var logger = util.getLogger('store');

  var events = util.getEventEmitter('change', 'error');

  var prefixNodes = 'remote_storage_nodes:',
      prefixNodesData = 'remote_storage_node_data:';

  function isPrefixed(key) {
    return key.substring(0, prefixNodes.length) == prefixNodes;
  }

  if(typeof(window) !== 'undefined') {
    window.addEventListener('storage', function(event) {
      if(isPrefixed(event.key)) {
        if(! util.isDir(event.path)) {
          event.path = event.key.substring(prefixNodes.length);
          event.origin = 'device';
          events.emit('change', event);
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
      throw "No path given!";
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
        timestamp: 0,
        mimeType: "application/json",
        keep: true,
        diff: {}
      };
    }
    return value;
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
    if(path[0] != '/') {
      throw "Invalid path: " + path;
    }
  }

  function updateNodeData(path, data) {
    validPath(path);
    if(! path) {
      console.trace();
      throw "Path is required!";
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

  function updateNode(path, node, outgoing, meta, timestamp) {
    validPath(path);
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
        if(node) {
          parentData[baseName] = getCurrTimestamp();
        } else {
          delete parentData[baseName];
        }
        parentNode.diff[baseName] = getCurrTimestamp();
        updateNodeData(containingDir, parentData);
        updateNode(containingDir, parentNode, true, false, timestamp);
      } else {//incoming
        if(node) {//incoming add or change
          if(!parentData[baseName] || parentData[baseName] < timestamp) {
            parentData[baseName] = timestamp;
            delete parentNode.diff[baseName];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        } else {//incoming deletion
          if(parentData[baseName]) {
            delete parentData[baseName];
            delete parentNode.diff[baseName];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        }
        if(path.substr(-1)!='/') {
          events.emit('change', {
            path: path,
            origin: 'remote',
            oldValue: undefined,
            newValue: (node ? getNodeData(path) : undefined),
            timestamp: timestamp
          });
        }
      }
    }
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
    if(!mimeType) {
      mimeType='application/json';
    }
    node.mimeType = mimeType;
    if(!timestamp) {
      timestamp = getCurrTimestamp();
    }
    updateNodeData(path, data);
    updateNode(path, (data ? node : undefined), outgoing, false, timestamp);
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

  function removeNode(path) {
    setNodeData(path, '', false);
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
  // Set startForce flag on a node.
  //
  // Parameters:
  //   path  - absolute path to the node
  //   force - value to set for the force flag (boolean)
  //
  function setNodeForce(path, force) {
    var node = getNode(path);
    node.startForce = force;
    updateNode(path, node, false, true);//meta
  }

  // Method: clearDiff
  //
  // Clear current diff on the node. This only applies to
  // directory nodes.
  //
  // Clearing the diff is usually done, once the changes have been
  // propagated through sync.
  //
  // Parameters:
  //   path      - absolute path to the directory node
  //   childName - name of the child who's change has been propagated
  //
  function clearDiff(path, childName) {
    logger.debug('clearDiff', path, childName);
    var node = getNode(path);
    delete node.diff[childName];
    updateNode(path, node, false, true);//meta

    var parentPath;
    if(Object.keys(node.diff).length === 0 && (parentPath = util.containingDir(path))) {
      clearDiff(parentPath, util.baseName(path));
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
    for(var i=0; i<localStorage.length; i++) {
      var key = localStorage.key(i)
      if(isPrefixed(key)) {
        var path = key.substring(prefixNodes.length);
        if(! util.isDir(path)) {
          events.emit('change', {
            path: path,
            newValue: getNodeData(path),
            oldValue: undefined,
            origin: 'device'
          });
        }
      }
    }
  }

  return {
    // Method: on
    // Install an event handler
    //
    on                : events.on,
    getNode           : getNode,
    getNodeData       : getNodeData,
    setNodeData       : setNodeData,
    setNodeAccess     : setNodeAccess,
    setNodeForce      : setNodeForce,
    clearDiff         : clearDiff,
    removeNode        : removeNode,
    forget            : forget,
    forgetAll         : forgetAll,
    fireInitialEvents : fireInitialEvents
  };
});
