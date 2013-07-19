(function(global) {

  var haveLocalStorage = 'localStorage' in global;
  var SETTINGS_KEY = "remotestorage:access";

  RemoteStorage.Access = function() {
    this.reset();

    if(haveLocalStorage) {
      var rawSettings = localStorage[SETTINGS_KEY];
      if(rawSettings) {
        var savedSettings = JSON.parse(rawSettings);
        for(var key in savedSettings) {
          this.set(key, savedSettings[key]);
        }
      }
    }

    this.__defineGetter__('scopes', function() {
      return Object.keys(this.scopeModeMap).map(function(key) {
        return { name: key, mode: this.scopeModeMap[key] };
      }.bind(this));
    });

    this.__defineGetter__('scopeParameter', function() {
      return this.scopes.map(function(scope) {
        return (scope.name === 'root' && this.storageType === '2012.04' ? '' : scope.name) + ':' + scope.mode;
      }.bind(this)).join(' ');
    });
  };

  RemoteStorage.Access.prototype = {
    // not sure yet, if 'set' or 'claim' is better...

    claim: function() {
      this.set.apply(this, arguments);
    },

    set: function(scope, mode) {
      this._adjustRootPaths(scope);
      this.scopeModeMap[scope] = mode;
      this._persist();
    },

    get: function(scope) {
      return this.scopeModeMap[scope];
    },

    remove: function(scope) {
      var savedMap = {};
      for(var name in this.scopeModeMap) {
        savedMap[name] = this.scopeModeMap[name];
      }
      this.reset();
      delete savedMap[scope];
      for(var name in savedMap) {
        this.set(name, savedMap[name]);
      }
      this._persist();
    },

    check: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode === 'r' || actualMode === 'rw');
    },

    reset: function() {
      this.rootPaths = [];
      this.scopeModeMap = {};
    },

    _adjustRootPaths: function(newScope) {
      if('root' in this.scopeModeMap || newScope === 'root') {
        this.rootPaths = ['/'];
      } else if(! (newScope in this.scopeModeMap)) {
        this.rootPaths.push('/' + newScope + '/');
        this.rootPaths.push('/public/' + newScope + '/');
      }
    },

    _persist: function() {
      if(haveLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify(this.scopeModeMap);
      }
    },

    setStorageType: function(type) {
      this.storageType = type;
    }
  };

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
    if(key == 'root' || key === '') {
      remoteStorage.caching.set('/', { data: true });
    } else {
      remoteStorage.caching.set('/' + key + '/', { data: true });
      remoteStorage.caching.set('/public/' + key + '/', { data: true });
    }
  }

  RemoteStorage.prototype.claimAccess = function(scopes) {
    if(typeof(scopes) === 'object') {
      for(var key in scopes) {
        this.access.claim(key, scopes[key]);
        setModuleCaching(this, key); // legacy hack
      }
    } else {
      this.access.claim(arguments[0], arguments[1])
      setModuleCaching(this, arguments[0]); // legacy hack;
    }
  };

  RemoteStorage.Access._rs_init = function() {};
  RemoteStorage.Access._rs_cleanup = function() {
    if(haveLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(this);
