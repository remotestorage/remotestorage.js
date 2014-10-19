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
   * This function deals with the Webfinger lookup, discovering a connecting
   * user's storage details.
   *
   * The discovery timeout can be configured via
   * `RemoteStorage.config.discoveryTimeout` (in ms).
   *
   * Arguments:
   *
   *   userAddress - user@host
   *
   * Returns:
   *
   * A promise for an object with the following properties.
   *
   *   href - Storage base URL,
   *   storageType - Storage type,
   *   authUrl - OAuth URL,
   *   properties - Webfinger link properties
   **/

  RemoteStorage.Discover = function (userAddress) {
    if (userAddress in cachedInfo) {
      return Promise.resolve(cachedInfo[userAddress]);
    }

    var webFinger = new WebFinger({
      tls_only: false,
      uri_fallback: true,
      request_timeout: 5000
    });

    var pending = Promise.defer();

    webFinger.lookup(userAddress, function (err, response) {
      if (err) {
        return pending.reject(err.message);
      } else if ((typeof response.idx.links.remotestorage !== 'object') ||
                 (typeof response.idx.links.remotestorage.length !== 'number') ||
                 (response.idx.links.remotestorage.length <= 0)) {
        RemoteStorage.log("[Discover] WebFinger record for " + userAddress + " does not have remotestorage defined in the links section ", JSON.stringify(response.json));
        return pending.reject("WebFinger record for " + userAddress + " does not have remotestorage defined in the links section.");
      }

      var rs = response.idx.links.remotestorage[0];
      var authURL = rs.properties['http://tools.ietf.org/html/rfc6749#section-4.2'] ||
                    rs.properties['auth-endpoint'];
      var storageType = rs.properties['http://remotestorage.io/spec/version'] ||
                        rs.type;

      // cache fetched data
      cachedInfo[userAddress] = { href: rs.href, storageType: storageType, authURL: authURL, properties: rs.properties };

      if (hasLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({ cache: cachedInfo });
      }

      return pending.resolve(cachedInfo[userAddress]);
    });

    return pending.promise;
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
