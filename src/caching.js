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
    FLUSH: 0,
    SEEN: 1,
    FOLDERS: 2,
    SEEN_AND_FOLDERS: 3,
    DOCUMENTS: 4,
    ALL: 7,

    /**
     ** configuration methods
     **/

    set: function(path, value) {
      if(typeof(path) !== 'string') {
        throw new Error('path should be a string');
      }
      if (typeof(value) !== 'number') {
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
      if (this._rootPaths[path]) {
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
  RemoteStorage.Caching._rs_init = function() {};

})(typeof(window) !== 'undefined' ? window : global);
