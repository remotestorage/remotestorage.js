/*global localStorage */

define([
  './util', './store', './store/remoteCache', './wireClient'
], function(util, store, remoteCacheAdapter, wireClient) {

  "use strict";

  var remoteAdapter = remoteCacheAdapter();

  var events = util.getEventEmitter('error', 'conflict', 'state', 'busy', 'ready', 'timeout');
  var logger = util.getLogger('sync');

  /*******************/
  /* Namespace: sync */
  /*******************/

  // Settings. Trivial.

  var settings = util.getSettingStore('remotestorage_sync');


  // Section: How to configure sync
  //
  // remoteStorage.js takes care of all the synchronization of remote and local data.
  //
  // As an app developer you need to do three things, to make it work:
  // * claim access on the root of the tree in question (see <remoteStorage.claimAccess>)
  // * state which branches you wish to have synced
  // * release paths you no longer need from the sync plan, so they won't impact performance
  //
  // Now suppose you have a data tree like this:
  //   (start code)
  //
  //         A
  //        / \
  //       B   C
  //      / \   \
  //     d   E   f
  //        / \
  //       g   h
  //
  //   (end code)
  //
  // Let's consider *A* to be our root node (it may be a module root, doesn't
  // really matter for this example), and let's say we have a <BaseClient>
  // instance called *client*, that treats paths relative to *A*.
  //
  // The simplest thing we can do, is request everything:
  //   > client.use('');
  // Now as soon as sync is triggered (usually this happens when connecting
  // through the widget), the entire tree, with all it's nodes, including data
  // nodes (files) will be synchronized and cached to localStorage.
  //
  // If we previously set up a 'change' handler, it will now be called for each
  // data node, as it has been synchronized.
  //
  // At this point, we can use the synchronous versions of the <BaseClient>
  // methods for getting data. These methods will only hit the local cache (they
  // may trigger <syncOne>, but we'll get to that later).
  //   > client.getListing('B/'); // -> ['d', 'E/']
  //   > client.getObject('B/d'); // -> { ... }
  //
  // That was the simplest usecase. Let's look at another one:
  //
  // Suppose that all the data files within our tree contain a lot of data. They
  // could be music, videos, large images etc. Given that, it would be very
  // impractical to transfer all of them, even though we don't know at this point
  // if the user even wants to use them in the current session.
  // So one option we have, is to tell remoteStorage only to synchronize the
  // *directory tree*, but not the content of files.
  //   > client.use('', true);
  // The second argument given is called *treeOnly*.
  //
  // When we now (after the 'ready' event has been fired) use *getListing*, we
  // still get a listing of all known paths:
  //   > client.getListing(''); // -> ['B/', 'C/']
  //   > client.getListing('B/'); // -> ['d', 'E/']
  //
  // Getting an object on the other hand, will not return anything.
  //   > client.getObject('B/d'); // -> undefined
  //
  // We can use this scenario, to display a *tree of available data* to the user.
  // As soon as the user chooses one of the items, we can retrieve it, by passing
  // a callback to getObject:
  //   > client.getObject('B/d', function(object) {
  //   >   console.log("received object is: ", object);
  //   > });
  //

  function needsSync(path) {
    if(! path) {
      path = '/';
    }
    if(! util.isDir(path)) {
      return util.getPromise().fulfill(false);
    }
    return store.getNode(path).then(function(root) {
      if(Object.keys(root.diff).length > 0) {
        return true;
      }
      var keys = Object.keys(root.data);
      function next() {
        var key = keys.shift();
        if(! key) {
          return false;
        }
        return needsSync(path + key).then(function(value) {
          if(value) {
            return true;
          } else {
            return next();
          }
        });
      }
      return next();
    });
  }

  var disabled = false;

  function disable() {
    disabled = true;
    events.emit('ready');
  }

  function enable() {
    enabled = true;
  }

  /**************************************/

  // Section: High-level sync functions
  //
  // These are the functions that are usually called from outside this
  // file to initiate some synchronization task.
  //
  //

  // Function: fullSync
  //
  // Perform a full sync cycle.
  //
  // Will update local and remote data as needed.
  //
  // Calls it's callback once the cycle is complete.
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function fullSync(pushOnly) {
    return util.getPromise(function(promise) {
      if(disabled) {
        promise.fulfill()
        return;
      }
      if(! isConnected()) {
        promise.reject('not-connected');
        return;
      }

      logger.info("full " + (pushOnly ? "push" : "sync") + " started");

      findRoots().then(function(roots) {
        var synced = 0;

        function rootCb(path) {
          return function() {
            synced++;
            if(synced == roots.length) {
              sync.lastSyncAt = new Date();
              promise.fulfill();
            }
          };
        }

        if(roots.length === 0) {
          return promise.reject(new Error("No access claimed!"));
        }

        roots.forEach(function(root) {
          enqueueTask(function() {
            return traverseTree(root, processNode, {
              pushOnly: pushOnly
            });
          }, rootCb(root));
        });
      });
    });
  }

  // Function: fullPush
  //
  // Perform a full sync cycle, but only update remote data.
  //
  // Used before disconnecting, to clear local diffs.
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function fullPush(callback) {
    return fullSync(callback, true);
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
  function partialSync(startPath, depth) {
    return util.getPromise(function(promise) {
      if(! isConnected()) {
        return promise.fulfill();
      }

      validatePath(startPath);
      logger.info("partial sync requested: " + startPath);
      enqueueTask(function() {
        logger.info("partial sync started from: " + startPath);
        return traverseTree(startPath, processNode, {
          depth: depth,
          force: true
        });
      }, promise.fulfill);
    });
  }

  // Function: updateDataNode
  //
  // Sync a single data node, bypassing cache. Used by <BaseClient> to
  // fetch pending nodes.
  //
  function updateDataNode(path, localNode) {
    if(localNode) {
      return wireClient.set(path, localNode.data, localNode.mimeType).
        then(function() {
          remoteAdapter.expireKey(path);
        });
    } else {
      return remoteAdapter.get(path).
        then(function(node) {
          remoteAdapter.expireKey(path);
          return node;
        });
    }
  }


  /**************************************/

  // Section: Scheduling and state
  //
  // Scheduling happens using three variables:
  //
  //   ready state - a boolean, set to false when any task is in progress
  //
  //   task queue  - a queue of procedures to call when 'ready' is fired.
  //                 All <High-level sync functions> enqueue their task here,
  //                 when the the ready state is currently false.
  //
  //   deferred iteration queue - a queue of spawnQueue tasks to start, when the
  //                 'ready' event *would* be fired. Enqueued from spawnQueue,
  //                 when it's called with ready state set to false.
  //


  var ready = true;

  // queue of spawnQueue calls
  // (for queueing *within* a sync cycle)
  var deferredIterationQueue = [];
  // queue of sync tasks
  // (if requested, while not ready)
  var taskQueue = [];

  // function to call when current task is done, before next task is popped from taskQueue.
  var currentFinalizer = null;

  function beginTask() {
    setBusy();
    var task = taskQueue.shift();
    if(! task) {
      throw new Error("Can't begin task, queue is empty");
    }
    currentFinalizer = task.finalizer;
    var result = task.run();
    if(util.isPromise(result)) {
      result.then(finishTask, function(error) {
        logger.error("TASK FAILED", (error && error.stack) || error);
        finishTask();
        fireError(null, error);
      });
    }
  }

  function finishTask() {
    remoteAdapter.clearCache();
    if(currentFinalizer) {
      currentFinalizer();
    }
    if(taskQueue.length > 0) {
      beginTask();
    } else {
      setReady();
    }
  }

  function enqueueTask(callback, finalizer) {
    taskQueue.push({
      run: callback,
      finalizer: finalizer
    });
    if(ready) {
      beginTask();
    } else {
      logger.info('not ready, enqueued task');
    }
  }

  function setBusy() {
    ready = false;
    events.emit('state', 'busy');
    events.emit('busy');
  }
  function setReady() {
    ready = true;
    events.emit('state', 'connected');
    events.emit('ready');
  }

  // Function: getState
  // Get the current ready state of synchronization. Either 'connected' or 'busy'.
  function getState() {
    return disabled ? 'disabled' : (ready ? 'connected' : 'busy');
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
  //   client.on('conflict', function(event) {
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
    var event = { path: path, source: 'sync' };
    if(typeof(error) == 'object') {
      event.stack = error.stack;
      if(typeof(event.stack) == 'string') {
        event.stack = event.stack.split('\n');
      }
      event.message = error.message;
      event.exception = error;
    } else if(error == 'timeout') {
      events.emit('timeout');
      return;
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
    return store.removeNode(path, remote.timestamp);
  }

  // Function: deleteRemote
  //
  // remove remote data, then clear local diff.
  // Fires: error
  function deleteRemote(path, local, remote) {
    logger.info('DELETE', path, 'LOCAL -> REMOTE');
    return remoteAdapter.
      remove(path).
      then(function() {
        store.clearDiff(path);
      });
  }

  // Function: updateLocal
  //
  // update local data at path.
  function updateLocal(path, local, remote) {
    logger.info('UPDATE', path, 'REMOTE -> LOCAL');
    return store.setNodeData(path, remote.data, false, remote.timestamp, remote.mimeType);
  }

  // Function: updateRemote
  //
  // update remote data at path, then clear local diff.
  // Fires: error
  function updateRemote(path, local, remote) {
    logger.info('UPDATE', path, 'LOCAL -> REMOTE');
    var parentPath = util.containingDir(path);
    var baseName = util.baseName(path);
    return remoteAdapter.set(path, local).
      then(util.curry(remoteAdapter.expireKey, parentPath)).
      then(util.curry(remoteAdapter.get, parentPath)).
      then(function(remoteNode) {
        return store.clearDiff(
          path, remoteNode ? remoteNode.data[baseName] : undefined
        );
      });
  }

  // Function: processNode
  //
  // Decides which action to perform on the node in order to synchronize it.
  //
  // Used as a callback for <traverseTree>.
  function processNode(path, local, remote) {

    if(! path) {
      throw new Error("Can't process node without a path!");
    }

    if(util.isDir(path)) {
      throw new Error("Attempt to process directory node: " + path);
    }

    var action = null;

    if(local.deleted) {
      // outgoing delete!
      action = deleteRemote;

    } else if(remote.deleted && local.lastUpdatedAt > 0) {
      if(local.timestamp == local.lastUpdatedAt) {
        // incoming delete!
        action = deleteLocal;

      } else {
        // deletion conflict!
        action = util.curry(fireConflict, 'delete');

      }
    } else if(local.timestamp == remote.timestamp) {
      // no action today!
      return;

    } else if((!remote.timestamp) || local.timestamp > remote.timestamp) {
      // local updated happpened before remote update
      if((!remote.timestamp) || local.lastUpdatedAt == remote.timestamp) {
        // outgoing update!
        action = updateRemote;

      } else {
        // merge conflict!
        action = util.curry(fireConflict, 'merge');

      }
    } else if(local.timestamp < remote.timestamp) {
      // remote updated happened before local update
      if(local.lastUpdatedAt == local.timestamp) {
        // incoming update!
        action = updateLocal;

      } else {
        // merge conflict!
        action = util.curry(fireConflict, 'merge');

      }
    }

    if(! action) {
      console.error("NO ACTION DETERMINED!!!", path, local, 'vs', remote);
      var exc = new Error("Something went terribly wrong.");
      exc.path = path;
      exc.localNode = local;
      exc.remoteNode = remote;
      throw exc;
    }

    return action(path, local, remote);
  }

  /**************************************/

  // Function: fetchLocalNode
  //
  // Fetch a local node at given path.
  //
  // Loads a <store.Node> and extends it with the following:
  //   data - data of the node, as received from <store.getNodeData>
  //   deleted - whether this node is considered deleted.
  function fetchLocalNode(path, isDeleted) {
    return store.getNode(path).
      then(function(localNode) {
        logger.info("fetch local", path, localNode);

        if(isForeignPath(path)) {
          // can't modify foreign data locally
          isDeleted = false;
        }

        function yieldNode(node) {
          localNode.deleted = isDeleted;
          return localNode;
        }

        if(typeof(isDeleted) === 'undefined') {
          // in some contexts we don't have the parent present already to check.
          var parentPath = util.containingDir(path);
          var baseName = util.baseName(path);
          if(parentPath) {
            return store.getNode(parentPath).
              then(function(parent) {
                isDeleted = (! parent.data[baseName]) && parent.diff[baseName];
                return yieldNode();
              });
          } else {
            // root node can't be deleted.
            isDeleted = false;
          }
        }
        return yieldNode();
      });
  }

  // Function: fetchRemoteNode
  //
  // Fetch node at given path from remote.
  //
  // Constructs a node like this:
  //   timestamp - last update of the node, if known. Otherwise 0.
  //   data - data of the node received from remote storage, or undefined
  //   deleted - whether remote storage knows this node.
  //   mimeType - MIME type of the node
  //
  function fetchRemoteNode(path, isDeleted) {
    logger.info("fetch remote", path);
    return remoteAdapter.get(path).
      then(function(node) {
        if(! node) {
          node = {};
        }
        if(util.isDir(path) && (! node.data)) {
          node.data = {};
        }
        return node;
      });
  }

  // Section: Trivial helpers

  function isConnected() {
    return remoteAdapter.getState() === 'connected';
  }

  function makeSet(a, b) {
    var o = {};
    var al = a.length, bl = b.length;
    for(var i=0;i<al;i++) { o[a[i]] = true; }
    for(var j=0;j<bl;j++) { o[b[j]] = true; }
    return Object.keys(o);
  }

  var foreignPathRE = /^[^\/][^:]+:\//;
  var ownPathRE = /^\//;

  function isOwnPath(path) {
    return ownPathRE.test(path);
  }

  function isForeignPath(path) {
    return foreignPathRE.test(path);
  }

  function validPath(path, foreignOk) {
    return isOwnPath(path) || (foreignOk ? isForeignPath(path) : false);
  }

  function validatePath(path, foreignOk) {
    if(! validPath(path, foreignOk)) {
      throw new Error("Invalid path: " + path);
    }
  }

  function findRoots() {
    return store.getNode('/').then(function(root) {
      if(root.startAccess) {
        return ['/'];
      } else {
        return store.getNode('/public/').then(function(publicRoot) {
          var paths = [];
          for(var key in root.data) {
            paths.push('/' + key);
          }
          for(var publicKey in publicRoot.data) {
            paths.push('/public/' + publicKey);
          }
          return util.asyncSelect(paths, function(path) {
            return store.getNode(path).then(function(node) {
              return !! node.startAccess;
            });
          });
        });
      }
    }).then(function(roots) {
      return roots;
    });
  }

  function findAccess(path) {
    if(! path) {
      return null;
    } else {
      return store.getNode(path).
        then(function(node) {
          if(node.startAccess) {
            return node.startAccess;
          } else {
            return findAccess(util.containingDir(path));
          }
        });
    }
  }

  function findNextForceRoots(path, cachedNode) {
    var roots = [];
    function checkChildren(node) {
      return util.asyncEach(Object.keys(node.data), function(key) {
        return store.getNode(path + key).then(function(childNode) {
          if(childNode.startForce || childNode.startForceTree) {
            roots.push(path + key);
          } else if(util.isDir(key)) {
            return findNextForceRoots(path + key, childNode).
              then(function(innerRoots) {
                innerRoots.forEach(function(innerRoot) {
                  roots.push(innerRoot);
                });
              });
          }
        });
      }).then(function() {
        return roots;
      });
    }
    return (
      cachedNode ? checkChildren(cachedNode) :
        store.getNode(path).then(checkChildren)
    );
  }

  // Function: traverseTree
  //
  // Traverse the full tree of nodes, passing each visited data node to the callback for processing.
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
    logger.info('traverse', root, opts, 'callback?', !!callback);

    if(! util.isDir(root)) {
      throw "Can't traverse data node: " + root;
    }

    if(! opts) { opts = {}; }

    function determineLocalInterest(node, options) {
      return util.getPromise(function(promise) {
        options.access = util.highestAccess(options.access, node.startAccess);
        options.force = opts.force || node.startForce;
        options.forceTree = opts.forceTree || node.startForceTree;

        function determineForce() {
          var force = (options.force || options.forceTree);
          if((! force) && (options.path == '/' || options.path == '/public/')) {
            findNextForceRoots(options.path).
              then(function(roots) {
                promise.fulfill(node, false, roots);
              });
          } else {
            promise.fulfill(node, force);
          }
        }

        if(! options.access) {
          // in case of a partial sync, we have not been informed about
          // access inherited from the parent.
          findAccess(util.containingDir(root)).
            then(function(access) {
              options.access = access;
            }).then(determineForce);
        } else {
          determineForce();
        }
      });
    }

    function mergeDataNode(path, localNode, remoteNode, options) {
      if(util.isDir(path)) {
        throw new Error("Not a data node: " + path);
      }
      return callback(path, localNode, remoteNode);
    }

    function mergeDirectory(path, localNode, remoteNode, options) {

      var fullListing = makeSet(
        Object.keys(localNode.data),
        Object.keys(remoteNode.data)
      );
      return util.asyncEach(fullListing, function(key) {
        var childPath = path + key;
        var remoteVersion = remoteNode.data[key];
        var localVersion = localNode.data[key];
        logger.debug("traverseTree.mergeDirectory[" + childPath + "]", remoteVersion, 'vs', localVersion);
        if(remoteVersion !== localVersion) {
          if(util.isDir(childPath)) {
            if(options.forceTree && options.depth !== 0) {
              var childOptions = util.extend({}, options);
              if(childOptions.depth) {
                childOptions.depth--;
              }
              return mergeTree(childPath, childOptions);
            }
          } else if(options.force) {
            return util.asyncGroup(
              util.curry(fetchLocalNode, childPath),
              util.curry(fetchRemoteNode, childPath)
            ).then(function(nodes, errors) {
              if(errors.length > 0) {
                logger.error("Failed to sync node", childPath, errors);
                return store.setNodeError(childPath, errors);
              } else {
                return mergeDataNode(childPath, nodes[0], nodes[1], options);
              }
            });
          } else {
            store.touchNode(childPath);
          }
        }
      });
    }

    function mergeTree(path, options) {
      options.path = path;
      return fetchLocalNode(path).
        then(util.rcurry(determineLocalInterest, options)).
        then(function(localNode, localInterest, nextRoots) {
          if(localInterest) {
            return fetchRemoteNode(path).
              then(function(remoteNode) {
                return mergeDirectory(path, localNode, remoteNode, options).
                  then(function() {
                    return store.setLastSynced(path, remoteNode.timestamp);
                  });
              });
          } else if(nextRoots) {
            for(var key in nextRoots) {
              return util.asyncEach(nextRoots, function(root) {
                return mergeTree(root, options);
              });
            }
          }
        });
    }

    return mergeTree(root, opts);
  }

  // Section: Meta helpers

  // Function: makeConflictResolver
  // returns a function that can be called to resolve the conflict
  // at the given path.
  function makeConflictResolver(path, local, remote) {
    return function(solution, newData) {
      if(solution == 'local') {
        // outgoing update!
        if(newData) {
          local.data = newData;
          // a hack to also update local data, when the resolution specifies new data
          updateLocal(path, local, local);
        }
        updateRemote(path, local, remote);
      } else if(solution == 'remote') {
        // incoming update!
        updateLocal(path, local, remote);
      } else {
        throw "Invalid conflict resolution: " + solution;
      }
    };
  }


  events.on('error', function(error) {
    logger.error("Sync Error: ", error);
  });


  var sync = util.extend(events, {

    enable: enable,
    disable: disable,

    getQueue: function() { return taskQueue; },

    updateDataNode: updateDataNode,

    lastSyncAt: null,

    // Section: exported functions

    // Method: on
    // Install an event handler.

    // Method: fullSync
    // <fullSync>
    fullSync: fullSync,

    forceSync: fullSync,
    // Method: fullPush
    // <fullPush>
    fullPush: fullPush,
    // Method: partialSync
    // <partialSync>
    partialSync: partialSync,

    // Method: needsSync
    // Returns true, if there are local changes that have not been synced.
    needsSync: needsSync,

    // Method: getState
    // <getState>
    getState: getState,

    // Method: clearSettings
    // Clear all data from localStorage that this file put there.
    clearSettings: settings.clear,

    // FOR TESTING INTERNALS ONLY!!!
    getInternal: function(symbol) {
      return eval(symbol);
    },

    setRemoteAdapter: function(adapter) {
      remoteAdapter = adapter;
    }

  });

  return sync;

  /*
    Section: Notes

    Some example I made up to visualize some of the situations that can happen.

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

});
