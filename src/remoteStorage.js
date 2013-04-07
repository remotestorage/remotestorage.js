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
  './lib/i18n',
  './lib/access',
  './lib/caching'
], function(require, widget, store, sync, wireClient, nodeConnect, util, webfinger, foreignClient, BaseClient, schedule, i18n, Access, Caching) {

  "use strict";

  var modules = {}, moduleNameRE = /^[a-z\-]+$/;

  var logger = util.getLogger('base');

  util.silenceAllLoggers();
  util.unsilenceLogger('base', 'getputdelete');

  function deprecate(thing, replacement) {
    console.log("WARNING: " + thing + " is deprecated, " + (replacement ? "use " + replacement + " instead." : "without replacement."));
  }

  var _access = new Access();
  var _caching = new Caching();

  sync.setAccess(_access);
  sync.setCaching(_caching);
  BaseClient.setCaching(_caching);

  // Namespace: remoteStorage
  //
  // Main remoteStorage object, primary namespace.
  //
  // Provides an interface for defining modules, controlling the widget and configuring
  // access.
  //
  // Most methods here return promises. See the guide for an introduction: <Promises>
  var remoteStorage = {

    access: _access,
    caching: _caching,

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
    //           return privateClient.storeObject('beer', nameToKey(name), {
    //             name: name,
    //             drinkCount: 0
    //           });
    //         },
    //
    //         logDrink: function(name) {
    //           var key = nameToKey(name);
    //           return privateClient.getObject(key).then(function(beer) {
    //             beer.drinkCount++;
    //             return privateClient.storeObject('beer', key, beer);
    //           });
    //         },
    //
    //         publishBeer: function(name) {
    //           var key = nameToKey(name);
    //           return privateClient.getObject(key).then(function(beer) {
    //             return publicClient.storeObject('beer', key, beer);
    //           });
    //         }
    //
    //       }
    //     }
    //   });
    //
    //   // to use that code from an app, you need to add:
    //
    //   remoteStorage.claimAccess('beers', 'rw').then(function() {
    //     remoteStorage.displayWidget()
    //
    //     remoteStorage.beers.addBeer('<replace-with-favourite-beer-kind>');
    //   });
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
      deprecate('getClaimedModuleList', 'access.scopes');
      return this.access.scopes;
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
      var moduleInfo = modules[moduleName];
      if(moduleInfo) {
        return util.extend({
          name: moduleName,
          dataHints: {}
        }, moduleInfo);
      }
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
    //   > remoteStorage.claimAccess('contacts', 'r').then(remoteStorage.displayWidget).then(initApp);
    //
    // Returns:
    //   A Promise, fulfilled when the access has been claimed.
    //
    // FIXME: this method is currently asynchronous due to internal design issues, but it doesn't need to be.
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
    //   > }).then(remoteStorage.displayWidget).then(initApp);
    //
    // Returns:
    //   A Promise, fulfilled when the access has been claimed.
    //
    // FIXME: this method is currently asynchronous due to internal design issues, but it doesn't need to be.
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

      Object.keys(moduleObj).forEach(util.bind(function(_moduleName) {
        var _mode = moduleObj[_moduleName];
        testMode(_moduleName, _mode);
        return this.claimModuleAccess(_moduleName, _mode);
      }, this));

      // returned promise is deprecated!!!
      return util.getPromise().fulfill();
    },

    // PRIVATE
    claimModuleAccess: function(moduleName, mode) {
      logger.debug('claimModuleAccess', moduleName, mode);
      if(!(moduleName in modules)) {
        throw "Module not defined: " + moduleName;
      }

      if(this.access.get(moduleName)) {
        console.log('claimModuleAccess bailing', moduleName);
        return;
      }

      if(moduleName === 'root') {
        this.access.set(moduleName, mode);
        this.caching.set('/', { data: true });
      } else {
        var privPath = '/'+moduleName+'/';
        var pubPath = '/public/'+moduleName+'/';
        this.access.set(moduleName, mode);
        this.caching.set(privPath, { data: true });
        this.caching.set(pubPath, { data: true }); 
      }
    },

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
    //
    // Note that if you're using a localStorage backend, this doesn't
    // clear the entire localStorage, but just removes everything
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
    flushLocal       : function(all) {
      return util.getPromise(function(promise) {
        logger.info('flushLocal');
        sync.reset();
        widget.clearSettings();
        schedule.reset();
        wireClient.disconnectRemote();
        i18n.clearSettings();
        if(all === true) {
          this.access.reset();
          this.caching.reset();
        }
        store.forgetAll().then(promise.fulfill);
      }.bind(this));
    },

    wireClient: wireClient,

    //
    // Method: fullSync
    //
    // Synchronize local <-> remote storage.
    //
    // Syncing starts at the access roots (the ones you claimed using claimAccess)
    // and moves down the directory tree.
    // Only nodes with a 'force' flag on themselves or one of their ancestors will
    // be synchronized. Use <BaseClient.use> and <BaseClient.release> to set / unset
    // force flags.
    // The actual changes to either local or remote storage happen in the
    // future, so you should attach change handlers on the modules you're
    // interested in.
    //
    // Returns:
    //   A Promise.
    //
    // If you are interested when the sync is done, or if there were any errors,
    // chain to the promise as shown below.
    //
    // Example:
    //   >
    //   > remoteStorage.claimAccess('money', 'rw');
    //   >
    //   > remoteStorage.money.on('change', function(changeEvent) {
    //   >   // handle change event (update UI etc)
    //   > });
    //   >
    //   > remoteStorage.fullSync().then(function() {
    //   >   // sync done, do whatever you want.
    //   > }, function(error) {
    //   >   // handle error.
    //   > });
    //
    fullSync: sync.fullSync,

    //
    // Method: setWidgetView
    //
    // Set the view object to use by the widget. By default remoteStorage.js uses it's
    // own default view. The default view is designed to work in a browser. If you
    // are using any other platform, you need to implement your own view. See the
    // interface documentation for <WidgetView> for a description of the methods and
    // and events the view should implement.
    //
    // Example:
    //   >
    //   > var myView = {
    //   >   display: function() {
    //   >     // render the widget (or whatever)
    //   >   },
    //   >   // (...)
    //   > };
    //   >
    //   > remoteStorage.setWidgetView(myView);
    //   >
    //   > // claim access, display widget etc.
    //
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
    // Method: on
    //
    // Add event handler. Event handlers are bound on the <widget>, which
    // acts as a controller.
    // See <widget.Events> for available Events.
    //
    // Parameters:
    //   eventType - type of event to add handler to
    //   handler   - handler function
    //
    on: widget.on,

    // Method: onWidget
    // DEPRECATED. Alias for <on>.
    onWidget: function() {
      console.log("WARNING: remoteStorage.onWidget is deprecated, use remoteStorage.on instead.");
      this.on.apply(this, arguments);
    },

    //
    getSyncState: sync.getState,
    //
    setStorageInfo: function(storageInfo) {
      var info = wireClient.setStorageInfo(storageInfo);
      if(info) {
        this.access.setStorageType(info.type);
      }
      return info;
    },

    getStorageHref: wireClient.getStorageHref,

    getStorageType: wireClient.getStorageType,

    getStorageInfo: wireClient.getStorageInfo,

    disableSyncThrottling: sync.disableThrottling,

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

    schedule: schedule,

    // for tests only.
    // FIXME: get rid of this by making internas more accessible. can probably be
    //        done with some general redesign of this file.
    _clearModules: function() {
      modules = {};
    }

  };

  remoteStorage.nodeConnect = nodeConnect(remoteStorage);

  util.bindAll(remoteStorage);

  return remoteStorage;
});
