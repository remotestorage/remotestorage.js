define(
  ['require', './lib/platform', './lib/couch', './lib/dav', './lib/webfinger', './lib/hardcoded'],
  function (require, platform, couch, dav, webfinger, hardcoded) {
    var getStorageInfo = function (userAddress, cb) {
        webfinger.getStorageInfo(userAddress, {timeout: 3000}, function(err, storageInfo) {
          if(err) {
            hardcoded.guessStorageInfo(userAddress, {timeout: 3000}, function(err2, data) {
              cb(err2, data);
            });
          } else {
            cb(err, storageInfo);
          }
        });
      },
      createOAuthAddress = function (storageInfo, scopes, redirectUri) {
        if(storageInfo.type.split('#')[0]=='pds-remotestorage-00') {
          scopesStr = scopes.join(' ');
        } else {
          var legacyScopes = [];
          for(var i=0; i<scopes.length; i++) {
            legacyScopes.push(scopes[i].split(':')[0].split('/')[0]);
          }
          scopesStr = legacyScopes.join(',');          
        }
        var terms = [
          'redirect_uri='+encodeURIComponent(redirectUri),
          'scope='+encodeURIComponent(scopesStr),
          'response_type=token',
          'client_id='+encodeURIComponent(redirectUri)
        ];
        return storageInfo.auth.href + (storageInfo.auth.href.indexOf('?') === -1?'?':'&') + terms.join('&');
      },
      getDriver = function (type, cb) {
        cb(type === 'pds-remotestorage-00#couchdb'?couch:dav);
      },
      resolveKey = function(storageInfo, category, item) {
        return storageInfo.href + '/' + category
          + (storageInfo.legacySuffix ? storageInfo.legacySuffix : '')
          + '/' + (item[0] == '_' ? 'u' : '') + item;
      },
      createClient = function (storageInfo, basePath, token) {
        return {
          get: function (key, cb) {
            if(typeof(key) != 'string') {
              cb('argument "key" should be a string');
            } else {
              getDriver(storageInfo.type, function (d) {
                d.get(resolveKey(storageInfo, basePath, key), token, cb);
              });
            }
          },
          put: function (key, value, cb) {
            if(typeof(key) != 'string') {
              cb('argument "key" should be a string');
            } else if(typeof(value) != 'string') {
              cb('argument "value" should be a string');
            } else {
              getDriver(storageInfo.type, function (d) {
                d.put(resolveKey(storageInfo, basePath, key), value, token, cb);
              });
            }
          },
          'delete': function (key, cb) {
            if(typeof(key) != 'string') {
              cb('argument "key" should be a string');
            } else {
              getDriver(storageInfo.type, function (d) {
                d['delete'](resolveKey(storageInfo, basePath, key), token, cb);
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
