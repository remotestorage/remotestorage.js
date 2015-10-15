/** remotestorage.js 0.12.0, http://remotestorage.io, MIT-licensed **/
define(['bluebird'], function(Promise) {

/** FILE: src/remotestorage.js **/
(function (global) {

  // wrapper to implement defer() functionality
  Promise.defer = function () {
    var resolve, reject;
    var promise = new Promise(function() {
      resolve = arguments[0];
      reject = arguments[1];
    });
    return {
        resolve: resolve,
      reject: reject,
      promise: promise
    };
  };

  function logError(error) {
    if (typeof(error) === 'string') {
      console.error(error);
    } else {
      console.error(error.message, error.stack);
    }
  }

  function emitUnauthorized(r) {
    if (r.statusCode === 403  || r.statusCode === 401) {
      this._emit('error', new RemoteStorage.Unauthorized());
    }
    return Promise.resolve(r);
  }

  function shareFirst(path) {
    return ( this.backend === 'dropbox' &&
             path.match(/^\/public\/.*[^\/]$/) );
  }

  var SyncedGetPutDelete = {
    get: function (path, maxAge) {
      var self = this;
      if (this.local) {
        if (maxAge === undefined) {
          if ((typeof this.remote === 'object') &&
               this.remote.connected && this.remote.online) {
            maxAge = 2*this.getSyncInterval();
          } else {
            RemoteStorage.log('Not setting default maxAge, because remote is offline or not connected');
            maxAge = false;
          }
        }
        var maxAgeInvalid = function (maxAge) {
          return maxAge !== false && typeof(maxAge) !== 'number';
        };

        if (maxAgeInvalid(maxAge)) {
          return Promise.reject('Argument \'maxAge\' must be false or a number');
        }
        return this.local.get(path, maxAge, this.sync.queueGetRequest.bind(this.sync));
      } else {
        return this.remote.get(path);
      }
    },

    put: function (path, body, contentType) {
      if (shareFirst.bind(this)(path)) {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
      else if (this.local) {
        return this.local.put(path, body, contentType);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
    },

    'delete': function (path) {
      if (this.local) {
        return this.local.delete(path);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path));
      }
    },

    _wrapBusyDone: function (result) {
      var self = this;
      this._emit('wire-busy');
      return result.then(function (r) {
        self._emit('wire-done', { success: true });
        return Promise.resolve(r);
      }, function (err) {
        self._emit('wire-done', { success: false });
        return Promise.reject(err);
      });
    }
  };

  /**
   * Class: RemoteStorage
   *
   * TODO needs proper introduction and links to relevant classes etc
   *
   * Constructor for global remoteStorage object.
   *
   * This class primarily contains feature detection code and a global convenience API.
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

    // Initial configuration property settings.
    if (typeof cfg === 'object') {
      RemoteStorage.config.logging = !!cfg.logging;
      RemoteStorage.config.cordovaRedirectUri = cfg.cordovaRedirectUri;
    }

    RemoteStorage.eventHandling(
      this, 'ready', 'connected', 'disconnected', 'not-connected', 'conflict',
            'error', 'features-loaded', 'connecting', 'authing', 'wire-busy',
            'wire-done', 'sync-interval-change'
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

    if (this.localStorageAvailable()) {
      try {
        this.apiKeys = JSON.parse(localStorage['remotestorage:api-keys']);
      } catch(exc) {
        // ignored
      }
      this.setBackend(localStorage['remotestorage:backend'] || 'remotestorage');
    }

    var origOn = this.on;

    this.on = function (eventName, handler) {
      if (eventName === 'ready' && this.remote.connected && this._allLoaded) {
        setTimeout(handler, 0);
      } else if (eventName === 'features-loaded' && this._allLoaded) {
        setTimeout(handler, 0);
      }
      return origOn.call(this, eventName, handler);
    };

    this._init();

    this.fireInitial = function () {
      if (this.local) {
        setTimeout(this.local.fireInitial.bind(this.local), 0);
      }
    }.bind(this);

    this.on('ready', this.fireInitial.bind(this));
  };

  RemoteStorage.SyncedGetPutDelete = SyncedGetPutDelete;

  RemoteStorage.DiscoveryError = function (message) {
    Error.apply(this, arguments);
    this.message = message;
  };

  RemoteStorage.DiscoveryError.prototype = Object.create(Error.prototype);

  RemoteStorage.Unauthorized = function () { Error.apply(this, arguments); };
  RemoteStorage.Unauthorized.prototype = Object.create(Error.prototype);

  /**
   * Method: RemoteStorage.log
   *
   * Log using console.log, when remoteStorage logging is enabled.
   *
   * You can enable logging with <enableLog>.
   *
   * (In node.js you can also enable logging during remoteStorage object
   * creation. See: <RemoteStorage>).
   */
  RemoteStorage.log = function () {
    if (RemoteStorage.config.logging) {
      console.log.apply(console, arguments);
    }
  };

  RemoteStorage.config = {
    logging: false,
    changeEvents: {
      local:    true,
      window:   false,
      remote:   true,
      conflict: true
    },
    discoveryTimeout: 10000,
    cordovaRedirectUri: undefined
  };

  RemoteStorage.prototype = {

    /**
     * Method: displayWidget
     *
     * Displays the widget at the top right of the page. Make sure to call this function
     * once on every pageload (after the html 'body' tag), unless you use a custom widget.
     *
     * Parameters:
     *
     *   domID: identifier of the DOM element which should embody the widget (optional)
     */
     // (see src/widget.js for implementation)

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

      if (global.cordova) {
        if (typeof RemoteStorage.config.cordovaRedirectUri !== 'string') {
          this._emit('error', new RemoteStorage.DiscoveryError("Please supply a custom HTTPS redirect URI for your Cordova app"));
          return;
        }
        if (!global.cordova.InAppBrowser) {
          this._emit('error', new RemoteStorage.DiscoveryError("Please include the InAppBrowser Cordova plugin to enable OAuth"));
          return;
        }
      }

      this.remote.configure({
        userAddress: userAddress
      });
      this._emit('connecting');

      var discoveryTimeout = setTimeout(function () {
        this._emit('error', new RemoteStorage.DiscoveryError("No storage information found at that user address."));
      }.bind(this), RemoteStorage.config.discoveryTimeout);

      RemoteStorage.Discover(userAddress).then(function (info) {
        // Info contains fields: href, storageApi, authURL (optional), properties

        clearTimeout(discoveryTimeout);
        this._emit('authing');
        info.userAddress = userAddress;
        this.remote.configure(info);
        if (! this.remote.connected) {
          if (info.authURL) {
            if (typeof token === 'undefined') {
              // Normal authorization step; the default way to connect
              this.authorize(info.authURL, RemoteStorage.config.cordovaRedirectUri);
            } else if (typeof token === 'string') {
              // Token supplied directly by app/developer/user
              RemoteStorage.log('Skipping authorization sequence and connecting with known token');
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
        this._emit('error', new RemoteStorage.DiscoveryError("Failed to contact storage server."));
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
          RemoteStorage.log('Done cleaning up, emitting disconnected and disconnect events');
          this._emit('disconnected');
        }
      }.bind(this);

      if (n > 0) {
        this._cleanups.forEach(function (cleanup) {
          var cleanupResult = cleanup(this);
          if (typeof(cleanup) === 'object' && typeof(cleanup.then) === 'function') {
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
      if (this.localStorageAvailable()) {
        if (what) {
          localStorage['remotestorage:backend'] = what;
        } else {
          delete localStorage['remotestorage:backend'];
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
      RemoteStorage.config.logging = true;
    },

    /**
     * Method: disableLog
     *
     * Disable remoteStorage logging
     */
    disableLog: function () {
      RemoteStorage.config.logging = false;
    },

    /**
     * Method: log
     *
     * The same as <RemoteStorage.log>.
     */
    log: function () {
      RemoteStorage.log.apply(RemoteStorage, arguments);
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
      } else {
        delete this.apiKeys[type];
      }
      if (this.localStorageAvailable()) {
        localStorage['remotestorage:api-keys'] = JSON.stringify(this.apiKeys);
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
        throw new Error("Cordova redirect URI must be a URI string");
      }
      RemoteStorage.config.cordovaRedirectUri = uri;
    },

    /**
     ** INITIALIZATION
     **/

    _init: function () {
      var self = this,
          readyFired = false;

      function fireReady() {
        try {
          if (!readyFired) {
            self._emit('ready');
            readyFired = true;
          }
        } catch(e) {
          console.error("'ready' failed: ", e, e.stack);
          self._emit('error', e);
        }
      }

      this._loadFeatures(function (features) {
        this.log('[RemoteStorage] All features loaded');
        this.local = features.local && new features.local();
        // this.remote set by WireClient._rs_init as lazy property on
        // RS.prototype

        if (this.local && this.remote) {
          this._setGPD(SyncedGetPutDelete, this);
          this._bindChange(this.local);
        } else if (this.remote) {
          this._setGPD(this.remote, this.remote);
        }

        if (this.remote) {
          this.remote.on('connected', function (){
            fireReady();
            self._emit('connected');
          });
          this.remote.on('not-connected', function (){
            fireReady();
            self._emit('not-connected');
          });
          if (this.remote.connected) {
            fireReady();
            self._emit('connected');
          }

          if (!this.hasFeature('Authorize')) {
            this.remote.stopWaitingForToken();
          }
        }

        this._collectCleanupFunctions();

        try {
          this._allLoaded = true;
          this._emit('features-loaded');
        } catch(exc) {
          logError(exc);
          this._emit('error', exc);
        }
        this._processPending();
      }.bind(this));
    },

    _collectCleanupFunctions: function () {
      for (var i=0; i < this.features.length; i++) {
        var cleanup = this.features[i].cleanup;
        if (typeof(cleanup) === 'function') {
          this._cleanups.push(cleanup);
        }
      }
    },

    /**
     ** FEATURE DETECTION
     **/
    _loadFeatures: function (callback) {
      var featureList = [
        'WireClient',
        'I18n',
        'Dropbox',
        'GoogleDrive',
        'Access',
        'Caching',
        'Discover',
        'Authorize',
        'Widget',
        'IndexedDB',
        'LocalStorage',
        'InMemoryStorage',
        'Sync',
        'BaseClient',
        'Env'
      ];
      var features = [];
      var featuresDone = 0;
      var self = this;

      function featureDone() {
        featuresDone++;
        if (featuresDone === featureList.length) {
          setTimeout(function () {
            features.caching = !!RemoteStorage.Caching;
            features.sync = !!RemoteStorage.Sync;
            [
              'IndexedDB',
              'LocalStorage',
              'InMemoryStorage'
            ].some(function (cachingLayer) {
              if (features.some(function (feature) { return feature.name === cachingLayer; })) {
                features.local = RemoteStorage[cachingLayer];
                return true;
              }
            });
            self.features = features;
            callback(features);
          }, 0);
        }
      }

      function featureInitialized(name) {
        self.log("[RemoteStorage] [FEATURE "+name+"] initialized.");
        features.push({
          name : name,
          init :  RemoteStorage[name]._rs_init,
          supported : true,
          cleanup : RemoteStorage[name]._rs_cleanup
        });
        featureDone();
      }

      function featureFailed(name, err) {
        self.log("[RemoteStorage] [FEATURE "+name+"] initialization failed ( "+err+")");
        featureDone();
      }

      function featureSupported(name, success) {
        self.log("[RemoteStorage] [FEATURE "+name+"]" + success ? "":" not"+" supported");
        if (!success) {
          featureDone();
        }
      }

      function initFeature(name) {
        var initResult;
        try {
          initResult = RemoteStorage[name]._rs_init(self);
        } catch(e) {
          featureFailed(name, e);
          return;
        }
        if (typeof(initResult) === 'object' && typeof(initResult.then) === 'function') {
          initResult.then(
            function (){ featureInitialized(name); },
            function (err){ featureFailed(name, err); }
          );
        } else {
          featureInitialized(name);
        }
      }

      featureList.forEach(function (featureName) {
        self.log("[RemoteStorage] [FEATURE " + featureName + "] initializing...");
        var impl = RemoteStorage[featureName];
        var supported;

        if (impl) {
          supported = !impl._rs_supported || impl._rs_supported();

          if (typeof supported === 'object') {
            supported.then(
              function (){
                featureSupported(featureName, true);
                initFeature(featureName);
              },
              function (){
                featureSupported(featureName, false);
              }
            );
          } else if (typeof supported === 'boolean') {
            featureSupported(featureName, supported);
            if (supported) {
              initFeature(featureName);
            }
          }
        } else {
          featureSupported(featureName, false);
        }
      });
    },

    /**
     * Method: hasFeature
     *
     * Checks whether a feature is enabled or not within remoteStorage.
     * Returns a boolean.
     *
     * Parameters:
     *   name - Capitalized name of the feature. e.g. Authorize, or IndexedDB
     *
     * Example:
     *   (start code)
     *   if (remoteStorage.hasFeature('LocalStorage')) {
     *     console.log('LocalStorage is enabled!');
     *   }
     *   (end code)
     *
     */
    hasFeature: function (feature) {
      for (var i = this.features.length - 1; i >= 0; i--) {
        if (this.features[i].name === feature) {
          return this.features[i].supported;
        }
      }
      return false;
    },

    localStorageAvailable: function () {
      try {
        return !!global.localStorage;
      } catch(error) {
        return false;
      }
    },

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
    }
  };

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
   *
   *
   * Property: caching
   *
   * Caching settings. A <RemoteStorage.Caching> instance.
   *
   * Not available in no-cache builds.
   *
   *
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

  if ((typeof module === 'object') && (typeof module.exports !== undefined)){
    module.exports = RemoteStorage;
  } else {
    global.RemoteStorage = RemoteStorage;
  }
})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/util.js **/
/**
 * Class: RemoteStorage.Util
 *
 * Provides reusable utility functions at RemoteStorage.util
 *
 */
(function () {

  /**
   * Function: fixArrayBuffers
   *
   * Takes an object and its copy as produced by the _deepClone function
   * below, and finds and fixes any ArrayBuffers that were cast to `{}` instead
   * of being cloned to new ArrayBuffers with the same content.
   *
   * It recurses into sub-objects, but skips arrays if they occur.
   */
  function fixArrayBuffers(srcObj, dstObj) {
    var field, srcArr, dstArr;
    if (typeof(srcObj) !== 'object' || Array.isArray(srcObj) || srcObj === null) {
      return;
    }
    for (field in srcObj) {
      if (typeof(srcObj[field]) === 'object' && srcObj[field] !== null) {
        if (srcObj[field].toString() === '[object ArrayBuffer]') {
          dstObj[field] = new ArrayBuffer(srcObj[field].byteLength);
          srcArr = new Int8Array(srcObj[field]);
          dstArr = new Int8Array(dstObj[field]);
          dstArr.set(srcArr);
        } else {
          fixArrayBuffers(srcObj[field], dstObj[field]);
        }
      }
    }
  }

  RemoteStorage.util = {
    getEventEmitter: function () {
      var object = {};
      var args = Array.prototype.slice.call(arguments);
      args.unshift(object);
      RemoteStorage.eventHandling.apply(RemoteStorage, args);
      object.emit = object._emit;
      return object;
    },

    extend: function (target) {
      var sources = Array.prototype.slice.call(arguments, 1);
      sources.forEach(function (source) {
        for (var key in source) {
          target[key] = source[key];
        }
      });
      return target;
    },

    asyncEach: function (array, callback) {
      return this.asyncMap(array, callback).
        then(function () { return array; });
    },

    asyncMap: function (array, callback) {
      var pending = Promise.defer();
      var n = array.length, i = 0;
      var results = [], errors = [];

      function oneDone() {
        i++;
        if (i === n) {
          pending.resolve(results, errors);
        }
      }

      array.forEach(function (item, index) {
        var result;
        try {
          result = callback(item);
        } catch(exc) {
          oneDone();
          errors[index] = exc;
        }
        if (typeof(result) === 'object' && typeof(result.then) === 'function') {
          result.then(function (res) { results[index] = res; oneDone(); },
                      function (error) { errors[index] = error; oneDone(); });
        } else {
          oneDone();
          results[index] = result;
        }
      });

      return pending.promise;
    },

    containingFolder: function (path) {
      if (path === '') {
        return '/';
      }
      if (! path) {
        throw "Path not given!";
      }

      return path.replace(/\/+/g, '/').replace(/[^\/]+\/?$/, '');
    },

    isFolder: function (path) {
      return path.substr(-1) === '/';
    },

    isDocument: function (path) {
      return path.substr(-1) !== '/';
    },

    baseName: function (path) {
      var parts = path.split('/');
      if (this.isFolder(path)) {
        return parts[parts.length-2]+'/';
      } else {
        return parts[parts.length-1];
      }
    },

    cleanPath: function (path) {
      return path.replace(/\/+/g, '/')
                 .split('/').map(encodeURIComponent).join('/')
                 .replace(/'/g, '%27');
    },

    bindAll: function (object) {
      for (var key in this) {
        if (typeof(object[key]) === 'function') {
          object[key] = object[key].bind(object);
        }
      }
    },

    equal: function (a, b, seen) {
      var key;
      seen = seen || [];

      if (typeof(a) !== typeof(b)) {
        return false;
      }

      if (typeof(a) === 'number' || typeof(a) === 'boolean' || typeof(a) === 'string') {
        return a === b;
      }

      if (typeof(a) === 'function') {
        return a.toString() === b.toString();
      }

      if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
        // Without the following conversion the browsers wouldn't be able to
        // tell the ArrayBuffer instances apart.
        a = new Uint8Array(a);
        b = new Uint8Array(b);
      }

      // If this point has been reached, a and b are either arrays or objects.

      if (a instanceof Array) {
        if (a.length !== b.length) {
          return false;
        }

        for (var i = 0, c = a.length; i < c; i++) {
          if (!RemoteStorage.util.equal(a[i], b[i], seen)) {
            return false;
          }
        }
      } else {
        // Check that keys from a exist in b
        for (key in a) {
          if (a.hasOwnProperty(key) && !(key in b)) {
            return false;
          }
        }

        // Check that keys from b exist in a, and compare the values
        for (key in b) {
          if (!b.hasOwnProperty(key)) {
            continue;
          }

          if (!(key in a)) {
            return false;
          }

          var seenArg;

          if (typeof(b[key]) === 'object') {
            if (seen.indexOf(b[key]) >= 0) {
              // Circular reference, don't attempt to compare this object.
              // If nothing else returns false, the objects match.
              continue;
            }

            seenArg = seen.slice();
            seenArg.push(b[key]);
          }

          if (!RemoteStorage.util.equal(a[key], b[key], seenArg)) {
            return false;
          }
        }
      }

      return true;
    },

    equalObj: function (obj1, obj2) {
      console.warn('DEPRECATION WARNING: RemoteStorage.util.equalObj has been replaced by RemoteStorage.util.equal.');
      return RemoteStorage.util.equal(obj1, obj2);
    },

    deepClone: function (obj) {
      var clone;
      if (obj === undefined) {
        return undefined;
      } else {
        clone = JSON.parse(JSON.stringify(obj));
        fixArrayBuffers(obj, clone);
        return clone;
      }
    },

    pathsFromRoot: function (path) {
      var paths = [path];
      var parts = path.replace(/\/$/, '').split('/');

      while (parts.length > 1) {
        parts.pop();
        paths.push(parts.join('/')+'/');
      }
      return paths;
    },

    /* jshint ignore:start */
    md5sum: function(str) {
      //
      // http://www.myersdaily.org/joseph/javascript/md5.js
      //
      function md5cycle(x, k) {
        var a = x[0], b = x[1], c = x[2], d = x[3];

        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17,  606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12,  1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7,  1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7,  1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22,  1236535329);

        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14,  643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9,  38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5,  568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20,  1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14,  1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);

        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16,  1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11,  1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4,  681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23,  76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16,  530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);

        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10,  1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6,  1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6,  1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21,  1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15,  718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);

        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);

      }

      function cmn(q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
      }

      function ff(a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
      }

      function gg(a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
      }

      function hh(a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
      }

      function ii(a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
      }

      function md51(s) {
        txt = '';
        var n = s.length,
            state = [1732584193, -271733879, -1732584194, 271733878], i;
        for (i=64; i<=s.length; i+=64) {
          md5cycle(state, md5blk(s.substring(i-64, i)));
        }
        s = s.substring(i-64);
        var tail = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
        for (i=0; i<s.length; i++)
          tail[i>>2] |= s.charCodeAt(i) << ((i%4) << 3);
        tail[i>>2] |= 0x80 << ((i%4) << 3);
        if (i > 55) {
          md5cycle(state, tail);
          for (i=0; i<16; i++) tail[i] = 0;
        }
        tail[14] = n*8;
        md5cycle(state, tail);
        return state;
      }

      function md5blk(s) {
        var md5blks = [], i;
        for (i=0; i<64; i+=4) {
          md5blks[i>>2] = s.charCodeAt(i) + (s.charCodeAt(i+1) << 8) + (s.charCodeAt(i+2) << 16) + (s.charCodeAt(i+3) << 24);
        }
        return md5blks;
      }

      var hex_chr = '0123456789abcdef'.split('');

      function rhex(n)
      {
        var s='', j=0;
        for(; j<4; j++)
          s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        return s;
      }

      function hex(x) {
        for (var i=0; i<x.length; i++)
          x[i] = rhex(x[i]);
        return x.join('');
      }

      function md5(s) {
        return hex(md51(s));
      }

      var add32 = function (a, b) {
        return (a + b) & 0xFFFFFFFF;
      };

      if (md5('hello') !== '5d41402abc4b2a76b9719d911017c592') {
        add32 = function (x, y) {
          var lsw = (x & 0xFFFF) + (y & 0xFFFF),
              msw = (x >> 16) + (y >> 16) + (lsw >> 16);
          return (msw << 16) | (lsw & 0xFFFF);
        };
      }

      return md5(str);
    }
    /* jshint ignore:end */
  };

  if (!RemoteStorage.prototype.util) {
    Object.defineProperty(RemoteStorage.prototype, 'util', {
      get: function () {
        console.log('DEPRECATION WARNING: remoteStorage.util was moved to RemoteStorage.util');
        return RemoteStorage.util;
      }
    });
  }
})();


/** FILE: src/eventhandling.js **/
(function (global) {
  /**
   * Interface: eventhandling
   */
  var methods = {
    /**
     * Method: addEventListener
     *
     * Install an event handler for the given event name
     */
    addEventListener: function (eventName, handler) {
      if (typeof(eventName) !== 'string') {
        throw new Error('Argument eventName should be a string');
      }
      if (typeof(handler) !== 'function') {
        throw new Error('Argument handler should be a function');
      }
      RemoteStorage.log('[Eventhandling] Adding event listener', eventName, handler);
      this._validateEvent(eventName);
      this._handlers[eventName].push(handler);
    },

    /**
     * Method: removeEventListener
     *
     * Remove a previously installed event handler
     */
    removeEventListener: function (eventName, handler) {
      this._validateEvent(eventName);
      var hl = this._handlers[eventName].length;
      for (var i=0;i<hl;i++) {
        if (this._handlers[eventName][i] === handler) {
          this._handlers[eventName].splice(i, 1);
          return;
        }
      }
    },

    _emit: function (eventName) {
      this._validateEvent(eventName);
      var args = Array.prototype.slice.call(arguments, 1);
      this._handlers[eventName].forEach(function (handler) {
        handler.apply(this, args);
      });
    },

    _validateEvent: function (eventName) {
      if (! (eventName in this._handlers)) {
        throw new Error("Unknown event: " + eventName);
      }
    },

    _delegateEvent: function (eventName, target) {
      target.on(eventName, function (event) {
        this._emit(eventName, event);
      }.bind(this));
    },

    _addEvent: function (eventName) {
      this._handlers[eventName] = [];
    }
  };

  /**
   * Method: eventhandling.on
   *
   * Alias for <addEventListener>
   **/
  methods.on = methods.addEventListener;

  /**
   * Function: eventHandling
   *
   * Mixes event handling functionality into an object.
   *
   * The first parameter is always the object to be extended.
   * All remaining parameter are expected to be strings, interpreted as valid event
   * names.
   *
   * Example:
   *   (start code)
   *   var MyConstructor = function () {
   *     eventHandling(this, 'connected', 'disconnected');
   *
   *     this._emit('connected');
   *     this._emit('disconnected');
   *     // This would throw an exception:
   *     // this._emit('something-else');
   *   };
   *
   *   var myObject = new MyConstructor();
   *   myObject.on('connected', function () { console.log('connected'); });
   *   myObject.on('disconnected', function () { console.log('disconnected'); });
   *   // This would throw an exception as well:
   *   // myObject.on('something-else', function () {});
   *   (end code)
   */
  RemoteStorage.eventHandling = function (object) {
    var eventNames = Array.prototype.slice.call(arguments, 1);
    for (var key in methods) {
      object[key] = methods[key];
    }
    object._handlers = {};
    eventNames.forEach(function (eventName) {
      object._addEvent(eventName);
    });
  };
})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/wireclient.js **/
(function (global) {
  var RS = RemoteStorage;

  /**
   * Class: RemoteStorage.WireClient
   *
   * WireClient Interface
   * --------------------
   *
   * This file exposes a get/put/delete interface on top of XMLHttpRequest.
   * It requires to be configured with parameters about the remotestorage server to
   * connect to.
   * Each instance of WireClient is always associated with a single remotestorage
   * server and access token.
   *
   * Usually the WireClient instance can be accessed via `remoteStorage.remote`.
   *
   * This is the get/put/delete interface:
   *
   *   - #get() takes a path and optionally a ifNoneMatch option carrying a version
   *     string to check. It returns a promise that will be fulfilled with the HTTP
   *     response status, the response body, the MIME type as returned in the
   *     'Content-Type' header and the current revision, as returned in the 'ETag'
   *     header.
   *   - #put() takes a path, the request body and a content type string. It also
   *     accepts the ifMatch and ifNoneMatch options, that map to the If-Match and
   *     If-None-Match headers respectively. See the remotestorage-01 specification
   *     for details on handling these headers. It returns a promise, fulfilled with
   *     the same values as the one for #get().
   *   - #delete() takes a path and the ifMatch option as well. It returns a promise
   *     fulfilled with the same values as the one for #get().
   *
   * In addition to this, the WireClient has some compatibility features to work with
   * remotestorage 2012.04 compatible storages. For example it will cache revisions
   * from folder listings in-memory and return them accordingly as the "revision"
   * parameter in response to #get() requests. Similarly it will return 404 when it
   * receives an empty folder listing, to mimic remotestorage-01 behavior. Note
   * that it is not always possible to know the revision beforehand, hence it may
   * be undefined at times (especially for caching-roots).
   */

  var hasLocalStorage;
  var SETTINGS_KEY = 'remotestorage:wireclient';

  var API_2012 = 1, API_00 = 2, API_01 = 3, API_02 = 4, API_HEAD = 5;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'draft-dejong-remotestorage-02': API_02,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  var isArrayBufferView;

  if (typeof(ArrayBufferView) === 'function') {
    isArrayBufferView = function (object) { return object && (object instanceof ArrayBufferView); };
  } else {
    var arrayBufferViews = [
      Int8Array, Uint8Array, Int16Array, Uint16Array,
      Int32Array, Uint32Array, Float32Array, Float64Array
    ];
    isArrayBufferView = function (object) {
      for (var i=0;i<8;i++) {
        if (object instanceof arrayBufferViews[i]) {
          return true;
        }
      }
      return false;
    };
  }

  var isFolder = RemoteStorage.util.isFolder;
  var cleanPath = RemoteStorage.util.cleanPath;

  function addQuotes(str) {
    if (typeof(str) !== 'string') {
      return str;
    }
    if (str === '*') {
      return '*';
    }

    return '"' + str + '"';
  }

  function stripQuotes(str) {
    if (typeof(str) !== 'string') {
      return str;
    }

    return str.replace(/^["']|["']$/g, '');
  }

  function readBinaryData(content, mimeType, callback) {
    var blob;
    global.BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder;
    if (typeof global.BlobBuilder !== 'undefined') {
      var bb = new global.BlobBuilder();
      bb.append(content);
      blob = bb.getBlob(mimeType);
    } else {
      blob = new Blob([content], { type: mimeType });
    }

    var reader = new FileReader();
    if (typeof reader.addEventListener === 'function') {
      reader.addEventListener('loadend', function () {
        callback(reader.result); // reader.result contains the contents of blob as a typed array
      });
    } else {
      reader.onloadend = function() {
        callback(reader.result); // reader.result contains the contents of blob as a typed array
      };
    }
    reader.readAsArrayBuffer(blob);
  }

  function getTextFromArrayBuffer(arrayBuffer, encoding) {
    var pending = Promise.defer();
    if (typeof Blob === 'undefined') {
      var buffer = new Buffer(new Uint8Array(arrayBuffer));
      pending.resolve(buffer.toString(encoding));
    } else {
      var blob;
      global.BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder;
      if (typeof global.BlobBuilder !== 'undefined') {
        var bb = new global.BlobBuilder();
        bb.append(arrayBuffer);
        blob = bb.getBlob();
      } else {
        blob = new Blob([arrayBuffer]);
      }

      var fileReader = new FileReader();
      if (typeof fileReader.addEventListener === 'function') {
        fileReader.addEventListener('loadend', function (evt) {
          pending.resolve(evt.target.result);
        });
      } else {
        fileReader.onloadend = function(evt) {
          pending.resolve(evt.target.result);
        };
      }
      fileReader.readAsText(blob, encoding);
    }
    return pending.promise;
  }

  function determineCharset(mimeType) {
    var charset = 'UTF-8';
    var charsetMatch;

    if (mimeType) {
      charsetMatch = mimeType.match(/charset=(.+)$/);
      if (charsetMatch) {
        charset = charsetMatch[1];
      }
    }
    return charset;
  }

  function isFolderDescription(body) {
    return ((body['@context'] === 'http://remotestorage.io/spec/folder-description')
             && (typeof(body['items']) === 'object'));
  }

  function isSuccessStatus(status) {
    return [201, 204, 304].indexOf(status) >= 0;
  }

  function isErrorStatus(status) {
    return [401, 403, 404, 412].indexOf(status) >= 0;
  }

  var onErrorCb;

  /**
   * Class : RemoteStorage.WireClient
   **/
  RS.WireClient = function (rs) {
    this.connected = false;

    /**
     * Event: change
     *   Never fired for some reason
     *   # TODO create issue and fix or remove
     *
     * Event: connected
     *   Fired when the wireclient connect method realizes that it is in
     *   possession of a token and href
     **/
    RS.eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');

    onErrorCb = function (error){
      if (error instanceof RemoteStorage.Unauthorized) {
        this.configure({token: null});
      }
    }.bind(this);
    rs.on('error', onErrorCb);
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        setTimeout(function () {
          this.configure(settings);
        }.bind(this), 0);
      }
    }

    this._revisionCache = {};

    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.WireClient.REQUEST_TIMEOUT = 30000;

  RS.WireClient.prototype = {
    /**
     * Property: token
     *
     * Holds the bearer token of this WireClient, as obtained in the OAuth dance
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.token
     *   // -> 'DEADBEEF01=='
     */

    /**
     * Property: href
     *
     * Holds the server's base URL, as obtained in the Webfinger discovery
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.href
     *   // -> 'https://storage.example.com/users/jblogg/'
     */

    /**
     * Property: storageApi
     *
     * Holds the spec version the server claims to be compatible with
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.storageApi
     *   // -> 'draft-dejong-remotestorage-01'
     */

    _request: function (method, uri, token, headers, body, getEtag, fakeRevision) {
      if ((method === 'PUT' || method === 'DELETE') && uri[uri.length - 1] === '/') {
        return Promise.reject('Don\'t ' + method + ' on directories!');
      }

      var revision;
      var reqType;
      var self = this;

      if (token !== RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      this._emit('wire-busy', {
        method: method,
        isFolder: isFolder(uri)
      });

      return RS.WireClient.request(method, uri, {
        body: body,
        headers: headers,
        responseType: 'arraybuffer'
      }).then(function (response) {
        self._emit('wire-done', {
          method: method,
          isFolder: isFolder(uri),
          success: true
        });
        self.online = true;
        if (isErrorStatus(response.status)) {
          RemoteStorage.log('[WireClient] Error response status', response.status);
          if (getEtag) {
            revision = stripQuotes(response.getResponseHeader('ETag'));
          } else {
            revision = undefined;
          }
          return Promise.resolve({statusCode: response.status, revision: revision});
        } else if (isSuccessStatus(response.status) ||
                   (response.status === 200 && method !== 'GET')) {
          revision = stripQuotes(response.getResponseHeader('ETag'));
          RemoteStorage.log('[WireClient] Successful request', revision);
          return Promise.resolve({statusCode: response.status, revision: revision});
        } else {
          var mimeType = response.getResponseHeader('Content-Type');
          var body;
          if (getEtag) {
            revision = stripQuotes(response.getResponseHeader('ETag'));
          } else {
            revision = response.status === 200 ? fakeRevision : undefined;
          }

          var charset = determineCharset(mimeType);

          if ((!mimeType) || charset === 'binary') {
            RemoteStorage.log('[WireClient] Successful request with unknown or binary mime-type', revision);
            return Promise.resolve({statusCode: response.status, body: response.response, contentType: mimeType, revision: revision});
          } else {
            return getTextFromArrayBuffer(response.response, charset).then(function (body) {
              RemoteStorage.log('[WireClient] Successful request', revision);
              return Promise.resolve({statusCode: response.status, body: body, contentType: mimeType, revision: revision});
            });
          }
        }
      }, function (error) {
        self._emit('wire-done', {
          method: method,
          isFolder: isFolder(uri),
          success: false
        });
        return Promise.reject(error);
      });
    },

    /**
     *
     * Method: configure
     *
     * Sets the userAddress, href, storageApi, token, and properties of a
     * remote store. Also sets connected and online to true and emits the
     * 'connected' event, if both token and href are present.
     *
     * Parameters:
     *   settings - An object that may contain userAddress (string or null),
     *              href (string or null), storageApi (string or null), token (string
     *              or null), and/or properties (the JSON-parsed properties object
     *              from the user's WebFinger record, see section 10 of
     *              http://tools.ietf.org/html/draft-dejong-remotestorage-03
     *              or null).
     *              Fields that are not included (i.e. `undefined`), stay at
     *              their current value. To set a field, include that field
     *              with a `string` value. To reset a field, for instance when
     *              the user disconnected their storage, or you found that the
     *              token you have has expired, simply set that field to `null`.
     */
    configure: function (settings) {
      if (typeof settings !== 'object') {
        throw new Error('WireClient configure settings parameter should be an object');
      }
      if (typeof settings.userAddress !== 'undefined') {
        this.userAddress = settings.userAddress;
      }
      if (typeof settings.href !== 'undefined') {
        this.href = settings.href;
      }
      if (typeof settings.storageApi !== 'undefined') {
        this.storageApi = settings.storageApi;
      }
      if (typeof settings.token !== 'undefined') {
        this.token = settings.token;
      }
      if (typeof settings.properties !== 'undefined') {
        this.properties = settings.properties;
      }

      if (typeof this.storageApi !== 'undefined') {
        this._storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
        this.supportsRevs = this._storageApi >= API_00;
      }
      if (this.href && this.token) {
        this.connected = true;
        this.online = true;
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if (hasLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({
          userAddress: this.userAddress,
          href: this.href,
          storageApi: this.storageApi,
          token: this.token,
          properties: this.properties
        });
      }
    },

    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    get: function (path, options) {
      var self = this;
      if (!this.connected) {
        return Promise.reject('not connected (path: ' + path + ')');
      }
      if (!options) { options = {}; }
      var headers = {};
      if (this.supportsRevs) {
        if (options.ifNoneMatch) {
          headers['If-None-Match'] = addQuotes(options.ifNoneMatch);
        }
      } else if (options.ifNoneMatch) {
        var oldRev = this._revisionCache[path];
      }


      return this._request('GET', this.href + cleanPath(path), this.token, headers,
                            undefined, this.supportsRevs, this._revisionCache[path])
      .then(function (r) {
        if (!isFolder(path)) {
          return Promise.resolve(r);
        }
        var itemsMap = {};
        if (typeof(r.body) !== 'undefined') {
          try {
            r.body = JSON.parse(r.body);
          } catch (e) {
            return Promise.reject('Folder description at ' + self.href + cleanPath(path) + ' is not JSON');
          }
        }

        if (r.statusCode === 200 && typeof(r.body) === 'object') {
        // New folder listing received
          if (Object.keys(r.body).length === 0) {
          // Empty folder listing of any spec
            r.statusCode = 404;
          } else if (isFolderDescription(r.body)) {
          // >= 02 spec
            for (var item in r.body.items) {
              self._revisionCache[path + item] = r.body.items[item].ETag;
            }
            itemsMap = r.body.items;
          } else {
          // < 02 spec
            Object.keys(r.body).forEach(function (key){
              self._revisionCache[path + key] = r.body[key];
              itemsMap[key] = {'ETag': r.body[key]};
            });
          }
          r.body = itemsMap;
          return Promise.resolve(r);
        } else {
          return Promise.resolve(r);
        }
      });
    },

    put: function (path, body, contentType, options) {
      if (!this.connected) {
        return Promise.reject('not connected (path: ' + path + ')');
      }
      if (!options) { options = {}; }
      if ((!contentType.match(/charset=/)) && (body instanceof ArrayBuffer || isArrayBufferView(body))) {
        contentType +=  '; charset=binary';
      }
      var headers = { 'Content-Type': contentType };
      if (this.supportsRevs) {
        if (options.ifMatch) {
          headers['If-Match'] = addQuotes(options.ifMatch);
        }
        if (options.ifNoneMatch) {
          headers['If-None-Match'] = addQuotes(options.ifNoneMatch);
        }
      }
      return this._request('PUT', this.href + cleanPath(path), this.token,
                     headers, body, this.supportsRevs);
    },

    'delete': function (path, options) {
      if (!this.connected) {
        throw new Error('not connected (path: ' + path + ')');
      }
      if (!options) { options = {}; }
      var headers = {};
      if (this.supportsRevs) {
        if (options.ifMatch) {
          headers['If-Match'] = addQuotes(options.ifMatch);
        }
      }
      return this._request('DELETE', this.href + cleanPath(path), this.token,
                     headers,
                     undefined, this.supportsRevs);
    }
  };

  // Shared cleanPath used by Dropbox
  RS.WireClient.cleanPath = cleanPath;

  // Shared isArrayBufferView used by WireClient and Dropbox
  RS.WireClient.isArrayBufferView = isArrayBufferView;

  RS.WireClient.readBinaryData = readBinaryData;

  // Shared request function used by WireClient, GoogleDrive and Dropbox.
  RS.WireClient.request = function (method, url, options) {
    var pending = Promise.defer();
    RemoteStorage.log('[WireClient]', method, url);

    var timedOut = false;

    var timer = setTimeout(function () {
      timedOut = true;
      pending.reject('timeout');
    }, RS.WireClient.REQUEST_TIMEOUT);

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    if (options.responseType) {
      xhr.responseType = options.responseType;
    }

    if (options.headers) {
      for (var key in options.headers) {
        xhr.setRequestHeader(key, options.headers[key]);
      }
    }

    xhr.onload = function () {
      if (timedOut) { return; }
      clearTimeout(timer);
      pending.resolve(xhr);
    };

    xhr.onerror = function (error) {
      if (timedOut) { return; }
      clearTimeout(timer);
      pending.reject(error);
    };

    var body = options.body;

    if (typeof(body) === 'object' && !isArrayBufferView(body) && body instanceof ArrayBuffer) {
      body = new Uint8Array(body);
    }
    xhr.send(body);
    return pending.promise;
  };

  Object.defineProperty(RemoteStorage.WireClient.prototype, 'storageType', {
    get: function () {
      if (this.storageApi) {
        var spec = this.storageApi.match(/draft-dejong-(remotestorage-\d\d)/);
        return spec ? spec[1] : '2012.04';
      }
    }
  });


  RS.WireClient._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    remoteStorage.remote = new RS.WireClient(remoteStorage);
    this.online = true;
  };

  RS.WireClient._rs_supported = function () {
    return !! global.XMLHttpRequest;
  };

  RS.WireClient._rs_cleanup = function (remoteStorage){
    if (hasLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    remoteStorage.removeEventListener('error', onErrorCb);
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/discover.js **/
(function (global) {

  // feature detection flags
  var haveXMLHttpRequest, hasLocalStorage;
  // used to store settings in localStorage
  var SETTINGS_KEY = 'remotestorage:discover';
  // cache loaded from localStorage
  var cachedInfo = {};

  /**
   * Class: RemoteStorage.Discover
   *
   * This function deals with the Webfinger lookup, discovering a connecting
   * user's storage details.
   *
   * The discovery timeout can be configured via
   * `RemoteStorage.config.discoveryTimeout` (in ms).
   *
   * Arguments:
   *
   *   userAddress - user@host
   *
   * Returns:
   *
   * A promise for an object with the following properties.
   *
   *   href - Storage base URL,
   *   storageType - Storage type,
   *   authUrl - OAuth URL,
   *   properties - Webfinger link properties
   **/

  RemoteStorage.Discover = function (userAddress) {
    if (userAddress in cachedInfo) {
      return Promise.resolve(cachedInfo[userAddress]);
    }

    var webFinger = new WebFinger({
      tls_only: false,
      uri_fallback: true,
      request_timeout: 5000
    });

    var pending = Promise.defer();

    webFinger.lookup(userAddress, function (err, response) {
      if (err) {
        return pending.reject(err.message);
      } else if ((typeof response.idx.links.remotestorage !== 'object') ||
                 (typeof response.idx.links.remotestorage.length !== 'number') ||
                 (response.idx.links.remotestorage.length <= 0)) {
        RemoteStorage.log("[Discover] WebFinger record for " + userAddress + " does not have remotestorage defined in the links section ", JSON.stringify(response.json));
        return pending.reject("WebFinger record for " + userAddress + " does not have remotestorage defined in the links section.");
      }

      var rs = response.idx.links.remotestorage[0];
      var authURL = rs.properties['http://tools.ietf.org/html/rfc6749#section-4.2'] ||
                    rs.properties['auth-endpoint'];
      var storageType = rs.properties['http://remotestorage.io/spec/version'] ||
                        rs.type;

      // cache fetched data
      cachedInfo[userAddress] = { href: rs.href, storageType: storageType, authURL: authURL, properties: rs.properties };

      if (hasLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({ cache: cachedInfo });
      }

      return pending.resolve(cachedInfo[userAddress]);
    });

    return pending.promise;
  };

  RemoteStorage.Discover._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        cachedInfo = settings.cache;
      }
    }
  };

  RemoteStorage.Discover._rs_supported = function () {
    haveXMLHttpRequest = !! global.XMLHttpRequest;
    return haveXMLHttpRequest;
  };

  RemoteStorage.Discover._rs_cleanup = function () {
    if (hasLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: node_modules/webfinger.js/src/webfinger.js **/
/*!
 * webfinger.js
 *   version 2.1.4
 *   http://github.com/silverbucket/webfinger.js
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net> 2012 - 2014
 *
 * webfinger.js is released under the AGPL (see LICENSE).
 *
 * You don't have to do anything special to choose one license or the other and you don't
 * have to notify anyone which license you are using.
 * Please see the corresponding license file for details of these licenses.
 * You are free to use, modify and distribute this software, but all copyright
 * information must remain.
 *
 */

if (typeof XMLHttpRequest === 'undefined') {
  XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
}

(function (undefined) {

  // URI to property name map
  var LINK_URI_MAPS = {
    'http://webfist.org/spec/rel': 'webfist',
    'http://webfinger.net/rel/avatar': 'avatar',
    'remotestorage': 'remotestorage',
    'remoteStorage': 'remotestorage',
    'http://www.packetizer.com/rel/share': 'share',
    'http://webfinger.net/rel/profile-page': 'profile',
    'me': 'profile',
    'vcard': 'vcard',
    'blog': 'blog',
    'http://packetizer.com/rel/blog': 'blog',
    'http://schemas.google.com/g/2010#updates-from': 'updates',
    'https://camlistore.org/rel/server': 'camilstore'
  };

  var LINK_PROPERTIES = {
    'avatar': [],
    'remotestorage': [],
    'blog': [],
    'vcard': [],
    'updates': [],
    'share': [],
    'profile': [],
    'webfist': [],
    'camilstore': []
  };

  // list of endpoints to try, fallback from beginning to end.
  var URIS = ['webfinger', 'host-meta', 'host-meta.json'];

  function _err(obj) {
    obj.toString = function () {
      return this.message;
    };
    return obj;
  }

  /**
   * Function: WebFinger
   *
   * WebFinger constructor
   *
   * Returns:
   *
   *   return WebFinger object
   */
  function WebFinger(config) {
    if (typeof config !== 'object') {
      config = {};
    }

    this.config = {
      tls_only:         (typeof config.tls_only !== 'undefined') ? config.tls_only : true,
      webfist_fallback: (typeof config.webfist_fallback !== 'undefined') ? config.webfist_fallback : false,
      uri_fallback:     (typeof config.uri_fallback !== 'undefined') ? config.uri_fallback : false,
      request_timeout:  (typeof config.request_timeout !== 'undefined') ? config.request_timeout : 10000
    };
  }

  // make an http request and look for JRD response, fails if request fails
  // or response not json.
  WebFinger.prototype._fetchJRD = function (url, cb) {
    var self = this;
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          if (self._isValidJSON(xhr.responseText)) {
            cb(null, xhr.responseText);
          } else {
            cb(_err({
              message: 'invalid json',
              url: url,
              status: xhr.status
            }));
          }
        } else if (xhr.status === 404) {
          cb(_err({
            message: 'endpoint unreachable',
            url: url,
            status: xhr.status
          }));
        } else {
          cb(_err({
            message: 'error during request',
            url: url,
            status: xhr.status
          }));
        }
      }
    };

    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/jrd+json, application/json');
    xhr.send();
  };

  WebFinger.prototype._isValidJSON = function (str) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  };

  WebFinger.prototype._isLocalhost = function (host) {
    var local = /^localhost(\.localdomain)?(\:[0-9]+)?$/;
    return local.test(host);
  };

  // processes JRD object as if it's a webfinger response object
  // looks for known properties and adds them to profile datat struct.
  WebFinger.prototype._processJRD = function (JRD, cb) {
    var self = this;
    var parsedJRD = JSON.parse(JRD);
    if ((typeof parsedJRD !== 'object') ||
        (typeof parsedJRD.links !== 'object')) {
      if (typeof parsedJRD.error !== 'undefined') {
        cb(_err({ message: parsedJRD.error }));
      } else {
        cb(_err({ message: 'unknown response from server' }));
      }
      return false;
    }

    var links = parsedJRD.links;
    var result = {  // webfinger JRD - object, json, and our own indexing
      object: parsedJRD,
      json: JRD,
      idx: {}
    };

    result.idx.properties = {
      'name': undefined
    };
    result.idx.links = JSON.parse(JSON.stringify(LINK_PROPERTIES));

    // process links
    links.map(function (link, i) {
      if (LINK_URI_MAPS.hasOwnProperty(link.rel)) {
        if (result.idx.links[LINK_URI_MAPS[link.rel]]) {
          var entry = {};
          Object.keys(link).map(function (item, n) {
            entry[item] = link[item];
          });
          result.idx.links[LINK_URI_MAPS[link.rel]].push(entry);
        }
      }
    });

    // process properties
    var props = JSON.parse(JRD).properties;
    for (var key in props) {
      if (props.hasOwnProperty(key)) {
        if (key === 'http://packetizer.com/ns/name') {
          result.idx.properties.name = props[key];
        }
      }
    }
    cb(null, result);
  };

  WebFinger.prototype.lookup = function (address, cb) {
    if (typeof address !== 'string') {
      throw new Error('first parameter must be a user address');
    } else if (typeof cb !== 'function') {
      throw new Error('second parameter must be a callback');
    }

    var self = this;
    var parts = address.replace(/ /g,'').split('@');
    var host = parts[1];    // host name for this useraddress
    var uri_index = 0;      // track which URIS we've tried already
    var protocol = 'https'; // we use https by default

    if (parts.length !== 2) {
      cb(_err({ message: 'invalid user address ' + address + ' ( expected format: user@host.com )' }));
      return false;
    } else if (self._isLocalhost(host)) {
      protocol = 'http';
    }

    function _buildURL() {
      return protocol + '://' + host + '/.well-known/' +
             URIS[uri_index] + '?resource=acct:' + address;
    }

    // control flow for failures, what to do in various cases, etc.
    function _fallbackChecks(err) {
      if ((self.config.uri_fallback) && (host !== 'webfist.org') && (uri_index !== URIS.length - 1)) { // we have uris left to try
        uri_index = uri_index + 1;
        _call();
      } else if ((!self.config.tls_only) && (protocol === 'https')) { // try normal http
        uri_index = 0;
        protocol = 'http';
        _call();
      } else if ((self.config.webfist_fallback) && (host !== 'webfist.org')) { // webfist attempt
        uri_index = 0;
        protocol = 'http';
        host = 'webfist.org';
        // webfist will
        // 1. make a query to the webfist server for the users account
        // 2. from the response, get a link to the actual webfinger json data
        //    (stored somewhere in control of the user)
        // 3. make a request to that url and get the json
        // 4. process it like a normal webfinger response
        self._fetchJRD(_buildURL(), function (err, data) { // get link to users JRD
          if (err) {
            cb(err);
            return false;
          }
          self._processJRD(data, function (err, result) {
            if ((typeof result.idx.links.webfist === 'object') &&
                (typeof result.idx.links.webfist[0].href === 'string')) {
              self._fetchJRD(result.idx.links.webfist[0].href, function (err, JRD) {
                if (err) {
                  cb(err);
                } else {
                  self._processJRD(JRD, cb);
                }
              });
            }
          });
        });
      } else {
        cb(err);
        return false;
      }
    }

    function _call() {
      // make request
      self._fetchJRD(_buildURL(), function (err, JRD) {
        if (err) {
          _fallbackChecks(err);
        } else {
          self._processJRD(JRD, cb);
        }
      });
    }

    setTimeout(_call, 0);
  };

  if (typeof window === 'object') {
    window.WebFinger = WebFinger;
  } else if (typeof (define) === 'function' && define.amd) {
    define([], function () { return WebFinger; });
  } else {
    try {
      module.exports = WebFinger;
    } catch (e) {}
  }
})();



/** FILE: src/authorize.js **/
(function (global) {

  function extractParams(url) {
    //FF already decodes the URL fragment in document.location.hash, so use this instead:
    var location = url || RemoteStorage.Authorize.getLocation().href,
        hashPos  = location.indexOf('#'),
        hash;
    if (hashPos === -1) { return; }
    hash = location.substring(hashPos+1);
    // if hash is not of the form #key=val&key=val, it's probably not for us
    if (hash.indexOf('=') === -1) { return; }
    return hash.split('&').reduce(function (m, kvs) {
      var kv = kvs.split('=');
      m[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      return m;
    }, {});
  }

  RemoteStorage.ImpliedAuth = function (storageApi, redirectUri) {
    RemoteStorage.log('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
    // Set a fixed access token, signalling to not send it as Bearer
    remoteStorage.remote.configure({
      token: RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN
    });
    document.location = redirectUri;
  };

  RemoteStorage.Authorize = function (authURL, scope, redirectUri, clientId) {
    RemoteStorage.log('[Authorize] authURL = ', authURL, 'scope = ', scope, 'redirectUri = ', redirectUri, 'clientId = ', clientId);

    var url = authURL, hashPos = redirectUri.indexOf('#');
    url += authURL.indexOf('?') > 0 ? '&' : '?';
    url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
    url += '&scope=' + encodeURIComponent(scope);
    url += '&client_id=' + encodeURIComponent(clientId);
    if (hashPos !== -1) {
      url += '&state=' + encodeURIComponent(redirectUri.substring(hashPos+1));
    }
    url += '&response_type=token';

    if (global.cordova) {
      return RemoteStorage.Authorize.openWindow(
          url,
          redirectUri,
          'location=yes,clearsessioncache=yes,clearcache=yes'
        )
        .then(function(authResult) {
          remoteStorage.remote.configure({
            token: authResult.access_token
          });

          // TODO
          // sync doesn't start until after reload
          // possibly missing some initialization step?
          global.location.reload();
        })
        .then(null, function(error) {
          console.error(error);
          remoteStorage.widget.view.setState('initial');
        });
    }

    RemoteStorage.Authorize.setLocation(url);
  };

  RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN = false;

  RemoteStorage.prototype.authorize = function (authURL, cordovaRedirectUri) {
    this.access.setStorageType(this.remote.storageType);
    var scope = this.access.scopeParameter;

    var redirectUri = global.cordova ?
      cordovaRedirectUri :
      String(RemoteStorage.Authorize.getLocation());

    var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

    RemoteStorage.Authorize(authURL, scope, redirectUri, clientId);
  };

  /**
   * Get current document location
   *
   * Override this method if access to document.location is forbidden
   */
  RemoteStorage.Authorize.getLocation = function () {
    return global.document.location;
  };

  /**
   * Set current document location
   *
   * Override this method if access to document.location is forbidden
   */
  RemoteStorage.Authorize.setLocation = function (location) {
    if (typeof location === 'string') {
      global.document.location.href = location;
    } else if (typeof location === 'object') {
      global.document.location = location;
    } else {
      throw "Invalid location " + location;
    }
  };

  /**
   * Open new InAppBrowser window for OAuth in Cordova
   */
  RemoteStorage.Authorize.openWindow = function (url, redirectUri, options) {
    var pending = Promise.defer();
    var newWindow = global.open(url, '_blank', options);

    if (!newWindow || newWindow.closed) {
      pending.reject('Authorization popup was blocked');
      return pending.promise;
    }

    var handleExit = function () {
      pending.reject('Authorization was canceled');
    };

    var handleLoadstart = function (event) {
      if (event.url.indexOf(redirectUri) !== 0) {
        return;
      }

      newWindow.removeEventListener('exit', handleExit);
      newWindow.close();

      var authResult = extractParams(event.url);

      if (!authResult) {
        return pending.reject('Authorization error');
      }

      return pending.resolve(authResult);
    };

    newWindow.addEventListener('loadstart', handleLoadstart);
    newWindow.addEventListener('exit', handleExit);

    return pending.promise;
  };

  RemoteStorage.prototype.impliedauth = function () {
    RemoteStorage.ImpliedAuth(this.remote.storageApi, String(document.location));
  };

  RemoteStorage.Authorize._rs_supported = function () {
    return typeof(document) !== 'undefined';
  };

  var onFeaturesLoaded;
  RemoteStorage.Authorize._rs_init = function (remoteStorage) {

    onFeaturesLoaded = function () {
      var authParamsUsed = false;
      if (params) {
        if (params.error) {
          throw "Authorization server errored: " + params.error;
        }
        if (params.access_token) {
          remoteStorage.remote.configure({
            token: params.access_token
          });
          authParamsUsed = true;
        }
        if (params.remotestorage) {
          remoteStorage.connect(params.remotestorage);
          authParamsUsed = true;
        }
        if (params.state) {
          RemoteStorage.Authorize.setLocation('#'+params.state);
        }
      }
      if (!authParamsUsed) {
        remoteStorage.remote.stopWaitingForToken();
      }
    };
    var params = extractParams(),
        location;
    if (params) {
      location = RemoteStorage.Authorize.getLocation();
      location.hash = '';
    }
    remoteStorage.on('features-loaded', onFeaturesLoaded);
  };

  RemoteStorage.Authorize._rs_cleanup = function (remoteStorage) {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/access.js **/
(function(global) {

  var SETTINGS_KEY = "remotestorage:access";

  /**
   * Class: RemoteStorage.Access
   *
   * Keeps track of claimed access and scopes.
   */
  RemoteStorage.Access = function() {
    this.reset();
  };

  RemoteStorage.Access.prototype = {

    /**
     * Method: claim
     *
     * Claim access on a given scope with given mode.
     *
     * Parameters:
     *   scope - An access scope, such as "contacts" or "calendar"
     *   mode  - Access mode. Either "r" for read-only or "rw" for read/write
     *
     * Example:
     *   (start code)
     *   remoteStorage.access.claim('contacts', 'r');
     *   remoteStorage.access.claim('pictures', 'rw');
     *   (end code)
     *
     * Root access:
     *   Claiming root access, meaning complete access to all files and folders
     *   of a storage, can be done using an asterisk:
     *
     *   (start code)
     *   remoteStorage.access.claim('*', 'rw');
     *   (end code)
     */
    claim: function(scope, mode) {
      if (typeof(scope) !== 'string' || scope.indexOf('/') !== -1 || scope.length === 0) {
        throw new Error('Scope should be a non-empty string without forward slashes');
      }
      if (!mode.match(/^rw?$/)) {
        throw new Error('Mode should be either \'r\' or \'rw\'');
      }
      this._adjustRootPaths(scope);
      this.scopeModeMap[scope] = mode;
    },

    get: function(scope) {
      return this.scopeModeMap[scope];
    },

    remove: function(scope) {
      var savedMap = {};
      var name;
      for (name in this.scopeModeMap) {
        savedMap[name] = this.scopeModeMap[name];
      }
      this.reset();
      delete savedMap[scope];
      for (name in savedMap) {
        this.set(name, savedMap[name]);
      }
    },

    /**
     * Verify permission for a given scope.
     */
    checkPermission: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode === 'r' || actualMode === 'rw');
    },

    /**
     * Verify permission for a given path.
     */
    checkPathPermission: function(path, mode) {
      if (this.checkPermission('*', mode)) {
        return true;
      }
      return !!this.checkPermission(this._getModuleName(path), mode);
    },

    reset: function() {
      this.rootPaths = [];
      this.scopeModeMap = {};
    },

    /**
     * Return the module name for a given path.
     */
    _getModuleName: function(path) {
      if (path[0] !== '/') {
        throw new Error('Path should start with a slash');
      }
      var moduleMatch = path.replace(/^\/public/, '').match(/^\/([^\/]*)\//);
      return moduleMatch ? moduleMatch[1] : '*';
    },

    _adjustRootPaths: function(newScope) {
      if ('*' in this.scopeModeMap || newScope === '*') {
        this.rootPaths = ['/'];
      } else if (! (newScope in this.scopeModeMap)) {
        this.rootPaths.push('/' + newScope + '/');
        this.rootPaths.push('/public/' + newScope + '/');
      }
    },

    _scopeNameForParameter: function(scope) {
      if (scope.name === '*' && this.storageType) {
        if (this.storageType === '2012.04') {
          return '';
        } else if (this.storageType.match(/remotestorage-0[01]/)) {
          return 'root';
        }
      }
      return scope.name;
    },

    setStorageType: function(type) {
      this.storageType = type;
    }
  };

  /**
   * Property: scopes
   *
   * Holds an array of claimed scopes in the form
   * > { name: "<scope-name>", mode: "<mode>" }
   */
  Object.defineProperty(RemoteStorage.Access.prototype, 'scopes', {
    get: function() {
      return Object.keys(this.scopeModeMap).map(function(key) {
        return { name: key, mode: this.scopeModeMap[key] };
      }.bind(this));
    }
  });

  Object.defineProperty(RemoteStorage.Access.prototype, 'scopeParameter', {
    get: function() {
      return this.scopes.map(function(scope) {
        return this._scopeNameForParameter(scope) + ':' + scope.mode;
      }.bind(this)).join(' ');
    }
  });

  // Documented in src/remotestorage.js
  Object.defineProperty(RemoteStorage.prototype, 'access', {
    get: function() {
      var access = new RemoteStorage.Access();
      Object.defineProperty(this, 'access', {
        value: access
      });
      return access;
    },
    configurable: true
  });

  RemoteStorage.Access._rs_init = function() {};
})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/env.js **/
(function (pMode) {

  var mode = pMode,
      env = {},
      isBackground = false;


  RemoteStorage.Env = function () {
    return env;
  };

  RemoteStorage.Env.isBrowser = function () {
    return mode === "browser";
  };

  RemoteStorage.Env.isNode = function () {
    return mode === "node";
  };

  RemoteStorage.Env.goBackground = function () {
    isBackground = true;
    RemoteStorage.Env._emit("background");
  };

  RemoteStorage.Env.goForeground = function () {
    isBackground = false;
    RemoteStorage.Env._emit("foreground");
  };

  RemoteStorage.Env._rs_init = function (remoteStorage) {
    RemoteStorage.eventHandling(RemoteStorage.Env, "background", "foreground");

    function visibility() {
      if (document[env.hiddenProperty]) {
        RemoteStorage.Env.goBackground();
      } else {
        RemoteStorage.Env.goForeground();
      }
    }

    if ( mode === 'browser') {
      if ( typeof(document.hidden) !== "undefined" ) {
        env.hiddenProperty = "hidden";
        env.visibilityChangeEvent = "visibilitychange";
      } else if ( typeof(document.mozHidden) !== "undefined" ) {
        env.hiddenProperty = "mozHidden";
        env.visibilityChangeEvent = "mozvisibilitychange";
      } else if ( typeof(document.msHidden) !== "undefined" ) {
        env.hiddenProperty = "msHidden";
        env.visibilityChangeEvent = "msvisibilitychange";
      } else if ( typeof(document.webkitHidden) !== "undefined" ) {
        env.hiddenProperty = "webkitHidden";
        env.visibilityChangeEvent = "webkitvisibilitychange";
      }
      document.addEventListener(env.visibilityChangeEvent, visibility, false);
      visibility();
    }
  };

  RemoteStorage.Env._rs_cleanup = function (remoteStorage) {
  };

})(typeof(window) !== 'undefined' ? 'browser' : 'node');


/** FILE: src/i18n.js **/
(function () {
  /**
   * Class: RemoteStorage.I18n
   *
   * TODO add documentation
   **/

  "use strict";

  var dictionary = {
    "view_info": 'This app allows you to use your own storage. <a href="http://remotestorage.io/" target="_blank">Learn more!</a>',
    "view_connect": "<strong>Connect</strong> remote storage",
    "view_connecting": "Connecting <strong>%s</strong>",
    "view_offline": "Offline",
    "view_error_occured": "Sorry! An error occured.",
    "view_invalid_key": "Wrong key!",
    "view_confirm_reset": "Are you sure you want to reset everything? This will clear your local data and reload the page.",
    "view_get_me_out": "Get me out of here!",
    "view_error_plz_report": 'If this problem persists, please <a href="http://remotestorage.io/community/" target="_blank">let us know</a>!',
    "view_unauthorized": "Unauthorized! Click here to reconnect."
  };

  RemoteStorage.I18n = {

    translate: function () {
      var str    = arguments[0],
          params = Array.prototype.splice.call(arguments, 1);

      if (typeof dictionary[str] !== "string") {
        throw "Unknown translation string: " + str;
      } else {
        str = dictionary[str];
      }
      return (str.replace(/%s/g, function (){ return params.shift(); }));
    },

    getDictionary: function () {
      return dictionary;
    },

    setDictionary: function (newDictionary) {
      dictionary = newDictionary;
    }

  };
})();


/** FILE: src/assets.js **/
/** THIS FILE WAS GENERATED BY build/compile-assets.js. DO NOT CHANGE IT MANUALLY, BUT INSTEAD CHANGE THE ASSETS IN assets/. **/
RemoteStorage.Assets = {

  cipherIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMTQiIHdpZHRoPSIyNS4xNzciIHZlcnNpb249IjEuMSIgeG1sbnM6Y2M9Imh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL25zIyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIj4KIDxwYXRoIGQ9Im0yNS4xNzcgNS41MzIzYy0wLjA1NjQtMC4xMTI5MS0wLjA1NjQtMC4yMjU4MS0wLjE2OTM2LTAuMzM4NzEtMC4xMTI5LTAuMTEyOS0wLjI4MjI1LTAuMTY5MzYtMC4zOTUxNi0wLjE2OTM2aC0xMS40MDNjLTAuNzMzLTIuODc5LTMuMzg2NC01LjAyNDItNi40OTEzLTUuMDI0Mi0zLjY2OTMgMC02LjcxNzcgMy4wNDg0LTYuNzE3NyA2LjcxNzcgMCAzLjcyNjMgMy4wNDg0IDYuNzE3MyA2LjcxNzcgNi43MTczIDMuMzMwNyAwIDYuMDQwMy0yLjQyNzQgNi42MDQ4LTUuNTg4N2gyLjU0MDN2My42Njk0YzAgMC4yODIyNiAwLjI4MjI2IDAuNTA4MDYgMC41NjQ1MiAwLjUwODA2aDEuNzVjMC4yODIyNiAwIDAuNTY0NTItMC4yMjU4IDAuNTY0NTItMC41MDgwNnYtMy42Njk0aDEuNDY3N3Y1LjY0NTJjMCAwLjI4MjI1IDAuMjI1OCAwLjUwODA2IDAuNTA4MDYgMC41MDgwNmgxLjgwNjRjMC4yODIyNiAwIDAuNTA4MDctMC4yMjU4MSAwLjU2NDUyLTAuNTA4MDZ2LTUuNjQ1MmgxLjUyNDJjMC4xMTI5MSAwIDAuMjgyMjYgMCAwLjM5NTE2LTAuMTEyOSAwLjExMjkxLTAuMTEyOSAwLjE2OTM2LTAuMjgyMjYgMC4xNjkzNi0wLjM5NTE2di0xLjgwNjR6bS0xOC40NTkgNS4wODA3Yy0yLjA4ODcgMC0zLjgzODctMS42OTM2LTMuODM4Ny0zLjgzODcgMC0yLjE0NTIgMS43NS0zLjgzODcgMy44Mzg3LTMuODM4NyAyLjE0NTIgMCAzLjgzODcgMS42OTM2IDMuODM4NyAzLjgzODcgMCAyLjE0NTItMS42OTM2IDMuODM4Ny0zLjgzODcgMy44Mzg3eiIgZmlsbD0iI2ZmZiIvPgo8L3N2Zz4K',
  connectIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMTYiIHdpZHRoPSIxNiIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iPgogPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCAtMTAzNi40KSI+CiAgPHBhdGggZD0ibTEgMTA0Ny40di02aDd2LTRsNyA3LTcgN3YtNHoiIGZpbGw9IiNmZmYiLz4KIDwvZz4KPC9zdmc+Cg==',
  disconnectIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMTYiIHdpZHRoPSIxNiIgdmVyc2lvbj0iMS4wIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIj4KIDxwYXRoIHN0eWxlPSJibG9jay1wcm9ncmVzc2lvbjp0Yjt0ZXh0LWluZGVudDowO2NvbG9yOiMwMDAwMDA7dGV4dC10cmFuc2Zvcm06bm9uZSIgZD0ibTguMDAwMSAwYy0wLjQ3MTQgMC0wLjk2MTAzIDAuNTQxOS0wLjk1IDF2NmMtMC4wMDc0NyAwLjUyODMxIDAuNDIxNjMgMSAwLjk1IDFzMC45NTc0Ny0wLjQ3MTY5IDAuOTUtMXYtNmMwLjAxNDYyMi0wLjYwNTEtMC40Nzg2LTEtMC45NS0xem0tMy4zNDM4IDIuNWMtMC4wODcxODYgMC4wMTkyOTQtMC4xNzE2MyAwLjA1MDk1OS0wLjI1IDAuMDkzNzUtMi45OTk1IDEuNTcxNS0zLjkxODQgNC43OTc5LTMuMTI1IDcuNDY4OCAwLjc5MzQgMi42NyAzLjI3OTkgNC45MzcgNi42ODc1IDQuOTM3IDMuMzU5MiAwIDUuODc3Mi0yLjE0OSA2LjcxOTItNC43ODEgMC44NDEtMi42MzIxLTAuMDU4LTUuODIzNC0zLjEyNS03LjU5NC0wLjQzNC0wLjI1MzYtMS4wNTktMC4wODk5LTEuMzEzIDAuMzQzNy0wLjI1MzYgMC40MzM2LTAuMDkgMS4wNTg5IDAuMzQ0IDEuMzEyNSAyLjM5MDggMS4zNzk4IDIuODgyNSAzLjQ5NDQgMi4yODEyIDUuMzc1LTAuNjAxMiAxLjg4MDYtMi4zNDQgMy40Mzc1LTQuOTA2MiAzLjQzNzUtMi41NzU5IDAtNC4yOTc2LTEuNjUwMi00Ljg3NS0zLjU5MzgtMC41Nzc2LTEuOTQzNS0wLjA0Ny00LjA0OCAyLjE4NzMtNS4yMTg3IDAuMzc4Ny0wLjIwNjMgMC41NzkxLTAuNjkyNSAwLjQ1NTgtMS4xMDU3LTAuMTIzMi0wLjQxMzMtMC41NTcyLTAuNzEwMy0wLjk4Ny0wLjY3NTUtMC4wMzEzLTAuMDAxNS0wLjA2MjYtMC4wMDE1LTAuMDkzOCAweiIgZmlsbD0iI2ZmZiIvPgo8L3N2Zz4K',
  dropbox: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3QgPEBAhEOpfuQAABhZJREFUWMPVl31snVUdxz+/5/2577e3b7QbHaOD0nXshW4ZZkpGQmJYZkJUDAaZzCBGAxGd+pdZQsJIjCaKgFu09GWybIggm8yhMCsY92rcOkPHunbdtKOUbX36svX23uc+xz+eDsrWlztiNJzk5D7JPS+fc8739/2dA5+EsqJtyK18ZlCKbX9Lk6fd1uo5xbTVZmtwa4v35Np5Mry4TLYXCzAnyhsry2SwrmnokdnaTruq6i3e0lXl0tqQlkURCxwdDp9Th5p3+p9iS8afqk/VZq9kaZoDN8apdU3B1KFnmLde7AkezH0n3V0UQOJpz2hIsqEhLU+WOeAagmtCxISYBe1nVf4vfWrByYdSpyf3W9ziLapy6JgbAduAiBn2S1rCQBYODAQP7H01/zxby4JpAW5s8mproxypiRKNGIJrQNT8EMA1wTGEU8MBP/q7umPw0dSbAA3N3n3zI2yLG2oScPgbNYWICY4Be86o/le6g0W576bPXQWwcqvXdJ2t1idMsA1hJoCoCRfGYdOhwsa4TUWFrr7pGmDrzAiQCHfD//Xxwk/33Z/6HoA0tnhLXZ3XMoYqsy4PYs4M4Ohg6pB2ddqO+vR6BWL27AARXbBNiBjwh9Oqs+O8ukcT4eaopjLqGsJSCdSX29SX23x/lctXlzgE1zBAANxWIQuGxlWNACxr8WozJp0lljKsGXbA0qGu1GRBxsTUQRAGLgboIuQVvHI8S+f7eeK2TLsDSQd296rhPaeDm09+PdX/gQYqN3uZ+jh7ro+oRusKDdgmVEY1GqstSiOhdegCmoQAIoImIWTPYIHdXVlyBYhaVwLA70+rPz7fllvLi2W5KcPw9q3eS/VJ7kmYgm1A3BIWV5osq7IIlMLUQJOrAXQBXQtr1BR2d2XpOu8TtULR+gq2nQh+vv8rqUdnNaKGZm/9qnJpmp/U+fxCB5lYsaGFdTYAY9L3jmNj9F9S7OgKVh9/KNVelBVf8untv8TYSS8gbsrHyh8C2LqQtGE0z9CJYfVuUblgRZv3WGOJvJG0cF8/lWPNdo+O93xsHYoVuqkL/xzIs/HPHt2DPg0Zko+v0I8vbfHun9aKE5sH9YaobJsf5V4mRLXv33kSlmAYwspqgw23R7A1EJlahKYOSsHTB0cZHQ9IOBA3NSrjGo4hWAY82xH8rH1b/jF2laoPAOb80jPqYtKTMdRcTQNd+xAgbgmuJbiGELfh3lsc7q41KQSTABBcC1qPjLH/XzniNqScsP1kgMsm9nJ34e2mNcmFAMby1qFPZyz1WlxXrprhuEUgUPDbd8Y59n6edbe61KZ1TF14vSfPLw5dYjhXIOMIM6lGAV+u0+tv+ttI/2+6/LsMQVXpUFCAqJkS9MT5anB2NGDjWxf5Yp3DvjN5th/LUhETolaRTqigxMGIWVKtHVyX2tGTJd2X5agUIfi8CmvUFOKGT++gT8wqLlKUgnwATxwq7P32m35Z+32pPQZA54MpH1iSb/XWZmx2VthTD1AATCBlCZ+dpwNg6EJjlUH3hQIKRaCujhZFaOPtfUH+8HvBnQceSP11yjA8vC616+A5FevL8jt/YiCR0HiQcAUVrnDHHO0jHTUNllXrpC0NRXiefjAxM4rhHLzQpZqf+eFFd/LkM17JGlu9p+xC8IgPhGlaqE1rNJZrxOzQok0dnjviY+nhbSntCH3DAWN+QMIWEhYsqTD4wYHChrPfSP9kqnmM6QAMkYtz4xqmDqeGA+rLNObGZVozkglx1ZfqZAvC2ZGAz9RYlEbAlsLoNd+Kx5RqO5/njKXDsnKdhCXFOaFAZUzjznlhyt5xIjiSLbBz2oVO98fRdalOoGZ5m/dUQ4pvJZ3Zr/CXlS5A74gabzlYePztr6U2faxr+eRy/RYvtjgjHauvkxvi9oTDXaGBuAUJWyh1hb3vqsOvfiG5/L/yMAE483BqdNeuXO3LvcGX3vEUhsZVsaYL9IzACz3BXcVOXvQOfKRsupBZv8R4bnW19rmqGPzqHz4BcMGn5U/Hgod5oiT3P3kvVj7rrfnx/pHBu7d7Azc1eY3/l0drzWbPXNjsGXySy38AbtMqneWU7BkAAAAASUVORK5CYII=',
  googledrive: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3QgPEA85ztzJcQAABZVJREFUWMPtl1uoXVcVhr8x5tprn7M1NG1i0pQqSG2jLcXipYJXjPogqFgpaHMSFUkpIjU+leKbDxIQSiHgjZgmrfXgQ6SKj5Ji7YVS05aUUqKQlNLQeDnN5Zzk9Jy99xy/D3OttU/StDlV33TBZM3FXmuMf/5jjv+fG/7XL1vti9tnv3Dtnnf+87JY8YmZNxEMM1sZ7tWpjz764mriVqvKvmfb1ONLy3+dGyWu6EWbvQwoydv5BMSqFuereakmfnls1GP25IDaBGYYjplhljDz5tk7YMtPfurAf6UE9Z6tNwDPAPXwtcxL1x9n4zRgDjjm1gCyC6JpCLoW/OX65of1nzCwG6gNo3aYeXF981mTvK2/WWFiMmoj7X+z5JcE0N87c4e7b3EvyTwZT5/r8ezZHu6GuWGpSegJ8/ZeBu6fHv35s1/7t0rQv29mjWF/ATZ1L4bQwohrpkYc/sBpwhJYAVdKYECzYAESIk4Am3sf+sPCW2LAzb9jbpvMDXfD3fEqkRIcGdbsevlt9LylPYG1K6/K3QzK75uAr78lBgb3b7sc2cl2Uaa21sDiGMvB2iQeu/EMm6bKHjD3SUsCEChnpEAKiLisd/PB+UsyMPjZNwzzh1ixcnOfsFCX51NU/PTvA6pkTUdYw4R3zyu1ArMDqyvBQB82+FiJUQJ4C8YgVT1SSvSTs+vEmkcwe7qEsUnt233Aij0BW4ZPbfngKpRQs7hXpYQNvRiuEtATWOW4bLi+z04pJbCnBAkBJggBQlIBIZCUJM0Cm9+QgcED2+/G7BprdMZaAFZExm1FWcz+NLdj32G/6XfPCB5GoJKp7H5FARHRtgRI1y0/+cm7Lwpg+v7t64DvNd5S2mqirKXHy6RoArp1Ykrc2hKtKCtXlNEyoQ6Ydi498fF1F2FAdwEbV9UnZne+8q19Z7o63vTb+TPnRneeWxwxHGdyziii6wApQNEydKUUd5wHYGrftvci7tKKLSME5bvCaruynI9rNL7vdZgiHhiP898Wl8bMnxty+uyIhcURo1FgjSg1DCDph4uPfuR9AFbvvS25p2cxbiyKVuh2o1O44n2lLLacb5v75v5fX6yl5h753IwUD+YcRAQ5B6FMMhj0jboSRhnAE258wvp7Z7aYcbCYCeCGt97ubfICLDP/q4WZ32x7M20fPfb+hxbH9ZdjHOQIIoR74EDywA3coa6MqtJnrP+LmRmcB63ob8dA1wllRm95LVc//22S16TGeKqqpqoHk10ESGJj/zjjgIhAISKCyJmcY6Uu8Pbq7C0V6ABh35dzvYWQG0QAhmSYCaUlNhzdCrlX2jpE6tV4b9DYcGFKEgG8svQucoicC4CsII8zeTxutAEQzx1duPL3vrxjdlnou0SDLdTulxJQmalXNzN98jpEJiSo+qTeoEnsnWC5lVZNRhkOZiq0G8XCmz1gpp3j/ZYdYLhj9qCkn3fJQ4QKeh9OccWxz6O0hGKM9wakeoBEZ1BmqfOMyYFk4gXS+edG4J4ju6/644VK+AOJhSIYpVRBpn/qPVRL65A51dRavJoG2UQkOqf0hgVrGG7u6syoJDObB+55nRANb589Afy40W0UwkY91h39CiLweg1UU+W3ohLNvC2VurJ1htR6A3QaYPCjI7uvOvGGOlfv2XoSuBzEhmNfZXDqBrweUPVqUlWodneSG+6J1NTevThfDpEjmnsmzuuCPPfCvRvfcakT0S2Aeq9tYPr0ZryeBvOOlZBKUIEiCAVZwTgy41x6v6hm0LFZ4o7N7IuXPA+EDx+XjQ+tP/4lUrW2vCI1ydR0iYgmWdtu4yzG7bOiAdn8iYlA0iFJh1Z1JJv+ye2b3n1419XRH2riP0aqqlKClABIjUMW+rtSlw5qmCpgsynnl56/d+M/+P91wfUvQjDgTzx9h9AAAAAASUVORK5CYII=',
  nocipherIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMTYiIHdpZHRoPSIxNiIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iPgogPHBhdGggZD0ibSAxMy4yMDMxMjQsMTEuNzczNDM4IGMgMC4yODEyNSwwLjI4MTI1IDAuNDIxODc1LDAuNjA5Mzc1IDAuNDIxODc1LDEuMDMxMjUgMCwwLjM3NSAtMC4xNDA2MjUsMC43NSAtMC40MjE4NzUsMS4wMzEyNSAtMC4yODEyNSwwLjIzNDM3NSAtMC42MDkzNzUsMC4zNzUgLTEuMDMxMjUsMC4zNzUgLTAuMzc1LDAgLTAuNzUsLTAuMTQwNjI1IC0xLjAzMTI1LC0wLjM3NSAwLDAgLTMuMTg3NDk4MSwtMy42NTYyNSAtMy4xODc0OTgxLC0zLjY1NjI1IDAsMCAtMy4xNDA2MjUsMy42NTYyNSAtMy4xNDA2MjUsMy42NTYyNSAtMC4yODEyNSwwLjIzNDM3NSAtMC42NTYyNSwwLjM3NSAtMS4wMzEyNSwwLjM3NSAtMC40MjE4NzUsMCAtMC43NSwtMC4xNDA2MjUgLTEuMDMxMjUsLTAuMzc1IC0wLjI4MTI1LC0wLjI4MTI1IC0wLjM3NSwtMC42NTYyNSAtMC4zNzUsLTEuMDMxMjUgMCwtMC40MjE4NzUgMC4wOTM3NSwtMC43NSAwLjM3NSwtMS4wMzEyNSAwLDAgMy4zMjgxMjUsLTMuNzUwMDAwNSAzLjMyODEyNSwtMy43NTAwMDA1IDAsMCAtMy4zMjgxMjUsLTMuNzk2ODc1IC0zLjMyODEyNSwtMy43OTY4NzUgLTAuMjgxMjUsLTAuMjgxMjUgLTAuMzc1LC0wLjYwOTM3NSAtMC4zNzUsLTEuMDMxMjUgMCwtMC4zNzUgMC4wOTM3NSwtMC43NSAwLjM3NSwtMS4wMzEyNSAwLjI4MTI1LC0wLjIzNDM3NSAwLjYwOTM3NSwtMC4zNzUgMS4wMzEyNSwtMC4zNzUgMC4zNzUsMCAwLjc1LDAuMTQwNjI1IDEuMDMxMjUsMC4zNzUgMCwwIDMuMTQwNjI1LDMuNjU2MjUgMy4xNDA2MjUsMy42NTYyNSAwLDAgMy4xODc0OTgxLC0zLjY1NjI1IDMuMTg3NDk4MSwtMy42NTYyNSAwLjI4MTI1LC0wLjIzNDM3NSAwLjY1NjI1LC0wLjM3NSAxLjAzMTI1LC0wLjM3NSAwLjQyMTg3NSwwIDAuNzUsMC4xNDA2MjUgMS4wMzEyNSwwLjM3NSAwLjI4MTI1LDAuMjgxMjUgMC40MjE4NzUsMC42NTYyNSAwLjQyMTg3NSwxLjAzMTI1IDAsMC40MjE4NzUgLTAuMTQwNjI1LDAuNzUgLTAuNDIxODc1LDEuMDMxMjUgMCwwIC0zLjMyODEyMzEsMy43OTY4NzUgLTMuMzI4MTIzMSwzLjc5Njg3NSAwLDAgMy4zMjgxMjMxLDMuNzUwMDAwNSAzLjMyODEyMzEsMy43NTAwMDA1IiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
  remoteStorageIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMzIiIHdpZHRoPSIzMiIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIj4KIDxkZWZzPgogIDxyYWRpYWxHcmFkaWVudCBpZD0iYSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGN5PSI1NzEuNDIiIGN4PSIxMDQ2LjUiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLjE0NDMzIDAgMCAuMTY2NjcgMTIwMS41IDg3Ny4xMSkiIHI9Ijk2Ij4KICAgPHN0b3Agc3RvcC1jb2xvcj0iI2ZmNGEwNCIgc3RvcC1vcGFjaXR5PSIuNzYxNTQiIG9mZnNldD0iMCIvPgogICA8c3RvcCBzdG9wLWNvbG9yPSIjZmY0YTA0IiBvZmZzZXQ9IjEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogPC9kZWZzPgogPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNiAtOTU2LjM1KSI+CiAgPHBhdGggc3R5bGU9ImNvbG9yOiMwMDAwMDAiIGQ9Im0xMzUyLjYgOTU2LjM1IDAuMjg4NiAxNS4xMzYgMTMuNTY3LTcuMTM1Mi0xMy44NTUtOC4wMDExemwtMTMuODU1IDguMDAxMSAxMy41NjcgNy4xMzUyIDAuMjg4Ny0xNS4xMzZ6bS0xMy44NTUgOC4wMDExdjE1Ljk5OGwxMi45NTgtNy44MTYyLTEyLjk1OC04LjE4MTV6bTAgMTUuOTk4IDEzLjg1NSA4LjAwMTEtMC42MDg5LTE1LjMxNy0xMy4yNDYgNy4zMTU2em0xMy44NTUgOC4wMDExIDEzLjg1NS04LjAwMTEtMTMuMjUxLTcuMzE1Ni0wLjYwNDQgMTUuMzE3em0xMy44NTUtOC4wMDExdi0xNS45OThsLTEyLjk2MiA4LjE4MTUgMTIuOTYyIDcuODE2MnoiIGZpbGw9InVybCgjYSkiLz4KIDwvZz4KPC9zdmc+Cg==',
  remoteStorageIconCiphered: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMzIiIHdpZHRoPSIzMiIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIj4KIDxkZWZzPgogIDxyYWRpYWxHcmFkaWVudCBpZD0iYSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGN5PSI1NzEuNDIiIGN4PSIxMDQ2LjUiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLjE0NDMzIDAgMCAuMTY2NjcgMTIwMS41IDg3Ny4xMSkiIHI9Ijk2Ij4KICAgPHN0b3Agc3RvcC1jb2xvcj0iI2ZmNGEwNCIgc3RvcC1vcGFjaXR5PSIuNzYxNTQiIG9mZnNldD0iMCIvPgogICA8c3RvcCBzdG9wLWNvbG9yPSIjZmY0YTA0IiBvZmZzZXQ9IjEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogPC9kZWZzPgogPHBhdGggc3R5bGU9ImNvbG9yOiMwMDAwMDAiIGQ9Im0xNiAwbDAuMTI1IDYuMzc1YzIuMDk4IDAuMDY3IDMuNzUgMS43NTk1IDMuNzUgMy44NzV2MS45NjloMS45MzcgMC4wMzJsOC00LjIxOS0xMy44NDQtOHpsLTEzLjg0NCA4IDggNC4yMTloMC4wMzIgMS45MDZ2LTEuOTY5YzAtMi4xMTU1IDEuNjgzLTMuODA4IDMuNzgxLTMuODc1bDAuMTI1LTYuMzc1em0tMTMuODQ0IDh2MTZsNy45OTk4LTQuODQ0di02LjA5NGwtNy45OTk4LTUuMDYyem0wIDE2bDEzLjg0NCA4LTAuMzc1LTEwLjA2MmgtNS40Njl2LTIuMzQ0bC03Ljk5OTggNC40MDZ6bTEzLjg0NCA4bDEzLjg0NC04LTgtNC40MDZ2Mi4zNDRoLTUuNDY5bC0wLjM3NSAxMC4wNjJ6bTEzLjg0NC04di0xNmwtOCA1LjA2MnY2LjA5NGw4IDQuODQ0em0tMTMuOTY5LTE3Yy0xLjczNSAwLjA2NjYtMy4xMjUgMS40OTg3LTMuMTI1IDMuMjV2MS45NjloMy4wMzFsMC4wOTQtNS4yMTl6bTAuMjUgMGwwLjA5NCA1LjIxOWgzLjAzMXYtMS45NjljMC0xLjc1MTMtMS4zOS0zLjE4MzQtMy4xMjUtMy4yNXptLTQuNzUgNS44NDRsNC4zNDQgMi4yODEgMC4wMzEtMi4yODFoLTQuMzc1em00Ljg3NSAwbDAuMDMxIDIuMjgxIDQuMzQ0LTIuMjgxaC00LjM3NXptLTUuNDM4IDAuNjI1djUuMzEybDQuMjgyLTIuNTkzLTQuMjgyLTIuNzE5em0xMC4zNzYgMGwtNC4yODIgMi43MTkgNC4yODIgMi41OTN2LTUuMzEyem0tNS43ODIgMy4yMTlsLTQuNTk0IDIuNTMxdjIuMDYyaDQuNzgybC0wLjE4OC00LjU5M3ptMS4xODggMGwtMC4xODggNC41OTNoNC43ODJ2LTIuMDYybC00LjU5NC0yLjUzMXoiIGZpbGw9InVybCgjYSkiLz4KPC9zdmc+Cg==',
  remoteStorageIconError: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMzIiIHdpZHRoPSIzMiIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIj4KIDxkZWZzPgogIDxyYWRpYWxHcmFkaWVudCBpZD0iYSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGN5PSI1NzEuNDIiIGN4PSIxMDQ2LjUiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLjE0NDMzIDAgMCAuMTY2NjcgMTIwMS41IDg3Ny4xMSkiIHI9Ijk2Ij4KICAgPHN0b3Agc3RvcC1jb2xvcj0iI2U5MDAwMCIgc3RvcC1vcGFjaXR5PSIuNzYwNzgiIG9mZnNldD0iMCIvPgogICA8c3RvcCBzdG9wLWNvbG9yPSIjZTkwMDAwIiBvZmZzZXQ9IjEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogPC9kZWZzPgogPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNiAtOTU2LjM1KSI+CiAgPHBhdGggc3R5bGU9ImNvbG9yOiMwMDAwMDAiIGQ9Im0xMzUyLjYgOTU2LjM1IDAuMjg4NiAxNS4xMzYgMTMuNTY3LTcuMTM1Mi0xMy44NTUtOC4wMDExemwtMTMuODU1IDguMDAxMSAxMy41NjcgNy4xMzUyIDAuMjg4Ny0xNS4xMzZ6bS0xMy44NTUgOC4wMDExdjE1Ljk5OGwxMi45NTgtNy44MTYyLTEyLjk1OC04LjE4MTV6bTAgMTUuOTk4IDEzLjg1NSA4LjAwMTEtMC42MDg5LTE1LjMxNy0xMy4yNDYgNy4zMTU2em0xMy44NTUgOC4wMDExIDEzLjg1NS04LjAwMTEtMTMuMjUxLTcuMzE1Ni0wLjYwNDQgMTUuMzE3em0xMy44NTUtOC4wMDExdi0xNS45OThsLTEyLjk2MiA4LjE4MTUgMTIuOTYyIDcuODE2MnoiIGZpbGw9InVybCgjYSkiLz4KIDwvZz4KPC9zdmc+Cg==',
  remoteStorageIconOffline: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMzIiIHdpZHRoPSIzMiIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIj4KIDxkZWZzPgogIDxyYWRpYWxHcmFkaWVudCBpZD0iYSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGN5PSI1NzEuNDIiIGN4PSIxMDQ2LjUiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLjE0NDMzIDAgMCAuMTY2NjcgMTIwMS41IDg3Ny4xMSkiIHI9Ijk2Ij4KICAgPHN0b3Agc3RvcC1jb2xvcj0iIzY5Njk2OSIgc3RvcC1vcGFjaXR5PSIuNzYxNTQiIG9mZnNldD0iMCIvPgogICA8c3RvcCBzdG9wLWNvbG9yPSIjNjc2NzY3IiBvZmZzZXQ9IjEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogPC9kZWZzPgogPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNiAtOTU2LjM1KSI+CiAgPHBhdGggc3R5bGU9ImNvbG9yOiMwMDAwMDAiIGQ9Im0xMzUyLjYgOTU2LjM1IDAuMjg4NiAxNS4xMzYgMTMuNTY3LTcuMTM1Mi0xMy44NTUtOC4wMDExemwtMTMuODU1IDguMDAxMSAxMy41NjcgNy4xMzUyIDAuMjg4Ny0xNS4xMzZ6bS0xMy44NTUgOC4wMDExdjE1Ljk5OGwxMi45NTgtNy44MTYyLTEyLjk1OC04LjE4MTV6bTAgMTUuOTk4IDEzLjg1NSA4LjAwMTEtMC42MDg5LTE1LjMxNy0xMy4yNDYgNy4zMTU2em0xMy44NTUgOC4wMDExIDEzLjg1NS04LjAwMTEtMTMuMjUxLTcuMzE1Ni0wLjYwNDQgMTUuMzE3em0xMy44NTUtOC4wMDExdi0xNS45OThsLTEyLjk2MiA4LjE4MTUgMTIuOTYyIDcuODE2MnoiIGZpbGw9InVybCgjYSkiLz4KIDwvZz4KPC9zdmc+Cg==',
  syncIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGVuYWJsZS1iYWNrZ3JvdW5kPSJuZXcgMCAwIDg3LjUgMTAwIiB4bWw6c3BhY2U9InByZXNlcnZlIiBoZWlnaHQ9IjE2IiB2aWV3Qm94PSIwIDAgMTUuOTk5OTk5IDE2IiB3aWR0aD0iMTYiIHZlcnNpb249IjEuMSIgeT0iMHB4IiB4PSIwcHgiIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyI+CjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKC01LjUxMTIgLTc2LjUyNSkiIGRpc3BsYXk9Im5vbmUiPgoJPHBhdGggZGlzcGxheT0iaW5saW5lIiBkPSJtNTEuNDczIDQyLjI1NS0yLjIwNSAyLjIxMmMxLjQ3OCAxLjQ3NyAyLjI5NSAzLjQ0MiAyLjI5NSA1LjUzMyAwIDQuMzA5LTMuNTA0IDcuODEyLTcuODEyIDcuODEydi0xLjU2MmwtMy4xMjUgMy4xMjUgMy4xMjQgMy4xMjV2LTEuNTYyYzYuMDI5IDAgMTAuOTM4LTQuOTA2IDEwLjkzOC0xMC45MzggMC0yLjkyNy0xLjE0MS01LjY3Ni0zLjIxNS03Ljc0NXoiLz4KCTxwYXRoIGRpc3BsYXk9ImlubGluZSIgZD0ibTQ2Ljg3NSA0MC42MjUtMy4xMjUtMy4xMjV2MS41NjJjLTYuMDMgMC0xMC45MzggNC45MDctMTAuOTM4IDEwLjkzOCAwIDIuOTI3IDEuMTQxIDUuNjc2IDMuMjE3IDcuNzQ1bDIuMjAzLTIuMjEyYy0xLjQ3Ny0xLjQ3OS0yLjI5NC0zLjQ0Mi0yLjI5NC01LjUzMyAwLTQuMzA5IDMuNTA0LTcuODEyIDcuODEyLTcuODEydjEuNTYybDMuMTI1LTMuMTI1eiIvPgo8L2c+CjxwYXRoIGZpbGw9IiNmZmYiIGQ9Im0xMCAwbC0wLjc1IDEuOTA2MmMtMS4wMDc4LTAuMjk0Mi0zLjQ1ODYtMC43NzA4LTUuNjU2MiAwLjkzNzYgMC0wLjAwMDItMy45MzAyIDIuNTk0MS0yLjA5MzggNy41OTQybDEuNjU2Mi0wLjcxOTJzLTEuNTM5OS0zLjExMjIgMS42ODc2LTUuNTMxM2MwIDAgMS42OTU3LTEuMTMzOSAzLjY4NzQtMC41OTM3bC0wLjcxODcgMS44MTI0IDMuODEyNS0xLjYyNS0xLjYyNS0zLjc4MTJ6Ii8+PHBhdGggZmlsbD0iI2ZmZiIgZD0ibTE0IDUuNTYyNWwtMS42NTYgMC43MTg3czEuNTQxIDMuMTEzNS0xLjY4OCA1LjUzMDhjMCAwLTEuNzI3MiAxLjEzNS0zLjcxODUgMC41OTRsMC43NS0xLjgxMi0zLjgxMjUgMS41OTQgMS41OTM4IDMuODEyIDAuNzgxMi0xLjkwNmMxLjAxMTMgMC4yOTUgMy40NjE1IDAuNzY2IDUuNjU2LTAuOTM4IDAgMCAzLjkyOC0yLjU5NCAyLjA5NC03LjU5MzV6Ii8+Cjwvc3ZnPgo=',
  widget: '<div class="rs-bubble rs-hidden">   <div class="rs-bubble-text remotestorage-initial remotestorage-error remotestorage-authing remotestorage-offline">     <span class="rs-status-text">{{view_connect}}</span>   </div>   <div class="rs-bubble-expandable">     <!-- error -->     <div class="remotestorage-error">       <pre class="rs-status-text rs-error-msg">{{ERROR_MSG}}</pre>       <button class="remotestorage-reset">{{view_get_me_out}}</button>       <p class="rs-centered-text rs-error-plz-report">{{view_error_plz_report}}</p>     </div>     <!-- connected -->     <div class="rs-bubble-text remotestorage-connected">       <strong class="userAddress">{{USER_ADDRESS}}</strong>       <p class="remotestorage-unauthorized">{{view_unauthorized}}</p>       <p class="remotestorage-invalid-key">{{view_invalid_key}}</p>       <form novalidate class="remotestorage-cipher-form">         <input placeholder="Secret key" name="userSecretKey" novalidate>         <button class="rs-cipher" name="rs-cipher" title="cipher" disabled="disabled">           <img>         </button>         <button class="rs-nocipher" name="rs-nocipher" title="no cipher">           <img>         </button>       </form>     </div>     <div class="rs-content remotestorage-connected">       <button class="rs-sync" title="sync"><img></button>       <button class="rs-disconnect" title="disconnect"><img></button>     </div>     <!-- initial -->     <form novalidate class="remotestorage-initial">       <input type="email" placeholder="user@provider.com" name="userAddress" novalidate>       <button class="connect" name="connect" title="connect" disabled="disabled">         <img>       </button>     </form>     <div class="rs-info-msg remotestorage-initial">{{view_info}}</div>   </div> </div> <img class="rs-dropbox rs-backends rs-action" alt="Connect to Dropbox"> <img class="rs-googledrive rs-backends rs-action" alt="Connect to Google Drive"> <img class="rs-cube rs-action"> ',
  widgetCss: '/** encoding:utf-8 **/ /* RESET */ #remotestorage-widget{text-align:left;}#remotestorage-widget input, #remotestorage-widget button{font-size:11px;}#remotestorage-widget form input[type=email]{margin-bottom:0;/* HTML5 Boilerplate */}#remotestorage-widget form input[type=submit]{margin-top:0;/* HTML5 Boilerplate */}/* /RESET */ #remotestorage-widget, #remotestorage-widget *{-moz-box-sizing:border-box;box-sizing:border-box;}#remotestorage-widget{position:absolute;right:10px;top:10px;font:normal 16px/100% sans-serif !important;user-select:none;-webkit-user-select:none;-moz-user-select:-moz-none;cursor:default;z-index:10000;}#remotestorage-widget .rs-bubble{background:rgba(80, 80, 80, .7);border-radius:5px 15px 5px 5px;color:white;font-size:0.8em;padding:5px;position:absolute;right:3px;top:9px;min-height:24px;white-space:nowrap;text-decoration:none;}.rs-bubble .rs-bubble-text{padding-right:32px;/* make sure the bubble doesn\'t "jump" when initially opening. */ min-width:182px;}#remotestorage-widget .rs-action{cursor:pointer;}/* less obtrusive cube when connected */ #remotestorage-widget.remotestorage-state-connected .rs-cube, #remotestorage-widget.remotestorage-state-busy .rs-cube{opacity:.3;-webkit-transition:opacity .3s ease;-moz-transition:opacity .3s ease;-ms-transition:opacity .3s ease;-o-transition:opacity .3s ease;transition:opacity .3s ease;}#remotestorage-widget.remotestorage-state-connected:hover .rs-cube, #remotestorage-widget.remotestorage-state-busy:hover .rs-cube, #remotestorage-widget.remotestorage-state-connected .rs-bubble:not(.rs-hidden) + .rs-cube{opacity:1 !important;}#remotestorage-widget .rs-backends{position:relative;top:5px;right:0;}#remotestorage-widget .rs-cube{position:relative;top:5px;right:0;}/* pulsing animation for cube when loading */ #remotestorage-widget .rs-cube.remotestorage-loading{-webkit-animation:remotestorage-loading .5s ease-in-out infinite alternate;-moz-animation:remotestorage-loading .5s ease-in-out infinite alternate;-o-animation:remotestorage-loading .5s ease-in-out infinite alternate;-ms-animation:remotestorage-loading .5s ease-in-out infinite alternate;animation:remotestorage-loading .5s ease-in-out infinite alternate;}@-webkit-keyframes remotestorage-loading{to{opacity:.7}}@-moz-keyframes remotestorage-loading{to{opacity:.7}}@-o-keyframes remotestorage-loading{to{opacity:.7}}@-ms-keyframes remotestorage-loading{to{opacity:.7}}@keyframes remotestorage-loading{to{opacity:.7}}#remotestorage-widget a{text-decoration:underline;color:inherit;}#remotestorage-widget form{margin-top:.7em;position:relative;}#remotestorage-widget form input{display:table-cell;vertical-align:top;border:none;border-radius:6px;font-weight:bold;color:white;outline:none;line-height:1.5em;height:2em;}#remotestorage-widget form input:disabled{color:#999;background:#444 !important;cursor:default !important;}#remotestorage-widget form input[type=email]:focus, #remotestorage-widget form input[type=password]:focus{background:#223;}#remotestorage-widget form input[type=email], #remotestorage-widget form input[type=password]{background:#000;width:100%;height:26px;padding:0 30px 0 5px;border-top:1px solid #111;border-bottom:1px solid #999;}#remotestorage-widget form input[type=email]:focus, #remotestorage-widget form input[type=password]:focus{background:#223;}#remotestorage-widget button:focus, #remotestorage-widget input:focus{box-shadow:0 0 4px #ccc;}#remotestorage-widget form input[type=email]::-webkit-input-placeholder, #remotestorage-widget form input[type=password]::-webkit-input-placeholder{color:#999;}#remotestorage-widget form input[type=email]:-moz-placeholder, #remotestorage-widget form input[type=password]:-moz-placeholder{color:#999;}#remotestorage-widget form input[type=email]::-moz-placeholder, #remotestorage-widget form input[type=password]::-moz-placeholder{color:#999;}#remotestorage-widget form input[type=email]:-ms-input-placeholder, #remotestorage-widget form input[type=password]:-ms-input-placeholder{color:#999;}#remotestorage-widget form input[type=submit]{background:#000;cursor:pointer;padding:0 5px;}#remotestorage-widget form input[type=submit]:hover{background:#333;}#remotestorage-widget .rs-info-msg{font-size:10px;color:#eee;margin-top:0.7em;white-space:normal;}#remotestorage-widget .rs-info-msg.last-synced-message{display:inline;white-space:nowrap;margin-bottom:.7em}#remotestorage-widget .rs-info-msg a:hover, #remotestorage-widget .rs-info-msg a:active{color:#fff;}#remotestorage-widget button img{vertical-align:baseline;}#remotestorage-widget button{border:none;border-radius:6px;font-weight:bold;color:white;outline:none;line-height:1.5em;height:26px;width:26px;background:#000;cursor:pointer;margin:0;padding:5px;}#remotestorage-widget button:hover{background:#333;}#remotestorage-widget .rs-bubble button.connect, #remotestorage-widget .rs-bubble button.rs-cipher, #remotestorage-widget .rs-bubble button.rs-nocipher{display:block;background:none;position:absolute;right:0;top:0;opacity:1;/* increase clickable area of connect, rs-cipher & rs-nocipher buttons */ margin:-5px;padding:10px;width:36px;height:36px;}#remotestorage-widget .rs-bubble button.rs-cipher{width:46px;}#remotestorage-widget .rs-bubble button.rs-nocipher{height:26px;margin:0;padding:4px 5px 5px;right:-32px;width:26px;}#remotestorage-widget .rs-bubble button.connect:not([disabled]):hover, #remotestorage-widget .rs-bubble button.rs-cipher:not([disabled]):hover, #remotestorage-widget .rs-bubble button.rs-nocipher:not([disabled]):hover{background:rgba(150,150,150,.5);}#remotestorage-widget .rs-bubble button.connect[disabled], #remotestorage-widget .rs-bubble button.rs-cipher[disabled]{opacity:.5;cursor:default !important;}#remotestorage-widget .rs-bubble button.rs-sync{position:relative;left:-5px;bottom:-5px;padding:4px 4px 0 4px;background:#555;}#remotestorage-widget .rs-bubble button.rs-sync:hover{background:#444;}#remotestorage-widget .rs-bubble button.rs-disconnect{background:#721;position:absolute;right:0;bottom:0;padding:4px 4px 0 4px;}#remotestorage-widget .rs-bubble button.rs-disconnect:hover{background:#921;}#remotestorage-widget .remotestorage-error-info{color:#f92;}#remotestorage-widget .remotestorage-reset{width:100%;background:#721;}#remotestorage-widget .remotestorage-reset:hover{background:#921;}#remotestorage-widget .rs-bubble .rs-content{margin-top:7px;}#remotestorage-widget pre{user-select:initial;-webkit-user-select:initial;-moz-user-select:text;max-width:27em;margin-top:1em;overflow:auto;}#remotestorage-widget .rs-centered-text{text-align:center;}#remotestorage-widget .rs-bubble.rs-hidden{padding-bottom:2px;border-radius:5px 15px 15px 5px;}#remotestorage-widget .rs-error-msg{min-height:5em;}.rs-bubble.rs-hidden .rs-bubble-expandable{display:none;}.remotestorage-state-connected .rs-bubble.rs-hidden{display:none;}.remotestorage-connected{display:none;}.remotestorage-state-connected .remotestorage-connected{display:block;}.remotestorage-cipher-form{display:none;}.remotestorage-cipher .remotestorage-cipher-form{display:block;}.remotestorage-invalid-key{display:none;}.remotestorage-invalid-key.remotestorage-cipher-error{display:block;}.remotestorage-initial{display:none;}.remotestorage-state-initial .remotestorage-initial{display:block;}.remotestorage-error{display:none;}.remotestorage-state-error .remotestorage-error{display:block;}.remotestorage-state-authing .remotestorage-authing{display:block;}.remotestorage-state-offline .remotestorage-connected, .remotestorage-state-offline .remotestorage-offline{display:block;}.remotestorage-unauthorized{display:none;}.remotestorage-state-unauthorized .rs-bubble.rs-hidden{display:none;}.remotestorage-state-unauthorized .remotestorage-connected, .remotestorage-state-unauthorized .remotestorage-unauthorized{display:block;}.remotestorage-state-unauthorized .rs-sync{display:none;}.remotestorage-state-busy .rs-bubble.rs-hidden{display:none;}.remotestorage-state-busy .rs-bubble{display:block;}.remotestorage-state-busy .remotestorage-connected{display:block;}.remotestorage-state-authing .rs-bubble-expandable{display:none;}'
};


/** FILE: src/widget.js **/
(function (window) {

  var hasLocalStorage;
  var LS_STATE_KEY = 'remotestorage:widget:state';

  // states allowed to immediately jump into after a reload.
  var VALID_ENTRY_STATES = {
    initial: true,
    connected: true,
    offline: true
  };

  /**
   * Class: RemoteStorage.Widget
   *
   * The widget controller that communicates with the view and listens to
   * its remoteStorage instance.
   *
   * While listening to the events emitted by its remoteStorage it sets
   * corresponding states of the view.
   *
   * - connected    ->  connected
   * - disconnected ->  initial
   * - connecting   ->  authing
   * - authing      ->  authing
   * - wire-busy    ->  busy
   * - wire-done    ->  connected
   * - error        ->  one of initial, offline, unauthorized, or error
   **/
  RemoteStorage.Widget = function (remoteStorage) {
    var self = this;
    var requestsToFlashFor = 0;

    // setting event listeners on rs events to put
    // the widget into corresponding states
    this.rs = remoteStorage;
    this.rs.remote.on('connected', stateSetter(this, 'connected'));
    this.rs.on('disconnected', stateSetter(this, 'initial'));
    this.rs.on('connecting', stateSetter(this, 'authing'));
    this.rs.on('authing', stateSetter(this, 'authing'));
    this.rs.on('error', errorsHandler(this));

    if (this.rs.remote) {
      this.rs.remote.on('wire-busy', function (evt) {
        if (flashFor(evt)) {
          requestsToFlashFor++;
          stateSetter(self, 'busy')();
        }
      });

      this.rs.remote.on('wire-done', function (evt) {
        if (flashFor(evt)) {
          requestsToFlashFor--;
        }
        if (requestsToFlashFor <= 0 && evt.success) {
          stateSetter(self, 'connected')();
        }
      });
    }

    if (hasLocalStorage) {
      var state = localStorage[LS_STATE_KEY];
      if (state && VALID_ENTRY_STATES[state]) {
        this._rememberedState = state;
      }
    }
  };

  RemoteStorage.Widget.prototype = {

    /**
    * Method: display
    *
    * Displays the widget via the view.display method
    *
    * Parameters:
    *
    *   options
    **/
    display: function (options) {
      if (typeof(options) === 'string') {
        options = { domID: options };
      } else if (typeof(options) === 'undefined') {
        options = {};
      }
      if (! this.view) {
        this.setView(new RemoteStorage.Widget.View(this.rs));
      }
      this.view.display(options);
      return this;
    },

    linkWidgetToSync: function () {
      if (typeof(this.rs.sync) === 'object' && typeof(this.rs.sync.sync) === 'function') {
        this.view.on('sync', this.rs.sync.sync.bind(this.rs.sync));
      } else {
        RemoteStorage.log('[Widget] typeof this.rs.sync check fail', this.rs.sync);
        setTimeout(this.linkWidgetToSync.bind(this), 1000);
      }
    },

    /**
    *  Method: setView(view)
    *
    *  Sets the view and initializes event listeners to react on
    *  widget (widget.view) events
    **/
    setView: function (view) {
      this.view = view;
      this.view.on('connect', function (options) {
        if (typeof(options) === 'string') {
          // options is simply a useraddress
          this.rs.connect(options);
        } else if (options.special) {
          this.rs[options.special].connect(options);
        }
      }.bind(this));

      this.view.on('secret-entered', function (secretKey) {
        this.view.setUserSecretKey(secretKey);
        stateSetter(this, 'ciphered')();
      }.bind(this));

      this.view.on('secret-cancelled', function () {
        stateSetter(this, 'notciphered')();
      }.bind(this));

      this.view.on('disconnect', this.rs.disconnect.bind(this.rs));

      this.linkWidgetToSync();
      try {
        this.view.on('reset', function (){
          var location = RemoteStorage.Authorize.getLocation();
          this.rs.on('disconnected', location.reload.bind(location));
          this.rs.disconnect();
        }.bind(this));
      } catch(e) {
        if (!(e.message && e.message.match(/Unknown event/))) { // ignored. (the 0.7 widget-view interface didn't have a 'reset' event)
          throw e;
        }
      }

      if (this._rememberedState) {
        setTimeout(stateSetter(this, this._rememberedState), 0);
        delete this._rememberedState;
      }
    }
  };

  /**
   * Method: displayWidget
   *
   * Same as <display>
   **/
  RemoteStorage.prototype.displayWidget = function (options) {
    return this.widget.display(options);
  };

  RemoteStorage.Widget._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    if (! remoteStorage.widget) {
      remoteStorage.widget = new RemoteStorage.Widget(remoteStorage);
    }
  };

  RemoteStorage.Widget._rs_supported = function (remoteStorage) {
    return typeof(document) !== 'undefined';
  };

  function stateSetter(widget, state) {
    RemoteStorage.log('[Widget] Producing stateSetter for', state);
    return function () {
      RemoteStorage.log('[Widget] Setting state', state, arguments);
      if (hasLocalStorage) {
        localStorage[LS_STATE_KEY] = state;
      }
      if (widget.view) {
        if (widget.rs.remote) {
          widget.view.setUserAddress(widget.rs.remote.userAddress);
        }
        widget.view.setState(state, arguments);
      } else {
        widget._rememberedState = state;
      }
    };
  }

  function errorsHandler(widget) {
    return function (error) {
      var s;
      if (error instanceof RemoteStorage.DiscoveryError) {
        console.error('Discovery failed', error, '"' + error.message + '"');
        s = stateSetter(widget, 'initial', [error.message]);
      } else if (error instanceof RemoteStorage.SyncError) {
        s = stateSetter(widget, 'offline', []);
      } else if (error instanceof RemoteStorage.Unauthorized) {
        s = stateSetter(widget, 'unauthorized');
      } else {
        RemoteStorage.log('[Widget] Unknown error');
        s = stateSetter(widget, 'error', [error]);
      }
      s.apply();
    };
  }

  function flashFor(evt) {
    if (evt.method === 'GET' && evt.isFolder) {
      return false;
    }
    return true;
  }
})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/view.js **/
(function (window){

  var t = RemoteStorage.I18n.translate;

  /**
   * Class: RemoteStorage.Widget.View
   *
   * Controls the visible widget
   *
   * States:
   *
   *   initial      - not connected
   *   authing      - in auth flow
   *   connected    - connected to remote storage, not syncing at the moment
   *   ciphered     - connected, with cipher
   *   notciphered  - connected, without cipher
   *   busy         - connected, syncing at the moment
   *   offline      - connected, but no network connectivity
   *   error        - connected, but sync error happened
   *   unauthorized - connected, but request returned 401
   **/
  RemoteStorage.Widget.View = function (remoteStorage) {
    this.rs = remoteStorage;
    if (typeof(document) === 'undefined') {
      throw "Widget not supported";
    }
    RemoteStorage.eventHandling(this,
                                'connect',
                                'secret-entered',
                                'secret-cancelled',
                                'disconnect',
                                'sync',
                                'display',
                                'reset');

    // Re-binding the event so they can be called from the window
    for (var event in this.events){
      this.events[event] = this.events[event].bind(this);
    }

    this.hideBubbleOnBodyClick = function (event) {
      for (var p = event.target; p !== document.body; p = p.parentElement) {
        if (p.id === 'remotestorage-widget') {
          return;
        }
      }
      this.hideBubble();
    }.bind(this);
  };

  RemoteStorage.Widget.View.prototype = {

    connectGdrive: function () {
      this._emit('connect', { special: 'googledrive' });
    },

    connectDropbox: function (){
      this._emit('connect', { special: 'dropbox'});
    },

    /**
     * Method: setState
     *
     * Call the function that applies the state to the widget
     *
     * Parameters:
     *
     *   state
     *   args
     **/
    setState: function (state, args) {
      RemoteStorage.log('[View] widget.view.setState(',state,',',args,');');
      var s = this.states[state];
      if (typeof(s) === 'undefined') {
        throw new Error("Bad State assigned to view: " + state);
      }
      s.apply(this, args);
    },

    /**
     * Method: setUserAddress
     *
     * Set user address of the input field
     **/
    setUserAddress: function (addr) {
      this.userAddress = addr || '';

      var el;
      if (this.div && (el = this.div.querySelector('form.remotestorage-initial').userAddress)) {
        el.value = this.userAddress;
      }
    },

    /**
     * Method: setUserSecretKey
     *
     * Set user secret key
     **/
    setUserSecretKey: function (secretKey) {
      this.userSecretKey = secretKey;
    },

    /**
    * Method: toggleBubble
    *
    * Show the bubble when hidden and the other way around
    **/
    toggleBubble: function (event) {
      if (this.bubble.className.search('rs-hidden') < 0) {
        this.hideBubble(event);
      } else {
        this.showBubble(event);
      }
    },

    /**
     * Method: hideBubble
     *
     * Hide the bubble
     **/
    hideBubble: function (){
      addClass(this.bubble, 'rs-hidden');
      document.body.removeEventListener('click', this.hideBubbleOnBodyClick);
    },

    /**
     * Method: showBubble
     *
     * Show the bubble
     **/
    showBubble: function (event){
      removeClass(this.bubble, 'rs-hidden');
      if (typeof(event) !== 'undefined') {
        stopPropagation(event);
      }
      document.body.addEventListener('click', this.hideBubbleOnBodyClick);
      if (this.div.querySelector('.remotestorage-connected').classList.contains('remotestorage-cipher') && !this.userSecretKey) {
        this.bubble.querySelector('form.remotestorage-cipher-form').userSecretKey.focus();
      } else {
        this.bubble.querySelector('form.remotestorage-initial').userAddress.focus();
      }
    },

    /**
     * Method: display
     *
     * Draw the widget inside of the dom element with the id options.domID
     *
     * Parameters:
     *
     *   options
     *
     * Returns:
     *
     *   The widget div
     **/
    display: function (options) {
      if (typeof this.div !== 'undefined') {
        return this.div;
      }

      var element = document.createElement('div');
      var style = document.createElement('style');
      style.innerHTML = RemoteStorage.Assets.widgetCss;

      element.id = "remotestorage-widget";

      element.innerHTML = RemoteStorage.Assets.widget;

      element.appendChild(style);
      if (options.domID) {
        var parent = document.getElementById(options.domID);
        if (! parent) {
          throw "Failed to find target DOM element with id=\"" + options.domID + "\"";
        }
        parent.appendChild(element);
      } else {
        document.body.appendChild(element);
      }

      // Sync button
      setupButton(element, 'rs-sync', 'syncIcon', this.events.sync);

      // Disconnect button
      setupButton(element, 'rs-disconnect', 'disconnectIcon', this.events.disconnect);

      // Get me out of here
      setupButton(element, 'remotestorage-reset', undefined, this.events.reset);

      // Connect button
      var connectButton = setupButton(element, 'connect', 'connectIcon', this.events.connect);

      // Handle connectButton state
      this.form = element.querySelector('form.remotestorage-initial');
      var el = this.form.userAddress;
      el.addEventListener('load', handleButtonState);
      el.addEventListener('keyup', handleButtonState);
      if (this.userAddress) {
        el.value = this.userAddress;
      }

      if (options.encryption) {
        this.cipher = true;

        var secretKeyInput = element.querySelector('form.remotestorage-cipher-form').userSecretKey;

        // This is to avoid the 'password field on an insecured page' warning, when not used and on http (not https)
        secretKeyInput.type = 'password';

        // Cipher button
        var cipherButton = setupButton(element, 'rs-cipher', 'cipherIcon', this.events['secret-entered']);

        // Handle cipherButton state
        secretKeyInput.addEventListener('load', handleButtonState);
        secretKeyInput.addEventListener('keyup', handleButtonState);

        // No cipher button
        setupButton(element, 'rs-nocipher', 'nocipherIcon', this.events['secret-cancelled']);
      }

      // The cube
      this.cube = setupButton(element, 'rs-cube', 'remoteStorageIcon', this.toggleBubble.bind(this));

      // Google Drive and Dropbox icons
      setupButton(element, 'rs-dropbox', 'dropbox', this.connectDropbox.bind(this));
      setupButton(element, 'rs-googledrive', 'googledrive', this.connectGdrive.bind(this));

      var bubbleDontCatch = { INPUT: true, BUTTON: true, IMG: true };
      var eventListener = function (event) {
        if (! bubbleDontCatch[event.target.tagName] && ! (this.div.classList.contains('remotestorage-state-unauthorized') )) {
          this.showBubble(event);
        }
      }.bind(this);
      this.bubble = setupButton(element, 'rs-bubble', undefined, eventListener);

      this.hideBubble();

      this.div = element;

      this.states.initial.call(this);
      this.events.display.call(this);
      return this.div;
    },

    states:  {
      initial: function (message) {
        var cube = this.cube;
        var info = message || t("view_info");

        cube.src = RemoteStorage.Assets.remoteStorageIcon;

        this._renderTranslatedInitialContent();

        if (message) {
          cube.src = RemoteStorage.Assets.remoteStorageIconError;
          removeClass(this.cube, 'remotestorage-loading');
          this.showBubble();

          // Show the red error cube for 5 seconds, then show the normal orange one again
          setTimeout(function (){
            cube.src = RemoteStorage.Assets.remoteStorageIcon;
          },2000);
        } else {
          this.hideBubble();
        }
        this.div.className = "remotestorage-state-initial";

        if (this.userSecretKey) {
          delete this.userSecretKey;
        }

        // Google Drive and Dropbox icons
        var backends = 1;
        if (this._activateBackend('dropbox')) { backends += 1; }
        if (this._activateBackend('googledrive')) { backends += 1; }
        this.div.querySelector('.rs-bubble-text').style.paddingRight = backends*32+8+'px';

        // If address not empty connect button enabled
        var cb = this.div.querySelector('.connect');
        if (this.form.userAddress.value) {
          cb.removeAttribute('disabled');
        }

        var infoEl = this.div.querySelector('.rs-info-msg');
        infoEl.innerHTML = info;

        if (message) {
          infoEl.classList.add('remotestorage-error-info');
        } else {
          infoEl.classList.remove('remotestorage-error-info');
        }
      },

      authing: function () {
        this.div.removeEventListener('click', this.events.connect);
        this.div.className = "remotestorage-state-authing";
        this.div.querySelector('.rs-status-text').innerHTML = t("view_connecting", this.userAddress);
        addClass(this.cube, 'remotestorage-loading');
      },

      connected: function () {
        var cube = this.cube;
        this.div.className = "remotestorage-state-connected";
        this.div.querySelector('.userAddress').innerHTML = this.userAddress;
        cube.src = RemoteStorage.Assets.remoteStorageIcon;
        removeClass(cube, 'remotestorage-loading');

        if (this.cipher) {
          if (this.userSecretKey) {
            if (this.userSecretKeyError) {
              cube.src = RemoteStorage.Assets.remoteStorageIconError;
              addClass(this.div.querySelector('.remotestorage-connected'), 'remotestorage-cipher');
              addClass(this.div.querySelector('.remotestorage-invalid-key'), 'remotestorage-cipher-error');
              this.showBubble();

              // Show the red error cube for 5 seconds, then show the normal orange one again
              setTimeout(function (){
                cube.src = RemoteStorage.Assets.remoteStorageIcon;
              },5000);
            } else {
              removeClass(this.div.querySelector('.remotestorage-invalid-key'), 'remotestorage-cipher-error');
              cube.src = RemoteStorage.Assets.remoteStorageIconCiphered;
            }
          } else {
            addClass(this.div.querySelector('.remotestorage-connected'), 'remotestorage-cipher');
            this.showBubble();
          }
        }

        var icons = {
          googledrive: this.div.querySelector('.rs-googledrive'),
          dropbox: this.div.querySelector('.rs-dropbox')
        };
        icons.googledrive.style.display = icons.dropbox.style.display = 'none';
        if (icons[this.rs.backend]) {
          icons[this.rs.backend].style.display = 'inline-block';
          this.div.querySelector('.rs-bubble-text').style.paddingRight = 2*32+8+'px';
        } else {
          this.div.querySelector('.rs-bubble-text').style.paddingRight = 32+8+'px';
        }
      },

      ciphered: function () {
        this.div.querySelector('form.remotestorage-cipher-form').userSecretKey.value = '';
        removeClass(this.div.querySelector('.remotestorage-invalid-key'), 'remotestorage-cipher-error');
        removeClass(this.div.querySelector('.remotestorage-connected'), 'remotestorage-cipher');
        this.cube.src = RemoteStorage.Assets.remoteStorageIconCiphered;
        this.hideBubble();
      },

      notciphered: function () {
        this.cipher = false;
        removeClass(this.div.querySelector('.remotestorage-invalid-key'), 'remotestorage-cipher-error');
        removeClass(this.div.querySelector('.remotestorage-connected'), 'remotestorage-cipher');
        this.hideBubble();
      },

      busy: function () {
        this.div.className = "remotestorage-state-busy";
        addClass(this.cube, 'remotestorage-loading'); //TODO needs to be undone when is that neccesary
      },

      offline: function () {
        this.div.className = "remotestorage-state-offline";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconOffline;
        this.div.querySelector('.rs-status-text').innerHTML = t("view_offline");
      },

      error: function (err) {
        var errorMsg = err;
        this.div.className = "remotestorage-state-error";

        this.div.querySelector('.rs-bubble-text').innerHTML = '<strong>'+t('view_error_occured')+'</strong>';
        //FIXME I don't know what an DOMError is and my browser doesn't know too(how to handle this?)
        if (err instanceof Error /*|| err instanceof DOMError*/) {
          errorMsg = err.message + '\n\n' +
            err.stack;
        }
        this.div.querySelector('.rs-error-msg').textContent = errorMsg;
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.showBubble();
      },

      unauthorized: function () {
        this.div.className = "remotestorage-state-unauthorized";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.showBubble();
        this.div.addEventListener('click', this.events.connect);
      }
    },

    events: {
    /**
     * Event: connect
     *
     * Emitted when the connect button is clicked
     **/
      connect: function (event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('connect', this.div.querySelector('form.remotestorage-initial').userAddress.value);
      },

    /**
     * Event: secret-entered
     *
     * Emitted when the cipher button is clicked
     **/
      'secret-entered': function (event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('secret-entered', this.div.querySelector('form.remotestorage-cipher-form').userSecretKey.value);
      },

    /**
     * Event: secret-cancelled
     *
     * Emitted when the nocipher button is clicked
     **/
      'secret-cancelled': function (event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('secret-cancelled');
      },

      /**
       * Event: sync
       *
       * Emitted when the sync button is clicked
       **/
      sync: function (event) {
        stopPropagation(event);
        event.preventDefault();

        this._emit('sync');
      },

      /**
       * Event: disconnect
       *
       * Emitted when the disconnect button is clicked
       **/
      disconnect: function (event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('disconnect');
      },

      /**
       * Event: reset
       *
       * Emitted after crash triggers disconnect
       **/
      reset: function (event){
        event.preventDefault();
        var result = window.confirm(t('view_confirm_reset'));
        if (result){
          this._emit('reset');
        }
      },

      /**
       * Event: display
       *
       * Emitted when finished displaying the widget
       **/
      display : function (event) {
        if (event) {
          event.preventDefault();
        }
        this._emit('display');
      }
    },

    _renderTranslatedInitialContent: function () {
      this.div.querySelector('.rs-status-text').innerHTML = t("view_connect");
      this.div.querySelector('.remotestorage-reset').innerHTML = t("view_get_me_out");
      this.div.querySelector('.rs-error-plz-report').innerHTML = t("view_error_plz_report");
      this.div.querySelector('.remotestorage-unauthorized').innerHTML = t("view_unauthorized");
      this.div.querySelector('.remotestorage-invalid-key').innerHTML = t("view_invalid_key");
    },

    _activateBackend: function activateBackend(backendName) {
      var className = 'rs-' + backendName;
      if (this.rs.apiKeys[backendName]) {
        this.div.querySelector('.' + className).style.display = 'inline-block';
        return true;
      } else {
        this.div.querySelector('.' + className).style.display = 'none';
        return false;
      }
    }
  };

  function removeClass(el, className) {
    return el.classList.remove(className);
  }

  function addClass(el, className) {
    return el.classList.add(className);
  }

  function stopPropagation(event) {
    if (typeof(event.stopPropagation) === 'function') {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
  }

  function setupButton(parent, className, iconName, eventListener) {
    var element = parent.querySelector('.' + className);
    if (typeof iconName !== 'undefined') {
      var img = element.querySelector('img');
      (img || element).src = RemoteStorage.Assets[iconName];
    }
    element.addEventListener('click', eventListener);
    return element;
  }

  function handleButtonState(event) {
    if (event.target.value) {
      event.target.nextElementSibling.removeAttribute('disabled');
    } else {
      event.target.nextElementSibling.setAttribute('disabled','disabled');
    }
  }
})(typeof(window) !== 'undefined' ? window : global);


/** FILE: node_modules/tv4/tv4.js **/
/*
Author: Geraint Luff and others
Year: 2013

This code is released into the "public domain" by its author(s).  Anybody may use, alter and distribute the code without restriction.  The author makes no guarantees, and takes no liability of any kind for use of this code.

If you find a bug or make an improvement, it would be courteous to let the author know, but it is not compulsory.
*/
(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof module !== 'undefined' && module.exports){
    // CommonJS. Define export.
    module.exports = factory();
  } else {
    // Browser globals
    global.tv4 = factory();
  }
}(this, function () {

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FObject%2Fkeys
if (!Object.keys) {
	Object.keys = (function () {
		var hasOwnProperty = Object.prototype.hasOwnProperty,
			hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
			dontEnums = [
				'toString',
				'toLocaleString',
				'valueOf',
				'hasOwnProperty',
				'isPrototypeOf',
				'propertyIsEnumerable',
				'constructor'
			],
			dontEnumsLength = dontEnums.length;

		return function (obj) {
			if (typeof obj !== 'object' && typeof obj !== 'function' || obj === null) {
				throw new TypeError('Object.keys called on non-object');
			}

			var result = [];

			for (var prop in obj) {
				if (hasOwnProperty.call(obj, prop)) {
					result.push(prop);
				}
			}

			if (hasDontEnumBug) {
				for (var i=0; i < dontEnumsLength; i++) {
					if (hasOwnProperty.call(obj, dontEnums[i])) {
						result.push(dontEnums[i]);
					}
				}
			}
			return result;
		};
	})();
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create
if (!Object.create) {
	Object.create = (function(){
		function F(){}

		return function(o){
			if (arguments.length !== 1) {
				throw new Error('Object.create implementation only accepts one parameter.');
			}
			F.prototype = o;
			return new F();
		};
	})();
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FArray%2FisArray
if(!Array.isArray) {
	Array.isArray = function (vArg) {
		return Object.prototype.toString.call(vArg) === "[object Array]";
	};
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FArray%2FindexOf
if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
		if (this === null) {
			throw new TypeError();
		}
		var t = Object(this);
		var len = t.length >>> 0;

		if (len === 0) {
			return -1;
		}
		var n = 0;
		if (arguments.length > 1) {
			n = Number(arguments[1]);
			if (n !== n) { // shortcut for verifying if it's NaN
				n = 0;
			} else if (n !== 0 && n !== Infinity && n !== -Infinity) {
				n = (n > 0 || -1) * Math.floor(Math.abs(n));
			}
		}
		if (n >= len) {
			return -1;
		}
		var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
		for (; k < len; k++) {
			if (k in t && t[k] === searchElement) {
				return k;
			}
		}
		return -1;
	};
}

// Grungey Object.isFrozen hack
if (!Object.isFrozen) {
	Object.isFrozen = function (obj) {
		var key = "tv4_test_frozen_key";
		while (obj.hasOwnProperty(key)) {
			key += Math.random();
		}
		try {
			obj[key] = true;
			delete obj[key];
			return false;
		} catch (e) {
			return true;
		}
	};
}
// Based on: https://github.com/geraintluff/uri-templates, but with all the de-substitution stuff removed

var uriTemplateGlobalModifiers = {
	"+": true,
	"#": true,
	".": true,
	"/": true,
	";": true,
	"?": true,
	"&": true
};
var uriTemplateSuffices = {
	"*": true
};

function notReallyPercentEncode(string) {
	return encodeURI(string).replace(/%25[0-9][0-9]/g, function (doubleEncoded) {
		return "%" + doubleEncoded.substring(3);
	});
}

function uriTemplateSubstitution(spec) {
	var modifier = "";
	if (uriTemplateGlobalModifiers[spec.charAt(0)]) {
		modifier = spec.charAt(0);
		spec = spec.substring(1);
	}
	var separator = "";
	var prefix = "";
	var shouldEscape = true;
	var showVariables = false;
	var trimEmptyString = false;
	if (modifier === '+') {
		shouldEscape = false;
	} else if (modifier === ".") {
		prefix = ".";
		separator = ".";
	} else if (modifier === "/") {
		prefix = "/";
		separator = "/";
	} else if (modifier === '#') {
		prefix = "#";
		shouldEscape = false;
	} else if (modifier === ';') {
		prefix = ";";
		separator = ";";
		showVariables = true;
		trimEmptyString = true;
	} else if (modifier === '?') {
		prefix = "?";
		separator = "&";
		showVariables = true;
	} else if (modifier === '&') {
		prefix = "&";
		separator = "&";
		showVariables = true;
	}

	var varNames = [];
	var varList = spec.split(",");
	var varSpecs = [];
	var varSpecMap = {};
	for (var i = 0; i < varList.length; i++) {
		var varName = varList[i];
		var truncate = null;
		if (varName.indexOf(":") !== -1) {
			var parts = varName.split(":");
			varName = parts[0];
			truncate = parseInt(parts[1], 10);
		}
		var suffices = {};
		while (uriTemplateSuffices[varName.charAt(varName.length - 1)]) {
			suffices[varName.charAt(varName.length - 1)] = true;
			varName = varName.substring(0, varName.length - 1);
		}
		var varSpec = {
			truncate: truncate,
			name: varName,
			suffices: suffices
		};
		varSpecs.push(varSpec);
		varSpecMap[varName] = varSpec;
		varNames.push(varName);
	}
	var subFunction = function (valueFunction) {
		var result = "";
		var startIndex = 0;
		for (var i = 0; i < varSpecs.length; i++) {
			var varSpec = varSpecs[i];
			var value = valueFunction(varSpec.name);
			if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) {
				startIndex++;
				continue;
			}
			if (i === startIndex) {
				result += prefix;
			} else {
				result += (separator || ",");
			}
			if (Array.isArray(value)) {
				if (showVariables) {
					result += varSpec.name + "=";
				}
				for (var j = 0; j < value.length; j++) {
					if (j > 0) {
						result += varSpec.suffices['*'] ? (separator || ",") : ",";
						if (varSpec.suffices['*'] && showVariables) {
							result += varSpec.name + "=";
						}
					}
					result += shouldEscape ? encodeURIComponent(value[j]).replace(/!/g, "%21") : notReallyPercentEncode(value[j]);
				}
			} else if (typeof value === "object") {
				if (showVariables && !varSpec.suffices['*']) {
					result += varSpec.name + "=";
				}
				var first = true;
				for (var key in value) {
					if (!first) {
						result += varSpec.suffices['*'] ? (separator || ",") : ",";
					}
					first = false;
					result += shouldEscape ? encodeURIComponent(key).replace(/!/g, "%21") : notReallyPercentEncode(key);
					result += varSpec.suffices['*'] ? '=' : ",";
					result += shouldEscape ? encodeURIComponent(value[key]).replace(/!/g, "%21") : notReallyPercentEncode(value[key]);
				}
			} else {
				if (showVariables) {
					result += varSpec.name;
					if (!trimEmptyString || value !== "") {
						result += "=";
					}
				}
				if (varSpec.truncate != null) {
					value = value.substring(0, varSpec.truncate);
				}
				result += shouldEscape ? encodeURIComponent(value).replace(/!/g, "%21"): notReallyPercentEncode(value);
			}
		}
		return result;
	};
	subFunction.varNames = varNames;
	return {
		prefix: prefix,
		substitution: subFunction
	};
}

function UriTemplate(template) {
	if (!(this instanceof UriTemplate)) {
		return new UriTemplate(template);
	}
	var parts = template.split("{");
	var textParts = [parts.shift()];
	var prefixes = [];
	var substitutions = [];
	var varNames = [];
	while (parts.length > 0) {
		var part = parts.shift();
		var spec = part.split("}")[0];
		var remainder = part.substring(spec.length + 1);
		var funcs = uriTemplateSubstitution(spec);
		substitutions.push(funcs.substitution);
		prefixes.push(funcs.prefix);
		textParts.push(remainder);
		varNames = varNames.concat(funcs.substitution.varNames);
	}
	this.fill = function (valueFunction) {
		var result = textParts[0];
		for (var i = 0; i < substitutions.length; i++) {
			var substitution = substitutions[i];
			result += substitution(valueFunction);
			result += textParts[i + 1];
		}
		return result;
	};
	this.varNames = varNames;
	this.template = template;
}
UriTemplate.prototype = {
	toString: function () {
		return this.template;
	},
	fillFromObject: function (obj) {
		return this.fill(function (varName) {
			return obj[varName];
		});
	}
};
var ValidatorContext = function ValidatorContext(parent, collectMultiple, errorReporter, checkRecursive, trackUnknownProperties) {
	this.missing = [];
	this.missingMap = {};
	this.formatValidators = parent ? Object.create(parent.formatValidators) : {};
	this.schemas = parent ? Object.create(parent.schemas) : {};
	this.collectMultiple = collectMultiple;
	this.errors = [];
	this.handleError = collectMultiple ? this.collectError : this.returnError;
	if (checkRecursive) {
		this.checkRecursive = true;
		this.scanned = [];
		this.scannedFrozen = [];
		this.scannedFrozenSchemas = [];
		this.scannedFrozenValidationErrors = [];
		this.validatedSchemasKey = 'tv4_validation_id';
		this.validationErrorsKey = 'tv4_validation_errors_id';
	}
	if (trackUnknownProperties) {
		this.trackUnknownProperties = true;
		this.knownPropertyPaths = {};
		this.unknownPropertyPaths = {};
	}
	this.errorReporter = errorReporter || defaultErrorReporter('en');
	if (typeof this.errorReporter === 'string') {
		throw new Error('debug');
	}
	this.definedKeywords = {};
	if (parent) {
		for (var key in parent.definedKeywords) {
			this.definedKeywords[key] = parent.definedKeywords[key].slice(0);
		}
	}
};
ValidatorContext.prototype.defineKeyword = function (keyword, keywordFunction) {
	this.definedKeywords[keyword] = this.definedKeywords[keyword] || [];
	this.definedKeywords[keyword].push(keywordFunction);
};
ValidatorContext.prototype.createError = function (code, messageParams, dataPath, schemaPath, subErrors, data, schema) {
	var error = new ValidationError(code, messageParams, dataPath, schemaPath, subErrors);
	error.message = this.errorReporter(error, data, schema);
	return error;
};
ValidatorContext.prototype.returnError = function (error) {
	return error;
};
ValidatorContext.prototype.collectError = function (error) {
	if (error) {
		this.errors.push(error);
	}
	return null;
};
ValidatorContext.prototype.prefixErrors = function (startIndex, dataPath, schemaPath) {
	for (var i = startIndex; i < this.errors.length; i++) {
		this.errors[i] = this.errors[i].prefixWith(dataPath, schemaPath);
	}
	return this;
};
ValidatorContext.prototype.banUnknownProperties = function (data, schema) {
	for (var unknownPath in this.unknownPropertyPaths) {
		var error = this.createError(ErrorCodes.UNKNOWN_PROPERTY, {path: unknownPath}, unknownPath, "", null, data, schema);
		var result = this.handleError(error);
		if (result) {
			return result;
		}
	}
	return null;
};

ValidatorContext.prototype.addFormat = function (format, validator) {
	if (typeof format === 'object') {
		for (var key in format) {
			this.addFormat(key, format[key]);
		}
		return this;
	}
	this.formatValidators[format] = validator;
};
ValidatorContext.prototype.resolveRefs = function (schema, urlHistory) {
	if (schema['$ref'] !== undefined) {
		urlHistory = urlHistory || {};
		if (urlHistory[schema['$ref']]) {
			return this.createError(ErrorCodes.CIRCULAR_REFERENCE, {urls: Object.keys(urlHistory).join(', ')}, '', '', null, undefined, schema);
		}
		urlHistory[schema['$ref']] = true;
		schema = this.getSchema(schema['$ref'], urlHistory);
	}
	return schema;
};
ValidatorContext.prototype.getSchema = function (url, urlHistory) {
	var schema;
	if (this.schemas[url] !== undefined) {
		schema = this.schemas[url];
		return this.resolveRefs(schema, urlHistory);
	}
	var baseUrl = url;
	var fragment = "";
	if (url.indexOf('#') !== -1) {
		fragment = url.substring(url.indexOf("#") + 1);
		baseUrl = url.substring(0, url.indexOf("#"));
	}
	if (typeof this.schemas[baseUrl] === 'object') {
		schema = this.schemas[baseUrl];
		var pointerPath = decodeURIComponent(fragment);
		if (pointerPath === "") {
			return this.resolveRefs(schema, urlHistory);
		} else if (pointerPath.charAt(0) !== "/") {
			return undefined;
		}
		var parts = pointerPath.split("/").slice(1);
		for (var i = 0; i < parts.length; i++) {
			var component = parts[i].replace(/~1/g, "/").replace(/~0/g, "~");
			if (schema[component] === undefined) {
				schema = undefined;
				break;
			}
			schema = schema[component];
		}
		if (schema !== undefined) {
			return this.resolveRefs(schema, urlHistory);
		}
	}
	if (this.missing[baseUrl] === undefined) {
		this.missing.push(baseUrl);
		this.missing[baseUrl] = baseUrl;
		this.missingMap[baseUrl] = baseUrl;
	}
};
ValidatorContext.prototype.searchSchemas = function (schema, url) {
	if (Array.isArray(schema)) {
		for (var i = 0; i < schema.length; i++) {
			this.searchSchemas(schema[i], url);
		}
	} else if (schema && typeof schema === "object") {
		if (typeof schema.id === "string") {
			if (isTrustedUrl(url, schema.id)) {
				if (this.schemas[schema.id] === undefined) {
					this.schemas[schema.id] = schema;
				}
			}
		}
		for (var key in schema) {
			if (key !== "enum") {
				if (typeof schema[key] === "object") {
					this.searchSchemas(schema[key], url);
				} else if (key === "$ref") {
					var uri = getDocumentUri(schema[key]);
					if (uri && this.schemas[uri] === undefined && this.missingMap[uri] === undefined) {
						this.missingMap[uri] = uri;
					}
				}
			}
		}
	}
};
ValidatorContext.prototype.addSchema = function (url, schema) {
	//overload
	if (typeof url !== 'string' || typeof schema === 'undefined') {
		if (typeof url === 'object' && typeof url.id === 'string') {
			schema = url;
			url = schema.id;
		}
		else {
			return;
		}
	}
	if (url === getDocumentUri(url) + "#") {
		// Remove empty fragment
		url = getDocumentUri(url);
	}
	this.schemas[url] = schema;
	delete this.missingMap[url];
	normSchema(schema, url);
	this.searchSchemas(schema, url);
};

ValidatorContext.prototype.getSchemaMap = function () {
	var map = {};
	for (var key in this.schemas) {
		map[key] = this.schemas[key];
	}
	return map;
};

ValidatorContext.prototype.getSchemaUris = function (filterRegExp) {
	var list = [];
	for (var key in this.schemas) {
		if (!filterRegExp || filterRegExp.test(key)) {
			list.push(key);
		}
	}
	return list;
};

ValidatorContext.prototype.getMissingUris = function (filterRegExp) {
	var list = [];
	for (var key in this.missingMap) {
		if (!filterRegExp || filterRegExp.test(key)) {
			list.push(key);
		}
	}
	return list;
};

ValidatorContext.prototype.dropSchemas = function () {
	this.schemas = {};
	this.reset();
};
ValidatorContext.prototype.reset = function () {
	this.missing = [];
	this.missingMap = {};
	this.errors = [];
};

ValidatorContext.prototype.validateAll = function (data, schema, dataPathParts, schemaPathParts, dataPointerPath) {
	var topLevel;
	schema = this.resolveRefs(schema);
	if (!schema) {
		return null;
	} else if (schema instanceof ValidationError) {
		this.errors.push(schema);
		return schema;
	}

	var startErrorCount = this.errors.length;
	var frozenIndex, scannedFrozenSchemaIndex = null, scannedSchemasIndex = null;
	if (this.checkRecursive && data && typeof data === 'object') {
		topLevel = !this.scanned.length;
		if (data[this.validatedSchemasKey]) {
			var schemaIndex = data[this.validatedSchemasKey].indexOf(schema);
			if (schemaIndex !== -1) {
				this.errors = this.errors.concat(data[this.validationErrorsKey][schemaIndex]);
				return null;
			}
		}
		if (Object.isFrozen(data)) {
			frozenIndex = this.scannedFrozen.indexOf(data);
			if (frozenIndex !== -1) {
				var frozenSchemaIndex = this.scannedFrozenSchemas[frozenIndex].indexOf(schema);
				if (frozenSchemaIndex !== -1) {
					this.errors = this.errors.concat(this.scannedFrozenValidationErrors[frozenIndex][frozenSchemaIndex]);
					return null;
				}
			}
		}
		this.scanned.push(data);
		if (Object.isFrozen(data)) {
			if (frozenIndex === -1) {
				frozenIndex = this.scannedFrozen.length;
				this.scannedFrozen.push(data);
				this.scannedFrozenSchemas.push([]);
			}
			scannedFrozenSchemaIndex = this.scannedFrozenSchemas[frozenIndex].length;
			this.scannedFrozenSchemas[frozenIndex][scannedFrozenSchemaIndex] = schema;
			this.scannedFrozenValidationErrors[frozenIndex][scannedFrozenSchemaIndex] = [];
		} else {
			if (!data[this.validatedSchemasKey]) {
				try {
					Object.defineProperty(data, this.validatedSchemasKey, {
						value: [],
						configurable: true
					});
					Object.defineProperty(data, this.validationErrorsKey, {
						value: [],
						configurable: true
					});
				} catch (e) {
					//IE 7/8 workaround
					data[this.validatedSchemasKey] = [];
					data[this.validationErrorsKey] = [];
				}
			}
			scannedSchemasIndex = data[this.validatedSchemasKey].length;
			data[this.validatedSchemasKey][scannedSchemasIndex] = schema;
			data[this.validationErrorsKey][scannedSchemasIndex] = [];
		}
	}

	var errorCount = this.errors.length;
	var error = this.validateBasic(data, schema, dataPointerPath)
		|| this.validateNumeric(data, schema, dataPointerPath)
		|| this.validateString(data, schema, dataPointerPath)
		|| this.validateArray(data, schema, dataPointerPath)
		|| this.validateObject(data, schema, dataPointerPath)
		|| this.validateCombinations(data, schema, dataPointerPath)
		|| this.validateHypermedia(data, schema, dataPointerPath)
		|| this.validateFormat(data, schema, dataPointerPath)
		|| this.validateDefinedKeywords(data, schema, dataPointerPath)
		|| null;

	if (topLevel) {
		while (this.scanned.length) {
			var item = this.scanned.pop();
			delete item[this.validatedSchemasKey];
		}
		this.scannedFrozen = [];
		this.scannedFrozenSchemas = [];
	}

	if (error || errorCount !== this.errors.length) {
		while ((dataPathParts && dataPathParts.length) || (schemaPathParts && schemaPathParts.length)) {
			var dataPart = (dataPathParts && dataPathParts.length) ? "" + dataPathParts.pop() : null;
			var schemaPart = (schemaPathParts && schemaPathParts.length) ? "" + schemaPathParts.pop() : null;
			if (error) {
				error = error.prefixWith(dataPart, schemaPart);
			}
			this.prefixErrors(errorCount, dataPart, schemaPart);
		}
	}

	if (scannedFrozenSchemaIndex !== null) {
		this.scannedFrozenValidationErrors[frozenIndex][scannedFrozenSchemaIndex] = this.errors.slice(startErrorCount);
	} else if (scannedSchemasIndex !== null) {
		data[this.validationErrorsKey][scannedSchemasIndex] = this.errors.slice(startErrorCount);
	}

	return this.handleError(error);
};
ValidatorContext.prototype.validateFormat = function (data, schema) {
	if (typeof schema.format !== 'string' || !this.formatValidators[schema.format]) {
		return null;
	}
	var errorMessage = this.formatValidators[schema.format].call(null, data, schema);
	if (typeof errorMessage === 'string' || typeof errorMessage === 'number') {
		return this.createError(ErrorCodes.FORMAT_CUSTOM, {message: errorMessage}, '', '/format', null, data, schema);
	} else if (errorMessage && typeof errorMessage === 'object') {
		return this.createError(ErrorCodes.FORMAT_CUSTOM, {message: errorMessage.message || "?"}, errorMessage.dataPath || '', errorMessage.schemaPath || "/format", null, data, schema);
	}
	return null;
};
ValidatorContext.prototype.validateDefinedKeywords = function (data, schema, dataPointerPath) {
	for (var key in this.definedKeywords) {
		if (typeof schema[key] === 'undefined') {
			continue;
		}
		var validationFunctions = this.definedKeywords[key];
		for (var i = 0; i < validationFunctions.length; i++) {
			var func = validationFunctions[i];
			var result = func(data, schema[key], schema, dataPointerPath);
			if (typeof result === 'string' || typeof result === 'number') {
				return this.createError(ErrorCodes.KEYWORD_CUSTOM, {key: key, message: result}, '', '', null, data, schema).prefixWith(null, key);
			} else if (result && typeof result === 'object') {
				var code = result.code;
				if (typeof code === 'string') {
					if (!ErrorCodes[code]) {
						throw new Error('Undefined error code (use defineError): ' + code);
					}
					code = ErrorCodes[code];
				} else if (typeof code !== 'number') {
					code = ErrorCodes.KEYWORD_CUSTOM;
				}
				var messageParams = (typeof result.message === 'object') ? result.message : {key: key, message: result.message || "?"};
				var schemaPath = result.schemaPath || ("/" + key.replace(/~/g, '~0').replace(/\//g, '~1'));
				return this.createError(code, messageParams, result.dataPath || null, schemaPath, null, data, schema);
			}
		}
	}
	return null;
};

function recursiveCompare(A, B) {
	if (A === B) {
		return true;
	}
	if (A && B && typeof A === "object" && typeof B === "object") {
		if (Array.isArray(A) !== Array.isArray(B)) {
			return false;
		} else if (Array.isArray(A)) {
			if (A.length !== B.length) {
				return false;
			}
			for (var i = 0; i < A.length; i++) {
				if (!recursiveCompare(A[i], B[i])) {
					return false;
				}
			}
		} else {
			var key;
			for (key in A) {
				if (B[key] === undefined && A[key] !== undefined) {
					return false;
				}
			}
			for (key in B) {
				if (A[key] === undefined && B[key] !== undefined) {
					return false;
				}
			}
			for (key in A) {
				if (!recursiveCompare(A[key], B[key])) {
					return false;
				}
			}
		}
		return true;
	}
	return false;
}

ValidatorContext.prototype.validateBasic = function validateBasic(data, schema, dataPointerPath) {
	var error;
	if (error = this.validateType(data, schema, dataPointerPath)) {
		return error.prefixWith(null, "type");
	}
	if (error = this.validateEnum(data, schema, dataPointerPath)) {
		return error.prefixWith(null, "type");
	}
	return null;
};

ValidatorContext.prototype.validateType = function validateType(data, schema) {
	if (schema.type === undefined) {
		return null;
	}
	var dataType = typeof data;
	if (data === null) {
		dataType = "null";
	} else if (Array.isArray(data)) {
		dataType = "array";
	}
	var allowedTypes = schema.type;
	if (!Array.isArray(allowedTypes)) {
		allowedTypes = [allowedTypes];
	}

	for (var i = 0; i < allowedTypes.length; i++) {
		var type = allowedTypes[i];
		if (type === dataType || (type === "integer" && dataType === "number" && (data % 1 === 0))) {
			return null;
		}
	}
	return this.createError(ErrorCodes.INVALID_TYPE, {type: dataType, expected: allowedTypes.join("/")}, '', '', null, data, schema);
};

ValidatorContext.prototype.validateEnum = function validateEnum(data, schema) {
	if (schema["enum"] === undefined) {
		return null;
	}
	for (var i = 0; i < schema["enum"].length; i++) {
		var enumVal = schema["enum"][i];
		if (recursiveCompare(data, enumVal)) {
			return null;
		}
	}
	return this.createError(ErrorCodes.ENUM_MISMATCH, {value: (typeof JSON !== 'undefined') ? JSON.stringify(data) : data}, '', '', null, data, schema);
};

ValidatorContext.prototype.validateNumeric = function validateNumeric(data, schema, dataPointerPath) {
	return this.validateMultipleOf(data, schema, dataPointerPath)
		|| this.validateMinMax(data, schema, dataPointerPath)
		|| this.validateNaN(data, schema, dataPointerPath)
		|| null;
};

var CLOSE_ENOUGH_LOW = Math.pow(2, -51);
var CLOSE_ENOUGH_HIGH = 1 - CLOSE_ENOUGH_LOW;
ValidatorContext.prototype.validateMultipleOf = function validateMultipleOf(data, schema) {
	var multipleOf = schema.multipleOf || schema.divisibleBy;
	if (multipleOf === undefined) {
		return null;
	}
	if (typeof data === "number") {
		var remainder = (data/multipleOf)%1;
		if (remainder >= CLOSE_ENOUGH_LOW && remainder < CLOSE_ENOUGH_HIGH) {
			return this.createError(ErrorCodes.NUMBER_MULTIPLE_OF, {value: data, multipleOf: multipleOf}, '', '', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateMinMax = function validateMinMax(data, schema) {
	if (typeof data !== "number") {
		return null;
	}
	if (schema.minimum !== undefined) {
		if (data < schema.minimum) {
			return this.createError(ErrorCodes.NUMBER_MINIMUM, {value: data, minimum: schema.minimum}, '', '/minimum', null, data, schema);
		}
		if (schema.exclusiveMinimum && data === schema.minimum) {
			return this.createError(ErrorCodes.NUMBER_MINIMUM_EXCLUSIVE, {value: data, minimum: schema.minimum}, '', '/exclusiveMinimum', null, data, schema);
		}
	}
	if (schema.maximum !== undefined) {
		if (data > schema.maximum) {
			return this.createError(ErrorCodes.NUMBER_MAXIMUM, {value: data, maximum: schema.maximum}, '', '/maximum', null, data, schema);
		}
		if (schema.exclusiveMaximum && data === schema.maximum) {
			return this.createError(ErrorCodes.NUMBER_MAXIMUM_EXCLUSIVE, {value: data, maximum: schema.maximum}, '', '/exclusiveMaximum', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateNaN = function validateNaN(data, schema) {
	if (typeof data !== "number") {
		return null;
	}
	if (isNaN(data) === true || data === Infinity || data === -Infinity) {
		return this.createError(ErrorCodes.NUMBER_NOT_A_NUMBER, {value: data}, '', '/type', null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateString = function validateString(data, schema, dataPointerPath) {
	return this.validateStringLength(data, schema, dataPointerPath)
		|| this.validateStringPattern(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateStringLength = function validateStringLength(data, schema) {
	if (typeof data !== "string") {
		return null;
	}
	if (schema.minLength !== undefined) {
		if (data.length < schema.minLength) {
			return this.createError(ErrorCodes.STRING_LENGTH_SHORT, {length: data.length, minimum: schema.minLength}, '', '/minLength', null, data, schema);
		}
	}
	if (schema.maxLength !== undefined) {
		if (data.length > schema.maxLength) {
			return this.createError(ErrorCodes.STRING_LENGTH_LONG, {length: data.length, maximum: schema.maxLength}, '', '/maxLength', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateStringPattern = function validateStringPattern(data, schema) {
	if (typeof data !== "string" || (typeof schema.pattern !== "string" && !(schema.pattern instanceof RegExp))) {
		return null;
	}
	var regexp;
	if (schema.pattern instanceof RegExp) {
	  regexp = schema.pattern;
	}
	else {
	  var body, flags = '';
	  // Check for regular expression literals
	  // @see http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.5
	  var literal = schema.pattern.match(/^\/(.+)\/([img]*)$/);
	  if (literal) {
	    body = literal[1];
	    flags = literal[2];
	  }
	  else {
	    body = schema.pattern;
	  }
	  regexp = new RegExp(body, flags);
	}
	if (!regexp.test(data)) {
		return this.createError(ErrorCodes.STRING_PATTERN, {pattern: schema.pattern}, '', '/pattern', null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateArray = function validateArray(data, schema, dataPointerPath) {
	if (!Array.isArray(data)) {
		return null;
	}
	return this.validateArrayLength(data, schema, dataPointerPath)
		|| this.validateArrayUniqueItems(data, schema, dataPointerPath)
		|| this.validateArrayItems(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateArrayLength = function validateArrayLength(data, schema) {
	var error;
	if (schema.minItems !== undefined) {
		if (data.length < schema.minItems) {
			error = this.createError(ErrorCodes.ARRAY_LENGTH_SHORT, {length: data.length, minimum: schema.minItems}, '', '/minItems', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxItems !== undefined) {
		if (data.length > schema.maxItems) {
			error = this.createError(ErrorCodes.ARRAY_LENGTH_LONG, {length: data.length, maximum: schema.maxItems}, '', '/maxItems', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateArrayUniqueItems = function validateArrayUniqueItems(data, schema) {
	if (schema.uniqueItems) {
		for (var i = 0; i < data.length; i++) {
			for (var j = i + 1; j < data.length; j++) {
				if (recursiveCompare(data[i], data[j])) {
					var error = this.createError(ErrorCodes.ARRAY_UNIQUE, {match1: i, match2: j}, '', '/uniqueItems', null, data, schema);
					if (this.handleError(error)) {
						return error;
					}
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateArrayItems = function validateArrayItems(data, schema, dataPointerPath) {
	if (schema.items === undefined) {
		return null;
	}
	var error, i;
	if (Array.isArray(schema.items)) {
		for (i = 0; i < data.length; i++) {
			if (i < schema.items.length) {
				if (error = this.validateAll(data[i], schema.items[i], [i], ["items", i], dataPointerPath + "/" + i)) {
					return error;
				}
			} else if (schema.additionalItems !== undefined) {
				if (typeof schema.additionalItems === "boolean") {
					if (!schema.additionalItems) {
						error = (this.createError(ErrorCodes.ARRAY_ADDITIONAL_ITEMS, {}, '/' + i, '/additionalItems', null, data, schema));
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (error = this.validateAll(data[i], schema.additionalItems, [i], ["additionalItems"], dataPointerPath + "/" + i)) {
					return error;
				}
			}
		}
	} else {
		for (i = 0; i < data.length; i++) {
			if (error = this.validateAll(data[i], schema.items, [i], ["items"], dataPointerPath + "/" + i)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObject = function validateObject(data, schema, dataPointerPath) {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return null;
	}
	return this.validateObjectMinMaxProperties(data, schema, dataPointerPath)
		|| this.validateObjectRequiredProperties(data, schema, dataPointerPath)
		|| this.validateObjectProperties(data, schema, dataPointerPath)
		|| this.validateObjectDependencies(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateObjectMinMaxProperties = function validateObjectMinMaxProperties(data, schema) {
	var keys = Object.keys(data);
	var error;
	if (schema.minProperties !== undefined) {
		if (keys.length < schema.minProperties) {
			error = this.createError(ErrorCodes.OBJECT_PROPERTIES_MINIMUM, {propertyCount: keys.length, minimum: schema.minProperties}, '', '/minProperties', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxProperties !== undefined) {
		if (keys.length > schema.maxProperties) {
			error = this.createError(ErrorCodes.OBJECT_PROPERTIES_MAXIMUM, {propertyCount: keys.length, maximum: schema.maxProperties}, '', '/maxProperties', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectRequiredProperties = function validateObjectRequiredProperties(data, schema) {
	if (schema.required !== undefined) {
		for (var i = 0; i < schema.required.length; i++) {
			var key = schema.required[i];
			if (data[key] === undefined) {
				var error = this.createError(ErrorCodes.OBJECT_REQUIRED, {key: key}, '', '/required/' + i, null, data, schema);
				if (this.handleError(error)) {
					return error;
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectProperties = function validateObjectProperties(data, schema, dataPointerPath) {
	var error;
	for (var key in data) {
		var keyPointerPath = dataPointerPath + "/" + key.replace(/~/g, '~0').replace(/\//g, '~1');
		var foundMatch = false;
		if (schema.properties !== undefined && schema.properties[key] !== undefined) {
			foundMatch = true;
			if (error = this.validateAll(data[key], schema.properties[key], [key], ["properties", key], keyPointerPath)) {
				return error;
			}
		}
		if (schema.patternProperties !== undefined) {
			for (var patternKey in schema.patternProperties) {
				var regexp = new RegExp(patternKey);
				if (regexp.test(key)) {
					foundMatch = true;
					if (error = this.validateAll(data[key], schema.patternProperties[patternKey], [key], ["patternProperties", patternKey], keyPointerPath)) {
						return error;
					}
				}
			}
		}
		if (!foundMatch) {
			if (schema.additionalProperties !== undefined) {
				if (this.trackUnknownProperties) {
					this.knownPropertyPaths[keyPointerPath] = true;
					delete this.unknownPropertyPaths[keyPointerPath];
				}
				if (typeof schema.additionalProperties === "boolean") {
					if (!schema.additionalProperties) {
						error = this.createError(ErrorCodes.OBJECT_ADDITIONAL_PROPERTIES, {key: key}, '', '/additionalProperties', null, data, schema).prefixWith(key, null);
						if (this.handleError(error)) {
							return error;
						}
					}
				} else {
					if (error = this.validateAll(data[key], schema.additionalProperties, [key], ["additionalProperties"], keyPointerPath)) {
						return error;
					}
				}
			} else if (this.trackUnknownProperties && !this.knownPropertyPaths[keyPointerPath]) {
				this.unknownPropertyPaths[keyPointerPath] = true;
			}
		} else if (this.trackUnknownProperties) {
			this.knownPropertyPaths[keyPointerPath] = true;
			delete this.unknownPropertyPaths[keyPointerPath];
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectDependencies = function validateObjectDependencies(data, schema, dataPointerPath) {
	var error;
	if (schema.dependencies !== undefined) {
		for (var depKey in schema.dependencies) {
			if (data[depKey] !== undefined) {
				var dep = schema.dependencies[depKey];
				if (typeof dep === "string") {
					if (data[dep] === undefined) {
						error = this.createError(ErrorCodes.OBJECT_DEPENDENCY_KEY, {key: depKey, missing: dep}, '', '', null, data, schema).prefixWith(null, depKey).prefixWith(null, "dependencies");
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (Array.isArray(dep)) {
					for (var i = 0; i < dep.length; i++) {
						var requiredKey = dep[i];
						if (data[requiredKey] === undefined) {
							error = this.createError(ErrorCodes.OBJECT_DEPENDENCY_KEY, {key: depKey, missing: requiredKey}, '', '/' + i, null, data, schema).prefixWith(null, depKey).prefixWith(null, "dependencies");
							if (this.handleError(error)) {
								return error;
							}
						}
					}
				} else {
					if (error = this.validateAll(data, dep, [], ["dependencies", depKey], dataPointerPath)) {
						return error;
					}
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateCombinations = function validateCombinations(data, schema, dataPointerPath) {
	return this.validateAllOf(data, schema, dataPointerPath)
		|| this.validateAnyOf(data, schema, dataPointerPath)
		|| this.validateOneOf(data, schema, dataPointerPath)
		|| this.validateNot(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateAllOf = function validateAllOf(data, schema, dataPointerPath) {
	if (schema.allOf === undefined) {
		return null;
	}
	var error;
	for (var i = 0; i < schema.allOf.length; i++) {
		var subSchema = schema.allOf[i];
		if (error = this.validateAll(data, subSchema, [], ["allOf", i], dataPointerPath)) {
			return error;
		}
	}
	return null;
};

ValidatorContext.prototype.validateAnyOf = function validateAnyOf(data, schema, dataPointerPath) {
	if (schema.anyOf === undefined) {
		return null;
	}
	var errors = [];
	var startErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
	}
	var errorAtEnd = true;
	for (var i = 0; i < schema.anyOf.length; i++) {
		if (this.trackUnknownProperties) {
			this.unknownPropertyPaths = {};
			this.knownPropertyPaths = {};
		}
		var subSchema = schema.anyOf[i];

		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["anyOf", i], dataPointerPath);

		if (error === null && errorCount === this.errors.length) {
			this.errors = this.errors.slice(0, startErrorCount);

			if (this.trackUnknownProperties) {
				for (var knownKey in this.knownPropertyPaths) {
					oldKnownPropertyPaths[knownKey] = true;
					delete oldUnknownPropertyPaths[knownKey];
				}
				for (var unknownKey in this.unknownPropertyPaths) {
					if (!oldKnownPropertyPaths[unknownKey]) {
						oldUnknownPropertyPaths[unknownKey] = true;
					}
				}
				// We need to continue looping so we catch all the property definitions, but we don't want to return an error
				errorAtEnd = false;
				continue;
			}

			return null;
		}
		if (error) {
			errors.push(error.prefixWith(null, "" + i).prefixWith(null, "anyOf"));
		}
	}
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (errorAtEnd) {
		errors = errors.concat(this.errors.slice(startErrorCount));
		this.errors = this.errors.slice(0, startErrorCount);
		return this.createError(ErrorCodes.ANY_OF_MISSING, {}, "", "/anyOf", errors, data, schema);
	}
};

ValidatorContext.prototype.validateOneOf = function validateOneOf(data, schema, dataPointerPath) {
	if (schema.oneOf === undefined) {
		return null;
	}
	var validIndex = null;
	var errors = [];
	var startErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
	}
	for (var i = 0; i < schema.oneOf.length; i++) {
		if (this.trackUnknownProperties) {
			this.unknownPropertyPaths = {};
			this.knownPropertyPaths = {};
		}
		var subSchema = schema.oneOf[i];

		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["oneOf", i], dataPointerPath);

		if (error === null && errorCount === this.errors.length) {
			if (validIndex === null) {
				validIndex = i;
			} else {
				this.errors = this.errors.slice(0, startErrorCount);
				return this.createError(ErrorCodes.ONE_OF_MULTIPLE, {index1: validIndex, index2: i}, "", "/oneOf", null, data, schema);
			}
			if (this.trackUnknownProperties) {
				for (var knownKey in this.knownPropertyPaths) {
					oldKnownPropertyPaths[knownKey] = true;
					delete oldUnknownPropertyPaths[knownKey];
				}
				for (var unknownKey in this.unknownPropertyPaths) {
					if (!oldKnownPropertyPaths[unknownKey]) {
						oldUnknownPropertyPaths[unknownKey] = true;
					}
				}
			}
		} else if (error) {
			errors.push(error);
		}
	}
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (validIndex === null) {
		errors = errors.concat(this.errors.slice(startErrorCount));
		this.errors = this.errors.slice(0, startErrorCount);
		return this.createError(ErrorCodes.ONE_OF_MISSING, {}, "", "/oneOf", errors, data, schema);
	} else {
		this.errors = this.errors.slice(0, startErrorCount);
	}
	return null;
};

ValidatorContext.prototype.validateNot = function validateNot(data, schema, dataPointerPath) {
	if (schema.not === undefined) {
		return null;
	}
	var oldErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
		this.unknownPropertyPaths = {};
		this.knownPropertyPaths = {};
	}
	var error = this.validateAll(data, schema.not, null, null, dataPointerPath);
	var notErrors = this.errors.slice(oldErrorCount);
	this.errors = this.errors.slice(0, oldErrorCount);
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (error === null && notErrors.length === 0) {
		return this.createError(ErrorCodes.NOT_PASSED, {}, "", "/not", null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateHypermedia = function validateCombinations(data, schema, dataPointerPath) {
	if (!schema.links) {
		return null;
	}
	var error;
	for (var i = 0; i < schema.links.length; i++) {
		var ldo = schema.links[i];
		if (ldo.rel === "describedby") {
			var template = new UriTemplate(ldo.href);
			var allPresent = true;
			for (var j = 0; j < template.varNames.length; j++) {
				if (!(template.varNames[j] in data)) {
					allPresent = false;
					break;
				}
			}
			if (allPresent) {
				var schemaUrl = template.fillFromObject(data);
				var subSchema = {"$ref": schemaUrl};
				if (error = this.validateAll(data, subSchema, [], ["links", i], dataPointerPath)) {
					return error;
				}
			}
		}
	}
};

// parseURI() and resolveUrl() are from https://gist.github.com/1088850
//   -  released as public domain by author ("Yaffle") - see comments on gist

function parseURI(url) {
	var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
	// authority = '//' + user + ':' + pass '@' + hostname + ':' port
	return (m ? {
		href     : m[0] || '',
		protocol : m[1] || '',
		authority: m[2] || '',
		host     : m[3] || '',
		hostname : m[4] || '',
		port     : m[5] || '',
		pathname : m[6] || '',
		search   : m[7] || '',
		hash     : m[8] || ''
	} : null);
}

function resolveUrl(base, href) {// RFC 3986

	function removeDotSegments(input) {
		var output = [];
		input.replace(/^(\.\.?(\/|$))+/, '')
			.replace(/\/(\.(\/|$))+/g, '/')
			.replace(/\/\.\.$/, '/../')
			.replace(/\/?[^\/]*/g, function (p) {
				if (p === '/..') {
					output.pop();
				} else {
					output.push(p);
				}
		});
		return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
	}

	href = parseURI(href || '');
	base = parseURI(base || '');

	return !href || !base ? null : (href.protocol || base.protocol) +
		(href.protocol || href.authority ? href.authority : base.authority) +
		removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
		(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
		href.hash;
}

function getDocumentUri(uri) {
	return uri.split('#')[0];
}
function normSchema(schema, baseUri) {
	if (schema && typeof schema === "object") {
		if (baseUri === undefined) {
			baseUri = schema.id;
		} else if (typeof schema.id === "string") {
			baseUri = resolveUrl(baseUri, schema.id);
			schema.id = baseUri;
		}
		if (Array.isArray(schema)) {
			for (var i = 0; i < schema.length; i++) {
				normSchema(schema[i], baseUri);
			}
		} else {
			if (typeof schema['$ref'] === "string") {
				schema['$ref'] = resolveUrl(baseUri, schema['$ref']);
			}
			for (var key in schema) {
				if (key !== "enum") {
					normSchema(schema[key], baseUri);
				}
			}
		}
	}
}

function defaultErrorReporter(language) {
	language = language || 'en';

	var errorMessages = languages[language];

	return function (error) {
		var messageTemplate = errorMessages[error.code] || ErrorMessagesDefault[error.code];
		if (typeof messageTemplate !== 'string') {
			return "Unknown error code " + error.code + ": " + JSON.stringify(error.messageParams);
		}
		var messageParams = error.params;
		// Adapted from Crockford's supplant()
		return messageTemplate.replace(/\{([^{}]*)\}/g, function (whole, varName) {
			var subValue = messageParams[varName];
			return typeof subValue === 'string' || typeof subValue === 'number' ? subValue : whole;
		});
	};
}

var ErrorCodes = {
	INVALID_TYPE: 0,
	ENUM_MISMATCH: 1,
	ANY_OF_MISSING: 10,
	ONE_OF_MISSING: 11,
	ONE_OF_MULTIPLE: 12,
	NOT_PASSED: 13,
	// Numeric errors
	NUMBER_MULTIPLE_OF: 100,
	NUMBER_MINIMUM: 101,
	NUMBER_MINIMUM_EXCLUSIVE: 102,
	NUMBER_MAXIMUM: 103,
	NUMBER_MAXIMUM_EXCLUSIVE: 104,
	NUMBER_NOT_A_NUMBER: 105,
	// String errors
	STRING_LENGTH_SHORT: 200,
	STRING_LENGTH_LONG: 201,
	STRING_PATTERN: 202,
	// Object errors
	OBJECT_PROPERTIES_MINIMUM: 300,
	OBJECT_PROPERTIES_MAXIMUM: 301,
	OBJECT_REQUIRED: 302,
	OBJECT_ADDITIONAL_PROPERTIES: 303,
	OBJECT_DEPENDENCY_KEY: 304,
	// Array errors
	ARRAY_LENGTH_SHORT: 400,
	ARRAY_LENGTH_LONG: 401,
	ARRAY_UNIQUE: 402,
	ARRAY_ADDITIONAL_ITEMS: 403,
	// Custom/user-defined errors
	FORMAT_CUSTOM: 500,
	KEYWORD_CUSTOM: 501,
	// Schema structure
	CIRCULAR_REFERENCE: 600,
	// Non-standard validation options
	UNKNOWN_PROPERTY: 1000
};
var ErrorCodeLookup = {};
for (var key in ErrorCodes) {
	ErrorCodeLookup[ErrorCodes[key]] = key;
}
var ErrorMessagesDefault = {
	INVALID_TYPE: "Invalid type: {type} (expected {expected})",
	ENUM_MISMATCH: "No enum match for: {value}",
	ANY_OF_MISSING: "Data does not match any schemas from \"anyOf\"",
	ONE_OF_MISSING: "Data does not match any schemas from \"oneOf\"",
	ONE_OF_MULTIPLE: "Data is valid against more than one schema from \"oneOf\": indices {index1} and {index2}",
	NOT_PASSED: "Data matches schema from \"not\"",
	// Numeric errors
	NUMBER_MULTIPLE_OF: "Value {value} is not a multiple of {multipleOf}",
	NUMBER_MINIMUM: "Value {value} is less than minimum {minimum}",
	NUMBER_MINIMUM_EXCLUSIVE: "Value {value} is equal to exclusive minimum {minimum}",
	NUMBER_MAXIMUM: "Value {value} is greater than maximum {maximum}",
	NUMBER_MAXIMUM_EXCLUSIVE: "Value {value} is equal to exclusive maximum {maximum}",
	NUMBER_NOT_A_NUMBER: "Value {value} is not a valid number",
	// String errors
	STRING_LENGTH_SHORT: "String is too short ({length} chars), minimum {minimum}",
	STRING_LENGTH_LONG: "String is too long ({length} chars), maximum {maximum}",
	STRING_PATTERN: "String does not match pattern: {pattern}",
	// Object errors
	OBJECT_PROPERTIES_MINIMUM: "Too few properties defined ({propertyCount}), minimum {minimum}",
	OBJECT_PROPERTIES_MAXIMUM: "Too many properties defined ({propertyCount}), maximum {maximum}",
	OBJECT_REQUIRED: "Missing required property: {key}",
	OBJECT_ADDITIONAL_PROPERTIES: "Additional properties not allowed",
	OBJECT_DEPENDENCY_KEY: "Dependency failed - key must exist: {missing} (due to key: {key})",
	// Array errors
	ARRAY_LENGTH_SHORT: "Array is too short ({length}), minimum {minimum}",
	ARRAY_LENGTH_LONG: "Array is too long ({length}), maximum {maximum}",
	ARRAY_UNIQUE: "Array items are not unique (indices {match1} and {match2})",
	ARRAY_ADDITIONAL_ITEMS: "Additional items not allowed",
	// Format errors
	FORMAT_CUSTOM: "Format validation failed ({message})",
	KEYWORD_CUSTOM: "Keyword failed: {key} ({message})",
	// Schema structure
	CIRCULAR_REFERENCE: "Circular $refs: {urls}",
	// Non-standard validation options
	UNKNOWN_PROPERTY: "Unknown property (not in schema)"
};

function ValidationError(code, params, dataPath, schemaPath, subErrors) {
	Error.call(this);
	if (code === undefined) {
		throw new Error ("No error code supplied: " + schemaPath);
	}
	this.message = '';
	this.params = params;
	this.code = code;
	this.dataPath = dataPath || "";
	this.schemaPath = schemaPath || "";
	this.subErrors = subErrors || null;

	var err = new Error(this.message);
	this.stack = err.stack || err.stacktrace;
	if (!this.stack) {
		try {
			throw err;
		}
		catch(err) {
			this.stack = err.stack || err.stacktrace;
		}
	}
}
ValidationError.prototype = Object.create(Error.prototype);
ValidationError.prototype.constructor = ValidationError;
ValidationError.prototype.name = 'ValidationError';

ValidationError.prototype.prefixWith = function (dataPrefix, schemaPrefix) {
	if (dataPrefix !== null) {
		dataPrefix = dataPrefix.replace(/~/g, "~0").replace(/\//g, "~1");
		this.dataPath = "/" + dataPrefix + this.dataPath;
	}
	if (schemaPrefix !== null) {
		schemaPrefix = schemaPrefix.replace(/~/g, "~0").replace(/\//g, "~1");
		this.schemaPath = "/" + schemaPrefix + this.schemaPath;
	}
	if (this.subErrors !== null) {
		for (var i = 0; i < this.subErrors.length; i++) {
			this.subErrors[i].prefixWith(dataPrefix, schemaPrefix);
		}
	}
	return this;
};

function isTrustedUrl(baseUrl, testUrl) {
	if(testUrl.substring(0, baseUrl.length) === baseUrl){
		var remainder = testUrl.substring(baseUrl.length);
		if ((testUrl.length > 0 && testUrl.charAt(baseUrl.length - 1) === "/")
			|| remainder.charAt(0) === "#"
			|| remainder.charAt(0) === "?") {
			return true;
		}
	}
	return false;
}

var languages = {};
function createApi(language) {
	var globalContext = new ValidatorContext();
	var currentLanguage;
	var customErrorReporter;
	var api = {
		setErrorReporter: function (reporter) {
			if (typeof reporter === 'string') {
				return this.language(reporter);
			}
			customErrorReporter = reporter;
			return true;
		},
		addFormat: function () {
			globalContext.addFormat.apply(globalContext, arguments);
		},
		language: function (code) {
			if (!code) {
				return currentLanguage;
			}
			if (!languages[code]) {
				code = code.split('-')[0]; // fall back to base language
			}
			if (languages[code]) {
				currentLanguage = code;
				return code; // so you can tell if fall-back has happened
			}
			return false;
		},
		addLanguage: function (code, messageMap) {
			var key;
			for (key in ErrorCodes) {
				if (messageMap[key] && !messageMap[ErrorCodes[key]]) {
					messageMap[ErrorCodes[key]] = messageMap[key];
				}
			}
			var rootCode = code.split('-')[0];
			if (!languages[rootCode]) { // use for base language if not yet defined
				languages[code] = messageMap;
				languages[rootCode] = messageMap;
			} else {
				languages[code] = Object.create(languages[rootCode]);
				for (key in messageMap) {
					if (typeof languages[rootCode][key] === 'undefined') {
						languages[rootCode][key] = messageMap[key];
					}
					languages[code][key] = messageMap[key];
				}
			}
			return this;
		},
		freshApi: function (language) {
			var result = createApi();
			if (language) {
				result.language(language);
			}
			return result;
		},
		validate: function (data, schema, checkRecursive, banUnknownProperties) {
			var def = defaultErrorReporter(currentLanguage);
			var errorReporter = customErrorReporter ? function (error, data, schema) {
				return customErrorReporter(error, data, schema) || def(error, data, schema);
			} : def;
			var context = new ValidatorContext(globalContext, false, errorReporter, checkRecursive, banUnknownProperties);
			if (typeof schema === "string") {
				schema = {"$ref": schema};
			}
			context.addSchema("", schema);
			var error = context.validateAll(data, schema, null, null, "");
			if (!error && banUnknownProperties) {
				error = context.banUnknownProperties(data, schema);
			}
			this.error = error;
			this.missing = context.missing;
			this.valid = (error === null);
			return this.valid;
		},
		validateResult: function () {
			var result = {};
			this.validate.apply(result, arguments);
			return result;
		},
		validateMultiple: function (data, schema, checkRecursive, banUnknownProperties) {
			var def = defaultErrorReporter(currentLanguage);
			var errorReporter = customErrorReporter ? function (error, data, schema) {
				return customErrorReporter(error, data, schema) || def(error, data, schema);
			} : def;
			var context = new ValidatorContext(globalContext, true, errorReporter, checkRecursive, banUnknownProperties);
			if (typeof schema === "string") {
				schema = {"$ref": schema};
			}
			context.addSchema("", schema);
			context.validateAll(data, schema, null, null, "");
			if (banUnknownProperties) {
				context.banUnknownProperties(data, schema);
			}
			var result = {};
			result.errors = context.errors;
			result.missing = context.missing;
			result.valid = (result.errors.length === 0);
			return result;
		},
		addSchema: function () {
			return globalContext.addSchema.apply(globalContext, arguments);
		},
		getSchema: function () {
			return globalContext.getSchema.apply(globalContext, arguments);
		},
		getSchemaMap: function () {
			return globalContext.getSchemaMap.apply(globalContext, arguments);
		},
		getSchemaUris: function () {
			return globalContext.getSchemaUris.apply(globalContext, arguments);
		},
		getMissingUris: function () {
			return globalContext.getMissingUris.apply(globalContext, arguments);
		},
		dropSchemas: function () {
			globalContext.dropSchemas.apply(globalContext, arguments);
		},
		defineKeyword: function () {
			globalContext.defineKeyword.apply(globalContext, arguments);
		},
		defineError: function (codeName, codeNumber, defaultMessage) {
			if (typeof codeName !== 'string' || !/^[A-Z]+(_[A-Z]+)*$/.test(codeName)) {
				throw new Error('Code name must be a string in UPPER_CASE_WITH_UNDERSCORES');
			}
			if (typeof codeNumber !== 'number' || codeNumber%1 !== 0 || codeNumber < 10000) {
				throw new Error('Code number must be an integer > 10000');
			}
			if (typeof ErrorCodes[codeName] !== 'undefined') {
				throw new Error('Error already defined: ' + codeName + ' as ' + ErrorCodes[codeName]);
			}
			if (typeof ErrorCodeLookup[codeNumber] !== 'undefined') {
				throw new Error('Error code already used: ' + ErrorCodeLookup[codeNumber] + ' as ' + codeNumber);
			}
			ErrorCodes[codeName] = codeNumber;
			ErrorCodeLookup[codeNumber] = codeName;
			ErrorMessagesDefault[codeName] = ErrorMessagesDefault[codeNumber] = defaultMessage;
			for (var langCode in languages) {
				var language = languages[langCode];
				if (language[codeName]) {
					language[codeNumber] = language[codeNumber] || language[codeName];
				}
			}
		},
		reset: function () {
			globalContext.reset();
			this.error = null;
			this.missing = [];
			this.valid = true;
		},
		missing: [],
		error: null,
		valid: true,
		normSchema: normSchema,
		resolveUrl: resolveUrl,
		getDocumentUri: getDocumentUri,
		errorCodes: ErrorCodes
	};
	api.language(language || 'en');
	return api;
}

var tv4 = createApi();
tv4.addLanguage('en-gb', ErrorMessagesDefault);

//legacy property
tv4.tv4 = tv4;

return tv4; // used by _header.js to globalise.

}));

/** FILE: lib/Math.uuid.js **/
/*!
  Math.uuid.js (v1.4)
  http://www.broofa.com
  mailto:robert@broofa.com

  Copyright (c) 2010 Robert Kieffer
  Dual licensed under the MIT and GPL licenses.

  ********

  Changes within remoteStorage.js:
  2012-10-31:
  - added AMD wrapper <niklas@unhosted.org>
  - moved extensions for Math object into exported object.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
  // Private array of chars to use
  var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

Math.uuid = function (len, radix) {
  var chars = CHARS, uuid = [], i;
  radix = radix || chars.length;

  if (len) {
    // Compact form
    for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
  } else {
    // rfc4122, version 4 form
    var r;

    // rfc4122 requires these characters
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';

    // Fill in random data.  At i==19 set the high bits of clock sequence as
    // per rfc4122, sec. 4.1.5
    for (i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = 0 | Math.random()*16;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
  }

  return uuid.join('');
};


/** FILE: src/baseclient.js **/
(function (global) {

  function deprecate(thing, replacement) {
    console.log('WARNING: ' + thing + ' is deprecated. Use ' +
                replacement + ' instead.');
  }

  var RS = RemoteStorage;

  /**
   * Class: RemoteStorage.BaseClient
   *
   * Provides a high-level interface to access data below a given root path.
   *
   * A BaseClient deals with three types of data: folders, objects and files.
   *
   * <getListing> returns a mapping of all items within a folder. Items that
   * end with a forward slash ("/") are child folders. For instance:
   * {
   *   'folder/': true,
   *   'document.txt': true
   * }
   *
   * <getObject> / <storeObject> operate on JSON objects. Each object has a type.
   *
   * <getFile> / <storeFile> operates on files. Each file has a MIME type.
   *
   * <remove> operates on either objects or files (but not folders, folders are
   * created and removed implictly).
   */
  RS.BaseClient = function (storage, base) {
    if (base[base.length - 1] !== '/') {
      throw "Not a folder: " + base;
    }

    if (base === '/') {
      // allow absolute and relative paths for the root scope.
      this.makePath = function (path) {
        return (path[0] === '/' ? '' : '/') + path;
      };
    }

    /**
     * Property: storage
     *
     * The <RemoteStorage> instance this <BaseClient> operates on.
     */
    this.storage = storage;

    /**
     * Property: base
     *
     * Base path this <BaseClient> operates on.
     *
     * For the module's privateClient this would be /<moduleName>/, for the
     * corresponding publicClient /public/<moduleName>/.
     */
    this.base = base;

    var parts = this.base.split('/');
    if (parts.length > 2) {
      this.moduleName = parts[1];
    } else {
      this.moduleName = 'root';
    }

    // Defined in baseclient/types.js
    /**
     * Property: schemas
     *
     * Contains schema objects of all types known to the BaseClient instance
     **/

    /**
     * Event: change
     *
     * Emitted when a node changes
     *
     * Arguments:
     *   event - Event object containing information about the changed node
     *
     * (start code)
     * {
     *    path: path, // Absolute path of the changed node, from the storage root
     *    relativePath: relativePath, // Path of the changed node, relative to this baseclient's scope root
     *    origin: 'window', 'local', 'remote', or 'conflict' // emitted by user action within the app, local data store, remote sync, or versioning conflicts
     *    oldValue: oldBody, // Old body of the changed node (local version in conflicts; undefined if creation)
     *    newValue: newBody, // New body of the changed node (remote version in conflicts; undefined if deletion)
     *    lastCommonValue: lastCommonValue, //most recent known common ancestor body of 'yours' and 'theirs' in case of conflict
     *    oldContentType: oldContentType, // Old contentType of the changed node ('yours' for conflicts; undefined if creation)
     *    newContentType: newContentType, // New contentType of the changed node ('theirs' for conflicts; undefined if deletion)
     *    lastCommonContentType: lastCommonContentType // Most recent known common ancestor contentType of 'yours' and 'theirs' in case of conflict
     *  }
     * (end code)
     *
     * Example of an event with origin 'local' (fired on page load):
     *
     * (start code)
     * {
     *    path: '/public/design/color.txt',
     *    relativePath: 'color.txt',
     *    origin: 'local',
     *    oldValue: undefined,
     *    newValue: 'white',
     *    oldContentType: undefined,
     *    newContentType: 'text/plain'
     *  }
     * (end code)
     *
     * Example of a conflict:
     * Say you changed 'color.txt' from 'white' to 'blue'; if you have set `RemoteStorage.config.changeEvents.window` to `true`,
     * then you will receive:
     *
     * (start code)
     * {
     *    path: '/public/design/color.txt',
     *    relativePath: 'color.txt',
     *    origin: 'window',
     *    oldValue: 'white',
     *    newValue: 'blue',
     *    oldContentType: 'text/plain',
     *    newContentType: 'text/plain'
     *  }
     * (end code)
     *
     * But when this change is pushed out by asynchronous synchronization, this change may rejected by the
     * server, if the remote version has in the meantime changed from 'white' to  for instance 'red'; this will then lead to a change
     * event with origin 'conflict' (usually a few seconds after the event with origin 'window', if you had that activated). Note
     * that since you already changed it from 'white' to 'blue' in the local version a few seconds ago, `oldValue` is now your local
     * value of 'blue':
     *
     * (start code)
     * {
     *    path: '/public/design/color.txt',
     *    relativePath: 'color.txt',
     *    origin: 'conflict',
     *    oldValue: 'blue',
     *    newValue: 'red',
     *    lastCommonValue: 'white',
     *    oldContentType: 'text/plain,
     *    newContentType: 'text/plain'
     *    lastCommonContentType: 'text/plain'
     *  }
     * (end code)
     *
     * In practice, you should always redraw your views to display the content of the `newValue` field when a change event is received,
     * regardless of its origin. Events with origin 'local' are fired conveniently during the page load, so that you can fill your views
     * when the page loads. Events with origin 'window' are fired whenever you change a value by calling a method on the baseClient;
     * these are disabled by default. Events with origin 'remote' are fired when remote changes are discovered during sync (only for caching
     * startegies 'SEEN' and 'ALL'). Events with origin 'conflict' are fired when a conflict occurs while pushing out your local changes to
     * the remote store in asynchronous synchronization (see example above).
     **/

    RS.eventHandling(this, 'change');
    this.on = this.on.bind(this);
    storage.onChange(this.base, this._fireChange.bind(this));
  };

  RS.BaseClient.prototype = {

    extend: function (object) {
      for (var key in object) {
        this[key] = object[key];
      }
      return this;
    },

    /**
     * Method: scope
     *
     * Returns a new <BaseClient> operating on a subpath of the current <base> path.
     */
    scope: function (path) {
      return new RS.BaseClient(this.storage, this.makePath(path));
    },

    // folder operations

    /**
     * Method: getListing
     *
     * Get a list of child nodes below a given path.
     *
     * The callback semantics of getListing are identical to those of getObject.
     *
     * Parameters:
     *   path   - The path to query. It MUST end with a forward slash.
     *   maxAge - Either false or the maximum age of cached listing in
     *            milliseconds. Defaults to false in anonymous mode and to
     *            2*syncInterval in connected mode.
     *
     * Returns:
     *
     *   A promise for an object, representing child nodes. If the maxAge
     *   requirement cannot be met because of network problems, this promise
     *   will be rejected. If the maxAge requirement is set to false or the
     *   library is in offline state, the promise will always be fulfilled with
     *   data from the local store.
     *
     *   Keys ending in a forward slash represent *folder nodes*, while all
     *   other keys represent *data nodes*.
     *
     *   For spec versions <= 01, the data node information will contain only
     *   the item's ETag. For later spec versions, it will also contain the
     *   content type and -length of the item.
     *
     * Example:
     *   (start code)
     *   client.getListing('', false).then(function (listing) {
     *     // listing is for instance:
     *     // {
     *     //   'folder/': true,
     *     //   'document.txt': true
     *     // }
     *   });
     *   (end code)
     */
    getListing: function (path, maxAge) {
      if (typeof(path) !== 'string') {
        path = '';
      } else if (path.length > 0 && path[path.length - 1] !== '/') {
        Promise.reject("Not a folder: " + path);
      }
      return this.storage.get(this.makePath(path), maxAge).then(
        function (r) {
          return (r.statusCode === 404) ? {} : r.body;
        }
      );
    },

    /**
     * Method: getAll
     *
     * Get all objects directly below a given path.
     *
     * Parameters:
     *   path   - Path to the folder.
     *   maxAge - Either false or the maximum age of cached objects in
     *            milliseconds. Defaults to false in anonymous mode and to
     *            2*syncInterval in connected mode.
     *
     * Returns:
     *   A promise for an object in the form { path : object, ... }. If the
     *   maxAge requirement cannot be met because of network problems, this
     *   promise will be rejected. If the maxAge requirement is set to false,
     *   the promise will always be fulfilled with data from the local store.
     *
     *   For items that are not JSON-stringified objects (e.g. stored using
     *   `storeFile` instead of `storeObject`), the object's value is filled in
     *   with `true`.
     *
     * Example:
     *   (start code)
     *   client.getAll('', false).then(function (objects) {
     *     for (var key in objects) {
     *       console.log('- ' + key + ': ', objects[key]);
     *     }
     *   });
     *   (end code)
     */
    getAll: function (path, maxAge) {
      if (typeof(path) !== 'string') {
        path = '';
      } else if (path.length > 0 && path[path.length - 1] !== '/') {
        return Promise.reject("Not a folder: " + path);
      }

      return this.storage.get(this.makePath(path), maxAge).then(function (r) {
        if (r.statusCode === 404) { return {}; }
        if (typeof(r.body) === 'object') {
          var keys = Object.keys(r.body);
          if (keys.length === 0) {
            // treat this like 404. it probably means a folder listing that
            // has changes that haven't been pushed out yet.
            return {};
          }

          var calls = keys.map(function (key) {
            return this.storage.get(this.makePath(path + key), maxAge)
              .then(function (o) {
                if (typeof(o.body) === 'string') {
                  try {
                    o.body = JSON.parse(o.body);
                  } catch (e) {
                  }
                }
                if (typeof(o.body) === 'object') {
                  r.body[key] = o.body;
                }
              });
          }.bind(this));
          return Promise.all(calls).then(function () {
            return r.body;
          });
        }
      }.bind(this));
    },

    // file operations

    /**
     * Method: getFile
     *
     * Get the file at the given path. A file is raw data, as opposed to
     * a JSON object (use <getObject> for that).
     *
     * Except for the return value structure, getFile works exactly like
     * getObject.
     *
     * Parameters:
     *   path   - See getObject.
     *   maxAge - Either false or the maximum age of cached file in
     *            milliseconds. Defaults to false in anonymous mode and to
     *            2*syncInterval in connected mode.
     *
     * Returns:
     *   A promise for an object:
     *
     *   mimeType - String representing the MIME Type of the document.
     *   data     - Raw data of the document (either a string or an ArrayBuffer)
     *
     *   If the maxAge requirement cannot be met because of network problems, this
     *   promise will be rejected. If the maxAge requirement is set to false, the
     *   promise will always be fulfilled with data from the local store.
     *
     * Example:
     *   (start code)
     *   // Display an image:
     *   client.getFile('path/to/some/image', false).then(function (file) {
     *     var blob = new Blob([file.data], { type: file.mimeType });
     *     var targetElement = document.findElementById('my-image-element');
     *     targetElement.src = window.URL.createObjectURL(blob);
     *   });
     *   (end code)
     */
    getFile: function (path, maxAge) {
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.getFile must be a string');
      }
      return this.storage.get(this.makePath(path), maxAge).then(function (r) {
        return {
          data: r.body,
          contentType: r.contentType,
          revision: r.revision // (this is new)
        };
      });
    },

    /**
     * Method: storeFile
     *
     * Store raw data at a given path.
     *
     * Parameters:
     *   mimeType - MIME media type of the data being stored
     *   path     - path relative to the module root. MAY NOT end in a forward slash.
     *   data     - string, ArrayBuffer or ArrayBufferView of raw data to store
     *
     * The given mimeType will later be returned, when retrieving the data
     * using <getFile>.
     *
     * Example (UTF-8 data):
     *   (start code)
     *   client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>');
     *   (end code)
     *
     * Example (Binary data):
     *   (start code)
     *   // MARKUP:
     *   <input type="file" id="file-input">
     *   // CODE:
     *   var input = document.getElementById('file-input');
     *   var file = input.files[0];
     *   var fileReader = new FileReader();
     *
     *   fileReader.onload = function () {
     *     client.storeFile(file.type, file.name, fileReader.result);
     *   };
     *
     *   fileReader.readAsArrayBuffer(file);
     *   (end code)
     *
     */
    storeFile: function (mimeType, path, body) {
      if (typeof(mimeType) !== 'string') {
        return Promise.reject('Argument \'mimeType\' of baseClient.storeFile must be a string');
      }
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.storeFile must be a string');
      }
      if (typeof(body) !== 'string' && typeof(body) !== 'object') {
        return Promise.reject('Argument \'body\' of baseClient.storeFile must be a string, ArrayBuffer, or ArrayBufferView');
      }
      if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
        console.warn('WARNING: Editing a document to which only read access (\'r\') was claimed');
      }

      return this.storage.put(this.makePath(path), body, mimeType).then(function (r) {
        if (r.statusCode === 200 || r.statusCode === 201) {
          return r.revision;
        } else {
          return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
        }
      }.bind(this));
    },

    // object operations

    /**
     * Method: getObject
     *
     * Get a JSON object from given path.
     *
     * Parameters:
     *   path   - Relative path from the module root (without leading slash).
     *   maxAge - Either false or the maximum age of cached object in
     *            milliseconds. Defaults to false in anonymous mode and to
     *            2*syncInterval in connected mode.
     *
     * Returns:
     *   A promise for the object. If the maxAge requirement cannot be met
     *   because of network problems, this promise will be rejected. If the
     *   maxAge requirement is set to false, the promise will always be
     *   fulfilled with data from the local store.
     *
     * Example:
     *   (start code)
     *   client.getObject('/path/to/object', false).
     *     then(function (object) {
     *       // object is either an object or null
     *     });
     *   (end code)
     */
    getObject: function (path, maxAge) {
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.getObject must be a string');
      }
      return this.storage.get(this.makePath(path), maxAge).then(function (r) {
        if (typeof(r.body) === 'object') { // will be the case for documents stored with rs.js <= 0.10.0-beta2
          return r.body;
        } else if (typeof(r.body) === 'string') {
          try {
            return JSON.parse(r.body);
          } catch (e) {
            throw "Not valid JSON: " + this.makePath(path);
          }
        } else if (typeof(r.body) !== 'undefined' && r.statusCode === 200) {
          return Promise.reject("Not an object: " + this.makePath(path));
        }
      }.bind(this));
    },

    /**
     * Method: storeObject
     *
     * Store object at given path. Triggers synchronization.
     *
     * Parameters:
     *
     *   type     - unique type of this object within this module. See description below.
     *   path     - path relative to the module root.
     *   object   - an object to be saved to the given node. It must be serializable as JSON.
     *
     * Returns:
     *   A promise to store the object. The promise fails with a ValidationError, when validations fail.
     *
     *
     * What about the type?:
     *
     *   A great thing about having data on the web, is to be able to link to
     *   it and rearrange it to fit the current circumstances. To facilitate
     *   that, eventually you need to know how the data at hand is structured.
     *   For documents on the web, this is usually done via a MIME type. The
     *   MIME type of JSON objects however, is always application/json.
     *   To add that extra layer of "knowing what this object is", remoteStorage
     *   aims to use <JSON-LD at http://json-ld.org/>.
     *   A first step in that direction, is to add a *@context attribute* to all
     *   JSON data put into remoteStorage.
     *   Now that is what the *type* is for.
     *
     *   Within remoteStorage.js, @context values are built using three components:
     *     http://remotestorage.io/spec/modules/ - A prefix to guarantee uniqueness
     *     the module name     - module names should be unique as well
     *     the type given here - naming this particular kind of object within this module
     *
     *   In retrospect that means, that whenever you introduce a new "type" in calls to
     *   storeObject, you should make sure that once your code is in the wild, future
     *   versions of the code are compatible with the same JSON structure.
     *
     * How to define types?:
     *
     *   See <declareType> for examples.
     */
    storeObject: function (typeAlias, path, object) {
      if (typeof(typeAlias) !== 'string') {
        return Promise.reject('Argument \'typeAlias\' of baseClient.storeObject must be a string');
      }
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.storeObject must be a string');
      }
      if (typeof(object) !== 'object') {
        return Promise.reject('Argument \'object\' of baseClient.storeObject must be an object');
      }

      this._attachType(object, typeAlias);

      try {
        var validationResult = this.validate(object);
        if (! validationResult.valid) {
          return Promise.reject(validationResult);
        }
      } catch(exc) {
        return Promise.reject(exc);
      }

      return this.storage.put(this.makePath(path), JSON.stringify(object), 'application/json; charset=UTF-8').then(function (r) {
        if (r.statusCode === 200 || r.statusCode === 201) {
          return r.revision;
        } else {
          return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
        }
      }.bind(this));
    },

    // generic operations

    /**
     * Method: remove
     *
     * Remove node at given path from storage. Triggers synchronization.
     *
     * Parameters:
     *   path     - Path relative to the module root.
     */
    remove: function (path) {
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.remove must be a string');
      }
      if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
        console.warn('WARNING: Removing a document to which only read access (\'r\') was claimed');
      }

      return this.storage.delete(this.makePath(path));
    },


    cache: function (path, strategy) {
      if (typeof(path) !== 'string') {
        throw 'Argument \'path\' of baseClient.cache must be a string';
      }
      if (strategy === false) {
        deprecate('caching strategy <false>', '<"FLUSH">');
        strategy = 'FLUSH';
      } else if (strategy === undefined) {
        strategy = 'ALL';
      } else if (typeof(strategy) !== 'string') {
        deprecate('that caching strategy', '<"ALL">');
        strategy = 'ALL';
      }
      if (strategy !== 'FLUSH' &&
          strategy !== 'SEEN' &&
          strategy !== 'ALL') {
        throw 'Argument \'strategy\' of baseclient.cache must be one of '
            + '["FLUSH", "SEEN", "ALL"]';
      }
      this.storage.caching.set(this.makePath(path), strategy);
      return this;
    },

    flush: function (path) {
      return this.storage.local.flush(path);
    },

    makePath: function (path) {
      return this.base + (path || '');
    },

    _fireChange: function (event) {
      if (RemoteStorage.config.changeEvents[event.origin]) {
        ['new', 'old', 'lastCommon'].forEach(function (fieldNamePrefix) {
          if ((!event[fieldNamePrefix+'ContentType'])
              || (/^application\/(.*)json(.*)/.exec(event[fieldNamePrefix+'ContentType']))) {
            if (typeof(event[fieldNamePrefix+'Value']) === 'string') {
              try {
                event[fieldNamePrefix+'Value'] = JSON.parse(event[fieldNamePrefix+'Value']);
              } catch(e) {
              }
            }
          }
        });
        this._emit('change', event);
      }
    },

    _cleanPath: RemoteStorage.util.cleanPath,

    /**
     * Method: getItemURL
     *
     * Retrieve full URL of item
     *
     * Parameters:
     *   path     - Path relative to the module root.
     */
    getItemURL: function (path) {
      if (typeof(path) !== 'string') {
        throw 'Argument \'path\' of baseClient.getItemURL must be a string';
      }
      if (this.storage.connected) {
        path = this._cleanPath( this.makePath(path) );
        return this.storage.remote.href + path;
      } else {
        return undefined;
      }
    },

    uuid: function () {
      return Math.uuid();
    }

  };

  /**
   * Method: RS#scope
   *
   * Returns a new <RS.BaseClient> scoped to the given path.
   *
   * Parameters:
   *   path - Root path of new BaseClient.
   *
   *
   * Example:
   *   (start code)
   *
   *   var foo = remoteStorage.scope('/foo/');
   *
   *   // PUTs data "baz" to path /foo/bar
   *   foo.storeFile('text/plain', 'bar', 'baz');
   *
   *   var something = foo.scope('something/');
   *
   *   // GETs listing from path /foo/something/bla/
   *   something.getListing('bla/');
   *
   *   (end code)
   *
   */
  RS.BaseClient._rs_init = function () {
    RS.prototype.scope = function (path) {
      if (typeof(path) !== 'string') {
        throw 'Argument \'path\' of baseClient.scope must be a string';
      }

      if (!this.access.checkPathPermission(path, 'r')) {
        var escapedPath = path.replace(/(['\\])/g, '\\$1');
        console.warn('WARNING: please call remoteStorage.access.claim(\'' + escapedPath + '\', \'r\') (read only) or remoteStorage.access.claim(\'' + escapedPath + '\', \'rw\') (read/write) first');
      }
      return new RS.BaseClient(this, path);
    };
  };

  /* e.g.:
  remoteStorage.defineModule('locations', function (priv, pub) {
    return {
      exports: {
        features: priv.scope('features/').defaultType('feature'),
        collections: priv.scope('collections/').defaultType('feature-collection');
      }
    };
  });
  */

  // Defined in baseclient/types.js
  /**
   * Method: declareType
   *
   * Declare a remoteStorage object type using a JSON schema. See
   * <RemoteStorage.BaseClient.Types>
   **/

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/baseclient/types.js **/
(function(global) {

  /**
   * Class: RemoteStorage.BaseClient.Types
   *
   * - Manages and validates types of remoteStorage objects, using JSON-LD and
   *   JSON Schema
   * - Adds schema declaration/validation methods to BaseClient instances.
   **/
  RemoteStorage.BaseClient.Types = {
    // <alias> -> <uri>
    uris: {},
    // <uri> -> <schema>
    schemas: {},
    // <uri> -> <alias>
    aliases: {},

    declare: function(moduleName, alias, uri, schema) {
      var fullAlias = moduleName + '/' + alias;

      if (schema.extends) {
        var extendedAlias;
        var parts = schema.extends.split('/');
        if (parts.length === 1) {
          extendedAlias = moduleName + '/' + parts.shift();
        } else {
          extendedAlias = parts.join('/');
        }
        var extendedUri = this.uris[extendedAlias];
        if (! extendedUri) {
          throw "Type '" + fullAlias + "' tries to extend unknown schema '" + extendedAlias + "'";
        }
        schema.extends = this.schemas[extendedUri];
      }

      this.uris[fullAlias] = uri;
      this.aliases[uri] = fullAlias;
      this.schemas[uri] = schema;
    },

    resolveAlias: function(alias) {
      return this.uris[alias];
    },

    getSchema: function(uri) {
      return this.schemas[uri];
    },

    inScope: function(moduleName) {
      var ml = moduleName.length;
      var schemas = {};
      for (var alias in this.uris) {
        if (alias.substr(0, ml + 1) === moduleName + '/') {
          var uri = this.uris[alias];
          schemas[uri] = this.schemas[uri];
        }
      }
      return schemas;
    }
  };

  var SchemaNotFound = function(uri) {
    var error = new Error("Schema not found: " + uri);
    error.name = "SchemaNotFound";
    return error;
  };

  SchemaNotFound.prototype = Error.prototype;

  RemoteStorage.BaseClient.Types.SchemaNotFound = SchemaNotFound;

  /**
   * Class: RemoteStorage.BaseClient
   **/
  RemoteStorage.BaseClient.prototype.extend({
    /**
     * Method: declareType
     *
     * Declare a remoteStorage object type using a JSON schema.
     *
     * Parameters:
     *   alias  - A type alias/shortname
     *   uri    - (optional) JSON-LD URI of the schema. Automatically generated if none given
     *   schema - A JSON Schema object describing the object type
     *
     * Example:
     *
     * (start code)
     * client.declareType('todo-item', {
     *   "type": "object",
     *   "properties": {
     *     "id": {
     *       "type": "string"
     *     },
     *     "title": {
     *       "type": "string"
     *     },
     *     "finished": {
     *       "type": "boolean"
     *       "default": false
     *     },
     *     "createdAt": {
     *       "type": "date"
     *     }
     *   },
     *   "required": ["id", "title"]
     * })
     * (end code)
     *
     * Visit <http://json-schema.org> for details on how to use JSON Schema.
     **/
    declareType: function(alias, uri, schema) {
      if (! schema) {
        schema = uri;
        uri = this._defaultTypeURI(alias);
      }
      RemoteStorage.BaseClient.Types.declare(this.moduleName, alias, uri, schema);
    },

    /**
     * Method: validate
     *
     * Validate an object against the associated schema.
     *
     * Parameters:
     *  object - Object to validate. Must have a @context property.
     *
     * Returns:
     *   An object containing information about validation errors
     **/
    validate: function(object) {
      var schema = RemoteStorage.BaseClient.Types.getSchema(object['@context']);
      if (schema) {
        return tv4.validateResult(object, schema);
      } else {
        throw new SchemaNotFound(object['@context']);
      }
    },

    _defaultTypeURI: function(alias) {
      return 'http://remotestorage.io/spec/modules/' + encodeURIComponent(this.moduleName) + '/' + encodeURIComponent(alias);
    },

    _attachType: function(object, alias) {
      object['@context'] = RemoteStorage.BaseClient.Types.resolveAlias(this.moduleName + '/' + alias) || this._defaultTypeURI(alias);
    }
  });

  // Documented in baseclient.js
  Object.defineProperty(RemoteStorage.BaseClient.prototype, 'schemas', {
    configurable: true,
    get: function() {
      return RemoteStorage.BaseClient.Types.inScope(this.moduleName);
    }
  });

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/caching.js **/
  /**
   * Class: RemoteStorage.Caching
   *
   * Holds/manages caching configuration.
   *
   * Caching strategies:
   *
   *   For each subtree, you can set the caching strategy to 'ALL',
   *   'SEEN' (default), and 'FLUSH'.
   *
   *   - 'ALL' means that once all outgoing changes have been pushed, sync
   *         will start retrieving nodes to cache pro-actively. If a local
   *         copy exists of everything, it will check on each sync whether
   *         the ETag of the root folder changed, and retrieve remote changes
   *         if they exist.
   *   - 'SEEN' does this only for documents and folders that have been either
   *         read from or written to at least once since connecting to the current
   *         remote backend, plus their parent/ancestor folders up to the root
   *         (to make tree-based sync possible).
   *   - 'FLUSH' will only cache outgoing changes, and forget them as soon as
   *         they have been saved to remote successfully.
   *
   **/

(function (global) {
  var SETTINGS_KEY = "remotestorage:caching";

  var containingFolder = RemoteStorage.util.containingFolder;

  RemoteStorage.Caching = function () {
    this.reset();
  };

  RemoteStorage.Caching.prototype = {
    pendingActivations: [],

    /**
     * Method: set
     *
     * Configure caching for a given path explicitly.
     *
     * Not needed when using <enable>/<disable>.
     *
     * Parameters:
     *   path     - Path to cache
     *   strategy - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
     *
     * Example:
     *   (start code)
     *   remoteStorage.caching.set('/bookmarks/archive')
     */
    set: function (path, strategy) {
      if (typeof path !== 'string') {
        throw new Error('path should be a string');
      }
      if (!RemoteStorage.util.isFolder(path)) {
        throw new Error('path should be a folder');
      }
      if (this._remoteStorage && this._remoteStorage.access &&
          !this._remoteStorage.access.checkPathPermission(path, 'r')) {
        throw new Error('No access to path "'+path+'". You have to claim access to it first.');
      }
      if (!strategy.match(/^(FLUSH|SEEN|ALL)$/)) {
        throw new Error("strategy should be 'FLUSH', 'SEEN', or 'ALL'");
      }

      this._rootPaths[path] = strategy;

      if (strategy === 'ALL') {
        if (this.activateHandler) {
          this.activateHandler(path);
        } else {
          this.pendingActivations.push(path);
        }
      }
    },

    /**
     * Method: enable
     *
     * Enable caching for a given path.
     *
     * Uses caching strategy 'ALL'.
     *
     * Parameters:
     *   path - Path to enable caching for
     */
    enable: function (path) {
      this.set(path, 'ALL');
    },

    /**
     * Method: disable
     *
     * Disable caching for a given path.
     *
     * Uses caching strategy 'FLUSH' (meaning items are only cached until
     * successfully pushed to the remote).
     *
     * Parameters:
     *   path - Path to disable caching for
     */
    disable: function (path) {
      this.set(path, 'FLUSH');
    },

    /**
     * Method: onActivate
     *
     * Set a callback for when caching is activated for a path.
     *
     * Parameters:
     *   callback - Callback function
     */
    onActivate: function (cb) {
      var i;
      RemoteStorage.log('[Caching] Setting activate handler', cb, this.pendingActivations);
      this.activateHandler = cb;
      for (i=0; i<this.pendingActivations.length; i++) {
        cb(this.pendingActivations[i]);
      }
      delete this.pendingActivations;
    },

    /**
     * Method: checkPath
     *
     * Retrieve caching setting for a given path, or its next parent
     * with a caching strategy set.
     *
     * Parameters:
     *   path - Path to retrieve setting for
     **/
    checkPath: function (path) {
      if (this._rootPaths[path] !== undefined) {
        return this._rootPaths[path];
      } else if (path === '/') {
        return 'SEEN';
      } else {
        return this.checkPath(containingFolder(path));
      }
    },

    /**
     * Method: reset
     *
     * Reset the state of caching by deleting all caching information.
     **/
    reset: function () {
      this._rootPaths = {};
      this._remoteStorage = null;
    }
  };

  // TODO clean up/harmonize how modules are loaded and/or document this architecture properly
  //
  // At this point the global remoteStorage object has not been created yet.
  // Only its prototype exists so far, so we define a self-constructing
  // property on there:
  Object.defineProperty(RemoteStorage.prototype, 'caching', {
    configurable: true,
    get: function () {
      var caching = new RemoteStorage.Caching();
      Object.defineProperty(this, 'caching', {
        value: caching
      });
      return caching;
    }
  });

  RemoteStorage.Caching._rs_init = function (remoteStorage) {
    this._remoteStorage = remoteStorage;
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/sync.js **/
(function (global) {

  var syncInterval = 10000,
      backgroundSyncInterval = 60000,
      isBackground = false;

  var isFolder = RemoteStorage.util.isFolder;
  var isDocument = RemoteStorage.util.isDocument;
  var equal = RemoteStorage.util.equal;
  var deepClone = RemoteStorage.util.deepClone;
  var pathsFromRoot = RemoteStorage.util.pathsFromRoot;

  function taskFor(action, path, promise) {
    return {
      action:  action,
      path:    path,
      promise: promise
    };
  }

  function isStaleChild(node) {
    return node.remote && node.remote.revision && !node.remote.itemsMap && !node.remote.body;
  }

  function hasCommonRevision(node) {
    return node.common && node.common.revision;
  }

  function handleVisibility() {
    var hidden,
        visibilityChange,
        rs = this;

    function handleVisibilityChange(fg) {
      var oldValue, newValue;
      oldValue = rs.getCurrentSyncInterval();
      isBackground = !fg;
      newValue = rs.getCurrentSyncInterval();
      rs._emit('sync-interval-change', {oldValue: oldValue, newValue: newValue});
    }

    RemoteStorage.Env.on("background", function () {
      handleVisibilityChange(false);
    });

    RemoteStorage.Env.on("foreground", function () {
      handleVisibilityChange(true);
    });
  }

  /**
   * Check if interval is valid: numeric and between 1000ms and 3600000ms
   *
   */
  function isValidInterval(interval) {
    return (typeof interval === 'number' && interval > 1000 && interval < 3600000);
  }

  /**
   * Class: RemoteStorage.Sync
   *
   * What this class does is basically six things:
   * - retrieving the remote version of relevant documents and folders
   * - add all local and remote documents together into one tree
   * - push local documents out if they don't exist remotely
   * - push local changes out to remote documents (conditionally, to
   *      avoid race conditions where both have changed)
   * - adopt the local version of a document to its remote version if
   *      both exist and they differ
   * - delete the local version of a document if it was deleted remotely
   * - if any get requests were waiting for remote data, resolve them once
   *      this data comes in.
   *
   * It does this using requests to documents, and to folders. Whenever a
   * folder GET comes in, it gives information about all the documents it
   * contains (this is the `markChildren` function).
   **/
  RemoteStorage.Sync = function (setLocal, setRemote, setAccess, setCaching) {
    this.local = setLocal;
    this.local.onDiff(function (path) {
      this.addTask(path);
      this.doTasks();
    }.bind(this));
    this.remote = setRemote;
    this.access = setAccess;
    this.caching = setCaching;
    this._tasks = {};
    this._running = {};
    this._timeStarted = {};
    RemoteStorage.eventHandling(this, 'done', 'req-done');
    this.caching.onActivate(function (path) {
      this.addTask(path);
      this.doTasks();
    }.bind(this));
  };

  RemoteStorage.Sync.prototype = {

    now: function () {
      return new Date().getTime();
    },

    queueGetRequest: function (path) {
      var pending = Promise.defer();

      if (!this.remote.connected) {
        pending.reject('cannot fulfill maxAge requirement - remote is not connected');
      } else if (!this.remote.online) {
        pending.reject('cannot fulfill maxAge requirement - remote is not online');
      } else {
        this.addTask(path, function () {
          this.local.get(path).then(function (r) {
            return pending.resolve(r);
          });
        }.bind(this));

        this.doTasks();
      }

      return pending.promise;
    },

    corruptServerItemsMap: function (itemsMap, force02) {
      if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
        return true;
      }

      for (var itemName in itemsMap) {
        var item = itemsMap[itemName];

        if (typeof(item) !== 'object') {
          return true;
        }
        if (typeof(item.ETag) !== 'string') {
          return true;
        }
        if (isFolder(itemName)) {
          if (itemName.substring(0, itemName.length-1).indexOf('/') !== -1) {
            return true;
          }
        } else {
          if (itemName.indexOf('/') !== -1) {
            return true;
          }
          if (force02) {
            if (typeof(item['Content-Type']) !== 'string') {
              return true;
            }
            if (typeof(item['Content-Length']) !== 'number') {
              return true;
            }
          }
        }
      }

      return false;
    },

    corruptItemsMap: function (itemsMap) {
      if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
        return true;
      }

      for (var itemName in itemsMap) {
        if (typeof(itemsMap[itemName]) !== 'boolean') {
          return true;
        }
      }

      return false;
    },

    corruptRevision: function (rev) {
      return ((typeof(rev) !== 'object') ||
              (Array.isArray(rev)) ||
              (rev.revision && typeof(rev.revision) !== 'string') ||
              (rev.body && typeof(rev.body) !== 'string' && typeof(rev.body) !== 'object') ||
              (rev.contentType && typeof(rev.contentType) !== 'string') ||
              (rev.contentLength && typeof(rev.contentLength) !== 'number') ||
              (rev.timestamp && typeof(rev.timestamp) !== 'number') ||
              (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
    },

    isCorrupt: function (node) {
      return ((typeof(node) !== 'object') ||
              (Array.isArray(node)) ||
              (typeof(node.path) !== 'string') ||
              (this.corruptRevision(node.common)) ||
              (node.local && this.corruptRevision(node.local)) ||
              (node.remote && this.corruptRevision(node.remote)) ||
              (node.push && this.corruptRevision(node.push)));
    },

    hasTasks: function () {
      return Object.getOwnPropertyNames(this._tasks).length > 0;
    },

    collectDiffTasks: function () {
      var num = 0;

      return this.local.forAllNodes(function (node) {

        if (num > 100) {
          return;
        }

        if (this.isCorrupt(node)) {
          RemoteStorage.log('[Sync] WARNING: corrupt node in local cache', node);
          if (typeof(node) === 'object' && node.path) {
            this.addTask(node.path);
            num++;
          }
        } else if (this.needsFetch(node) && this.access.checkPathPermission(node.path, 'r')) {
          this.addTask(node.path);
          num++;
        } else if (isDocument(node.path) && this.needsPush(node) &&
                   this.access.checkPathPermission(node.path, 'rw')) {
          this.addTask(node.path);
          num++;
        }
      }.bind(this)).then(function () {
        return num;
      }, function (err) {
        throw err;
      });
    },

    inConflict: function (node) {
      return (node.local && node.remote &&
              (node.remote.body !== undefined || node.remote.itemsMap));
    },

    needsRefresh: function (node) {
      if (node.common) {
        if (!node.common.timestamp) {
          return true;
        }
        return (this.now() - node.common.timestamp > syncInterval);
      }
      return false;
    },

    needsFetch: function (node) {
      if (this.inConflict(node)) {
        return true;
      }
      if (node.common && node.common.itemsMap === undefined && node.common.body === undefined) {
        return true;
      }
      if (node.remote && node.remote.itemsMap === undefined && node.remote.body === undefined) {
        return true;
      }
      return false;
    },

    needsPush: function (node) {
      if (this.inConflict(node)) {
        return false;
      }
      if (node.local && !node.push) {
        return true;
      }
    },

    needsRemotePut: function (node) {
      return node.local && node.local.body;
    },

    needsRemoteDelete: function (node) {
      return node.local && node.local.body === false;
    },

    getParentPath: function (path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);

      if (parts) {
        return parts[1];
      } else {
        throw new Error('Not a valid path: "'+path+'"');
      }
    },

    deleteChildPathsFromTasks: function () {
      for (var path in this._tasks) {
        var paths = pathsFromRoot(path);

        for (var i=1; i<paths.length; i++) {
          if (this._tasks[paths[i]]) {
            delete this._tasks[path];
          }
        }
      }
    },

    collectRefreshTasks: function () {
      return this.local.forAllNodes(function (node) {
        var parentPath;
        if (this.needsRefresh(node)) {
          try {
            parentPath = this.getParentPath(node.path);
          } catch(e) {
            // node.path is already '/', can't take parentPath
          }
          if (parentPath && this.access.checkPathPermission(parentPath, 'r')) {
            this.addTask(parentPath);
          } else if (this.access.checkPathPermission(node.path, 'r')) {
            this.addTask(node.path);
          }
        }
      }.bind(this)).then(function () {
        this.deleteChildPathsFromTasks();
      }.bind(this), function (err) {
        throw err;
      });
    },

    flush: function (nodes) {
      for (var path in nodes) {
        // Strategy is 'FLUSH' and no local changes exist
        if (this.caching.checkPath(path) === 'FLUSH' && nodes[path] && !nodes[path].local) {
          RemoteStorage.log('[Sync] Flushing', path);
          nodes[path] = undefined; // Cause node to be flushed from cache
        }
      }
      return nodes;
    },

    doTask: function (path) {
      return this.local.getNodes([path]).then(function (nodes) {
        var node = nodes[path];
        // First fetch:
        if (typeof(node) === 'undefined') {
          return taskFor('get', path, this.remote.get(path));
        }
        // Fetch known-stale child:
        else if (isStaleChild(node)) {
          return taskFor('get', path, this.remote.get(path));
        }
        // Push PUT:
        else if (this.needsRemotePut(node)) {
          node.push = deepClone(node.local);
          node.push.timestamp = this.now();

          return this.local.setNodes(this.flush(nodes)).then(function () {
            var options;
            if (hasCommonRevision(node)) {
              options = { ifMatch: node.common.revision };
            } else {
              // Initial PUT (fail if something is already there)
              options = { ifNoneMatch: '*' };
            }

            return taskFor('put', path,
              this.remote.put(path, node.push.body, node.push.contentType, options)
            );
          }.bind(this));
        }
        // Push DELETE:
        else if (this.needsRemoteDelete(node)) {
          node.push = { body: false, timestamp: this.now() };

          return this.local.setNodes(this.flush(nodes)).then(function () {
            if (hasCommonRevision(node)) {
              return taskFor('delete', path,
                this.remote.delete(path, { ifMatch: node.common.revision })
              );
            } else { // Ascertain current common or remote revision first
              return taskFor('get', path, this.remote.get(path));
            }
          }.bind(this));
        }
        // Conditional refresh:
        else if (hasCommonRevision(node)) {
          return taskFor('get', path,
            this.remote.get(path, { ifNoneMatch: node.common.revision })
          );
        }
        else {
          return taskFor('get', path, this.remote.get(path));
        }
      }.bind(this));
    },

    autoMergeFolder: function (node) {
      if (node.remote.itemsMap) {
        node.common = node.remote;
        delete node.remote;

        if (node.common.itemsMap) {
          for (var itemName in node.common.itemsMap) {
            if (!node.local.itemsMap[itemName]) {
              // Indicates the node is either newly being fetched
              // has been deleted locally (whether or not leading to conflict);
              // before listing it in local listings, check if a local deletion
              // exists.
              node.local.itemsMap[itemName] = false;
            }
          }

          if (equal(node.local.itemsMap, node.common.itemsMap)) {
            delete node.local;
          }
        }
      }
      return node;
    },

    autoMergeDocument: function (node) {
      hasNoRemoteChanges = function (node) {
        if (node.remote && node.remote.revision && node.remote.revision !== node.common.revision) {
          return false;
        }
        return (node.common.body === undefined && node.remote.body === false) ||
               (node.remote.body === node.common.body &&
                node.remote.contentType === node.common.contentType);
      };
      mergeMutualDeletion = function (node) {
        if (node.remote && node.remote.body === false
            && node.local && node.local.body === false) {
           delete node.local;
        }
        return node;
      };

      if (hasNoRemoteChanges(node)) {
        node = mergeMutualDeletion(node);
        delete node.remote;
      } else if (node.remote.body !== undefined) {
        // keep/revert:
        RemoteStorage.log('[Sync] Emitting keep/revert');

        this.local._emitChange({
          origin:         'conflict',
          path:           node.path,
          oldValue:       node.local.body,
          newValue:       node.remote.body,
          lastCommonValue: node.common.body,
          oldContentType: node.local.contentType,
          newContentType: node.remote.contentType,
          lastCommonContentType: node.common.contentType
        });

        if (node.remote.body) {
          node.common = node.remote;
        } else {
          node.common = {};
        }
        delete node.remote;
        delete node.local;
      }
      return node;
    },

    autoMerge: function (node) {
      if (node.remote) {
        if (node.local) {
          if (isFolder(node.path)) {
            return this.autoMergeFolder(node);
          } else {
            return this.autoMergeDocument(node);
          }
        } else { // no local changes
          if (isFolder(node.path)) {
            if (node.remote.itemsMap !== undefined) {
              node.common = node.remote;
              delete node.remote;
            }
          } else {
            if (node.remote.body !== undefined) {
              var change = {
                origin:   'remote',
                path:     node.path,
                oldValue: (node.common.body === false ? undefined : node.common.body),
                newValue: (node.remote.body === false ? undefined : node.remote.body),
                oldContentType: node.common.contentType,
                newContentType: node.remote.contentType
              };
              if (change.oldValue || change.newValue) {
                this.local._emitChange(change);
              }

              if (!node.remote.body) { // no remote, so delete/don't create
                return;
              }

              node.common = node.remote;
              delete node.remote;
            }
          }
        }
      } else {
        if (node.common.body) {
          this.local._emitChange({
            origin:   'remote',
            path:     node.path,
            oldValue: node.common.body,
            newValue: undefined,
            oldContentType: node.common.contentType,
            newContentType: undefined
          });
        }

        return undefined;
      }
      return node;
    },

    updateCommonTimestamp: function (path, revision) {
      return this.local.getNodes([path]).then(function (nodes) {
        if (nodes[path] && nodes[path].common && nodes[path].common.revision === revision) {
          nodes[path].common.timestamp = this.now();
        }
        return this.local.setNodes(this.flush(nodes));
      }.bind(this));
    },

    markChildren: function (path, itemsMap, changedNodes, missingChildren) {
      var paths = [];
      var meta = {};
      var recurse = {};

      for (var item in itemsMap) {
        paths.push(path+item);
        meta[path+item] = itemsMap[item];
      }
      for (var childName in missingChildren) {
        paths.push(path+childName);
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var cachingStrategy;
        var node;

        var nodeChanged = function (node, etag) {
          return node.common.revision !== etag && (!node.remote || node.remote.revision !== etag);
        };

        for (var nodePath in nodes) {
          node = nodes[nodePath];

          if (meta[nodePath]) {
            if (node && node.common) {
              if (nodeChanged(node, meta[nodePath].ETag)) {
                changedNodes[nodePath] = deepClone(node);
                changedNodes[nodePath].remote = {
                  revision:  meta[nodePath].ETag,
                  timestamp: this.now()
                };
                changedNodes[nodePath] = this.autoMerge(changedNodes[nodePath]);
              }
            } else {
              cachingStrategy = this.caching.checkPath(nodePath);
              if (cachingStrategy === 'ALL') {
                changedNodes[nodePath] = {
                  path: nodePath,
                  common: {
                    timestamp: this.now()
                  },
                  remote: {
                    revision: meta[nodePath].ETag,
                    timestamp: this.now()
                  }
                };
              }
            }

            if (changedNodes[nodePath] && meta[nodePath]['Content-Type']) {
              changedNodes[nodePath].remote.contentType = meta[nodePath]['Content-Type'];
            }

            if (changedNodes[nodePath] && meta[nodePath]['Content-Length']) {
              changedNodes[nodePath].remote.contentLength = meta[nodePath]['Content-Length'];
            }
          } else if (missingChildren[nodePath.substring(path.length)] && node && node.common) {
            if (node.common.itemsMap) {
              for (var commonItem in node.common.itemsMap) {
                recurse[nodePath+commonItem] = true;
              }
            }

            if (node.local && node.local.itemsMap) {
              for (var localItem in node.local.itemsMap) {
                recurse[nodePath+localItem] = true;
              }
            }

            if (node.remote || isFolder(nodePath)) {
              changedNodes[nodePath] = undefined;
            } else {
              changedNodes[nodePath] = this.autoMerge(node);

              if (typeof changedNodes[nodePath] === 'undefined') {
                var parentPath = this.getParentPath(nodePath);
                var parentNode = changedNodes[parentPath];
                var itemName = nodePath.substring(path.length);
                if (parentNode && parentNode.local) {
                  delete parentNode.local.itemsMap[itemName];

                  if (equal(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
                    delete parentNode.local;
                  }
                }
              }
            }
          }
        }

        return this.deleteRemoteTrees(Object.keys(recurse), changedNodes).then(function (changedObjs2) {
          return this.local.setNodes(this.flush(changedObjs2));
        }.bind(this));
      }.bind(this));
    },

    deleteRemoteTrees: function (paths, changedNodes) {
      if (paths.length === 0) {
        return Promise.resolve(changedNodes);
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var subPaths = {};

        collectSubPaths = function (folder, path) {
          if (folder && folder.itemsMap) {
            for (var itemName in folder.itemsMap) {
              subPaths[path+itemName] = true;
            }
          }
        };

        for (var path in nodes) {
          var node = nodes[path];

          // TODO Why check for the node here? I don't think this check ever applies
          if (!node) {
            continue;
          }

          if (isFolder(path)) {
            collectSubPaths(node.common, path);
            collectSubPaths(node.local, path);
          } else {
            if (node.common && typeof(node.common.body) !== undefined) {
              changedNodes[path] = deepClone(node);
              changedNodes[path].remote = {
                body:      false,
                timestamp: this.now()
              };
              changedNodes[path] = this.autoMerge(changedNodes[path]);
            }
          }
        }

        // Recurse whole tree depth levels at once:
        return this.deleteRemoteTrees(Object.keys(subPaths), changedNodes).then(function (changedNodes2) {
          return this.local.setNodes(this.flush(changedNodes2));
        }.bind(this));
      }.bind(this));
    },

    completeFetch: function (path, bodyOrItemsMap, contentType, revision) {
      var paths;
      var parentPath;
      var pathsFromRootArr = pathsFromRoot(path);

      if (isFolder(path)) {
        paths = [path];
      } else {
        parentPath = pathsFromRootArr[1];
        paths = [path, parentPath];
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var itemName;
        var missingChildren = {};
        var node = nodes[path];
        var parentNode;

        var collectMissingChildren = function (folder) {
          if (folder && folder.itemsMap) {
            for (var itemName in folder.itemsMap) {
              if (!bodyOrItemsMap[itemName]) {
                missingChildren[itemName] = true;
              }
            }
          }
        };

        if (typeof(node) !== 'object'  || node.path !== path ||
            typeof(node.common) !== 'object') {
          node = {
            path: path,
            common: {}
          };
          nodes[path] = node;
        }

        node.remote = {
          revision: revision,
          timestamp: this.now()
        };

        if (isFolder(path)) {
          collectMissingChildren(node.common);
          collectMissingChildren(node.remote);

          node.remote.itemsMap = {};
          for (itemName in bodyOrItemsMap) {
            node.remote.itemsMap[itemName] = true;
          }
        } else {
          node.remote.body = bodyOrItemsMap;
          node.remote.contentType = contentType;

          parentNode = nodes[parentPath];
          if (parentNode && parentNode.local && parentNode.local.itemsMap) {
            itemName = path.substring(parentPath.length);
            parentNode.local.itemsMap[itemName] = true;
            if (equal(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
              delete parentNode.local;
            }
          }
        }

        nodes[path] = this.autoMerge(node);
        return {
          toBeSaved:       nodes,
          missingChildren: missingChildren
        };
      }.bind(this));
    },

    completePush: function (path, action, conflict, revision) {
      return this.local.getNodes([path]).then(function (nodes) {
        var node = nodes[path];

        if (!node.push) {
          this.stopped = true;
          throw new Error('completePush called but no push version!');
        }

        if (conflict) {
          RemoteStorage.log('[Sync] We have a conflict');

          if (!node.remote || node.remote.revision !== revision) {
            node.remote = {
              revision:  revision || 'conflict',
              timestamp: this.now()
            };
            delete node.push;
          }

          nodes[path] = this.autoMerge(node);
        } else {
          node.common = {
            revision:  revision,
            timestamp: this.now()
          };

          if (action === 'put') {
            node.common.body = node.push.body;
            node.common.contentType = node.push.contentType;

            if (equal(node.local.body, node.push.body) &&
                node.local.contentType === node.push.contentType) {
              delete node.local;
            }

            delete node.push;
          } else if (action === 'delete') {
            if (node.local.body === false) { // No new local changes since push; flush it.
              nodes[path] = undefined;
            } else {
              delete node.push;
            }
          }
        }

        return this.local.setNodes(this.flush(nodes));
      }.bind(this));
    },

    dealWithFailure: function (path, action, statusMeaning) {
      return this.local.getNodes([path]).then(function (nodes) {
        if (nodes[path]) {
          delete nodes[path].push;
          return this.local.setNodes(this.flush(nodes));
        }
      }.bind(this));
    },

    interpretStatus: function (statusCode) {
      // if (typeof statusCode.length === 'number') {
      //   statusCode = statusCode[0];
      // }
      if (statusCode === 'offline' || statusCode === 'timeout') {
        return {
          successful:      false,
          networkProblems: true,
          statusCode: statusCode
        };
      }

      var series = Math.floor(statusCode / 100);

      return {
        successful: (series === 2 || statusCode === 304 || statusCode === 412 || statusCode === 404),
        conflict:   (statusCode === 412),
        unAuth:     ((statusCode === 401 && this.remote.token !== RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN) ||
                     statusCode === 402 || statusCode === 403),
        notFound:   (statusCode === 404),
        changed:    (statusCode !== 304),
        statusCode: statusCode
      };
    },

    handleGetResponse: function (path, status, bodyOrItemsMap, contentType, revision) {
      if (status.notFound) {
        if (isFolder(path)) {
          bodyOrItemsMap = {};
        } else {
          bodyOrItemsMap = false;
        }
      }

      if (status.changed) {
        return this.completeFetch(path, bodyOrItemsMap, contentType, revision).then(function (dataFromFetch) {
          if (isFolder(path)) {
            if (this.corruptServerItemsMap(bodyOrItemsMap)) {
              RemoteStorage.log('[Sync] WARNING: Discarding corrupt folder description from server for ' + path);
              return false;
            } else {
              return this.markChildren(path, bodyOrItemsMap, dataFromFetch.toBeSaved, dataFromFetch.missingChildren).then(function () {
                return true;
              });
            }
          } else {
            return this.local.setNodes(this.flush(dataFromFetch.toBeSaved)).then(function () {
              return true;
            });
          }
        }.bind(this));
      } else {
        return this.updateCommonTimestamp(path, revision).then(function () {
          return true;
        });
      }
    },

    handleResponse: function (path, action, r) {
      var status = this.interpretStatus(r.statusCode);
      if (status.successful) {
        if (action === 'get') {
          return this.handleGetResponse(path, status, r.body, r.contentType, r.revision);
        } else if (action === 'put' || action === 'delete') {
          return this.completePush(path, action, status.conflict, r.revision).then(function () {
            return true;
          });
        } else {
          throw new Error('cannot handle response for unknown action', action);
        }
      } else {
      // Unsuccessful
        var error;
        if (status.unAuth) {
          error = new RemoteStorage.Unauthorized();
        } else if (status.networkProblems) {
          error = new RemoteStorage.SyncError('Network request failed.');
          this.remote.online = false;
        } else {
          error = new Error('HTTP response code ' + status.statusCode + ' received.');
        }

        return this.dealWithFailure(path, action, status).then(function () {
          remoteStorage._emit('error', error);
          throw error;
        });
      }
    },

    numThreads: 10,

    finishTask: function (task) {
      if (task.action === undefined) {
        delete this._running[task.path];
        return;
      }
      var self = this;

      return task.promise.then(function (r) {
        return self.handleResponse(task.path, task.action, r);
      }, function (err) {
        RemoteStorage.log('[Sync] wireclient rejects its promise!', task.path, task.action, err);
        return self.handleResponse(task.path, task.action, {statusCode: 'offline'});
      })

      .then(function (completed) {
        delete self._timeStarted[task.path];
        delete self._running[task.path];
        self.remote.online = true;

        if (completed) {
          if (self._tasks[task.path]) {
            for (var i=0; i<self._tasks[task.path].length; i++) {
              self._tasks[task.path][i]();
            }
            delete self._tasks[task.path];
          }
        }

        self._emit('req-done');

        self.collectTasks(false).then(function () {
          // See if there are any more tasks that are not refresh tasks
          if (!self.hasTasks() || self.stopped) {
            RemoteStorage.log('[Sync] Sync is done! Reschedule?', Object.getOwnPropertyNames(self._tasks).length, self.stopped);
            if (!self.done) {
              self.done = true;
              self._emit('done');
            }
          } else {
            // Use a 10ms timeout to let the JavaScript runtime catch its breath
            // (and hopefully force an IndexedDB auto-commit?), and also to cause
            // the threads to get staggered and get a good spread over time:
            setTimeout(function () {
              self.doTasks();
            }, 10);
          }
        });
      }, function (err) {
        console.error('[Sync] Error', err);
        delete self._timeStarted[task.path];
        delete self._running[task.path];
        self._emit('req-done');
        if (!self.done) {
          self.done = true;
          self._emit('done');
        }
      });
    },

    doTasks: function () {
      var numToHave, numAdded = 0, numToAdd, path;
      if (this.remote.connected) {
        if (this.remote.online) {
          numToHave = this.numThreads;
        } else {
          numToHave = 1;
        }
      } else {
        numToHave = 0;
      }
      numToAdd = numToHave - Object.getOwnPropertyNames(this._running).length;
      if (numToAdd <= 0) {
        return true;
      }
      for (path in this._tasks) {
        if (!this._running[path]) {
          this._timeStarted = this.now();
          this._running[path] = this.doTask(path);
          this._running[path].then(this.finishTask.bind(this));
          numAdded++;
          if (numAdded >= numToAdd) {
            return true;
          }
        }
      }
      return (numAdded >= numToAdd);
    },

    collectTasks: function (alsoCheckRefresh) {
      if (this.hasTasks() || this.stopped) {
        return Promise.resolve();
      }

      return this.collectDiffTasks().then(function (numDiffs) {
        if (numDiffs || alsoCheckRefresh === false) {
          return Promise.resolve();
        } else {
          return this.collectRefreshTasks();
        }
      }.bind(this), function (err) {
        throw err;
      });
    },

    addTask: function (path, cb) {
      if (!this._tasks[path]) {
        this._tasks[path] = [];
      }
      if (typeof(cb) === 'function') {
        this._tasks[path].push(cb);
      }
    },

    /**
     * Method: sync
     **/
    sync: function () {
      this.done = false;

      if (!this.doTasks()) {
        return this.collectTasks().then(function () {
          try {
            this.doTasks();
          } catch(e) {
            console.error('[Sync] doTasks error', e);
          }
        }.bind(this), function (e) {
          console.error('[Sync] Sync error', e);
          throw new Error('Local cache unavailable');
        });
      } else {
        return Promise.resolve();
      }
    },
  };

  /**
   * Method: getSyncInterval
   *
   * Get the value of the sync interval when application is in the foreground
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getSyncInterval = function () {
    return syncInterval;
  };

  /**
   * Method: setSyncInterval
   *
   * Set the value of the sync interval when application is in the foreground
   *
   * Parameters:
   *   interval - sync interval in milliseconds
   *
   */
  RemoteStorage.prototype.setSyncInterval = function (interval) {
    if (!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    var oldValue = syncInterval;
    syncInterval = parseInt(interval, 10);
    this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
  };

  /**
   * Method: getBackgroundSyncInterval
   *
   * Get the value of the sync interval when application is in the background
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getBackgroundSyncInterval = function () {
    return backgroundSyncInterval;
  };

  /**
   * Method: setBackgroundSyncInterval
   *
   * Set the value of the sync interval when the application is in the background
   *
   * Parameters:
   *   interval - sync interval in milliseconds
   *
   */
  RemoteStorage.prototype.setBackgroundSyncInterval = function (interval) {
    if(!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    var oldValue = backgroundSyncInterval;
    backgroundSyncInterval = parseInt(interval, 10);
    this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
  };

  /**
   * Method: getCurrentSyncInterval
   *
   * Get the value of the current sync interval
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getCurrentSyncInterval = function () {
    return isBackground ? backgroundSyncInterval : syncInterval;
  };

  var SyncError = function (originalError) {
    var msg = 'Sync failed: ';
    if (typeof(originalError) === 'object' && 'message' in originalError) {
      msg += originalError.message;
    } else {
      msg += originalError;
    }
    this.originalError = originalError;
    this.message = msg;
  };

  SyncError.prototype = new Error();
  SyncError.prototype.constructor = SyncError;

  RemoteStorage.SyncError = SyncError;

  RemoteStorage.prototype.syncCycle = function () {
    if (this.sync.stopped) {
      return;
    }

    this.sync.on('done', function () {
      RemoteStorage.log('[Sync] Sync done. Setting timer to', this.getCurrentSyncInterval());
      if (!this.sync.stopped) {
        if (this._syncTimer) {
          clearTimeout(this._syncTimer);
        }
        this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getCurrentSyncInterval());
      }
    }.bind(this));

    this.sync.sync();
  };

  RemoteStorage.prototype.stopSync = function () {
    if (this.sync) {
      RemoteStorage.log('[Sync] Stopping sync');
      this.sync.stopped = true;
    } else {
      // TODO When is this ever the case and what is syncStopped for then?
      RemoteStorage.log('[Sync] Will instantiate sync stopped');
      this.syncStopped = true;
    }
  };

  RemoteStorage.prototype.startSync = function () {
    this.sync.stopped = false;
    this.syncStopped = false;
    this.sync.sync();
  };

  var syncCycleCb;

  RemoteStorage.Sync._rs_init = function (remoteStorage) {
    syncCycleCb = function () {
      RemoteStorage.log('[Sync] syncCycleCb calling syncCycle');
      if (RemoteStorage.Env.isBrowser()) {
        handleVisibility.bind(remoteStorage)();
      }
      if (!remoteStorage.sync) {
        // Call this now that all other modules are also ready:
        remoteStorage.sync = new RemoteStorage.Sync(
            remoteStorage.local, remoteStorage.remote, remoteStorage.access,
            remoteStorage.caching);

        if (remoteStorage.syncStopped) {
          RemoteStorage.log('[Sync] Instantiating sync stopped');
          remoteStorage.sync.stopped = true;
          delete remoteStorage.syncStopped;
        }
      }

      RemoteStorage.log('[Sync] syncCycleCb calling syncCycle');
      remoteStorage.syncCycle();
    };

    remoteStorage.on('ready', syncCycleCb);
  };

  RemoteStorage.Sync._rs_cleanup = function (remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/cachinglayer.js **/
(function () {
  /**
   * Interface: cachinglayer
   *
   * This module defines functions that are mixed into remoteStorage.local when
   * it is instantiated (currently one of indexeddb.js, localstorage.js, or
   * inmemorystorage.js).
   *
   * All remoteStorage.local implementations should therefore implement
   * this.getNodes, this.setNodes, and this.forAllNodes. The rest is blended in
   * here to create a GPD (get/put/delete) interface which the BaseClient can
   * talk to.
   */

  var isFolder = RemoteStorage.util.isFolder;
  var isDocument = RemoteStorage.util.isDocument;
  var deepClone = RemoteStorage.util.deepClone;
  var equal = RemoteStorage.util.equal;

  function getLatest(node) {
    if (typeof(node) !== 'object' || typeof(node.path) !== 'string') {
      return;
    }
    if (isFolder(node.path)) {
      if (node.local && node.local.itemsMap) {
        return node.local;
      }
      if (node.common && node.common.itemsMap) {
        return node.common;
      }
    } else {
      if (node.local && node.local.body && node.local.contentType) {
        return node.local;
      }
      if (node.common && node.common.body && node.common.contentType) {
        return node.common;
      }
      // Migration code! Once all apps use at least this version of the lib, we
      // can publish clean-up code that migrates over any old-format data, and
      // stop supporting it. For now, new apps will support data in both
      // formats, thanks to this:
      if (node.body && node.contentType) {
        return {
          body: node.body,
          contentType: node.contentType
        };
      }
    }
  }

  function isOutdated(nodes, maxAge) {
    var path, node;
    for (path in nodes) {
      if (nodes[path] && nodes[path].remote) {
        return true;
      }
      var nodeVersion = getLatest(nodes[path]);
      if (nodeVersion && nodeVersion.timestamp && (new Date().getTime()) - nodeVersion.timestamp <= maxAge) {
        return false;
      } else if (!nodeVersion) {
        return true;
      }
    }
    return true;
  }

  var pathsFromRoot = RemoteStorage.util.pathsFromRoot;

  function makeNode(path) {
    var node = { path: path, common: { } };

    if (isFolder(path)) {
      node.common.itemsMap = {};
    }
    return node;
  }

  function updateFolderNodeWithItemName(node, itemName) {
    if (!node.common) {
      node.common = {
        itemsMap: {}
      };
    }
    if (!node.common.itemsMap) {
      node.common.itemsMap = {};
    }
    if (!node.local) {
      node.local = deepClone(node.common);
    }
    if (!node.local.itemsMap) {
      node.local.itemsMap = node.common.itemsMap;
    }
    node.local.itemsMap[itemName] = true;

    return node;
  }

  var methods = {

    // TODO: improve our code structure so that this function
    // could call sync.queueGetRequest directly instead of needing
    // this hacky third parameter as a callback
    get: function (path, maxAge, queueGetRequest) {
      var self = this;
      if (typeof(maxAge) === 'number') {
        return self.getNodes(pathsFromRoot(path))
        .then(function (objs) {
          var node = getLatest(objs[path]);
          if (isOutdated(objs, maxAge)) {
            return queueGetRequest(path);
          } else if (node) {
            return {statusCode: 200, body: node.body || node.itemsMap, contentType: node.contentType};
          } else {
            return {statusCode: 404};
          }
        });
      } else {
        return self.getNodes([path])
        .then(function (objs) {
          var node = getLatest(objs[path]);
          if (node) {
            if (isFolder(path)) {
              for (var i in node.itemsMap) {
                // the hasOwnProperty check here is only because our jshint settings require it:
                if (node.itemsMap.hasOwnProperty(i) && node.itemsMap[i] === false) {
                  delete node.itemsMap[i];
                }
              }
            }
            return {statusCode: 200, body: node.body || node.itemsMap, contentType: node.contentType};
          } else {
            return {statusCode: 404};
          }
        });
      }
    },

    put: function (path, body, contentType) {
      var paths = pathsFromRoot(path);
      var self = this;

      function _processNodes(paths, nodes) {
        try {
          for (var i = 0, len = paths.length; i < len; i++) {
            var path = paths[i];
            var node = nodes[path];
            var previous;

            if (!node) {
              nodes[path] = node = makeNode(path);
            }

            // Document
            if (i === 0) {
              previous = getLatest(node);
              node.local = {
                body:                body,
                contentType:         contentType,
                previousBody:        (previous ? previous.body : undefined),
                previousContentType: (previous ? previous.contentType : undefined),
              };
            }
            // Folder
            else {
              var itemName = paths[i-1].substring(path.length);
              node = updateFolderNodeWithItemName(node, itemName);
            }
          }
          return nodes;
        } catch (e) {
          RemoteStorage.log('[Cachinglayer] Error during PUT', nodes, i, e);
          throw e;
        }
      }
      return this._updateNodes(paths, _processNodes);
    },

    delete: function (path) {
      var paths = pathsFromRoot(path);

      return this._updateNodes(paths, function (paths, nodes) {
        for (var i = 0, len = paths.length; i < len; i++) {
          var path = paths[i];
          var node = nodes[path];
          if (!node) {
            throw new Error('Cannot delete non-existing node '+path);
          }

          if (i === 0) {
          // Document
            previous = getLatest(node);
            node.local = {
              body:                false,
              previousBody:        (previous ? previous.body : undefined),
              previousContentType: (previous ? previous.contentType : undefined),
            };
          } else {
          // Folder
            if (!node.local) {
              node.local = deepClone(node.common);
            }
            var itemName = paths[i-1].substring(path.length);
            delete node.local.itemsMap[itemName];

            if (Object.getOwnPropertyNames(node.local.itemsMap).length > 0) {
              // This folder still contains other items, don't remove any further ancestors
              break;
            }
          }
        }
        return nodes;
      });
    },

    flush: function (path) {
      var self = this;
      return self._getAllDescendentPaths(path).then(function (paths) {
        return self.getNodes(paths);
      }).then(function (nodes) {
        for (var path in nodes) {
          var node = nodes[path];

          if (node && node.common && node.local) {
            self._emitChange({
              path:     node.path,
              origin:   'local',
              oldValue: (node.local.body === false ? undefined : node.local.body),
              newValue: (node.common.body === false ? undefined : node.common.body)
            });
          }
          nodes[path] = undefined;
        }
        return self.setNodes(nodes);
      });
    },

    _emitChange: function (obj) {
      if (RemoteStorage.config.changeEvents[obj.origin]) {
        this._emit('change', obj);
      }
    },

    fireInitial: function () {
      if (!RemoteStorage.config.changeEvents.local) {
        return;
      }
      var self = this;
      self.forAllNodes(function (node) {
        var latest;
        if (isDocument(node.path)) {
          latest = getLatest(node);
          if (latest) {
            self._emitChange({
              path:           node.path,
              origin:         'local',
              oldValue:       undefined,
              oldContentType: undefined,
              newValue:       latest.body,
              newContentType: latest.contentType
            });
          }
        }
      }).then(function () {
        self._emit('local-events-done');
      });
    },

    onDiff: function (diffHandler) {
      this.diffHandler = diffHandler;
    },

    migrate: function (node) {
      if (typeof(node) === 'object' && !node.common) {
        node.common = {};
        if (typeof(node.path) === 'string') {
          if (node.path.substr(-1) === '/' && typeof(node.body) === 'object') {
            node.common.itemsMap = node.body;
          }
        } else {
          //save legacy content of document node as local version
          if (!node.local) {
            node.local = {};
          }
          node.local.body = node.body;
          node.local.contentType = node.contentType;
        }
      }
      return node;
    },

    // FIXME
    // this process of updating nodes needs to be heavily documented first, then
    // refactored. Right now it's almost impossible to refactor as there's no
    // explanation of why things are implemented certain ways or what the goal(s)
    // of the behavior are. -slvrbckt
    _updateNodesRunning: false,
    _updateNodesQueued: [],
    _updateNodes: function (paths, _processNodes) {
      var pending = Promise.defer();
      this._doUpdateNodes(paths, _processNodes, pending);
      return pending.promise;
    },
    _doUpdateNodes: function (paths, _processNodes, promise) {
      var self = this;

      if (self._updateNodesRunning) {
        self._updateNodesQueued.push({
          paths: paths,
          cb: _processNodes,
          promise: promise
        });
        return;
      } else {
        self._updateNodesRunning = true;
      }

      self.getNodes(paths).then(function (nodes) {
        var existingNodes = deepClone(nodes);
        var changeEvents = [];
        var node;
        nodes = _processNodes(paths, nodes);

        for (var path in nodes) {
          node = nodes[path];
          if (equal(node, existingNodes[path])) {
            delete nodes[path];
          }
          else if (isDocument(path)) {
            changeEvents.push({
              path:           path,
              origin:         'window',
              oldValue:       node.local.previousBody,
              newValue:       node.local.body === false ? undefined : node.local.body,
              oldContentType: node.local.previousContentType,
              newContentType: node.local.contentType
            });
            delete node.local.previousBody;
            delete node.local.previousContentType;
          }
        }

        self.setNodes(nodes).then(function () {
          self._emitChangeEvents(changeEvents);
          promise.resolve({statusCode: 200});
        });
      }).then(function () {
        return Promise.resolve();
      }, function (err) {
        promise.reject(err);
      }).then(function () {
        self._updateNodesRunning = false;
        var nextJob = self._updateNodesQueued.shift();
        if (nextJob) {
          self._doUpdateNodes(nextJob.paths, nextJob.cb, nextJob.promise);
        }
      });
    },

    _emitChangeEvents: function (events) {
      for (var i = 0, len = events.length; i < len; i++) {
        this._emitChange(events[i]);
        if (this.diffHandler) {
          this.diffHandler(events[i].path);
        }
      }
    },

    _getAllDescendentPaths: function (path) {
      var self = this;
      if (isFolder(path)) {
        return self.getNodes([path]).then(function (nodes) {
          var allPaths = [path];
          var latest = getLatest(nodes[path]);

          var itemNames = Object.keys(latest.itemsMap);
          var calls = itemNames.map(function (itemName) {
            return self._getAllDescendentPaths(path+itemName).then(function (paths) {
              for (var i = 0, len = paths.length; i < len; i++) {
                allPaths.push(paths[i]);
              }
            });
          });
          return Promise.all(calls).then(function () {
            return allPaths;
          });
        });
      } else {
        return Promise.resolve([path]);
      }
    },

    _getInternals: function () {
      return {
        getLatest: getLatest,
        makeNode: makeNode,
        isOutdated: isOutdated
      };
    }
  };

  /**
   * Function: cachingLayer
   *
   * Mixes common caching layer functionality into an object.
   *
   * The first parameter is always the object to be extended.
   *
   * Example:
   *   (start code)
   *   var MyConstructor = function () {
   *     cachingLayer(this);
   *   };
   *   (end code)
   */
  RemoteStorage.cachingLayer = function (object) {
    for (var key in methods) {
      object[key] = methods[key];
    }
  };
})();


/** FILE: src/indexeddb.js **/
(function (global) {

  /**
   * Class: RemoteStorage.IndexedDB
   *
   *
   * IndexedDB Interface
   * -------------------
   *
   * TODO rewrite, doesn't expose GPD anymore, it's in cachinglayer now
   *
   * This file exposes a get/put/delete interface, accessing data in an IndexedDB.
   *
   * There are multiple parts to this interface:
   *
   *   The RemoteStorage integration:
   *     - RemoteStorage.IndexedDB._rs_supported() determines if IndexedDB support
   *       is available. If it isn't, RemoteStorage won't initialize the feature.
   *     - RemoteStorage.IndexedDB._rs_init() initializes the feature. It returns
   *       a promise that is fulfilled as soon as the database has been opened and
   *       migrated.
   *
   *   The storage interface (RemoteStorage.IndexedDB object):
   *     - Usually this is accessible via "remoteStorage.local"
   *     - #get() takes a path and returns a promise.
   *     - #put() takes a path, body and contentType and also returns a promise.
   *     - #delete() takes a path and also returns a promise.
   *     - #on('change', ...) events, being fired whenever something changes in
   *       the storage. Change events roughly follow the StorageEvent pattern.
   *       They have "oldValue" and "newValue" properties, which can be used to
   *       distinguish create/update/delete operations and analyze changes in
   *       change handlers. In addition they carry a "origin" property, which
   *       is either "window", "local", or "remote". "remote" events are fired
   *       whenever a change comes in from RemoteStorage.Sync.
   *
   *   The sync interface (also on RemoteStorage.IndexedDB object):
   *     - #getNodes([paths]) returns the requested nodes in a promise.
   *     - #setNodes(map) stores all the nodes given in the (path -> node) map.
   *
   */

  var RS = RemoteStorage;

  var DB_VERSION = 2;

  var DEFAULT_DB_NAME = 'remotestorage';
  var DEFAULT_DB;

  RS.IndexedDB = function (database) {
    this.db = database || DEFAULT_DB;

    if (!this.db) {
      RemoteStorage.log("[IndexedDB] Failed to open DB");
      return undefined;
    }

    RS.cachingLayer(this);
    RS.eventHandling(this, 'change', 'local-events-done');

    this.getsRunning = 0;
    this.putsRunning = 0;

    /**
     * Property: changesQueued
     *
     * Given a node for which uncommitted changes exist, this cache
     * stores either the entire uncommitted node, or false for a deletion.
     * The node's path is used as the key.
     *
     * changesQueued stores changes for which no IndexedDB transaction has
     * been started yet.
     */
    this.changesQueued = {};

    /**
     * Property: changesRunning
     *
     * Given a node for which uncommitted changes exist, this cache
     * stores either the entire uncommitted node, or false for a deletion.
     * The node's path is used as the key.
     *
     * At any time there is at most one IndexedDB transaction running.
     * changesRunning stores the changes that are included in that currently
     * running IndexedDB transaction, or if none is running, of the last one
     * that ran.
     */
    this.changesRunning = {};
  };

  RS.IndexedDB.prototype = {
    getNodes: function (paths) {
      var misses = [], fromCache = {};
      for (var i = 0, len = paths.length; i < len; i++) {
        if (this.changesQueued[paths[i]] !== undefined) {
          fromCache[paths[i]] = RemoteStorage.util.deepClone(this.changesQueued[paths[i]] || undefined);
        } else if(this.changesRunning[paths[i]] !== undefined) {
          fromCache[paths[i]] = RemoteStorage.util.deepClone(this.changesRunning[paths[i]] || undefined);
        } else {
          misses.push(paths[i]);
        }
      }
      if (misses.length > 0) {
        return this.getNodesFromDb(misses).then(function (nodes) {
          for (var i in fromCache) {
            nodes[i] = fromCache[i];
          }
          return nodes;
        });
      } else {
        return Promise.resolve(fromCache);
      }
    },

    setNodes: function (nodes) {
      for (var i in nodes) {
        this.changesQueued[i] = nodes[i] || false;
      }
      this.maybeFlush();
      return Promise.resolve();
    },

    maybeFlush: function () {
      if (this.putsRunning === 0) {
        this.flushChangesQueued();
      } else {
        if (!this.commitSlownessWarning) {
          this.commitSlownessWarning = setInterval(function () {
            console.log('WARNING: waited more than 10 seconds for previous commit to finish');
          }, 10000);
        }
      }
    },

    flushChangesQueued: function () {
      if (this.commitSlownessWarning) {
        clearInterval(this.commitSlownessWarning);
        this.commitSlownessWarning = null;
      }
      if (Object.keys(this.changesQueued).length > 0) {
        this.changesRunning = this.changesQueued;
        this.changesQueued = {};
        this.setNodesInDb(this.changesRunning).then(this.flushChangesQueued.bind(this));
      }
    },

    getNodesFromDb: function (paths) {
      var pending = Promise.defer();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var nodes = transaction.objectStore('nodes');
      var retrievedNodes = {};
      var startTime = new Date().getTime();

      this.getsRunning++;

      paths.map(function (path, i) {
        nodes.get(path).onsuccess = function (evt) {
          retrievedNodes[path] = evt.target.result;
        };
      });

      transaction.oncomplete = function () {
        pending.resolve(retrievedNodes);
        this.getsRunning--;
      }.bind(this);

      transaction.onerror = transaction.onabort = function () {
        pending.reject('get transaction error/abort');
        this.getsRunning--;
      }.bind(this);

      return pending.promise;
    },

    setNodesInDb: function (nodes) {
      var pending = Promise.defer();
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodesStore = transaction.objectStore('nodes');
      var startTime = new Date().getTime();

      this.putsRunning++;

      RemoteStorage.log('[IndexedDB] Starting put', nodes, this.putsRunning);

      for (var path in nodes) {
        var node = nodes[path];
        if(typeof(node) === 'object') {
          try {
            nodesStore.put(node);
          } catch(e) {
            RemoteStorage.log('[IndexedDB] Error while putting', node, e);
            throw e;
          }
        } else {
          try {
            nodesStore.delete(path);
          } catch(e) {
            RemoteStorage.log('[IndexedDB] Error while removing', nodesStore, node, e);
            throw e;
          }
        }
      }

      transaction.oncomplete = function () {
        this.putsRunning--;
        RemoteStorage.log('[IndexedDB] Finished put', nodes, this.putsRunning, (new Date().getTime() - startTime)+'ms');
        pending.resolve();
      }.bind(this);

      transaction.onerror = function () {
        this.putsRunning--;
        pending.reject('transaction error');
      }.bind(this);

      transaction.onabort = function () {
        pending.reject('transaction abort');
        this.putsRunning--;
      }.bind(this);

      return pending.promise;
    },

    reset: function (callback) {
      var dbName = this.db.name;
      var self = this;

      this.db.close();

      RS.IndexedDB.clean(this.db.name, function() {
        RS.IndexedDB.open(dbName, function (err, other) {
          if (err) {
            RemoteStorage.log('[IndexedDB] Error while resetting local storage', err);
          } else {
            // hacky!
            self.db = other;
          }
          if (typeof callback === 'function') { callback(self); }
        });
      });
    },

    forAllNodes: function (cb) {
      var pending = Promise.defer();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var cursorReq = transaction.objectStore('nodes').openCursor();

      cursorReq.onsuccess = function (evt) {
        var cursor = evt.target.result;

        if (cursor) {
          cb(this.migrate(cursor.value));
          cursor.continue();
        } else {
          pending.resolve();
        }
      }.bind(this);

      return pending.promise;
    },

    closeDB: function () {
      this.db.close();
    }

  };

  RS.IndexedDB.open = function (name, callback) {
    var timer = setTimeout(function () {
      callback("timeout trying to open db");
    }, 10000);

    try {
      var req = indexedDB.open(name, DB_VERSION);

      req.onerror = function () {
        RemoteStorage.log('[IndexedDB] Opening DB failed', req);

        clearTimeout(timer);
        callback(req.error);
      };

      req.onupgradeneeded = function (event) {
        var db = req.result;

        RemoteStorage.log("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);

        if (event.oldVersion !== 1) {
          RemoteStorage.log("[IndexedDB] Creating object store: nodes");
          db.createObjectStore('nodes', { keyPath: 'path' });
        }

        RemoteStorage.log("[IndexedDB] Creating object store: changes");

        db.createObjectStore('changes', { keyPath: 'path' });
      };

      req.onsuccess = function () {
        clearTimeout(timer);

        // check if all object stores exist
        var db = req.result;
        if(!db.objectStoreNames.contains('nodes') || !db.objectStoreNames.contains('changes')) {
          RemoteStorage.log("[IndexedDB] Missing object store. Resetting the database.");
          RS.IndexedDB.clean(name, function() {
            RS.IndexedDB.open(name, callback);
          });
          return;
        }

        callback(null, req.result);
      };
    } catch(error) {
      RemoteStorage.log("[IndexedDB] Failed to open database: " + error);
      RemoteStorage.log("[IndexedDB] Resetting database and trying again.");

      clearTimeout(timer);

      RS.IndexedDB.clean(name, function() {
        RS.IndexedDB.open(name, callback);
      });
    };
  };

  RS.IndexedDB.clean = function (databaseName, callback) {
    var req = indexedDB.deleteDatabase(databaseName);

    req.onsuccess = function () {
      RemoteStorage.log('[IndexedDB] Done removing DB');
      callback();
    };

    req.onerror = req.onabort = function (evt) {
      console.error('Failed to remove database "' + databaseName + '"', evt);
    };
  };

  RS.IndexedDB._rs_init = function (remoteStorage) {
    var pending = Promise.defer();

    RS.IndexedDB.open(DEFAULT_DB_NAME, function (err, db) {
      if (err) {
        pending.reject(err);
      } else {
        DEFAULT_DB = db;
        db.onerror = function () { remoteStorage._emit('error', err); };
        pending.resolve();
      }
    });

    return pending.promise;
  };

  RS.IndexedDB._rs_supported = function () {
    var pending = Promise.defer();

    global.indexedDB = global.indexedDB    || global.webkitIndexedDB ||
                       global.mozIndexedDB || global.oIndexedDB      ||
                       global.msIndexedDB;

    // Detect browsers with known IndexedDb issues (e.g. Android pre-4.4)
    var poorIndexedDbSupport = false;
    if (typeof global.navigator !== 'undefined' &&
        global.navigator.userAgent.match(/Android (2|3|4\.[0-3])/)) {
      // Chrome and Firefox support IndexedDB
      if (!navigator.userAgent.match(/Chrome|Firefox/)) {
        poorIndexedDbSupport = true;
      }
    }

    if ('indexedDB' in global && !poorIndexedDbSupport) {
      try {
        var check = indexedDB.open("rs-check");
        check.onerror = function (event) {
          pending.reject();
        };
        check.onsuccess = function (event) {
          indexedDB.deleteDatabase("rs-check");
          pending.resolve();
        };
      } catch(e) {
        pending.reject();
      }
    } else {
      pending.reject();
    }

    return pending.promise;
  };

  RS.IndexedDB._rs_cleanup = function (remoteStorage) {
    var pending = Promise.defer();

    if (remoteStorage.local) {
      remoteStorage.local.closeDB();
    }

    RS.IndexedDB.clean(DEFAULT_DB_NAME, function () {
      pending.resolve();
    });

    return pending.promise;
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/localstorage.js **/
(function (global) {
  /**
   * Class: RemoteStorage.LocalStorage
   *
   * localStorage caching adapter. Used when no IndexedDB available.
   **/

  var NODES_PREFIX = "remotestorage:cache:nodes:";
  var CHANGES_PREFIX = "remotestorage:cache:changes:";

  RemoteStorage.LocalStorage = function () {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.log('[LocalStorage] Registering events');
    RemoteStorage.eventHandling(this, 'change', 'local-events-done');
  };

  function b64ToUint6(nChr) {
    return nChr > 64 && nChr < 91 ?
      nChr - 65
      : nChr > 96 && nChr < 123 ?
      nChr - 71
      : nChr > 47 && nChr < 58 ?
      nChr + 4
      : nChr === 43 ?
      62
      : nChr === 47 ?
      63
      :
      0;
  }

  function isBinary(node) {
    return node.match(/charset=binary/);
  }

  function isRemoteStorageKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX ||
           key.substr(0, CHANGES_PREFIX.length) === CHANGES_PREFIX;
  }

  function isNodeKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX;
  }

  RemoteStorage.LocalStorage.prototype = {

    getNodes: function (paths) {
      var nodes = {};

      for(var i = 0, len = paths.length; i < len; i++) {
        try {
          nodes[paths[i]] = JSON.parse(localStorage[NODES_PREFIX+paths[i]]);
        } catch(e) {
          nodes[paths[i]] = undefined;
        }
      }

      return Promise.resolve(nodes);
    },

    setNodes: function (nodes) {
      for (var path in nodes) {
        // TODO shouldn't we use getItem/setItem?
        localStorage[NODES_PREFIX+path] = JSON.stringify(nodes[path]);
      }

      return Promise.resolve();
    },

    forAllNodes: function (cb) {
      var node;

      for(var i = 0, len = localStorage.length; i < len; i++) {
        if (isNodeKey(localStorage.key(i))) {
          try {
            node = this.migrate(JSON.parse(localStorage[localStorage.key(i)]));
          } catch(e) {
            node = undefined;
          }
          if (node) {
            cb(node);
          }
        }
      }
      return Promise.resolve();
    }

  };

  RemoteStorage.LocalStorage._rs_init = function () {};

  RemoteStorage.LocalStorage._rs_supported = function () {
    return 'localStorage' in global;
  };

  // TODO tests missing!
  RemoteStorage.LocalStorage._rs_cleanup = function () {
    var keys = [];

    for (var i = 0, len = localStorage.length; i < len; i++) {
      var key = localStorage.key(i);
      if (isRemoteStorageKey(key)) {
        keys.push(key);
      }
    }

    keys.forEach(function (key) {
      RemoteStorage.log('[LocalStorage] Removing', key);
      delete localStorage[key];
    });
  };
})(typeof(window) !== 'undefined' ? window : global);

/** FILE: src/inmemorystorage.js **/
(function (global) {
  /**
   * Class: RemoteStorage.InMemoryStorage
   *
   * In-memory caching adapter. Used when no IndexedDB or localStorage
   * available.
   **/

  RemoteStorage.InMemoryStorage = function () {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.log('[InMemoryStorage] Registering events');
    RemoteStorage.eventHandling(this, 'change', 'local-events-done');

    this._storage = {};
  };

  RemoteStorage.InMemoryStorage.prototype = {

    getNodes: function (paths) {
      var nodes = {};

      for(var i = 0, len = paths.length; i < len; i++) {
        nodes[paths[i]] = this._storage[paths[i]];
      }

      return Promise.resolve(nodes);
    },

    setNodes: function (nodes) {
      for (var path in nodes) {
        if (nodes[path] === undefined) {
          delete this._storage[path];
        } else {
          this._storage[path] = nodes[path];
        }
      }

      return Promise.resolve();
    },

    forAllNodes: function (cb) {
      for (var path in this._storage) {
        cb(this.migrate(this._storage[path]));
      }
      return Promise.resolve();
    }

  };

  RemoteStorage.InMemoryStorage._rs_init = function () {};

  RemoteStorage.InMemoryStorage._rs_supported = function () {
    // In-memory storage is always supported
    return true;
  };

  RemoteStorage.InMemoryStorage._rs_cleanup = function () {};
})(typeof(window) !== 'undefined' ? window : global);

/** FILE: src/modules.js **/
(function () {

  RemoteStorage.MODULES = {};

  /*
   * Method: RemoteStorage.defineModule
   *
   * Method for defining a new remoteStorage data module
   *
   * Parameters:
   *   moduleName - Name of the module
   *   builder    - Builder function defining the module
   *
   * The module builder function should return an object containing another
   * object called exports, which will be exported to any <RemoteStorage>
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
   *   RemoteStorage.defineModule('locations', function (privateClient, publicClient) {
   *     return {
   *       exports: {
   *         features: privateClient.scope('features/').defaultType('feature'),
   *         collections: privateClient.scope('collections/').defaultType('feature-collection')
   *       }
   *     };
   *   });
   * (end code)
  */

  RemoteStorage.defineModule = function (moduleName, builder) {
    RemoteStorage.MODULES[moduleName] = builder;

    Object.defineProperty(RemoteStorage.prototype, moduleName, {
      configurable: true,
      get: function () {
        var instance = this._loadModule(moduleName);
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
      Object.defineProperty(RemoteStorage.prototype, camelizedName, {
        get: function () {
          return this[moduleName];
        }
      });
    }
  };

  RemoteStorage.prototype._loadModule = function (moduleName) {
    var builder = RemoteStorage.MODULES[moduleName];
    if (builder) {
      var module = builder(new RemoteStorage.BaseClient(this, '/' + moduleName + '/'),
                           new RemoteStorage.BaseClient(this, '/public/' + moduleName + '/'));
      return module.exports;
    } else {
      throw "Unknown module: " + moduleName;
    }
  };

  RemoteStorage.prototype.defineModule = function (moduleName) {
    console.log("remoteStorage.defineModule is deprecated, use RemoteStorage.defineModule instead!");
    RemoteStorage.defineModule.apply(RemoteStorage, arguments);
  };

})();


/** FILE: src/debug/inspect.js **/
(function() {
  function loadTable(table, storage, paths) {
    table.setAttribute('border', '1');
    table.style.margin = '8px';
    table.style.color = 'white';
    table.innerHTML = '';
    var thead = document.createElement('thead');
    table.appendChild(thead);
    var titleRow = document.createElement('tr');
    thead.appendChild(titleRow);
    ['Path', 'Content-Type', 'Revision'].forEach(function(label) {
      var th = document.createElement('th');
      th.textContent = label;
      thead.appendChild(th);
    });

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    function renderRow(tr, path, contentType, revision) {
      [path, contentType, revision].forEach(function(value) {
        var td = document.createElement('td');
        td.textContent = value || '';
        tr.appendChild(td);
      });
    }

    function loadRow(path) {
      if (storage.connected === false) { return; }
      function processRow(status, body, contentType, revision) {
        if (status === 200) {
          var tr = document.createElement('tr');
          tbody.appendChild(tr);
          renderRow(tr, path, contentType, revision);
          if (path[path.length - 1] === '/') {
            for (var key in body) {
              loadRow(path + key);
            }
          }
        }
      }
      storage.get(path).then(processRow);
    }

    paths.forEach(loadRow);
  }

  function renderWrapper(title, table, storage, paths) {
    var wrapper = document.createElement('div');
    //wrapper.style.display = 'inline-block';
    var heading = document.createElement('h2');
    heading.textContent = title;
    wrapper.appendChild(heading);
    var updateButton = document.createElement('button');
    updateButton.textContent = "Refresh";
    updateButton.onclick = function() { loadTable(table, storage, paths); };
    wrapper.appendChild(updateButton);
    if (storage.reset) {
      var resetButton = document.createElement('button');
      resetButton.textContent = "Reset";
      resetButton.onclick = function() {
        storage.reset(function(newStorage) {
          storage = newStorage;
          loadTable(table, storage, paths);
        });
      };
      wrapper.appendChild(resetButton);
    }
    wrapper.appendChild(table);
    loadTable(table, storage, paths);
    return wrapper;
  }

  function renderLocalChanges(local) {
    var wrapper = document.createElement('div');
    //wrapper.style.display = 'inline-block';
    var heading = document.createElement('h2');
    heading.textContent = "Outgoing changes";
    wrapper.appendChild(heading);
    var updateButton = document.createElement('button');
    updateButton.textContent = "Refresh";
    wrapper.appendChild(updateButton);
    var list = document.createElement('ul');
    list.style.fontFamily = 'courier';
    wrapper.appendChild(list);

    function updateList() {
      list.innerHTML = '';
      local.forAllNodes(function(node) {
        if (node.local && node.local.body) {
          var el = document.createElement('li');
          el.textContent = JSON.stringify(node.local);
          list.appendChild(el);
        }
      });
    }

    updateButton.onclick = updateList;
    updateList();
    return wrapper;
  }

  RemoteStorage.prototype.inspect = function() {

    var widget = document.createElement('div');
    widget.id = 'remotestorage-inspect';
    widget.style.position = 'absolute';
    widget.style.top = 0;
    widget.style.left = 0;
    widget.style.background = 'black';
    widget.style.color = 'white';
    widget.style.border = 'groove 5px #ccc';

    var controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.top = 0;
    controls.style.left = 0;

    var heading = document.createElement('strong');
    heading.textContent = " remotestorage.js inspector ";

    controls.appendChild(heading);

    var syncButton;

    if (this.local) {
      syncButton = document.createElement('button');
      syncButton.textContent = "Synchronize";
      controls.appendChild(syncButton);
    }

    var closeButton = document.createElement('button');
    closeButton.textContent = "Close";
    closeButton.onclick = function() {
      document.body.removeChild(widget);
    };
    controls.appendChild(closeButton);

    widget.appendChild(controls);

    var remoteRootPaths = [];
    for (var path in this.caching._rootPaths) {
      if (this.caching._rootPaths.hasOwnProperty(path)) {
        remoteRootPaths.push(path);
      }
    }

    var remoteTable = document.createElement('table');
    var localTable = document.createElement('table');
    widget.appendChild(renderWrapper("Remote", remoteTable, this.remote, remoteRootPaths));
    if (this.local) {
      widget.appendChild(renderWrapper("Local", localTable, this.local, ['/']));
      widget.appendChild(renderLocalChanges(this.local));

      syncButton.onclick = function() {
        this.log('sync clicked');
        this.sync.sync().then(function() {
          this.log('SYNC FINISHED');
          loadTable(localTable, this.local, ['/']);
        }.bind(this), function(err) {
          console.error("SYNC FAILED", err, err.stack);
        });
      }.bind(this);
    }

    document.body.appendChild(widget);
  };
})();


/** FILE: src/googledrive.js **/
(function (global) {
  /**
   * Class: RemoteStorage.GoogleDrive
   *
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   *
   * To use this backend, you need to specify the app's client ID like so:
   *
   * (start code)
   *
   * remoteStorage.setApiKeys('googledrive', {
   *   clientId: 'your-client-id'
   * });
   *
   * (end code)
   *
   * An client ID can be obtained by registering your app in the Google
   * Developers Console: https://developers.google.com/drive/web/auth/web-client
   *
   * Docs: https://developers.google.com/drive/web/auth/web-client#create_a_client_id_and_client_secret
   **/

  var RS = RemoteStorage;

  var BASE_URL = 'https://www.googleapis.com';
  var AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
  var AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';

  var GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
  var RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

  function buildQueryString(params) {
    return Object.keys(params).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
  }

  function fileNameFromMeta(meta) {
    return encodeURIComponent(meta.title) + (meta.mimeType === GD_DIR_MIME_TYPE ? '/' : '');
  }

  function metaTitleFromFileName(filename) {
    if (filename.substr(-1) === '/') {
      filename = filename.substr(0, filename.length - 1);
    }
    return decodeURIComponent(filename);
  }

  function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
  }

  function baseName(path) {
    var parts = path.split('/');
    if (path.substr(-1) === '/') {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

  var Cache = function (maxAge) {
    this.maxAge = maxAge;
    this._items = {};
  };

  Cache.prototype = {
    get: function (key) {
      var item = this._items[key];
      var now = new Date().getTime();
      return (item && item.t >= (now - this.maxAge)) ? item.v : undefined;
    },

    set: function (key, value) {
      this._items[key] = {
        v: value,
        t: new Date().getTime()
      };
    }
  };

  RS.GoogleDrive = function (remoteStorage, clientId) {

    RS.eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');

    this.rs = remoteStorage;
    this.clientId = clientId;

    this._fileIdCache = new Cache(60 * 5); // ids expire after 5 minutes (is this a good idea?)
  };

  RS.GoogleDrive.prototype = {
    connected: false,
    online: true,

    configure: function (settings) { // Settings parameter compatible with WireClient
      if (settings.token) {
        localStorage['remotestorage:googledrive:token'] = settings.token;
        this.token = settings.token;
        this.connected = true;
        this._emit('connected');
      } else {
        this.connected = false;
        delete this.token;
        delete localStorage['remotestorage:googledrive:token'];
      }
    },

    connect: function () {
      this.rs.setBackend('googledrive');
      RS.Authorize(AUTH_URL, AUTH_SCOPE, String(RS.Authorize.getLocation()), this.clientId);
    },

    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    get: function (path, options) {
      if (path.substr(-1) === '/') {
        return this._getFolder(path, options);
      } else {
        return this._getFile(path, options);
      }
    },

    put: function (path, body, contentType, options) {
      var self = this;
      function putDone(response) {
        if (response.status >= 200 && response.status < 300) {
          var meta = JSON.parse(response.responseText);
          var etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          return Promise.resolve({statusCode: 200, contentType: meta.mimeType, revision: etagWithoutQuotes});
        } else if (response.status === 412) {
          return Promise.resolve({statusCode: 412, revision: 'conflict'});
        } else {
          return Promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
        }
      }
      return self._getFileId(path).then(function (id) {
        if (id) {
          if (options && (options.ifNoneMatch === '*')) {
            return putDone({ status: 412 });
          }
          return self._updateFile(id, path, body, contentType, options).then(putDone);
        } else {
          return self._createFile(path, body, contentType, options).then(putDone);
        }
      });
    },

    'delete': function (path, options) {
      var self = this;
      return self._getFileId(path).then(function (id) {
        if (!id) {
          // File doesn't exist. Ignore.
          return Promise.resolve({statusCode: 200});
        }

        return self._getMeta(id).then(function (meta) {
          var etagWithoutQuotes;
          if ((typeof meta === 'object') && (typeof meta.etag === 'string')) {
            etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          }
          if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
            return {statusCode: 412, revision: etagWithoutQuotes};
          }

          return self._request('DELETE', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
            if (response.status === 200 || response.status === 204) {
              return {statusCode: 200};
            } else {
              return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
            }
          });
        });
      });
    },

    _updateFile: function (id, path, body, contentType, options) {
      var self = this;
      var metadata = {
        mimeType: contentType
      };
      var headers = {
        'Content-Type': 'application/json; charset=UTF-8'
      };

      if (options && options.ifMatch) {
        headers['If-Match'] = '"' + options.ifMatch + '"';
      }

      return self._request('PUT', BASE_URL + '/upload/drive/v2/files/' + id + '?uploadType=resumable', {
        body: JSON.stringify(metadata),
        headers: headers
      }).then(function (response) {
        if (response.status === 412) {
          return (response);
        } else {
          return self._request('PUT', response.getResponseHeader('Location'), {
            body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
          });
        }
      });
    },

    _createFile: function (path, body, contentType, options) {
      var self = this;
      return self._getParentId(path).then(function (parentId) {
        var fileName = baseName(path);
        var metadata = {
          title: metaTitleFromFileName(fileName),
          mimeType: contentType,
          parents: [{
            kind: "drive#fileLink",
            id: parentId
          }]
        };
        return self._request('POST', BASE_URL + '/upload/drive/v2/files?uploadType=resumable', {
          body: JSON.stringify(metadata),
          headers: {
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }).then(function (response) {
          return self._request('POST', response.getResponseHeader('Location'), {
            body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
          });
        });
      });
    },

    _getFile: function (path, options) {
      var self = this;
      return self._getFileId(path).then(function (id) {
        return self._getMeta(id).then(function (meta) {
          var etagWithoutQuotes;
          if (typeof(meta) === 'object' && typeof(meta.etag) === 'string') {
            etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          }

          if (options && options.ifNoneMatch && (etagWithoutQuotes === options.ifNoneMatch)) {
            return Promise.resolve({statusCode: 304});
          }

          var options2 = {};
          if (!meta.downloadUrl) {
            if (meta.exportLinks && meta.exportLinks['text/html']) {
              // Documents that were generated inside GoogleDocs have no
              // downloadUrl, but you can export them to text/html instead:
              meta.mimeType += ';export=text/html';
              meta.downloadUrl = meta.exportLinks['text/html'];
            } else {
              // empty file
              return Promise.resolve({statusCode: 200, body: '', contentType: meta.mimeType, revision: etagWithoutQuotes});
            }
          }

          if (meta.mimeType.match(/charset=binary/)) {
            options2.responseType = 'blob';
          }
          return self._request('GET', meta.downloadUrl, options2).then(function (response) {
            var body = response.response;
            if (meta.mimeType.match(/^application\/json/)) {
              try {
                body = JSON.parse(body);
              } catch(e) {}
            }
            return Promise.resolve({statusCode: 200, body: body, contentType: meta.mimeType, revision: etagWithoutQuotes});
          });
        });
      });
    },

    _getFolder: function (path, options) {
      var self = this;
      return self._getFileId(path).then(function (id) {
        var query, fields, data, i, etagWithoutQuotes, itemsMap;
        if (! id) {
          return Promise.resolve({statusCode: 404});
        }

        query = '\'' + id + '\' in parents';
        fields = 'items(downloadUrl,etag,fileSize,id,mimeType,title)';
        return self._request('GET', BASE_URL + '/drive/v2/files?'
            + 'q=' + encodeURIComponent(query)
            + '&fields=' + encodeURIComponent(fields)
            + '&maxResults=1000',
            {})
        .then(function (response) {
          if (response.status !== 200) {
            return Promise.reject('request failed or something: ' + response.status);
          }

          try {
            data = JSON.parse(response.responseText);
          } catch(e) {
            return Promise.reject('non-JSON response from GoogleDrive');
          }

          itemsMap = {};
          for (var i = 0, len = data.items.length; i < len; i++) {
            etagWithoutQuotes = data.items[i].etag.substring(1, data.items[i].etag.length-1);
            if (data.items[i].mimeType === GD_DIR_MIME_TYPE) {
              self._fileIdCache.set(path + data.items[i].title + '/', data.items[i].id);
              itemsMap[data.items[i].title + '/'] = {
                ETag: etagWithoutQuotes
              };
            } else {
              self._fileIdCache.set(path + data.items[i].title, data.items[i].id);
              itemsMap[data.items[i].title] = {
                ETag: etagWithoutQuotes,
                'Content-Type': data.items[i].mimeType,
                'Content-Length': data.items[i].fileSize
              };
            }
          }
          // FIXME: add revision of folder!
          return Promise.resolve({statusCode: 200, body: itemsMap, contentType: RS_DIR_MIME_TYPE, revision: undefined});
        });
      });
    },

    _getParentId: function (path) {
      var foldername = parentPath(path);
      var self = this;
      return self._getFileId(foldername).then(function (parentId) {
        if (parentId) {
          return Promise.resolve(parentId);
        } else {
          return self._createFolder(foldername);
        }
      });
    },

    _createFolder: function (path) {
      var self = this;
      return self._getParentId(path).then(function (parentId) {
        return self._request('POST', BASE_URL + '/drive/v2/files', {
          body: JSON.stringify({
            title: metaTitleFromFileName(baseName(path)),
            mimeType: GD_DIR_MIME_TYPE,
            parents: [{
              id: parentId
            }]
          }),
          headers: {
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }).then(function (response) {
          var meta = JSON.parse(response.responseText);
          return Promise.resolve(meta.id);
        });
      });
    },

    _getFileId: function (path) {
      var self = this;
      var id;
      if (path === '/') {
        // "root" is a special alias for the fileId of the root folder
        return Promise.resolve('root');
      } else if ((id = this._fileIdCache.get(path))) {
        // id is cached.
        return Promise.resolve(id);
      }
      // id is not cached (or file doesn't exist).
      // load parent folder listing to propagate / update id cache.
      return self._getFolder(parentPath(path)).then(function () {
        id = self._fileIdCache.get(path);
        if (!id) {
          if (path.substr(-1) === '/') {
            return self._createFolder(path).then(function () {
              return self._getFileId(path);
            });
          } else {
            return Promise.resolve();
          }
          return;
        }
        return Promise.resolve(id);
      });
    },

    _getMeta: function (id) {
      return this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
        if (response.status === 200) {
          return Promise.resolve(JSON.parse(response.responseText));
        } else {
          return Promise.reject("request (getting metadata for " + id + ") failed with status: " + response.status);
        }
      });
    },

    _request: function (method, url, options) {
      var self = this;
      if (! options.headers) { options.headers = {}; }
      options.headers['Authorization'] = 'Bearer ' + self.token;
      return RS.WireClient.request(method, url, options).then(function (xhr) {
        // google tokens expire from time to time...
        if (xhr && xhr.status === 401) {
          self.connect();
          return;
        }
        return xhr;
      });
    }
  };

  RS.GoogleDrive._rs_init = function (remoteStorage) {
    var config = remoteStorage.apiKeys.googledrive;
    if (config) {
      remoteStorage.googledrive = new RS.GoogleDrive(remoteStorage, config.clientId);
      if (remoteStorage.backend === 'googledrive') {
        remoteStorage._origRemote = remoteStorage.remote;
        remoteStorage.remote = remoteStorage.googledrive;
      }
    }
  };

  RS.GoogleDrive._rs_supported = function (rs) {
    return true;
  };

  RS.GoogleDrive._rs_cleanup = function (remoteStorage) {
    remoteStorage.setBackend(undefined);
    if (remoteStorage._origRemote) {
      remoteStorage.remote = remoteStorage._origRemote;
      delete remoteStorage._origRemote;
    }
  };

})(this);


/** FILE: src/dropbox.js **/
(function (global) {
  var RS = RemoteStorage;

  /**
   * File: Dropbox
   *
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   *
   * Dropbox backend for RemoteStorage.js
   * This file exposes a get/put/delete interface which is compatible with
   * <RemoteStorage.WireClient>.
   *
   * When remoteStorage.backend is set to 'dropbox', this backend will
   * initialize and replace remoteStorage.remote with remoteStorage.dropbox.
   *
   * In order to ensure compatibility with the public folder, <BaseClient.getItemURL>
   * gets hijacked to return the Dropbox public share URL.
   *
   * To use this backend, you need to specify the Dropbox app key like so:
   *
   * (start code)
   *
   * remoteStorage.setApiKeys('dropbox', {
   *   appKey: 'your-app-key'
   * });
   *
   * (end code)
   *
   * An app key can be obtained by registering your app at https://www.dropbox.com/developers/apps
   *
   * Known issues:
   *
   *   - Storing files larger than 150MB is not yet supported
   *   - Listing and deleting folders with more than 10'000 files will cause problems
   *   - Content-Type is not fully supported due to limitations of the Dropbox API
   *   - Dropbox preserves cases but is not case-sensitive
   *   - getItemURL is asynchronous which means getIetmURL returns useful values
   *     after the syncCycle
   */

  var hasLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize';
  var SETTINGS_KEY = 'remotestorage:dropbox';
  var cleanPath = RS.WireClient.cleanPath;

  /**
   * class: LowerCaseCache
   *
   * A cache which automatically converts all keys to lower case and can
   * propagate changes up to parent folders.
   *
   * By default the set and delete methods are aliased to justSet and justDelete.
   *
   * Parameters:
   *
   *   defaultValue - the value that is returned for all keys that don't exist
   *                  in the cache
   */
  function LowerCaseCache(defaultValue){
    this.defaultValue = defaultValue;
    this._storage = { };
    this.set = this.justSet;
    this.delete = this.justDelete;
  }

  LowerCaseCache.prototype = {
    /**
     * Method: get
     *
     * Get a value from the cache or defaultValue, if the key is not in the
     * cache.
     */
    get : function (key) {
      key = key.toLowerCase();
      var stored = this._storage[key];
      if (typeof stored === 'undefined'){
        stored = this.defaultValue;
        this._storage[key] = stored;
      }
      return stored;
    },

    /**
     * Method: propagateSet
     *
     * Set a value and also update the parent folders with that value.
     */
    propagateSet : function (key, value) {
      key = key.toLowerCase();
      if (this._storage[key] === value) {
        return value;
      }
      this._propagate(key, value);
      this._storage[key] = value;
      return value;
    },

    /**
     * Method: propagateDelete
     *
     * Delete a value and propagate the changes to the parent folders.
     */
    propagateDelete : function (key) {
      key = key.toLowerCase();
      this._propagate(key, this._storage[key]);
      return delete this._storage[key];
    },

    _activatePropagation: function (){
      this.set = this.propagateSet;
      this.delete = this.propagateDelete;
      return true;
    },

    /**
     * Method: justSet
     *
     * Set a value without propagating.
     */
    justSet : function (key, value) {
      key = key.toLowerCase();
      this._storage[key] = value;
      return value;
    },

    /**
     * Method: justDelete
     *
     * Delete a value without propagating.
     */
    justDelete : function (key, value) {
      key = key.toLowerCase();
      return delete this._storage[key];
    },

    _propagate: function (key, rev){
      var folders = key.split('/').slice(0,-1);
      var path = '';

      for (var i = 0, len = folders.length; i < len; i++){
        path += folders[i]+'/';
        if (!rev) {
          rev = this._storage[path]+1;
        }
        this._storage[path] =  rev;
      }
    }
  };

  var onErrorCb;

  /**
   * Class: RemoteStorage.Dropbox
   */
  RS.Dropbox = function (rs) {

    this.rs = rs;
    this.connected = false;
    this.rs = rs;
    var self = this;

    onErrorCb = function (error){
      if (error instanceof RemoteStorage.Unauthorized) {
        // Delete all the settings - see the documentation of wireclient.configure
        self.configure({
          userAddress: null,
          href: null,
          storageApi: null,
          token: null,
          options: null
        });
      }
    };

    RS.eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');
    rs.on('error', onErrorCb);

    this.clientId = rs.apiKeys.dropbox.appKey;
    this._revCache = new LowerCaseCache('rev');
    this._itemRefs = {};
    this._metadataCache = {};

    if (hasLocalStorage){
      var settings;
      try {
        settings = JSON.parse(localStorage[SETTINGS_KEY]);
      } catch(e){}
      if (settings) {
        this.configure(settings);
      }
      try {
        this._itemRefs = JSON.parse(localStorage[ SETTINGS_KEY+':shares' ]);
      } catch(e) {  }
    }
    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.Dropbox.prototype = {
    online: true,

    /**
     * Method: connect
     *
     * Set the backed to 'dropbox' and start the authentication flow in order
     * to obtain an API token from Dropbox.
     */
    connect: function () {
      // TODO handling when token is already present
      this.rs.setBackend('dropbox');
      if (this.token){
        hookIt(this.rs);
      } else {
        RS.Authorize(AUTH_URL, '', String(RS.Authorize.getLocation()), this.clientId);
      }
    },

    /**
     * Method : configure(settings)
     * Accepts its parameters according to the <RemoteStorage.WireClient>.
     * Sets the connected flag
     **/
    configure: function (settings) {
      // We only update this.userAddress if settings.userAddress is set to a string or to null:
      if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
      // Same for this.token. If only one of these two is set, we leave the other one at its existing value:
      if (typeof settings.token !== 'undefined') { this.token = settings.token; }

      if (this.token) {
        this.connected = true;
        if ( !this.userAddress ){
          this.info().then(function (info){
            this.userAddress = info.display_name;
            this.rs.widget.view.setUserAddress(this.userAddress);
            this._emit('connected');
          }.bind(this));
        }
      } else {
        this.connected = false;
      }
      if (hasLocalStorage){
        localStorage[SETTINGS_KEY] = JSON.stringify({
          userAddress: this.userAddress,
          token: this.token
        });
      }
    },

    /**
     * Method: stopWaitingForToken
     *
     * Stop waiting for the token and emit not-connected
     */
    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    /**
     * Method: _getFolder
     *
     * Get all items in a folder.
     *
     * Parameters:
     *
     *   path - path of the folder to get, with leading slash
     *   options - not used
     *
     * Returns:
     *
     *  statusCode - HTTP status code
     *  body - array of the items found
     *  contentType - 'application/json; charset=UTF-8'
     *  revision - revision of the folder
     */
    _getFolder: function (path, options) {
      // FIXME simplify promise handling
      var url = 'https://api.dropbox.com/1/metadata/auto' + cleanPath(path);
      var revCache = this._revCache;
      var self = this;

      return this._request('GET', url, {}).then(function (resp) {
        var status = resp.status;
        if (status === 304) {
          return Promise.resolve({statusCode: status});
        }
        var listing, body, mime, rev;
        try{
          body = JSON.parse(resp.responseText);
        } catch (e) {
          return Promise.reject(e);
        }
        rev = self._revCache.get(path);
        mime = 'application/json; charset=UTF-8';
        if (body.contents) {
          listing = body.contents.reduce(function (m, item) {
            var itemName = item.path.split('/').slice(-1)[0] + ( item.is_dir ? '/' : '' );
            if (item.is_dir){
              m[itemName] = { ETag: revCache.get(path+itemName) };
            } else {
              m[itemName] = { ETag: item.rev };
            }
            return m;
          }, {});
        }
        return Promise.resolve({statusCode: status, body: listing, contentType: mime, revision: rev});
      });
    },

    /**
     * Method: get
     *
     * Compatible with <RemoteStorage.WireClient.get>
     *
     * Checks for the path in _revCache and decides based on that if file has
     * changed. Calls _getFolder is the path points to a folder.
     *
     * Calls <RemoteStorage.Dropbox.share> afterwards to fill _itemRefs.
     */
    get: function (path, options) {
      if (! this.connected) { return Promise.reject("not connected (path: " + path + ")"); }
      var url = 'https://api-content.dropbox.com/1/files/auto' + cleanPath(path);
      var self = this;

      var savedRev = this._revCache.get(path);
      if (savedRev === null) {
        // file was deleted server side
        return Promise.resolve({statusCode: 404});
      }
      if (options && options.ifNoneMatch &&
         savedRev && (savedRev === options.ifNoneMatch)) {
        // nothing changed.
        return Promise.resolve({statusCode: 304});
      }

      //use _getFolder for folders
      if (path.substr(-1) === '/') { return this._getFolder(path, options); }

      return this._request('GET', url, {}).then(function (resp) {
        var status = resp.status;
        var meta, body, mime, rev;
        if (status !== 200) {
          return Promise.resolve({statusCode: status});
        }

        body = resp.responseText;
        try {
          meta = JSON.parse( resp.getResponseHeader('x-dropbox-metadata') );
        } catch(e) {
          return Promise.reject(e);
        }

        mime = meta.mime_type; //resp.getResponseHeader('Content-Type');
        rev = meta.rev;
        self._revCache.set(path, rev);
        self._shareIfNeeded(path); // The shared link expires every 4 hours

        // handling binary
        if (!resp.getResponseHeader('Content-Type') ||
            resp.getResponseHeader('Content-Type').match(/charset=binary/)) {
          var pending = Promise.defer();

          RS.WireClient.readBinaryData(resp.response, mime, function (result) {
            pending.resolve({
              statusCode: status,
              body: result,
              contentType: mime,
              revision: rev
            });
          });

          return pending.promise;
        }

        // handling json (always try)
        if (mime && mime.search('application/json') >= 0 || true) {
          try {
            body = JSON.parse(body);
            mime = 'application/json; charset=UTF-8';
          } catch(e) {
            //Failed parsing Json, assume it is something else then
          }
        }

        return Promise.resolve({statusCode: status, body: body, contentType: mime, revision: rev});
      });
    },

    /**
     * Method: put
     *
     * Compatible with <RemoteStorage.WireClient>
     *
     * Checks for the path in _revCache and decides based on that if file has
     * changed.
     *
     * Calls <RemoteStorage.Dropbox.share> afterwards to fill _itemRefs.
     */
    put: function (path, body, contentType, options) {
      var self = this;

      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }

      //check if file has changed and return 412
      var savedRev = this._revCache.get(path);
      if (options && options.ifMatch &&
          savedRev && (savedRev !== options.ifMatch)) {
        return Promise.resolve({statusCode: 412, revision: savedRev});
      }
      if (options && (options.ifNoneMatch === '*') &&
          savedRev && (savedRev !== 'rev')) {
        return Promise.resolve({statusCode: 412, revision: savedRev});
      }

      if ((!contentType.match(/charset=/)) &&
          (body instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(body))) {
        contentType += '; charset=binary';
      }

      if (body.length > 150 * 1024 * 1024) {
        //https://www.dropbox.com/developers/core/docs#chunked-upload
        return Promise.reject(new Error("Cannot upload file larger than 150MB"));
      }

      var result;
      var needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
      var uploadParams = {
        body: body,
        contentType: contentType,
        path: path
      };

      if (needsMetadata) {
        result = this._getMetadata(path).then(function (metadata) {
          if (options && (options.ifNoneMatch === '*') && metadata) {
            // if !!metadata === true, the file exists
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          }

          if (options && options.ifMatch && metadata && (metadata.rev !== options.ifMatch)) {
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          }

          return self._uploadSimple(uploadParams);
        });
      } else {
        result = self._uploadSimple(uploadParams);
      }

      return result.then(function (ret) {
        self._shareIfNeeded(path);
        return ret;
      });
    },

    /**
     * Method: delete
     *
     * Compatible with <RemoteStorage.WireClient.delete>
     *
     * Checks for the path in _revCache and decides based on that if file has
     * changed.
     *
     * Calls <RemoteStorage.Dropbox.share> afterwards to fill _itemRefs.
     */
    'delete': function (path, options) {
      var self = this;

      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }

      //check if file has changed and return 412
      var savedRev = this._revCache.get(path);
      if (options && options.ifMatch && savedRev && (options.ifMatch !== savedRev)) {
        return Promise.resolve({ statusCode: 412, revision: savedRev });
      }

      if (options && options.ifMatch) {
        return this._getMetadata(path).then(function (metadata) {
          if (options && options.ifMatch && metadata && (metadata.rev !== options.ifMatch)) {
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          }

          return self._deleteSimple(path);
        });
      }

      return self._deleteSimple(path);
    },

    /**
     * Method: _shareIfNeeded
     *
     * Calls share, if the provided path resides in a public folder.
     */
    _shareIfNeeded: function (path) {
      if (path.match(/^\/public\/.*[^\/]$/) && this._itemRefs[path] === undefined) {
        this.share(path);
      }
    },

    /**
     * Method: share
     *
     * Gets a publicly-accessible URL for the path from Dropbox and stores it
     * in _itemRefs.
     *
     * Returns:
     *
     *   A promise for the URL
     */
    share: function (path) {
      var self = this;
      var url = 'https://api.dropbox.com/1/media/auto/' + cleanPath(path);

      return this._request('POST', url, {}).then(function (response) {
        if (response.status !== 200) {
          return Promise.reject(new Error('Invalid Dropbox API response status when sharing "' + path + '":' + response.status));
        }

        try {
          response = JSON.parse(response.responseText);
        } catch (e) {
          return Promise.reject(new Error('Invalid Dropbox API response when sharing "' + path + '": ' + response.responseText));
        }

        self._itemRefs[path] = response.url;

        if (hasLocalStorage) {
          localStorage[SETTINGS_KEY + ':shares'] = JSON.stringify(self._itemRefs);
        }

        return Promise.resolve(url);
      }, function (error) {
        err.message = 'Sharing dropbox file or folder ("' + path + '") failed.' + err.message;
        return Promise.reject(error);
      });
    },

    /**
     * Method: info
     *
     * Fetches the user's info from dropbox and returns a promise for it.
     *
     * Returns:
     *
     *   A promise to the user's info
     */
    info: function () {
      var url = 'https://api.dropbox.com/1/account/info';
      // requesting user info(mainly for userAdress)
      return this._request('GET', url, {}).then(function (resp){
        try {
          var info = JSON.parse(resp.responseText);
          return Promise.resolve(info);
        } catch (e) {
          return Promise.reject(e);
        }
      });
    },

    /**
     * Method: _request
     *
     * Make a HTTP request.
     *
     * Options:
     *
     *   headers - an object containing the request headers
     *
     * Parameters:
     *
     *   method - the method to use
     *   url - the URL to make the request to
     *   options - see above
     */
    _request: function (method, url, options) {
      var self = this;
      if (! options.headers) { options.headers = {}; }
      options.headers['Authorization'] = 'Bearer ' + this.token;
      return RS.WireClient.request.call(this, method, url, options).then(function (xhr) {
        //503 means retry this later
        if (xhr && xhr.status === 503) {
          return global.setTimeout(self._request(method, url, options), 3210);
        } else {
          return Promise.resolve(xhr);
        }
      });
    },

    /**
     * Method: fetchDelta
     *
     * Fetches the revision of all the files from dropbox API and puts them
     * into _revCache. These values can then be used to determine if something
     * has changed.
     */
    fetchDelta: function () {
      // TODO: Handle `has_more`

      var args = Array.prototype.slice.call(arguments);
      var self = this;
      return self._request('POST', 'https://api.dropbox.com/1/delta', {
        body: self._deltaCursor ? ('cursor=' + encodeURIComponent(self._deltaCursor)) : '',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).then(function (response) {
        // break if status != 200
        if (response.status !== 200 ) {
          if (response.status === 400) {
            self.rs._emit('error', new RemoteStorage.Unauthorized());
            return Promise.resolve(args);
          } else {
            return Promise.reject("dropbox.fetchDelta returned "+response.status+response.responseText);
          }
          return;
        }

        var delta;
        try {
          delta = JSON.parse(response.responseText);
        } catch(error) {
          RS.log('fetchDeltas can not parse response',error);
          return Promise.reject("can not parse response of fetchDelta : "+error.message);
        }
        // break if no entries found
        if (!delta.entries) {
          return Promise.reject('dropbox.fetchDeltas failed, no entries found');
        }

        // Dropbox sends the complete state
        if (delta.reset) {
          self._revCache = new LowerCaseCache('rev');
        }

        //saving the cursor for requesting further deltas in relation to the cursor position
        if (delta.cursor) {
          self._deltaCursor = delta.cursor;
        }

        //updating revCache
        RemoteStorage.log("Delta : ", delta.entries);
        delta.entries.forEach(function (entry) {
          var path = entry[0];
          var rev;
          if (!entry[1]){
            rev = null;
          } else {
            if (entry[1].is_dir) {
              return;
            }
            rev = entry[1].rev;
          }
          self._revCache.set(path, rev);
        });
        return Promise.resolve(args);
      }, function (err) {
        this.rs.log('fetchDeltas', err);
        this.rs._emit('error', new RemoteStorage.SyncError('fetchDeltas failed.' + err));
        promise.reject(err);
      }).then(function () {
        if (self._revCache) {
          var args = Array.prototype.slice.call(arguments);
          self._revCache._activatePropagation();
          return Promise.resolve(args);
        }
      });
    },

    /**
     * Method: _getMetadata
     *
     * Gets metadata for a path (can point to either a file or a folder).
     *
     * Options:
     *
     *   list - if path points to a folder, specifies whether to list the
     *          metadata of the folder's children. False by default.
     *
     * Parameters:
     *
     *   path - the path to get metadata for
     *   options - see above
     *
     * Returns:
     *
     *   A promise for the metadata
     */
    _getMetadata: function (path, options) {
      var self = this;
      var cached = this._metadataCache[path];
      var url = 'https://api.dropbox.com/1/metadata/auto' + cleanPath(path);
      url += '?list=' + ((options && options.list) ? 'true' : 'false');
      if (cached && cached.hash) {
        url += '&hash=' + encodeURIComponent(cached.hash);
      }
      return this._request('GET', url, {}).then(function (resp) {
        if (resp.status === 304) {
          return Promise.resolve(cached);
        } else if (resp.status === 200) {
          var response = JSON.parse(resp.responseText);
          self._metadataCache[path] = response;
          return Promise.resolve(response);
        } else {
          // The file doesn't exist
          return Promise.resolve();
        }
      });
    },

    /**
     * Method: _uploadSimple
     *
     * Upload a simple file (the size is no more than 150MB).
     *
     * Parameters:
     *
     *   ifMatch - same as for get
     *   path - path of the file
     *   body - contents of the file to upload
     *   contentType - mime type of the file
     *
     * Returns:
     *
     *   statusCode - HTTP status code
     *   revision - revision of the newly-created file, if any
     */
    _uploadSimple: function (params) {
      var self = this;
      var url = 'https://api-content.dropbox.com/1/files_put/auto' + cleanPath(params.path) + '?';

      if (params && params.ifMatch) {
        url += "parent_rev=" + encodeURIComponent(params.ifMatch);
      }

      return self._request('PUT', url, {
        body: params.body,
        headers: {
          'Content-Type': params.contentType
        }
      }).then(function (resp) {
        if (resp.status !== 200) {
          return Promise.resolve({ statusCode: resp.status });
        }

        var response;

        try {
          response = JSON.parse(resp.responseText);
        } catch (e) {
          return Promise.reject(e);
        }

        // Conflict happened. Delete the copy created by dropbox
        if (response.path !== params.path) {
          var deleteUrl = 'https://api.dropbox.com/1/fileops/delete?root=auto&path=' + encodeURIComponent(response.path);
          self._request('POST', deleteUrl, {});

          return self._getMetadata(params.path).then(function (metadata) {
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          });
        }

        self._revCache.propagateSet(params.path, response.rev);
        return Promise.resolve({ statusCode: resp.status });
      });
    },

    /**
     * Method: _deleteSimple
     *
     * Deletes a file or a folder. If the folder contains more than 10'000 items
     * (recursively) then the operation may not complete successfully. If that
     * is the case, an Error gets thrown.
     *
     * Parameters:
     *
     *   path - the path to delete
     *
     * Returns:
     *
     *   statusCode - HTTP status code
     */
    _deleteSimple: function (path) {
      var self = this;
      var url = 'https://api.dropbox.com/1/fileops/delete?root=auto&path=' + encodeURIComponent(path);

      return self._request('POST', url, {}).then(function (resp) {
        if (resp.status === 406) {
          // Too many files would be involved in the operation for it to
          // complete successfully.
          // TODO: Handle this somehow
          return Promise.reject(new Error("Cannot delete '" + path + "': too many files involved"));
        }

        if (resp.status === 200) {
          self._revCache.delete(path);
          delete self._itemRefs[path];
        }

        return Promise.resolve({ statusCode: resp.status });
      });
    }
  };

  //hooking and unhooking the sync

  function hookSync(rs) {
    if (rs._dropboxOrigSync) { return; } // already hooked
    rs._dropboxOrigSync = rs.sync.bind(rs);
    rs.sync = function () {
      return this.dropbox.fetchDelta.apply(this.dropbox, arguments).
        then(rs._dropboxOrigSync, function (err) {
          rs._emit('error', new rs.SyncError(err));
        });
    };
  }

  function unHookSync(rs) {
    if (! rs._dropboxOrigSync) { return; } // not hooked
    rs.sync = rs._dropboxOrigSync;
    delete rs._dropboxOrigSync;
  }

  // hooking and unhooking getItemURL

  function hookGetItemURL(rs) {
    if (rs._origBaseClientGetItemURL) { return; }
    rs._origBaseClientGetItemURL = RS.BaseClient.prototype.getItemURL;
    RS.BaseClient.prototype.getItemURL = function (path){
      var ret = rs.dropbox._itemRefs[path];
      return  ret ? ret : '';
    };
  }

  function unHookGetItemURL(rs){
    if (! rs._origBaseClientGetItemURL) { return; }
    RS.BaseClient.prototype.getItemURL = rs._origBaseClientGetItemURL;
    delete rs._origBaseClientGetItemURL;
  }

  function hookRemote(rs){
    if (rs._origRemote) { return; }
    rs._origRemote = rs.remote;
    rs.remote = rs.dropbox;
  }

  function unHookRemote(rs){
    if (rs._origRemote) {
      rs.remote = rs._origRemote;
      delete rs._origRemote;
    }
  }

  function hookIt(rs){
    hookRemote(rs);
    if (rs.sync) {
      hookSync(rs);
    }
    hookGetItemURL(rs);
  }

  function unHookIt(rs){
    unHookRemote(rs);
    unHookSync(rs);
    unHookGetItemURL(rs);
  }

  RS.Dropbox._rs_init = function (rs) {
    hasLocalStorage = rs.localStorageAvailable();
    if ( rs.apiKeys.dropbox ) {
      rs.dropbox = new RS.Dropbox(rs);
    }
    if (rs.backend === 'dropbox') {
      hookIt(rs);
    }
  };

  RS.Dropbox._rs_supported = function () {
    return true;
  };

  RS.Dropbox._rs_cleanup = function (rs) {
    unHookIt(rs);
    if (hasLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    rs.removeEventListener('error', onErrorCb);
    rs.setBackend(undefined);
  };
})(this);

return new RemoteStorage();
});
