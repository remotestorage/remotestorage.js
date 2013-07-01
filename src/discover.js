(function(global) {

  // feature detection flags
  var haveXMLHttpRequest, haveLocalStorage;
  // used to store settings in localStorage
  var SETTINGS_KEY = 'remotestorage:discover';
  // cache loaded from localStorage
  var cachedInfo = {};

  RemoteStorage.Discover = function(userAddress, callback) {
    if(userAddress in cachedInfo) {
      var info = cachedInfo[userAddress];
      callback(info.href, info.type, info.authURL);
      return;
    }
    var hostname = userAddress.split('@')[1]
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
      if(! url) return callback();
      console.log('try url', url);
      xhr.open('GET', url, true);
      xhr.onabort = xhr.onerror = function() {
        console.error("webfinger error", arguments, '(', url, ')');
        tryOne();
      }
      xhr.onload = function() {
        if(xhr.status != 200) return tryOne();
        var profile = JSON.parse(xhr.responseText);
        var link;
        profile.links.forEach(function(l) {
          if(l.rel == 'remotestorage') {
            link = l;
          } else if(l.rel == 'remoteStorage' && !link) {
            link = l;
          }
        });
        console.log('got profile', profile, 'and link', link);
        if(link) {
          var authURL = link.properties['auth-endpoint'] ||
            link.properties['http://tools.ietf.org/html/rfc6749#section-4.2'];
          cachedInfo[userAddress] = { href: link.href, type: link.type, authURL: authURL };
          if(haveLocalStorage) {
            localStorage[SETTINGS_KEY] = JSON.stringify({ cache: cachedInfo });
          }
          callback(link.href, link.type, authURL);
        } else {
          tryOne();
        }
      }
      xhr.send();
    }
    tryOne();
  },



  RemoteStorage.Discover._rs_init = function(remoteStorage) {
    if(haveLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {};
      if(settings) {
        cachedInfo = settings.cache;
      }
    }
  };

  RemoteStorage.Discover._rs_supported = function() {
    haveLocalStorage = !! global.localStorage;
    haveXMLHttpRequest = !! global.XMLHttpRequest;
    return haveXMLHttpRequest;
  }

})(this);
