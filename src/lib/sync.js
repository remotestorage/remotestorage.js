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
  function dirMerge(dirPath, remote, cached, diff, force, access, startOne, finishOne) {
    for(var i in remote) {
      if((!cached[i] && !diff[i]) || cached[i] < remote[i]) {
        pullNode(dirPath+i, force, access, startOne, finishOne);
      }
    }
    for(var i in cached) {
      if(!remote[i]) {
        pushNode(dirPath+i, startOne, finishOne);
      }
    }
    for(var i in diff) {
      if(remote[i] === cached[i]) {//can either be same timestamp or both undefined
        delete diff[i];
      }
    }
  }
  function pullNode(path, force, access, cb) {
    console.log('pullNode '+path);
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
    var thisNode=store.getNode(path);
    startOne();
    tryRead(thisNode, function(err, data) {
      if(!err && data) {
        if(path.substr(-1)=='/') {
          dirMerge(path, data, thisNode.data, thisNode.diff, startOne, finishOne);
        } else {
          store.setNodeData(path, data, false);
        }
      }
      finishOne();
    });
  }
  function syncNow(path, cb) {
    console.log('syncNow '+path);
    busy=true;
    var map={};
    map[path]= Infinity;
    pullNode('', false, false, function(err) {
      busy=false;
      cb((err===null));
    });
  }
  return {
    syncNow: syncNow,
    getState : getState
  };
});
