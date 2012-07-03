define(['./sync', './store'], function (sync, store) {
  var moduleChangeHandlers = {};
  function extractModuleName(path) {
    if (path && typeof(path) == 'string') {
      var parts = path.split('/');
      if(parts.length > 3 && parts[1] == 'public') {
        return parts[2];
      } else if(parts.length > 2){
        return parts[1];
      }
    }
  }
  function fireChange(moduleName, eventObj) {
    if(moduleName && moduleChangeHandlers[moduleName]) {
      for(var i=0; i<moduleChangeHandlers[moduleName].length; i++) {
        moduleChangeHandlers[moduleName][i](eventObj);
      }
    }
  }
  store.on('change', function(e) {
    var moduleName = extractModuleName(eventObj.path);
    fireChange(moduleName, e);//tab-, device- and cloud-based changes all get fired from the store.
  });
  function set(absPath, valueStr) {
    var  node = store.getNode(absPath);
    node.outgoingChange = true;
    var changeEvent = {
      origin: 'window',
      oldValue: node.data,
      newValue: valueStr,
      path: absPath
    };
    node.data = valueStr;
    var ret = store.updateNode(absPath, node);
    var moduleName = extractModuleName(absPath);
    fireChange(moduleName, changeEvent);
    return ret; 
  }
  function claimAccess(path, claim) {
    var node = store.getNode(path);
    if((claim != node.access) && (claim == 'rw' || node.access == null)) {
      node.access = claim;
      store.updateNode(path, node);
      for(var i in node.children) {
        claimAccess(path+i, claim);
      }
    }
  }
  function isDir(path) {
    if(typeof(path) != 'string') {
      doSomething();
    }
    return (path.substr(-1)=='/');
  }
  return {
    claimAccess: claimAccess,
    getInstance : function(moduleName, public) {
      function makePath(path) {
        return (public?'/public/':'/')+moduleName+'/'+path;
      }
      return {
        on          : function(eventType, cb) {//'error' or 'change'. Change events have a path and origin (tab, device, cloud) field
          if(eventType=='change') {
            if(moduleName) {
              if(!moduleChangeHandlers[moduleName]) {
                moduleChangeHandlers[moduleName]=[];
              }
              moduleChangeHandlers[moduleName].push(cb);
            }
          }
        },
        getObject    : function(path, cb) {
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err) {
              var node = store.getNode(absPath);
              cb(node.data);
            });
          } else {
            var node = store.getNode(absPath);
            return node.data;
          }
        },
        getListing    : function(path, cb) {
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err) {
              var node = store.getNode(absPath);
              var arr = [];
              for(var i in node.data) {
                arr.push(i);
              }
              cb(arr);
            });
          } else {
            var node = store.getNode(absPath);
              var arr = [];
              for(var i in node.data) {
                arr.push(i);
              }
            return arr;
          }
        },
        getMedia    : function(path, cb) {
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err) {
              var node = store.getNode(absPath);
              cb({
                mimeType: node.mimeType,
                data: node.data
              });
            });
          } else {
            var node = store.getNode(absPath);
            return {
              mimeType: node.mimeType,
              data: node.data
            };
          }
        },
        remove      : function(path) {
          return set(makePath(path));
        },
        
        storeObject : function(type, path, obj) {
          obj['@type'] = 'https://remotestoragejs.com/spec/modules/'+moduleName+'/'+type;
          //checkFields(obj);
          return set(makePath(path), obj, 'application/json');
        },
        storeMedia  : function(mimeType, path, data) {
          return set(makePath(path), data, mimeType);
        },
        getCurrentWebRoot : function() {
          return 'https://example.com/this/is/an/example/'+(public?'public/':'')+moduleName+'/';
        },
        sync        : function(path, switchVal) {
          var absPath = makePath(path);
          var node = store.getNode(absPath);
          node.startForcing = (switchVal != false);
          store.updateNode(absPath, node);
        },
        getState    : function(path) {
        }
      };
    }
  };
});
