/* -*- test-with:unit/caching -*- */

define(['./util'], function(util) {

  "use strict";

  /**
   * Class: Caching
   *
   * Handles caching settings.
   *
   * How does this work?:
   * - <Caching> holds a list of paths and their corresponding caching settings.
   * - <get>, <set> and <remove> operate on this list of paths.
   * - <descendIntoPath> can then tell you if a sync process should descend into the
   *   given path or ignore it.
   * - <cachePath> can then tell the sync process whether a given file or directory
   *   node should be cached locally or only pushed to remote.
   * - <descendIntoPath> and <cachePath> can operate on arbitrary paths and match them
   *   with the list of configured path to figure out ideal settings.
   */
  var Caching = function() {
    this.reset();
  };

  Caching.prototype = {

    /**
     * Property: rootPaths
     *
     * An Array of paths to give <Sync> a place to start.
     */

    /**
     ** configuration methods
     **/

    /**
     * Method: get
     * Retrieve settings for given path.
     */
    get: function(path) {
      this._validateDirPath(path);
      return this._pathSettingsMap[path];
    },

    /**
     * Method: set
     * Update caching settings for given path.
     */
    set: function(path, settings) {
      this._validateDirPath(path);
      if(typeof(settings) !== 'object') {
        throw new Error("settings is required");
      }
      this._pathSettingsMap[path] = settings;
      this._updateRoots();
    },

    /**
     * Method: remove
     * Remove all caching settings from given path.
     */
    remove: function(path) {
      this._validateDirPath(path);
      delete this._pathSettingsMap[path];
      this._updateRoots();
    },

    /**
     * Method: reset
     * Reset the state to the initial state (i.e. cache nothing).
     */
    reset: function() {
      this.rootPaths = [];
      this._pathSettingsMap = {};
    },

    /**
     ** query methods
     **/

    /**
     * Method: descendIntoPath
     *
     * Checks if the given directory path should be followed.
     *
     * Returns: true or false
     */
    descendIntoPath: function(path) {
      this._validateDirPath(path);
      return !! this._query(path);
    },

    /**
     * Method: cachePath
     *
     * Checks if given path should be cached.
     *
     * Returns: true or false
     */
    cachePath: function(path) {
      this._validatePath(path);
      var settings = this._query(path);
      return settings && (util.isDir(path) || settings.data);
    },

    /**
     ** private methods
     **/

    // gets settings for given path. walks up the path until it finds something.
    _query: function(path) {
      return this._pathSettingsMap[path] ||
        path !== '/' &&
        this._query(util.containingDir(path));
    },

    _validatePath: function(path) {
      if(typeof(path) !== 'string') {
        throw new Error("path is required");
      }
    },

    _validateDirPath: function(path) {
      this._validatePath(path);
      if(! util.isDir(path)) {
        throw new Error("not a directory path: " + path);
      }
    },

    _updateRoots: function() {
      var roots = {}
      for(var a in this._pathSettingsMap) {
        // already a root
        if(roots[a]) {
          continue;
        }
        var added = false;
        for(var b in this._pathSettingsMap) {
          if(util.pathContains(a, b)) {
            roots[b] = true;
            added = true;
            break;
          }
        }
        if(! added) {
          roots[a] = true;
        }
      }
      this.rootPaths = Object.keys(roots);
    },

  };

  return Caching;
});
