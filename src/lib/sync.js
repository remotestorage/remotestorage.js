define(['./wireClient', './store'], function(wireClient, store) {
  var prefix = '_remoteStorage_', busy=false, stateCbs=[];
   
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
        if(i.substr(-1)=='/') {
          pullNode(dirPath+i, force, access, startOne, finishOne);
        } else {//recurse
          var childNode = store.getNode(dirPath+i);
          startOne();
          wireClient.set(dirPath+i, JSON.stringify(childNode.data), 'application/json', function(err, timestamp) {
            finishOne();
          });
        }
      }
    }
    for(var i in diff) {
      if(!cached[i]) {//outgoing delete
        if(remote[i]) {
          startOne();
          wireClient.set(dirPath+i, undefined, undefined, function(err, timestamp) {
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
  function pullNode(path, force, access, startOne, finishOne) {
    console.log('pullNode '+path);
    var thisNode=store.getNode(path);
    if(thisNode.startAccess == 'rw' || !access) {
      access = thisNode.startAccess;
    }
    if(thisNode.startForce) {
      force = thisNode.startForce;
    }
    if(access) {
      startOne();
      wireClient.get(path, function(err, data) {
        if(!err && data) {
          if(path.substr(-1)=='/') {
            dirMerge(path, data, thisNode.data, thisNode.diff, force, access, startOne, finishOne, function(i) {
              store.clearDiff(path, i);
            });
          } else {
            store.setNodeData(path, data, false);
          }
        }
        finishOne();
      });
    } else {
      for(var i in thisNode.data) {
        if(i.substr(-1)=='/') {
          pullNode(path+i, force, access, startOne, finishOne);
        }
      }
    }
  }
  function syncNow(path) {
    var outstanding=0, errors=null;
    function startOne() {
      outstanding++;
    }
    function finishOne(err) {
      if(err) {
        //TODO: do something with them :)
      }
      outstanding--;
      if(outstanding==0) {
        setBusy(false);
      }
    }
    console.log('syncNow '+path);
    setBusy(true);
    pullNode(path, false, false, startOne, finishOne);
  }
  return {
    syncNow: syncNow,
    getState : getState,
    on: on
  };
});
