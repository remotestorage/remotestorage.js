/* -*- js-indent-level:2 -*- */

define(['./sync', './store'], function (sync, store) {
  var moduleChangeHandlers = {};

  function bindContext(callback, context) {
    if(context) {
      return function() { return callback.apply(context, arguments); };
    } else {
      return callback;
    }
  }

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
  function fireError(str) {
    console.log(str);
  }
  store.on('change', function(e) {
    var moduleName = extractModuleName(eventObj.path);
    fireChange(moduleName, e);//tab-, device- and cloud-based changes all get fired from the store.
  });
  

  function set(path, absPath, valueStr) {
    if(isDir(absPath)) {
      fireError('attempt to set a value to a directory '+absPath);
      return;
    }
    var  node = store.getNode(absPath);
    var changeEvent = {
      origin: 'window',
      oldValue: node.data,
      newValue: valueStr,
      path: path
    };
    var ret = store.setNodeData(absPath, valueStr, true);
    var moduleName = extractModuleName(absPath);
    fireChange(moduleName, changeEvent);
    return ret; 
  }

  function claimAccess(path, claim) {
    store.setNodeAccess(path, claim);
  }

  function isDir(path) {
    if(typeof(path) != 'string') {
      doSomething();
    }
    return (path.substr(-1)=='/');
  }

  return {
    claimAccess: claimAccess,
    getInstance: function(moduleName, isPublic) {
      function makePath(path) {
        if(moduleName == 'root') {
          return path;
        }
        return (isPublic?'/public/':'/')+moduleName+'/'+path;
      }

      return {

        // helpers for implementations
        h: {
          bindContext: bindContext
        },

        on: function(eventType, cb, context) {//'error' or 'change'. Change events have a path and origin (tab, device, cloud) field
          if(eventType=='change') {
            if(moduleName) {
              if(!moduleChangeHandlers[moduleName]) {
                moduleChangeHandlers[moduleName]=[];
              }
              moduleChangeHandlers[moduleName].push(bindContext(cb, context));
            }
          }
        },

        getObject: function(path, cb, context) {
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err) {
              var node = store.getNode(absPath);
              bindContext(cb, context)(node.data);
            });
          } else {
            var node = store.getNode(absPath);
            return node.data;
          }
        },

        getListing: function(path, cb, context) {
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err) {
              var node = store.getNode(absPath);
              var arr = [];
              for(var i in node.data) {
                if(!node.removed[i]) {
                  arr.push(i);
                }
              }
              for(var i in node.added) {
                arr.push(i);
              }
              //no need to look at node.changed, that doesn't change the listing
              bindContext(cb, context)(arr);
            });
          } else {
            var node = store.getNode(absPath);
            var arr = [];
            for(var i in node.data) {
              if(!node.removed[i]) {
                arr.push(i);
              }
            }
            for(var i in node.added) {
              arr.push(i);
            }
            return arr;
          }
        },

        getMedia: function(path, cb, context) {
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err) {
              var node = store.getNode(absPath);
              bindContext(cb, context)({
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

        remove: function(path) {
          return set(path, makePath(path));
        },
        
        storeObject: function(type, path, obj) {
          obj['@type'] = 'https://remotestoragejs.com/spec/modules/'+moduleName+'/'+type;
          //checkFields(obj);
          return set(path, makePath(path), obj, 'application/json');
        },

        storeMedia: function(mimeType, path, data) {
          return set(path, makePath(path), data, mimeType);
        },

        getCurrentWebRoot: function() {
          return 'https://example.com/this/is/an/example/'+(isPublic?'public/':'')+moduleName+'/';
        },

        sync: function(path, switchVal) {
          var absPath = makePath(path);
          store.setNodeForce(absPath, (switchVal != false));
        },

        getState: function(path) {
        }
      };
    }
  };
});
