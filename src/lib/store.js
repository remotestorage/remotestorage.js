define([], function () {
//for the syncing, it turns out to be useful to store nodes for items, and store their data separately.
//we can then also use those nodes to mark where outgoing changes exist.
//so we would have one store for nodes, one for cache, and one for diffs.
//windows on the same device should share the diffs with each other, but basically flush their memCache whenever a diff or a cache or a node changes.
//memCache can be one big hashmap of nodes.
//actually, cache value and diff can be stored on the node, that makes it all a lot easier
//when a diff exists, then cache value can be expunged, so really, we only have to mark the node as 'outgoing:' with a timestamp.
//so in memCache, each node has fields:
//-lastRemoteRevisionSeen: (integer, not necessarily a timestamp!)
//-force: true/false/undefined
//-lastFetched: (timestamp on local clock)
//-outgoingChange: (timestamp on local clock or undefined)
//-keep: true/false
//-access: r/rw/null
//-children: map of filenames->true; {} for leafs
//-data: (obj), only for leafs
//
//store should expose: setObject, setMedia, removeItem, getData, getStatus, from baseClient (will lead to outgoingChange)
//also: getNode (from sync), updateNode (from sync), forgetNode (from sync)
//getNode should return {revision: 0} for a cache miss, but {revision:0, access:null, children:['bar']} for /foo if /foo/bar exists
//when you setObject or setMedia, parent nodes should be created and/or updated.

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
      value = {
        access: null,
        revision: 0,
        keep: true,
        children: {},
        data: (isDir(path)? {} : undefined)
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
    forget     : forget
  };
});
