define(['./wireClient', './store', './util'], function(wireClient, store, util) {

  /*

    Legend:
     L - has local modifications
     R - has remote modifications
     D - modification is a delete

    Suppose a tree like this:

       /
       /messages/
       /messages/pool/
       /messages/pool/1
       /messages/pool/2
    L  /messages/pool/3
    R  /messages/pool/4
       /messages/index/read/true/1
    L  /messages/index/read/true/3
       /messages/index/read/false/2
    LD /messages/index/read/false/3
    R  /messages/index/read/false/4


    Now a sync cycle for /messages/ begins:

    GET /messages/
      -> mark remote diff for pool/ and index/
    GET /messages/index/
      -> mark local and remote diff for read/
    GET /messages/index/read/
      -> mark remote diff for false/
    GET /messages/index/read/false/
      -> mark remote diff for 4
    DELETE /messages/index/read/false/3
      -> clear local diff for 3
    GET /messages/index/read/false/4
      -> update local node 4
      -> clear remote diff for 4
      (pop back to /messages/index/read/)
      -> clear remote and local diff for false/
    GET /messages/index/read/true/
    PUT /messages/index/read/true/3
      -> clear local diff for 3
      (pop back to /messages/index/read/)
      -> clear local diff for true/)
      (pop back to /messages/index/)
      -> clear local and remote diff for read/
      (pop back to /messages/)
    GET /messages/pool/
      -> mark remote diff for 4
    PUT /messages/pool/3
      -> clear local diff for 3
    GET /messages/pool/4
      -> update local node 4
      -> clear remote diff for 4
      (pop back to /messages/)
      -> clear local and remote diff for pool/
      (pop back to /)
      -> clear local and remote diff for messages/

    Sync cycle all done.
   */

  function markPullFailed(path, reason) {
    store.setNodeError(path, {
      action: 'pull',
      timestamp: new Date().getTime(),
      reason: reason
    });
  }

  function markPushFailed(path, reason) {
    store.setNodeError(path, {
      action: 'push',
      timestamp: new Date().getTime(),
      reason: reason
    });
  }

  function clearError(path) {
    store.setNodeError(path, null);
  }

  function markRemoteTime(path, timestamp) {
    var node = store.getNode(path);
    if(node.timestamp < timestamp) {
      store.expireNode(path, timestamp);
    }
  }

  // Property: timestampCache
  //
  // A map of the form { <path> : <timestamp> } to keep track of timestamps seen
  // in directory listings.
  var timestampCache = {};

  /** PUSH **/

  function recursivePush(path, callback) {
    var errors = [];
    var node = store.getNode(path);
    var diffKeys = Object.keys(node.diff);

    function pushNext() {
      var key = diffKeys.shift();
      push(path + key, function(err) {
        if(err) {
          for(var i=0;i<err.length;i++) {
            errors.push(err[i]);
          }
        }
        pushNext();
      });
    }

    pushNext();
  }

  function pushOne(path, callback) {
    var rawData = store.getNodeData(path, true);

    wireClient.set(path, rawData, function(err) {
      if(err) {
        markPushFailed(path, err);
        callback([path + ': ' + err]);
      } else {
        clearError(path);
        clearDiff(path);
        callback(null);
      }
    });
  }

  // Push a single node.
  // Travels *down* the path, so pushing a directory node will push all it's
  // children.
  function push(path, callback) {

    if(util.isDir(path)) {
      recursivePush(path, callback);
    } else {
      pushOne(path, callback);
    }

  }

  /** PULL **/

  // Pull a single node and update the store.
  function pullOne(path, callback) {
    var errors = [];
    wireClient.get(path, function(err, data, mimeType) {
      if(err) {
        markPullFailed(path, err);
        errors.push(path + ': ' + err);
      } else if(! data) {
        // incoming delete
        store.removeNode(path);
      } else {
        // incoming update
        var t = timestampCache[path];
        if(! t) {
          errors.push("unexpected pull result for " +
                      path + ", no timestamp in cache");
        } else {
          clearError(path);
          delete timestampCache[path];
          store.setNodeData(path, data, false, t, mimeType);
          if(util.isDir(path)) {
            var listing = store.getNodeData(path);
            for(var key in listing) {
              timestampCache[path + key] = listing[key];
            }
          }
        }
      }
      callback(errors.length > 0 ? errors : null);
    });
  }

  // Pull a single node.
  // Travels *up* the path, so pulling a node will pull all it's parents to
  // update their timestamps, but not their children.
  function pull(path, callback) {
    var queue = util.pathParts(path);
    var p = '';

    function pullNext() {
      p += queue.shift();
      pullOne(p, function(err) {
        if(err) {
          callback(err);
        } else if(queue.length > 0) {
          pullNext();
        } else {
          callback(null);
        }
      });
    }

    pullNext();
  }

  function isExpired(path) {
    var node = store.getNode(path);
    return node.expired;
  }

  // only pull given node, if it has remote updates.
  function maybePull(path, callback) {
    if(isExpired(path)) {
      pull(path, callback);
    } else {
      callback(null);
    }
  }

  // only pull given tree, if it has remote updates.
  function maybePullTree(path, callback, force) {
    if(isExpired(path)) {
      pullTree(path, callback, force);
    } else {
      callback(null);
    }
  }

  // Pull a directory node and all it's (directory) children recursively.
  // This will only pull data nodes that are marked with 'force' or are below
  // a directory, which is marked with 'force'.
  // For all other data nodes, remote updates will cause local expiration.
  //
  function pullTree(path, callback, force) {
    var errors = [];

    if(! util.isDir(path)) {
      throw "pullTree: Expected directory node, got: " + path;
    }
    pull(path, function(err) {
      if(err) {
        callback(err);
      } else {
        var node = store.getNode(path);
        if(node.startForce) {
          force = node.startForce;
        }
        var listing = store.getNodeData(path);
        var todos = [];
        for(var key in listing) {
          var p = path + key;
          markRemoteTime(p, listing[key]);
          if(util.isDir(p) || force) {
            todos.push(p);
          }
        }

        function pullNext() {
          var next = todos.shift();
          if(next) {
            if(util.isDir(next)) {
              maybePullTree(next, function(err) {
                if(err) {
                  errors.push(err);
                }
                pullNext();
              }, force);
            } else { // forced pull (if remote has updates)
              maybePull(next, function(err) {
                if(err) {
                  errors.push(err);
                }
                pullNext();
              });
            }
          } else { // todos is empty, all done.
            callback(errors.length > 0 ? errors : null);
          }
        }

        pullNext();
      }
    });
  }

  /** SYNC **/

  function syncTree(startPath, startNode, callback) {
    if(startNode.startAccess == 'r') {
      // read-only access is the easiest to handle. Just pull recursively.
      pullTree(startPath, callback);
    } else {
      // combination of push & pull, based on remote / local updates.
      pullTree(startPath, callback); // FIXME
    }
  }

  // Start a full sync.
  //
  // Starts at the root node and pushes all it's 
  function syncFull(callback) {
    var root = store.getNode('/');

    // sync either starts on the root (root scope requested), or on one or more
    // of it's children (one or more regular scopes requested).

    if(root.startAccess) {
      syncTree('/', root, callback);
    } else {
      var rootData = store.getNodeData('/');
      var errors = [];
      var todos = [];

      for(var key in rootData) {
        var path = '/' + key;
        var child = store.getNode(path);
        if(child.startAccess) {
          todos.push(child);
        }
      }

      function syncNext() {
        var path = todos.shift();

        syncTree(path, child, function(err) {
          if(err) {
            errors.push(err);
          }

          if(todos.length > 0) {
            syncNext();
          } else {
            callback(errors.length > 0 ? errors : null);
          }
        });
      }

      syncNext();
    }
  }

  return {

    pullOne: pullOne,
    pushOne: pushOne,

    // hack to make the spec work.
    _timestampCache: timestampCache

  };

});

