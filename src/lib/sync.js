// access: null
// lastModified: 0
// keep: true
// data
//   tasks/: 999999
//   public/: 999999
// data
//   

//start: store has a tree with three types of node: dir, object, media.
//object and media nodes have fields:
//lastModified, type (media/object), mimeType/objectType, data, access, outgoingChange (client-side timestamp or false), sync
//dir nodes have fields:
//lastModified, type (dir), data (hash filename -> remote timestamp), added/changed/removed, access, startSync, stopSync

define(['./wireClient', './store'], function(wireClient, store) {
  var prefix = '_remoteStorage_', busy=false;
   
  function getState(path) {
    if(busy) {
      return 'busy';
    } else {
      return 'connected';
    }
  }
  function tryRead(node, force, access, cb) {
    if(access) {
      wireClient.get(node.path, cb);
    } else {
      cb(null, node.data);
    }
  }
  function dirMerge(dirPath, remote, cached, diff, force, access, startOne, finishOne) {
    for(var i in remote) {
      if((!cached[i] && !diff[i]) || cached[i] < remote[i]) {
        pullNode(dirPath+i, force, access, startOne, finishOne);
      }
    }
    for(var i in cached) {
      if(!remote[i]) {
        var childNode = store.getNode(dirPath+i);
        startOne();
        wireClient.set(dirPath+i, childNode.data, function(err, timestamp) {
          finishOne();
        });
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
    startOne();
    if(access) {
      wireClient.get(path, function(err, data) {
        if(!err && data) {
          if(path.substr(-1)=='/') {
            dirMerge(path, data, thisNode.data, thisNode.diff, startOne, finishOne);
          } else {
            store.setNodeData(path, data, false);
          }
        }
        finishOne();
      });
    } else {
      for(var i in thisNode.data) {
        pullNode(path+i, force, access, startOne, finishOne);
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
        cb(errors);
      }
    }
    console.log('syncNow '+path);
    busy=true;
    var map={};
    map[path]= Infinity;
    pullNode('', false, false, startOne, finishOne);
  }
  return {
    syncNow: syncNow,
    getState : getState
  };
});
