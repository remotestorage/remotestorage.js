
  global.localStorage = {
    getItem: function(key) {
      return this[key];
    },
    setItem: function(key, value) {
      this[key] = value;
    },
    removeItem: function(key) {
      delete this[key];
    }
  }

  module.exports = _loadModule('remoteStorage');
})();
