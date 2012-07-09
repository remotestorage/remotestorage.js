define(['./wireClient', './session', './store'], function(wireClient, session, store) {
  var prefix = '_remoteStorage_', busy=false;
   
  function addToList(listName, path, value) {
    var list = getList(listName);
    if(list[path] != value) {
      list[path] = value;
      localStorage.setItem(prefix+listName, JSON.stringify(list));
    }
  }
  function getList(listName) {
    var list, listStr = localStorage.getItem(prefix+listName);
    if(listStr) {
      try {
        return JSON.parse(listStr);
      } catch(e) {
      }
    }
    return {};
  }
  function getState(path) {
    if(session.getState() == 'connected') {
      if(busy) {
        return 'busy';
      } else {
        return 'connected';
      }
    } else {
      return 'anonymous';
    }
  }
  //the sync list is at the same time a list of what should be synced and what we know about that data.
  //a node should have lastFetched, (null if we have no access), and a hashmap of children -> lastModified.
  //we should not have a separate syncList and store. just an 'includeChildren' field and an 'explicit' field.
  //syncNode types: noAccess, miss, explicitRecursive, implicitKeep, implicitLeave
  //a leaf will not need a lastFetch field, because we always fetch its containingDir anyway. so you should never store items
  //in directories you can't list!
  //
  //what is quite complex is the difference between node.children and node.data for a directory.
  //first of all, if you delete a file, then in its parent node, it is removed from data, but not (yet) from children, so that the
  //deletion can still be synced. once it's removed from the server, and the directory listing is retrieved again, i think it should be removed
  //from children as well.
  //also, the values in .data are server-side revision numbers, where as in .children i think they are client-side timestamps.
  //TODO: double check this description once it's all working
  function pullMap(basePath, map, force, accessInherited) {
    for(var path in map) {
      var node = store.getNode(basePath+path);//will return a fake dir with empty children list for item
      //node.revision = the revision we have, 0 if we have nothing;
      //node.startForcing = force fetch from here on down
      //node.stopForcing = maybe fetch, but don't force from here on down
      //node.keep = we're not recursively syncing this, but we obtained a copy implicitly and want to keep it in sync
      //node.children = a map of children nodes to their revisions (0 for cache miss)
      var access = accessInherited || node.access;
      if(node.outgoingChange) {
        //TODO: deal with media; they don't need stringifying, but have a mime type that needs setting in a header
        wireClient.set(basePath+path, JSON.stringify(node.data), function(err) {
          console.log(err);
        });
      } else if(node.revision<map[path]) {
        if(node.startForcing) { force = true; }
        if(node.stopForcing) { force = false; }
        if((force || node.keep) && access) {
          wireClient.get(basePath+path, function (err, data) {
            if(data) {
              var node = store.getNode(basePath+path);
              node.data = data;
              store.updateNode(basePath+path, node);
            }
            pullMap(basePath+path, store.getNode(basePath+path).children, force, access);//recurse without forcing
          });
        } else {
          //store.forget(basePath+path);
          pullMap(basePath+path, node.children, force, access);
        }
      }// else everything up to date
    }
  }
  //
  function getUserAddress() {
    return null;
  }
  function getCurrentTimestamp() {
    return new Date().getTime();
  }
  function get(path, cb) {
    var fromCache = store.get(path);
    if(fromCache) {
      cb(null, fromCache);
    } else {
      wireClient.get(path, function(err, data) {
        if(getState(path) != 'disconnected') {
          store.set(path, data);
          addToList('pull', path, getCurrentTimeStamp());
        }
        cb(err, data);
      });
    }
  }
  function syncNow() {
    pullMap('', {'/': Infinity}, false);
  }
  function on(eventType, cb) {
  }
  return {
    syncNow: syncNow,
    getState : getState,
    getUserAddress : getUserAddress,
    get : get,
    on : on
  };
});
