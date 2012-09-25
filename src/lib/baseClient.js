/* -*- js-indent-level:2 -*- */

define(['./sync', './store', './util'], function (sync, store, util) {
  var moduleChangeHandlers = {}, errorHandlers = [];

  var logger = util.getLogger('baseClient');

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
    for(var i=0;i<errorHandlers.length;i++) {
      errorHandlers[i](str);
    }
  }
  store.on('change', function(e) {
    var moduleName = extractModuleName(e.path);
    fireChange(moduleName, e);//tab-, device- and cloud-based changes all get fired from the store.
    fireChange('root', e);//root module gets everything
  });


  function set(path, absPath, valueStr) {
    if(isDir(absPath)) {
      fireError('attempt to set a value to a directory '+absPath);
      return;
    }
    var  node = store.getNode(absPath);
    var changeEvent = {
      origin: 'window',
      oldValue: store.getNodeData(node),
      newValue: valueStr,
      path: path
    };
    var ret = store.setNodeData(absPath, valueStr, true);
    var moduleName = extractModuleName(absPath);
    fireChange(moduleName, changeEvent);
    fireChange('root', changeEvent);
    return ret;
  }

  function claimAccess(path, claim) {
    store.setNodeAccess(path, claim);
    //sync.syncNow(path);
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

      function nodeGivesAccess(path, mode) {
        var node = store.getNode(path);
        logger.debug("check node access", path, mode, node);
        var access = (new RegExp(mode)).test(node.startAccess);
        if(access) {
          return true
        } else if(path.length > 0) {
          return nodeGivesAccess(path.replace(/[^\/]+\/?$/, ''))
        }
      }

      function ensureAccess(mode) {
        var path = makePath(moduleName == 'root' ? '/' : '');

        if(! nodeGivesAccess(path, mode)) {
          throw "Not sufficient access claimed for node at " + path;
        }
      }

      /**
         @desc baseClient
      */
      return {

        on: function(eventType, cb, context) {//'error' or 'change'. Change events have a path and origin (tab, device, cloud) field
          if(eventType=='change') {
            if(moduleName) {
              if(!moduleChangeHandlers[moduleName]) {
                moduleChangeHandlers[moduleName]=[];
              }
              moduleChangeHandlers[moduleName].push(bindContext(cb, context));
            }
          } else if(eventType == 'error') {
            errorHandlers.push(bindContext(cb, context));
          }
        },

        getObject: function(path, cb, context) {
          ensureAccess('r');
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err, node) {
              var data = store.getNodeData(node);
              if(data && (typeof(data) == 'object')) {
                delete data['@type'];
              }
              bindContext(cb, context)(data);
            });
          } else {
            var node = store.getNode(absPath);
            var data = store.getNodeData(absPath);
            if(data && (typeof(data) == 'object')) {
              delete data['@type'];
            }
            return data;
          }
        },

        getListing: function(path, cb, context) {
          ensureAccess('r');
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err, node) {
              var data = store.getNodeData(node);
              var arr = [];
              for(var i in data) {
                arr.push(i);
              }
              bindContext(cb, context)(arr);
            });
          } else {
            var node = store.getNode(absPath);
            var data = store.getNodeData(absPath);
            var arr = [];
            for(var i in data) {
              arr.push(i);
            }
            return arr;
          }
        },

        getDocument: function(path, cb, context) {
          ensureAccess('r');
          var absPath = makePath(path);
          if(cb) {
            sync.fetchNow(absPath, function(err, node) {
              bindContext(cb, context)({
                mimeType: node.mimeType,
                data: store.getNodeData(node)
              });
            });
          } else {
            var node = store.getNode(absPath);
            return {
              mimeType: node.mimeType,
              data: store.getNodeData(node)
            };
          }
        },

        /**
           @method remove

           @desc Remove node at given path from storage. Starts synchronization.

           @param {String} path
           @param {Function} callback (optional) callback to be called once synchronization is done.
           @param {Object} context (optional) context for the callback

           @fires "error" if no callback is given and synchronization fails
        */
        remove: function(path, cb, context) {
          ensureAccess('w');
          var ret = set(path, makePath(path));
          this.syncNow(cb, context);
          return ret;
        },

        /**
           @method storeObject

           @desc Store object at given path. Starts synchronization.

           @param {String} type The type of object being stored. Two objects stored under the same type key should have the same structure.
           @param {String} path Path relative to module root.
           @param {Object} object The object to be saved.
           @param {Function} callback (optional) callback to be called, once synchronization is done.
           @param {Object} context (optional) context for the callback

           @fires "error" if no callback is given and synchronization fails
         */
        storeObject: function(type, path, obj, cb, context) {
          ensureAccess('w');
          if(typeof(obj) !== 'object') {
            throw "storeObject needs to get an object as value!"
          }
          obj['@type'] = 'https://remotestoragejs.com/spec/modules/'+moduleName+'/'+type;
          //checkFields(obj);
          var ret = set(path, makePath(path), obj, 'application/json');
          this.sync(path);
          this.syncNow(cb, context);
          return ret;
        },

        storeDocument: function(mimeType, path, data, cb, context) {
          ensureAccess('w');
          var ret = set(path, makePath(path), data, mimeType);
          this.syncNow(cb, context);
          return ret;
        },

        /**
           @method getItemURL

           @desc Get the full URL of the item at given path. This will only
           work, if the user is connected to a remoteStorage account, otherwise
           it returns null.

           @param {String} path relative path starting from the module root.
           @returns String or null
        */
        getItemURL: function(path) {
          var base = remoteStorage.getStorageHref();
          if(! base) {
            return null;
          }
          if(base.substr(-1) != '/') {
            base = base + '/';
          }
          return base + makePath(path);
        },

        getCurrentWebRoot: function() {
          return 'https://example.com/this/is/an/example/'+(isPublic?'public/':'')+moduleName+'/';
        },

        /**
           @method sync

           @desc Force synchronization on given path.
        */
        sync: function(path, switchVal) {
          var absPath = makePath(path);
          store.setNodeForce(absPath, (switchVal != false));
        },

        syncNow: function(cb, context) {
          sync.syncNow(makePath(''), cb ? bindContext(cb, context) : function(errors) {
            if(errors && errors.length > 0) {
              logger.error("Error syncing: ", errors);
              fireError(errors);
            }
          });
        },

        getState: function(path) {
        }
      };
    }
  };
});
