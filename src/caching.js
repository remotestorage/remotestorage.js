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
     ** configuration methods
     **/

    set: function(path, value) {
      if(typeof(path) !== 'string') {
        throw new Error('path should be a string');
      }
      if (typeof(value) === 'undefined') {
        throw new Error("value should be something like remoteStorage.caching.FOLDERS_AND_SEEN");
      }
      this._rootPaths[path] = value;
      RemoteStorage.log('call activate handler?', (value === this.SEEN_AND_FOLDERS), (value === this.ALL), (this.activateHandler));
      if (value === this.SEEN_AND_FOLDERS || value === this.ALL) {
        if (this.activateHandler) {
          this.activateHandler(path);
        } else {
          this.pendingActivations.push(path);
        }
      }
    },
   
    enable: function(path) {
      this.set(path, this.ALL);
    },
    disable: function(path) {
      this.set(path, this.FLUSH);
    },

    onActivate: function(cb) {
      var i;
      RemoteStorage.log('setting activate handler', cb, this.pendingActivations);
      this.activateHandler = cb;
      for(i=0; i<this.pendingActivations.length; i++) {
        cb(this.pendingActivations[i]);
      }
      delete this.pendingActivations;
    },
   
    /**
     * Method: checkPath
     *
     *
     * retrieves caching setting to smallest tree containing path.
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
     * resets the state of caching;
     * deletes all caching information.
     **/
    reset: function() {
      this._rootPaths = {};
    }
  };

  //at this point the global remoteStorage object has not been created yet,
  //only its prototype exists so far, so we define a self-constructing
  //property on there:
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
