  var BaseClient = require('./baseclient');
  var RemoteStorage = require('./remotestorage');
  
  /*
   * Method: RemoteStorage.addModule
   *
   * Method for adding a remoteStorage data module
   *
   * Parameters:
   *   module - module object needs following properies:
   *       name - Name of the module
   *       builder    - Builder function defining the module
   *
   * The module builder function should return an object containing another
   * object called exports, which will be exported to this <RemoteStorage>
   * instance under the module's name. So when defining a locations module,
   * like in the example below, it would be accessible via
   * `remoteStorage.locations`, which would in turn have a `features` and a
   * `collections` property.
   *
   * The function receives a private and a public client, which are both
   * instances of <RemoteStorage.BaseClient>. In the following example, the
   * scope of privateClient is `/locations` and the scope of publicClient is
   * `/public/locations`.
   *
   * Example:
   *   (start code)
   *   RemoteStorage.addModule({name: 'locations', builder: function (privateClient, publicClient) {
   *     return {
   *       exports: {
   *         features: privateClient.scope('features/').defaultType('feature'),
   *         collections: privateClient.scope('collections/').defaultType('feature-collection')
   *       }
   *     };
   *   }});
   * (end code)
  */
 
  RemoteStorage.prototype.addModule = function (module) {
    var moduleName = module.name;
    var moduleBuilder = module.builder;
    Object.defineProperty(this, moduleName, {
      configurable: true,
      get: function () {
        var instance = this._loadModule(moduleName, moduleBuilder);
        Object.defineProperty(this, moduleName, {
          value: instance
        });
        return instance;
      }
    });

    if (moduleName.indexOf('-') !== -1) {
      var camelizedName = moduleName.replace(/\-[a-z]/g, function (s) {
        return s[1].toUpperCase();
      });
      Object.defineProperty(this, camelizedName, {
        get: function () {
          return this[moduleName];
        }
      });
    }
  };

  RemoteStorage.defineModule = function(moduleName, builder) {
    Object.defineProperty(RemoteStorage.prototype, moduleName, {
      configurable: true,
      get: function() {
        var instance = this._loadModule(moduleName, builder);
        Object.defineProperty(this, moduleName, {
          value: instance
        });
      }
    });

    if (moduleName.indexOf('-') !== -1) {
      var camelizedName = moduleName.replace(/\-[a-z]/g, function (s) {
        return s[1].toUpperCase();
      });
      Object.defineProperty(RemoteStorage.prototype, camelizedName, {
        get: function () {
          return this[moduleName];
        }
      });
    }
  }


  RemoteStorage.prototype._loadModule = function (moduleName, moduleBuilder) {
    if (moduleBuilder) {
      var module = moduleBuilder(new BaseClient(this, '/' + moduleName + '/'),
                           new BaseClient(this, '/public/' + moduleName + '/'));
      return module.exports;
    } else {
      throw "Unknown module: " + moduleName;
    }
  };
