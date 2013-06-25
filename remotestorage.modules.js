(function() {

  RemoteStorage.MODULES = {};

  RemoteStorage.defineModule = function(moduleName, builder) {
    RemoteStorage.MODULES[moduleName] = builder;
  };

  RemoteStorage.prototype.loadModule = function(moduleName) {
    var builder = RemoteStorage.MODULES[moduleName];
    if(builder) {
      this[moduleName] = builder(new RemoteStorage.BaseClient(this, '/' + moduleName + '/'),
                                 new RemoteStorage.BaseClient(this, '/' + moduleName + '/public/'));
    } else {
      throw "Unknown module: " + moduleName;
    }
  };

  RemoteStorage.prototype.defineModule = function() {
    console.log("remoteStorage.defineModule is deprecated, use RemoteStorage.defineModule instead!");
    RemoteStorage.defineModule.apply(RemoteStorage, arguments);
  };

})();
