(function(global) {
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
    get: function(path) {
      if ((!this.remote.connected) || (this.caching.cachePathReady(path))) {
        return this.local.get(path);
      } else {
        return this.remote.get(path);
      }
    },

    put: function(path, body, contentType) {
      if (shareFirst.bind(this)(path)) {
        //this.local.put(path, body, contentType);
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
      else if (this.caching.cachePath(path)) {
        return this.local.put(path, body, contentType);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
    },

    'delete': function(path) {
      if (this.caching.cachePath(path)) {
        return this.local.delete(path);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path));
      }
    },

    _wrapBusyDone: function(result) {
      this._emit('sync-busy');
      return result.then(function() {
        var promise = promising();
        this._emit('sync-done');
        return promise.fulfill.apply(promise, arguments);
      }.bind(this), function(err) {
        throw err;
      });
    }
  };

  var haveLocalStorage = 'localStorage' in global;

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
     * fired when connected and ready
     **/
    /**
     * Event: disconnected
     *
     * fired after disconnect
     **/
    /**
     * Event: disconnect
     *
     * depricated use disconnected
     **/
    /**
     * Event: conflict
     *
     * fired when a conflict occures
     * TODO: arguments, how does this work
     **/
    /**
     * Event: error
     *
     * fired when an error occures
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
     * fired before webfinger lookpu
     **/
    /**
     * Event: authing
     *
     * fired before redirecting to the authing server
     **/
    /**
     * Event: sync-busy
     *
     * fired when a sync cycle starts
     *
     **/
    /**
     * Event: sync-done
     *
     * fired when a sync cycle completes
     *
     **/

    RemoteStorage.eventHandling(
      this, 'ready', 'disconnected', 'disconnect', 'conflict', 'error',
      'features-loaded', 'connecting', 'authing', 'sync-busy', 'sync-done'
    );

    // pending get/put/delete calls.
    this._pending = [];

    this._setGPD({
      get: this._pendingGPD('get'),
      put: this._pendingGPD('put'),
      delete: this._pendingGPD('delete')
    });

    this._cleanups = [];

    this._pathHandlers = { change: {}, conflict: {} };

    this.apiKeys = {};

    if (haveLocalStorage) {
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
      if (haveLocalStorage) {
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

    onConflict: function(path, handler) {
      if (! this._conflictBound) {
        this.on('features-loaded', function() {
          if (this.local) {
            this.local.on('conflict', this._dispatchEvent.bind(this, 'conflict'));
          }
        }.bind(this));
        this._conflictBound = true;
      }
      if (! this._pathHandlers.conflict[path]) {
        this._pathHandlers.conflict[path] = [];
      }
      this._pathHandlers.conflict[path].push(handler);
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
      if (haveLocalStorage) {
        localStorage['remotestorage:api-keys'] = JSON.stringify(this.apiKeys);
      }
    },

    /**
     ** INITIALIZATION
     **/

    _init: function() {
      this._loadFeatures(function(features) {
        var readyFired = false;
        this.log('all features loaded');
        this.local = features.local && new features.local();
        // (this.remote set by WireClient._rs_init
        //  as lazy property on RS.prototype)

        if (this.local && this.remote) {
          this._setGPD(SyncedGetPutDelete, this);
          this._bindChange(this.local);
        } else if (this.remote) {
          this._setGPD(this.remote, this.remote);
        }

        if (this.remote) {
          this.remote.on('connected', function() {
            try {
              if(!readyFired) {
                this._emit('ready');
                readyFired = true;
              }
            } catch(e) {
              console.error("'ready' failed: ", e, e.stack);
              this._emit('error', e);
            }
          }.bind(this));
          if (this.remote.connected) {
            try {
              if(!readyFired) {
                this._emit('ready');
                readyFired = true;
              }
            } catch(e) {
              console.error("'ready' failed: ", e, e.stack);
              this._emit('error', e);
            }
          }
        }

        var fl = features.length;
        for(var i=0;i<fl;i++) {
          var cleanup = features[i].cleanup;
          if (cleanup) {
            this._cleanups.push(cleanup);
          }
        }

        try {
          this._allLoaded = true;
          this._emit('features-loaded');
        } catch(exc) {
          console.error("remoteStorage#ready block failed: ");
          if (typeof(exc) === 'string') {
            console.error(exc);
          } else {
            console.error(exc.message, exc.stack);
          }
          this._emit('error', exc);
        }
        this._processPending();
      });
    },

    /**
     ** FEATURE DETECTION
     **/
    _loadFeatures: function(callback) {
      var features = [
        'WireClient',
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
        'BaseClient'
      ];
      var theFeatures = [];
      var n = features.length, i = 0;
      var self = this;
      function doneNow() {
        i++;
        if(i === n) {
          setTimeout(function() {
            theFeatures.caching = !!RemoteStorage.Caching;
            theFeatures.sync = !!RemoteStorage.Sync;
            [
              'IndexedDB',
              'LocalStorage',
              'InMemoryStorage'
            ].some(function(cachingLayer) {
              if ( theFeatures.some( function(feature) {
                return feature.name === cachingLayer;
              } )
                 ) {
                theFeatures.local = RemoteStorage[cachingLayer];
                return true;
              }
            });
            self.features = theFeatures;
            callback.apply(self, [theFeatures]);
          }, 0);
        }
      }

      function featureDoneCb(name) {
        return function() {
          self.log("[FEATURE " + name + "] initialized. (" + (i+1) + "/" + n + ")");
          theFeatures.push( {
            name : name,
            init :  RemoteStorage[name]._rs_init,
            supported : true,
            cleanup : RemoteStorage[name]._rs_cleanup
          } );
          doneNow();
        };
      }

      function featureFailedCb(name) {
        return function(err) {
          self.log("[FEATURE "+name+"] initialization failed ( "+err+")");
          //self.features
          doneNow();
        };
      }

      function featureSupportedCb(name) {
        return function( success ) {
          self.log("[FEATURE "+name+"]" + success ? "":" not"+" supported");
          if(!success) {
            doneNow();
          }
        };
      }

      features.forEach(function(featureName) {
        self.log("[FEATURE " + featureName + "] initializing...");
        var impl = RemoteStorage[featureName];
        var cb = featureDoneCb(featureName);
        var failedCb = featureFailedCb(featureName);
        var supportedCb = featureSupportedCb(featureName);
        if( impl && (
            ( impl._rs_supported && impl._rs_supported() ) ||
            ( !impl._rs_supported )) ) {
          supportedCb(true);
          var initResult;
          try {
            initResult = impl._rs_init(self);
          } catch(e) {
            failedCb(e);
            return;
          }
          if(typeof(initResult) === 'object' && typeof(initResult.then) === 'function') {
            initResult.then(cb,failedCb);
          } else {
            cb();
          }
        } else {
          supportedCb(false);
        }
      });
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
      for(var path in this._pathHandlers[eventName]) {
        var pl = path.length;
        var self = this;
        this._pathHandlers[eventName][path].forEach(function(handler) {
          if (event.path.substr(0, pl) === path) {
            var ev = {};
            for(var key in event) { ev[key] = event[key]; }
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

  global.RemoteStorage = RemoteStorage;

})(typeof(window) !== 'undefined' ? window : global);
