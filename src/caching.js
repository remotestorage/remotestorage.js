(function(global) {

  var SETTINGS_KEY = "remotestorage:caching";

  function containingFolder(path) {
    if (path === '') {
      return '/';
    }
    if (! path) {
      throw "Path not given!";
    }

    return path.replace(/\/+/g, '/').replace(/[^\/]+\/?$/, '');
  }

  /**
   * Class: RemoteStorage.Caching
   *
   * Holds caching configuration.
   */
  RemoteStorage.Caching = function() {
    this.reset();
  };

  RemoteStorage.Caching.prototype = {
    FLUSH: false,
    SEEN: 'seen',
    SEEN_AND_FOLDERS: { data: false },
    ALL: { data: true },
    pendingActivations: [],


    /**
     * Method: set
     *
     * Set the caching strategy for a given path explicitly.
     *
     * Not needed when using <enable>/<disable>.
     *
     * Parameters:
     *   path
     *   value
     */
    set: function(path, value) {
      if (typeof(path) !== 'string') {
        throw new Error('path should be a string');
      }
      if (typeof(value) === 'undefined') {
        throw new Error("value should be something like remoteStorage.caching.SEEN");
      }

      this._rootPaths[path] = value;

      if (value === this.SEEN_AND_FOLDERS || value === this.ALL) {
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
     * Uses caching strategy ALL.
     *
     * Parameters:
     *   path
     */
    enable: function(path) {
      this.set(path, this.ALL);
    },

    /**
     * Method: disable
     *
     * Disable caching for a given path.
     *
     * Uses caching strategy FLUSH (meaning items are only cached until
     * successfully pushed to the remote).
     *
     * Parameters:
     *   path
     */
    disable: function(path) {
      this.set(path, this.FLUSH);
    },

    /**
     * Method: onActivate
     *
     * Set a callback for when caching is activated for a path.
     *
     * Parameters:
     *   callback - Callback function
     */
    onActivate: function(cb) {
      var i;
      RemoteStorage.log('setting activate handler', cb, this.pendingActivations);
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
     *   path
     **/
    checkPath: function(path) {
      if (this._rootPaths[path] !== undefined) {
        return this._rootPaths[path];
      } else if (path === '/') {
        return this.SEEN;
      } else {
        return this.checkPath(containingFolder(path));
      }
    },

    /**
     * Method: reset
     *
     * Reset the state of caching by deleting all caching information.
     **/
    reset: function() {
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
    get: function() {
      var caching = new RemoteStorage.Caching();
      Object.defineProperty(this, 'caching', {
        value: caching
      });
      return caching;
    }
  });

  RemoteStorage.Caching._rs_init = function() {};

})(typeof(window) !== 'undefined' ? window : global);
