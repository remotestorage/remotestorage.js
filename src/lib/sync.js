define(['./wireClient', './store'], function(wireClient, store) {
  var prefix = '_remoteStorage_', busy=false;
   
  function getState(path) {
    if(busy) {
      return 'busy';
    } else {
      return 'connected';
    }
  }
  function dirMerge(dirPath, remote, cached, diff, force, access, startOne, finishOne) {
    for(var i in remote) {
      if((!cached[i] && !diff[i]) || cached[i] < remote[i]) {//should probably include force and keep in this decision
        pullNode(dirPath+i, force, access, startOne, finishOne);
      }
    }
    for(var i in cached) {
      if(!remote[i]) {
        if(i.substr(-1)!='/') {
          var childNode = store.getNode(dirPath+i);
          startOne();
          wireClient.set(dirPath+i, JSON.stringify(childNode.data), 'application/json', function(err, timestamp) {
            finishOne();
          });
        } else {//recurse
          pullNode(dirPath+i, force, access, startOne, finishOne);
        }
      }
    }
    for(var i in diff) {
      if(remote[i] === cached[i]) {//can either be same timestamp or both undefined
        delete diff[i];
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
            dirMerge(path, data, thisNode.data, thisNode.diff, force, access, startOne, finishOne);
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
  function syncNow(path, cb) {
    var outstanding=0, errors=null;
    function startOne() {
      outstanding++;
    }
    function finishOne(err) {
      if(err) {
        errors = err;
      }
      outstanding--;
      if(outstanding==0) {
        busy=false;
        cb(errors);
      }
    }
    console.log('syncNow '+path);
    busy=true;
    pullNode(path, false, false, startOne, finishOne);
  }
  return {
    syncNow: syncNow,
    getState : getState
  };
});
