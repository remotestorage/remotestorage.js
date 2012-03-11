define(
  ['require', './lib/platform', './lib/couch', './lib/dav', './lib/webfinger'],
  function (require, platform, couch, dav, webfinger) {
    var getStorageInfo = function (userAddress, cb) {
        webfinger.getStorageInfo(userAddress, {timeout: 3000}, cb);
      },
      createOAuthAddress = function (storageInfo, categories, redirectUri) {
        var terms = [
          'redirect_uri='+encodeURIComponent(redirectUri),
          'scope='+encodeURIComponent(categories.join(',')),
          'response_type=token',
          'client_id='+encodeURIComponent(redirectUri)
        ];
        return storageInfo.auth + (storageInfo.auth.indexOf('?') === -1?'?':'&') + terms.join('&');
      },
      getDriver = function (api, cb) {
        cb(api === 'CouchDB'?couch:dav);
      },
      createClient = function (storageInfo, category, token) {
        var storageAddress = webfinger.resolveTemplate(storageInfo.template, category);
        return {
          get: function (key, cb) {
            if(typeof('key') != 'string') {
              cb('argument "key" should be a string');
            } else {
              getDriver(storageInfo.api, function (d) {
                d.get(storageAddress, token, key, cb);
              });
            }
          },
          put: function (key, value, cb) {
            if(typeof('key') != 'string') {
              cb('argument "key" should be a string');
            } else if(typeof('value') != 'string') {
              cb('argument "value" should be a string');
            } else {
              getDriver(storageInfo.api, function (d) {
                d.put(storageAddress, token, key, value, cb);
              });
            }
          },
          'delete': function (key, cb) {
            if(typeof('key') != 'string') {
              cb('argument "key" should be a string');
            } else {
              getDriver(storageInfo.api, function (d) {
                d['delete'](storageAddress, token, key, cb);
              });
            }
          }
        };
      },
      receiveToken = function () {
        var params, kv;
        if(location.hash.length > 0) {
          params = location.hash.split('&');
          for(var i = 0; i < params.length; i++) {
            if(params[i][0]=='#') {
              params[i] = params[i].substring(1);
            }
            if(params[i].substring(0, 'access_token='.length)=='access_token=') {
              return params[i].substring('access_token='.length);
            }
          }
        }
        return null;
      };

  return {
    getStorageInfo     : getStorageInfo,
    createOAuthAddress : createOAuthAddress,
    createClient       : createClient,
    receiveToken       : receiveToken
  };
});
