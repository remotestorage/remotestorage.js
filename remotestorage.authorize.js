(function() {
  RemoteStorage.authorize = function(authURL, storageApi, scopes, redirectUri, callback) {
    if(typeof(authURL) === 'function') {
      callback = authURL;
      authURL = undefined;
    }
    if(document.location.hash) {
      var md = document.location.hash.match(/access_token=([^&]+)/);
      if(md) {
        document.location = '#';
        callback(decodeURIComponent(md[1]));
        return;
      }
    }
    if(! authURL) { return; }
   
    var scope = '';
    for(var key in scopes) {
      var mode = scopes[key];
      if(key == 'root') {
        if(! storageApi.match(/^draft-dejong-remotestorage-/)) {
          key = '';
        }
      }
      scope += key + ':' + mode;
    }
   
    var url = authURL;
    url += authURL.indexOf('?') > 0 ? '&' : '?';
    url += 'redirect_uri=' + encodeURIComponent(redirectUri);
    url += '&scope=' + encodeURIComponent(scope);
    document.location = url;
  };
})();