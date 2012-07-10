//start: store has a tree with three types of node: dir, object, media.
//each node has fields:
// - access (whether we believe we can read and maybe write the subtree starting at that node on remote)
// - children (hash map file name -> remote timestamp, used to know if we should recurse during pull)
// - data (for dirs, hash map file name -> local timestamp, maybe this should actually be in the nodes); for objects, the object; for media, the mimetype and value)
// - outgoingChange is true (should maybe be a timestamp or null) if this is object or media
//whenever you sync, it first pulls in the entire tree, starting at the root.
//if it doesn't have read access, it will pull the children instead
//if any of the children increased their timestamp, it will recurse into them
//caching without outgoing changes is easy. and if the cache is kept up-to-date, then outgoing changes are also easy, although they would trigger read-back
//if you've been offline for a while and have pending changes to push out, then pull first, and compare timestamps.
//only push outgoing changes that you think are newer than what's on remote. so if two devices have been online for a while, then the one you connect first, wins.
//but if only one device has been offline, and has one-year-old changes on there, then those are not pushed out.
//possible improvements:
//-avoid read-back for objects and (especially) media: could use E-tags. returning timestamps on PUT would be even more efficient.
//-if a resource is deleted, then maybe it should stay listed in the parent. otherwise they will reappear if you connect a one-year-old device.
//-allowing the client to choose the timestamp would allow for "softer" write
//
//in PUT you should always either send or receive a 'Last-Modified' header (should add this to the protocol)
//maybe: always let the server respond with a Last-Modified header, so that you can see later in the index if your write was successful by only looking at the parent index and without retrieving the actual resource. if two writes were concurrent, the losing party will receive a change event
//and let the client send an 'if-not-modified-since' header for 'soft writes'. you can get a 409 response if there's a conflict.
//probably the client should respect a margin of about 60 seconds within which it should attempt hard writes; after that it should switch to soft writes.

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
