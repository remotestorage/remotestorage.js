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

    delete: function(path) {
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
    RemoteStorage.eventHandling(this, 'ready', 'connected');
    this.get = this.put = this.delete = this._notReady;
    this._loadFeatures(function(features) {
      console.log('all features loaded');
      this.local = features.local && new features.local();
      this.remote = new features.remote();

      if(this.local && this.remote) {
        this._setGPD(SyncedGetPutDelete, this);
      } else if(this.remote) {
        this._setGPD(this.remote, this.remote);
        this._delegateEvent('connected', this.remote);
      }
      
      try {
        this._emit('ready');
      } catch(exc) {
        console.error("remoteStorage#ready block failed: ");
        if(typeof(exc) == 'string') {
          console.error(exc);
        } else {
          console.error(exc.message, exc.stack);
        }
      }
    });
  };

  RemoteStorage.prototype = {

    _detectFeatures: function() {
      // determine availability
      var features = [
        'WireClient',
        'Discover',
        'Authorize',
        'IndexedDB',
        'LocalStorage',
        'Caching',
        'Access',
        'Sync',
        'BaseClient'
      ].map(function(featureName) {
        var impl = RemoteStorage[featureName];
        return {
          name: featureName,
          init: (impl && impl._rs_init),
          supported: impl && (impl._rs_supported ? impl._rs_supported() : true)
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
      features.forEach(function(feature) {
        console.log("[FEATURE " + feature.name + "] initializing...");
        feature.init(self).then(function() {
          i++;
          console.log("[FEATURE " + feature.name + "] initialized. (" + i + "/" + n + ")");
          if(i == n)
            setTimeout(function() {
              callback.apply(self, [features]);
            }, 0);
        });
      });
    },

    _setGPD: function(impl, context) {
      this.get = impl.get.bind(context);
      this.put = impl.put.bind(context);
      this.delete = impl.delete.bind(context);
    },

    _notReady: function() {
      throw "remotestorage not ready!";
    }
  };

  window.RemoteStorage = RemoteStorage;

})();
