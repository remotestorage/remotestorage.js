(function(global) {

  var SETTINGS_KEY = "remotestorage:access";

  /**
   * Class: RemoteStorage.Access
   *
   * Keeps track of claimed access and scopes.
   */
  RemoteStorage.Access = function() {
    this.reset();

  };

  RemoteStorage.Access.prototype = {

    /**
     * Method: claim
     *
     * Claim access on a given scope with given mode.
     *
     * Parameters:
     *   scope - An access scope, such as "contacts" or "calendar".
     *   mode  - Access mode to use. Either "r" or "rw".
     */
    claim: function() {
      this.set.apply(this, arguments);
    },

    set: function(scope, mode) {
      if (typeof(scope) !== 'string' || scope.indexOf('/') !== -1 || scope.length === 0) {
        throw new Error('scope should be a non-empty string without forward slashes');
      }
      if (mode !== 'r' && mode !== 'rw') {
        throw new Error('mode should be either \'r\' or \'rw\'');
      }
      this._adjustRootPaths(scope);
      this.scopeModeMap[scope] = mode;
    },

    get: function(scope) {
      return this.scopeModeMap[scope];
    },

    remove: function(scope) {
      var savedMap = {};
      var name;
      for (name in this.scopeModeMap) {
        savedMap[name] = this.scopeModeMap[name];
      }
      this.reset();
      delete savedMap[scope];
      for (name in savedMap) {
        this.set(name, savedMap[name]);
      }
    },

    checkPermission: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode === 'r' || actualMode === 'rw');
    },

    getModuleName: function(path) {
      var pos, parts = path.split('/');
      if (parts[0] !== '') {
        throw new Error('path should start with a slash');
      }
      // /a => ['', 'a'] parts.length: 2, pos: 1 -> *
      // /a/ => ['', 'a', ''] parts.length: 3, pos: 1 -> a
      // /public/a => ['', 'public', 'a'] parts.length: 3, pos: 2 -> *
      // /public/a/ => ['', 'public', 'a', ''] parts.length: 4, pos: 2 -> a
      if (parts[1] === 'public') {
        pos = 2;
      } else {
        pos = 1;
      }
      if (parts.length <= pos+1) {
        return '*';
      }
      return parts[pos];
    },

    checkPath: function(path, mode) {
      //check root access
      if (this.checkPermission('*', mode)) {
        return true;
      }
      return !!this.checkPermission(this.getModuleName(path), mode);
    },

    reset: function() {
      this.rootPaths = [];
      this.scopeModeMap = {};
    },

    _adjustRootPaths: function(newScope) {
      if ('*' in this.scopeModeMap || newScope === '*') {
        this.rootPaths = ['/'];
      } else if (! (newScope in this.scopeModeMap)) {
        this.rootPaths.push('/' + newScope + '/');
        this.rootPaths.push('/public/' + newScope + '/');
      }
    },

    _scopeNameForParameter: function(scope) {
      if (scope.name === '*' && this.storageType) {
        if (this.storageType === '2012.04') {
          return '';
        } else if (this.storageType.match(/remotestorage-0[01]/)) {
          return 'root';
        }
      }
      return scope.name;
    },

    setStorageType: function(type) {
      this.storageType = type;
    }
  };

  /**
   * Property: scopes
   *
   * Holds an array of claimed scopes in the form
   * > { name: "<scope-name>", mode: "<mode>" }
   *
   * Example:
   *   (start code)
   *   remoteStorage.access.claim('foo', 'r');
   *   remoteStorage.access.claim('bar', 'rw');
   *
   *   remoteStorage.access.scopes
   *   // -> [ { name: 'foo', mode: 'r' }, { name: 'bar', mode: 'rw' } ]
   */
  Object.defineProperty(RemoteStorage.Access.prototype, 'scopes', {
    get: function() {
      return Object.keys(this.scopeModeMap).map(function(key) {
        return { name: key, mode: this.scopeModeMap[key] };
      }.bind(this));
    }
  });

  Object.defineProperty(RemoteStorage.Access.prototype, 'scopeParameter', {
    get: function() {
      return this.scopes.map(function(scope) {
        return this._scopeNameForParameter(scope) + ':' + scope.mode;
      }.bind(this)).join(' ');
    }
  });

  // documented in src/remotestorage.js
  Object.defineProperty(RemoteStorage.prototype, 'access', {
    get: function() {
      var access = new RemoteStorage.Access();
      Object.defineProperty(this, 'access', {
        value: access
      });
      return access;
    },
    configurable: true
  });

  function setModuleCaching(remoteStorage, key) {
    if (key === '*' || key === '') {
      remoteStorage.caching.set('/', { data: true });
    } else {
      remoteStorage.caching.set('/' + key + '/', { data: true });
      remoteStorage.caching.set('/public/' + key + '/', { data: true });
    }
  }

  // documented in src/remotestorage.js
  RemoteStorage.prototype.claimAccess = function(scopes) {
    if (typeof(scopes) === 'object') {
      for (var key in scopes) {
        this.access.claim(key, scopes[key]);
      }
    } else {
      this.access.claim(arguments[0], arguments[1]);
    }
  };

  RemoteStorage.Access._rs_init = function() {};
})(typeof(window) !== 'undefined' ? window : global);
