(function(global) {

  var SETTINGS_KEY = "remotestorage:caching";

  function containingDir(path) {
    if(path === '') {
      return '/';
    }
    if(! path) {
      throw "Path not given!";
    }

    return path.replace(/\/+/g, '/').replace(/[^\/]+\/?$/, '');
  }

  function isDir(path) {
    return path.substr(-1) === '/';
  }

  function pathContains(a, b) {
    return a.slice(0, b.length) === b;
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

    /**
     * Method: enable
     *
     * Enable caching for the given path.
     *
     * here, `data` is true if both folder listings and
     * documents in the subtree should be cached,
     * and false to indicate that only folder listings,
     * not documents in the subtree should be cached.
     *
     * Parameters:
     *   path - Absolute path to a directory.
     */
    enable: function(path) { this.set(path, { data: true, ready: false }); },
    /**
     * Method: disable
     *
     * Disable caching for the given path.
     *
     * Parameters:
     *   path - Absolute path to a directory.
     */
    disable: function(path) { this.remove(path); },

    /**
     ** configuration methods
     **/

    get: function(path) {
      this._validateDirPath(path);
      return this._pathSettingsMap[path];
    },

    set: function(path, settings) {
      if((typeof(settings) === 'object') && (settings.ready)) {
        this.resolveQueue(path);
      }
      this._validateDirPath(path);
      if(typeof(settings) !== 'object') {
        throw new Error("settings is required");
      }
      this._pathSettingsMap[path] = settings;
      this._updateRoots();
    },

    remove: function(path) {
      this._validateDirPath(path);
      delete this._pathSettingsMap[path];
      this._updateRoots();
    },
    /**
     * Method: reset
     * 
     * resets the state of caching;
     * deletes all caching information.
     **/
    reset: function() {
      this.rootPaths = [];
      this._pathSettingsMap = {};
    },

    /**
     ** queue methods
     **/

    /**
     * Method: waitForPath
     *
     * Queues a promise and fulfills it when the local cache is ready
     *
     * path: the path for which we want to be notified when it's ready in local
     *
     * Returns: a promise
     */
    waitForPath: function(path) {
      var promise = promising();
      if(this.cachePathReady(path)) {
        promise.fulfill();
      } else {
        if(!this.queuedPromises) {
          this.queuedPromises = {};
        }
        if(!this.queuedPromises[path]) {
          this.queuedPromises[path] = [];
        }
        this.queuedPromises[path].push(promise);
      }
      return promise;
    },

    /**
     * Method: resolveQueue
     *
     * rootPath: the subtree for which to fulfill queued promises
     *
     * resolves promises that were waiting for a part of the local cache to be ready
     *
     */
    resolveQueue: function(rootPath) {
      var path, i;
      if(!this.queuedPromises) {
        return;
      }
      for(path in this.queuedPromises) {
        if(path.substring(0, rootPath.length) === rootPath) {
          for(i=0; i<this.queuedPromises[path].length; i++) {
            this.queuedPromises[path][i].fulfill();
          }
          delete this.queuedPromises[path];
        }
      }
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
      if(isDir(path)) {
        return !!settings;
      } else {
        return !!settings && (settings.data === true);
      }
    },

    /**
     * Method: cachePathReady
     *
     * Checks if given path should be cached and is ready (i.e. sync has completed at least once).
     *
     * Returns: true or false
     */
    cachePathReady: function(path) {
      if(!this.cachePath(path)) {
        return false;
      }
      var settings = this._query(path);
      return ((typeof(settings) === 'object') && (settings.ready));
    },

    /**
     ** private methods
     **/

    // gets settings for given path. walks up the path until it finds something.
    _query: function(path) {
      return this._pathSettingsMap[path] ||
        path !== '/' &&
        this._query(containingDir(path));
    },

    _validatePath: function(path) {
      if(typeof(path) !== 'string') {
        throw new Error("path is required");
      }
    },

    _validateDirPath: function(path) {
      this._validatePath(path);
      if(! isDir(path)) {
        throw new Error("not a directory path: " + path);
      }
      if(path[0] !== '/') {
        throw new Error("path not absolute: " + path);
      }
    },

    _updateRoots: function() {
      var roots = {};
      for(var a in this._pathSettingsMap) {
        // already a root
        if(roots[a]) {
          continue;
        }
        var added = false;
        for(var b in this._pathSettingsMap) {
          if(pathContains(a, b)) {
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

  Object.defineProperty(RemoteStorage.Caching.prototype, 'list', {
    get: function() {
      var list = [];
      for(var path in this._pathSettingsMap) {
        list.push({ path: path, settings: this._pathSettingsMap[path] });
      }
      return list;
    }
  });


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
