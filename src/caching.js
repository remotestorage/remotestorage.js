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
     * Set the caching strategy for a given path explicitly.
     *
     * Not needed when using <enable>/<disable>.
     *
     * Parameters:
     *   path  - Path to cache
     *   value - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
     *
     * Example:
     *   (start code)
     *   remoteStorage.caching.set('/bookmarks/archive')
     */
    set: function (path, value) {
      if (typeof(path) !== 'string') {
        throw new Error('path should be a string');
      }
      if (typeof(value) === 'undefined') {
        throw new Error("value should be 'FLUSH', 'SEEN', or 'ALL'");
      }

      this._rootPaths[path] = value;

      if (value === 'ALL') {
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

  RemoteStorage.Caching._rs_init = function () {};

})(typeof(window) !== 'undefined' ? window : global);
