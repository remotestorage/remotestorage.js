define([
  'require',
  'lib/ajax-0.1.0',
  'lib/webfinger-0.1.1'
], function(require, ajax, webfinger) {
  function onError(code, msg) {
    alert(msg);
  }
  function getStorageInfo(userAddress, cb) {
    webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true
    }, function(err, data) {
      cb(err, null);
    }, function(attributes) {
      cb(0, attributes);
      var storageAddresses = {};
    });
  }
  function createOAuthAddress(storageInfo, categories, redirectUri) {
     return storageInfo.auth
          +'?redirect_uri='+encodeURIComponent(redirectUri)
          +'&scope'+encodeURIComponent(categories.join(','))
          +'&response_type=token'
          +'&client_id='+encodeURIComponent(redirectUri);
  }
  function getDriver(api, cb) {
    if(api == 'CouchDB') {
      require(['lib/couch-0.1.1'], cb);
    } else {//'simple', 'WebDAV'
      require(['lib/dav-0.1.1'], cb);
    }
  }
  function createClient(storageInfo, category, token) {
    var storageAddress = webfinger.resolveTemplate(storageInfo.template, category)
    return {
      get: function(key, cb) {
       getDriver(storageInfo.api, function(d) {
         d.get(storageAddress, token, key, cb);
       });
      },
      put: function(key, value, cb) {
       getDriver(storageInfo.api, function(d) {
         d.put(storageAddress, token, key, value, cb);
       });
      },
      delete: function(key, cb) {
       getDriver(storageInfo.api, function(d) {
         d.delete(storageAddress, token, key, cb);
       });
      }
    };
  }
  function receiveToken() {
    if(location.hash.length == 0) {
      return null;
    }
    var params = location.hash.split('&');
    for(var i = 0; i < params.length; i++){
      if(params[i].length && params[i][0] =='#') {
        params[i] = params[i].substring(1);
      }
      var kv = params[i].split('=');
      if(kv.length >= 2) {
        if(kv[0]=='access_token') {
          var token = unescape(kv[1]);//unescaping is needed in chrome, otherwise you get %3D%3D at the end instead of ==
          for(var i = 2; i < kv.length; i++) {
            token += '='+kv[i];
          }
          return token;
        }
      }
    }
    return null;
  }
  return {
    getStorageInfo: getStorageInfo,
    createOAuthAddress: createOAuthAddress,
    createClient: createClient,
    receiveToken: receiveToken
  };
});
