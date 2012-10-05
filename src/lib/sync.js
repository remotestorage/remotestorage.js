define(['./wireClient', './store', './util'], function(wireClient, store, util) {

  "use strict";

  // Namespace: sync
  //
  // Sync is where all the magic happens. It connects the <store> and <wireClient>
  //

  var sync; // set below.

  var prefix = '_remoteStorage_', busy=false, stateCbs=[], syncOkNow=true;

  var logger = util.getLogger('sync');

  function getState(path) {//should also distinguish between synced and locally modified for the path probably
    if(busy) {
      return 'busy';
    } else {
      return 'connected';
    }
  }
  function setBusy(val) {
    busy=val;
    for(var i=0;i<stateCbs.length;i++) {
      stateCbs[i](val?'busy':'connected');
    }

    if(! val) {
    }
  }
  function on(eventType, cb) {
    if(eventType=='state') {
      stateCbs.push(cb);
    }
  }
  function dirMerge(dirPath, remote, cached, diff, force, access, startOne, finishOne, clearCb) {
    for(var i in remote) {
      if((!cached[i] && !diff[i]) || cached[i] < remote[i]) {//should probably include force and keep in this decision
        pullNode(dirPath+i, force, access, startOne, finishOne);
      }
    }
    for(var i in cached) {
      if(!remote[i] || cached[i] > remote[i]) {
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
            if(err) {
              logger.error('wireclient said error', err);
            }
            finishOne(err);
          });
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
    console.log("findForce", path, node);
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

  function hasDiff(parentPath, path) {
    var parent = store.getNode(parentPath),
        fname = getFileName(path);
    return !! parent.diff[fname];
  }

  function pushNode(path, finishOne) {
    logger.debug('pushNode', path);
    var parentPath = util.containingDir(path);
    if(hasDiff(parentPath, path)) {
      logger.debug('pushNode!', path);
      var data = store.getNodeData(path);
      var node = store.getNode(path);
      wireClient.set(path, data, node.mimeType, function(err) {
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
    logger.debug('pullNode "'+path+'"', thisNode);

    if(thisNode.startAccess == 'rw' || !access) {
      force = thisNode.startAccess;
    }

    if(! force) {
      force = findForce(path, thisNode);
    }
    
    startOne();

    if(force || access) {
      wireClient.get(path, function(err, data) {
        console.log("WIRE CLIENT SAID ERR", err);
        if(!err && data) {
          if(isDir) {
            dirMerge(path, data, thisData, thisNode.diff, force, access, startOne, finishOne, function(i) {
              store.clearDiff(path, i);
            });
          } else {
            store.setNodeData(path, data, false);
          }
        } else {
          if(isDir) {
            for(var key in thisData) {
              startOne();
              pushNode(path + key, finishOne);
            }
          } else {
            pushNode(path, finishOne);
          }
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

  function syncNow(path, callback) {

    if(! path) {
      throw "path is required";
    }

    if(! syncOkNow) {
      return callback(null);
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
          console.log('syncNow done');
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
    on: on
  };

  return sync;

});
