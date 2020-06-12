const BaseClient = require('./baseclient');
const RemoteStorage = require('./remotestorage');

interface RSModule {
  name: string;
  builder: Function; // TODO detailed type
}

/*
 * Add remoteStorage data module
 *
 * @param {Object} module - module object needs following properies:
 * @param {string} [module.name] - Name of the module
 * @param {function} [module.builder] - Builder function defining the module
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
 * @example
 *   RemoteStorage.addModule({name: 'locations', builder: function (privateClient, publicClient) {
 *     return {
 *       exports: {
 *         features: privateClient.scope('features/').defaultType('feature'),
 *         collections: privateClient.scope('collections/').defaultType('feature-collection')
 *       }
 *     };
 *   }});
*/
RemoteStorage.prototype.addModule = function (module: RSModule): void {
  const moduleName = module.name;
  const moduleBuilder = module.builder;

  Object.defineProperty(this, moduleName, {
    configurable: true,
    get: function () {
      const instance = this._loadModule(moduleName, moduleBuilder);
      Object.defineProperty(this, moduleName, {
        value: instance
      });
      return instance;
    }
  });

  if (moduleName.indexOf('-') !== -1) {
    const camelizedName = moduleName.replace(/\-[a-z]/g, function (s) {
      return s[1].toUpperCase();
    });

    Object.defineProperty(this, camelizedName, {
      get: function () {
        return this[moduleName];
      }
    });
  }
};

/*
 * Load module
 *
 * @private
 *
 */
RemoteStorage.prototype._loadModule = function (moduleName: string, moduleBuilder: Function): { [key: string]: unknown }  {
  if (moduleBuilder) {
    const module = moduleBuilder(
      new BaseClient(this, '/' + moduleName + '/'),
      new BaseClient(this, '/public/' + moduleName + '/')
    );
    return module.exports;
  } else {
    throw "Unknown module: " + moduleName;
  }
};
