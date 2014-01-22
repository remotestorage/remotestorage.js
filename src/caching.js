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
    SEEN: false,
    SEEN_AND_FOLDERS: { data: false },
    ALL: { data: true },

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
