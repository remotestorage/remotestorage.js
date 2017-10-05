  /**
   * @class Caching
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

  var util = require('./util');
  var log = require('./log');

  var containingFolder = util.containingFolder;

  var Caching = function () {
    this.reset();
  };

  Caching.prototype = {
    pendingActivations: [],

    /**
     * Configure caching for a given path explicitly.
     *
     * Not needed when using <enable>/<disable>.
     *
     * @param {string} path - Path to cache
     * @param {string} strategy - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
     *
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
     * Enable caching for a given path.
     *
     * Uses caching strategy 'ALL'.
     *
     * @param {string} path - Path to enable caching for
     */
    enable: function (path) {
      this.set(path, 'ALL');
    },

    /**
     * Disable caching for a given path.
     *
     * Uses caching strategy 'FLUSH' (meaning items are only cached until
     * successfully pushed to the remote).
     *
     * @param {string} path - Path to disable caching for
     */
    disable: function (path) {
      this.set(path, 'FLUSH');
    },

    /**
     * Set a callback for when caching is activated for a path.
     *
     * @param {function} callback - Callback function
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
     * Retrieve caching setting for a given path, or its next parent
     * with a caching strategy set.
     *
     * @param {string} path - Path to retrieve setting for
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
     * Reset the state of caching by deleting all caching information.
     **/
    reset: function () {
      this._rootPaths = {};
      this._remoteStorage = null;
    }
  };


  /**
   * Setup function that is called on initialization.
   *
   * @private
   **/
  Caching._rs_init = function (remoteStorage) {
    this._remoteStorage = remoteStorage;
  };

module.exports = Caching;
