(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("xmlhttprequest"));
	else if(typeof define === 'function' && define.amd)
		define("RemoteStorage", ["xmlhttprequest"], factory);
	else if(typeof exports === 'object')
		exports["RemoteStorage"] = factory(require("xmlhttprequest"));
	else
		root["RemoteStorage"] = factory(root["xmlhttprequest"]);
})(this, function(__WEBPACK_EXTERNAL_MODULE_23__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
	  var hasLocalStorage;

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
	      this._emit('error', new Authorize.Unauthorized());
	    }
	    return Promise.resolve(r);
	  }

	  var util = __webpack_require__(2)
	  var SyncedGetPutDelete = __webpack_require__(6);
	  var Dropbox = __webpack_require__(7);
	  var GoogleDrive = __webpack_require__(20);
	  var Discover = __webpack_require__(21);
	  var BaseClient = __webpack_require__(9);
	  var config = __webpack_require__(5);
	  var Authorize = __webpack_require__(8);
	  var Sync = __webpack_require__(18);


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
	    if (typeof cfg === 'object') {
	      config.logging = !!cfg.logging;
	      config.cordovaRedirectUri = cfg.cordovaRedirectUri;
	    }

	    var eventHandling = __webpack_require__(3);
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
	      if (eventName === 'ready' && this.remote && this.remote.connected && this._allLoaded) {
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

	  // RemoteStorage.Access = require('./access');
	  // RemoteStorage.util = require('./util');
	  // RemoteStorage.eventHandling = require('./eventhandling');
	  // RemoteStorage.Authorize = require('./authorize');
	  // RemoteStorage.SyncedGetPutDelete = SyncedGetPutDelete;

	  RemoteStorage.prototype.authorize = function (authURL, cordovaRedirectUri) {
	    this.access.setStorageType(this.remote.storageType);
	    var scope = this.access.scopeParameter;

	    var redirectUri = global.cordova ?
	      cordovaRedirectUri :
	      String(Authorize.getLocation());

	    var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

	    Authorize(this, authURL, scope, redirectUri, clientId);
	  };
	  

	  RemoteStorage.DiscoveryError = function (message) {
	    Error.apply(this, arguments);
	    this.message = message;
	  };

	  RemoteStorage.DiscoveryError.prototype = Object.create(Error.prototype);

	  // RemoteStorage.Unauthorized = Authorize.Unauthorized;
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


	  config.logging = false;
	  config.changeEvents = {
	      local:    true,
	      window:   false,
	      remote:   true,
	      conflict: true
	  };
	  config.cache = true;
	  config.discoveryTimeout = 10000;
	  config.cordovaRedirectUri = undefined;

	  var log = __webpack_require__(4);
	  RemoteStorage.prototype = {

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
	        if (typeof config.cordovaRedirectUri !== 'string') {
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
	        throw new Error("Cordova redirect URI must be a URI string");
	      }
	      config.cordovaRedirectUri = uri;
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
	        this.local = config.cache && features.local && new features.local();
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
	      this._cleanups = [];
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
	            features.caching = !!Caching && config.cache;
	            features.sync = !!Sync;
	            [
	              'IndexedDB',
	              'LocalStorage',
	              'InMemoryStorage'
	            ].some(function (cachingLayer) {
	              if (features.some(function (feature) { return feature.name === cachingLayer; })) {
	                features.local = __webpack_require__(24)("./" + cachingLayer.toLowerCase());
	                return true;
	              }
	            });
	            self.features = features;
	            callback(features);
	          }, 0);
	        }
	      }

	      function featureInitialized(name) {
	        var feature = __webpack_require__(24)("./" + name.toLowerCase())
	        self.log("[RemoteStorage] [FEATURE "+name+"] initialized.");
	        features.push({
	          name : name,
	          init :  feature._rs_init,
	          supported : true,
	          cleanup : feature._rs_cleanup
	        });
	        featureDone();
	      }

	      function featureFailed(name, err) {
	        self.log("[RemoteStorage] [FEATURE "+name+"] initialization failed ( "+err+")");
	        featureDone();
	      }

	      function featureSupported(name, success) {
	        self.log( true ? "":" not"+" supported");
	        if (!success) {
	          featureDone();
	        }
	      }

	      function initFeature(name) {

	        // if (config.cache && name === 'Sync') return
	        var feature = __webpack_require__(24)("./" + name.toLowerCase())
	        var initResult;
	        try {
	          initResult = feature._rs_init(self);
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
	        var feature = __webpack_require__(24)("./" + featureName.toLowerCase())
	        self.log("[RemoteStorage] [FEATURE " + featureName + "] initializing...");
	        var impl = feature;
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
	  */
	  var Access = __webpack_require__(25);
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







	  /**
	   * Method: getSyncInterval
	   *
	   * Get the value of the sync interval when application is in the foreground
	   *
	   * Returns a number of milliseconds
	   *
	  //  */
	  RemoteStorage.prototype.getSyncInterval = function () {
	    return syncInterval;
	  };

	    /**
	   * Check if interval is valid: numeric and between 1000ms and 3600000ms
	   *
	   */
	  function isValidInterval(interval) {
	    return (typeof interval === 'number' && interval > 1000 && interval < 3600000);
	  }


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

	  Sync.SyncError = SyncError;


	  /* TOFIX (in sync.js also... has to be a shared property */
	  var syncInterval = 10000,
	      backgroundSyncInterval = 60000,
	      isBackground = false;
	  RemoteStorage.prototype.syncCycle = function () {
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
	  };

	  RemoteStorage.prototype.stopSync = function () {
	    if (this.sync) {
	      log('[Sync] Stopping sync');
	      this.sync.stopped = true;
	    } else {
	      // TODO When is this ever the case and what is syncStopped for then?
	      log('[Sync] Will instantiate sync stopped');
	      this.syncStopped = true;
	    }
	  };

	  RemoteStorage.prototype.startSync = function () {
	    this.sync.stopped = false;
	    this.syncStopped = false;
	    this.sync.sync();
	  };





	  // TODO clean up/harmonize how modules are loaded and/or document this architecture properly
	  //
	  // At this point the global remoteStorage object has not been created yet.
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
	  var Caching = __webpack_require__(26);
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

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {var eventHandling = __webpack_require__(3);
	/**
	 * Class: RemoteStorage.Util
	 *
	 * Provides reusable utility functions at RemoteStorage.util
	 *
	 */
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

	  var util = {
	    getEventEmitter: function () {
	      var object = {};
	      var args = Array.prototype.slice.call(arguments);
	      args.unshift(object);
	      eventHandling.apply(RemoteStorage, args);
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
	      return !util.isFolder(path);
	    },

	    baseName: function (path) {
	      var parts = path.split('/');
	      if (util.isFolder(path)) {
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
	          if (!util.equal(a[i], b[i], seen)) {
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

	          if (!util.equal(a[key], b[key], seenArg)) {
	            return false;
	          }
	        }
	      }

	      return true;
	    },

	    equalObj: function (obj1, obj2) {
	      console.warn('DEPRECATION WARNING: util.equalObj has been replaced by util.equal.');
	      return util.equal(obj1, obj2);
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
	    },
	    /* jshint ignore:end */


	    localStorageAvailable: function() {
	      if (!('localStorage' in global)) { return false }

	      try {
	        global.localStorage.setItem('rs-check', 1);
	        global.localStorage.removeItem('rs-check');
	        return true;
	      } catch(error) {
	        return false;
	      }
	    }

	  };

	  module.exports = util
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	  var log = __webpack_require__(4);
	  
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
	      log('[Eventhandling] Adding event listener', eventName, handler);
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
	      this._handlers[eventName].slice().forEach(function (handler) {
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
	 module.exports = function (object) {
	    var eventNames = Array.prototype.slice.call(arguments, 1);
	    for (var key in methods) {
	      object[key] = methods[key];
	    }
	    object._handlers = {};
	    eventNames.forEach(function (eventName) {
	      object._addEvent(eventName);
	    });
	  };


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var config = __webpack_require__(5);

	module.exports = function () {
	  if (config.logging) {
	    console.log.apply(console, arguments);
	  }
	};

/***/ },
/* 5 */
/***/ function(module, exports) {

	var config = {}


	module.exports = config;

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	
	var log = __webpack_require__(4);

	function shareFirst(path) {
	  return ( this.backend === 'dropbox' &&
	           path.match(/^\/public\/.*[^\/]$/) );
	}

	var SyncedGetPutDelete = {
	  get: function (path, maxAge) {
	    if (this.local) {
	      if (maxAge === undefined) {
	        if ((typeof this.remote === 'object') &&
	             this.remote.connected && this.remote.online) {
	          maxAge = 2*this.getSyncInterval();
	        } else {
	          log('Not setting default maxAge, because remote is offline or not connected');
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

	module.exports = SyncedGetPutDelete;


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {  var Authorize = __webpack_require__(8);
	  var BaseClient = __webpack_require__(9);
	  var WireClient = __webpack_require__(13);
	  var util = __webpack_require__(2);
	  var eventHandling = __webpack_require__(3);
	  var Sync = __webpack_require__(18);
	  
	  // var RemoteStorage = require('./remotestorage');

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
	  var PATH_PREFIX = '/remotestorage';

	  /**
	   * Function: getDropboxPath(path)
	   *
	   * Map a local path to a path in DropBox.
	   */
	  var getDropboxPath = function (path) {
	    return WireClient.cleanPath(PATH_PREFIX + '/' + path);
	  };

	  var encodeQuery = function (obj) {
	    var pairs = [];

	    for (var key in obj) {
	      if (obj.hasOwnProperty(key)) {
	        pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
	      }
	    }

	    return pairs.join('&');
	  };

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
	  var Dropbox = function (rs) {

	    this.rs = rs;
	    this.connected = false;
	    this.rs = rs;
	    var self = this;

	    onErrorCb = function (error){
	      if (error instanceof Authorize.Unauthorized) {
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

	    eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');
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

	  Dropbox.prototype = {
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
	        Authorize(this.rs, AUTH_URL, '', String(Authorize.getLocation()), this.clientId);
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
	      var url = 'https://api.dropbox.com/1/metadata/auto' + getDropboxPath(path);
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
	      var url = 'https://api-content.dropbox.com/1/files/auto' + getDropboxPath(path);
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

	          WireClient.readBinaryData(resp.response, mime, function (result) {
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
	          (body instanceof ArrayBuffer || WireClient.isArrayBufferView(body))) {
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
	      var url = 'https://api.dropbox.com/1/media/auto' + getDropboxPath(path);

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

	      return WireClient.request.call(this, method, url, options).then(function(xhr) {
	        // 503 means retry this later
	        if (xhr && xhr.status === 503) {
	          if (self.online) {
	            self.online = false;
	            self.rs._emit('network-offline');
	          }
	          return global.setTimeout(self._request(method, url, options), 3210);
	        } else {
	          if (!self.online) {
	            self.online = true;
	            self.rs._emit('network-online');
	          }

	          return Promise.resolve(xhr);
	        }
	      }, function(error) {
	        if (self.online) {
	          self.online = false;
	          self.rs._emit('network-offline');
	        }
	        return Promise.reject(error);
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
	      var body = { path_prefix: PATH_PREFIX };

	      if (self._deltaCursor) {
	        body.cursor = self._deltaCursor;
	      }

	      return self._request('POST', 'https://api.dropbox.com/1/delta', {
	        body: encodeQuery(body),
	        headers: {
	          'Content-Type': 'application/x-www-form-urlencoded'
	        }
	      }).then(function (response) {
	        // break if status != 200
	        if (response.status !== 200 ) {
	          if (response.status === 400) {
	            self.rs._emit('error', new Authorize.Unauthorized());
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
	          log('fetchDeltas can not parse response',error);
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
	        delta.entries.forEach(function (entry) {
	          var path = entry[0].substr(PATH_PREFIX.length);
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
	        this.rs._emit('error', new Sync.SyncError('fetchDeltas failed.' + err));
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
	      var url = 'https://api.dropbox.com/1/metadata/auto' + getDropboxPath(path);
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
	      var url = 'https://api-content.dropbox.com/1/files_put/auto' + getDropboxPath(params.path) + '?';

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
	        if (response.path !== getDropboxPath(params.path)) {
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
	      var url = 'https://api.dropbox.com/1/fileops/delete?root=auto&path=' + encodeURIComponent(getDropboxPath(path));

	      return self._request('POST', url, {}).then(function (resp) {
	        if (resp.status === 406) {
	          // Too many files would be involved in the operation for it to
	          // complete successfully.
	          // TODO: Handle this somehow
	          return Promise.reject(new Error("Cannot delete '" + path + "': too many files involved"));
	        }

	        if (resp.status === 200 || resp.status === 404) {
	          self._revCache.delete(path);
	          delete self._itemRefs[path];
	        }

	        return Promise.resolve({ statusCode: resp.status });
	      });
	    }
	  };

	  // Hooking and unhooking the sync

	  function hookSync(rs) {
	    if (rs._dropboxOrigSync) { return; } // already hooked
	    rs._dropboxOrigSync = rs.sync.sync.bind(rs.sync);
	    rs.sync.sync = function () {
	      return this.dropbox.fetchDelta.apply(this.dropbox, arguments).
	        then(rs._dropboxOrigSync, function (err) {
	          rs._emit('error', new Sync.SyncError(err));
	        });
	    }.bind(rs);
	  }

	  function unHookSync(rs) {
	    if (! rs._dropboxOrigSync) { return; } // not hooked
	    rs.sync.sync = rs._dropboxOrigSync;
	    delete rs._dropboxOrigSync;
	  }

	  // Hooking and unhooking getItemURL

	  function hookGetItemURL(rs) {
	    if (rs._origBaseClientGetItemURL) { return; }
	    rs._origBaseClientGetItemURL = BaseClient.prototype.getItemURL;
	    BaseClient.prototype.getItemURL = function (path){
	      var ret = rs.dropbox._itemRefs[path];
	      return  ret ? ret : '';
	    };
	  }

	  function unHookGetItemURL(rs){
	    if (! rs._origBaseClientGetItemURL) { return; }
	    BaseClient.prototype.getItemURL = rs._origBaseClientGetItemURL;
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
	    } else {
	      // when sync is not available yet, we wait for the remote to be connected,
	      // at which point sync should be available as well
	      rs.on('connected', function() {
	        if (rs.sync) {
	          hookSync(rs);
	        }
	      });
	    }
	    hookGetItemURL(rs);
	  }

	  function unHookIt(rs){
	    unHookRemote(rs);
	    unHookSync(rs);
	    unHookGetItemURL(rs);
	  }

	  Dropbox._rs_init = function (rs) {
	    hasLocalStorage = util.localStorageAvailable();
	    if ( rs.apiKeys.dropbox ) {
	      rs.dropbox = new Dropbox(rs);
	    }
	    if (rs.backend === 'dropbox') {
	      hookIt(rs);
	    }
	  };

	  Dropbox._rs_supported = function () {
	    return true;
	  };

	  Dropbox._rs_cleanup = function (rs) {
	    unHookIt(rs);
	    if (hasLocalStorage){
	      delete localStorage[SETTINGS_KEY];
	    }
	    rs.removeEventListener('error', onErrorCb);
	    rs.setBackend(undefined);
	  };


	  module.exports = Dropbox;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {var log = __webpack_require__(4);
	var util = __webpack_require__(2);
	// var RemoteStorage = require('./remotestorage');
	  
	  function extractParams(url) {
	    //FF already decodes the URL fragment in document.location.hash, so use this instead:
	    var location = url || Authorize.getLocation().href,
	        hashPos  = location.indexOf('#'),
	        hash;
	    if (hashPos === -1) { return; }
	    hash = location.substring(hashPos+1);
	    // if hash is not of the form #key=val&key=val, it's probably not for us
	    if (hash.indexOf('=') === -1) { return; }
	    return hash.split('&').reduce(function (params, kvs) {
	      var kv = kvs.split('=');

	      if (kv[0] === 'state' && kv[1].match(/rsDiscovery/)) {
	        // extract rsDiscovery data from the state param
	        var stateValue = decodeURIComponent(kv[1]);
	        var encodedData = stateValue.substr(stateValue.indexOf('rsDiscovery='))
	                                    .split('&')[0]
	                                    .split('=')[1];

	        params['rsDiscovery'] = JSON.parse(atob(encodedData));

	        // remove rsDiscovery param
	        stateValue = stateValue.replace(new RegExp('\&?rsDiscovery=' + encodedData), '');

	        if (stateValue.length > 0) {
	          params['state'] = stateValue;
	        }
	      } else {
	        params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
	      }

	      return params;
	    }, {});
	  }

	  // RemoteStorage.ImpliedAuth = function (storageApi, redirectUri) {
	  //   log('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
	  //   // Set a fixed access token, signalling to not send it as Bearer
	  //   remoteStorage.remote.configure({
	  //     token: Authorize.IMPLIED_FAKE_TOKEN
	  //   });
	  //   document.location = redirectUri;
	  // };

	  var Authorize = function (remoteStorage, authURL, scope, redirectUri, clientId) {
	    log('[Authorize] authURL = ', authURL, 'scope = ', scope, 'redirectUri = ', redirectUri, 'clientId = ', clientId);

	    // keep track of the discovery data during redirect if we can't save it in localStorage
	    if (!util.localStorageAvailable() &&
	        remoteStorage.backend === 'remotestorage') {
	      redirectUri += redirectUri.indexOf('#') > 0 ? '&' : '#';

	      var discoveryData = {
	        userAddress: remoteStorage.remote.userAddress,
	        href: remoteStorage.remote.href,
	        storageApi: remoteStorage.remote.storageApi,
	        properties: remoteStorage.remote.properties
	      };

	      redirectUri += 'rsDiscovery=' + btoa(JSON.stringify(discoveryData));
	    }

	    var url = authURL, hashPos = redirectUri.indexOf('#');
	    url += authURL.indexOf('?') > 0 ? '&' : '?';
	    url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
	    url += '&scope=' + encodeURIComponent(scope);
	    url += '&client_id=' + encodeURIComponent(clientId);
	    if (hashPos !== - 1 && hashPos+1 !== redirectUri.length) {
	      url += '&state=' + encodeURIComponent(redirectUri.substring(hashPos+1));
	    }
	    url += '&response_type=token';

	    if (global.cordova) {
	      return Authorize.openWindow(
	          url,
	          redirectUri,
	          'location=yes,clearsessioncache=yes,clearcache=yes'
	        )
	        .then(function(authResult) {
	          remoteStorage.remote.configure({
	            token: authResult.access_token
	          });
	        })
	    }

	    Authorize.setLocation(url);
	  };

	  Authorize.IMPLIED_FAKE_TOKEN = false;
	  
	  // RemoteStorage.prototype.authorize = function (authURL, cordovaRedirectUri) {
	  //   this.access.setStorageType(this.remote.storageType);
	  //   var scope = this.access.scopeParameter;

	  //   var redirectUri = global.cordova ?
	  //     cordovaRedirectUri :
	  //     String(Authorize.getLocation());

	  //   var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

	  //   Authorize(this, authURL, scope, redirectUri, clientId);
	  // };
	  // 
	  // 
	  Authorize.Unauthorized = function () { Error.apply(this, arguments); };
	  Authorize.Unauthorized.prototype = Object.create(Error.prototype);


	  /**
	   * Get current document location
	   *
	   * Override this method if access to document.location is forbidden
	   */
	  Authorize.getLocation = function () {
	    return global.document.location;
	  };

	  /**
	   * Set current document location
	   *
	   * Override this method if access to document.location is forbidden
	   */
	  Authorize.setLocation = function (location) {
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
	  Authorize.openWindow = function (url, redirectUri, options) {
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

	  // RS.prototype.impliedauth = function () {
	  //   RS.ImpliedAuth(this.remote.storageApi, String(document.location));
	  // };

	  Authorize._rs_supported = function () {
	    return typeof(document) !== 'undefined';
	  };

	  var onFeaturesLoaded;
	  Authorize._rs_init = function (remoteStorage) {

	    onFeaturesLoaded = function () {
	      var authParamsUsed = false;
	      if (params) {
	        if (params.error) {
	          throw "Authorization server errored: " + params.error;
	        }

	        // rsDiscovery came with the redirect, because it couldn't be
	        // saved in localStorage
	        if (params.rsDiscovery) {
	          remoteStorage.remote.configure(params.rsDiscovery);
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
	          location = Authorize.getLocation();
	          Authorize.setLocation(location.href.split('#')[0]+'#'+params.state);
	        }
	      }
	      if (!authParamsUsed) {
	        remoteStorage.remote.stopWaitingForToken();
	      }
	    };
	    var params = extractParams(),
	        location;
	    if (params) {
	      location = Authorize.getLocation();
	      location.hash = '';
	    }
	    remoteStorage.on('features-loaded', onFeaturesLoaded);
	  };

	  Authorize._rs_cleanup = function (remoteStorage) {
	    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
	  };

	  module.exports = Authorize;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	
	  function deprecate(thing, replacement) {
	    console.log('WARNING: ' + thing + ' is deprecated. Use ' +
	                replacement + ' instead.');
	  }

	  var eventHandling = __webpack_require__(3);
	  var util = __webpack_require__(2);
	  var config = __webpack_require__(5);
	  __webpack_require__(10);


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
	  var BaseClient = function (storage, base) {
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

	    eventHandling(this, 'change');
	    this.on = this.on.bind(this);
	    storage.onChange(this.base, this._fireChange.bind(this));
	  };

	  BaseClient.prototype = {

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
	      return new BaseClient(this.storage, this.makePath(path));
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
	        return Promise.reject("Not a folder: " + path);
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
	      if (config.changeEvents[event.origin]) {
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

	    _cleanPath: util.cleanPath,

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
	  BaseClient._rs_init = function () {
	    
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

	module.exports = BaseClient;
	__webpack_require__(11);

/***/ },
/* 10 */
/***/ function(module, exports) {

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


/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	  var tv4 = __webpack_require__(12);
	  var BaseClient = __webpack_require__(9)

	  /**
	   * Class: RemoteStorage.BaseClient.Types
	   *
	   * - Manages and validates types of remoteStorage objects, using JSON-LD and
	   *   JSON Schema
	   * - Adds schema declaration/validation methods to BaseClient instances.
	   **/
	  BaseClient.Types = {
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

	  BaseClient.Types.SchemaNotFound = SchemaNotFound;

	  /**
	   * Class: RemoteStorage.BaseClient
	   **/
	  BaseClient.prototype.extend({
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
	      BaseClient.Types.declare(this.moduleName, alias, uri, schema);
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
	      var schema = BaseClient.Types.getSchema(object['@context']);
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
	      object['@context'] = BaseClient.Types.resolveAlias(this.moduleName + '/' + alias) || this._defaultTypeURI(alias);
	    }
	  });

	  // Documented in baseclient.js
	  Object.defineProperty(BaseClient.prototype, 'schemas', {
	    configurable: true,
	    get: function() {
	      return BaseClient.Types.inScope(this.moduleName);
	    }
	  });



/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/*
	Author: Geraint Luff and others
	Year: 2013

	This code is released into the "public domain" by its author(s).  Anybody may use, alter and distribute the code without restriction.  The author makes no guarantees, and takes no liability of any kind for use of this code.

	If you find a bug or make an improvement, it would be courteous to let the author know, but it is not compulsory.
	*/
	(function (global, factory) {
	  if (true) {
	    // AMD. Register as an anonymous module.
	    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory), __WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ? (__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
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

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, Buffer) {  // var RemoteStorage = require('./remotestorage');
	  var log = __webpack_require__(4);
	  var util = __webpack_require__(2);
	  var eventHandling = __webpack_require__(3);
	  var Authorize = __webpack_require__(8);

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

	  var isFolder = util.isFolder;
	  var cleanPath = util.cleanPath;

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
	  var WireClient = function (rs) {
	    this.rs = rs;
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
	    eventHandling(this, 'change', 'connected', 'not-connected',
	                           'wire-busy', 'wire-done');

	    onErrorCb = function (error){
	      if (error instanceof Authorize.Unauthorized) {
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

	  WireClient.REQUEST_TIMEOUT = 30000;

	  WireClient.prototype = {
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
	      var self = this;

	      if (token !== Authorize.IMPLIED_FAKE_TOKEN) {
	        headers['Authorization'] = 'Bearer ' + token;
	      }

	      this._emit('wire-busy', {
	        method: method,
	        isFolder: isFolder(uri)
	      });

	      return WireClient.request(method, uri, {
	        body: body,
	        headers: headers,
	        responseType: 'arraybuffer'
	      }).then(function(response) {
	        if (!self.online) {
	          self.online = true;
	          self.rs._emit('network-online');
	        }
	        self._emit('wire-done', {
	          method: method,
	          isFolder: isFolder(uri),
	          success: true
	        });

	        if (isErrorStatus(response.status)) {
	          log('[WireClient] Error response status', response.status);
	          if (getEtag) {
	            revision = stripQuotes(response.getResponseHeader('ETag'));
	          } else {
	            revision = undefined;
	          }
	          return Promise.resolve({statusCode: response.status, revision: revision});
	        } else if (isSuccessStatus(response.status) ||
	                   (response.status === 200 && method !== 'GET')) {
	          revision = stripQuotes(response.getResponseHeader('ETag'));
	          log('[WireClient] Successful request', revision);
	          return Promise.resolve({statusCode: response.status, revision: revision});
	        } else {
	          var mimeType = response.getResponseHeader('Content-Type');
	          if (getEtag) {
	            revision = stripQuotes(response.getResponseHeader('ETag'));
	          } else {
	            revision = response.status === 200 ? fakeRevision : undefined;
	          }

	          var charset = determineCharset(mimeType);

	          if ((!mimeType) || charset === 'binary') {
	            log('[WireClient] Successful request with unknown or binary mime-type', revision);
	            return Promise.resolve({statusCode: response.status, body: response.response, contentType: mimeType, revision: revision});
	          } else {
	            return getTextFromArrayBuffer(response.response, charset).then(function (body) {
	              log('[WireClient] Successful request', revision);
	              return Promise.resolve({statusCode: response.status, body: body, contentType: mimeType, revision: revision});
	            });
	          }
	        }
	      }, function (error) {
	        if (self.online) {
	          self.online = false;
	          self.rs._emit('network-offline');
	        }
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
	  WireClient.cleanPath = cleanPath;

	  // Shared isArrayBufferView used by WireClient and Dropbox
	  WireClient.isArrayBufferView = isArrayBufferView;

	  WireClient.readBinaryData = readBinaryData;

	  // Shared request function used by WireClient, GoogleDrive and Dropbox.
	  WireClient.request = function (method, url, options) {
	    var pending = Promise.defer();
	    log('[WireClient]', method, url);

	    var timedOut = false;

	    var timer = setTimeout(function () {
	      timedOut = true;
	      pending.reject('timeout');
	    }, WireClient.REQUEST_TIMEOUT);

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

	  Object.defineProperty(WireClient.prototype, 'storageType', {
	    get: function () {
	      if (this.storageApi) {
	        var spec = this.storageApi.match(/draft-dejong-(remotestorage-\d\d)/);
	        return spec ? spec[1] : '2012.04';
	      }
	    }
	  });


	  WireClient._rs_init = function (remoteStorage) {
	    hasLocalStorage = util.localStorageAvailable();
	    remoteStorage.remote = new WireClient(remoteStorage);
	    this.online = true;
	  };

	  WireClient._rs_supported = function () {
	    return !! global.XMLHttpRequest;
	  };

	  WireClient._rs_cleanup = function (remoteStorage){
	    if (hasLocalStorage){
	      delete localStorage[SETTINGS_KEY];
	    }
	    remoteStorage.removeEventListener('error', onErrorCb);
	  };


	  module.exports = WireClient;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(14).Buffer))

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(Buffer, global) {/*!
	 * The buffer module from node.js, for the browser.
	 *
	 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
	 * @license  MIT
	 */
	/* eslint-disable no-proto */

	'use strict'

	var base64 = __webpack_require__(15)
	var ieee754 = __webpack_require__(16)
	var isArray = __webpack_require__(17)

	exports.Buffer = Buffer
	exports.SlowBuffer = SlowBuffer
	exports.INSPECT_MAX_BYTES = 50

	/**
	 * If `Buffer.TYPED_ARRAY_SUPPORT`:
	 *   === true    Use Uint8Array implementation (fastest)
	 *   === false   Use Object implementation (most compatible, even IE6)
	 *
	 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
	 * Opera 11.6+, iOS 4.2+.
	 *
	 * Due to various browser bugs, sometimes the Object implementation will be used even
	 * when the browser supports typed arrays.
	 *
	 * Note:
	 *
	 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
	 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
	 *
	 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
	 *
	 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
	 *     incorrect length in some situations.

	 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
	 * get the Object implementation, which is slower but behaves correctly.
	 */
	Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
	  ? global.TYPED_ARRAY_SUPPORT
	  : typedArraySupport()

	/*
	 * Export kMaxLength after typed array support is determined.
	 */
	exports.kMaxLength = kMaxLength()

	function typedArraySupport () {
	  try {
	    var arr = new Uint8Array(1)
	    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
	    return arr.foo() === 42 && // typed array instances can be augmented
	        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
	        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
	  } catch (e) {
	    return false
	  }
	}

	function kMaxLength () {
	  return Buffer.TYPED_ARRAY_SUPPORT
	    ? 0x7fffffff
	    : 0x3fffffff
	}

	function createBuffer (that, length) {
	  if (kMaxLength() < length) {
	    throw new RangeError('Invalid typed array length')
	  }
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = new Uint8Array(length)
	    that.__proto__ = Buffer.prototype
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    if (that === null) {
	      that = new Buffer(length)
	    }
	    that.length = length
	  }

	  return that
	}

	/**
	 * The Buffer constructor returns instances of `Uint8Array` that have their
	 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
	 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
	 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
	 * returns a single octet.
	 *
	 * The `Uint8Array` prototype remains unmodified.
	 */

	function Buffer (arg, encodingOrOffset, length) {
	  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
	    return new Buffer(arg, encodingOrOffset, length)
	  }

	  // Common case.
	  if (typeof arg === 'number') {
	    if (typeof encodingOrOffset === 'string') {
	      throw new Error(
	        'If encoding is specified then the first argument must be a string'
	      )
	    }
	    return allocUnsafe(this, arg)
	  }
	  return from(this, arg, encodingOrOffset, length)
	}

	Buffer.poolSize = 8192 // not used by this implementation

	// TODO: Legacy, not needed anymore. Remove in next major version.
	Buffer._augment = function (arr) {
	  arr.__proto__ = Buffer.prototype
	  return arr
	}

	function from (that, value, encodingOrOffset, length) {
	  if (typeof value === 'number') {
	    throw new TypeError('"value" argument must not be a number')
	  }

	  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
	    return fromArrayBuffer(that, value, encodingOrOffset, length)
	  }

	  if (typeof value === 'string') {
	    return fromString(that, value, encodingOrOffset)
	  }

	  return fromObject(that, value)
	}

	/**
	 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
	 * if value is a number.
	 * Buffer.from(str[, encoding])
	 * Buffer.from(array)
	 * Buffer.from(buffer)
	 * Buffer.from(arrayBuffer[, byteOffset[, length]])
	 **/
	Buffer.from = function (value, encodingOrOffset, length) {
	  return from(null, value, encodingOrOffset, length)
	}

	if (Buffer.TYPED_ARRAY_SUPPORT) {
	  Buffer.prototype.__proto__ = Uint8Array.prototype
	  Buffer.__proto__ = Uint8Array
	  if (typeof Symbol !== 'undefined' && Symbol.species &&
	      Buffer[Symbol.species] === Buffer) {
	    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
	    Object.defineProperty(Buffer, Symbol.species, {
	      value: null,
	      configurable: true
	    })
	  }
	}

	function assertSize (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('"size" argument must be a number')
	  } else if (size < 0) {
	    throw new RangeError('"size" argument must not be negative')
	  }
	}

	function alloc (that, size, fill, encoding) {
	  assertSize(size)
	  if (size <= 0) {
	    return createBuffer(that, size)
	  }
	  if (fill !== undefined) {
	    // Only pay attention to encoding if it's a string. This
	    // prevents accidentally sending in a number that would
	    // be interpretted as a start offset.
	    return typeof encoding === 'string'
	      ? createBuffer(that, size).fill(fill, encoding)
	      : createBuffer(that, size).fill(fill)
	  }
	  return createBuffer(that, size)
	}

	/**
	 * Creates a new filled Buffer instance.
	 * alloc(size[, fill[, encoding]])
	 **/
	Buffer.alloc = function (size, fill, encoding) {
	  return alloc(null, size, fill, encoding)
	}

	function allocUnsafe (that, size) {
	  assertSize(size)
	  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) {
	    for (var i = 0; i < size; ++i) {
	      that[i] = 0
	    }
	  }
	  return that
	}

	/**
	 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
	 * */
	Buffer.allocUnsafe = function (size) {
	  return allocUnsafe(null, size)
	}
	/**
	 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
	 */
	Buffer.allocUnsafeSlow = function (size) {
	  return allocUnsafe(null, size)
	}

	function fromString (that, string, encoding) {
	  if (typeof encoding !== 'string' || encoding === '') {
	    encoding = 'utf8'
	  }

	  if (!Buffer.isEncoding(encoding)) {
	    throw new TypeError('"encoding" must be a valid string encoding')
	  }

	  var length = byteLength(string, encoding) | 0
	  that = createBuffer(that, length)

	  var actual = that.write(string, encoding)

	  if (actual !== length) {
	    // Writing a hex string, for example, that contains invalid characters will
	    // cause everything after the first invalid character to be ignored. (e.g.
	    // 'abxxcd' will be treated as 'ab')
	    that = that.slice(0, actual)
	  }

	  return that
	}

	function fromArrayLike (that, array) {
	  var length = array.length < 0 ? 0 : checked(array.length) | 0
	  that = createBuffer(that, length)
	  for (var i = 0; i < length; i += 1) {
	    that[i] = array[i] & 255
	  }
	  return that
	}

	function fromArrayBuffer (that, array, byteOffset, length) {
	  array.byteLength // this throws if `array` is not a valid ArrayBuffer

	  if (byteOffset < 0 || array.byteLength < byteOffset) {
	    throw new RangeError('\'offset\' is out of bounds')
	  }

	  if (array.byteLength < byteOffset + (length || 0)) {
	    throw new RangeError('\'length\' is out of bounds')
	  }

	  if (byteOffset === undefined && length === undefined) {
	    array = new Uint8Array(array)
	  } else if (length === undefined) {
	    array = new Uint8Array(array, byteOffset)
	  } else {
	    array = new Uint8Array(array, byteOffset, length)
	  }

	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = array
	    that.__proto__ = Buffer.prototype
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    that = fromArrayLike(that, array)
	  }
	  return that
	}

	function fromObject (that, obj) {
	  if (Buffer.isBuffer(obj)) {
	    var len = checked(obj.length) | 0
	    that = createBuffer(that, len)

	    if (that.length === 0) {
	      return that
	    }

	    obj.copy(that, 0, 0, len)
	    return that
	  }

	  if (obj) {
	    if ((typeof ArrayBuffer !== 'undefined' &&
	        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
	      if (typeof obj.length !== 'number' || isnan(obj.length)) {
	        return createBuffer(that, 0)
	      }
	      return fromArrayLike(that, obj)
	    }

	    if (obj.type === 'Buffer' && isArray(obj.data)) {
	      return fromArrayLike(that, obj.data)
	    }
	  }

	  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
	}

	function checked (length) {
	  // Note: cannot use `length < kMaxLength()` here because that fails when
	  // length is NaN (which is otherwise coerced to zero.)
	  if (length >= kMaxLength()) {
	    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
	                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
	  }
	  return length | 0
	}

	function SlowBuffer (length) {
	  if (+length != length) { // eslint-disable-line eqeqeq
	    length = 0
	  }
	  return Buffer.alloc(+length)
	}

	Buffer.isBuffer = function isBuffer (b) {
	  return !!(b != null && b._isBuffer)
	}

	Buffer.compare = function compare (a, b) {
	  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
	    throw new TypeError('Arguments must be Buffers')
	  }

	  if (a === b) return 0

	  var x = a.length
	  var y = b.length

	  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
	    if (a[i] !== b[i]) {
	      x = a[i]
	      y = b[i]
	      break
	    }
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	}

	Buffer.isEncoding = function isEncoding (encoding) {
	  switch (String(encoding).toLowerCase()) {
	    case 'hex':
	    case 'utf8':
	    case 'utf-8':
	    case 'ascii':
	    case 'latin1':
	    case 'binary':
	    case 'base64':
	    case 'ucs2':
	    case 'ucs-2':
	    case 'utf16le':
	    case 'utf-16le':
	      return true
	    default:
	      return false
	  }
	}

	Buffer.concat = function concat (list, length) {
	  if (!isArray(list)) {
	    throw new TypeError('"list" argument must be an Array of Buffers')
	  }

	  if (list.length === 0) {
	    return Buffer.alloc(0)
	  }

	  var i
	  if (length === undefined) {
	    length = 0
	    for (i = 0; i < list.length; ++i) {
	      length += list[i].length
	    }
	  }

	  var buffer = Buffer.allocUnsafe(length)
	  var pos = 0
	  for (i = 0; i < list.length; ++i) {
	    var buf = list[i]
	    if (!Buffer.isBuffer(buf)) {
	      throw new TypeError('"list" argument must be an Array of Buffers')
	    }
	    buf.copy(buffer, pos)
	    pos += buf.length
	  }
	  return buffer
	}

	function byteLength (string, encoding) {
	  if (Buffer.isBuffer(string)) {
	    return string.length
	  }
	  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
	      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
	    return string.byteLength
	  }
	  if (typeof string !== 'string') {
	    string = '' + string
	  }

	  var len = string.length
	  if (len === 0) return 0

	  // Use a for loop to avoid recursion
	  var loweredCase = false
	  for (;;) {
	    switch (encoding) {
	      case 'ascii':
	      case 'latin1':
	      case 'binary':
	        return len
	      case 'utf8':
	      case 'utf-8':
	      case undefined:
	        return utf8ToBytes(string).length
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return len * 2
	      case 'hex':
	        return len >>> 1
	      case 'base64':
	        return base64ToBytes(string).length
	      default:
	        if (loweredCase) return utf8ToBytes(string).length // assume utf8
	        encoding = ('' + encoding).toLowerCase()
	        loweredCase = true
	    }
	  }
	}
	Buffer.byteLength = byteLength

	function slowToString (encoding, start, end) {
	  var loweredCase = false

	  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
	  // property of a typed array.

	  // This behaves neither like String nor Uint8Array in that we set start/end
	  // to their upper/lower bounds if the value passed is out of range.
	  // undefined is handled specially as per ECMA-262 6th Edition,
	  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
	  if (start === undefined || start < 0) {
	    start = 0
	  }
	  // Return early if start > this.length. Done here to prevent potential uint32
	  // coercion fail below.
	  if (start > this.length) {
	    return ''
	  }

	  if (end === undefined || end > this.length) {
	    end = this.length
	  }

	  if (end <= 0) {
	    return ''
	  }

	  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
	  end >>>= 0
	  start >>>= 0

	  if (end <= start) {
	    return ''
	  }

	  if (!encoding) encoding = 'utf8'

	  while (true) {
	    switch (encoding) {
	      case 'hex':
	        return hexSlice(this, start, end)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Slice(this, start, end)

	      case 'ascii':
	        return asciiSlice(this, start, end)

	      case 'latin1':
	      case 'binary':
	        return latin1Slice(this, start, end)

	      case 'base64':
	        return base64Slice(this, start, end)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return utf16leSlice(this, start, end)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = (encoding + '').toLowerCase()
	        loweredCase = true
	    }
	  }
	}

	// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
	// Buffer instances.
	Buffer.prototype._isBuffer = true

	function swap (b, n, m) {
	  var i = b[n]
	  b[n] = b[m]
	  b[m] = i
	}

	Buffer.prototype.swap16 = function swap16 () {
	  var len = this.length
	  if (len % 2 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 16-bits')
	  }
	  for (var i = 0; i < len; i += 2) {
	    swap(this, i, i + 1)
	  }
	  return this
	}

	Buffer.prototype.swap32 = function swap32 () {
	  var len = this.length
	  if (len % 4 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 32-bits')
	  }
	  for (var i = 0; i < len; i += 4) {
	    swap(this, i, i + 3)
	    swap(this, i + 1, i + 2)
	  }
	  return this
	}

	Buffer.prototype.swap64 = function swap64 () {
	  var len = this.length
	  if (len % 8 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 64-bits')
	  }
	  for (var i = 0; i < len; i += 8) {
	    swap(this, i, i + 7)
	    swap(this, i + 1, i + 6)
	    swap(this, i + 2, i + 5)
	    swap(this, i + 3, i + 4)
	  }
	  return this
	}

	Buffer.prototype.toString = function toString () {
	  var length = this.length | 0
	  if (length === 0) return ''
	  if (arguments.length === 0) return utf8Slice(this, 0, length)
	  return slowToString.apply(this, arguments)
	}

	Buffer.prototype.equals = function equals (b) {
	  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
	  if (this === b) return true
	  return Buffer.compare(this, b) === 0
	}

	Buffer.prototype.inspect = function inspect () {
	  var str = ''
	  var max = exports.INSPECT_MAX_BYTES
	  if (this.length > 0) {
	    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
	    if (this.length > max) str += ' ... '
	  }
	  return '<Buffer ' + str + '>'
	}

	Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
	  if (!Buffer.isBuffer(target)) {
	    throw new TypeError('Argument must be a Buffer')
	  }

	  if (start === undefined) {
	    start = 0
	  }
	  if (end === undefined) {
	    end = target ? target.length : 0
	  }
	  if (thisStart === undefined) {
	    thisStart = 0
	  }
	  if (thisEnd === undefined) {
	    thisEnd = this.length
	  }

	  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
	    throw new RangeError('out of range index')
	  }

	  if (thisStart >= thisEnd && start >= end) {
	    return 0
	  }
	  if (thisStart >= thisEnd) {
	    return -1
	  }
	  if (start >= end) {
	    return 1
	  }

	  start >>>= 0
	  end >>>= 0
	  thisStart >>>= 0
	  thisEnd >>>= 0

	  if (this === target) return 0

	  var x = thisEnd - thisStart
	  var y = end - start
	  var len = Math.min(x, y)

	  var thisCopy = this.slice(thisStart, thisEnd)
	  var targetCopy = target.slice(start, end)

	  for (var i = 0; i < len; ++i) {
	    if (thisCopy[i] !== targetCopy[i]) {
	      x = thisCopy[i]
	      y = targetCopy[i]
	      break
	    }
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	}

	// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
	// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
	//
	// Arguments:
	// - buffer - a Buffer to search
	// - val - a string, Buffer, or number
	// - byteOffset - an index into `buffer`; will be clamped to an int32
	// - encoding - an optional encoding, relevant is val is a string
	// - dir - true for indexOf, false for lastIndexOf
	function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
	  // Empty buffer means no match
	  if (buffer.length === 0) return -1

	  // Normalize byteOffset
	  if (typeof byteOffset === 'string') {
	    encoding = byteOffset
	    byteOffset = 0
	  } else if (byteOffset > 0x7fffffff) {
	    byteOffset = 0x7fffffff
	  } else if (byteOffset < -0x80000000) {
	    byteOffset = -0x80000000
	  }
	  byteOffset = +byteOffset  // Coerce to Number.
	  if (isNaN(byteOffset)) {
	    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
	    byteOffset = dir ? 0 : (buffer.length - 1)
	  }

	  // Normalize byteOffset: negative offsets start from the end of the buffer
	  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
	  if (byteOffset >= buffer.length) {
	    if (dir) return -1
	    else byteOffset = buffer.length - 1
	  } else if (byteOffset < 0) {
	    if (dir) byteOffset = 0
	    else return -1
	  }

	  // Normalize val
	  if (typeof val === 'string') {
	    val = Buffer.from(val, encoding)
	  }

	  // Finally, search either indexOf (if dir is true) or lastIndexOf
	  if (Buffer.isBuffer(val)) {
	    // Special case: looking for empty string/buffer always fails
	    if (val.length === 0) {
	      return -1
	    }
	    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
	  } else if (typeof val === 'number') {
	    val = val & 0xFF // Search for a byte value [0-255]
	    if (Buffer.TYPED_ARRAY_SUPPORT &&
	        typeof Uint8Array.prototype.indexOf === 'function') {
	      if (dir) {
	        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
	      } else {
	        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
	      }
	    }
	    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
	  }

	  throw new TypeError('val must be string, number or Buffer')
	}

	function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
	  var indexSize = 1
	  var arrLength = arr.length
	  var valLength = val.length

	  if (encoding !== undefined) {
	    encoding = String(encoding).toLowerCase()
	    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
	        encoding === 'utf16le' || encoding === 'utf-16le') {
	      if (arr.length < 2 || val.length < 2) {
	        return -1
	      }
	      indexSize = 2
	      arrLength /= 2
	      valLength /= 2
	      byteOffset /= 2
	    }
	  }

	  function read (buf, i) {
	    if (indexSize === 1) {
	      return buf[i]
	    } else {
	      return buf.readUInt16BE(i * indexSize)
	    }
	  }

	  var i
	  if (dir) {
	    var foundIndex = -1
	    for (i = byteOffset; i < arrLength; i++) {
	      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
	        if (foundIndex === -1) foundIndex = i
	        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
	      } else {
	        if (foundIndex !== -1) i -= i - foundIndex
	        foundIndex = -1
	      }
	    }
	  } else {
	    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
	    for (i = byteOffset; i >= 0; i--) {
	      var found = true
	      for (var j = 0; j < valLength; j++) {
	        if (read(arr, i + j) !== read(val, j)) {
	          found = false
	          break
	        }
	      }
	      if (found) return i
	    }
	  }

	  return -1
	}

	Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
	  return this.indexOf(val, byteOffset, encoding) !== -1
	}

	Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
	}

	Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
	}

	function hexWrite (buf, string, offset, length) {
	  offset = Number(offset) || 0
	  var remaining = buf.length - offset
	  if (!length) {
	    length = remaining
	  } else {
	    length = Number(length)
	    if (length > remaining) {
	      length = remaining
	    }
	  }

	  // must be an even number of digits
	  var strLen = string.length
	  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

	  if (length > strLen / 2) {
	    length = strLen / 2
	  }
	  for (var i = 0; i < length; ++i) {
	    var parsed = parseInt(string.substr(i * 2, 2), 16)
	    if (isNaN(parsed)) return i
	    buf[offset + i] = parsed
	  }
	  return i
	}

	function utf8Write (buf, string, offset, length) {
	  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
	}

	function asciiWrite (buf, string, offset, length) {
	  return blitBuffer(asciiToBytes(string), buf, offset, length)
	}

	function latin1Write (buf, string, offset, length) {
	  return asciiWrite(buf, string, offset, length)
	}

	function base64Write (buf, string, offset, length) {
	  return blitBuffer(base64ToBytes(string), buf, offset, length)
	}

	function ucs2Write (buf, string, offset, length) {
	  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
	}

	Buffer.prototype.write = function write (string, offset, length, encoding) {
	  // Buffer#write(string)
	  if (offset === undefined) {
	    encoding = 'utf8'
	    length = this.length
	    offset = 0
	  // Buffer#write(string, encoding)
	  } else if (length === undefined && typeof offset === 'string') {
	    encoding = offset
	    length = this.length
	    offset = 0
	  // Buffer#write(string, offset[, length][, encoding])
	  } else if (isFinite(offset)) {
	    offset = offset | 0
	    if (isFinite(length)) {
	      length = length | 0
	      if (encoding === undefined) encoding = 'utf8'
	    } else {
	      encoding = length
	      length = undefined
	    }
	  // legacy write(string, encoding, offset, length) - remove in v0.13
	  } else {
	    throw new Error(
	      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
	    )
	  }

	  var remaining = this.length - offset
	  if (length === undefined || length > remaining) length = remaining

	  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
	    throw new RangeError('Attempt to write outside buffer bounds')
	  }

	  if (!encoding) encoding = 'utf8'

	  var loweredCase = false
	  for (;;) {
	    switch (encoding) {
	      case 'hex':
	        return hexWrite(this, string, offset, length)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Write(this, string, offset, length)

	      case 'ascii':
	        return asciiWrite(this, string, offset, length)

	      case 'latin1':
	      case 'binary':
	        return latin1Write(this, string, offset, length)

	      case 'base64':
	        // Warning: maxLength not taken into account in base64Write
	        return base64Write(this, string, offset, length)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return ucs2Write(this, string, offset, length)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = ('' + encoding).toLowerCase()
	        loweredCase = true
	    }
	  }
	}

	Buffer.prototype.toJSON = function toJSON () {
	  return {
	    type: 'Buffer',
	    data: Array.prototype.slice.call(this._arr || this, 0)
	  }
	}

	function base64Slice (buf, start, end) {
	  if (start === 0 && end === buf.length) {
	    return base64.fromByteArray(buf)
	  } else {
	    return base64.fromByteArray(buf.slice(start, end))
	  }
	}

	function utf8Slice (buf, start, end) {
	  end = Math.min(buf.length, end)
	  var res = []

	  var i = start
	  while (i < end) {
	    var firstByte = buf[i]
	    var codePoint = null
	    var bytesPerSequence = (firstByte > 0xEF) ? 4
	      : (firstByte > 0xDF) ? 3
	      : (firstByte > 0xBF) ? 2
	      : 1

	    if (i + bytesPerSequence <= end) {
	      var secondByte, thirdByte, fourthByte, tempCodePoint

	      switch (bytesPerSequence) {
	        case 1:
	          if (firstByte < 0x80) {
	            codePoint = firstByte
	          }
	          break
	        case 2:
	          secondByte = buf[i + 1]
	          if ((secondByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
	            if (tempCodePoint > 0x7F) {
	              codePoint = tempCodePoint
	            }
	          }
	          break
	        case 3:
	          secondByte = buf[i + 1]
	          thirdByte = buf[i + 2]
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
	            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
	              codePoint = tempCodePoint
	            }
	          }
	          break
	        case 4:
	          secondByte = buf[i + 1]
	          thirdByte = buf[i + 2]
	          fourthByte = buf[i + 3]
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
	            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
	              codePoint = tempCodePoint
	            }
	          }
	      }
	    }

	    if (codePoint === null) {
	      // we did not generate a valid codePoint so insert a
	      // replacement char (U+FFFD) and advance only 1 byte
	      codePoint = 0xFFFD
	      bytesPerSequence = 1
	    } else if (codePoint > 0xFFFF) {
	      // encode to utf16 (surrogate pair dance)
	      codePoint -= 0x10000
	      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
	      codePoint = 0xDC00 | codePoint & 0x3FF
	    }

	    res.push(codePoint)
	    i += bytesPerSequence
	  }

	  return decodeCodePointsArray(res)
	}

	// Based on http://stackoverflow.com/a/22747272/680742, the browser with
	// the lowest limit is Chrome, with 0x10000 args.
	// We go 1 magnitude less, for safety
	var MAX_ARGUMENTS_LENGTH = 0x1000

	function decodeCodePointsArray (codePoints) {
	  var len = codePoints.length
	  if (len <= MAX_ARGUMENTS_LENGTH) {
	    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
	  }

	  // Decode in chunks to avoid "call stack size exceeded".
	  var res = ''
	  var i = 0
	  while (i < len) {
	    res += String.fromCharCode.apply(
	      String,
	      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
	    )
	  }
	  return res
	}

	function asciiSlice (buf, start, end) {
	  var ret = ''
	  end = Math.min(buf.length, end)

	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i] & 0x7F)
	  }
	  return ret
	}

	function latin1Slice (buf, start, end) {
	  var ret = ''
	  end = Math.min(buf.length, end)

	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i])
	  }
	  return ret
	}

	function hexSlice (buf, start, end) {
	  var len = buf.length

	  if (!start || start < 0) start = 0
	  if (!end || end < 0 || end > len) end = len

	  var out = ''
	  for (var i = start; i < end; ++i) {
	    out += toHex(buf[i])
	  }
	  return out
	}

	function utf16leSlice (buf, start, end) {
	  var bytes = buf.slice(start, end)
	  var res = ''
	  for (var i = 0; i < bytes.length; i += 2) {
	    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
	  }
	  return res
	}

	Buffer.prototype.slice = function slice (start, end) {
	  var len = this.length
	  start = ~~start
	  end = end === undefined ? len : ~~end

	  if (start < 0) {
	    start += len
	    if (start < 0) start = 0
	  } else if (start > len) {
	    start = len
	  }

	  if (end < 0) {
	    end += len
	    if (end < 0) end = 0
	  } else if (end > len) {
	    end = len
	  }

	  if (end < start) end = start

	  var newBuf
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    newBuf = this.subarray(start, end)
	    newBuf.__proto__ = Buffer.prototype
	  } else {
	    var sliceLen = end - start
	    newBuf = new Buffer(sliceLen, undefined)
	    for (var i = 0; i < sliceLen; ++i) {
	      newBuf[i] = this[i + start]
	    }
	  }

	  return newBuf
	}

	/*
	 * Need to make sure that buffer isn't trying to write out of bounds.
	 */
	function checkOffset (offset, ext, length) {
	  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
	  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
	}

	Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var val = this[offset]
	  var mul = 1
	  var i = 0
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul
	  }

	  return val
	}

	Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    checkOffset(offset, byteLength, this.length)
	  }

	  var val = this[offset + --byteLength]
	  var mul = 1
	  while (byteLength > 0 && (mul *= 0x100)) {
	    val += this[offset + --byteLength] * mul
	  }

	  return val
	}

	Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length)
	  return this[offset]
	}

	Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  return this[offset] | (this[offset + 1] << 8)
	}

	Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  return (this[offset] << 8) | this[offset + 1]
	}

	Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return ((this[offset]) |
	      (this[offset + 1] << 8) |
	      (this[offset + 2] << 16)) +
	      (this[offset + 3] * 0x1000000)
	}

	Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset] * 0x1000000) +
	    ((this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    this[offset + 3])
	}

	Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var val = this[offset]
	  var mul = 1
	  var i = 0
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul
	  }
	  mul *= 0x80

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

	  return val
	}

	Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var i = byteLength
	  var mul = 1
	  var val = this[offset + --i]
	  while (i > 0 && (mul *= 0x100)) {
	    val += this[offset + --i] * mul
	  }
	  mul *= 0x80

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

	  return val
	}

	Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length)
	  if (!(this[offset] & 0x80)) return (this[offset])
	  return ((0xff - this[offset] + 1) * -1)
	}

	Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  var val = this[offset] | (this[offset + 1] << 8)
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	}

	Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  var val = this[offset + 1] | (this[offset] << 8)
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	}

	Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset]) |
	    (this[offset + 1] << 8) |
	    (this[offset + 2] << 16) |
	    (this[offset + 3] << 24)
	}

	Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset] << 24) |
	    (this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    (this[offset + 3])
	}

	Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	  return ieee754.read(this, offset, true, 23, 4)
	}

	Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	  return ieee754.read(this, offset, false, 23, 4)
	}

	Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length)
	  return ieee754.read(this, offset, true, 52, 8)
	}

	Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length)
	  return ieee754.read(this, offset, false, 52, 8)
	}

	function checkInt (buf, value, offset, ext, max, min) {
	  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
	  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	}

	Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1
	    checkInt(this, value, offset, byteLength, maxBytes, 0)
	  }

	  var mul = 1
	  var i = 0
	  this[offset] = value & 0xFF
	  while (++i < byteLength && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1
	    checkInt(this, value, offset, byteLength, maxBytes, 0)
	  }

	  var i = byteLength - 1
	  var mul = 1
	  this[offset + i] = value & 0xFF
	  while (--i >= 0 && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
	  this[offset] = (value & 0xff)
	  return offset + 1
	}

	function objectWriteUInt16 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffff + value + 1
	  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
	    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
	      (littleEndian ? i : 1 - i) * 8
	  }
	}

	Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	  } else {
	    objectWriteUInt16(this, value, offset, true)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8)
	    this[offset + 1] = (value & 0xff)
	  } else {
	    objectWriteUInt16(this, value, offset, false)
	  }
	  return offset + 2
	}

	function objectWriteUInt32 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffffffff + value + 1
	  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
	    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
	  }
	}

	Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset + 3] = (value >>> 24)
	    this[offset + 2] = (value >>> 16)
	    this[offset + 1] = (value >>> 8)
	    this[offset] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, true)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24)
	    this[offset + 1] = (value >>> 16)
	    this[offset + 2] = (value >>> 8)
	    this[offset + 3] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, false)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1)

	    checkInt(this, value, offset, byteLength, limit - 1, -limit)
	  }

	  var i = 0
	  var mul = 1
	  var sub = 0
	  this[offset] = value & 0xFF
	  while (++i < byteLength && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
	      sub = 1
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1)

	    checkInt(this, value, offset, byteLength, limit - 1, -limit)
	  }

	  var i = byteLength - 1
	  var mul = 1
	  var sub = 0
	  this[offset + i] = value & 0xFF
	  while (--i >= 0 && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
	      sub = 1
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
	  if (value < 0) value = 0xff + value + 1
	  this[offset] = (value & 0xff)
	  return offset + 1
	}

	Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	  } else {
	    objectWriteUInt16(this, value, offset, true)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8)
	    this[offset + 1] = (value & 0xff)
	  } else {
	    objectWriteUInt16(this, value, offset, false)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	    this[offset + 2] = (value >>> 16)
	    this[offset + 3] = (value >>> 24)
	  } else {
	    objectWriteUInt32(this, value, offset, true)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
	  if (value < 0) value = 0xffffffff + value + 1
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24)
	    this[offset + 1] = (value >>> 16)
	    this[offset + 2] = (value >>> 8)
	    this[offset + 3] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, false)
	  }
	  return offset + 4
	}

	function checkIEEE754 (buf, value, offset, ext, max, min) {
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	  if (offset < 0) throw new RangeError('Index out of range')
	}

	function writeFloat (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
	  }
	  ieee754.write(buf, value, offset, littleEndian, 23, 4)
	  return offset + 4
	}

	Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, true, noAssert)
	}

	Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, false, noAssert)
	}

	function writeDouble (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
	  }
	  ieee754.write(buf, value, offset, littleEndian, 52, 8)
	  return offset + 8
	}

	Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, true, noAssert)
	}

	Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, false, noAssert)
	}

	// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
	Buffer.prototype.copy = function copy (target, targetStart, start, end) {
	  if (!start) start = 0
	  if (!end && end !== 0) end = this.length
	  if (targetStart >= target.length) targetStart = target.length
	  if (!targetStart) targetStart = 0
	  if (end > 0 && end < start) end = start

	  // Copy 0 bytes; we're done
	  if (end === start) return 0
	  if (target.length === 0 || this.length === 0) return 0

	  // Fatal error conditions
	  if (targetStart < 0) {
	    throw new RangeError('targetStart out of bounds')
	  }
	  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
	  if (end < 0) throw new RangeError('sourceEnd out of bounds')

	  // Are we oob?
	  if (end > this.length) end = this.length
	  if (target.length - targetStart < end - start) {
	    end = target.length - targetStart + start
	  }

	  var len = end - start
	  var i

	  if (this === target && start < targetStart && targetStart < end) {
	    // descending copy from end
	    for (i = len - 1; i >= 0; --i) {
	      target[i + targetStart] = this[i + start]
	    }
	  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
	    // ascending copy from start
	    for (i = 0; i < len; ++i) {
	      target[i + targetStart] = this[i + start]
	    }
	  } else {
	    Uint8Array.prototype.set.call(
	      target,
	      this.subarray(start, start + len),
	      targetStart
	    )
	  }

	  return len
	}

	// Usage:
	//    buffer.fill(number[, offset[, end]])
	//    buffer.fill(buffer[, offset[, end]])
	//    buffer.fill(string[, offset[, end]][, encoding])
	Buffer.prototype.fill = function fill (val, start, end, encoding) {
	  // Handle string cases:
	  if (typeof val === 'string') {
	    if (typeof start === 'string') {
	      encoding = start
	      start = 0
	      end = this.length
	    } else if (typeof end === 'string') {
	      encoding = end
	      end = this.length
	    }
	    if (val.length === 1) {
	      var code = val.charCodeAt(0)
	      if (code < 256) {
	        val = code
	      }
	    }
	    if (encoding !== undefined && typeof encoding !== 'string') {
	      throw new TypeError('encoding must be a string')
	    }
	    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
	      throw new TypeError('Unknown encoding: ' + encoding)
	    }
	  } else if (typeof val === 'number') {
	    val = val & 255
	  }

	  // Invalid ranges are not set to a default, so can range check early.
	  if (start < 0 || this.length < start || this.length < end) {
	    throw new RangeError('Out of range index')
	  }

	  if (end <= start) {
	    return this
	  }

	  start = start >>> 0
	  end = end === undefined ? this.length : end >>> 0

	  if (!val) val = 0

	  var i
	  if (typeof val === 'number') {
	    for (i = start; i < end; ++i) {
	      this[i] = val
	    }
	  } else {
	    var bytes = Buffer.isBuffer(val)
	      ? val
	      : utf8ToBytes(new Buffer(val, encoding).toString())
	    var len = bytes.length
	    for (i = 0; i < end - start; ++i) {
	      this[i + start] = bytes[i % len]
	    }
	  }

	  return this
	}

	// HELPER FUNCTIONS
	// ================

	var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

	function base64clean (str) {
	  // Node strips out invalid characters like \n and \t from the string, base64-js does not
	  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
	  // Node converts strings with length < 2 to ''
	  if (str.length < 2) return ''
	  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
	  while (str.length % 4 !== 0) {
	    str = str + '='
	  }
	  return str
	}

	function stringtrim (str) {
	  if (str.trim) return str.trim()
	  return str.replace(/^\s+|\s+$/g, '')
	}

	function toHex (n) {
	  if (n < 16) return '0' + n.toString(16)
	  return n.toString(16)
	}

	function utf8ToBytes (string, units) {
	  units = units || Infinity
	  var codePoint
	  var length = string.length
	  var leadSurrogate = null
	  var bytes = []

	  for (var i = 0; i < length; ++i) {
	    codePoint = string.charCodeAt(i)

	    // is surrogate component
	    if (codePoint > 0xD7FF && codePoint < 0xE000) {
	      // last char was a lead
	      if (!leadSurrogate) {
	        // no lead yet
	        if (codePoint > 0xDBFF) {
	          // unexpected trail
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	          continue
	        } else if (i + 1 === length) {
	          // unpaired lead
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	          continue
	        }

	        // valid lead
	        leadSurrogate = codePoint

	        continue
	      }

	      // 2 leads in a row
	      if (codePoint < 0xDC00) {
	        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	        leadSurrogate = codePoint
	        continue
	      }

	      // valid surrogate pair
	      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
	    } else if (leadSurrogate) {
	      // valid bmp char, but last char was a lead
	      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	    }

	    leadSurrogate = null

	    // encode utf8
	    if (codePoint < 0x80) {
	      if ((units -= 1) < 0) break
	      bytes.push(codePoint)
	    } else if (codePoint < 0x800) {
	      if ((units -= 2) < 0) break
	      bytes.push(
	        codePoint >> 0x6 | 0xC0,
	        codePoint & 0x3F | 0x80
	      )
	    } else if (codePoint < 0x10000) {
	      if ((units -= 3) < 0) break
	      bytes.push(
	        codePoint >> 0xC | 0xE0,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      )
	    } else if (codePoint < 0x110000) {
	      if ((units -= 4) < 0) break
	      bytes.push(
	        codePoint >> 0x12 | 0xF0,
	        codePoint >> 0xC & 0x3F | 0x80,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      )
	    } else {
	      throw new Error('Invalid code point')
	    }
	  }

	  return bytes
	}

	function asciiToBytes (str) {
	  var byteArray = []
	  for (var i = 0; i < str.length; ++i) {
	    // Node's code seems to be doing this and not & 0x7F..
	    byteArray.push(str.charCodeAt(i) & 0xFF)
	  }
	  return byteArray
	}

	function utf16leToBytes (str, units) {
	  var c, hi, lo
	  var byteArray = []
	  for (var i = 0; i < str.length; ++i) {
	    if ((units -= 2) < 0) break

	    c = str.charCodeAt(i)
	    hi = c >> 8
	    lo = c % 256
	    byteArray.push(lo)
	    byteArray.push(hi)
	  }

	  return byteArray
	}

	function base64ToBytes (str) {
	  return base64.toByteArray(base64clean(str))
	}

	function blitBuffer (src, dst, offset, length) {
	  for (var i = 0; i < length; ++i) {
	    if ((i + offset >= dst.length) || (i >= src.length)) break
	    dst[i + offset] = src[i]
	  }
	  return i
	}

	function isnan (val) {
	  return val !== val // eslint-disable-line no-self-compare
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(14).Buffer, (function() { return this; }())))

/***/ },
/* 15 */
/***/ function(module, exports) {

	'use strict'

	exports.byteLength = byteLength
	exports.toByteArray = toByteArray
	exports.fromByteArray = fromByteArray

	var lookup = []
	var revLookup = []
	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

	var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	for (var i = 0, len = code.length; i < len; ++i) {
	  lookup[i] = code[i]
	  revLookup[code.charCodeAt(i)] = i
	}

	revLookup['-'.charCodeAt(0)] = 62
	revLookup['_'.charCodeAt(0)] = 63

	function placeHoldersCount (b64) {
	  var len = b64.length
	  if (len % 4 > 0) {
	    throw new Error('Invalid string. Length must be a multiple of 4')
	  }

	  // the number of equal signs (place holders)
	  // if there are two placeholders, than the two characters before it
	  // represent one byte
	  // if there is only one, then the three characters before it represent 2 bytes
	  // this is just a cheap hack to not do indexOf twice
	  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
	}

	function byteLength (b64) {
	  // base64 is 4/3 + up to two characters of the original data
	  return b64.length * 3 / 4 - placeHoldersCount(b64)
	}

	function toByteArray (b64) {
	  var i, j, l, tmp, placeHolders, arr
	  var len = b64.length
	  placeHolders = placeHoldersCount(b64)

	  arr = new Arr(len * 3 / 4 - placeHolders)

	  // if there are placeholders, only get up to the last complete 4 chars
	  l = placeHolders > 0 ? len - 4 : len

	  var L = 0

	  for (i = 0, j = 0; i < l; i += 4, j += 3) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
	    arr[L++] = (tmp >> 16) & 0xFF
	    arr[L++] = (tmp >> 8) & 0xFF
	    arr[L++] = tmp & 0xFF
	  }

	  if (placeHolders === 2) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
	    arr[L++] = tmp & 0xFF
	  } else if (placeHolders === 1) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
	    arr[L++] = (tmp >> 8) & 0xFF
	    arr[L++] = tmp & 0xFF
	  }

	  return arr
	}

	function tripletToBase64 (num) {
	  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
	}

	function encodeChunk (uint8, start, end) {
	  var tmp
	  var output = []
	  for (var i = start; i < end; i += 3) {
	    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
	    output.push(tripletToBase64(tmp))
	  }
	  return output.join('')
	}

	function fromByteArray (uint8) {
	  var tmp
	  var len = uint8.length
	  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
	  var output = ''
	  var parts = []
	  var maxChunkLength = 16383 // must be multiple of 3

	  // go through the array every three bytes, we'll deal with trailing stuff later
	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
	    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
	  }

	  // pad the end with zeros, but make sure to not forget the extra bytes
	  if (extraBytes === 1) {
	    tmp = uint8[len - 1]
	    output += lookup[tmp >> 2]
	    output += lookup[(tmp << 4) & 0x3F]
	    output += '=='
	  } else if (extraBytes === 2) {
	    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
	    output += lookup[tmp >> 10]
	    output += lookup[(tmp >> 4) & 0x3F]
	    output += lookup[(tmp << 2) & 0x3F]
	    output += '='
	  }

	  parts.push(output)

	  return parts.join('')
	}


/***/ },
/* 16 */
/***/ function(module, exports) {

	exports.read = function (buffer, offset, isLE, mLen, nBytes) {
	  var e, m
	  var eLen = nBytes * 8 - mLen - 1
	  var eMax = (1 << eLen) - 1
	  var eBias = eMax >> 1
	  var nBits = -7
	  var i = isLE ? (nBytes - 1) : 0
	  var d = isLE ? -1 : 1
	  var s = buffer[offset + i]

	  i += d

	  e = s & ((1 << (-nBits)) - 1)
	  s >>= (-nBits)
	  nBits += eLen
	  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  m = e & ((1 << (-nBits)) - 1)
	  e >>= (-nBits)
	  nBits += mLen
	  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  if (e === 0) {
	    e = 1 - eBias
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen)
	    e = e - eBias
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	}

	exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c
	  var eLen = nBytes * 8 - mLen - 1
	  var eMax = (1 << eLen) - 1
	  var eBias = eMax >> 1
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
	  var i = isLE ? 0 : (nBytes - 1)
	  var d = isLE ? 1 : -1
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

	  value = Math.abs(value)

	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0
	    e = eMax
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2)
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--
	      c *= 2
	    }
	    if (e + eBias >= 1) {
	      value += rt / c
	    } else {
	      value += rt * Math.pow(2, 1 - eBias)
	    }
	    if (value * c >= 2) {
	      e++
	      c /= 2
	    }

	    if (e + eBias >= eMax) {
	      m = 0
	      e = eMax
	    } else if (e + eBias >= 1) {
	      m = (value * c - 1) * Math.pow(2, mLen)
	      e = e + eBias
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
	      e = 0
	    }
	  }

	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

	  e = (e << mLen) | m
	  eLen += mLen
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

	  buffer[offset + i - d] |= s * 128
	}


/***/ },
/* 17 */
/***/ function(module, exports) {

	var toString = {}.toString;

	module.exports = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};


/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	  // var RemoteStorage = require('./remotestorage');
	  var util = __webpack_require__(2);
	  var Env = __webpack_require__(19);
	  var eventHandling = __webpack_require__(3);
	  var log = __webpack_require__(4);
	  var Authorize = __webpack_require__(8);
	  var config = __webpack_require__(5);
	  
	  /* TOFIX */
	  var syncInterval = 10000,
	      backgroundSyncInterval = 60000,
	      isBackground = false;

	  var isFolder = util.isFolder;
	  var isDocument = util.isDocument;
	  var equal = util.equal;
	  var deepClone = util.deepClone;
	  var pathsFromRoot = util.pathsFromRoot;

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
	    var rs = this;

	    function handleVisibilityChange(fg) {
	      var oldValue, newValue;
	      oldValue = rs.getCurrentSyncInterval();
	      isBackground = !fg;
	      newValue = rs.getCurrentSyncInterval();
	      rs._emit('sync-interval-change', {oldValue: oldValue, newValue: newValue});
	    }

	    Env.on("background", function () {
	      handleVisibilityChange(false);
	    });

	    Env.on("foreground", function () {
	      handleVisibilityChange(true);
	    });
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
	  var Sync = function (setLocal, setRemote, setAccess, setCaching) {
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
	    eventHandling(this, 'done', 'req-done');
	    this.caching.onActivate(function (path) {
	      this.addTask(path);
	      this.doTasks();
	    }.bind(this));
	  };

	  Sync.prototype = {

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
	          log('[Sync] WARNING: corrupt node in local cache', node);
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
	            // move pending promises to parent task
	            if (Array.isArray(this._tasks[path]) && this._tasks[path].length) {
	              Array.prototype.push.apply(
	                this._tasks[paths[i]],
	                this._tasks[path]
	              );
	            }
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
	          log('[Sync] Flushing', path);
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
	        log('[Sync] Emitting keep/revert');

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
	          log('[Sync] We have a conflict');

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
	        unAuth:     ((statusCode === 401 && this.remote.token !== Authorize.IMPLIED_FAKE_TOKEN) ||
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
	              log('[Sync] WARNING: Discarding corrupt folder description from server for ' + path);
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
	          error = new Authorize.Unauthorized();
	        } else if (status.networkProblems) {
	          error = new Sync.SyncError('Network request failed.');
	        } else {
	          error = new Error('HTTP response code ' + status.statusCode + ' received.');
	        }

	        return this.dealWithFailure(path, action, status).then(function () {
	          remoteStorageInstance._emit('error', error);
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
	        log('[Sync] wireclient rejects its promise!', task.path, task.action, err);
	        return self.handleResponse(task.path, task.action, {statusCode: 'offline'});
	      })

	      .then(function (completed) {
	        delete self._timeStarted[task.path];
	        delete self._running[task.path];

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
	            log('[Sync] Sync is done! Reschedule?', Object.getOwnPropertyNames(self._tasks).length, self.stopped);
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
	        log('[Sync] Error', err);
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
	          this._timeStarted[path] = this.now();
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



	  var syncCycleCb;
	  var remoteStorageInstance
	  Sync._rs_init = function (remoteStorage) {
	    remoteStorageInstance = remoteStorage
	    syncCycleCb = function () {
	      if (!config.cache) return false
	      log('[Sync] syncCycleCb calling syncCycle');
	      if (Env.isBrowser()) {
	        handleVisibility.bind(remoteStorage)();
	      }
	      if (!remoteStorage.sync) {
	        // Call this now that all other modules are also ready:
	        remoteStorage.sync = new Sync(
	            remoteStorage.local, remoteStorage.remote, remoteStorage.access,
	            remoteStorage.caching);

	        if (remoteStorage.syncStopped) {
	          log('[Sync] Instantiating sync stopped');
	          remoteStorage.sync.stopped = true;
	          delete remoteStorage.syncStopped;
	        }
	      }

	      log('[Sync] syncCycleCb calling syncCycle');
	      remoteStorage.syncCycle();
	    };

	    syncOnConnect = function() {
	      remoteStorage.removeEventListener('connected', syncOnConnect);
	      remoteStorage.startSync();
	    };

	    remoteStorage.on('ready', syncCycleCb);
	    remoteStorage.on('connected', syncOnConnect);
	  };

	  Sync._rs_cleanup = function (remoteStorage) {
	    remoteStorage.stopSync();
	    remoteStorage.removeEventListener('ready', syncCycleCb);
	    remoteStorage.removeEventListener('connected', syncOnConnect);
	    delete remoteStorage.sync;
	  };

	  module.exports = Sync;


/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	  var eventHandling = __webpack_require__(3);
	  
	  var mode = typeof(window) !== 'undefined' ? 'browser' : 'node',
	      env = {},
	      isBackground = false;


	  Env = function () {
	    return env;
	  };

	  Env.isBrowser = function () {
	    return mode === "browser";
	  };

	  Env.isNode = function () {
	    return mode === "node";
	  };

	  Env.goBackground = function () {
	    isBackground = true;
	    Env._emit("background");
	  };

	  Env.goForeground = function () {
	    isBackground = false;
	    Env._emit("foreground");
	  };

	  Env._rs_init = function (remoteStorage) {
	    eventHandling(Env, "background", "foreground");

	    function visibility() {
	      if (document[env.hiddenProperty]) {
	        Env.goBackground();
	      } else {
	        Env.goForeground();
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

	  Env._rs_cleanup = function (remoteStorage) {
	  };


	  module.exports = Env;

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	
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

	  var Authorize = __webpack_require__(8);
	  var WireClient = __webpack_require__(13);
	  var eventHandling = __webpack_require__(3);

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

	  var GoogleDrive = function (remoteStorage, clientId) {

	    eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');

	    this.rs = remoteStorage;
	    this.clientId = clientId;

	    this._fileIdCache = new Cache(60 * 5); // ids expire after 5 minutes (is this a good idea?)
	  };

	  GoogleDrive.prototype = {
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
	      Authorize(this.rs, AUTH_URL, AUTH_SCOPE, String(Authorize.getLocation()), this.clientId);
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
	        var query, fields, data, etagWithoutQuotes, itemsMap;
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
	      var url = BASE_URL + '/drive/v2/about';
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


	    _request: function (method, url, options) {
	      var self = this;

	      if (! options.headers) { options.headers = {}; }
	      options.headers['Authorization'] = 'Bearer ' + self.token;

	      return WireClient.request.call(this, method, url, options).then(function(xhr) {
	        // Google tokens expire from time to time...
	        if (xhr && xhr.status === 401) {
	          self.connect();
	          return;
	        } else {
	          if (!self.online) {
	            self.online = true;
	            self.rs._emit('network-online');
	          }
	          return Promise.resolve(xhr);
	        }
	      }, function(error) {
	        if (self.online) {
	          self.online = false;
	          self.rs._emit('network-offline');
	        }
	        return Promise.reject(error);
	      });
	    }
	  };

	  GoogleDrive._rs_init = function (remoteStorage) {
	    var config = remoteStorage.apiKeys.googledrive;
	    if (config) {
	      remoteStorage.googledrive = new GoogleDrive(remoteStorage, config.clientId);
	      if (remoteStorage.backend === 'googledrive') {
	        remoteStorage._origRemote = remoteStorage.remote;
	        remoteStorage.remote = remoteStorage.googledrive;
	      }
	    }
	  };

	  GoogleDrive._rs_supported = function (rs) {
	    return true;
	  };

	  GoogleDrive._rs_cleanup = function (remoteStorage) {
	    remoteStorage.setBackend(undefined);
	    if (remoteStorage._origRemote) {
	      remoteStorage.remote = remoteStorage._origRemote;
	      delete remoteStorage._origRemote;
	    }
	  };


	  module.exports = GoogleDrive;


/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {  var WebFinger = __webpack_require__(22);
	  var log = __webpack_require__(4);
	  var util = __webpack_require__(2);

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

	  var Discover = function (userAddress) {
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
	        return pending.reject(err);
	      } else if ((typeof response.idx.links.remotestorage !== 'object') ||
	                 (typeof response.idx.links.remotestorage.length !== 'number') ||
	                 (response.idx.links.remotestorage.length <= 0)) {
	        log("[Discover] WebFinger record for " + userAddress + " does not have remotestorage defined in the links section ", JSON.stringify(response.json));
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

	  Discover._rs_init = function (remoteStorage) {
	    hasLocalStorage = util.localStorageAvailable();
	    if (hasLocalStorage) {
	      var settings;
	      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
	      if (settings) {
	        cachedInfo = settings.cache;
	      }
	    }
	  };

	  Discover._rs_supported = function () {
	    haveXMLHttpRequest = !! global.XMLHttpRequest;
	    return haveXMLHttpRequest;
	  };

	  Discover._rs_cleanup = function () {
	    if (hasLocalStorage) {
	      delete localStorage[SETTINGS_KEY];
	    }
	  };


	  module.exports = Discover;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* global define */
	/*!
	 * webfinger.js
	 *   version 2.5.0
	 *   http://github.com/silverbucket/webfinger.js
	 *
	 * Developed and Maintained by:
	 *   Nick Jennings <nick@silverbucket.net> 2012 - 2016
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
	  XMLHttpRequest = __webpack_require__(23).XMLHttpRequest;
	}

	(function (undefined) {

	  // URI to property name map
	  var LINK_URI_MAPS = {
	    'http://webfist.org/spec/rel': 'webfist',
	    'http://webfinger.net/rel/avatar': 'avatar',
	    'remotestorage': 'remotestorage',
	    'http://tools.ietf.org/id/draft-dejong-remotestorage': 'remotestorage',
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
	    'camlistore': []
	  };

	  // list of endpoints to try, fallback from beginning to end.
	  var URIS = ['webfinger', 'host-meta', 'host-meta.json'];

	  function generateErrorObject(obj) {
	    obj.toString = function () {
	      return this.message;
	    };
	    return obj;
	  }

	  // given a URL ensures it's HTTPS.
	  // returns false for null string or non-HTTPS URL.
	  function isSecure(url) {
	    if (typeof url !== 'string') {
	      return false;
	    }
	    var parts = url.split('://');
	    if (parts[0] === 'https') {
	      return true;
	    }
	    return false;
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
	  WebFinger.prototype.__fetchJRD = function (url, errorHandler, sucessHandler) {
	    var self = this;

	    var xhr = new XMLHttpRequest();
	    xhr.timeout = this.config.request_timeout;

	    function __processState() {
	      if (xhr.status === 200) {
	        if (self.__isValidJSON(xhr.responseText)) {
	          return sucessHandler(xhr.responseText);
	        } else {
	          return errorHandler(generateErrorObject({
	            message: 'invalid json',
	            url: url,
	            status: xhr.status
	          }));
	        }
	      } else if (xhr.status === 404) {
	        return errorHandler(generateErrorObject({
	          message: 'resource not found',
	          url: url,
	          status: xhr.status
	        }));
	      } else if ((xhr.status >= 301) && (xhr.status <= 302)) {
	        var location = xhr.getResponseHeader('Location');
	        if (isSecure(location)) {
	          return __makeRequest(location); // follow redirect
	        } else {
	          return errorHandler(generateErrorObject({
	            message: 'no redirect URL found',
	            url: url,
	            status: xhr.status
	          }));
	        }
	      } else {
	        return errorHandler(generateErrorObject({
	          message: 'error during request',
	          url: url,
	          status: xhr.status
	        }));
	      }
	    }

	    function __makeRequest() {
	      xhr.onreadystatechange = function () {
	        if (xhr.readyState === 4) {
	          __processState();
	        }
	      };

	      xhr.onload = function () {
	        __processState();
	      };

	      xhr.ontimeout = function () {
	        return errorHandler(generateErrorObject({
	          message: 'request timed out',
	          url: url,
	          status: xhr.status
	        }));
	      };

	      xhr.open('GET', url, true);
	      xhr.setRequestHeader('Accept', 'application/jrd+json, application/json');
	      xhr.send();
	    }

	    return __makeRequest();
	  };

	  WebFinger.prototype.__isValidJSON = function (str) {
	    try {
	      JSON.parse(str);
	    } catch (e) {
	      return false;
	    }
	    return true;
	  };

	  WebFinger.prototype.__isLocalhost = function (host) {
	    var local = /^localhost(\.localdomain)?(\:[0-9]+)?$/;
	    return local.test(host);
	  };

	  // processes JRD object as if it's a webfinger response object
	  // looks for known properties and adds them to profile datat struct.
	  WebFinger.prototype.__processJRD = function (URL, JRD, errorHandler, successHandler) {
	    var parsedJRD = JSON.parse(JRD);
	    if ((typeof parsedJRD !== 'object') ||
	        (typeof parsedJRD.links !== 'object')) {
	      if (typeof parsedJRD.error !== 'undefined') {
	        return errorHandler(generateErrorObject({ message: parsedJRD.error, request: URL }));
	      } else {
	        return errorHandler(generateErrorObject({ message: 'unknown response from server', request: URL }));
	      }
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
	    return successHandler(result);
	  };

	  WebFinger.prototype.lookup = function (address, cb) {
	    if (typeof address !== 'string') {
	      throw new Error('first parameter must be a user address');
	    } else if (typeof cb !== 'function') {
	      throw new Error('second parameter must be a callback');
	    }

	    var self = this;
	    var host = '';
	    if (address.indexOf('://') > -1) {
	      // other uri format
	      host = address.replace(/ /g,'').split('://')[1];
	    } else {
	      // useraddress
	      host = address.replace(/ /g,'').split('@')[1];
	    }
	    var uri_index = 0;      // track which URIS we've tried already
	    var protocol = 'https'; // we use https by default

	    if (self.__isLocalhost(host)) {
	      protocol = 'http';
	    }

	    function __buildURL() {
	      var uri = '';
	      if (! address.split('://')[1]) {
	        // the URI has not been defined, default to acct
	        uri = 'acct:';
	      }
	      return protocol + '://' + host + '/.well-known/' +
	             URIS[uri_index] + '?resource=' + uri + address;
	    }

	    // control flow for failures, what to do in various cases, etc.
	    function __fallbackChecks(err) {
	      if ((self.config.uri_fallback) && (host !== 'webfist.org') && (uri_index !== URIS.length - 1)) { // we have uris left to try
	        uri_index = uri_index + 1;
	        return __call();
	      } else if ((!self.config.tls_only) && (protocol === 'https')) { // try normal http
	        uri_index = 0;
	        protocol = 'http';
	        return __call();
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
	        var URL = __buildURL();
	        self.__fetchJRD(URL, cb, function (data) { // get link to users JRD
	          self.__processJRD(URL, data, cb, function (result) {
	            if ((typeof result.idx.links.webfist === 'object') &&
	                (typeof result.idx.links.webfist[0].href === 'string')) {
	              self.__fetchJRD(result.idx.links.webfist[0].href, cb, function (JRD) {
	                self.__processJRD(URL, JRD, cb, function (result) {
	                  return cb(null, cb);
	                });
	              });
	            }
	          });
	        });
	      } else {
	        return cb(err);
	      }
	    }

	    function __call() {
	      // make request
	      var URL = __buildURL();
	      self.__fetchJRD(URL, __fallbackChecks, function (JRD) {
	        self.__processJRD(URL, JRD, cb, function (result) { cb(null, result); });
	      });
	    }

	    return setTimeout(__call, 0);
	  };

	  WebFinger.prototype.lookupLink = function (address, rel, cb) {
	    if (LINK_PROPERTIES.hasOwnProperty(rel)) {
	      this.lookup(address, function (err, p) {
	        var links  = p.idx.links[rel];
	        if (err) {
	          return cb(err);
	        } else if (links.length === 0) {
	          return cb('no links found with rel="' + rel + '"');
	        } else {
	          return cb(null, links[0]);
	        }
	      });
	    } else {
	      return cb('unsupported rel ' + rel);
	    }
	  };

	  if (typeof window === 'object') {
	    window.WebFinger = WebFinger;
	  } else if (true) {
	    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function () { return WebFinger; }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	  } else {
	    try {
	      module.exports = WebFinger;
	    } catch (e) {}
	  }
	})();



/***/ },
/* 23 */
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_23__;

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	var map = {
		"./access": 25,
		"./access.js": 25,
		"./authorize": 8,
		"./authorize.js": 8,
		"./baseclient": 9,
		"./baseclient.js": 9,
		"./caching": 26,
		"./caching.js": 26,
		"./cachinglayer": 27,
		"./cachinglayer.js": 27,
		"./config": 5,
		"./config.js": 5,
		"./discover": 21,
		"./discover.js": 21,
		"./dropbox": 7,
		"./dropbox.js": 7,
		"./env": 19,
		"./env.js": 19,
		"./eventhandling": 3,
		"./eventhandling.js": 3,
		"./googledrive": 20,
		"./googledrive.js": 20,
		"./i18n": 28,
		"./i18n.js": 28,
		"./indexeddb": 29,
		"./indexeddb.js": 29,
		"./inmemorystorage": 30,
		"./inmemorystorage.js": 30,
		"./localstorage": 31,
		"./localstorage.js": 31,
		"./log": 4,
		"./log.js": 4,
		"./modules": 32,
		"./modules.js": 32,
		"./remotestorage": 1,
		"./remotestorage.js": 1,
		"./sync": 18,
		"./sync.js": 18,
		"./syncedgetputdelete": 6,
		"./syncedgetputdelete.js": 6,
		"./types": 11,
		"./types.js": 11,
		"./util": 2,
		"./util.js": 2,
		"./version": 33,
		"./version.js": 33,
		"./wireclient": 13,
		"./wireclient.js": 13
	};
	function webpackContext(req) {
		return __webpack_require__(webpackContextResolve(req));
	};
	function webpackContextResolve(req) {
		return map[req] || (function() { throw new Error("Cannot find module '" + req + "'.") }());
	};
	webpackContext.keys = function webpackContextKeys() {
		return Object.keys(map);
	};
	webpackContext.resolve = webpackContextResolve;
	module.exports = webpackContext;
	webpackContext.id = 24;


/***/ },
/* 25 */
/***/ function(module, exports) {

	  var SETTINGS_KEY = "remotestorage:access";

	  /**
	   * Class: RemoteStorage.Access
	   *
	   * Keeps track of claimed access and scopes.
	   */
	  var Access = function() {
	    this.reset();
	  };

	  Access.prototype = {

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
	  Object.defineProperty(Access.prototype, 'scopes', {
	    get: function() {
	      return Object.keys(this.scopeModeMap).map(function(key) {
	        return { name: key, mode: this.scopeModeMap[key] };
	      }.bind(this));
	    }
	  });

	  Object.defineProperty(Access.prototype, 'scopeParameter', {
	    get: function() {
	      return this.scopes.map(function(scope) {
	        return this._scopeNameForParameter(scope) + ':' + scope.mode;
	      }.bind(this)).join(' ');
	    }
	  });


	  Access._rs_init = function() {};

	  module.exports = Access;


/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

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

	  var util = __webpack_require__(2);
	  var log = __webpack_require__(4);
	  var SETTINGS_KEY = "remotestorage:caching";

	  var containingFolder = util.containingFolder;

	  var Caching = function () {
	    this.reset();
	  };

	  Caching.prototype = {
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
	      if (!util.isFolder(path)) {
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
	      log('[Caching] Setting activate handler', cb, this.pendingActivations);
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


	  Caching._rs_init = function (remoteStorage) {
	    this._remoteStorage = remoteStorage;
	  };

	module.exports = Caching;


/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	  var util = __webpack_require__(2);
	  var config = __webpack_require__(5);

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

	  var isFolder = util.isFolder;
	  var isDocument = util.isDocument;
	  var deepClone = util.deepClone;
	  var equal = util.equal;

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
	    var path;
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

	  var pathsFromRoot = util.pathsFromRoot;

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
	          log('[Cachinglayer] Error during PUT', nodes, i, e);
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
	      if (config.changeEvents[obj.origin]) {
	        this._emit('change', obj);
	      }
	    },

	    fireInitial: function () {
	      if (!config.changeEvents.local) {
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
	        var equal = util.equal;

	        nodes = _processNodes(paths, nodes);

	        for (var path in nodes) {
	          node = nodes[path];
	          if (equal(node, existingNodes[path])) {
	            delete nodes[path];
	          }
	          else if (isDocument(path)) {
	            if (
	              !equal(node.local.body, node.local.previousBody) ||
	              node.local.contentType !== node.local.previousContentType
	            ) {
	              changeEvents.push({
	                path:           path,
	                origin:         'window',
	                oldValue:       node.local.previousBody,
	                newValue:       node.local.body === false ? undefined : node.local.body,
	                oldContentType: node.local.previousContentType,
	                newContentType: node.local.contentType
	              });
	            }
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
	  var cachingLayer = function (object) {
	    for (var key in methods) {
	      object[key] = methods[key];
	    }
	  };

	  module.exports = cachingLayer;


/***/ },
/* 28 */
/***/ function(module, exports) {

	  /**
	   * Class: I18n
	   *
	   * TODO add documentation
	   **/

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

	var I18n = {

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
	    },

	    _rs_init: function() {
	    }
	  };

	  module.exports = I18n;

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
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

	  var log = __webpack_require__(4);
	  var cachingLayer = __webpack_require__(27);
	  var eventHandling = __webpack_require__(3);
	  var util = __webpack_require__(2);

	  var DB_VERSION = 2;

	  var DEFAULT_DB_NAME = 'remotestorage';
	  var DEFAULT_DB;

	  var IndexedDB = function (database) {
	    this.db = database || DEFAULT_DB;

	    if (!this.db) {
	      log("[IndexedDB] Failed to open DB");
	      return undefined;
	    }

	    cachingLayer(this);
	    eventHandling(this, 'change', 'local-events-done');

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

	  IndexedDB.prototype = {
	    getNodes: function (paths) {
	      var misses = [], fromCache = {};
	      for (var i = 0, len = paths.length; i < len; i++) {
	        if (this.changesQueued[paths[i]] !== undefined) {
	          fromCache[paths[i]] = util.deepClone(this.changesQueued[paths[i]] || undefined);
	        } else if(this.changesRunning[paths[i]] !== undefined) {
	          fromCache[paths[i]] = util.deepClone(this.changesRunning[paths[i]] || undefined);
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

	      log('[IndexedDB] Starting put', nodes, this.putsRunning);

	      for (var path in nodes) {
	        var node = nodes[path];
	        if(typeof(node) === 'object') {
	          try {
	            nodesStore.put(node);
	          } catch(e) {
	            log('[IndexedDB] Error while putting', node, e);
	            throw e;
	          }
	        } else {
	          try {
	            nodesStore.delete(path);
	          } catch(e) {
	            log('[IndexedDB] Error while removing', nodesStore, node, e);
	            throw e;
	          }
	        }
	      }

	      transaction.oncomplete = function () {
	        this.putsRunning--;
	        log('[IndexedDB] Finished put', nodes, this.putsRunning, (new Date().getTime() - startTime)+'ms');
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

	      IndexedDB.clean(this.db.name, function() {
	        IndexedDB.open(dbName, function (err, other) {
	          if (err) {
	            log('[IndexedDB] Error while resetting local storage', err);
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

	  IndexedDB.open = function (name, callback) {
	    var timer = setTimeout(function () {
	      callback("timeout trying to open db");
	    }, 10000);

	    try {
	      var req = indexedDB.open(name, DB_VERSION);

	      req.onerror = function () {
	        log('[IndexedDB] Opening DB failed', req);

	        clearTimeout(timer);
	        callback(req.error);
	      };

	      req.onupgradeneeded = function (event) {
	        var db = req.result;

	        log("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);

	        if (event.oldVersion !== 1) {
	          log("[IndexedDB] Creating object store: nodes");
	          db.createObjectStore('nodes', { keyPath: 'path' });
	        }

	        log("[IndexedDB] Creating object store: changes");

	        db.createObjectStore('changes', { keyPath: 'path' });
	      };

	      req.onsuccess = function () {
	        clearTimeout(timer);

	        // check if all object stores exist
	        var db = req.result;
	        if(!db.objectStoreNames.contains('nodes') || !db.objectStoreNames.contains('changes')) {
	          log("[IndexedDB] Missing object store. Resetting the database.");
	          IndexedDB.clean(name, function() {
	            IndexedDB.open(name, callback);
	          });
	          return;
	        }

	        callback(null, req.result);
	      };
	    } catch(error) {
	      log("[IndexedDB] Failed to open database: " + error);
	      log("[IndexedDB] Resetting database and trying again.");

	      clearTimeout(timer);

	      IndexedDB.clean(name, function() {
	        IndexedDB.open(name, callback);
	      });
	    };
	  };

	  IndexedDB.clean = function (databaseName, callback) {
	    var req = indexedDB.deleteDatabase(databaseName);

	    req.onsuccess = function () {
	      log('[IndexedDB] Done removing DB');
	      callback();
	    };

	    req.onerror = req.onabort = function (evt) {
	      console.error('Failed to remove database "' + databaseName + '"', evt);
	    };
	  };

	  IndexedDB._rs_init = function (remoteStorage) {
	    var pending = Promise.defer();

	    IndexedDB.open(DEFAULT_DB_NAME, function (err, db) {
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

	  IndexedDB._rs_supported = function () {
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
	          check.result.close();
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

	  IndexedDB._rs_cleanup = function (remoteStorage) {
	    var pending = Promise.defer();

	    if (remoteStorage.local) {
	      remoteStorage.local.closeDB();
	    }

	    IndexedDB.clean(DEFAULT_DB_NAME, function () {
	      pending.resolve();
	    });

	    return pending.promise;
	  };


	  module.exports = IndexedDB;
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	  var eventHandling = __webpack_require__(3);
	  var log = __webpack_require__(4);
	  var cachingLayer = __webpack_require__(27);
	  /**
	   * Class: RemoteStorage.InMemoryStorage
	   *
	   * In-memory caching adapter. Used when no IndexedDB or localStorage
	   * available.
	   **/

	  var InMemoryStorage = function () {
	    cachingLayer(this);
	    log('[InMemoryStorage] Registering events');
	    eventHandling(this, 'change', 'local-events-done');

	    this._storage = {};
	  };

	  InMemoryStorage.prototype = {

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

	  InMemoryStorage._rs_init = function () {};

	  InMemoryStorage._rs_supported = function () {
	    // In-memory storage is always supported
	    return true;
	  };

	  InMemoryStorage._rs_cleanup = function () {};

	  module.exports = InMemoryStorage;

/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	  var cachingLayer = __webpack_require__(27)
	  var log = __webpack_require__(4);
	  var eventHandling = __webpack_require__(3);
	  var util = __webpack_require__(2);

	  /**
	   * Class: RemoteStorage.LocalStorage
	   *
	   * localStorage caching adapter. Used when no IndexedDB available.
	   **/

	  var NODES_PREFIX = "remotestorage:cache:nodes:";
	  var CHANGES_PREFIX = "remotestorage:cache:changes:";

	  var LocalStorage = function () {
	    cachingLayer(this);
	    log('[LocalStorage] Registering events');
	    eventHandling(this, 'change', 'local-events-done');
	  };

	  function isRemoteStorageKey(key) {
	    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX ||
	           key.substr(0, CHANGES_PREFIX.length) === CHANGES_PREFIX;
	  }

	  function isNodeKey(key) {
	    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX;
	  }

	  LocalStorage.prototype = {

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

	  LocalStorage._rs_init = function () {};

	  LocalStorage._rs_supported = function () {
	    return util.localStorageAvailable();
	  };

	  // TODO tests missing!
	  LocalStorage._rs_cleanup = function () {
	    var keys = [];

	    for (var i = 0, len = localStorage.length; i < len; i++) {
	      var key = localStorage.key(i);
	      if (isRemoteStorageKey(key)) {
	        keys.push(key);
	      }
	    }

	    keys.forEach(function (key) {
	      log('[LocalStorage] Removing', key);
	      delete localStorage[key];
	    });
	  };

	  module.exports = LocalStorage;


/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	  var RemoteStorage = __webpack_require__(1);
	  var BaseClient = __webpack_require__(9);
	  
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
	      var module = builder(new BaseClient(this, '/' + moduleName + '/'),
	                           new BaseClient(this, '/public/' + moduleName + '/'));
	      return module.exports;
	    } else {
	      throw "Unknown module: " + moduleName;
	    }
	  };

	  RemoteStorage.prototype.defineModule = function (moduleName) {
	    console.log("remoteStorage.defineModule is deprecated, use RemoteStorage.defineModule instead!");
	    RemoteStorage.defineModule.apply(RemoteStorage, arguments);
	  };



/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	var RemoteStorage = __webpack_require__(1)
	RemoteStorage.version = RemoteStorage.prototype.version = {
	  productName: 'remotestorage.js',
	  product: 0,
	  major: 13,
	  minor: 1,
	  postfix: 'pre'
	};

	RemoteStorage.version.toString = function () {
	  return this.productName + ' '
	    + [this.product, this.major, this.minor].join('.')
	    + (this.postfix ? '-' + this.postfix : '');
	};


/***/ }
/******/ ])
});
;