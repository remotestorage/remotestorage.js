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
        lastModified: 0,
        outgoingChange: false,
        keep: true,
        data: (isDir(path)?{}:undefined),
        added: {},
        removed: {},
        changed: {},
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
  function updateNode(path, node, changeType) {
    //there are three types of local changes: added, removed, changed.
    //when a PUT or DELETE is successful and we get a Last-Modified header back the parents should already be updated right to the root
    //
    if(typeof(node.data) != 'string') {
      node.data=JSON.stringify(node.data);//double-JSON-ed for now, until we separate metadata from content
    }
    localStorage.setItem(prefixNodes+path, JSON.stringify(node));
    var containingDir = getContainingDir(path);
    if(containingDir) {
      var parentNode=getNode(containingDir);
      if(changeType=='set') { 
        if(parentNode.data[getFileName(path)]) {
          parentNode.changed[getFileName(path)] = new Date().getTime();
        } else {
          parentNode.added[getFileName(path)] = new Date().getTime();
        }
        updateNode(containingDir, parentNode, 'set');
      } else if(changeType=='remove') {
        parentNode.removed[getFileName(path)] = new Date().getTime();
        updateNode(containingDir, parentNode, 'set');
      } else if(changeType=='accept') {
        if(parentNode.data[getFileName(path)] != node.lastModified) {
          parentNode.data[getFileName(path)] = node.lastModified;
          if(parentNode.lastModified < node.lastModified) {
            parentNode.lastModified = node.lastModified;
          }
          updateNode(containingDir, parentNode, 'accept');
        }
        fireChange({
          path: path,
          origin: 'remote',
          oldValue: undefined,
          newValue: node.data,
          timestamp: node.lastModified
        });
      } else if(changeType=='gone') {
        delete parentNode.data[getFileName(path)];
        if(parentNode.lastModified < node.lastModified) {
          parentNode.lastModified = node.lastModified;
        }
        updateNode(containingDir, parentNode, 'accept');
        fireChange({
          path: path,
          origin: 'remote',
          oldValue: undefined,
          newValue: undefined,
          timestamp: node.lastModified
        });
      } else if(changeType=='clear') {
        parentNode.data[getFileName(path)] = node.lastModified;
        delete parentNode.added[getFileName(path)];
        delete parentNode.removed[getFileName(path)];
        delete parentNode.changed[getFileName(path)];
        if(parentNode.lastModified < node.lastModified) {
          parentNode.lastModified = node.lastModified;
        }
        updateNode(containingDir, parentNode, 'accept');
      } else if(changeType=='meta') {//make sure parentNodes get created when setting force or access
        if(!parentNode.data[getFileName(path)]) {
          parentNode.data[getFileName(path)]=0;
        }
        updateNode(containingDir, parentNode, 'meta');
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
  function setNodeData(path, data, outgoing, lastModified, mimeType) {
    var node = getNode(path);
    node.data = data;
    if(lastModified) {
      node.lastModified = lastModified;
    }
    if(mimeType) {
      node.mimeType = mimeType;
    }
    if(outgoing) {
      node.outgoingChange = new Date().getTime();
      updateNode(path, node, (typeof(data)=='undefined'?'remove':'set'));
    } else {
      if(isDir(path)) {
        for(var i in data) {
          delete node.added[i];
        }
        for(var i in node.removed) {
          if(data[i] === null) {
            delete node.removed[i];
            delete node.data[i];
          }
        }
        updateNode(path, node, 'accept');
      } else {
        if(node.outgoingChange) {
          if(data != node.data && node.outgoingChange > lastModified) {
            //reject the update, outgoing changes will change it
          } else {
            node.data = data;
            node.outgoingChange = false;
            node.lastModified = lastModified;
            updateNode(path, node, 'clear');
          }
        } else {
          updateNode(path, node, (typeof(data)=='undefined'?'gone':'accept'));
        }
      }
    }
  }
  function clearOutgoingChange(path, lastModified) {
    var node = getNode(path);
    node.lastModified = lastModified;
    node.outgoingChange = false;
    updateNode(path, node, 'clear');
  }
  function setNodeAccess(path, claim) {
    var node = getNode(path);
    if((claim != node.startAccess) && (claim == 'rw' || node.startAccess == null)) {
      node.startAccess = claim;
      updateNode(path, node, 'meta');
    }
  }
  function setNodeForce(path, force) {
    var node = getNode(path);
    node.startForce = force;
    updateNode(path, node, 'meta');
  }
  return {
    on            : on,//error,change(origin=tab,device,cloud)
   
    getNode       : getNode,
    setNodeData   : setNodeData,
    setNodeAccess : setNodeAccess,
    setNodeForce  : setNodeForce,
    clearOutgoingChange:clearOutgoingChange,
    forget        : forget,
    forgetAll     : forgetAll
  };
});
