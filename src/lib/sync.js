define(['./wireClient', './store', './util'], function(wireClient, store, util) {

  "use strict";

  var events = util.getEventEmitter('error', 'conflict', 'state', 'busy', 'ready');
  var logger = util.getLogger('sync');

  // Namespace: sync

  /*
    Section: Notes

    Som example I made up to visualize some of the sync cases.

    Legend:
      L - has local modifications
      R - has remote modifications
      D - modification is a delete

    Suppose a tree like this:

      >    /
      >    /messages/
      >    /messages/pool/
      >    /messages/pool/1
      >    /messages/pool/2
      > L  /messages/pool/3
      > R  /messages/pool/4
      >    /messages/index/read/true/1
      > L  /messages/index/read/true/3
      >    /messages/index/read/false/2
      > LD /messages/index/read/false/3
      > R  /messages/index/read/false/4


    Now a sync cycle for /messages/ begins:

      > GET /messages/
      >   -> mark remote diff for pool/ and index/
      > GET /messages/index/
      >   -> mark local and remote diff for read/
      > GET /messages/index/read/
      >   -> mark remote diff for false/
      > GET /messages/index/read/false/
      >   -> mark remote diff for 4
      > DELETE /messages/index/read/false/3
      >   -> clear local diff for 3
      > GET /messages/index/read/false/4
      >   -> update local node 4
      >   -> clear remote diff for 4
      >   (pop back to /messages/index/read/)
      >   -> clear remote and local diff for false/
      > GET /messages/index/read/true/
      > PUT /messages/index/read/true/3
      >   -> clear local diff for 3
      >   (pop back to /messages/index/read/)
      >   -> clear local diff for true/)
      >   (pop back to /messages/index/)
      >   -> clear local and remote diff for read/
      >   (pop back to /messages/)
      > GET /messages/pool/
      >   -> mark remote diff for 4
      > PUT /messages/pool/3
      >   -> clear local diff for 3
      > GET /messages/pool/4
      >   -> update local node 4
      >   -> clear remote diff for 4
      >   (pop back to /messages/)
      >   -> clear local and remote diff for pool/
      >   (pop back to /)
      >   -> clear local and remote diff for messages/

    Sync cycle all done.

   */

  var settingsPrefix = 'remote_storage_sync:';

  function getSetting(key) {
    var data = localStorage.getItem(settingsPrefix + key);
    try { data = JSON.parse(data); } catch(e) {};
    return data;
  }

  function setSetting(key, value) {
    if(typeof(value) !== 'string') {
      value = JSON.stringify(value);
    }
    return localStorage.setItem(settingsPrefix + key, value);
  }

  function clearSettings() {
    for(var i=0;i<localStorage.length;i++) {
      var key = localStorage.key(i);
      if(key.match(new RegExp('^' + settingsPrefix))) {
        localStorage.removeItem(key);
      }
    }
  }

  // queue of spawnQueue calls
  // (for queueing *within* a sync cycle)
  var deferredQueues = [];
  // queue of sync tasks
  // (if requested, while not ready)
  var taskQueue = [];

  var ready = true;

  function setBusy() {
    ready = false;
    events.emit('state', 'busy');
    events.emit('busy');
  }
  function setReady() {
    ready = true;
    if(deferredQueues.length > 0) {
      spawnQueue.apply(this, deferredQueues.shift());
    } else {
      events.emit('state', 'connected');
      events.emit('ready');
    }
  }

  // see if we can fire 'ready', or if there's more to do
  function tryReady() {
    if(ready && deferredQueues.length == 0) {
      events.emit('ready');
    }
  }

  function getState() { return ready ? 'connected' : 'busy'; }

  // Section: Meta helpers

  // Function: makeConflictResolver
  // returns a function that can be called to resolve the conflict
  // at the given path.
  function makeConflictResolver(path, local, remote) {
    return function(solution) {
      if(solution == 'local') {
        // outgoing update!
        remoteUpdate(path, local);
      } else if(solution == 'remote') {
        // incoming update!
        localUpdate(path, remote);
      } else {
        throw "Invalid conflict resolution: " + solution;
      }
    }
  }

  // Function: makeErrorCatcher
  // returns a function, that receives an error as it's only parameter.
  // if the error resolves to true, an error event is fired.
  //
  // If an optional callback is supplied, and the error resolves to false,
  // the callback will be called with all additional arguments.
  function makeErrorCatcher(path, callback) {
    return function(error) {
      if(error) {
        fireError(path, error);
      } else if(callback) {
        var args = Array.prototype.slice.call(arguments, 1);
        callback.apply(this, args);
      }
    }
  }

  // Function: spawnQueue
  // run a procedure for each item in list.
  //
  // Parameters:
  //   list - an array of items to pass to the iter
  //   max  - maximum number of simultaneously running versions of iter
  //   iter - iterator to call
  //
  // Iterator parameters:
  //   item - an item from the list
  //   done - a callback function to call, when the iterator is finished
  //
  function spawnQueue(list, max, iter) {
    if(! ready) {
      deferredQueues.push([list, max, iter]);
      return;
    }

    setBusy();

    var n = 0;
    var i = 0;
    function next() {
      n++;
      iter(list[i++], done);
    }
    function done() {
      n--;
      if(i == list.length && n == 0) {
        setReady();
      } else if(i < list.length) {
        spawn();
      }
    }
    function spawn() {
      while(n < max && i < list.length) {
        next();
      }
    }
    setTimeout(spawn, 1);
  }

  // Limit calls to the given function to the given interval.
  // If the function receives a callback, it must be the last argument.
  // If the call is intercepted, as minInterval has not passed yet, the callback
  // will be called immediately. No parameters will be passed on to the callback.
  function limit(name, syncFunction, minInterval) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      var callback = args.slice(-1)[0];
      var plainArgs = args;
      if(typeof(callback) == 'function') {
        plainArgs = args.slice(0, -1);
      } else {
        callback = null;
      }
      var now = new Date().getTime();
      var cacheKey = [name, plainArgs];
      var limitCache = getSetting('limitCache') || {};
      if(limitCache[cacheKey] && limitCache[cacheKey] > (now - minInterval)) {
        logger.debug('limit', name, '-> replay');
        if(callback) {
          callback();
        }
      } else {
        logger.debug('limit', name, '-> call through');
        limitCache[cacheKey] = now;
        setSetting('limitCache', limitCache);
        syncFunction.apply(this, args);
      }
    }
  }

  // Section: Events

  // Event: ready
  //
  // Fired when sync becomes ready. This means the current sync cycle has ended.
  //
  // Shouldn't be used from application code, as the state may move back to 'busy'
  // immediately afterwards, in case tasks have been enqueued by the high-level
  // sync functions.

  // Event: conflict
  //
  // Both local and remote data of a node has been modified.
  // You need to specify a resolution.
  //
  // Properties:
  //   path        - path of the conflicting node
  //   localValue  - locally cached (and modified) value
  //   remoteValue - new value seen on the remote server
  //   localTime   - Date object, representing last local update
  //   remoteTime  - Date object, representing last remote update
  //   lastUpdate  - Date object, representing last synchronization of this node
  //   resolve     - Function to call, in order to specify a resolution
  //   type        - type of conflict, either "delete" or "merge"
  //
  // Example:
  //   (start code)
  //
  //   remoteStorage.on('conflict', function(event) {
  //
  //     console.log(event.type, ' conflict at ', event.path,
  //                 event.localTime, 'vs', event.remoteTime,
  //                 '(last seen: ', event.lastUpdate, ')');
  //
  //     event.resolve('local'); // overwrite remote version
  //     // OR
  //     event.resolve('remote'); // overwrite local version
  //   });
  //
  //   (end code)
  //

  function fireConflict(type, path, local, remote) {
    events.emit('conflict', {
      type: type,
      path: path,
      localValue: local.data,
      remoteValue: remote.data,
      localTime: new Date(local.timestamp),
      remoteTime: new Date(remote.timestamp),
      lastUpdate: new Date(local.lastUpdatedAt),
      resolve: makeConflictResolver(path, local, remote)
    });
  }

  // Event: error
  //
  // Fired when either one of the underlying layers propagates an error,
  // or an exception is called within a sync callback.
  //
  // Properties:
  //   path  - path that is associated with this error. May be null.
  //   error - Either an error message (string) or a Error object.
  //   stack - If this was an error and the browser supports the error.stack
  //           property, this holds the stack as an array of lines.


  function fireError(path, error) {
    var event = { path: path, };
    if(typeof(error) == 'object') {
      event.stack = error.stack;
      if(typeof(event.stack == 'string')) {
        event.stack = event.stack.split('\n');
      }
      event.message = error.message;
      event.exception = error;
    } else {
      event.message = error;
    }
    events.emit('error', event);
  }

  // Section: Update functions

  // Function: deleteLocal
  //
  // remove local data at path.
  // Fires: change
  function deleteLocal(path, local, remote) {
    logger.info('DELETE', path, 'REMOTE -> LOCAL');
    var oldValue = store.getNodeData(path);
    store.removeNode(path);
  }

  // Function: deleteRemote
  //
  // remove remote data, then clear local diff.
  // Fires: error
  function deleteRemote(path, local, remote) {
    logger.info('DELETE', path, 'LOCAL -> REMOTE');
    wireClient.remove(
      path,
      makeErrorCatcher(path, util.curry(store.clearDiff, path))
    );
  }

  // Function: updateLocal
  //
  // update local data at path.
  function updateLocal(path, local, remote) {
    logger.info('UPDATE', path, 'REMOTE -> LOCAL');
    store.setNodeData(path, remote.data, false, remote.timestamp, remote.mimeType);
  }

  // Function: updateRemote
  //
  // update remote data at path, then clear local diff.
  // Fires: error
  function updateRemote(path, local, remote) {
    logger.info('UPDATE', path, 'LOCAL -> REMOTE');
    wireClient.set(
      path, local.data, local.mimeType,
      makeErrorCatcher(path, util.curry(store.clearDiff, path))
    );
  }

  function fetchNode(path, callback) {
    logger.info("fetch remote", path);
    wireClient.get(path, function(err, data, mimeType) {
      if(err) {
        fireError(path, err);
      } else {
        try {
          callback(data, mimeType);
        } catch(exc) {
          fireError(path, exc);
        }
      }
    });
  }

  function makeSet(a, b) {
    var o = {};
    for(var i=0;i<a.length;i++) { o[a[i]] = true; }
    for(var j=0;j<b.length;j++) { o[b[j]] = true; }
    return Object.keys(o);
  }

  function fetchLocalNode(path, isDeleted) {
    logger.info("fetch local", path);
    var localNode = store.getNode(path);
    localNode.data = store.getNodeData(path);
    if(typeof(isDeleted) == 'undefined') {
      // in some contexts we don't have the parent present already to check.
      var parentPath = util.containingDir(path);
      if(parentPath) {
        var baseName = util.baseName(path);
        var parent = store.getNode(parentPath);
        var parentData = store.getNodeData(parentPath);
        isDeleted = (! parentData[baseName]) && parent.diff[baseName];
      } else {
        // root node can't be deleted.
        isDeleted = false;
      }
    }
    localNode.deleted = isDeleted;
    return localNode;
  }

  function prepareRemoteNode(data, mimeType, timestamp) {
    return {
      timestamp: timestamp,
      data: data,
      deleted: timestamp == 0,
      mimeType: mimeType
    }
  }

  function fetchRemoteNode(path, parentData, callback) {
    function done(data, mimeType) {
      callback(prepareRemoteNode(
        data, mimeType,
        (parentData && parentData[util.baseName(path)]) || 0
      ));
    }

    if(callback) {
      fetchNode(path, done);
    } else {
      callback = parentData, parentData = null;
      var parentPath = util.containingDir(path);
      if(parentPath) {
        fetchNode(parentPath, function(data) {
          parentData = data;
          fetchNode(path, done);
        });
      } else {
        fetchNode(path, done);
      }
    }
  }

  function findAccess(path) {
    if(! path) {
      return null;
    } else {
      var node = store.getNode(path);
      if(node.startAccess) {
        return node.startAccess;
      } else {
        return findAccess(util.containingDir(path));
      }
    }
  }

  // Function: traverseTree
  //
  // Traverse the full tree of nodes, passing each data node to the callback for processing.
  //
  // Parameters:
  //   root     - Path to the root to start traversal at.
  //   callback - callback called for each node. see below.
  //   options  - (optional) Object with options. see below.
  //
  // Callback parameters:
  //   The callback is called for each node, that is present either
  //   locally or remote (or both).
  //
  //   path       - path to current node
  //   localNode  - local node at current path. See <fetchLocalNode> for a description.
  //   remoteNode - remote node at current path. See <fetchRemoteNode> for a description.
  //
  // Options:
  //   depth - When given, a positive number, setting the maximum depth of traversal.
  //           Depth will be decremented in each recursion
  function traverseTree(root, callback, opts) {
    logger.info('traverse', root);
    
    if(! util.isDir(root)) {
      throw "Can't traverse data node: " + root;
    }

    if(! opts) { opts = {}; }

    var done = opts.done || function() {};

    if(opts.depth || opts.depth == 0) {
      logger.debug("traverse depth", opts.depth, root);
    }

    // fetch local listing
    var localRootNode = store.getNode(root);
    var localListing = store.getNodeData(root);

    if(! localListing) {
      // create empty directory node, if it doesn't exist.
      localListing = {};
      store.setNodeData(root, localListing, false, 0, 'application/json');
    }

    opts.access = util.highestAccess(opts.access, localRootNode.startAccess);
    opts.force = opts.force || localRootNode.startForce;
    opts.forceTree = opts.forceTree || localRootNode.startForceTree;

    if(! opts.access) {
      // in case of a partial sync, we have not been informed about
      // access inherited from the parent.
      opts.access = findAccess(util.containingDir(root));
    }

    if((! opts.access) && (! (root != '/') || opts.force || opts.forceTree)) {
      // no access and no interest.
      // -> bail!
      logger.debug('skipping', root, 'no interest', '(access: ', opts.access, ' force: ', opts.force, ' forceTree: ', opts.forceTree, ')');
      tryReady();
      done();
      return;
    }

    var localDiff = Object.keys(localRootNode.diff).length > 0;

    if(! localDiff) {
      if(opts.pushOnly) {
        tryReady();
        done();
        return;
      }
    }

    // fetch remote listing
    fetchNode(root, function(remoteListing) {

      if(! remoteListing) { remoteListing = {}; }

      // not really "done", but no more immediate requests in this
      // function.
      done();

      // all keys in local and/or remote listing
      var fullListing = makeSet(
        Object.keys(remoteListing),
        Object.keys(localListing)
      );

      if(opts.forceTree && (! opts.force) && Object.keys(localListing).length == 0) {
        // empty listing, only trees are synced.
        // -> copy children, but don't sync..
        fullListing.forEach(function(key) {
          localListing[key] = 0;
        });
        store.setNodeData(root, localListing, false, 0, 'application/json');
      }

      // check if we can skip this node.
      //
      if(! localDiff) {
        var remoteDiff = false;
        for(var i=0;i<fullListing.length;i++) {
          var item = fullListing[i];
          if(localListing[item] != remoteListing[item]) {
            // remote diff detected.
            // -> continue!
            remoteDiff = true;
            break;
          }
        }
        if(! remoteDiff) {
          // no remote diff.
          // -> bail!
          logger.debug('skipping', root, 'no changes');
          tryReady();
          return;
        }
      }

      spawnQueue(fullListing, 2, function(item, next) {
        var path = root + item;
        if(util.isDir(item)) {
          if(opts.depth && opts.depth == 1) {
            next();
          } else {
            var newOpts = util.extend({}, opts);
            if(newOpts.depth) { newOpts.depth--; }
            newOpts.done = next;
            traverseTree(path, callback, newOpts);
          }
        } else if(opts.force) {
          fetchRemoteNode(path, remoteListing, function(remoteNode) {
            var localNode = fetchLocalNode(
              path,
              // local deletions only appear in the diff of the parent.
              ( (! localListing[item]) &&
                (localRootNode.diff[item]) )
            );
            callback(path, localNode, remoteNode);
            next();
          });
        } else {
          next();
        }
      });

    });
  }

  function compareAndAct(path, local, remote) {

    var action = null;

    if(local.deleted) {
      // outgoing delete!
      logger.debug(path, 'outgoing delete');
      action = deleteRemote;

    } else if(remote.deleted && local.lastUpdatedAt > 0) {
      if(local.timestamp == local.lastUpdatedAt) {
        // incoming delete!
        logger.debug(path, 'incoming delete');
        action = deleteLocal;

      } else {
        // deletion conflict!
        logger.debug(path, 'deletion conflict', 'remote', remote, 'local', local);
        action = util.curry(fireConflict, 'delete');

      }
    } else if(local.timestamp == remote.timestamp) {
      // no action today!
      logger.debug(path, 'no action today');
      return;

    } else if(local.timestamp > remote.timestamp) {
      // local updated happpened before remote update
      if(local.lastUpdatedAt == remote.timestamp) {
        // outgoing update!
        logger.debug(path, 'outgoing update');
        action = updateRemote;

      } else {
        // merge conflict!
        logger.debug(path, 'merge conflict (remote > local)');
        action = util.curry(fireConflict, 'merge', 'remote', remote, 'local', local);

      }
    } else if(local.timestamp < remote.timestamp) {
      // remote updated happened before local update
      if(local.lastUpdatedAt == local.timestamp) {
        // incoming update!
        logger.debug(path, 'incoming update');
        action = updateLocal;

      } else {
        // merge conflict!
        logger.debug(path, 'merge conflict (local > remote)');
        action = util.curry(fireConflict, 'merge', 'remote', remote, 'local', local);

      }
    }

    if(! action) {
      var exc = new Error("Something went terribly wrong.");
      exc.path = path;
      exc.localNode = local;
      exc.remoteNode = remote;
      throw exc;
    }

    action(path, local, remote);
  }

  function enqueueTask(callback) {
    if(ready) {
      callback();
    } else {
      taskQueue.push(callback);
    }
  }

  // Section: High-level sync functions

  // Function: fullSync
  //
  // Perform a full sync cycle.
  //
  // Will update local and remote data as needed.
  //
  // Calls it's callback once 'ready' is fired.
  function fullSync(callback) {
    logger.info("full sync started");

    enqueueTask(function() {
      if(callback) {
        events.once('ready', callback);
      }

      traverseTree('/', compareAndAct);
    });
  }

  // Function: fullPush
  //
  // Perform a full sync cycle, but don't update local data.
  //
  // Used before disconnecting, to clear local diffs.
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function fullPush(callback) {
    logger.info("full push started");

    enqueueTask(function() {

      if(callback) {
        events.once('ready', callback);
      }

      traverseTree('/', compareAndAct, {
        pushOnly: true
      });
    });
  }

  // Function: partialSync
  //
  // Sync a partial tree, starting at given path.
  //
  // Parameters:
  //   startPath - path to start at. Must be a directory path.
  //   depth     - maximum depth of directories to traverse. null for infinite depth.
  //   callback  - callback to call when done. receives no parameters.
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function partialSync(startPath, depth, callback) {
    logger.info("partial sync requested: " + startPath);    
    enqueueTask(function() {
      logger.info("partial sync started from: " + startPath);
      events.once('ready', callback);
      traverseTree(startPath, compareAndAct, {
        depth: depth
      });
    });
  }

  // Function: syncOne
  //
  // Sync a single path. Call the callback when done.
  //
  // This function ignores all flags (access, force, forceTree) set on the node.
  //
  // Parameters:
  //   path     - the path to synchronize
  //   callback - (optional) callback to call when done
  //
  // Callback parameters:
  //   node - local node after sync
  //   data - data of local node after sync
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function syncOne(path, callback) {
    logger.info("single sync requested: " + path);
    enqueueTask(function() {
      logger.info("single sync started: " + path);
      fetchRemoteNode(path, function(remoteNode) {
        var localNode = fetchLocalNode(path);
        compareAndAct(path, localNode, remoteNode);
        if(callback) {
          callback(store.getNode(path), store.getNodeData(path));
        }
      });
    });
  }

  events.on('error', function(error) {
    logger.error("Error: ", error);
  });

  events.on('ready', function(error) {
    logger.info("READY");
    if(taskQueue.length > 0) {
      taskQueue.shift()();
    }
  });

  var limitedFullSync = limit('fullSync', fullSync, 30000);
  var limitedPartialSync = limit('partialSync', partialSync, 10000);
  
  var sync = {

    fullSync: limitedFullSync,
    partialSync: limitedPartialSync,
    fullPush: fullPush,
    syncOne: syncOne,

    getState: getState,
    on: events.on,

    clearSettings: clearSettings,

    syncNow: function(path, callback) {
      util.deprecate('sync.syncNow', 'sync.fullSync');
      this.fullSync(callback);
    },
    fetchNow: function(path, callback) {
      util.deprecate('sync.fetchNow', 'sync.syncOne or sync.partialSync');
      this.syncOne(path, callback);
    },

    disableThrottling: function() {
      sync.fullSync = fullSync;
      sync.partialSync = partialSync;
    }

  }

  return sync;

});

