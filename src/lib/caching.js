define([], function() {
  var Caching = function() {
    this._pathSettingsMap = {};
  };

  Caching.prototype = {

    // configuration methods

    get: function(path) {
      if(typeof(path) !== 'string') {
        throw new Error("path is required");
      }
      return this._pathSettingsMap[path];
    },

    set: function(path, settings) {
      if(typeof(path) !== 'string') {
        throw new Error("path is required");
      }
      if(typeof(settings) !== 'object') {
        throw new Error("settings is required");
      }
      this._pathSettingsMap[path] = settings;
    },

    remove: function(path) {
      if(typeof(path) !== 'string') {
        throw new Error("path is required");
      }
      delete this._pathSettingsMap[path];
    },

    // query methods

    descendInto: function(path) {
      return !! this._query(path);
    },

    cacheDataIn: function(path) {
      var settings = this._query(path);
      return settings && settings.data;
    },

    _query: function(path) {
      if(typeof(path) !== 'string') {
        throw new Error("path is required");
      }
      if(path[path.length - 1] !== '/') {
        throw new Error("not a directory path: " + path);
      }
      return this.get(path) || path !== '/' && this._query(path.replace(/[^\/]+\/$/, ''));
    }

  };

  return Caching;
});
