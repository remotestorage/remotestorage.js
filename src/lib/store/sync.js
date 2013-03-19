define([
  './util',
  './store/local',
  './store/remote',
  './store/fallback'
], function(util, LocalStore, RemoteStore, FallbackStore) {

  "use strict";
  
  /**
   * Class: Sync
   * Dispatches requests from betweeen a <LocalStore> and a <RemoteStore> (through a <FallbackStore>),
   * based on <Access> and <Caching> settings.
   *
   * Parameters:
   *   controller - <Controller> instance to get <caching>, <access> and platform instance from.
   */
  var Sync = function(controller) {
    this._remote = new RemoteStore(controller.platform.http);

    /**
     * Property: local
     * A <LocalStore>, backed by controller.platform.localStore.
     */
    this.local = new LocalStore(controller.platform.localStore);

    /**
     * Property: caching
     * Reference to the <Caching> instance from the <Controller>.
     */
    this.caching = controller.caching;

    /**
     * Property: access
     * Reference to the <Access> instance from the <Controller>.
     */
    this.access = controller.access;

    /**
     * Property: remote
     * A <RemoteStore> wrapped in a <FallbackStore>.
     * The RemoteStore is backed by controller.platform.http.
     */
    this.remote = new FallbackStore(this._remote, this.local, this.caching);
  };

  Sync.prototype = {

    /**
     * Method: get
     * Implements <Store.get>
     */
    get: function(path) {
      return (
        this.caching.cachePath(path) ? this.local : this.remote
      ).get(path);
    },

    /**
     * Method: set
     * Implements <Store.set>
     */
    set: function(path, node) {
      if(this.caching.cachePath(path)) {
        return util.asyncGroup(
          util.curry(this.local.set, path, node),
          util.curry(this.remote.set, path, node)
        );
      } else {
        return this.remote.set(path, node);
      }
    },

    /**
     * Method: remove
     * Implements <Store.remove>
     */
    remove: function(path) {
      if(this.caching.cachePath(path)) {
        return util.asyncGroup(
          util.curry(this.local.remove, path),
          util.curry(this.remote.remove, path)
        );
      } else {
        return this.remote.remove(path);
      }
    },

    /**
     * Method: sync
     * Starts a new sync cycle, using <computeSyncSettings> and <syncPath>.
     */
    sync: function() {
      return util.asyncEach(this.computeSyncSettings(), function(settings) {
        return this.syncPath(settings.path, settings.access, settings.caching);
      }.bind(this));
    },

    /**
     * Method: syncPath
     * Starts synchronizing a single path from remote to local, with given
     * caching and access settings.
     * Descends into subdirectories until it finds no more.
     *
     * Parameters:
     *   path       - an absolute path to start syncing
     *   accessMode - A string, either 'r' or 'rw'. (FIXME: why is this there? it isn't used.
     * 
     */
    syncPath: function(path, accessMode, cachingMode) {
      return this.remote.get(path).then(function(node) {
        if(util.isDir(path)) {
          return util.asyncEach(Object.keys(node.data), function(key) {
            if(cachingMode.data || util.isDir(key)) {
              return this.syncPath(path + key);
            } else {
              return this.local.set(path + key, { version: node.data[key] });
            }
          }.bind(this));
        } else {
          return this.local.set(path, node);
        }
      }.bind(this));
    },

    /**
     * Method: computeSyncSettings
     * Assembles a list of paths to start syncing and their access and
     * caching settings by querying <Caching.rootPaths> and <Access.check>.
     *
     * Returns an Array of objects describing paths and their settings:
     *  path    - the path to start syncing at
     *  access  - the access mode
     *  caching - the caching settings (an Object)
     */
    computeSyncSettings: function() {
      var paths = [];
      this.caching.rootPaths.forEach(function(cachingRoot) {
        var mode = this.access.check(util.extractScope(cachingRoot));
        if(mode) {
          paths.push({
            path: cachingRoot,
            access: mode,
            caching: this.caching.get(cachingRoot)
          });
        }
      }.bind(this));
      return paths;
    },

    /**
     * Method: reset
     * Delegated to <remote> (i.e. the FallbackStore, which in turn delegates to the RemoteStore)
     */
    reset: function() {
      this.remote.reset();
      // deprecated!
      return util.getPromise().fulfill();
    }

  };

  return Sync;

});
