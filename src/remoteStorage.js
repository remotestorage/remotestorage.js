define(
  ['require', './lib/platform', './lib/couch', './lib/dav', './lib/getputdelete', './lib/webfinger', './lib/hardcoded', './lib/session', './lib/widget',
    './lib/baseClient', './lib/wireClient', './lib/sync'],
  function (require, platform, couch, dav, getputdelete, webfinger, hardcoded, session, widget, baseClient, wireClient, sync) {
    var modules = {},
      moduleVersions = {},
      defineModule = function(moduleName, builder) {
        modules[moduleName] = builder(baseClient.getInstance(moduleName, false), baseClient.getInstance(moduleName, true));
      },
      loadModule = function(moduleName, mode) {
        if(this[moduleName]) {
          return moduleVersions[moduleName];
        }
        this[moduleName] = modules[moduleName].exports;
        moduleVersions[moduleName] = modules[moduleName].version;
        if(moduleName == 'root') {
          moduleName = '';
          widget.addScope('/', mode);
        } else {
          widget.addScope('/'+moduleName+'/', mode);
          widget.addScope('/public/'+moduleName+'/', mode);
        }
        return moduleVersions[moduleName];
      };
  return {
    defineModule    : defineModule,
    loadModule      : loadModule,
    displayWidget   : widget.display,
    setStorageInfo  : session.setStorageInfo,
    setBearerToken  : function(bearerToken, claimedScopes) {
      session.setBearerToken(bearerToken);
      baseClient.claimScopes(claimedScopes);
    },
    disconnectRemote: session.disconnectRemote,
    flushLocal      : session.flushLocal,
    syncNow         : sync.syncNow
  };
});
