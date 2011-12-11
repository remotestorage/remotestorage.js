define({
  set: function(key, value) {
    sessionStorage.setItem('_remoteStorage_'+key, value);
  },
  get: function(key) {
    return sessionStorage.getItem('_remoteStorage_'+key);
  },
  isConnected: function() {
    return (this.get('token') != null);
  },
  disconnect: function() {
    sessionStorage.clear();
  }
});
