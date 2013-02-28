define([
  './util',
  './store',
  './wireClient',
  './sync',
  '../vendor/validate',
  '../vendor/Math.uuid'
], function(util, store, wireClient, sync, validate, MathUUID) {

  "use strict";

  var logger = util.getLogger('baseClient');
  var globalEvents = util.getEventEmitter('error');
  var moduleEvents = {};

  function extractModuleName(path) {
    if (path && typeof(path) == 'string') {
      var parts = path.split('/');
      if(parts.length > 3 && parts[1] == 'public') {
        return parts[2];
      } else if(parts.length > 2){
        return parts[1];
      } else if(parts.length == 2) {
        return 'root';
      }
    }
  }

  var isPublicRE = /^\/public\//;

  function fireModuleEvent(eventName, moduleName, eventObj) {
    var isPublic = isPublicRE.test(eventObj.path);
    var events;
    if(moduleEvents[moduleName] &&
       (events = moduleEvents[moduleName][isPublic])) {

      if(moduleName !== 'root' && eventObj.path) {
        eventObj.relativePath = eventObj.path.replace(
          (isPublic ? '/public/' : '/') + moduleName + '/', ''
        );
      }

      events.emit(eventName, eventObj);
    }
  }

  function fireError(absPath, error) {
    var isPublic = isPublicRE.test(absPath);
    var moduleName = extractModuleName(absPath);
    var modEvents = moduleEvents[moduleName];
    if(! (modEvents && modEvents[isPublic])) {
      moduleEvents.root[isPublic].emit('error', error);
    } else {
      modEvents[isPublic].emit('error', error);
    }

    globalEvents.emit('error', error);
  }

  store.on('change', function(event) {
    var moduleName = extractModuleName(event.path);
    // remote-based changes get fired from the store.
    fireModuleEvent('change', moduleName, event);
    if(moduleName !== 'root') {
      // root module gets everything
      fireModuleEvent('change', 'root', event);
    }
  });

  sync.on('conflict', function(event) {
    var moduleName = extractModuleName(event.path);
    var isPublic = isPublicRE.test(event.path);
    var eventEmitter = moduleEvents[moduleName] && moduleEvents[moduleName][isPublic];
    var rootEmitter = moduleEvents.root && moduleEvents.root[isPublic];
    if(eventEmitter && eventEmitter.hasHandler('conflict')) {
      fireModuleEvent('conflict', moduleName, event);
      fireModuleEvent('conflict', 'root', event);
    } else if(rootEmitter && rootEmitter.hasHandler('conflict')) {
      fireModuleEvent('conflict', 'root', event);
    } else {
      event.resolve('remote');
    }
  });

  function failedPromise(error) {
    return util.getPromise().reject(error);
  }

  function set(moduleName, path, absPath, value, mimeType) {
    if(util.isDir(absPath)) {
      return failedPromise(new Error('attempt to set a value to a directory ' + absPath));
    }
    var changeEvent;
    return store.getNode(absPath).
      then(function(node) {
        changeEvent = {
          origin: 'window',
          oldValue: node.data,
          newValue: value,
          path: absPath
        };
        return store.setNodeData(absPath, value, true, undefined, mimeType);
      }).then(function() {
        fireModuleEvent('change', moduleName, changeEvent);
        if(moduleName !== 'root') {
          fireModuleEvent('change', 'root', changeEvent);
        }
      });
  }

  var ValidationError = function(object, errors) {
    Error.call(this, "Validation failed!");
    this.object = object;
    this.errors = errors;
  };

  /** FROM HERE ON PUBLIC INTERFACE **/

  var BaseClient = function(moduleName, isPublic) {
    if(! moduleName) {
      throw new Error("moduleName is required");
    }
    this.moduleName = moduleName, this.isPublic = isPublic;
    if(! moduleEvents[moduleName]) {
      moduleEvents[moduleName] = {};
    }
    this.events = util.getEventEmitter('change', 'conflict', 'error');
    moduleEvents[moduleName][!!isPublic] = this.events;
    util.bindAll(this);

    this.types = {};
    this.typeAliases = {};
    this.schemas = {};
    this.typeIdKeys = {};
  };

  // Class: BaseClient
  //
  // A BaseClient allows you to get, set or remove data. It is the basic
  // interface for building "modules".
  //
  // See <remoteStorage.defineModule> for details.
  //
  //
  // Most methods here return promises. See the guide for and introduction: <Promises>
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
    //   remote - this event came from the *remoteStorage server*. that means another app or the same app on another device caused the event.
    //
    // Example:
    //   (start code)
    //   client.on('change', function(event) {
    //     if(event.newValue && event.oldValue) {
    //       console.log(event.origin + ' updated ' + event.path + ':', event.oldValue, '->', event.newValue);
    //     } else if(event.newValue) {
    //       console.log(event.origin + ' created ' + event.path + ':', undefined, '->', event.newValue);
    //     } else {
    //       console.log(event.origin + ' removed ' + event.path + ':', event.oldValue, '->', undefined);
    //     }
    //   });
    //   (end code)
    //

    makePath: function(path) {
      var base = (this.moduleName == 'root' ?
                  (path[0] === '/' ? '' : '/') :
                  '/' + this.moduleName + '/');
      return (this.isPublic ? '/public' + base : base) + path;
    },

    nodeGivesAccess: function(path, mode) {
      return store.getNode(path).then(util.bind(function(node) {
        var access = (new RegExp(mode)).test(node.startAccess);
        if(access) {
          return true;
        } else if(path.length > 0) {
          return this.nodeGivesAccess(path.replace(/[^\/]+\/?$/, ''));
        }
      }, this));
    },

    ensureAccess: function(mode) {
      var path = this.makePath(this.moduleName == 'root' ? '/' : '');

      return this.nodeGivesAccess(path, mode).then(function(access) {
        if(! access) {
          throw "Not sufficient access claimed for node at " + path;
        }
      });
    },

    // Method: lastUpdateOf
    // Get the time a node was last updated.
    //
    // Parameters:
    //   path - Relative path from the module root
    //
    // Returns:
    //   a promise for a timestamp, which is either
    //   a Number - when the node exists OR
    //   null - when the node doesn't exist
    //
    // The timestamp is represented as Number of milliseconds.
    // Use this snippet to get a Date object from it
    //   (start code)
    //   client.lastUpdateOf('path/to/node').
    //     then(function(timestamp) {
    //       // (normally you should check that 'timestamp' isn't null now)
    //       console.log('last update: ', new Date(timestamp));
    //     });
    //   (end code)
    //
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
    //
    // Returns:
    //   A promise for the object.
    //
    // Example:
    //   (start code)
    //   client.getObject('/path/to/object').
    //     then(function(object) {
    //       // object is either an object or null
    //     });
    //   (end code)
    //
    getObject: function(path) {
      var fullPath = this.makePath(path);
      return this.ensureAccess('r').
        then(util.curry(store.getNode, fullPath)).
        then(function(node) {
          if(node.pending) {
            return sync.updateDataNode(fullPath);
          } else {
            return node;
          }
        }).
        then(function(node) {
          if(node.mimeType !== 'application/json') {
            logger.error("WARNING: getObject got called, but retrieved a non-json node at '" + fullPath + "'!");
          }
          return node.data;
        });
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
    //
    // Returns:
    //   A promise for an Array of keys, representing child nodes.
    //   Those keys ending in a forward slash, represent *directory nodes*, all
    //   other keys represent *data nodes*.
    //
    // Example:
    //   (start code)
    //   client.getListing('').then(function(listing) {
    //     listing.forEach(function(item) {
    //       console.log('- ' + item);
    //     });
    //   });
    //   (end code)
    //
    getListing: function(path) {
      if(! (util.isDir(path) || path === '')) {
        return util.getPromise().reject(
          new Error("Not a directory: " + path)
        );
      }
      var fullPath = this.makePath(path);
      return this.ensureAccess('r').
        then(util.curry(store.getNode, fullPath)).
        then(function(node) {
          if((!node) || node.pending || Object.keys(node.data).length === 0) {
            return store.isForced(fullPath).
              then(function(isForced) {
                if(isForced) {
                  return node;
                } else {
                  return sync.updateDataNode(fullPath).
                    then(function(node) {
                      return store.setNodePending(fullPath, new Date().getTime()).
                        then(function() { return node; });
                    });
                }
              });
          } else {
            return node;
          }
        }).
        then(function(node) {
          return node.data ? Object.keys(node.data) : [];
        });
    },

    //
    // Method: getAll
    //
    // Get all objects directly below a given path.
    //
    // Parameters:
    //   path      - path to the direcotry
    //   typeAlias - (optional) local type-alias to filter for
    //
    // Returns:
    //   a promise for an object in the form { path : object, ... }
    //
    // Example:
    //   (start code)
    //   client.getAll('').then(function(objects) {
    //     for(var key in objects) {
    //       console.log('- ' + key + ': ', objects[key]);
    //     }
    //   });
    //   (end code)
    //
    getAll: function(path, typeAlias) {

      function filterByType(objectMap) {
        if(typeAlias) {
          var type = this.resolveTypeAlias(typeAlias);
          for(var key in objectMap) {
            if(objectMap[key]['@context'] !== type) {
              delete objectMap[key];
            }
          }
        } else {
          return objectMap;
        }
      }

      function retrieveObjects(listing) {
        var _this = this;
        var objectMap = {};
        return util.asyncEach(listing, function(key) {
          if(! util.isDir(key)) {
            return _this.getObject(path + key).
              then(function(object) {
                objectMap[key] = object;
              });
          }
        }).then(function() {
          return objectMap;
        });
      }

      return this.getListing(path).
        then(util.bind(retrieveObjects.bind, this)).
        then(util.bind(filterByType, this));
    },

    //
    // Method: getFile
    //
    // Get the file at the given path. A file is raw data, as opposed to
    // a JSON object (use <getObject> for that).
    //
    // Except for the return value structure, getFile works exactly like
    // getObject.
    //
    // Parameters:
    //   path     - see getObject
    //
    // Returns:
    //   A promise for an object:
    //
    //   mimeType - String representing the MIME Type of the document.
    //   data     - Raw data of the document (either a string or an ArrayBuffer)
    //
    // Example:
    //   (start code)
    //   // Display an image:
    //   client.getFile('path/to/some/image').then(function(file) {
    //     var blob = new Blob([file.data], { type: file.mimeType });
    //     var targetElement = document.findElementById('my-image-element');
    //     targetElement.src = window.URL.createObjectURL(blob);
    //   });
    //   (end code)
    getFile: function(path) {
      var fullPath = this.makePath(path);
      return this.ensureAccess('r').
        then(util.curry(store.getNode, fullPath)).
        then(function(node) {
          if(node.pending) {
            return sync.updateDataNode(fullPath);
          } else if(! node.data) {
            return store.getNode(util.containingDir(fullPath)).
              then(function(parentNode) {
                if(parentNode.pending) {
                  return sync.updateDataNode(fullPath);
                } else {
                  return node;
                }
              });
          } else {
            return node;
          }
        }).
        then(function(node) {
          return {
            mimeType: node.mimeType,
            data: node.data
          };
        });
    },

    // Method: getDocument
    //
    // DEPRECATED in favor of <getFile>
    getDocument: function() {
      util.deprecate('getDocument', 'getFile');
      return this.getFile.apply(this, arguments);
    },

    //
    // Method: remove
    //
    // Remove node at given path from storage. Triggers synchronization.
    //
    // Parameters:
    //   path     - Path relative to the module root.
    //
    remove: function(path) {
      var absPath = this.makePath(path);
      return this.ensureAccess('w').
        then(util.curry(set, this.moduleName, path, absPath, undefined)).
        then(util.curry(sync.partialSync, util.containingDir(absPath), 1));
    },

    // Method: saveObject
    //
    // Save a typed JSON object.
    // This only works for objects with a @context attribute corresponding to a schema
    // that has been declared via <declareType> and a ID attribute declared within
    // that schema.
    //
    // For details on using saveObject and typed JSON objects,
    // see <Working with schemas>.
    //
    // Parameters:
    //   object - a typed JSON object
    //
    //
    saveObject: function(object) {
      var type = object['@context'];
      var alias = this.resolveTypeAlias(type);
      var idKey = this.resolveIdKey(type);
      if(! idKey) {
        return failedPromise("Invalid typed JSON object! ID attribute could not be resolved.");
      }
      if(! object[idKey]) {
        object[idKey] = this.uuid();
      }
      return this.storeObject(alias, object[idKey], object);
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
    //
    // Returns:
    //   A promise to store the object. The promise fails with a ValidationError, when validations fail.
    //
    //
    // What about the type?:
    //
    //   A great thing about having data on the web, is to be able to link to
    //   it and rearrange it to fit the current circumstances. To facilitate
    //   that, eventually you need to know how the data at hand is structured.
    //   For documents on the web, this is usually done via a MIME type. The
    //   MIME type of JSON objects however, is always application/json.
    //   To add that extra layer of "knowing what this object is", remoteStorage
    //   aims to use <JSON-LD at http://json-ld.org/>.
    //   A first step in that direction, is to add a *@context attribute* to all
    //   JSON data put into remoteStorage.
    //   Now that is what the *type* is for.
    //
    //   Within remoteStorage.js, @context values are built using three components:
    //     http://remotestoragejs.com/spec/modules/ - A prefix to guarantee unqiueness
    //     the module name     - module names should be unique as well
    //     the type given here - naming this particular kind of object within this module
    //
    //   In retrospect that means, that whenever you introduce a new "type" in calls to
    //   storeObject, you should make sure that once your code is in the wild, future
    //   versions of the code are compatible with the same JSON structure.
    //
    // How to define types?:
    //
    //   See <declareType> or the calendar module (src/modules/calendar.js) for examples.
    //
    storeObject: function(typeAlias, path, obj) {
      if(typeof(path) !== 'string') {
        return failedPromise(new Error("given path must be a string (got: " + typeof(path) + ")"));
      }
      if(typeof(obj) !== 'object') {
        return failedPromise(new Error("given object must be an object (got: " + typeof(obj) + ")"));
      }
      if(util.isDir(path)) {
        return failedPromise(new Error("Can't store directory node"));
      }

      var absPath = this.makePath(path);

      return this.ensureAccess('w').
        then(util.bind(function() {
          if(! (obj instanceof Array)) {
            obj['@context'] = this.resolveType(typeAlias);
            var errors = this.validateObject(obj);
            if(errors) {
              throw new ValidationError(obj, errors);
            }
          }
          return set(this.moduleName, path, absPath, obj, 'application/json')
        }, this)).
        then(util.curry(sync.partialSync, util.containingDir(absPath), 1));
    },

    //
    // Method: storeFile
    //
    // Store raw data at a given path. Triggers synchronization.
    //
    // Parameters:
    //   mimeType - MIME media type of the data being stored
    //   path     - path relative to the module root. MAY NOT end in a forward slash.
    //   data     - string or ArrayBuffer of raw data to store
    //   cache    - (optional) specify whether to put data in local cache prior to syncing it to the server. defaults to 'true'
    //
    // The given mimeType will later be returned, when retrieving the data
    // using <getFile>.
    //
    // Example (UTF-8 data):
    //   (start code)
    //   client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>');
    //   (end code)
    //
    // Example (Binary data):
    //   (start code)
    //   // MARKUP:
    //   <input type="file" id="file-input">
    //   // CODE:
    //   var input = document.getElementById('file-input');
    //   var file = input.files[0];
    //   var fileReader = new FileReader();
    //
    //   fileReader.onload = function() {
    //     client.storeFile(file.type, file.name, fileReader.result);
    //   };
    //
    //   fileReader.readAsArrayBuffer(file);
    //   (end code)
    //
    //
    // Example (Without local cache):
    //   (start code)
    //   client.storeFile('text/plain', 'hello.txt', 'Hello World!', false);
    //   (end code)
    //
    // Please keep in mind that the storage adapter used may limit the size of
    // files that can be stored in cache. The current default is localStorage,
    // which places a very tight limit due to constraints enforced by browsers
    // and the necessity of base64 encoding binary data.
    //
    // If you wish to store larger data, set the 'cache' parameter to 'false',
    // that way data will be pushed to the server immediately. Also make sure
    // you have only enabled tree-sync (see <BaseClient#use> for details) on
    // the tree containing the file you store, otherwise the next sync will
    // fetch the stored file from the server again, which you probably do not
    // want to happen.
    //
    storeFile: function(mimeType, path, data, cache) {
      cache = (cache !== false);
      if(util.isDir(path)) {
        return failedPromise(new Error("Can't store directory node"));
      }
      if(typeof(data) !== 'string' && !(data instanceof ArrayBuffer)) {
        return failedPromise(new Error("storeFile received " + typeof(data) + ", but expected a string or an ArrayBuffer!"));
      }
      var absPath = this.makePath(path);
      return this.ensureAccess('w').
        then(util.bind(function() {
          if(cache) {
            return set(this.moduleName, path, absPath, data, mimeType).
              then(util.curry(sync.partialSync, util.containingDir(absPath), 1));
          } else {
            return sync.updateDataNode(absPath, {
              mimeType: mimeType,
              data: data
            }).then(function() {
              return store.setNodePending(absPath, new Date().getTime());
            });
          }
        }, this));
    },

    // Method: storeDocument
    //
    // DEPRECATED in favor of <storeFile>
    storeDocument: function() {
      util.deprecate('storeDocument', 'storeFile');
      return this.storeFile.apply(this, arguments);
    },

    getStorageHref: function() {
      return wireClient.getStorageHref();
    },

    //
    // Method: getItemURL
    //
    // Get the full URL of the item at given path. This will only
    // work, if the user is connected to a remoteStorage account.
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
      return base + this.makePath(path);
    },

    syncOnce: function(path, callback) {
      var previousTreeForce = store.getNode(path).startForceTree;
      this.use(path, false);
      return sync.partialSync(path, 1).
        then(util.bind(function() {
          if(previousTreeForce) {
            this.use(path, true);
          } else {
            this.release(path);
          }
          if(callback) {
            callback();
          }
        }, this));

    },

    //
    // Method: use
    //
    // Set force flags on given path.
    //
    // See <sync> for details.
    //
    // Parameters:
    //   path      - path relative to the module root
    //   treeOnly  - boolean value, whether only the tree should be synced.
    //
    // Returns a promise.
    use: function(path, treeOnly) {
      var absPath = this.makePath(path);
      return store.setNodeForce(absPath, !treeOnly, true);
    },

    // Method: release
    //
    // Remove force flags from given node.
    //
    // See <sync> for details.
    //
    // Parameters:
    //   path      - path relative to the module root
    //
    // Returns a promise.
    release: function(path) {
      var absPath = this.makePath(path);
      return store.setNodeForce(absPath, false, false);
    },

    // Method: hasDiff
    //
    // Yields true if the node at the given path has a diff set.
    // Having a "diff" means, that the node or one of it's descendants
    // has been updated since it was last pulled from remoteStorage.
    hasDiff: function(path) {
      var absPath = this.makePath(path);
      var item = null;
      if(! util.isDir(absPath)) {
        item = util.baseName(absPath);
        absPath = util.containingDir(absPath);
      }
      return store.getNode(absPath).
        then(function(node) {
          if(item) {
            return !! node.diff[item];
          } else {
            return Object.keys(node.diff).length > 0;
          }
        });
    },

    /**** TYPE HANDLING ****/

    resolveType: function(alias) {
      var type = this.types[alias];
      if(! type) {
        // FIXME: support custom namespace. don't fall back to remotestoragejs.com.
        type = 'http://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
        logger.error("WARNING: type alias not declared: " + alias, '(have:', this.types, this.schemas, ')');
      }
      return type;
    },

    resolveTypeAlias: function(type) {
      return this.typeAliases[type];
    },

    resolveSchema: function(type) {
      var schema = this.schemas[type];
      if(! schema) {
        schema = {};
        logger.error("WARNING: can't find schema for type: ", type);
      }
      return schema;
    },

    resolveIdKey: function(type) {
      return this.typeIdKeys[type];
    },

    // Method: buildObject
    //
    // Build an object of the designated type.
    //
    // Parameters:
    //   alias - a type alias, registered via <declareType>
    //
    // If the associated schema specifies a top-level attribute with "format":"id",
    // and the given attributes don't contain that key, a UUID is generated for
    // that column.
    //
    // Example:
    //   (start code)
    //   var drink = client.buildObject('drink');
    //   client.validateObject(drink); // validates against schema declared for "drink"
    //   (end code)
    //
    buildObject: function(alias, attributes) {
      var object = {};
      var type = this.resolveType(alias);
      var idKey = this.resolveIdKey(type);
      if(! attributes) {
        attributes = {};
      }

      object['@context'] = type;
      if(idKey && ! attributes[idKey]) {
        object[idKey] = this.uuid();
      }
      return util.extend(object, attributes || {});
    },

    // Method: declareType
    //
    // Declare a type and assign it a schema.
    // Once a type has a schema set, all data that is stored with that type will be validated before saving it.
    //
    // Parameters:
    //   alias  - an alias to refer to the type. Must be unique within one scope / module.
    //   type   - (optional) full type-identifier to identify the type. used as @context attribute.
    //   schema - an object containing the schema for this new type.
    //
    // if "type" is ommitted, it will be generated based on the module name.
    //
    // Example:
    //   (start code)
    //   client.declareType('drink', {
    //     "description": "A representation of a drink",
    //     "type": "object",
    //     "properties": {
    //       "name": {
    //         "type": "string",
    //         "description": "Human readable name of the drink",
    //         "required": true
    //       }
    //     }
    //   });
    //
    //   client.storeObject('drink', 'foo', {}).
    //     then(function() {
    //       // object saved
    //     }, function(error) {
    //       // error.errors holds validation errors:
    //       // [{ "property": "name",
    //       //    "message": "is missing and it is required" }]
    //       //
    //       // error.object holds a copy of the object
    //     });
    //   (end code)
    //
    declareType: function(alias, type, schema) {
      if(this.types[alias]) {
        logger.error("WARNING: re-declaring already declared alias " + alias);
      }
      if(! schema) {
        schema = type;
        type = 'http://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
      }
      if(schema['extends']) {
        var extendedType = this.types[ schema['extends'] ];
        if(! extendedType) {
          logger.error("Type '" + alias + "' tries to extend unknown schema '" + schema['extends'] + "'");
          return;
        }
        schema['extends'] = this.schemas[extendedType];
      }

      if(schema.properties) {
        for(var key in schema.properties) {
          if(schema.properties[key].format == 'id') {
            this.typeIdKeys[type] = key;
            break;
          }
        }
      }

      this.types[alias] = type;
      this.typeAliases[type] = alias;
      this.schemas[type] = schema;
    },

    // Method: validateObject
    //
    // Validate an object with it's schema.
    //
    // Parameters:
    //   object - the object to validate
    //   alias  - (optional) the type-alias to use, in case the object doesn't have a @context attribute.
    //
    // Returns:
    //   null   - when the object is valid
    //   array of errors - when validation fails.
    //
    // The errors are objects of the form:
    // (start code)
    // { "property": "foo", "message": "is named badly" }
    // (end code)
    //
    validateObject: function(object, alias) {
      var type = object['@context'];
      if(! type) {
        if(alias) {
          type = this.resolveType(alias);
        } else {
          return [{"property":"@context","message":"missing"}];
        }
      }
      var schema = this.resolveSchema(type);
      var result = validate(object, schema);

      return result.valid ? null : result.errors;
    },

    // Method: uuid
    //
    // Generates a Universally Unique IDentifuer and returns it.
    //
    // The UUID is prefixed with the string 'uuid:', to become a valid URI.
    uuid: function() {
      return 'uuid:' + MathUUID.uuid();
    }

  };

  util.extend(BaseClient, globalEvents);

  return BaseClient;

});
