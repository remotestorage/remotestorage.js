(function() {

  var SyncedGetPutDelete = {
    get: function(path) {
      if(this.caching.cachePath(path)) {
        return this.local.get(path);
      } else {
        return this.remote.get(path);
      }
    },

    put: function(path, body, contentType) {
      if(this.caching.cachePath(path)) {
        return this.local.put(path, body, contentType).then(function() {
          RemoteStorage.sync.push(this.local, this.remote, path);
        }.bind(this));
      } else {
        return this.remote.put(path, body, contentType);
      }
    },

    'delete': function(path) {
      if(this.caching.cachePath(path)) {
        return this.local.delete(path).then(function() {
          RemoteStorage.sync.push(this.local, this.remote, path);
        }.bind(this));
      } else {
        return this.remote.delete(path);
      }
    }
  }

  var RemoteStorage = function() {
    RemoteStorage.eventHandling(this, 'ready', 'connected', 'disconnected', 'disconnect', 'conflict', 'error');
    // pending get/put/delete calls.
    this._pending = [];
    this._setGPD({
      get: this._pendingGPD('get'),
      put: this._pendingGPD('put'),
      delete: this._pendingGPD('delete')
    });
    this._cleanups = [];
    this._pathHandlers = {};

    this.__defineGetter__('connected', function() {
      return this.remote.connected;
    });

    this._init();
  };

  RemoteStorage.prototype = {

    _init: function() {
      this._loadFeatures(function(features) {
        console.log('all features loaded');
        this.local = features.local && new features.local();
        this.remote = new features.remote();

        if(this.local && this.remote) {
          this._setGPD(SyncedGetPutDelete, this);
          this._bindChange(this.local);
        } else if(this.remote) {
          this._setGPD(this.remote, this.remote);
        }

        if(this.remote) {
          this._delegateEvent('connected', this.remote)
        }

        var fl = features.length;
        for(var i=0;i<fl;i++) {
          var cleanup = features[i].cleanup;
          if(cleanup) {
            this._cleanups.push(cleanup);
          }
        }

        try {
          this._emit('ready');
          this._processPending();
        } catch(exc) {
          console.error("remoteStorage#ready block failed: ");
          if(typeof(exc) == 'string') {
            console.error(exc);
          } else {
            console.error(exc.message, exc.stack);
          }
        }
      });
    },

    _detectFeatures: function() {
      // determine availability
      var features = [
        'WireClient',
        'Access',
        'Caching',
        'Discover',
        'Authorize',
        'IndexedDB',
        'LocalStorage',
        'Sync',
        'BaseClient',
	      'Widget'
      ].map(function(featureName) {
        var impl = RemoteStorage[featureName];
        return {
          name: featureName,
          init: (impl && impl._rs_init),
          supported: impl && (impl._rs_supported ? impl._rs_supported() : true),
          cleanup: ( impl && impl._rs_cleanup )
        };
      }).filter(function(feature) {
        var supported = !! (feature.init && feature.supported);
        console.log("[FEATURE " + feature.name + "] " + (supported ? '' : 'not ') + 'supported.');
        return supported;
      });

      features.local = RemoteStorage.IndexedDB || RemoteStorage.LocalStorage;
      features.remote = RemoteStorage.WireClient;
      features.caching = !!RemoteStorage.Caching;
      features.sync = !!RemoteStorage.Sync;

      this.features = features;

      return features;
    },

    _loadFeatures: function(callback) {
      var features = this._detectFeatures();
      var n = features.length, i = 0;
      var self = this;
      function featureDoneCb(name) {
        return function() {
          i++;
          console.log("[FEATURE " + name + "] initialized. (" + i + "/" + n + ")");
          if(i == n)
            setTimeout(function() {
              callback.apply(self, [features]);
            }, 0);
        }
      }
      features.forEach(function(feature) {
        console.log("[FEATURE " + feature.name + "] initializing...");
        var initResult = feature.init(self);
        var cb = featureDoneCb(feature.name);
        if(typeof(initResult) == 'object' && typeof(initResult.then) == 'function') {
          initResult.then(cb);
        } else {
          cb();
        }
      });
    },

    _setGPD: function(impl, context) {
      this.get = impl.get.bind(context);
      this.put = impl.put.bind(context);
      this.delete = impl.delete.bind(context);
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
        this[pending.method].apply(this, pending.args).then(pending.promise.fulfill, pending.promise.reject);
      }.bind(this));
    },

    _notReady: function() {
      throw "remotestorage not ready!";
    },

    onChange: function(path, handler) {
      if(! this._pathHandlers[path]) {
        this._pathHandlers[path] = [];
      }
      this._pathHandlers[path].push(handler);
    },

    _bindChange: function(object) {
      object.on('change', this._dispatchChange.bind(this));
    },

    _dispatchChange: function(event) {
      console.log('change', event);
      for(var path in this._pathHandlers) {
        var pl = path.length;
        this._pathHandlers[path].forEach(function(handler) {
          if(event.path.substr(0, pl) == path) {
            var ev = {};
            for(var key in event) { ev[key] = event[key]; }
            ev.relativePath = event.path.replace(new RegExp('^' + path), '');
            handler(ev);
          }
        });
      }
    },
    connect : function(userAddress) {
      RemoteStorage.Discover(userAddress,function(href, storageApi, authURL){
        this.remote.configure(href, storageApi);
        this.authorize(authURL);
      }.bind(this));
    },
    disconnect : function() {
      var n = this._cleanups.length, i = 0;
      var oneDone = function() {
        i++;
        if(i == n) {
          this._init();
          this._emit('disconnected');
          this._emit('disconnect');// DEPRECATED?
        }
      }.bind(this);
      this._cleanups.forEach(function(cleanup) {
        var cleanupResult = cleanup(this);
        if(typeof(cleanup) == 'object' && typeof(cleanup.then) == 'function') {
          cleanupResult.then(oneDone);
        } else {
          oneDone();
        }
      }.bind(this));
    }
  };


  
    window.RemoteStorage = RemoteStorage;

})();
