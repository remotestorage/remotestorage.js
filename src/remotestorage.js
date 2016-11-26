'use strict';
  var hasLocalStorage;

  function emitUnauthorized(r) {
    if (r.statusCode === 403  || r.statusCode === 401) {
      this._emit('error', new Authorize.Unauthorized());
    }
    return Promise.resolve(r);
  }

  const util = require('./util')
  const Dropbox = require('./dropbox');
  const GoogleDrive = require('./googledrive');
  const Discover = require('./discover');
  const BaseClient = require('./baseclient');
  const config = require('./config');
  const Authorize = require('./authorize');
  const Sync = require('./sync');
  const SyncedGetPutDelete = require('./syncedgetputdelete');
  const log = require('./log');
  const Features = require('./features');
  const globalContext = util.getGlobalContext();

  /**
   * Class: RemoteStorage
   *
   * TODO needs proper introduction and links to relevant classes etc
   *
   * Constructor for remoteStorage object.
   *
   * This class primarily contains feature detection code and convenience API.
   *
   * Depending on which features are built in, it contains different attributes and
   * functions. See the individual features for more information.
   *
   *  (start code)
   *  var remoteStorage = new RemoteStorage({
   *    logging: true,  // defaults to false
   *    cordovaRedirectUri: 'https://app.mygreatapp.com' // defaults to undefined
   *  });
   *  (end code)
   */
  var RemoteStorage = function (cfg) {
    /**
     * Event: ready
     *
     * Fired when ready
     **/
    /**
     * Event: not-connected
     *
     * Fired when ready, but no storage connected ("anonymous mode")
     **/
    /**
     * Event: connected
     *
     * Fired when a remote storage has been connected
     **/
    /**
     * Event: disconnected
     *
     * Fired after disconnect
     **/
    /**
     * Event: error
     *
     * Fired when an error occurs
     *
     * Arguments:
     * the error
     **/
    /**
     * Event: features-loaded
     *
     * Fired when all features are loaded
     **/
    /**
     * Event: connecting
     *
     * Fired before webfinger lookup
     **/
    /**
     * Event: authing
     *
     * Fired before redirecting to the authing server
     **/
    /**
     * Event: wire-busy
     *
     * Fired when a wire request starts
     **/
    /**
     * Event: wire-done
     *
     * Fired when a wire request completes
     **/
    /**
     * Event: network-offline
     *
     * Fired once when a wire request fails for the first time, and
     * `remote.online` is set to false
     **/
    /**
     * Event: network-online
     *
     * Fired once when a wire request succeeds for the first time after a
     * failed one, and `remote.online` is set back to true
     **/

    // Initial configuration property settings.
    // TODO merge user configuration with default configuration
    if (typeof cfg === 'object') {
      config.logging = !!cfg.logging;
      config.cordovaRedirectUri = cfg.cordovaRedirectUri;
    }

    var eventHandling = require('./eventhandling');
    eventHandling(
      this, 'ready', 'connected', 'disconnected', 'not-connected', 'conflict',
            'error', 'features-loaded', 'connecting', 'authing',
            'sync-interval-change', 'wire-busy', 'wire-done',
            'network-offline', 'network-online'
    );

    // pending get/put/delete calls.
    this._pending = [];

    this._setGPD({
      get: this._pendingGPD('get'),
      put: this._pendingGPD('put'),
      delete: this._pendingGPD('delete')
    });

    this._cleanups = [];

    this._pathHandlers = { change: {} };

    this.apiKeys = {};

    hasLocalStorage = util.localStorageAvailable();

    if (hasLocalStorage) {
      try {
        this.apiKeys = JSON.parse(localStorage.getItem('remotestorage:api-keys')) || {};
      } catch(exc) {
        // ignored
      }
      this.setBackend(localStorage.getItem('remotestorage:backend') || 'remotestorage');
    }

    var origOn = this.on;

    this.on = function (eventName, handler) {
      if(eventName === 'features-loaded') {
      }
      if (eventName === 'ready' && this.remote && this.remote.connected && this._allLoaded) {
        setTimeout(handler, 0);
      } else if (eventName === 'features-loaded' && this._allLoaded) {
        setTimeout(handler, 0);
      }
      return origOn.call(this, eventName, handler);
    };

    // load all features and emit `ready`
    this._init()

    this.fireInitial = function () {
      if (this.local) {
        setTimeout(this.local.fireInitial.bind(this.local), 0);
      }
    }.bind(this);

    this.on('ready', this.fireInitial.bind(this));
  };


  // TOFIX: Instead of doing this, would be better to only 
  // export setAuthURL / getAuthURL from RemoteStorage prototype
  RemoteStorage.Authorize = Authorize;

  RemoteStorage.SyncError = Sync.SyncError;
  RemoteStorage.Unauthorized = Authorize.Unauthorized;
  RemoteStorage.DiscoveryError = Discover.DiscoveryError;

 
  RemoteStorage.prototype = {
    authorize: function authorize(authURL, cordovaRedirectUri) {
      this.access.setStorageType(this.remote.storageType);
      var scope = this.access.scopeParameter;

      var redirectUri = globalContext.cordova ?
        cordovaRedirectUri :
        String(Authorize.getLocation());

      var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

      Authorize(this, authURL, scope, redirectUri, clientId);
    },
  

    /**
     * Property: remote
     *
     * Properties:
     *
     *   connected   - Boolean, whether or not a remote store is connected
     *   online      - Boolean, whether last sync action was successful or not
     *   userAddress - String, the user address of the connected user
     *   properties  - String, the properties of the WebFinger link
     */

    /**
     * Method: scope
     *
     * Returns a BaseClient with a certain scope (base path). Please use this method
     * only for debugging, and always use defineModule instead, to get access to a
     * BaseClient from a module in an app.
     *
     * Parameters:
     *
     *   scope - A string, with a leading and a trailing slash, specifying the
     *           base path of the BaseClient that will be returned.
     *
     * Code example:
     *
     * (start code)
     * remoteStorage.scope('/pictures/').getListing('');
     * remoteStorage.scope('/public/pictures/').getListing('');
     */

    /**
     * Method: connect
     *
     * Connect to a remoteStorage server.
     *
     * Parameters:
     *   userAddress        - The user address (user@host) to connect to.
     *   token              - (optional) A bearer token acquired beforehand
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
     */
    connect: function (userAddress, token) {
      this.setBackend('remotestorage');
      if (userAddress.indexOf('@') < 0) {
        this._emit('error', new RemoteStorage.DiscoveryError("User address doesn't contain an @."));
        return;
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

      var discoveryTimeout = setTimeout(function () {
        this._emit('error', new RemoteStorage.DiscoveryError("No storage information found for this user address."));
      }.bind(this), config.discoveryTimeout);

      Discover(userAddress).then(function (info) {
        // Info contains fields: href, storageApi, authURL (optional), properties

        clearTimeout(discoveryTimeout);
        this._emit('authing');
        info.userAddress = userAddress;
        this.remote.configure(info);
        if (! this.remote.connected) {
          if (info.authURL) {
            if (typeof token === 'undefined') {
              // Normal authorization step; the default way to connect
              this.authorize(info.authURL, config.cordovaRedirectUri);
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
      }.bind(this), function(err) {
        clearTimeout(discoveryTimeout);
        this._emit('error', new RemoteStorage.DiscoveryError("No storage information found for this user address."));
      }.bind(this));
    },

    /**
     * Method: disconnect
     *
     * "Disconnect" from remotestorage server to terminate current session.
     * This method clears all stored settings and deletes the entire local
     * cache.
     */
    disconnect: function () {
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
      var n = this._cleanups.length, i = 0;

      var oneDone = function () {
        i++;
        if (i >= n) {
          this._init();
          log('Done cleaning up, emitting disconnected and disconnect events');
          this._emit('disconnected');
        }
      }.bind(this);

      if (n > 0) {
        this._cleanups.forEach(function (cleanup) {
          var cleanupResult = cleanup(this);
          if (typeof(cleanupResult) === 'object' && typeof(cleanupResult.then) === 'function') {
            cleanupResult.then(oneDone);
          } else {
            oneDone();
          }
        }.bind(this));
      } else {
        oneDone();
      }
    },

    setBackend: function (what) {
      this.backend = what;
      if (hasLocalStorage) {
        if (what) {
          localStorage.setItem('remotestorage:backend', what);
        } else {
          localStorage.removeItem('remotestorage:backend');
        }
      }
    },

    /**
     * Method: onChange
     *
     * Add a "change" event handler to the given path. Whenever a "change"
     * happens (as determined by the backend, such as e.g.
     * <RemoteStorage.IndexedDB>) and the affected path is equal to or below
     * the given 'path', the given handler is called.
     *
     * You should usually not use this method directly, but instead use the
     * "change" events provided by <RemoteStorage.BaseClient>.
     *
     * Parameters:
     *   path    - Absolute path to attach handler to.
     *   handler - Handler function.
     */
    onChange: function (path, handler) {
      if (! this._pathHandlers.change[path]) {
        this._pathHandlers.change[path] = [];
      }
      this._pathHandlers.change[path].push(handler);
    },

    /**
     * Method: enableLog
     *
     * Enable remoteStorage logging.
     */
    enableLog: function () {
      config.logging = true;
    },

    /**
     * Method: disableLog
     *
     * Disable remoteStorage logging
     */
    disableLog: function () {
      config.logging = false;
    },

    /**
     * Method: log
     *
     * The same as <RemoteStorage.log>.
     */
    log: function () {
      log.apply(RemoteStorage, arguments);
    },

    /**
     * Method: setApiKeys (experimental)
     *
     * Set API keys for (currently) GoogleDrive and/or Dropbox backend support.
     * See also the 'backends' example in the starter-kit. Note that support for
     * both these backends is still experimental.
     *
     * Parameters:
     *   type - string, either 'googledrive' or 'dropbox'
     *   keys - object, with one string field; 'clientId' for GoogleDrive, or
     *          'appKey' for Dropbox.
     *
     */
    setApiKeys: function (type, keys) {
      if (keys) {
        this.apiKeys[type] = keys;
        if (type === 'dropbox' && (typeof this.dropbox === 'undefined' ||
                                   this.dropbox.clientId !== keys.appKey)) {
          Dropbox._rs_init(this);
        } else if (type === 'googledrive' && (typeof this.googledrive === 'undefined' ||
                                              this.googledrive.clientId !== keys.clientId)) {
          GoogleDrive._rs_init(this);
        }
      } else {
        delete this.apiKeys[type];
      }
      if (hasLocalStorage) {
        localStorage.setItem('remotestorage:api-keys', JSON.stringify(this.apiKeys));
      }
    },

    /**
     * Method: setCordovaRedirectUri
     *
     * Set redirect URI to be used for the OAuth redirect within the
     * in-app-browser window in Cordova apps.
     *
     * Parameters:
     *   uri - string, valid HTTP(S) URI
     */
    setCordovaRedirectUri: function (uri) {
      if (typeof uri !== 'string' || !uri.match(/http(s)?\:\/\//)) {
        throw new Error("Cordova redirectingect URI must be a URI string");
      }
      config.cordovaRedirectUri = uri;
    },


    /* FEATURES INITIALIZATION */
    _init: Features.loadFeatures,
    features: Features.features,
    loadFeature: Features.loadFeature,
    featureSupported: Features.featureSupported,
    featureDone: Features.featureDone,
    featuresDone: Features.featuresDone,
    featuresLoaded: Features.featuresLoaded,
    featureInitialized: Features.featureInitialized,
    featureFailed: Features.featureFailed,
    featureSupported: Features.featureSupported,
    hasFeature: Features.hasFeature,
    _setCachingModule: Features._setCachingModule,
    _collectCleanupFunctions: Features._collectCleanupFunctions,
    _fireReady: Features._fireReady,
    initFeature: Features.initFeature,



    /**
     ** GET/PUT/DELETE INTERFACE HELPERS
     **/
    _setGPD: function (impl, context) {
      function wrap(func) {
        return function () {
          return func.apply(context, arguments)
            .then(emitUnauthorized.bind(this));
        };
      }
      this.get = wrap(impl.get);
      this.put = wrap(impl.put);
      this.delete = wrap(impl.delete);
    },

    _pendingGPD: function (methodName) {
      return function () {
        var pending = Promise.defer();
        this._pending.push({
          method: methodName,
          args: Array.prototype.slice.call(arguments),
          promise: pending
        });
        return pending.promise;
      }.bind(this);
    },

    _processPending: function () {
      this._pending.forEach(function (pending) {
        try {
          this[pending.method].apply(this, pending.args).then(pending.promise.resolve, pending.promise.reject);
        } catch(e) {
          pending.promise.reject(e);
        }
      }.bind(this));
      this._pending = [];
    },

    /**
     ** CHANGE EVENT HANDLING
     **/
    _bindChange: function (object) {
      object.on('change', this._dispatchEvent.bind(this, 'change'));
    },

    _dispatchEvent: function (eventName, event) {
      var self = this;
      Object.keys(this._pathHandlers[eventName]).forEach(function (path) {
        var pl = path.length;
        if (event.path.substr(0, pl) === path) {
          self._pathHandlers[eventName][path].forEach(function (handler) {
            var ev = {};
            for (var key in event) { ev[key] = event[key]; }
            ev.relativePath = event.path.replace(new RegExp('^' + path), '');
            try {
              handler(ev);
            } catch(e) {
              console.error("'change' handler failed: ", e, e.stack);
              self._emit('error', e);
            }
          });
        }
      });
    },


    scope: function (path) {
      if (typeof(path) !== 'string') {
        throw 'Argument \'path\' of baseClient.scope must be a string';
      }

      if (!this.access.checkPathPermission(path, 'r')) {
        var escapedPath = path.replace(/(['\\])/g, '\\$1');
        console.warn('WARNING: please call remoteStorage.access.claim(\'' + escapedPath + '\', \'r\') (read only) or remoteStorage.access.claim(\'' + escapedPath + '\', \'rw\') (read/write) first');
      }
      return new BaseClient(this, path);
    },




    /**
     * Method: getSyncInterval
     *
     * Get the value of the sync interval when application is in the foreground
     *
     * Returns a number of milliseconds
     *
    //  */
    getSyncInterval: function () {
      return config.syncInterval;
    },

    /**
     * Method: setSyncInterval
     *
     * Set the value of the sync interval when application is in the foreground
     *
     * Parameters:
     *   interval - sync interval in milliseconds
     *
     */
    setSyncInterval: function (interval) {
      if (!isValidInterval(interval)) {
        throw interval + " is not a valid sync interval";
      }
      var oldValue = config.syncInterval;
      config.syncInterval = parseInt(interval, 10);
      this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
    },

    /**
     * Method: getBackgroundSyncInterval
     *
     * Get the value of the sync interval when application is in the background
     *
     * Returns a number of milliseconds
     *
     */
    getBackgroundSyncInterval: function () {
      return config.backgroundSyncInterval;
    },

    /**
     * Method: setBackgroundSyncInterval
     *
     * Set the value of the sync interval when the application is in the background
     *
     * Parameters:
     *   interval - sync interval in milliseconds
     *
     */
    setBackgroundSyncInterval: function (interval) {
      if(!isValidInterval(interval)) {
        throw interval + " is not a valid sync interval";
      }
      var oldValue = config.backgroundSyncInterval;
      config.backgroundSyncInterval = parseInt(interval, 10);
      this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
    },

    /**
     * Method: getCurrentSyncInterval
     *
     * Get the value of the current sync interval
     *
     * Returns a number of milliseconds
     *
     */
    getCurrentSyncInterval: function () {
      return config.isBackground ? config.backgroundSyncInterval : config.syncInterval;
    },



    syncCycle: function () {
      if (this.sync.stopped) {
        return;
      }

      this.sync.on('done', function () {
        log('[Sync] Sync done. Setting timer to', this.getCurrentSyncInterval());
        if (!this.sync.stopped) {
          if (this._syncTimer) {
            clearTimeout(this._syncTimer);
          }
          this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getCurrentSyncInterval());
        }
      }.bind(this));

      this.sync.sync();
    },

    stopSync: function () {
      if (this.sync) {
        log('[Sync] Stopping sync');
        this.sync.stopped = true;
      } else {
        // TODO When is this ever the case and what is syncStopped for then?
        log('[Sync] Will instantiate sync stopped');
        this.syncStopped = true;
      }
    },

    startSync: function () {
      if (!config.cache) return
      this.sync.stopped = false;
      this.syncStopped = false;
      this.sync.sync();
    }

  };


    /**
   * Check if interval is valid: numeric and between 1000ms and 3600000ms
   *
   */
  function isValidInterval(interval) {
    return (typeof interval === 'number' && interval > 1000 && interval < 3600000);
  }


  RemoteStorage.util = util;
  // RemoteStorage.defineModule = modules.defineModule;

  /**
   * Property: connected
   *
   * Boolean property indicating if remoteStorage is currently connected.
   */
  Object.defineProperty(RemoteStorage.prototype, 'connected', {
    get: function () {
      return this.remote.connected;
    }
  });

  /**
   * Property: access
   *
   * Tracking claimed access scopes. A <RemoteStorage.Access> instance.
  */
  var Access = require('./access');
  Object.defineProperty(RemoteStorage.prototype, 'access', {
    get: function() {
      var access = new Access();
      Object.defineProperty(this, 'access', {
        value: access
      });
      return access;
    },
    configurable: true
  });


    /* TOFIX (in sync.js also... has to be a shared property) */
    config.syncInterval = 10000,
    config.backgroundSyncInterval = 60000,
    config.isBackground = false;






  // TODO clean up/harmonize how modules are loaded and/or document this architecture properly
  //
  // At this point the remoteStorage object has not been created yet.
  // Only its prototype exists so far, so we define a self-constructing
  // property on there:
  /**
   *
   * Property: caching
   *
   * Caching settings. A <RemoteStorage.Caching> instance.
   *
   * Not available in no-cache builds.
   *
   */
  var Caching = require('./caching');
  Object.defineProperty(RemoteStorage.prototype, 'caching', {
    configurable: true,
    get: function () {
      var caching = new Caching();
      Object.defineProperty(this, 'caching', {
        value: caching
      });
      return caching;
    }
  });

   /*
   * Property: remote
   *
   * Access to the remote backend used. Usually a <RemoteStorage.WireClient>.
   *
   *
   * Property: local
   *
   * Access to the local caching backend used. Usually either a
   * <RemoteStorage.IndexedDB> or <RemoteStorage.LocalStorage> instance.
   *
   * Not available in no-cache builds.
   */


module.exports = RemoteStorage;
require('./modules')