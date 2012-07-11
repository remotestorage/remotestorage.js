define([], function () {
  var onChange,
    prefixNodes = 'remote_storage_nodes:';
  window.addEventListener('storage', function(e) {
    if(e.key.substring(0, prefixNodes.length == prefixNodes)) {
      e.path = e.key.substring(prefixNodes.length);
      if(onChange && !isDir(e.path)) {
        e.origin='device';
        onChange(e);
      }
    }
  });
  function getNode(path) {
    valueStr = localStorage.getItem(prefixNodes+path);
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
        lastModified: 0,
        outgoingChanges: false,
        keep: true,
        children: {},
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
  function updateNode(path, node) {
    localStorage.setItem(prefixNodes+path, JSON.stringify(node));
    var containingDir = getContainingDir(path);
    if(containingDir) {
      var parentNode=getNode(containingDir);
      var changed = false;
      if(!parentNode.children[getFileName(path)]) {
        parentNode.children[getFileName(path)] = 999999;//meaning we should fetch this node next time
        changed = true;
      }
      if(parentNode.data[getFileName(path)] && !node.data) {
        delete parentNode.data[getFileName(path)];
        changed = true;
      } else if(!parentNode.data[getFileName(path)] && node.data) {
        parentNode.data[getFileName(path)] = true;
        changed = true;
      }
      if(changed) {
        updateNode(containingDir, parentNode);
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
      }
    }
  }
  function on(eventName, cb) {
    if(eventName=='change') {
      onChange = cb;
    }
  }
  function connect(path, connectVal) {
    var node = getNode(path);
    node.startForcing=(connectVal!=false);
    updateNode(path, node);
  }
  function getState(path) {
    return 'disconnected';
  }
  return {
    on         : on,//error,change(origin=tab,device,cloud)
   
    getNode    : getNode,
    updateNode : updateNode,
    forget     : forget,
    forgetAll  : forgetAll
  };
});
