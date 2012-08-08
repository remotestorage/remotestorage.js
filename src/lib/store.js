define([], function () {
  var onChange=[],
    prefixNodes = 'remote_storage_nodes:';
  window.addEventListener('storage', function(e) {
    if(e.key.substring(0, prefixNodes.length == prefixNodes)) {
      e.path = e.key.substring(prefixNodes.length);
      if(!isDir(e.path)) {
        e.origin='device';
        fireChange(e);
      }
    }
  });
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
        value.data = JSON.parse(value.data);//double-JSON-ed for now, until we split content away from meta
      } catch(e) {
      }
    }
    if(!value) {
      value = {//this is what an empty node looks like
        startAccess: null,
        startForce: null,
        timestamp: 0,
        keep: true,
        data: (isDir(path)?{}:undefined),
        diff: {}
      };
    }
    return value;
  }
  function isDir(path) {
    if(typeof(path) != 'string') {
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
  function updateNode(path, node, outgoing, meta, timestamp) {
    if(node) {
      if(typeof(node.data) != 'string') {
        node.data=JSON.stringify(node.data);//double-JSON-ed for now, until we separate metadata from content
      }
      localStorage.setItem(prefixNodes+path, JSON.stringify(node));
    } else {
      localStorage.removeItem(prefixNodes+path);
    }
    var containingDir = getContainingDir(path);
    if(containingDir) {
      var parentNode=getNode(containingDir);
      if(meta) {
        if(!parentNode.data[getFileName(path)]) {
          parentNode.data[getFileName(path)]=0;
        }
        updateNode(containingDir, parentNode, false, true);
      } else if(outgoing) { 
        if(node) {
          parentNode.data[getFileName(path)] = new Date().getTime();
        } else {
          delete parentNode.data[getFileName(path)];
        }
        parentNode.diff[getFileName(path)] = new Date().getTime();
        updateNode(containingDir, parentNode, true);
      } else {//incoming
        if(node) {//incoming add or change
          if(!parentNode.data[getFileName(path)] || parentNode.data[getFileName(path)] < timestamp) {
            parentNode.data[getFileName(path)] = timestamp;
            delete parentNode.diff[getFileName(path)];
            updateNode(containingDir, parentNode, false);
          }
        } else {//incoming deletion
          if(parentNode.data[getFileName(path)]) {
            delete parentNode.data[getFileName(path)];
            delete parentNode.diff[getFileName(path)];
            updateNode(containingDir, parentNode, false);
          }
        }
        if(path.substr(-1)!='/') {
          fireChange({
            path: path,
            origin: 'remote',
            oldValue: undefined,
            newValue: (node ? node.data : undefined),
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
    node.data = data;
    if(!mimeType) {
      mimeType='application/json';
    }
    node.mimeType = mimeType;
    if(!timestamp) {
      timestamp = new Date().getTime();
    }
    updateNode(path, (data ? node : undefined), outgoing, false, timestamp);
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
  return {
    on            : on,//error,change(origin=tab,device,cloud)
   
    getNode       : getNode,
    setNodeData   : setNodeData,
    setNodeAccess : setNodeAccess,
    setNodeForce  : setNodeForce,
    forget        : forget,
    forgetAll     : forgetAll
  };
});
