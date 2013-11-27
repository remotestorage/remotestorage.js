(function() {

  RemoteStorage.MODULES = {};
  /*
     Method: RemoteStorage.defineModule

     the defineModule method takes a module name and a builder function as parameters

     the function should return an object containtin an object called exports,
     which will be exported to any remoteStorage instance under the modules name.

     So when having an a locations module like in the example it would be accesible
     via remoteStorage.locations, which would have a features and collections property

     the function gets a private and a public client, which are both scopes,

     in this example the scope of priv is /locations

     and the scope of pub is /public/locations

     Example:
     (start code)
     remoteStorage.defineModule('locations', function(priv, pub) {
       return {
         exports: {
           features: priv.scope('features/').defaultType('feature'),
           collections: priv.scope('collections/').defaultType('feature-collection');
       }
     };
     (end code)
  });
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
