define(
  ['require', './lib/platform', './lib/couch', './lib/dav', './lib/webfinger', './lib/hardcoded'],
  function (require, platform, couch, dav, webfinger, hardcoded) {
    var getStorageInfo = function (userAddress, cb) {
        if(typeof(userAddress) != 'string') {
          cb('user address should be a string');
        } else {
          webfinger.getStorageInfo(userAddress, {timeout: 3000}, function(err, storageInfo) {
            if(err) {
              hardcoded.guessStorageInfo(userAddress, {timeout: 3000}, function(err2, data) {
                cb(err2, data);
              });
            } else {
              storageInfo.rel=storageInfo.type;//support both while we settle down the syntax
              cb(err, storageInfo);
            }
          });
        }
      },
      createOAuthAddress = function (storageInfo, scopes, redirectUri) {
        if(storageInfo.type=='https://www.w3.org/community/rww/wiki/read-write-web-00#simple') {
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
        var authHref = storageInfo.properties['http://oauth.net/core/1.0/endpoint/request'];
        return authHref + (authHref.indexOf('?') === -1?'?':'&') + terms.join('&');
      },
      getDriver = function (type, cb) {
        cb(type === 'pds-remotestorage-00#couchdb'?couch:dav);
      },
      resolveKey = function(storageInfo, basePath, relPath) {
        var itemPathParts = ((basePath.length?(basePath + '/'):'') + relPath).split('/');
        var item = itemPathParts.splice(1).join('_');
        return storageInfo.href + '/' + itemPathParts[0]
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
