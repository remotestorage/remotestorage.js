'use strict';

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
import { EventHandling, EventHandler } from './eventhandling';
import GoogleDrive from './googledrive';
import Dropbox from './dropbox';
import Discover from './discover';
import SyncError from './sync-error';
import UnauthorizedError from './unauthorized-error';
import Features from './features';
import { Remote } from "./remote";

import type { AuthorizeOptions } from './authorize';
import type { StorageInfo } from './interfaces/storage_info';
import type { Sync } from './sync';

// TODO this is assigned to RemoteStorage.util later; check if still needed
import * as util from './util';

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
 * Represents a data module
 *
 * @example
 * ```js
 * {
 *   name: 'examples',
 *   builder: function(privateClient, publicClient) {
 *     return {
 *       exports: {
 *         addItem(item): function() {
 *           // Generate a random ID/path
 *           const path = [...Array(10)].map(() => String.fromCharCode(Math.floor(Math.random() * 95) + 32)).join('');
 *           // Store the object, and ensure it conforms to the JSON Schema
 *           // type `example-item`
 *           privateClient.storeObject('example-item', path, item);
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */
export interface RSModule {
  /**
   * The module's name, which is also the category (i.e. base folder) for document URLs on the remote storage
   */
  name: string;
  /**
   * A module builder function, which defines the actual module
   */
  builder: (privateClient: BaseClient, publicClient: BaseClient) => {
    exports: {
      [key: string]: any;
    };
  };
}

enum ApiKeyType {
  GOOGLE = 'googledrive',
  DROPBOX = 'dropbox'
}

/**
 * Create a `remoteStorage` class instance so:
 *
 * ```js
 * const remoteStorage = new RemoteStorage();
 * ```
 *
 * The constructor can optionally be called with a configuration object. This
 * example shows all default values:
 *
 * ```js
 * const remoteStorage = new RemoteStorage({
 *   cache: true,
 *   changeEvents: {
 *     local:    true,
 *     window:   false,
 *     remote:   true,
 *     conflict: true
 *   },
 *   cordovaRedirectUri: undefined,
 *   logging: false,
 *   modules: []
 * });
 * ```
 *
 * > [!NOTE]
 * > In the current version, it is only possible to use a single `remoteStorage`
 * > instance. You cannot connect to two different remotes in parallel yet.
 * > We intend to support this eventually.
 *
 * > [!TIP]
 * > For the change events configuration, you have to set all events
 * > explicitly.  Otherwise it disables the unspecified ones.
 *
 * ## Events
 *
 * You can add event handlers to your `remoteStorage` instance by using the
 * {@link on} function. For example:
 *
 * ```js
 * remoteStorage.on('connected', function() {
 *   // Storage account has been connected, let’s roll!
 * });
 * ```
 *
 * ### `ready`
 *
 * Emitted when all features are loaded and the RS instance is ready to be used
 * in your app
 *
 * ### `not-connected`
 *
 * Emitted when ready, but no storage connected ("anonymous mode")
 *
 * ### `connected`
 *
 * Emitted when a remote storage has been connected
 *
 * ### `disconnected`
 *
 * Emitted after disconnect
 *
 * ### `error`
 *
 * Emitted when an error occurs; receives an error object as argument
 *
 * There are a handful of known errors, which are identified by the `name`
 * property of the error object:
 *
 * * `Unauthorized`
 *
 *   Emitted when a network request resulted in a 401 or 403 response. You can
 *   use this event to handle invalid OAuth tokens in custom UI (i.e. when a
 *   stored token has been revoked or expired by the RS server).
 *
 * * `DiscoveryError`
 *
 *   A variety of storage discovery errors, e.g. from user address input
 *   validation, or user address lookup issues
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('error', err => console.log(err));
 *
 * // {
 * //   name: "Unauthorized",
 * //   message: "App authorization expired or revoked.",
 * //   stack: "Error↵  at new a.Unauthorized (vendor.js:65710:41870)"
 * // }
 * ```
 *
 * ### `connecting`
 *
 * Emitted before webfinger lookup
 *
 * ### `authing`
 *
 * Emitted before redirecting to the OAuth server
 *
 * ### `wire-busy`
 *
 * Emitted when a network request starts
 *
 * ### `wire-done`
 *
 * Emitted when a network request completes
 *
 * ### `sync-started`
 *
 * Emitted when a sync procedure has started.
 *
 * ### `sync-req-done`
 *
 * Emitted when a single sync request has finished. Callback functions
 * receive an object as argument, informing the client of remaining items
 * in the current sync task queue.
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('sync-req-done', result => console.log(result));
 * // { tasksRemaining: 21 }
 * ```
 *
 * > [!NOTE]
 * > The internal task queue holds at most 100 items at the same time,
 * > regardless of the overall amount of items to sync. Therefore, this number
 * > is only an indicator of sync status, not a precise amount of items left
 * > to sync. It can be useful to determine if your app should display any
 * > kind of sync status/progress information for the cycle or not.
 *
 * ### `sync-done`
 *
 * Emitted when a sync cycle has been completed and a new sync is scheduled.
 *
 * The callback function receives an object as argument, informing the client
 * if the sync process has completed successfully or not.
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('sync-done', result => console.log(result));
 * // { completed: true }
 * ```
 *
 * If `completed` is `false`, it means that some of the sync requests have
 * failed and will be retried in the next sync cycle (usually a few seconds
 * later in this case). This is not an unusual scenario on mobile networks or
 * when doing a large initial sync for example.
 *
 * For an app's user interface, you may want to consider the sync process as
 * ongoing in this case, and wait until your app sees a positive `completed`
 * status before updating the UI.
 *
 * ### `network-offline`
 *
 * Emitted once when a wire request fails for the first time, and
 * `remote.online` is set to false
 *
 * ### `network-online`
 *
 * Emitted once when a wire request succeeds for the first time after a failed
 * one, and `remote.online` is set back to true
 *
 * ### `sync-interval-change`
 *
 * Emitted when the sync interval changes
 */
export class RemoteStorage {
  /**
   * Pending get/put/delete calls
   * @internal
   */
  _pending: {[key: string]: any}[] = [];

  /**
   * TODO: document
   * @internal
   */
  _cleanups: [] = [];

  /**
   * TODO: document
   * @internal
   */
  _pathHandlers: { [key: string]: any } = { change: {} };

  /**
   * Holds OAuth app keys for Dropbox, Google Drive
   * @internal
   */
  apiKeys: {googledrive?: {clientId: string}; dropbox?: {appKey: string}} = {};

  /**
   */
  access: Access;
  /**
   */
  sync: Sync;
  /**
   */
  caching: Caching;

  /**
   * @internal
   */
  _syncTimer: any;
  /**
   * @internal
   */
  syncStopped: boolean;
  /**
   * @internal
   */
  get: Function;
  /**
   * @internal
   */
  put: Function;
  /**
   * @internal
   */
  delete: Function;

  /**
   */
  backend: 'remotestorage' | 'dropbox' | 'googledrive';

  /**
   * Depending on the chosen backend, this is either an instance of `WireClient`,
   * `Dropbox` or `GoogleDrive`.
   *
   * See {@link Remote} for public API
   *
   * @example
   * remoteStorage.remote.connected
   * // false
   */
  remote: Remote;

  /**
   * Access to the local caching backend used. Usually either a
   * `RemoteStorage.IndexedDB` or `RemoteStorage.LocalStorage` instance.
   *
   * Not available, when caching is turned off.
   *
   * @internal
   */
  local: IndexedDB | LocalStorage | InMemoryStorage;

  /**
   * @internal
   */
  dropbox: Dropbox;
  /**
   * @internal
   */
  googledrive: GoogleDrive;

  /**
   * @internal
   */
  fireInitial: Function;


  constructor (cfg?: object) {
    // Initial configuration property settings.
    // TODO use modern JS to merge object properties
    if (typeof cfg === 'object') { extend(config, cfg); }

    this.addEvents([
      'ready', 'authing', 'connecting', 'connected', 'disconnected',
      'not-connected', 'conflict', 'error', 'features-loaded',
      'sync-interval-change', 'sync-started', 'sync-req-done', 'sync-done',
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

      const backendType = localStorage.getItem('remotestorage:backend');

      if (backendType === 'dropbox' || backendType === 'googledrive') {
        this.setBackend(backendType);
      } else {
        this.setBackend('remotestorage');
      }
    }

    // Keep a reference to the orginal `on` function
    const origOn = this.on;

    this.on = function (eventName: string, handler: Function): void {
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

  /**
   * FIXME: Instead of doing this, would be better to only
   * export setAuthURL / getAuthURL from RemoteStorage prototype
   *
   * @ignore
   */
  static Authorize = Authorize;

  static SyncError = SyncError;
  static Unauthorized = UnauthorizedError;
  static DiscoveryError = Discover.DiscoveryError;
  static util = util;

  /**
   * Load all modules passed as arguments
   *
   * @internal
   */
  loadModules(): void {
    config.modules.forEach(this.addModule.bind(this));
  }

  /**
   * Initiate the OAuth authorization flow.
   *
   * @internal
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
   * @internal
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
   * Connect to a remoteStorage server.
   *
   * Discovers the WebFinger profile of the given user address and initiates
   * the OAuth dance.
   *
   * This method must be called *after* all required access has been claimed.
   * When using the connect widget, it will call this method when the user
   * clicks/taps the "connect" button.
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
   * @param userAddress - The user address (user@host) or URL to connect to.
   * @param token       - (optional) A bearer token acquired beforehand
   *
   * @example
   * remoteStorage.connect('user@example.com');
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

    Discover(userAddress).then((info: StorageInfo): void => {
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
      this._emit('error', new RemoteStorage.DiscoveryError("No storage information found for this user address."));
    });
  }

  /**
   * Reconnect the remote server to get a new authorization.
   *
   * Useful when not using the connect widget and encountering an
   * `Unauthorized` event.
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
        log('Cleanups done, emitting "disconnected" event');
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
   * @internal
   */
  setBackend (backendType: 'remotestorage' | 'dropbox' | 'googledrive'): void {
    this.backend = backendType;

    if (hasLocalStorage) {
      if (typeof backendType !== 'undefined') {
        localStorage.setItem('remotestorage:backend', backendType);
      } else {
        localStorage.removeItem('remotestorage:backend');
      }
    }
  }

  /**
   * Add a `change` event handler for the given path. Whenever a change
   * happens (as determined by the local backend, such as e.g.
   * `RemoteStorage.IndexedDB`), and the affected path is equal to or below the
   * given 'path', the given handler is called.
   *
   * > [!TIP]
   * > You should usually not use this method, but instead use the
   * > `change` events provided by {@link BaseClient}.
   *
   * @param path - Absolute path to attach handler to
   * @param handler - A function to handle the change
   *
   * @example
   * remoteStorage.onChange('/bookmarks/', function() {
   *   // your code here
   * })
   */
  onChange (path: string, handler: EventHandler): void {
    if (! this._pathHandlers.change[path]) {
      this._pathHandlers.change[path] = [];
    }
    this._pathHandlers.change[path].push(handler);
  }

  /**
   * Enable remoteStorage debug logging.
   *
   * Usually done when instantiating remoteStorage:
   *
   * ```js
   * const remoteStorage = new RemoteStorage({ logging: true });
   * ```
   */
  enableLog (): void {
    config.logging = true;
  }

  /**
   * Disable remoteStorage debug logging
   */
  disableLog (): void {
    config.logging = false;
  }

  /**
   * Log something to the debug log
   *
   * @internal
   */
  log (...args): void {
    log.apply(RemoteStorage, args);
  }

  /**
   * Set the OAuth key/ID for GoogleDrive and/or Dropbox backend support.
   *
   * @param apiKeys - A config object
   *
   * @example
   * remoteStorage.setApiKeys({
   *   dropbox: 'your-app-key',
   *   googledrive: 'your-client-id'
   * });
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
   * in-app-browser window in Cordova apps. See
   * [Usage in Cordova apps](../../../cordova) for details.
   *
   * @param uri - A valid HTTP(S) URI
   *
   * @example
   * remoteStorage.setCordovaRedirectUri('https://app.example.com');
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

  /**
   * @internal
   */
  _init = Features.loadFeatures;
  /**
   * @internal
   */
  features = Features.features;
  /**
   * @internal
   */
  loadFeature = Features.loadFeature;
  /**
   * @internal
   */
  featureSupported = Features.featureSupported;
  /**
   * @internal
   */
  featureDone = Features.featureDone;
  /**
   * @internal
   */
  featuresDone = Features.featuresDone;
  /**
   * @internal
   */
  featuresLoaded = Features.featuresLoaded;
  /**
   * @internal
   */
  featureInitialized = Features.featureInitialized;
  /**
   * @internal
   */
  featureFailed = Features.featureFailed;
  /**
   * @internal
   */
  hasFeature = Features.hasFeature;
  /**
   * @internal
   */
  _setCachingModule = Features._setCachingModule;
  /**
   * @internal
   */
  _collectCleanupFunctions = Features._collectCleanupFunctions;
  /**
   * @internal
   */
  _fireReady = Features._fireReady;
  /**
   * @internal
   */
  initFeature = Features.initFeature;

  //
  // GET/PUT/DELETE INTERFACE HELPERS
  //

  /**
   * TODO: document
   * @internal
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
   * @internal
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
   * @internal
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
   * @internal
   */
  _bindChange (object: { on }): void {
    object.on('change', this._dispatchEvent.bind(this, 'change'));
  }

  /**
   * TODO: document
   * @internal
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
   * This method allows you to quickly instantiate a BaseClient, which you can
   * use to directly read and manipulate data in the connected storage account.
   *
   * Please use this method only for debugging and development, and choose or
   * create a [data module](../../../data-modules/) for your app to use.
   *
   * @param path - The base directory of the BaseClient that will be returned
   *               (with a leading and a trailing slash)
   *
   * @returns A client with the specified scope (category/base directory)
   *
   * @example
   * remoteStorage.scope('/pictures/').getListing('');
   * remoteStorage.scope('/public/pictures/').getListing('');
   */
  scope (path: string): BaseClient {
    if (typeof(path) !== 'string') {
      throw 'Argument \'path\' of baseClient.scope must be a string';
    }
    if (!this.access.checkPathPermission(path, 'r')) {
      console.warn('WARNING: Please use remoteStorage.access.claim() to ask for access permissions first: https://remotestorage.io/rs.js/docs/api/access/classes/Access.html#claim');
    }
    return new BaseClient(this, path);
  }

  /**
   * Get the value of the sync interval when application is in the foreground
   *
   * @returns A number of milliseconds
   *
   * @example
   * remoteStorage.getSyncInterval();
   * // 10000
   */
  getSyncInterval (): number {
    return config.syncInterval;
  }

  /**
   * Set the value of the sync interval when application is in the foreground
   *
   * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
   *
   * @example
     remoteStorage.setSyncInterval(20000);
   */
  setSyncInterval (interval: number): void {
    if (!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    const oldValue = config.syncInterval;
    config.syncInterval = interval;

    this._emit('sync-interval-change', {
      oldValue: oldValue,
      newValue: interval
    });
  }

  /**
   * Get the value of the sync interval when application is in the background
   *
   * @returns A number of milliseconds
   *
   * @example
   * remoteStorage.getBackgroundSyncInterval();
   * // 60000
   */
  getBackgroundSyncInterval (): number {
    return config.backgroundSyncInterval;
  }

  /**
   * Set the value of the sync interval when the application is in the
   * background
   *
   * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
   *
   * @example
   * remoteStorage.setBackgroundSyncInterval(90000);
   */
  setBackgroundSyncInterval (interval: number): void {
    if (!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    const oldValue = config.backgroundSyncInterval;
    config.backgroundSyncInterval = interval;

    this._emit('sync-interval-change', {
      oldValue: oldValue,
      newValue: interval
    });
  }

  /**
   * Get the value of the current sync interval. Can be background or
   * foreground, custom or default.
   *
   * @returns number of milliseconds
   *
   * @example
   * remoteStorage.getCurrentSyncInterval();
   * // 15000
   */
  getCurrentSyncInterval (): number {
    return config.isBackground ? config.backgroundSyncInterval : config.syncInterval;
  }

  /**
   * Get the value of the current network request timeout
   *
   * @returns A number of milliseconds
   *
   * @example
   * remoteStorage.getRequestTimeout();
   * // 30000
   */
  getRequestTimeout (): number {
    return config.requestTimeout;
  }

  /**
   * Set the timeout for network requests.
   *
   * @param timeout - Timeout in milliseconds
   *
   * @example
   * remoteStorage.setRequestTimeout(30000);
   */
  setRequestTimeout (timeout: number): void {
    if (typeof timeout !== 'number') {
      throw timeout + " is not a valid request timeout";
    }
    config.requestTimeout = timeout;
  }

  /**
   * Add a handler to schedule periodic sync if sync enabled
   *
   * @internal
   */
  setupSyncCycle (): void {
    if (!this.sync || this.sync.stopped) { return; }
    log('[Sync] Setting up sync cycle');

    this.on('sync-done', (): void => {
      log('[Sync] Sync done. Setting timer to', this.getCurrentSyncInterval());
      if (this.sync && !this.sync.stopped) {
        if (this._syncTimer) {
          clearTimeout(this._syncTimer);
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
   * @returns A Promise which resolves when the sync has finished
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
      log('[Sync] Stopping sync');
      this.sync.stopped = true;
    } else {
      // The sync class has not been initialized yet, so we make sure it will
      // not start the syncing process as soon as it's initialized.
      log('[Sync] Will instantiate sync stopped');
      this.syncStopped = true;
    }
  }

  /**
   * Add remoteStorage data module
   *
   * @param module - A data module object
   *
   * @example
   *
   * Usually, you will import your data module from either a package or a local path.
   * Let's say you want to use the
   * [bookmarks module](https://github.com/raucao/remotestorage-module-bookmarks)
   * in order to load data stored from [Webmarks](https://webmarks.5apps.com) for
   * example:
   *
   * ```js
   * import Bookmarks from 'remotestorage-module-bookmarks';
   *
   * remoteStorage.addModule(Bookmarks);
   * ```
   *
   * You can also forgo this function entirely and add modules when creating your
   * remoteStorage instance:
   *
   * ```js
   * const remoteStorage = new RemoteStorage({ modules: [ Bookmarks ] });
   * ```
   *
   * After the module has been added, it can be used like so:
   *
   * ```js
   * remoteStorage.bookmarks.archive.getAll(false)
   *   .then(bookmarks => console.log(bookmarks));
   * ```
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
   *
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
    const caching = new Caching(this);
    Object.defineProperty(this, 'caching', {
      value: caching
    });
    return caching;
  }
});

export interface RemoteStorage extends EventHandling {}
applyMixins(RemoteStorage, [EventHandling]);

export default RemoteStorage;
