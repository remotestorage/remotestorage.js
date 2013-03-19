define([
  '../util'
], function(util) {
  

  /**
   * Class: FallbackStore
   *
   * Handles temporary errors (such as due to network outage) in a remote store,
   * by keeping track of failed requests and re-trying them once the connection
   * comes back.
   *
   * Parameters:
   *   remote  - a Store object considered as 'remote'. This is where requests are
   *             usually forwarded to.
   *   cache   - a local Store used to keep track of failed requests.
   *   caching - the Caching settings object used by Sync (or an empty Caching
   *             object if Sync is not being used). Caching is required to know
   *             which paths are cached. For paths that aren't cached, the request
   *             cannot be replayed later (we could keep a copy, but one reason for
   *             not using caching would be that the data is too large to cache 
   *             locally so that would lead us to other problems), so instead the
   *             error is propagated as if the FallbackStore didn't exist.
   */
  var FallbackStore = function(remote, cache, caching) {
    this.remote = remote;
    this.cache = cache;
    this.caching = caching;

    /**
     * Property: state
     * Currently equal to the state of the 'remote' store
     */
    this.__defineGetter__('state', function() {
      return this.remote.state;
    });
  };

  FallbackStore.prototype = {

    /**
     * Method: get
     * See <Store.get>
     */
    get: function(path) {
      return this.remote.get(path).
        then(undefined, function(error) {
          if(this.caching.cachePath(path)) {
            return this.local.get(path);
          } else {
            throw error;
          }
        }.bind(this));
    },
    
    /**
     * Method: set
     * See <Store.set>
     */
    set: function(path, node) {
      return this.remote.set(path, node).
        then(undefined, function(error) {
          if(this.caching.cachePath(path)) {
            return this.cache
          } else {
            throw error;
          }
        }.bind(this));
    },

    /**
     * Method: remove
     * See <Store.remove>
     */
    remove: function(path) {
      return this.remote.remove(path).
        then(undefined, function(error) {
          if(this.caching.cachePath(path)) {
            return this.local.remove(path, true);
          } else {
            throw error;
          }
        }.bind(this));
    },

    /**
     * Method: configure
     * Forwarded to <RemoteStore.configure>
     */
    configure: function(config) {
      this.remote.configure(config);
    },

    /**
     * Method: reset
     * Forwarded to <RemoteStore.reset>
     */
    reset: function() {
      this.remote.reset();
    }
  };

  return FallbackStore;

});
