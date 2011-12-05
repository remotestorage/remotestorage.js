define(function(require, exports, module) {
  exports.session = (function() {
    function set(key, value) {
      sessionStorage.setItem('_remoteStorage_'+key, value);
    }
    function get(key) {
      return sessionStorage.getItem('_remoteStorage_'+key);
    }
    function isConnected() {
      return (get('token') != null);
    }
    function disconnect() {
      sessionStorage.clear();
    }
    return {
      set: set,
      get: get,
      isConnected: isConnected,
      disconnect: disconnect
    };
  })();
});
