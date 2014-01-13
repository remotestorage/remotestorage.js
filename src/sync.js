(function(global) {

  var syncInterval = 10000;

  /**
   * Class: RemoteStorage.Sync
   **/
  RemoteStorage.Sync = {
    /**
     * Method: sync
     **/
    sync: function(remote, local, path) {
      var promise = promising();
      promise.fulfill();
      return promise;
    },
    
    /**
     * Method: syncTree
     **/
    syncTree: function(remote, local, path) {
      var promise = promising();
      promise.fulfill();
      return promise;
    }
  };

  /**
   * Method: getSyncInterval
   *
   * Get the value of the sync interval when application is in the foreground
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getSyncInterval = function() {
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
  RemoteStorage.prototype.setSyncInterval = function(interval) {
    if (typeof(interval) !== 'number') {
      throw interval + " is not a valid sync interval";
    }
    syncInterval = parseInt(interval, 10);
    if (this._syncTimer) {
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), interval);
    }
  };

  var SyncError = function(originalError) {
    var msg = 'Sync failed: ';
    if (typeof(originalError) === 'object' && 'message' in originalError) {
      msg += originalError.message;
    } else {
      msg += originalError;
    }
    this.originalError = originalError;
    Error.apply(this, [msg]);
  };

  SyncError.prototype = Object.create(Error.prototype);

  RemoteStorage.prototype.sync = function() {
    if (! (this.local && this.caching)) {
      throw "Sync requires 'local' and 'caching'!";
    }
    if (! this.remote.connected) {
      return promising().fulfill();
    }
    var roots = this.caching.rootPaths.slice(0);
    var n = roots.length, i = 0;
    var aborted = false;
    var rs = this;

    return promising(function(promise) {
      if (n === 0) {
        return promise.fulfill();
      }
      var path;
      while((path = roots.shift())) {
        (function (path) {
          var cachingState = rs.caching.get(path);
          RemoteStorage.Sync.sync(rs.remote, rs.local, path, cachingState).
            then(function() {
              if (!cachingState.ready) {
                cachingState.ready = true;
                rs.caching.set(path, cachingState);
              }
              if (aborted) { return; }
              i++;
              if (n === i) {
                promise.fulfill();
              }
            }, function(error) {
              rs.caching.set(path, {data: true, ready: true});
              console.error('syncing', path, 'failed:', error);
              if (aborted) { return; }
              aborted = true;
              if (error instanceof RemoteStorage.Unauthorized) {
                rs._emit('error', error);
              } else {
                rs._emit('error', new SyncError(error));
              }
              promise.reject(error);
            });
        })(path);
      }
    });
  };

  RemoteStorage.SyncError = SyncError;

  RemoteStorage.prototype.syncCycle = function() {
    this.sync().then(function() {
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), this.getSyncInterval());
    }.bind(this),
    function(e) {
      console.log('sync error, retrying');
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), this.getSyncInterval());
    }.bind(this));
  };

  RemoteStorage.prototype.stopSync = function() {
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      delete this._syncTimer;
    }
  };

  var syncCycleCb;
  RemoteStorage.Sync._rs_init = function(remoteStorage) {
    syncCycleCb = function() {
      remoteStorage.syncCycle();
    };
    remoteStorage.on('ready', syncCycleCb);
  };

  RemoteStorage.Sync._rs_cleanup = function(remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
  };

})(typeof(window) !== 'undefined' ? window : global);
