(function(global) {

  function extractParams() {
    //FF already decodes the URL fragment in document.location.hash, so use this instead:
    var location = RemoteStorage.Authorize.getLocation(),
        hashPos  = location.href.indexOf('#'),
        hash;
    if (hashPos === -1) { return; }
    hash = location.href.substring(hashPos+1);
    // if hash is not of the form #key=val&key=val, it's probably not for us
    if (hash.indexOf('=') === -1) { return; }
    return hash.split('&').reduce(function(m, kvs) {
      var kv = kvs.split('=');
      m[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      return m;
    }, {});
  }

  RemoteStorage.Authorize = function(authURL, scope, redirectUri, clientId) {
    RemoteStorage.log('Authorize authURL = ', authURL);

    var url = authURL;
    url += authURL.indexOf('?') > 0 ? '&' : '?';
    url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
    url += '&scope=' + encodeURIComponent(scope);
    url += '&client_id=' + encodeURIComponent(clientId);
    url += '&response_type=token';
    RemoteStorage.Authorize.setLocation(url);
  };

  RemoteStorage.prototype.authorize = function(authURL) {
    this.access.setStorageType(this.remote.storageType);
    var scope = this.access.scopeParameter;

    var redirectUri = String(RemoteStorage.Authorize.getLocation());
    var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

    RemoteStorage.Authorize(authURL, scope, redirectUri, clientId);
  };

  /**
   * Get current document location
   *
   * Override this method if access to document.location is forbidden
   */
  RemoteStorage.Authorize.getLocation = function () {
    return global.document.location;
  };

  /**
   * Get current document location
   *
   * Override this method if access to document.location is forbidden
   */
  RemoteStorage.Authorize.setLocation = function (location) {
    if (typeof location === 'string') {
      global.document.location.href = location;
    } else if (typeof location === 'object') {
      global.document.location = location;
    } else {
      throw "Invalid location " + location;
    }
  };

  RemoteStorage.Authorize._rs_supported = function(remoteStorage) {
    return typeof(document) !== 'undefined';
  };

  var onFeaturesLoaded;
  RemoteStorage.Authorize._rs_init = function(remoteStorage) {

    onFeaturesLoaded = function () {
      var authParamsUsed = false;
      if (params) {
        if (params.error) {
          throw "Authorization server errored: " + params.error;
        }
        if (params.access_token) {
          remoteStorage.remote.configure(undefined, undefined, undefined, params.access_token);
          authParamsUsed = true;
        }
        if (params.remotestorage) {
          remoteStorage.connect(params.remotestorage);
          authParamsUsed = true;
        }
      }
      if (!authParamsUsed) {
        remoteStorage.remote.stopWaitingForToken();
      }
    };
    var params = extractParams(),
        location;
    if (params) {
      location = RemoteStorage.Authorize.getLocation();
      location.hash = '';
    }
    remoteStorage.on('features-loaded', onFeaturesLoaded);
  };

  RemoteStorage.Authorize._rs_cleanup = function(remoteStorage) {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
  };

})(typeof(window) !== 'undefined' ? window : global);
