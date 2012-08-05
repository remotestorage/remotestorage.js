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
  function getParentChain(path) {//this is for legacy support
    var pathParts = path.split('/');
    var parentChain={};
    for(var i = 2; i<pathParts.length; i++) {
      var thisPath = pathParts.slice(0, i).join('/');
      parentChain[thisPath] = store.getNode(thisPath).data;
    }
    return parentChain;
  }
  function handleChild(path, lastModified, force, access, startOne, finishOne) {
    console.log('handleChild '+path);
    var node = store.getNode(path);//will return a fake dir with empty data list for item
    if(node.outgoingChange) {
      if(node.startAccess !== null) { access = node.startAccess; }
      if(access=='rw') {
        (function(path) {
          //TODO: deal with media; they don't need stringifying, but have a mime type that needs setting in a header
          startOne();
          var parentChain = getParentChain(path);
          console.log('set-call handleChild '+path);
          wireClient.set(path, JSON.stringify(node.data), node.mimeType, parentChain, function(err, timestamp) {
            console.log('set-cb handleChild '+path);
            if(!err && timestamp) {
              store.clearOutgoingChange(path, timestamp);
            }
            finishOne();
          });
        })(path);
      }
    } else if(node.lastModified<lastModified || !lastModified) {//i think there must a cleaner way than this ugly using 0 where no access
      if(node.startAccess !== null) { access = node.startAccess; }
      if(node.startForce !== null) { force = node.startForce; }
      if((force || node.keep) && access) {
        (function(path) {
          startOne();
          console.log('get-call handleChild '+path);
          wireClient.get(path, function (err, data, timestamp, mimeType) {
            console.log('get-cb handleChild '+path);
            if(!err && data && path.substr(-1)!='/') {//directory listings will get updated in store only when the actual objects come in
              store.setNodeData(path, data, false, timestamp, mimeType);
            }
            finishOne(err);
            if(path.substr(-1)=='/') {//isDir(path)
              var thisNode = store.getNode(path), map;
              map = thisNode.data;
              for(var i in thisNode.added) {
                map[i] = thisNode.added[i];
              }
              startOne();
              pullMap(path, map, force, access, finishOne);
            }
          });
        })(path);
      } else if(path.substr(-1)=='/') {//isDir(path)
        //store.forget(path);
        var thisNode = store.getNode(path), map;
        map = thisNode.data;
        for(var i in thisNode.added) {
          map[i] = thisNode.added[i];
        }
        startOne();
        pullMap(path, map, force, access, finishOne);
      }
    }// else everything up to date
  }
  function pullMap(basePath, map, force, access, cb) {
    console.log('pullMap '+basePath);
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
    startOne();
    for(var path in map) {
      console.log('pullMap '+basePath+' calling handleChild for '+path);
      (function(path) {
        handleChild(basePath+path, map[path], force, access, startOne, finishOne);
      })(path);
    }
    finishOne();
  }
  function syncNow(path, cb) {
    console.log('syncNow '+path);
    busy=true;
    var map={};
    map[path]= Infinity;
    pullMap('', map, false, false, function(err) {
      busy=false;
      cb((err===null));
    });
  }
  return {
    syncNow: syncNow,
    getState : getState
  };
});
