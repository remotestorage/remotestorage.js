define([], function() {

  var Access = function() {
    this._scopeModeMap = {};

    this.rootPaths = [];

    this.__defineGetter__('scopes', function() {
      return Object.keys(this._scopeModeMap);
    });
  };

  Access.prototype = {
    set: function(scope, mode) {
      if(! (scope in this._scopeModeMap)) {
        this.rootPaths.push('/' + scope + '/');
        this.rootPaths.push('/public/' + scope + '/');
      }
      this._scopeModeMap[scope] = mode;
    },

    get: function(scope) {
      return this._scopeModeMap[scope];
    },

    check: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode === 'r' || actualMode === 'rw');
    }
  };

  return Access;

});
