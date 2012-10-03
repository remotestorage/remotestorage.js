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
          wireClient.set(dirPath+i, childData, 'application/json', function(err) {
            finishOne();
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
      } else if(remote[i] === cached[i]) {//can either be same timestamp or both undefined
        clearCb(i);
      }
    }
  }

  function findForce(path, node) {
    console.log("findForce", path, node);
    if(! node) {
      return null;
    } else if(! node.startForce) {
      var parentPath = util.containingDir(path);
      if(parentPath == path) {
        return false;
      } else {
        return findForce(parentPath, store.getNode(parentPath));
      }
    } else {
      return node.startForce;
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
        if(!err && data) {
          if(isDir) {
            dirMerge(path, data, thisData, thisNode.diff, force, access, startOne, finishOne, function(i) {
              store.clearDiff(path, i);
            });
          } else {
            store.setNodeData(path, data, false);
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
