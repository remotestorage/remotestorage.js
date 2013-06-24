(function() {
  RemoteStorage.discover = function(userAddress, callback) {
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
      xhr.open('GET', url, true);
      xhr.onload = function() {
        if(status != 200) return tryOne();
        var profile = JSON.parse(xhr.responseText);
        var link;
        profile.links.forEach(function(l) {
          if(l.rel == 'remotestorage') {
            link = l;
          } else if(l.rel == 'remoteStorage' && !link) {
            link = l;
          }
        });
        if(link) {
          var authURL = link.properties['auth-endpoint'] ||
            link.properties['http://tools.ietf.org/html/rfc6749#section-4.2'];
          callback(link.href, link.type, authURL);
        } else {
          tryOne();
        }
      }
      xhr.send();
    }
    tryOne();
  }

})();