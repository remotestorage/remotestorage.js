(function() {

  RemoteStorage.Access = function() {
    this.reset();

    this.__defineGetter__('scopes', function() {
      return Object.keys(this.scopeModeMap).map(function(key) {
        return { name: key, mode: this.scopeModeMap[key] };
      }.bind(this));
    });

    this.__defineGetter__('scopeParameter', function() {
      return this.scopes.map(function(module) {
        return (module === 'root' && this.storageType === '2012.04' ? '' : module) + ':' + this.get(module);
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

    setStorageType: function(type) {
      this.storageType = type;
    }
  };

  RemoteStorage.Access._rs_init = function() {
    Object.defineProperty(RemoteStorage.prototype, 'access', {
      get: function() {
        var access = new RemoteStorage.Access();
        Object.defineProperty(RemoteStorage.prototype, 'access', {
          value: access
        });
        return access;
      },
      configurable: true
    });
    return promising().fulfill();
  };

})();
