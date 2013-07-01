(function() {

  RemoteStorage.authorize.extractParams = function() {
    if(! document.location.hash) return;
    return document.location.hash.split('&').reduce(function(m, kvs) {
      var kv = kvs.split('=');
      m[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      return m;
    }, {});
  };

  RemoteStorage.authorize = function(authURL, storageApi, scopes, redirectUri) {
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
