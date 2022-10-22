'use strict';

import type { StorageInfo } from './interfaces/storage_info';
import config from './config';
import log from './log';
import {
  applyMixins,
  getGlobalContext,
  getJSONFromLocalStorage,
  extend,
  localStorageAvailable
} from './util';

import Access from './access';
import Authorize from './authorize';
import BaseClient from './baseclient';
import Caching from './caching';
import IndexedDB from './indexeddb';
import InMemoryStorage from './inmemorystorage';
import LocalStorage from './localstorage';
import EventHandling from './eventhandling';
import GoogleDrive from './googledrive';
import Dropbox from './dropbox';
import Discover from './discover';
import SyncError from './sync-error';
import UnauthorizedError from './unauthorized-error';
import Features from './features';
import {Remote} from "./remote";

// TODO this is assigned to RemoteStorage.util later; check if still needed
import * as util from './util';
import {AuthorizeOptions} from "./interfaces/authorize_options";

interface RSModule {
  name: string;
  builder; // TODO detailed type
}

const globalContext = getGlobalContext();
// declare global {
//   interface Window { cordova: any };
// }

let hasLocalStorage: boolean;

// TODO document and/or refactor (seems weird)
function emitUnauthorized(r) {
  if (r.statusCode === 403  || r.statusCode === 401) {
    this._emit('error', new UnauthorizedError());
  }
  return Promise.resolve(r);
}

/**
* Check if interval is valid: numeric and between 2s and 1hr inclusive
*/
function isValidInterval(interval: unknown): interval is number {
  return (typeof interval === 'number' &&
          interval >= 2000 &&
          interval <= 3600000);
}

/**
 * Constructor for the remoteStorage object/instance
 *
 * This class primarily contains feature detection code and convenience API.
 *
 * Depending on which features are built in, it contains different attributes
 * and functions. See the individual features for more information.
 *
 * @param {object} config - an optional configuration object
 * @class
 */
class RemoteStorage {
  /**
   * Pending get/put/delete calls
   * @private
   */
  _pending: {[key: string]: any}[] = [];

  /**
   * TODO: document
   */
  _cleanups: [] = [];

  /**
   * TODO: document
   */
  _pathHandlers: { [key: string]: any } = { change: {} };

  /**
   * Holds OAuth app keys for Dropbox, Google Drive
   */
  apiKeys: {googledrive?: {clientId: string}; dropbox?: {appKey: string}} = {};

  /**
   * Holds the feature class instance, added by feature initialization
   * TODO use type Access
   */
  access: any;
  /**
   * Holds the feature class instance, added by feature initialization
   * TODO use type Sync
   */
  sync: any;
  /**
   * Holds the feature class instance, added by feature initialization
   */
  caching: Caching;

  // TODO use correct types, document
  _syncTimer: any;
  syncStopped: any;
  get: any;
  put: any;
  delete: any;

  backend: 'remotestorage' | 'dropbox' | 'googledrive';

  /**
   * Holds a WireClient, GoogleDrive or Dropbox instance, added by feature initialization
   */
  remote: Remote;

  /*
   * Access to the local caching backend used. Usually either a
   * <RemoteStorage.IndexedDB> or <RemoteStorage.LocalStorage> instance.
   *
   * Not available, when caching is turned off.
   */
  local: IndexedDB | LocalStorage | InMemoryStorage;

  dropbox: Dropbox;
  googledrive: GoogleDrive;

  fireInitial;

  on: any;

  constructor (cfg?: object) {
    // Initial configuration property settings.
    // TODO use modern JS to merge object properties
    if (typeof cfg === 'object') { extend(config, cfg); }

    this.addEvents([
      'ready', 'authing', 'connecting', 'connected', 'disconnected',
      'not-connected', 'conflict', 'error', 'features-loaded',
      'sync-interval-change', 'sync-req-done', 'sync-done',
      'wire-busy', 'wire-done', 'network-offline', 'network-online'
    ]);

    this._setGPD({
      get: this._pendingGPD('get'),
      put: this._pendingGPD('put'),
      delete: this._pendingGPD('delete')
    });

    hasLocalStorage = localStorageAvailable();

    if (hasLocalStorage) {
      this.apiKeys = getJSONFromLocalStorage('remotestorage:api-keys') || {};
      this.setBackend(localStorage.getItem('remotestorage:backend') || 'remotestorage');
    }

    // Keep a reference to the orginal `on` function
    const origOn = this.on;

    /**
     * Register an event handler. See :ref:`rs-events` for available event names.
     *
     * @param {string} eventName - Name of the event
     * @param {function} handler - Event handler
     */
    this.on = function (eventName: string, handler): void {
      if (this._allLoaded) {
        // check if the handler should be called immediately, because the
        // event has happened already
        switch(eventName) {
          case 'features-loaded':
            setTimeout(handler, 0);
            break;
          case 'ready':
            if (this.remote) {
              setTimeout(handler, 0);
            }
            break;
          case 'connected':
            if (this.remote && this.remote.connected) {
              setTimeout(handler, 0);
            }
            break;
          case 'not-connected':
            if (this.remote && !this.remote.connected) {
              setTimeout(handler, 0);
            }
            break;
        }
      }

      return origOn.call(this, eventName, handler);
    };

    // load all features and emit `ready`
    this._init();

    /**
     * TODO: document
     */
    this.fireInitial = function () {
      if (this.local) {
        setTimeout(this.local.fireInitial.bind(this.local), 0);
      }
    }.bind(this);

    this.on('ready', this.fireInitial.bind(this));
    this.loadModules();
  }

  /**
   * Indicating if remoteStorage is currently connected.
   */
  get connected (): boolean {
    return this.remote.connected;
  }

  // FIXME: Instead of doing this, would be better to only
  // export setAuthURL / getAuthURL from RemoteStorage prototype
  static Authorize = Authorize;

  static SyncError = SyncError;
  static Unauthorized = UnauthorizedError;
  static DiscoveryError = Discover.DiscoveryError;
  static util = util;

  /**
   * Load all modules passed as arguments
   * @private
   */
  loadModules(): void {
    config.modules.forEach(this.addModule.bind(this));
  }

  /**
   * Initiate the OAuth authorization flow.
   *
   * This function is called by custom storage backend implementations
   * (e.g. Dropbox or Google Drive).
   *
   * @param {object} options
   * @param {string} options.authURL - URL of the authorization endpoint
   * @param {string} [options.scope] - access scope
   * @param {string} [options.clientId] - client identifier (defaults to the
   *                                      origin of the redirectUri)
   * @private
   */
  authorize (options: AuthorizeOptions): void {
    this.access.setStorageType(this.remote.storageApi);
    if (typeof options.scope === 'undefined') {
      options.scope = this.access.scopeParameter;
    }

    if (globalContext.cordova) {
      options.redirectUri = config.cordovaRedirectUri;
    } else {
      const location = Authorize.getLocation();
      let redirectUri = location.origin;
      if (location.pathname !== '/') {
        redirectUri += location.pathname;
      }

      options.redirectUri = redirectUri;
    }

    if (typeof options.clientId === 'undefined') {
      options.clientId = options.redirectUri.match(/^(https?:\/\/[^/]+)/)[0];
    }

    Authorize.authorize(this, options);
  }

  /**
   * TODO: document
   * @private
   */
  impliedauth (storageApi?: string, redirectUri?: string): void {
    // TODO shouldn't these be default argument values?
    storageApi = storageApi || this.remote.storageApi;
    redirectUri = redirectUri || String(document.location);

    log('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
    // Set a fixed access token, signalling to not send it as Bearer
    this.remote.configure({
      token: Authorize.IMPLIED_FAKE_TOKEN
    });
    document.location.href = redirectUri;
  }

  /**
   * @property {object} remote
   *
   * Depending on the chosen backend, this is either an instance of ``WireClient``,
   * ``Dropbox`` or ``GoogleDrive``.
   *
   * @property {boolean} remote.connected - Whether or not a remote store is connected
   * @property {boolean} remote.online - Whether last sync action was successful or not
   * @property {string} remote.userAddress - The user address of the connected user
   * @property {string} remote.properties - The properties of the WebFinger link
   */

  /**
   * Connect to a remoteStorage server.
   *
   * Discovers the WebFinger profile of the given user address and initiates
   * the OAuth dance.
   *
   * This method must be called *after* all required access has been claimed.
   * When using the connect widget, it will call this method itself.
   *
   * Special cases:
   *
   * 1. If a bearer token is supplied as second argument, the OAuth dance
   *    will be skipped and the supplied token be used instead. This is
   *    useful outside of browser environments, where the token has been
   *    acquired in a different way.
   *
   * 2. If the Webfinger profile for the given user address doesn't contain
   *    an auth URL, the library will assume that client and server have
   *    established authorization among themselves, which will omit bearer
   *    tokens in all requests later on. This is useful for example when using
   *    Kerberos and similar protocols.
   *
   * @param {string} userAddress - The user address (user@host) or URL to connect to.
   * @param {string} token       - (optional) A bearer token acquired beforehand
   */
  connect (userAddress: string, token?: string): void {
    this.setBackend('remotestorage');
    if (userAddress.indexOf('@') < 0 && !userAddress.match(/^(https?:\/\/)?[^\s\/$\.?#]+\.[^\s]*$/)) {
      this._emit('error', new RemoteStorage.DiscoveryError("Not a valid user address or URL."));
      return;
    }

    // Prefix URL with https:// if it's missing
    if (userAddress.indexOf('@') < 0 && !userAddress.match(/^https?:\/\//)) {
      userAddress = `https://${userAddress}`;
    }

    if (globalContext.cordova) {
      if (typeof config.cordovaRedirectUri !== 'string') {
        this._emit('error', new RemoteStorage.DiscoveryError("Please supply a custom HTTPS redirect URI for your Cordova app"));
        return;
      }
      if (!globalContext.cordova.InAppBrowser) {
        this._emit('error', new RemoteStorage.DiscoveryError("Please include the InAppBrowser Cordova plugin to enable OAuth"));
        return;
      }
    }

    this.remote.configure({
      userAddress: userAddress
    });
    this._emit('connecting');

    const discoveryTimeout = setTimeout((): void => {
      this._emit('error', new RemoteStorage.DiscoveryError("No storage information found for this user address."));
    }, config.discoveryTimeout);

    Discover(userAddress).then((info: StorageInfo): void => {
      clearTimeout(discoveryTimeout);
      this._emit('authing');
      info.userAddress = userAddress;
      this.remote.configure(info);
      if (! this.remote.connected) {
        if (info.authURL) {
          if (typeof token === 'undefined') {
            // Normal authorization step; the default way to connect
            this.authorize({ authURL: info.authURL });
          } else if (typeof token === 'string') {
            // Token supplied directly by app/developer/user
            log('Skipping authorization sequence and connecting with known token');
            this.remote.configure({ token: token });
          } else {
            throw new Error("Supplied bearer token must be a string");
          }
        } else {
          // In lieu of an excplicit authURL, assume that the browser and
          // server handle any authorization needs; for instance, TLS may
          // trigger the browser to use a client certificate, or a 401 Not
          // Authorized response may make the browser send a Kerberos ticket
          // using the SPNEGO method.
          this.impliedauth();
        }
      }
    }, (/*err*/) => {
      clearTimeout(discoveryTimeout);
      this._emit('error', new RemoteStorage.DiscoveryError("No storage information found for this user address."));
    });
  }

  /**
   * Reconnect the remote server to get a new authorization.
   */
  reconnect (): void {
    this.remote.configure({ token: null });

    if (this.backend === 'remotestorage') {
      this.connect(this.remote.userAddress);
    } else {
      this.remote.connect();
    }
  }

  /**
   * "Disconnect" from remote server to terminate current session.
   *
   * This method clears all stored settings and deletes the entire local
   * cache.
   */
  disconnect (): void {
    if (this.remote) {
      this.remote.configure({
        userAddress: null,
        href: null,
        storageApi: null,
        token: null,
        properties: null
      });
    }
    this._setGPD({
      get: this._pendingGPD('get'),
      put: this._pendingGPD('put'),
      delete: this._pendingGPD('delete')
    });
    const n = this._cleanups.length;
    let i = 0;

    const oneDone = (): void => {
      i++;
      if (i >= n) {
        this._init();
        // FIXME Re-enable when modules are all imports
        // log('Done cleaning up, emitting disconnected and disconnect events');
        this._emit('disconnected');
      }
    };

    if (n > 0) {
      this._cleanups.forEach((cleanup: (thisarg: object) => Promise<void>) => {
        const cleanupResult = cleanup(this);
        if (typeof(cleanupResult) === 'object' && typeof(cleanupResult.then) === 'function') {
          cleanupResult.then(oneDone);
        } else {
          oneDone();
        }
      });
    } else {
      oneDone();
    }
  }

  /**
   * TODO: document
   * @private
   */
  setBackend (what): void {
    this.backend = what;
    if (hasLocalStorage) {
      if (what) {
        localStorage.setItem('remotestorage:backend', what);
      } else {
        localStorage.removeItem('remotestorage:backend');
      }
    }
  }

  /**
   * Add a "change" event handler to the given path. Whenever a "change"
   * happens (as determined by the backend, such as e.g.
   * <RemoteStorage.IndexedDB>) and the affected path is equal to or below the
   * given 'path', the given handler is called.
   *
   * You should usually not use this method directly, but instead use the
   * "change" events provided by :doc:`BaseClient </js-api/base-client>`
   *
   * @param {string} path - Absolute path to attach handler to
   * @param {function} handler - Handler function
   */
  onChange (path: string, handler): void {
    if (! this._pathHandlers.change[path]) {
      this._pathHandlers.change[path] = [];
    }
    this._pathHandlers.change[path].push(handler);
  }

  /**
   * TODO: do we still need this, now that we always instantiate the prototype?
   *
   * Enable remoteStorage logging.
   */
  enableLog (): void {
    config.logging = true;
  }

  /**
   * TODO: do we still need this, now that we always instantiate the prototype?
   *
   * Disable remoteStorage logging
   */
  disableLog (): void {
    config.logging = false;
  }

  /**
   * log
   *
   * The same as <RemoteStorage.log>.
   */
  log (...args): void {
    log.apply(RemoteStorage, args);
  }

  /**
   * Set the OAuth key/ID for either GoogleDrive or Dropbox backend support.
   *
   * @param {Object} apiKeys - A config object with these properties:
   * @param {string} [apiKeys.type] - Backend type: 'googledrive' or 'dropbox'
   * @param {string} [apiKeys.key] - Client ID for GoogleDrive, or app key for Dropbox
   */
  setApiKeys (apiKeys: {[key in ApiKeyType]?: string}): void | boolean {
    const validTypes: string[] = [ApiKeyType.GOOGLE, ApiKeyType.DROPBOX];
    if (typeof apiKeys !== 'object' || !Object.keys(apiKeys).every(type => validTypes.includes(type))) {
      console.error('setApiKeys() was called with invalid arguments') ;
      return false;
    }

    Object.keys(apiKeys).forEach(type => {
      const key = apiKeys[type];
      if (!key) { delete this.apiKeys[type]; return; }

      switch(type) {
        case ApiKeyType.DROPBOX:
          this.apiKeys[ApiKeyType.DROPBOX] = { appKey: key };
          if (typeof this.dropbox === 'undefined' ||
              this.dropbox.clientId !== key) {
            Dropbox._rs_init(this);
          }
          break;
        case ApiKeyType.GOOGLE:
          this.apiKeys[ApiKeyType.GOOGLE] = { clientId: key };
          if (typeof this.googledrive === 'undefined' ||
            this.googledrive.clientId !== key) {
            GoogleDrive._rs_init(this);
          }
          break;
      }
      return true;
    });

    if (hasLocalStorage) {
      localStorage.setItem('remotestorage:api-keys', JSON.stringify(this.apiKeys));
    }

  }

  /**
   * Set redirect URI to be used for the OAuth redirect within the
   * in-app-browser window in Cordova apps.
   *
   * @param uri - A valid HTTP(S) URI
   */
  setCordovaRedirectUri (uri: string): void {
    if (typeof uri !== 'string' || !uri.match(/http(s)?:\/\//)) {
      throw new Error("Cordova redirect URI must be a URI string");
    }
    config.cordovaRedirectUri = uri;
  }

  //
  // FEATURES INITIALIZATION
  //

  _init = Features.loadFeatures;
  features = Features.features;
  loadFeature = Features.loadFeature;
  featureSupported = Features.featureSupported;
  featureDone = Features.featureDone;
  featuresDone = Features.featuresDone;
  featuresLoaded = Features.featuresLoaded;
  featureInitialized = Features.featureInitialized;
  featureFailed = Features.featureFailed;
  hasFeature = Features.hasFeature;
  _setCachingModule = Features._setCachingModule;
  _collectCleanupFunctions = Features._collectCleanupFunctions;
  _fireReady = Features._fireReady;
  initFeature = Features.initFeature;

  //
  // GET/PUT/DELETE INTERFACE HELPERS
  //

  /**
   * TODO: document
   * @private
   */
  _setGPD (impl, context?) {
    function wrap(func) {
      return function (...args) {
        return func.apply(context, args)
          .then(emitUnauthorized.bind(this));
      };
    }
    this.get = wrap(impl.get);
    this.put = wrap(impl.put);
    this.delete = wrap(impl.delete);
  }

  /**
   * TODO: document
   * @private
   */
  _pendingGPD (methodName): () => Promise<unknown> {
    return (...args) => {
      const methodArguments = Array.prototype.slice.call(args);
      return new Promise((resolve, reject) => {
        this._pending.push({
          method: methodName,
          args: methodArguments,
          promise: {
            resolve: resolve,
            reject: reject
          }
        });
      });
    };
  }

  /**
   * TODO: document
   * @private
   */
  _processPending (): void {
    this._pending.forEach((pending) => {
      try {
        this[pending.method](...pending.args).then(pending.promise.resolve, pending.promise.reject);
      } catch(e) {
        pending.promise.reject(e);
      }
    });
    this._pending = [];
  }

  //
  // CHANGE EVENT HANDLING
  //

  /**
   * TODO: document
   * @private
   */
  _bindChange (object: { on }): void {
    object.on('change', this._dispatchEvent.bind(this, 'change'));
  }

  /**
   * TODO: document
   * @private
   */
  _dispatchEvent (eventName: string, event): void {
    Object.keys(this._pathHandlers[eventName]).forEach((path: string) => {
      const pl = path.length;
      if (event.path.substr(0, pl) === path) {
        this._pathHandlers[eventName][path].forEach((handler) => {
          const ev: { relativePath?: string } = {};
          for (const key in event) { ev[key] = event[key]; }
          ev.relativePath = event.path.replace(new RegExp('^' + path), '');
          try {
            handler(ev);
          } catch(e) {
            console.error("'change' handler failed: ", e, e.stack);
            this._emit('error', e);
          }
        });
      }
    });
  }

  /**
   * This method enables you to quickly instantiate a BaseClient, which you can
   * use to directly read and manipulate data in the connected storage account.
   *
   * Please use this method only for debugging and development, and choose or
   * create a :doc:`data module </data-modules>` for your app to use.
   *
   * @param path - The base directory of the BaseClient that will be returned
   *               (with a leading and a trailing slash)
   *
   * @returns A client with the specified scope (category/base directory)
   */
  scope (path: string): BaseClient {
    if (typeof(path) !== 'string') {
      throw 'Argument \'path\' of baseClient.scope must be a string';
    }
    if (!this.access.checkPathPermission(path, 'r')) {
      console.warn('WARNING: Please use remoteStorage.access.claim() to ask for access permissions first: https://remotestoragejs.readthedocs.io/en/latest/js-api/access.html#claim');
    }
    return new BaseClient(this, path);
  }

  /**
   * Get the value of the sync interval when application is in the foreground
   *
   * @returns {number} A number of milliseconds
   */
  getSyncInterval (): number {
    return config.syncInterval;
  }

  /**
   * Set the value of the sync interval when application is in the foreground
   *
   * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
   */
  setSyncInterval (interval: number): void {
    if (!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    const oldValue = config.syncInterval;
    config.syncInterval = interval;
    this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
  }

  /**
   * Get the value of the sync interval when application is in the background
   *
   * @returns A number of milliseconds
   */
  getBackgroundSyncInterval (): number {
    return config.backgroundSyncInterval;
  }

  /**
   * Set the value of the sync interval when the application is in the
   * background
   *
   * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
   */
  setBackgroundSyncInterval (interval: number): void {
    if (!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    const oldValue = config.backgroundSyncInterval;
    config.backgroundSyncInterval = interval;
    this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
  }

  /**
   * Get the value of the current sync interval. Can be background or
   * foreground, custom or default.
   *
   * @returns {number} A number of milliseconds
   */
  getCurrentSyncInterval (): number {
    return config.isBackground ? config.backgroundSyncInterval : config.syncInterval;
  }

  /**
   * Get the value of the current network request timeout
   *
   * @returns {number} A number of milliseconds
   */
  getRequestTimeout (): number {
    return config.requestTimeout;
  }

  /**
   * Set the timeout for network requests.
   *
   * @param timeout - Timeout in milliseconds
   */
  setRequestTimeout (timeout: number): void {
    if (typeof timeout !== 'number') {
      throw timeout + " is not a valid request timeout";
    }
    config.requestTimeout = timeout;
  }

  /**
   * TODO: document
   * @private
   */
  syncCycle (): void {
    if (!this.sync || this.sync.stopped) { return; }

    this.on('sync-done', (): void => {
      // FIXME Re-enable when modules are all imports
      // log('[Sync] Sync done. Setting timer to', this.getCurrentSyncInterval());
      if (this.sync && !this.sync.stopped) {
        if (this._syncTimer) {
          clearTimeout(this._syncTimer);
          this._syncTimer = undefined;
        }
        this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getCurrentSyncInterval());
      }
    });

    this.sync.sync();
  }

  /**
   * Start synchronization with remote storage, downloading and uploading any
   * changes within the cached paths.
   *
   * Please consider: local changes will attempt sync immediately, and remote
   * changes should also be synced timely when using library defaults. So
   * this is mostly useful for letting users sync manually, when pressing a
   * sync button for example. This might feel safer to them sometimes, esp.
   * when shifting between offline and online a lot.
   *
   * @returns {Promise} A Promise which resolves when the sync has finished
   */
  startSync (): Promise<void> {
    if (!config.cache) {
      console.warn('Nothing to sync, because caching is disabled.');
      return Promise.resolve();
    }
    this.sync.stopped = false;
    this.syncStopped = false;
    return this.sync.sync();
  }

  /**
   * Stop the periodic synchronization.
   */
  stopSync (): void {
    clearTimeout(this._syncTimer);
    this._syncTimer = undefined;

    if (this.sync) {
      // FIXME Re-enable when modules are all imports
      // log('[Sync] Stopping sync');
      this.sync.stopped = true;
    } else {
      // The sync class has not been initialized yet, so we make sure it will
      // not start the syncing process as soon as it's initialized.
      // FIXME Re-enable when modules are all imports
      // log('[Sync] Will instantiate sync stopped');
      this.syncStopped = true;
    }
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
  addModule (module: RSModule): void {
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
  }

  /**
   * Load module
   * @private
   */
  _loadModule (moduleName: string, moduleBuilder): { [key: string]: unknown }  {
    if (moduleBuilder) {
      const module = moduleBuilder(
        new BaseClient(this, '/' + moduleName + '/'),
        new BaseClient(this, '/public/' + moduleName + '/')
      );
      return module.exports;
    } else {
      throw "Unknown module: " + moduleName;
    }
  }
}

/**
 * @property access
 *
 * Tracking claimed access scopes. A <RemoteStorage.Access> instance.
*/
Object.defineProperty(RemoteStorage.prototype, 'access', {
  get: function() {
    const access = new Access();
    Object.defineProperty(this, 'access', {
      value: access
    });
    return access;
  },
  configurable: true
});

// TODO Clean up/harmonize how modules are loaded and/or document this architecture properly
//
// At this point the remoteStorage object has not been created yet.
// Only its prototype exists so far, so we define a self-constructing
// property on there:

/**
 * Property: caching
 *
 * Caching settings. A <RemoteStorage.Caching> instance.
 */
// FIXME Was in rs_init of Caching but don't want to require RemoteStorage from there.
Object.defineProperty(RemoteStorage.prototype, 'caching', {
  configurable: true,
  get: function () {
    const caching = new Caching();
    Object.defineProperty(this, 'caching', {
      value: caching
    });
    return caching;
  }
});

interface RemoteStorage extends EventHandling {}
applyMixins(RemoteStorage, [EventHandling]);

enum ApiKeyType {
  GOOGLE = 'googledrive',
  DROPBOX = 'dropbox'
}

export = RemoteStorage;
