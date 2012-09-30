/* -*- js-indent-level:2 -*- */

/** @module baseClient*/
define(['./sync', './store', './util'], function (sync, store, util) {

  "use strict";

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
      oldValue: store.getNodeData(absPath),
      newValue: valueStr,
      path: path
    };
    var ret = store.setNodeData(absPath, valueStr, true);
    var moduleName = extractModuleName(absPath);
    fireChange(moduleName, changeEvent);
    fireChange('root', changeEvent);
    return ret;
  }

  /**
     @method claimAccess
     @param {String} path Absolute path to claim access on.
     @param {String} claim Mode to claim ('r' or 'rw')
     @memberof module:baseClient
  */
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

  var BaseClient;


  BaseClient = function(moduleName, isPublic) {
    this.moduleName = moduleName, this.isPublic = isPublic;
  }

  /** @class BaseClient */
  BaseClient.prototype = {

    /** @private */
    makePath: function(path) {
      if(this.moduleName == 'root') {
        return path;
      }
      return (this.isPublic?'/public/':'/')+this.moduleName+'/'+path;
    },

    /** @private */
    nodeGivesAccess: function(path, mode) {
      var node = store.getNode(path);
      logger.debug("check node access", path, mode, node);
      var access = (new RegExp(mode)).test(node.startAccess);
      if(access) {
        return true
      } else if(path.length > 0) {
        return this.nodeGivesAccess(path.replace(/[^\/]+\/?$/, ''))
      }
    },

    /** @private */
    ensureAccess: function(mode) {
      var path = this.makePath(this.moduleName == 'root' ? '/' : '');

      if(! this.nodeGivesAccess(path, mode)) {
        throw "Not sufficient access claimed for node at " + path;
      }
    },


    /**
       @method BaseClient#on

       @desc Install an event handler for the given type.

       @param {String} eventType
       @param {Function} handler
       @param {Object} context (optional) context to bind handler to.
    */
    on: function(eventType, handler, context) {//'error' or 'change'. Change events have a path and origin (tab, device, cloud) field
      if(eventType=='change') {
        if(this.moduleName) {
          if(!moduleChangeHandlers[this.moduleName]) {
            moduleChangeHandlers[this.moduleName]=[];
          }
          moduleChangeHandlers[this.moduleName].push(bindContext(handler, context));
        }
      } else if(eventType == 'error') {
        errorHandlers.push(bindContext(handler, context));
      } else {
        throw "No such event type: " + eventType;
      }
    },

    /**
       @method BaseClient#getObject

       @desc Get a JSON object from given path.

       @param {String} path
       @param {Function} callback (optional)
       @param {Object} context (optional)

       @returns {Object}
    */
    getObject: function(path, cb, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(cb) {
        sync.fetchNow(absPath, function(err, node) {
          var data = store.getNodeData(absPath);
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

    /**
       @method BaseClient#getListing

       @desc Get a list of keys directly under the specified path.

       @param {String} path
       @param {Function} callback (optional)
       @param {Object} context (optional)

       @returns {Array} of keys
    */
    getListing: function(path, cb, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(cb) {
        sync.fetchNow(absPath, function(err, node) {
          var data = store.getNodeData(absPath);
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

    /**
       @method BaseClient#getDocument

       @desc Get the document at the given path. A Document is raw data, as opposed to a JSON object (use getObject for that).

       @param {String} path
       @param {Function} callback (optional) callback to be called with the result
       @param {Object} context (optional) ocntext for the callback

       @returns {Object} with keys "mimeType" and "data".
    */
    getDocument: function(path, cb, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(cb) {
        sync.fetchNow(absPath, function(err, node) {
          bindContext(cb, context)({
            mimeType: node.mimeType,
            data: store.getNodeData(absPath)
          });
        });
      } else {
        var node = store.getNode(absPath);
        return {
          mimeType: node.mimeType,
          data: store.getNodeData(absPath)
        };
      }
    },

    /**
       @method BaseClient#remove

       @desc Remove node at given path from storage. Starts synchronization.

       @param {String} path
       @param {Function} callback (optional) callback to be called once synchronization is done.
       @param {Object} context (optional) context for the callback

       @fires "error" if no callback is given and synchronization fails
    */
    remove: function(path, cb, context) {
      this.ensureAccess('w');
      var ret = set(path, this.makePath(path));
      this.syncNow(cb, context);
      return ret;
    },

    /**
       @method BaseClient#storeObject

       @desc Store object at given path. Starts synchronization.

       @param {String} type The type of object being stored. Two objects stored under the same type key should have the same structure.
       @param {String} path Path relative to module root.
       @param {Object} object The object to be saved.
       @param {Function} callback (optional) callback to be called, once synchronization is done.
       @param {Object} context (optional) context for the callback

       @fires "error" if no callback is given and synchronization fails
    */
    storeObject: function(type, path, obj, cb, context) {
      this.ensureAccess('w');
      if(typeof(obj) !== 'object') {
        throw "storeObject needs to get an object as value!"
      }
      obj['@type'] = 'https://remotestoragejs.com/spec/modules/'+this.moduleName+'/'+type;
      //checkFields(obj);
      var ret = set(path, this.makePath(path), obj, 'application/json');
      this.sync(path);
      this.syncNow(cb, context);
      return ret;
    },

    /**
       @method BaseClient#storeDocument

       @desc Store raw data at a given path.

       @param {String} mimeType MIME type of the data.
       @param {String} path
       @param {String} data
       @param {Function} callback (optional)
       @param {Object} context (optional)

       @fires "error" if no callback is given and synchronization fails
    */
    storeDocument: function(mimeType, path, data, cb, context) {
      this.ensureAccess('w');
      var ret = set(path, this.makePath(path), data, mimeType);
      this.syncNow(cb, context);
      return ret;
    },

    /**
       @method BaseClient#getItemURL

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
      return base + this.makePath(path);
    },

    getCurrentWebRoot: function() {
      return 'https://example.com/this/is/an/example/'+(this.isPublic?'public/':'')+this.moduleName+'/';
    },

    /**
       @method BaseClient#sync

       @desc Force synchronization on given path.

       @param {String} path
       @param {Boolean} switchVal (optional) if set to "false", remove force flag from node at path
    */
    sync: function(path, switchVal) {
      var absPath = this.makePath(path);
      store.setNodeForce(absPath, (switchVal != false));
    },

    /**
       @method syncNow
       @memberof class:BaseClient

       @desc Synchronize with remotestorage, starting at this client's root.

       @param {Function} callback (optional) callback to call once synchronization finishes.
       @param {Object} context (optional) context to bind callback to.

       @fires "error" if no callback is given and synchronization fails.
    */
    syncNow: function(cb, context) {
      sync.syncNow(this.makePath(''), cb ? bindContext(cb, context) : function(errors) {
        if(errors && errors.length > 0) {
          logger.error("Error syncing: ", errors);
          fireError(errors);
        }
      });
    },

    getState: function(path) {
    }
  };


  return {

    claimAccess: claimAccess,

    /**
       @method getInstance
       @memberof module:baseClient
       @param {String} moduleName Name of the module the returned client is to be part of.
       @param {Boolean} isPublic Whether this client shall write to the public category.
       @returns BaseClient
    */
    getInstance: function(moduleName, isPublic) {
      return new BaseClient(moduleName, isPublic);
    }
  };
});
