/* -*- js-indent-level:2 -*- */

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
    logger.debug("FIRE CHANGE", moduleName, eventObj);
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
    fireChange(moduleName, e);//remote-based changes get fired from the store.
    fireChange('root', e);//root module gets everything
  });

  function set(path, absPath, valueStr) {
    if(util.isDir(absPath)) {
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
    store.setNodeData(absPath, valueStr, true);
    var moduleName = extractModuleName(absPath);
    fireChange(moduleName, changeEvent);
    fireChange('root', changeEvent);
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



  var BaseClient = function(moduleName, isPublic) {
    this.moduleName = moduleName, this.isPublic = isPublic;

    for(var key in this) {
      if(typeof(this[key]) === 'function') {
        this[key] = bindContext(this[key], this);
      }
    }
  }

  // Class: BaseClient
  //
  // A BaseClient allows you to get, set or remove data. It is the basic
  // interface for building "modules".
  //
  // See <remoteStorage.defineModule> for details.
  //
  BaseClient.prototype = {

    // Event: error
    //
    // Fired when an error occurs.
    //
    // The event object is either a string or an array of error messages.
    //
    // Example:
    //   > client.on('error', function(err) {
    //   >   console.error('something went wrong:', err);
    //   > });
    //
    //
    // Event: change
    //
    // Fired when data concerning this module is updated.
    //
    // Properties:
    //   path     - path to the node that chagned
    //   newValue - new value of the node. if the node has been removed, this is undefined.
    //   oldValue - previous value of the node. if the node has been newly created, this is undefined.
    //   origin   - either "tab", "device" or "remote". Elaborated below.
    //
    // Change origins:
    //   Change events can come from different origins. In order for your app to
    //   update it's state appropriately, every change event knows about it's origin.
    //
    //   The following origins are defined,
    //
    //   tab - this event was generated from the same *browser tab* or window that received the event
    //   device - this event was generated from the same *app*, but a differnent tab or window
    //   remote - this event came from the *remotestorage server*. that means another app or the same app on another device caused the event.
    //
    // Example:
    //   > client.on('change', function(event) {
    //   >   if(event.newValue && event.oldValue) {
    //   >     console.log(event.origin + ' updated ' + event.path + ':', event.oldValue, '->', event.newValue);
    //   >   } else if(event.newValue) {
    //   >     console.log(event.origin + ' created ' + event.path + ':', undefined, '->', event.newValue);
    //   >   } else {
    //   >     console.log(event.origin + ' removed ' + event.path + ':', event.oldValue, '->', undefined);
    //   >   }
    //   > });
    //   

    makePath: function(path) {
      if(this.moduleName == 'root') {
        return path;
      }
      return (this.isPublic?'/public/':'/')+this.moduleName+'/'+path;
    },

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

    ensureAccess: function(mode) {
      var path = this.makePath(this.moduleName == 'root' ? '/' : '');

      if(! this.nodeGivesAccess(path, mode)) {
        throw "Not sufficient access claimed for node at " + path;
      }
    },


    //  
    // Method: on
    //  
    // Install an event handler for the given type.
    // 
    // Parameters:
    //   eventType - type of event, either "change" or "error"
    //   handler   - event handler function
    //   context   - (optional) context to bind handler to
    //  
    on: function(eventType, handler, context) {
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

    //
    // Method: getObject
    //
    // Get a JSON object from given path.
    //
    // Parameters:
    //   path     - relative path from the module root (without leading slash)
    //   callback - (optional) callback, see below
    //   context  - context for callback.
    //
    // Sync vs. async:
    //
    //   getObject can be called with or without a callback. When the callback is
    //   omitted, an object is returned immediately, from local cache.
    //   If on the other hand a callback is given, this forces a synchronization
    //   with remotestorage and calls the callback once that synchronization has
    //   happened.
    //
    // When do I use what?:
    //
    //   It very much depends on your circumstances, but roughly put,
    //   * if you are interested in a whole *branch* of objects, then force
    //     synchronization on the root of that branch using <BaseClient.sync>,
    //     and after that use getObject *without* a callback to get your data from
    //     local cache.
    //   * if you only want to access a *single object* without syncing an entire
    //     branch, use the *asynchronous* variant. That way you only cause that
    //     particular object to be synchronized.
    //   * another reason to use the *asynchronous* call sequence would be, if you
    //     want to be very sure, that the local version of a certain object is
    //     *up-to-date*, when you retrieve it, without triggering a full-blown sync
    //     cycle.
    //
    // Returns:
    //   undefined              - When called with a callback
    //   an object or undefined - when called without a callback
    //
    getObject: function(path, callback, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(callback) {
        sync.fetchNow(absPath, function(err, node) {
          var data = store.getNodeData(absPath);
          if(data && (typeof(data) == 'object')) {
            delete data['@type'];
          }
          bindContext(callback, context)(data);
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

    //
    // Method: getListing
    //
    // Get a list of child nodes below a given path.
    //
    // The callback semantics of getListing are identical to those of getObject.
    //
    // Parameters:
    //   path     - The path to query. It MUST end with a forward slash.
    //   callback - see getObject
    //   context  - see getObject
    //
    // Returns:
    //   An Array of keys, representing child nodes.
    //   Those keys ending in a forward slash, represent *directory nodes*, all
    //   other keys represent *data nodes*.
    //
    getListing: function(path, callback, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(callback) {
        sync.fetchNow(absPath, function(err, node) {
          var data = store.getNodeData(absPath);
          var arr = [];
          for(var i in data) {
            arr.push(i);
          }
          bindContext(callback, context)(arr);
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

    //
    // Method: getDocument
    //
    // Get the document at the given path. A Document is raw data, as opposed to
    // a JSON object (use getObject for that).
    //
    // Except for the return value structure, getDocument works exactly like
    // getObject.
    //
    // Parameters:
    //   path     - see getObject
    //   callback - see getObject
    //   context  - see getObject
    //
    // Returns:
    //   An object,
    //   mimeType - String representing the MIME Type of the document.
    //   data     - Raw data of the document.
    //
    getDocument: function(path, callback, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(callback) {
        sync.fetchNow(absPath, function(err, node) {
          bindContext(callback, context)({
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


    //
    // Method: remove
    //
    // Remove node at given path from storage. Triggers synchronization.
    //
    // Parameters:
    //   path     - Path relative to the module root.
    //   callback - (optional) passed on to <syncNow>
    //   context  - (optional) passed on to <syncNow>
    //
    remove: function(path, callback, context) {
      this.ensureAccess('w');
      set(path, this.makePath(path), undefined);
      this.syncNow(util.containingDir(path), callback, context);
    },

    //
    // Method: storeObject
    //
    // Store object at given path. Triggers synchronization.
    //
    // Parameters:
    //
    //   type     - unique type of this object within this module. See description below.
    //   path     - path relative to the module root.
    //   object   - an object to be saved to the given node. It must be serializable as JSON.
    //   callback - (optional) passed on to <syncNow>
    //   context  - (optional) passed on to <syncNow>
    //
    // What about the type?:
    //
    //   A great thing about having data on the web, is to be able to link to
    //   it and rearrange it to fit the current circumstances. To facilitate
    //   that, eventually you need to know how the data at hand is structured.
    //   For documents on the web, this is usually done via a MIME type. The
    //   MIME type of JSON objects however, is always application/json.
    //   To add that extra layer of "knowing what this object is", remotestorage
    //   aims to use <JSON-LD at http://json-ld.org/>.
    //   A first step in that direction, is to add a *@type attribute* to all
    //   JSON data put into remotestorage.
    //   Now that is what the *type* is for. 
    //   
    //   Within remoteStorage.js, @type values are built using three components:
    //     https://remotestoragejs.com/spec/modules/ - A prefix to guarantee unqiueness
    //     the module name     - module names should be unique as well
    //     the type given here - naming this particular kind of object within this module
    //
    //   In retrospect that means, that whenever you introduce a new "type" in calls to
    //   storeObject, you should make sure that once your code is in the wild, future
    //   versions of the code are compatible with the same JSON structure.
    //
    // 
    storeObject: function(type, path, obj, callback, context) {
      this.ensureAccess('w');
      if(typeof(obj) !== 'object') {
        throw "storeObject needs to get an object as value!"
      }
      obj['@type'] = 'https://remotestoragejs.com/spec/modules/'+this.moduleName+'/'+type;
      set(path, this.makePath(path), obj, 'application/json');
      var parentPath = util.containingDir(path);
      this.sync(parentPath);
      this.syncNow(parentPath, callback, context);
    },

    //
    // Method: storeDocument
    //
    // Store raw data at a given path. Triggers synchronization.
    //
    // Parameters:
    //   mimeType - MIME media type of the data being stored
    //   path     - path relative to the module root. MAY NOT end in a forward slash.
    //   data     - string of raw data to store
    //   callback - (optional) passed to <syncNow>
    //   context  - (optional) passed to <syncNow>
    //
    // The given mimeType will later be returned, when retrieving the data
    // using getDocument.
    //
    storeDocument: function(mimeType, path, data, callback, context) {
      this.ensureAccess('w');
      set(path, this.makePath(path), data, mimeType);
      this.syncNow(path, callback, context);
    },

    //
    // Method: getItemURL
    //
    // Get the full URL of the item at given path. This will only
    // work, if the user is connected to a remotestorage account.
    //
    // Parameter:
    //   path - path relative to the module root
    //
    // Returns:
    //   a String - when currently connected
    //   null - when currently disconnected
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

    //
    // Method: sync
    //
    // Force given path to be synchronized in the future.
    //
    // In order for a given path to be synchronized with remotestorage by
    // <syncNow>, it has to be marked as "interesting". This is done via the
    // *force* flag. Forcing sync on a directory causes the entire branch
    // to be considered "forced".
    //
    // Parameters:
    //   path      - path relative to the module root
    //   switchVal - optional boolean flag to set force value. Use "false" to remove the force flag.
    //
    sync: function(path, switchVal) {
      var absPath = this.makePath(path);
      store.setNodeForce(absPath, (switchVal != false));
    },

    //
    // Method: syncNow
    //
    // Start synchronization at given path.
    //
    // Note that only those nodes will be synchronized, that have a *force* flag
    // set. Use <BaseClient.sync> to set the force flag on a node.
    //
    // Parameters:
    //   path     - relative path from the module root. 
    //   callback - (optional) callback to call once synchronization finishes.
    //   context  - (optional) context to bind callback to.
    //
    syncNow: function(path, callback, context) {
      sync.syncNow(this.makePath(path), callback ? bindContext(callback, context) : function(errors) {
        if(errors && errors.length > 0) {
          logger.error("Error syncing: ", errors);
          fireError(errors);
        }
      });
    }
  };

  return BaseClient;

});
