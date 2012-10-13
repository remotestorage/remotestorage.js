define(['./wireClient', './store', './util'], function(wireClient, store, util) {

  "use strict";

  // Namespace: sync
  //
  // Sync is where all the magic happens. It connects the <store> and <wireClient>
  //

  var sync; // set below.

  var prefix = '_remoteStorage_', busy=false, syncOkNow=true;

  var logger = util.getLogger('sync');
  var events = util.getEventEmitter('state');

  function getState(path) {//should also distinguish between synced and locally modified for the path probably
    if(busy) {
      return 'busy';
    } else {
      return 'connected';
    }
  }
  function setBusy(val) {
    busy=val;

    events.emit('state', val ? 'busy' : 'connected');
  }

  var syncTimestamps = {};

  function dirMerge(dirPath, remote, cached, diff, force, access, startOne, finishOne, clearCb) {
    for(var i in remote) {
      if((!cached[i] && !diff[i]) || cached[i] < remote[i]) {//should probably include force and keep in this decision
        if(! util.isDir(dirPath + i)) {
          syncTimestamps[dirPath + i] = remote[i];
        }
        pullNode(dirPath+i, force, access, startOne, finishOne);
      }
    }
    for(var i in cached) {
      if(!remote[i] && !diff[i]) { // incoming delete
        store.removeNode(dirPath + i);
      } else if(!remote[i] || cached[i] > remote[i]) {
        if(util.isDir(i)) {
          pullNode(dirPath+i, force, access, startOne, finishOne);
        } else {//recurse
          var childNode = store.getNode(dirPath+i);
          var childData = store.getNodeData(dirPath + i);
          startOne();
          if(typeof(childData) === 'object') {
            childData = JSON.stringify(childData);
          }
          wireClient.set(dirPath+i, childData, childNode.mimeType, function(err) {
            logger.info('PUT', dirPath + i, 'error: ', err, 'MIME type: ', childNode.mimeType);
            if(err) {
              logger.error('wireclient said error', err);
            }
            finishOne(err);
          });
        }
      } else if(remote[i]) {
        if(! util.isDir(dirPath + i)) {
          syncTimestamps[dirPath + i] = remote[i];
        }
      }
    }
    for(var i in diff) {
      if(!cached[i]) {//outgoing delete
        if(remote[i]) {
          startOne();
          wireClient.set(dirPath+i, undefined, undefined, function(err) {
            finishOne();
          });
        } else {
          clearCb(i);
        }
      } else {
        clearCb(i);
      }
    }
  }

  function getFileName(path) {
    var parts = path.split('/');
    if(util.isDir(path)) {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

  function findForce(path, node) {
    if(! node) {
      return null;
    } else if(! node.startForce) {
      var parentPath = util.containingDir(path);
      if((!path) || (parentPath == path)) {
        return false;
      } else if(parentPath) {
        return findForce(parentPath, store.getNode(parentPath));
      }
    } else {
      return node.startForce;
    }
  }

  function hasDiff(parentPath, fname) {
    var parent = store.getNode(parentPath);
    return !! parent.diff[fname];
  }

  function pushNode(path, startOne, finishOne) {
    if(util.isDir(path)) {
      var dirNode = store.getNode(path);
      dirMerge(path, store.getNodeData(path), dirNode.diff, false, false, startOne, finishOne, function(i) { store.clearDiff(path, i); });
    }
    logger.debug('pushNode', path);
    var parentPath = util.containingDir(path);
    var fname = getFileName(path)
    if(hasDiff(parentPath, fname)) {
      logger.debug('pushNode!', path);
      var data = store.getNodeData(path, true);
      var node = store.getNode(path);
      if(! data) {
        logger.error("ATTEMPTED TO PUSH EMPTY DATA", node, data);
        return;
      }
      wireClient.set(path, data, node.mimeType, function(err) {
        logger.info('PUT', path, 'error: ', err, 'MIME type: ', node.mimeType);
        logger.debug("wire client set result", arguments);
        if(! err) {
          store.clearDiff(parentPath, fname);
        } else {
          logger.error('pushNode', err);
        }
        finishOne(err);
      });
    }
  }

  function pullNode(path, force, access, startOne, finishOne) {
    var thisNode = store.getNode(path);
    var thisData = store.getNodeData(path);
    var isDir = util.isDir(path);
    if((! thisData) && isDir) {
      thisData = {};
    }

    if(thisNode.startAccess == 'rw' || !access) {
      force = thisNode.startAccess;
    }

    if(! force) {
      force = findForce(path, thisNode);
    }
    
    startOne();

    if(force || access) {
      wireClient.get(path, function(err, data, mimeType) {
        logger.info('GET', path, 'error: ', err, 'MIME type: ', mimeType);
        if(!err && data) {
          if(isDir) {
            dirMerge(path, data, thisData, thisNode.diff, force, access, startOne, finishOne, function(i) {
              store.clearDiff(path, i);
            });
          } else {
            var t = syncTimestamps[path];
            delete syncTimestamps[path];
            store.setNodeData(path, data, false, t, mimeType);
          }
        } else {
          pushNode(path, startOne, finishOne);
        }
        
        finishOne(err);
        
      });

      return;

    } else if(thisData && isDir) {
      for(var i in thisData) {
        if(util.isDir(i)) {
          pullNode(path+i, force, access, startOne, finishOne);
        }
      }
    }

    // this is an edge case, reached when all of the following are true:
    // * this is NOT a directory node
    // * neither this node nor any of it's parent have startForce set
    // * this node doesn't have it's startAccess flag set
    // * neither 'force' nor 'access' are forced by this pullNode call
    finishOne();

  }

  // TODO: DRY those two:

  function fetchNow(path, callback) {
    var outstanding = 0, errors=[];
    function startOne() {
      outstanding++;
    }
    function finishOne(err) {
      if(err) {
        errors.push(err);
      }
      outstanding--;
      if(outstanding == 0) {
        setBusy(false);
        callback(errors || null, store.getNode(path));
      }
    }
    setBusy(true);
    pullNode(path, false, true, startOne, finishOne)
  }

  var deferredSyncTimer = null, deferredPaths = [];

  function deferSync(path) {
    if(deferredSyncTimer) {
      clearTimeout(deferredSyncTimer);
    }
    if(deferredPaths.indexOf(path) == -1) {
      deferredPaths.push(path);
    }
    deferredSyncTimer = setTimeout(function() {
      deferredSyncTimer = null;
      var path;
      while(path = deferredPaths.shift()) {
        syncNow(path, null, true);
      }
    }, sync.minPollInterval);
  }

  function syncNow(path, callback, force) {

    if(! path) {
      throw "path is required";
    }

    if((! syncOkNow) && (! force) || busy) {
      deferSync(path);
      if(callback) {
        callback(null);
      }
      return;
    }

    if(wireClient.getState() == 'anonymous') {
      if(callback) {
        callback(['not connected']);
      }
      return;
    }

    var outstanding=0, errors=[];
    function startOne() {
      outstanding++;
    }
    function finishOne(err) {
      if(err) {
        errors.push(path);
      }
      outstanding--;
      if(outstanding==0) {
        setBusy(false);
        setTimeout(function() {
          syncOkNow = true;
        }, sync.minPollInterval);
        if(callback) {
          callback(errors.length > 0 ? errors : null);
        } else {
          logger.info('syncNow done');
        }
      }
    }
    logger.info('syncNow '+path);
    setBusy(true);
    syncOkNow = false;
    pullNode(path, false, false, startOne, finishOne);
  }

  sync = {
    // Property: minPollInterval
    // Minimal interval between syncNow calls.
    // All calls that happen in between, immediately succeed
    // (call their callbacks) without doing anything.
    minPollInterval: 3000,
    syncNow: syncNow,
    fetchNow: fetchNow,
    getState : getState,
    on: events.on,

    sleep: function() { syncOkNow = false; },
    wakeup: function() { syncOkNow = true; }

  };

  return sync;

});
