define([
  'require',
  './lib/widget',
  './lib/store',
  './lib/sync',
  './lib/wireClient',
  './lib/nodeConnect',
  './lib/util',
  './lib/webfinger',
  './lib/foreignClient',
  './lib/baseClient',
  './lib/schedule',
  './lib/i18n'
], function(require, widget, store, sync, wireClient, nodeConnect, util, webfinger, foreignClient, BaseClient, schedule, i18n) {

  "use strict";

  var claimedModules = {}, modules = {}, moduleNameRE = /^[a-z\-]+$/;

  var logger = util.getLogger('base');

  util.silenceAllLoggers();
  util.unsilenceLogger('base', 'getputdelete');

  // Namespace: remoteStorage
  var remoteStorage =  {

    //
    // Method: defineModule
    //
    // Define a new module, with given name.
    // Module names MUST be unique. The given builder will be called
    // immediately, with two arguments, which are both instances of
    // <BaseClient>. The first accesses the private section of a modules
    // storage space, the second the public one. The public area can
    // be read by any client (not just an authenticated one), while
    // it can only be written by an authenticated client with read-write
    // access claimed on it.
    //
    // The builder is expected to return an object, as described under
    // <getModuleInfo>.
    //
    // Parameter:
    //   moduleName - Name of the module to define. MUST be a-z and all lowercase.
    //   builder    - Builder function that holds the module definition.
    //
    // Example:
    //   (start code)
    //
    //   remoteStorage.defineModule('beers', function(privateClient, publicClient) {
    //
    //     function nameToKey(name) {
    //       return name.replace(/\s/, '-');
    //     }
    //
    //     return {
    //       exports: {
    //
    //         addBeer: function(name) {
    //           privateClient.storeObject('beer', nameToKey(name), {
    //             name: name,
    //             drinkCount: 0
    //           });
    //         },
    //
    //         logDrink: function(name) {
    //           var key = nameToKey(name);
    //           var beer = privateClient.getObject(key);
    //           beer.drinkCount++;
    //           privateClient.storeObject('beer', key, beer);
    //         },
    //
    //         publishBeer: function(name) {
    //           var key = nameToKey(name);
    //           var beer = privateClient.getObject(key);
    //           publicClient.storeObject('beer', key, beer);
    //         }
    //
    //       }
    //     }
    //   });
    //
    //   // to use that code from an app, you need to add:
    //
    //   remoteStorage.claimAccess('beers', 'rw');
    //
    //   remoteStorage.displayWidget(/* see documentation */)
    //
    //   remoteStorage.beers.addBeer('<replace-with-favourite-beer-kind>');
    //
    //   (end code)
    //
    // See also:
    //   <BaseClient>
    //
    defineModule: function(moduleName, builder) {

      if(! moduleNameRE.test(moduleName)) {
        throw 'Invalid moduleName: "'+moduleName+'", only a-z lowercase allowed.';
      }

      var module = builder(
        // private client:
        new BaseClient(moduleName, false),
        // public client:
        new BaseClient(moduleName, true)
      );
      modules[moduleName] = module;
      if(typeof(module) !== 'object' || typeof(module.exports) !== 'object') {
        throw new Error("Invalid module format for module '" + moduleName + "', no 'exports' object returned!");
      }
      this[moduleName] = module.exports;
    },

    claimedModules: claimedModules,

    //
    // Method: getModuleList
    //
    // list known module names
    //
    // Returns:
    //   Array of module names.
    //
    getModuleList: function() {
      return Object.keys(modules);
    },


    // Method: getClaimedModuleList
    //
    // list of modules currently claimed access on
    //
    // Returns:
    //   Array of module names.
    //
    getClaimedModuleList: function() {
      return Object.keys(claimedModules);
    },

    //
    // Method: getModuleInfo
    //
    // Retrieve meta-information about a given module.
    //
    // If the module doesn't exist, the result will be undefined.
    //
    // Parameters:
    //   moduleName - name of the module
    //
    // Returns:
    //   An object, usually containing the following keys,
    //   * exports - don't ever use this. it's basically the module's instance.
    //   * name - the name of the module, but you knew that already.
    //   * dataHints - an object, describing internas about the module.
    //
    //
    //   Some of the dataHints used are:
    //
    //     objectType <type> - description of an object
    //                         type implemented by the module
    //     "objectType message" - (example)
    //
    //     <attributeType> <objectType>#<attribute> - description of an attribute
    //
    //     "string message#subject" - (example)
    //
    //     directory <path> - description of a path's purpose
    //
    //     "directory documents/notes/" - (example)
    //
    //     item <path> - description of a specific item
    //
    //     "item documents/notes/calendar" - (example)
    //
    //   Hope this helps.
    //
    getModuleInfo: function(moduleName) {
      return modules[moduleName];
    },

    //
    // Method: claimAccess
    //
    // Either:
    //   <claimAccess(moduleName, claim)>
    //
    // Or:
    //   <claimAccess(moduleClaimMap)>
    //
    //
    //
    // Method: claimAccess(moduleName, claim)
    //
    // Claim access on a single module
    //
    // You need to claim access to a module before you can
    // access data from it.
    //
    // Parameters:
    //   moduleName - name of the module. For a list of defined modules, use <getModuleList>
    //   claim      - permission to claim, either *r* (read-only) or *rw* (read-write)
    //
    // Example:
    //   > remoteStorage.claimAccess('contacts', 'r');
    //
    //
    //
    // Method: claimAccess(moduleClaimMap)
    //
    // Claim access to multiple modules.
    //
    // Parameters:
    //   moduleClaimMap - a JSON object with module names as keys and claims as values.
    //
    // Example:
    //   > remoteStorage.claimAccess({
    //   >   contacts: 'r',
    //   >   documents: 'rw',
    //   >   money: 'r'
    //   > });
    //
    claimAccess: function(moduleName, mode) {

      var modeTestRegex = /^rw?$/;
      function testMode(moduleName, mode) {
        if(!modeTestRegex.test(mode)) {
          throw "Claimed access to module '" + moduleName + "' but mode not correctly specified ('" + mode + "').";
        }
      }

      var moduleObj;
      if(typeof moduleName === 'object') {
        moduleObj = moduleName;
      } else {
        testMode(moduleName, mode);
        moduleObj = {};
        moduleObj[moduleName] = mode;
      }

      return util.asyncEach(Object.keys(moduleObj), util.bind(function(_moduleName) {
        var _mode = moduleObj[_moduleName];
        testMode(_moduleName, _mode);
        return this.claimModuleAccess(_moduleName, _mode);
      }, this));
    },

    // PRIVATE
    claimModuleAccess: function(moduleName, mode) {
      logger.debug('claimModuleAccess', moduleName, mode);
      if(!(moduleName in modules)) {
        throw "Module not defined: " + moduleName;
      }

      if(moduleName in claimedModules) {
        return;
      }

      claimedModules[moduleName] = mode;

      if(moduleName === 'root') {
        moduleName = '';
        return store.setNodeAccess('/', mode).
          then(util.curry(store.setNodeForce, '/', true, true));
      } else {
        var privPath = '/'+moduleName+'/';
        var pubPath = '/public/'+moduleName+'/';
        return store.setNodeAccess(privPath, mode).
          then(util.curry(store.setNodeForce, privPath, true, true)).
          then(util.curry(store.setNodeAccess, pubPath, mode)).
          then(util.curry(store.setNodeForce, pubPath, true, true));
      }
    },

    // PRIVATE
    setBearerToken: function(bearerToken, claimedScopes) {
      wireClient.setBearerToken(bearerToken);
    },

    getBearerToken: function() {
      return wireClient.getBearerToken();
    },

    disconnectRemote : wireClient.disconnectRemote,

    //
    // Method: flushLocal()
    //
    // Forget this ever happened.
    //
    // Delete all locally stored data.
    // This doesn't clear localStorage, just removes everything
    // remoteStorage.js saved there. Other data your app might
    // have put into localStorage stays there.
    //
    // Call this method to implement "logout".
    //
    // If you are using the widget (which you should!), you don't need this.
    //
    // Example:
    //   > remoteStorage.flushLocal();
    //
    flushLocal       : function() {
      return util.getPromise(function(promise) {
        logger.info('flushLocal');
        store.forgetAll().then(promise.fulfill);
        sync.clearSettings();
        widget.clearSettings();
        schedule.reset();
        wireClient.disconnectRemote();
        i18n.clearSettings();
        claimedModules = {};
      });
    },

    //
    // Method: fullSync
    //
    // Synchronize local <-> remote storage.
    //
    // Syncing starts at the access roots (the once you claimed using claimAccess)
    // and moves down the directory tree.
    // Only nodes with a 'force' flag on themselves or one of their ancestors will
    // be synchronized. Use <BaseClient.use> and <BaseClient.release> to set / unset
    // force flags.
    // The actual changes to either local or remote storage happen in the
    // future, so you should attach change handlers on the modules you're
    // interested in.
    //
    // Parameters:
    //   callback - (optional) callback to be notified when synchronization has finished or failed.
    //
    // Example:
    //   >
    //   > remoteStorage.claimAccess('money', 'rw');
    //   >
    //   > remoteStorage.money.on('change', function(changeEvent) {
    //   >   // handle change event (update UI etc)
    //   > });
    //   >
    //   > remoteStorage.fullSync(function(errors) {
    //   >   // handle errors, if any.
    //   > });
    //
    // Yields:
    //   Array of error messages - when errors occured. When fullSync is called and the user is not connected, this is also considered an error.
    //   null - no error occured, synchronization finished gracefully.
    //
    fullSync: sync.fullSync,

    setWidgetView: widget.setView,

    //
    // Method: displayWidget
    //
    // Add the remoteStorage widget to the page.
    //
    // *Note* call <claimAccess> before calling displayWidget, otherwise you can't access any actual data.
    //
    // Parameters:
    //   element - (optional) DOM element to append the widget element, defaults to BODY element. May also be the ID of a DOM element.
    //   options - (optional) Options, as described below.
    //   options.locale - Locale to use for the widget. Currently ignored.
    //
    displayWidget: function(element, options) {
      widget.display(remoteStorage, element, util.extend({}, options));
    },

    //
    // Method: onWidget
    //
    // Add event handler to the widget.
    // See <widget.Events> for available Events.
    //
    // Parameters:
    //   eventType - type of event to add handler to
    //   handler   - handler function
    //
    onWidget: widget.on,

    //
    getSyncState: sync.getState,
    //
    setStorageInfo: wireClient.setStorageInfo,

    getStorageHref: wireClient.getStorageHref,

    getStorageType: wireClient.getStorageType,

    getStorageInfo: wireClient.getStorageInfo,

    disableSyncThrottling: sync.disableThrottling,

    nodeConnect: nodeConnect,

    util: util,

    // Method: getForeignClient
    //
    // Get a <ForeignClient> instance for a given user.
    //
    // Parameters:
    //   userAddress - a user address in the form user@host
    //   callback - a callback to receive the client
    //
    // If there is no storageInfo cached for this userAddress, this will trigger
    // a webfinger discovery and when that succeeded, return the client through
    // the callback.
    //
    // Example:
    //   (start code)
    //   var client = remoteStorage.getForeignClient('alice@wonderland.lit', function(error, client) {
    //     if(error) {
    //       console.error("Discovery failed: ", error);
    //     } else {
    //       client.getPublishedObjects(function(objects) {
    //         console.log('public stuff', objects);
    //       });
    //     }
    //   });
    //   (end code)
    getForeignClient: function(userAddress, callback) {
      var client = foreignClient.getClient(userAddress);
      if(wireClient.hasStorageInfo(userAddress)) {
        callback(null, client);
      } else {
        webfinger.getStorageInfo(
          userAddress, { timeout: 5000 }, function(err, storageInfo) {
            if(err) {
              callback(err);
            } else {
              wireClient.addStorageInfo(userAddress, storageInfo);
              callback(null, client);
            }
          }
        );
      }
    },

    getClient: function(scope) {
      return new BaseClient(scope);
    },

    // Property: store
    // Public access to <store>
    store: store,

    sync: sync,
    widget: widget,

    i18n: i18n,

    schedule: schedule

  };

  return remoteStorage;
});
