// access: null
// lastModified: 0
// keep: true
// children
//   tasks/: 999999
//   public/: 999999
// data
//   

//start: store has a tree with three types of node: dir, object, media.
//object and media nodes have fields:
//lastModified, type (media/object), mimeType/objectType, data, access, outgoingChange (client-side timestamp or false), sync
//dir nodes have fields:
//lastModified, type (dir), children (hash filename -> remote timestamp), added/changed/removed, access, startSync, stopSync

define(['./wireClient', './store'], function(wireClient, store) {
  var prefix = '_remoteStorage_', busy=false;
   
  function getState(path) {
    if(busy) {
      return 'busy';
    } else {
      return 'connected';
    }
  }
  function handleChild(path, lastModified, force, access, startOne, finishOne) {
    console.log('handleChild '+path);
    var node = store.getNode(path);//will return a fake dir with empty children list for item
    if(node.outgoingChange) {
      //TODO: deal with media; they don't need stringifying, but have a mime type that needs setting in a header
      startOne();
      wireClient.set(path, JSON.stringify(node.data), function(err, timestamp) {
        if(!err) {
          store.clearOutgoingChange(path, timestamp);
        }
        finishOne();
      });
    } else if(node.lastModified<lastModified) {
      if(node.startAccess !== null) { access = node.startAccess; }
      if(node.startForce !== null) { force = node.startForce; }
      if((force || node.keep) && access) {
        startOne();
        wireClient.get(path, function (err, data) {
          if(data) {
            store.setNodeData(path, data, false);
          }
          finishOne(err);
          startOne();
          pullMap(path, store.getNode(path).children, force, access, finishOne);
          startOne();
          pullMap(path, store.getNode(path).added, force, access, finishOne);
        });
      } else {
        //store.forget(path);
        startOne();
        pullMap(path, node.children, force, access, finishOne);
        startOne();
        pullMap(path, node.added, force, access, finishOne);
      }
    }// else everything up to date
  }
  function pullMap(basePath, map, force, access, cb) {
    console.log('pullMap '+basePath);
    var outstanding=0, errors=false;
    function startOne() {
      outstanding++;
    }
    function finishOne(err) {
      if(err) {
        errors = true;
      }
      outstanding--;
      if(outstanding==0) {
        cb(errors);
      }
    }
    startOne();
    for(var path in map) {
      handleChild(basePath+path, map[path], force, access, startOne, finishOne);
    }
    finishOne();
  }
  function syncNow(path, cb) {
    busy=true;
    var map={};
    map[path]= Infinity;
    pullMap('', map, false, false, function() {
      busy=false;
      cb();
    });
  }
  return {
    syncNow: syncNow,
    getState : getState
  };
});
