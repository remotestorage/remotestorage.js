(function() {

  RemoteStorage.MODULES = {};
  /*
     Method: RemoteStorage.defineModule

     The defineModule method takes a module name and a builder function as parameters.

     The function should return an object containing an object called exports,
     which will be exported to any remoteStorage instance under the module's name.

     So when having an a locations module, like in the example, it would be accessible
     via remoteStorage.locations, which would have a features and collections property.

     The function gets a private and a public client, which are both
     scopes. In this example the scope of privateClient is /locations and the
     scope of publicClient is /public/locations.

     Example:
     (start code)
     RemoteStorage.defineModule('locations', function(privateClient, publicClient) {
       return {
         exports: {
           features: privateClient.scope('features/').defaultType('feature'),
           collections: privateClient.scope('collections/').defaultType('feature-collection')
         }
       };
     });
     (end code)
  */

  RemoteStorage.defineModule = function(moduleName, builder) {
    RemoteStorage.MODULES[moduleName] = builder;

    Object.defineProperty(RemoteStorage.prototype, moduleName, {
      configurable: true,
      get: function() {
        var instance = this._loadModule(moduleName);
        Object.defineProperty(this, moduleName, {
          value: instance
        });
        return instance;
      }
    });

    if (moduleName.indexOf('-') !== -1) {
      var camelizedName = moduleName.replace(/\-[a-z]/g, function(s) {
        return s[1].toUpperCase();
      });
      Object.defineProperty(RemoteStorage.prototype, camelizedName, {
        get: function() {
          return this[moduleName];
        }
      });
    }
  };

  RemoteStorage.prototype._loadModule = function(moduleName) {
    var builder = RemoteStorage.MODULES[moduleName];
    if (builder) {
      var module = builder(new RemoteStorage.BaseClient(this, '/' + moduleName + '/'),
                           new RemoteStorage.BaseClient(this, '/public/' + moduleName + '/'));
      return module.exports;
    } else {
      throw "Unknown module: " + moduleName;
    }
  };

  RemoteStorage.prototype.defineModule = function(moduleName) {
    console.log("remoteStorage.defineModule is deprecated, use RemoteStorage.defineModule instead!");
    RemoteStorage.defineModule.apply(RemoteStorage, arguments);
  };

})();
