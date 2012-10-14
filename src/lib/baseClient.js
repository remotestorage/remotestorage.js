define(['./sync', './store', './util'], function (sync, store, util) {

  "use strict";

  var logger = util.getLogger('baseClient');
  var moduleEvents = {};

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

  var isPublicRE = /^\/public\//;

  function fireChange(moduleName, eventObj) {
    var isPublic = isPublicRE.test(eventObj.path);
    var events;
    if(moduleEvents[moduleName] && (events = moduleEvents[moduleName][isPublic])) {

      if(moduleName !== 'root') {
        eventObj.relativePath = eventObj.path.replace(new RegExp('^/(?:public/|)' + moduleName + '/'), '');
      }

      events.emit('change', eventObj);
    }
  }

  function fireError(absPath, error) {
    var isPublic = isPublicRE.test(absPath);
    moduleEvents[moduleName][isPublic].emit('error', error);
  }

  store.on('change', function(e) {
    var moduleName = extractModuleName(e.path);
    fireChange(moduleName, e);//remote-based changes get fired from the store.
    fireChange('root', e);//root module gets everything
  });

  function set(path, absPath, value) {
    var moduleName = extractModuleName(absPath);
    if(util.isDir(absPath)) {
      fireError(absPath, 'attempt to set a value to a directory '+absPath);
      return;
    }
    var changeEvent = {
      origin: 'window',
      oldValue: store.getNodeData(absPath),
      newValue: value,
      path: absPath
    };
    store.setNodeData(absPath, value, true);
    fireChange(moduleName, changeEvent);
    fireChange('root', changeEvent);
  }

  var BaseClient = function(moduleName, isPublic) {
    this.moduleName = moduleName, this.isPublic = isPublic;
    if(! moduleEvents[moduleName]) {
      moduleEvents[moduleName] = {};
    }
    this.events = util.getEventEmitter('change', 'error');
    moduleEvents[moduleName][isPublic] = this.events;
    util.bindAll(this);
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
    //   path         - path to the node that changed
    //   newValue     - new value of the node. if the node has been removed, this is undefined.
    //   oldValue     - previous value of the node. if the node has been newly created, this is undefined.
    //   origin       - either "tab", "device" or "remote". Elaborated below.
    //   relativePath - path relative to the module root (*not* present in the root module. Use path there instead)
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
        return path[0] === '/' ? path : ('/' + path);
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

    lastUpdateOf: function(path) {
      var absPath = this.makePath(path);
      var node = store.getNode(absPath);
      return node ? node.timestamp : null;
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
      this.events.on(eventType, util.bind(handler, context));
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
    //     synchronization on the root of that branch using <BaseClient.use>,
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
      var data = store.getNodeData(absPath);

      if(callback) {
        var cb = util.bind(callback, context);
        if(data && !(typeof(data) == 'object' && Object.keys(data).length == 0)) {
          cb(data);
        } else {
          sync.syncOne(absPath, function(node, data) {
            cb(data);
          });
        }
      } else {
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
          util.bind(callback, context)(arr);
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
    // Method: getAll
    //
    // Get all objects directly below a given path.
    //
    // Receives the same parameters as <getListing> (FIXME!!!)
    //
    // Returns an object in the form { path : object, ... }
    //
    getAll: function(type, path, callback, context) {
      if(typeof(path) != 'string') {
        path = type, callback = path, context = callback;
        type = null;
      }
      var makeMap = function(listing) {
        var o = {};
        listing.forEach(function(name) {
          var item = this.getObject(path + name);
          if((! type) || type == item['@type'].split('/').slice(-1)[0]) {
            o[path + name] = item;
          }
        }, this);
        return o;
      }.bind(this);
      if(callback) {
        this.getListing(path, function(listing) {
          util.bind(callback, context)(makeMap(listing));
        }, this);
      } else {
        return makeMap(this.getListing(path));
      }
    },

    //
    // Method: getDocument
    //
    // Get the document at the given path. A Document is raw data, as opposed to
    // a JSON object (use <getObject> for that).
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

      function makeResult() {
        var node = store.getNode(absPath);
        if(node) {
          return {
            mimeType: node.mimeType,
            data: store.getNodeData(absPath)
          };
        } else {
          return null;
        }
      }

      var result = makeResult();

      if(callback) {
        var cb = util.bind(callback, context);
        if(result) {
          cb(result);
        } else {
          sync.syncOne(absPath, function() {
            cb(makeResult());
          });
        }
      } else {
        return result;
      }
    },


    //
    // Method: remove
    //
    // Remove node at given path from storage. Triggers synchronization.
    //
    // Parameters:
    //   path     - Path relative to the module root.
    //   callback - (optional) called when the change has been propagated to remotestorage
    //   context  - (optional)
    //
    remove: function(path, callback, context) {
      this.ensureAccess('w');
      var absPath = this.makePath(path);
      set(path, absPath, undefined);
      sync.syncOne(absPath, util.bind(callback, context));
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
    //   callback - (optional) called when the change has been propagated to remotestorage
    //   context  - (optional) 
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
      var absPath = this.makePath(path);
      set(path, absPath, obj, 'application/json');
      sync.syncOne(absPath, util.bind(callback, context));
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
    //   callback - (optional) called when the change has been propagated to remotestorage
    //   context  - (optional)
    //
    // The given mimeType will later be returned, when retrieving the data
    // using getDocument.
    //
    storeDocument: function(mimeType, path, data, callback, context) {
      this.ensureAccess('w');
      var absPath = this.makePath(path);
      set(path, absPath, data, mimeType);
      sync.syncOne(absPath, util.bind(callback, context));
    },

    getStorageHref: function() {
      return remoteStorage.getStorageHref();
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
      var base = this.getStorageHref();
      if(! base) {
        return null;
      }
      if(base.substr(-1) != '/') {
        base = base + '/';
      }
      return base + this.makePath(path);
    },

    syncOnce: function(path, callback) {
      var previousTreeForce = store.getNode(path).startForceTree;
      this.use(path, false);
      sync.partialSync(path, 1, function() {
        if(previousTreeForce) {
          this.use(path, true);
        } else {
          this.release(path);
        }
        if(callback) {
          callback();
        }
      }.bind(this));

    },

    //
    // Method: use
    //
    // Force given path to be synchronized in the future.
    //
    // In order for a given path to be synchronized with remotestorage by
    // <sync>, it has to be marked as "interesting". This is done via the
    // *force* flag. Forcing sync on a directory causes the entire branch
    // to be considered "forced".
    //
    // Parameters:
    //   path      - path relative to the module root
    //   treeOnly  - boolean value, whether only the tree should be synced.
    //
    use: function(path, treeOnly) {
      console.error('use', path);
      var absPath = this.makePath(path);
      store.setNodeForce(absPath, !treeOnly, true);
    },

    // counterpart for use()
    release: function(path) {
      console.error('release', path);
      var absPath = this.makePath(path);
      store.setNodeForce(absPath, false, false);
    },

    hasDiff: function(path) {
      var absPath = this.makePath(path);
      if(util.isDir(absPath)) {
        return Object.keys(store.getNode(absPath).diff).length > 0;
      } else {
        var parentPath = absPath.replace(/[^\/]+$/, '');
        return !! store.getNode(absPath).diff[path.split('/').slice(-1)[0]];
      }
    }
    
  };

  return BaseClient;

});
