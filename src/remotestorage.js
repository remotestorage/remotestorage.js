(function(global) {
  function logError(error) {
    if (typeof(error) === 'string') {
      console.error(error);
    } else {
      console.error(error.message, error.stack);
    }
  }

  function emitUnauthorized(status) {
    var args = Array.prototype.slice.call(arguments);
    if (status === 403  || status === 401) {
      this._emit('error', new RemoteStorage.Unauthorized());
    }
    var p = promising();
    return p.fulfill.apply(p,args);
  }

  function shareFirst(path) {
    return ( this.backend === 'dropbox' &&
             path.match(/^\/public\/.*[^\/]$/) );
  }

  var SyncedGetPutDelete = {
    get: function(path, maxAge) {
      var self = this;
      if (this.local) {
        return this.local.get(path, maxAge);
      } else {
        return this.remote.get(path);
      }
    },

    put: function(path, body, contentType) {
      if (shareFirst.bind(this)(path)) {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
      else if (this.local) {
        return this.local.put(path, body, contentType);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
    },

    'delete': function(path) {
      if (this.local) {
        return this.local.delete(path);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path));
      }
    },

    _wrapBusyDone: function(result) {
      var self = this;
      this._emit('wire-busy');
      return result.then(function() {
        var promise = promising();
        self._emit('wire-done', { success: true });
        return promise.fulfill.apply(promise, arguments);
      }, function(err) {
        self._emit('wire-done', { success: false });
        throw err;
      });
    }
  };

  /**
   * Class: RemoteStorage
   *
   * Constructor for global remoteStorage object.
   *
   * This class primarily contains feature detection code and a global convenience API.
   *
   * Depending on which features are built in, it contains different attributes and
   * functions. See the individual features for more information.
   *
   */
  var RemoteStorage = function() {
    /**
     * Event: ready
     *
     * fired when ready
     **/
    /**
     * Event: not-connected
     *
     * fired when ready, but no storage connected ("anonymous mode")
     **/
    /**
     * Event: connected
     *
     * fired when a remote storage has been connected
     **/
    /**
     * Event: disconnected
     *
     * fired after disconnect
     **/
    /**
     * Event: disconnect
     *
     * deprecated, use disconnected instead
     **/
    /**
     * Event: error
     *
     * fired when an error occurs
     *
     * Arguments:
     * the error
     **/
    /**
     * Event: features-loaded
     *
     * fired when all features are loaded
     **/
    /**
     * Event: connecting
     *
     * fired before webfinger lookup
     **/
    /**
     * Event: authing
     *
     * fired before redirecting to the authing server
     **/
    /**
     * Event: wire-busy
     *
     * fired when a wire request starts
     *
     **/
    /**
     * Event: wire-done
     *
     * fired when a wire request completes
     *
     **/

    RemoteStorage.eventHandling(
      this, 'ready', 'connected', 'disconnected', 'disconnect',
            'not-connected', 'conflict', 'error', 'features-loaded',
            'connecting', 'authing', 'wire-busy', 'wire-done'
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

    this.on = function(eventName, handler) {
      if (eventName === 'ready' && this.remote.connected && this._allLoaded) {
        setTimeout(handler, 0);
      } else if (eventName === 'features-loaded' && this._allLoaded) {
        setTimeout(handler, 0);
      }
      return origOn.call(this, eventName, handler);
    };

    this._init();

    this.on('ready', function() {
      if (this.local) {
        setTimeout(this.local.fireInitial.bind(this.local), 0);
      }
    }.bind(this));
  };

  RemoteStorage.DiscoveryError = function(message) {
    Error.apply(this, arguments);
    this.message = message;
  };

  RemoteStorage.DiscoveryError.prototype = Object.create(Error.prototype);

  RemoteStorage.Unauthorized = function() { Error.apply(this, arguments); };
  RemoteStorage.Unauthorized.prototype = Object.create(Error.prototype);

  /**
   * Method: RemoteStorage.log
   *
   * Logging using console.log, when logging is enabled.
   */
  RemoteStorage.log = function() {
    if (RemoteStorage._log) {
      console.log.apply(console, arguments);
    }
  };


  RemoteStorage.prototype = {
    /**
     ** PUBLIC INTERFACE
     **/

    /**
     * Method: connect
     *
     * Connect to a remotestorage server.
     *
     * Parameters:
     *   userAddress - The user address (user@host) to connect to.
     *
     * Discovers the webfinger profile of the given user address and
     * initiates the OAuth dance.
     *
     * This method must be called *after* all required access has been claimed.
     *
     */
    connect: function(userAddress) {
      this.setBackend('remotestorage');
      if (userAddress.indexOf('@') < 0) {
        this._emit('error', new RemoteStorage.DiscoveryError("User adress doesn't contain an @."));
        return;
      }
      this.remote.configure(userAddress);
      this._emit('connecting');

      var discoveryTimeout = setTimeout(function() {
        this._emit('error', new RemoteStorage.DiscoveryError("No storage information found at that user address."));
      }.bind(this), 5000);

      RemoteStorage.Discover(userAddress, function(href, storageApi, authURL) {
        clearTimeout(discoveryTimeout);
        if (!href) {
          this._emit('error', new RemoteStorage.DiscoveryError("Failed to contact storage server."));
          return;
        }
        this._emit('authing');
        this.remote.configure(userAddress, href, storageApi);
        if (! this.remote.connected) {
          this.authorize(authURL);
        }
      }.bind(this));
    },

    /**
     * Method: disconnect
     *
     * "Disconnect" from remotestorage server to terminate current session.
     * This method clears all stored settings and deletes the entire local cache.
     *
     * Once the disconnect is complete, the "disconnected" event will be fired.
     * From that point on you can connect again (using <connect>).
     */
    disconnect: function() {
      if (this.remote) {
        this.remote.configure(null, null, null, null);
      }
      this._setGPD({
        get: this._pendingGPD('get'),
        put: this._pendingGPD('put'),
        delete: this._pendingGPD('delete')
      });
      var n = this._cleanups.length, i = 0;

      var oneDone = function() {
        i++;
        if (i >= n) {
          this._init();
          RemoteStorage.log('done cleaning up, emitting disconnected and disconnect events');
          this._emit('disconnected');
          this._emit('disconnect');// DEPRECATED?
        }
      }.bind(this);

      if (n > 0) {
        this._cleanups.forEach(function(cleanup) {
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

    setBackend: function(what) {
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
     * Adds a 'change' event handler to the given path.
     * Whenever a 'change' happens (as determined by the backend, such
     * as <RemoteStorage.IndexedDB>) and the affected path is equal to
     * or below the given 'path', the given handler is called.
     *
     * You shouldn't need to use this method directly, but instead use
     * the "change" events provided by <RemoteStorage.BaseClient>.
     *
     * Parameters:
     *   path    - Absolute path to attach handler to.
     *   handler - Handler function.
     */
    onChange: function(path, handler) {
      if (! this._pathHandlers.change[path]) {
        this._pathHandlers.change[path] = [];
      }
      this._pathHandlers.change[path].push(handler);
    },

    /**
     * Method: enableLog
     *
     * enable logging
     */
    enableLog: function() {
      RemoteStorage._log = true;
    },

    /**
     * Method: disableLog
     *
     * disable logging
     */
    disableLog: function() {
      RemoteStorage._log = false;
    },

    /**
     * Method: log
     *
     * The same as <RemoteStorage.log>.
     */
    log: function() {
      RemoteStorage.log.apply(RemoteStorage, arguments);
    },

    setApiKeys: function(type, keys) {
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
     ** INITIALIZATION
     **/

    _init: function() {
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

      this._loadFeatures(function(features) {
        this.log('all features loaded');
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
          this.remote.on('connected', function(){
            fireReady();
            self._emit('connected');
          });
          this.remote.on('not-connected', function(){
            fireReady();
            self._emit('not-connected');
          });
          if (this.remote.connected) {
            fireReady();
            self._emit('connected');
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

    _collectCleanupFunctions: function() {
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
    _loadFeatures: function(callback) {
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
          setTimeout(function() {
            features.caching = !!RemoteStorage.Caching;
            features.sync = !!RemoteStorage.Sync;
            [
              'IndexedDB',
              'LocalStorage',
              'InMemoryStorage'
            ].some(function(cachingLayer) {
              if (features.some(function(feature) { return feature.name === cachingLayer; })) {
                features.local = RemoteStorage[cachingLayer];
                return true;
              }
            });
            self.features = features;
            callback(features);
          }, 0);
        }
      }

      function featureInitializedCb(name) {
        return function() {
          self.log("[FEATURE "+name+"] initialized.");
          features.push( {
            name : name,
            init :  RemoteStorage[name]._rs_init,
            supported : true,
            cleanup : RemoteStorage[name]._rs_cleanup
          } );
          featureDone();
        };
      }

      function featureFailedCb(name) {
        return function(err) {
          self.log("[FEATURE "+name+"] initialization failed ( "+err+")");
          featureDone();
        };
      }

      function featureSupportedCb(name) {
        return function(success) {
          self.log("[FEATURE "+name+"]" + success ? "":" not"+" supported");
          if (!success) {
            featureDone();
          }
        };
      }

      featureList.forEach(function(featureName) {
        self.log("[FEATURE " + featureName + "] initializing...");
        var impl = RemoteStorage[featureName];
        var initializedCb = featureInitializedCb(featureName);
        var failedCb = featureFailedCb(featureName);
        var supportedCb = featureSupportedCb(featureName);

        if (impl && (!impl._rs_supported || impl._rs_supported())) {
          supportedCb(true);
          var initResult;
          try {
            initResult = impl._rs_init(self);
          } catch(e) {
            failedCb(e);
            return;
          }
          if (typeof(initResult) === 'object' && typeof(initResult.then) === 'function') {
            initResult.then(initializedCb, failedCb);
          } else {
            initializedCb();
          }
        } else {
          supportedCb(false);
        }
      });
    },

    localStorageAvailable: function() {
      try {
        return !!global.localStorage;
      } catch(error) {
        return false;
      }
    },

    /**
     ** GET/PUT/DELETE INTERFACE HELPERS
     **/

    _setGPD: function(impl, context) {
      function wrap(f) {
        return function() {
          return f.apply(context, arguments)
            .then(emitUnauthorized.bind(this));
        };
      }
      this.get = wrap(impl.get);
      this.put = wrap(impl.put);
      this.delete = wrap(impl.delete);
    },

    _pendingGPD: function(methodName) {
      return function() {
        var promise = promising();
        this._pending.push({
          method: methodName,
          args: Array.prototype.slice.call(arguments),
          promise: promise
        });
        return promise;
      }.bind(this);
    },

    _processPending: function() {
      this._pending.forEach(function(pending) {
        try {
          this[pending.method].apply(this, pending.args).then(pending.promise.fulfill, pending.promise.reject);
        } catch(e) {
          pending.promise.reject(e);
        }
      }.bind(this));
      this._pending = [];
    },

    /**
     ** CHANGE EVENT HANDLING
     **/

    _bindChange: function(object) {
      object.on('change', this._dispatchEvent.bind(this, 'change'));
    },

    _dispatchEvent: function(eventName, event) {
      for (var path in this._pathHandlers[eventName]) {
        var pl = path.length;
        var self = this;
        this._pathHandlers[eventName][path].forEach(function(handler) {
          if (event.path.substr(0, pl) === path) {
            var ev = {};
            for (var key in event) { ev[key] = event[key]; }
            ev.relativePath = event.path.replace(new RegExp('^' + path), '');
            try {
              handler(ev);
            } catch(e) {
              console.error("'change' handler failed: ", e, e.stack);
              self._emit('error', e);
            }
          }
        });
      }
    }
  };

  /**
   * Method: claimAccess
   *
   * High-level method to claim access on one or multiple scopes and enable
   * caching for them. WARNING: when using Caching control, use remoteStorage.access.claim instead,
   * see https://github.com/remotestorage/remotestorage.js/issues/380
   *
   * Examples:
   *   (start code)
   *     remoteStorage.claimAccess('foo', 'rw');
   *     // is equivalent to:
   *     remoteStorage.claimAccess({ foo: 'rw' });
   *
   *     // is equivalent to:
   *     remoteStorage.access.claim('foo', 'rw');
   *     remoteStorage.caching.enable('/foo/');
   *     remoteStorage.caching.enable('/public/foo/');
   *   (end code)
   */

  /**
   * Property: connected
   *
   * Boolean property indicating if remoteStorage is currently connected.
   */
  Object.defineProperty(RemoteStorage.prototype, 'connected', {
    get: function() {
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
   * (only available when caching is built in)
   *
   *
   * Property: remote
   *
   * Access to the remote backend used. Usually a <RemoteStorage.WireClient>.
   *
   *
   * Property: local
   *
   * Access to the local caching backend used.
   * Only available when caching is built in.
   * Usually either a <RemoteStorage.IndexedDB> or <RemoteStorage.LocalStorage>
   * instance.
   */
    
  /**
   ** reset
   **/
  RemoteStorage.prototype.reset = function() {
    indexedDB.deleteDatabase('remotestorage');
    localStorage.clear();
  };

  global.RemoteStorage = RemoteStorage;

})(typeof(window) !== 'undefined' ? window : global);
