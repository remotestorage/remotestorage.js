(function (global) {

  function extractParams(url) {
    //FF already decodes the URL fragment in document.location.hash, so use this instead:
    var location = url || RemoteStorage.Authorize.getLocation().href,
        hashPos  = location.indexOf('#'),
        hash;
    if (hashPos === -1) { return; }
    hash = location.substring(hashPos+1);
    // if hash is not of the form #key=val&key=val, it's probably not for us
    if (hash.indexOf('=') === -1) { return; }
    return hash.split('&').reduce(function (m, kvs) {
      var kv = kvs.split('=');
      m[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      return m;
    }, {});
  }

  RemoteStorage.ImpliedAuth = function (storageApi, redirectUri) {
    RemoteStorage.log('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
    // Set a fixed access token, signalling to not send it as Bearer
    remoteStorage.remote.configure({
      token: RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN
    });
    document.location = redirectUri;
  };

  RemoteStorage.Authorize = function (authURL, scope, redirectUri, clientId) {
    RemoteStorage.log('[Authorize] authURL = ', authURL, 'scope = ', scope, 'redirectUri = ', redirectUri, 'clientId = ', clientId);

    var url = authURL, hashPos = redirectUri.indexOf('#');
    url += authURL.indexOf('?') > 0 ? '&' : '?';
    url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
    url += '&scope=' + encodeURIComponent(scope);
    url += '&client_id=' + encodeURIComponent(clientId);
    if (hashPos !== -1) {
      url += '&state=' + encodeURIComponent(redirectUri.substring(hashPos+1));
    }
    url += '&response_type=token';

    if (global.cordova) {
      return RemoteStorage.Authorize.openWindow(
          url,
          redirectUri,
          'location=yes,clearsessioncache=yes,clearcache=yes'
        )
        .then(function(authResult) {
          remoteStorage.remote.configure({
            token: authResult.access_token
          });

          // TODO
          // sync doesn't start until after reload
          // possibly missing some initialization step?
          global.location.reload();
        })
        .then(null, function(error) {
          console.error(error);
          remoteStorage.widget.view.setState('initial');
        });
    }

    RemoteStorage.Authorize.setLocation(url);
  };

  RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN = false;

  RemoteStorage.prototype.authorize = function (authURL, cordovaRedirectUri) {
    this.access.setStorageType(this.remote.storageType);
    var scope = this.access.scopeParameter;

    var redirectUri = global.cordova ?
      cordovaRedirectUri :
      String(RemoteStorage.Authorize.getLocation());

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
   * Set current document location
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

  /**
   * Open new InAppBrowser window for OAuth in Cordova
   */
  RemoteStorage.Authorize.openWindow = function (url, redirectUri, options) {
    var pending = Promise.defer();
    var newWindow = global.open(url, '_blank', options);

    if (!newWindow || newWindow.closed) {
      pending.reject('Authorization popup was blocked');
      return pending.promise;
    }

    var handleExit = function () {
      pending.reject('Authorization was canceled');
    };

    var handleLoadstart = function (event) {
      if (event.url.indexOf(redirectUri) !== 0) {
        return;
      }

      newWindow.removeEventListener('exit', handleExit);
      newWindow.close();

      var authResult = extractParams(event.url);

      if (!authResult) {
        return pending.reject('Authorization error');
      }

      return pending.resolve(authResult);
    };

    newWindow.addEventListener('loadstart', handleLoadstart);
    newWindow.addEventListener('exit', handleExit);

    return pending.promise;
  };

  RemoteStorage.prototype.impliedauth = function () {
    RemoteStorage.ImpliedAuth(this.remote.storageApi, String(document.location));
  };

  RemoteStorage.Authorize._rs_supported = function () {
    return typeof(document) !== 'undefined';
  };

  var onFeaturesLoaded;
  RemoteStorage.Authorize._rs_init = function (remoteStorage) {

    onFeaturesLoaded = function () {
      var authParamsUsed = false;
      if (params) {
        if (params.error) {
          throw "Authorization server errored: " + params.error;
        }
        if (params.access_token) {
          remoteStorage.remote.configure({
            token: params.access_token
          });
          authParamsUsed = true;
        }
        if (params.remotestorage) {
          remoteStorage.connect(params.remotestorage);
          authParamsUsed = true;
        }
        if (params.state) {
          RemoteStorage.Authorize.setLocation('#'+params.state);
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

  RemoteStorage.Authorize._rs_cleanup = function (remoteStorage) {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
  };

})(typeof(window) !== 'undefined' ? window : global);
