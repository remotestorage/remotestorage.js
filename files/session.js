define(function(require, exports, module) {
  exports.set = function(key, value) {
    sessionStorage.setItem('_remoteStorage_'+key, value);
  };
  exports.get = function(key) {
    return sessionStorage.getItem('_remoteStorage_'+key);
  };
  exports.isConnected = function() {
    return (exports.get('token') != null);
  };
  exports.disconnect = function() {
    sessionStorage.clear();
  };
});
