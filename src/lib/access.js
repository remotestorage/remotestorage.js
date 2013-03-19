define([], function() {

  "use strict";

  /**
   * Class: Access
   * Manages access settings.
   */
  var Access = function() {
    this.reset();

    /**
     * Property: scopes
     * Returns a list of scopes currently claimed access to (but not their modes).
     */
    this.__defineGetter__('scopes', function() {
      return Object.keys(this._scopeModeMap);
    });

    /**
     * Property: scopeParameter
     * Returns the value for the "scope" parameter passed to the oauth server
     * during authorization flow. The format of this parameter partly depends
     * on the <storageType> set.
     */
    this.__defineGetter__('scopeParameter', function() {
      return this.scopes.map(function(module) {
        return (module === 'root' && this.storageType === '2012.04' ? '' : module) + ':' + this.get(module);
      }.bind(this)).join(' ');
    });
  };

  Access.prototype = {
    // not sure yet, if 'set' or 'claim' is better...

    /**
     * Method: claim
     * Alias for <set>.
     *
     * Example:
     *   > access.claim('root', 'r');
     *   >
     *   > access.check('root', 'r'); // -> true
     *   > access.check('root', 'rw'); // -> false
     *   >
     *   > access.claim('root', 'rw');
     *   >
     *   > access.check('root', 'r'); // -> true
     *   > access.check('root', 'rw'); // -> true
     */
    claim: function() {
      this.set.apply(this, arguments);
    },

    /**
     * Method: set
     * Adds or updates the claim for the given scope.
     * See <claim> for an example.
     */
    set: function(scope, mode) {
      this._adjustRootPaths(scope);
      this._scopeModeMap[scope] = mode;
    },

    /**
     * Method: get
     * Returns the mode claimed for the given scope, or undefined.
     */
    get: function(scope) {
      return this._scopeModeMap[scope];
    },

    /**
     * Method: check
     * Check if the given scope can be accessed with the given mode.
     * If the mode parameter is ommitted, the currently claimed mode for the given
     * scope is returned instead (or 'undefined', if the scope has no claim).
     *
     * See <claim> for an example.
     */
    check: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode ? (mode === 'r' || actualMode === 'rw') : actualMode);
    },

    /**
     * Method: reset
     * Resets all access settings to the initial state (i.e. nothing claimed).
     */
    reset: function() {
      /**
       * Property: rootPaths
       *
       * An Array of paths for a <Sync> task to start.
       */
      this.rootPaths = [];
      this._scopeModeMap = {};
    },

    /**
     * Method: setStorageType
     * Sets the <storageType> property to the given value.
     */
    setStorageType: function(type) {
      /**
       * Property: storageType
       * A String holding a internal alias for the storage type advertised by the user's webfinger profile.
       *
       * Currently recognized values and their corresponding APIs are:
       *   remotestorage-00 - draft-dejong-remotestorage-00
       *   2012.04 - https://www.w3.org/community/rww/wiki/read-write-web-00#simple
       */
      this.storageType = type;
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
