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

  var moduleVersions = {};

  var remoteStorage =  {

    /**
     ** PUBLIC ATTRIBUTES
     **/

    modules: {},

    /**
     ** PUBLIC METHODS
     **/

    defineModule: function(moduleName, builder) {
      console.log('DEFINE MODULE', moduleName);
      this.modules[moduleName] = builder(
        // private client:
        baseClient.getInstance(moduleName, false),
        // public client:
        baseClient.getInstance(moduleName, true)
      );
    },

    // Load module with given name, accessible with given mode.
    // Return the module's version.
    loadModule: function(moduleName, mode) {
      if(this[moduleName]) {
        return moduleVersions[moduleName];
      }
      var module = this.modules[moduleName];

      if(! module) {
        throw "Module not defined: " + moduleName;
      }

      this[moduleName] = module.exports;
      moduleVersions[moduleName] = module.version;
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
      return module.version
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
