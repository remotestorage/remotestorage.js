(function() {

  function extractParams() {
    //FF already decodes the URL fragment in document.location.hash, so use this instead:
    var hashPos = document.location.href.indexOf('#');
    if(hashPos == -1) return;
    var hash = document.location.href.substring(hashPos+1);
    return hash.split('&').reduce(function(m, kvs) {
      var kv = kvs.split('=');
      m[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      return m;
    }, {});
  };

  RemoteStorage.Authorize = function(authURL, scope, redirectUri, clientId) {
    RemoteStorage.log('Authorize authURL = ',authURL)

    var url = authURL;
    url += authURL.indexOf('?') > 0 ? '&' : '?';
    url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
    url += '&scope=' + encodeURIComponent(scope);
    url += '&client_id=' + encodeURIComponent(clientId);
    url += '&response_type=token';
    document.location = url;
  };

  RemoteStorage.ImpliedAuth = function(storageApi, redirectUri) {
    RemoteStorage.log('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
    // Set a fixed access token, signalling to not send it as Bearer
    remoteStorage.remote.configure(undefined, undefined, undefined, 'implied');
    document.location = redirectUri;
  };

  RemoteStorage.prototype.authorize = function(authURL) {
    var scopes = this.access.scopeModeMap;
    var scope = [];
    for(var key in scopes) {
      var mode = scopes[key];
      if(key == 'root') {
        if(! this.remote.storageApi.match(/^draft-dejong-remotestorage-/)) {
          key = '';
        }
      }
      scope.push(key + ':' + mode);
    }
    scope = scope.join(' ');

    var redirectUri = String(document.location);
    var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

    RemoteStorage.Authorize(authURL, scope, redirectUri, clientId);
  };

  RemoteStorage.prototype.impliedauth = function() {
    RemoteStorage.ImpliedAuth(this.remote.storageApi, String(document.location));
  };


  RemoteStorage.Authorize._rs_supported = function(remoteStorage) {
    return typeof(document) != 'undefined';
  };

  var onFeaturesLoaded;
  RemoteStorage.Authorize._rs_init = function(remoteStorage) {
    onFeaturesLoaded = function () {
      if(params) {
        if(params.error) {
          throw "Authorization server errored: " + params.error;
        }
        if(params.access_token) {
          remoteStorage.remote.configure(undefined, undefined, undefined, params.access_token);
        }
        if(params.remotestorage) {
          remoteStorage.connect(params.remotestorage);
        }
      }
    }
    var params = extractParams();
    if(params) {
      document.location.hash = '';
    }
    remoteStorage.on('features-loaded', onFeaturesLoaded );
  }
  RemoteStorage.Authorize._rs_cleanup = function(remoteStorage) {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded );
  }

})();
