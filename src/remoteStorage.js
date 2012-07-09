define([
  'require',
  './lib/platform',
  './lib/couch',
  './lib/dav',
  './lib/getputdelete',
  './lib/webfinger',
  './lib/hardcoded',
  './lib/session',
  './lib/widget',
  './lib/baseClient',
  './lib/wireClient',
  './lib/sync'
], function(require, platform, couch, dav, getputdelete, webfinger, hardcoded,
            session, widget, baseClient, wireClient, sync) {

  var loadedModules = {}, modules = {};

  var remoteStorage =  {

    /**
     ** PUBLIC METHODS
     **/

    defineModule: function(moduleName, builder) {
      console.log('DEFINE MODULE', moduleName);
      modules[moduleName] = builder(
        // private client:
        baseClient.getInstance(moduleName, false),
        // public client:
        baseClient.getInstance(moduleName, true)
      );
    },

    getModuleList: function() {
      return Object.keys(modules);
    },

    getLoadedModuleList: function() {
      return Object.keys(loadedModules);
    },

    getModuleInfo: function(moduleName) {
      return modules[moduleName];
    },

    // Load module with given name, accessible with given mode.
    // Return the module's version.
    loadModule: function(moduleName, mode) {
      if(moduleName in loadedModules) {
        return;
      }
      var module = modules[moduleName];

      if(! mode) {
        mode = 'r';
      }

      if(! module) {
        throw "Module not defined: " + moduleName;
      }

      this[moduleName] = module.exports;
      if(moduleName == 'root') {
        moduleName = '';
        widget.addScope('/', mode);
        baseClient.claimAccess('/', mode);
      } else {
        widget.addScope('/'+moduleName+'/', mode);
        baseClient.claimAccess('/'+moduleName+'/', mode);
        widget.addScope('/public/'+moduleName+'/', mode);
        baseClient.claimAccess('/public/'+moduleName+'/', mode);
      }

      loadedModules[moduleName] = true;
    },

    setBearerToken: function(bearerToken, claimedScopes) {
      session.setBearerToken(bearerToken);
      baseClient.claimScopes(claimedScopes);
    },

    /**
     ** DELEGATED METHODS
     **/

    disconnectRemote : session.disconnectRemote,
    flushLocal       : session.flushLocal,
    syncNow          : sync.syncNow,
    displayWidget    : widget.display,
    setStorageInfo   : session.setStorageInfo

  };

  remoteStorage.defineModule('root', function(client) {
    return {
      exports: {
        getListing: client.getListing
      }
    }
  });


  return remoteStorage;
});
