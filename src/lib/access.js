define([], function() {

  var Access = function() {
    this.reset();

    this.__defineGetter__('scopes', function() {
      return Object.keys(this._scopeModeMap);
    });
  };

  Access.prototype = {
    // not sure yet, if 'set' or 'claim' is better...

    claim: function() {
      this.set.apply(this, arguments);
    },

    set: function(scope, mode) {
      this._adjustRootPaths(scope);
      this._scopeModeMap[scope] = mode;
    },

    get: function(scope) {
      return this._scopeModeMap[scope];
    },

    check: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode === 'r' || actualMode === 'rw');
    },

    reset: function() {
      this.rootPaths = [];
      this._scopeModeMap = {};
    },

    _adjustRootPaths: function(newScope) {
      if('root' in this._scopeModeMap || newScope === 'root') {
        this.rootPaths = ['/'];
      } else if(! (newScope in this._scopeModeMap)) {
        this.rootPaths.push('/' + newScope + '/');
        this.rootPaths.push('/public/' + newScope + '/');
      }
    }
  };

  return Access;

});
