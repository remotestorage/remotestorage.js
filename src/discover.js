(function(global) {

  // feature detection flags
  var haveXMLHttpRequest, hasLocalStorage;
  // used to store settings in localStorage
  var SETTINGS_KEY = 'remotestorage:discover';
  // cache loaded from localStorage
  var cachedInfo = {};

  /**
   * Class: RemoteStorage.Discover
   *
   * This class deals with the webfinger lookup
   *
   * Arguments:
   * userAddress - user@host
   * callback    - gets called with href of the storage, the type and the authURL
   * Example:
   * (start code)
   *
   * (end code)
   **/

  RemoteStorage.Discover = function(userAddress, callback) {
    if (userAddress in cachedInfo) {
      var info = cachedInfo[userAddress];
      callback(info.href, info.type, info.authURL);
      return;
    }
    var hostname = userAddress.split('@')[1];
    var params = '?resource=' + encodeURIComponent('acct:' + userAddress);
    var urls = [
      'https://' + hostname + '/.well-known/webfinger' + params,
      'https://' + hostname + '/.well-known/host-meta.json' + params,
      'http://' + hostname + '/.well-known/webfinger' + params,
      'http://' + hostname + '/.well-known/host-meta.json' + params
    ];

    function tryOne() {
      var xhr = new XMLHttpRequest();
      var url = urls.shift();
      if (!url) { return callback(); }
      RemoteStorage.log('try url', url);
      xhr.open('GET', url, true);
      xhr.onabort = xhr.onerror = function() {
        console.error("webfinger error", arguments, '(', url, ')');
        tryOne();
      };
      xhr.onload = function() {
        if (xhr.status !== 200) { return tryOne(); }
        var profile;

        try {
          profile = JSON.parse(xhr.responseText);
        } catch(e) {
          RemoteStorage.log("Failed to parse profile ", xhr.responseText, e);
          tryOne();
          return;
        }

        if (!profile.links) {
          RemoteStorage.log("profile has no links section ", JSON.stringify(profile));
          tryOne();
          return;
        }

        var link;
        profile.links.forEach(function(l) {
          if (l.rel === 'remotestorage') {
            link = l;
          } else if (l.rel === 'remoteStorage' && !link) {
            link = l;
          }
        });
        RemoteStorage.log('got profile', profile, 'and link', link);
        if (link) {
          var authURL = link.properties['http://tools.ietf.org/html/rfc6749#section-4.2']
                  || link.properties['auth-endpoint'],
            storageType = link.properties['http://remotestorage.io/spec/version']
                  || link.type;
          cachedInfo[userAddress] = { href: link.href, type: storageType, authURL: authURL };
          if (hasLocalStorage) {
            localStorage[SETTINGS_KEY] = JSON.stringify({ cache: cachedInfo });
          }
          callback(link.href, storageType, authURL);
        } else {
          tryOne();
        }
      };
      xhr.send();
    }
    tryOne();
  };

  RemoteStorage.Discover._rs_init = function(remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        cachedInfo = settings.cache;
      }
    }
  };

  RemoteStorage.Discover._rs_supported = function() {
    haveXMLHttpRequest = !! global.XMLHttpRequest;
    return haveXMLHttpRequest;
  };

  RemoteStorage.Discover._rs_cleanup = function() {
    if (hasLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(typeof(window) !== 'undefined' ? window : global);
