(function (global) {

  // feature detection flags
  var haveXMLHttpRequest, hasLocalStorage;
  // used to store settings in localStorage
  var SETTINGS_KEY = 'remotestorage:discover';
  // cache loaded from localStorage
  var cachedInfo = {};

  /**
   * Class: RemoteStorage.Discover
   *
   * This class deals with the Webfinger lookup, discovering a connecting
   * user's storage details.
   *
   * The discovery timeout can be configured via
   * `RemoteStorage.config.discoveryTimeout` (in ms).
   *
   * Arguments:
   *   userAddress - user@host
   *   callback    - gets called with href of the storage, the type and the authURL
   **/

  RemoteStorage.Discover = function (userAddress, callback) {
    if (userAddress in cachedInfo) {
      var info = cachedInfo[userAddress];
      callback(info.href, info.type, info.authURL);
      return;
    }

    webfinger(userAddress, { tls_only: false, uri_fallback: true, request_timeout: 5000 }, function (err, response) {
      if ((typeof response.idx.links.remotestorage !== 'object') ||
          (typeof response.idx.links.remotestorage.length !== 'number')) {
        RemoteStorage.log("[Discover] Profile does not have remotestorage defined in the links section ", JSON.stringify(response.json));
        cb();
        return;
      }

      var rs            = response.idx.links.remotestorage[0];
      var authURL       = rs.properties['http://tools.ietf.org/html/rfc6749#section-4.2'] ||
                          rs.properties['auth-endpoint'];
      var storageType   = rs.properties['http://remotestorage.io/spec/version'] ||
                          rs.type;

      // cache fetched data
      cachedInfo[userAddress] = { href: rs.href, type: storageType, authURL: authURL };
      if (hasLocalStorage) {
        localStorage[SETTINGS_KEY]  = JSON.stringify({ cache: cachedInfo });
      }

      callback(rs.href, storageType, authURL);
    });
  };

  RemoteStorage.Discover._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        cachedInfo = settings.cache;
      }
    }
  };

  RemoteStorage.Discover._rs_supported = function () {
    haveXMLHttpRequest = !! global.XMLHttpRequest;
    return haveXMLHttpRequest;
  };

  RemoteStorage.Discover._rs_cleanup = function () {
    if (hasLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(typeof(window) !== 'undefined' ? window : global);
