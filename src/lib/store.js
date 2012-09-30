define(['./util'], function (util) {

  "use strict";

  var logger = util.getLogger('store');

  var onChange=[],
    prefixNodes = 'remote_storage_nodes:',
    prefixNodesData = 'remote_storage_node_data:';
  if(typeof(window) !== 'undefined') {
    window.addEventListener('storage', function(e) {
      if(e.key.substring(0, prefixNodes.length == prefixNodes)) {
        e.path = e.key.substring(prefixNodes.length);
        if(!isDir(e.path)) {
          e.origin='device';
          fireChange(e);
        }
      }
    });
  }
  function fireChange(e) {
    for(var i=0; i<onChange.length; i++) {
      onChange[i](e);
    }
  }
  function getNode(path) {
    var valueStr = localStorage.getItem(prefixNodes+path);
    var value;
    if(valueStr) {
      try {
        value = JSON.parse(valueStr);
      } catch(e) {
      }
    }
    if(!value) {
      value = {//this is what an empty node looks like
        startAccess: null,
        startForce: null,
        timestamp: 0,
        keep: true,
        diff: {}
      };
    }
    return value;
  }
  function isDir(path) {
    if(typeof(path) != 'string') {
      logger.error("Given path is not a string: ", path);
      doSomething();
    }
    return path.substr(-1) == '/';
  }
  function getContainingDir(path) {
    // '' 'a' 'a/' 'a/b' 'a/b/' 'a/b/c' 'a/b/c/'
    var parts = path.split('/');
    // [''] ['a'] ['a', ''] ['a', 'b'] ['a', 'b', ''] ['a', 'b', 'c'] ['a', 'b', 'c', '']
    if(!parts[parts.length-1].length) {//last part is empty, so string was empty or had a trailing slash
      parts.pop();
    }
    // [] ['a'] ['a'] ['a', 'b'] ['a', 'b'] ['a', 'b', 'c'] ['a', 'b', 'c']
    if(parts.length) {//remove the filename or dirname
      parts.pop();
      // - [] [] ['a'] ['a'] ['a', 'b'] ['a', 'b']
      return parts.join('/')+(parts.length?'/':'');
      // - '' '' 'a/' 'a/' 'a/b/' 'a/b/'
    }
    return undefined;
    // undefined - - - - - -
  }
  function getFileName(path) {
    var parts = path.split('/');
    if(isDir(path)) {
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
    if(typeof(data) === 'object') {
      encodedData = JSON.stringify(data);
    } else {
      encodedData = data;
    }
    localStorage.setItem(prefixNodesData+path, encodedData)
  }

  function updateNode(path, node, outgoing, meta, timestamp) {
    validPath(path);
    if(node) {
      localStorage.setItem(prefixNodes+path, JSON.stringify(node));
    } else {
      localStorage.removeItem(prefixNodes+path);
    }
    var containingDir = getContainingDir(path);
    if(containingDir) {
      var parentNode=getNode(containingDir);
      var parentData = getNodeData(containingDir) || {};
      if(meta) {
        if(! (parentData && parentData[getFileName(path)])) {
          parentData[getFileName(path)] = 0;
        }
        updateNodeData(containingDir, parentData);
        updateNode(containingDir, parentNode, false, true, timestamp);
      } else if(outgoing) {
        if(node) {
          parentData[getFileName(path)] = new Date().getTime();
        } else {
          delete parentData[getFileName(path)];
        }
        parentNode.diff[getFileName(path)] = new Date().getTime();
        updateNodeData(containingDir, parentData);
        updateNode(containingDir, parentNode, true, false, timestamp);
      } else {//incoming
        if(node) {//incoming add or change
          if(!parentData[getFileName(path)] || parentData[getFileName(path)] < timestamp) {
            parentData[getFileName(path)] = timestamp;
            delete parentNode.diff[getFileName(path)];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        } else {//incoming deletion
          if(parentData[getFileName(path)]) {
            delete parentData[getFileName(path)];
            delete parentNode.diff[getFileName(path)];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        }
        if(path.substr(-1)!='/') {
          fireChange({
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
  function forget(path) {
    localStorage.removeItem(prefixNodes+path);

  }
  function forgetAll() {
    for(var i=0; i<localStorage.length; i++) {
      if(localStorage.key(i).substr(0, prefixNodes.length) == prefixNodes) {
        localStorage.removeItem(localStorage.key(i));
        i--;
      }
    }
  }
  function on(eventName, cb) {
    if(eventName == 'change') {
      onChange.push(cb);
    } else {
      throw("Unknown event: " + eventName);
    }
  }
  function getState(path) {
    return 'disconnected';
  }

  function setNodeData(path, data, outgoing, timestamp, mimeType) {
    var node = getNode(path);
    if(!mimeType) {
      mimeType='application/json';
    }
    node.mimeType = mimeType;
    if(!timestamp) {
      timestamp = new Date().getTime();
    }
    updateNodeData(path, data);
    updateNode(path, (data ? node : undefined), outgoing, false, timestamp);
  }

  function getNodeData(path) {
    var valueStr = localStorage.getItem(prefixNodesData+path);
    if(valueStr) {
      try {
        return JSON.parse(valueStr);
      } catch(exc) {
        return valueStr;
      }
    } else {
      return undefined;
    }
  }

  function setNodeAccess(path, claim) {
    var node = getNode(path);
    if((claim != node.startAccess) && (claim == 'rw' || node.startAccess == null)) {
      node.startAccess = claim;
      updateNode(path, node, false, true);//meta
    }
  }
  function setNodeForce(path, force) {
    var node = getNode(path);
    node.startForce = force;
    updateNode(path, node, false, true);//meta
  }
  function clearDiff(path, i) {
    var node = getNode(path);
    delete node.diff[i];
    updateNode(path, node, false, true);//meta
  }
  return {
    on            : on,//error,change(origin=tab,device,cloud)

    getNode       : getNode,
    getNodeData   : getNodeData,
    setNodeData   : setNodeData,
    setNodeAccess : setNodeAccess,
    setNodeForce  : setNodeForce,
    clearDiff     : clearDiff,
    forget        : forget,
    forgetAll     : forgetAll
  };
});
