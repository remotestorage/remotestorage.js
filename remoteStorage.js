define(
  ['require', './lib/ajax', './lib/couch', './lib/dav', './lib/webfinger'],
  function (require, ajax, couch, dav, webfinger) {
    var onError = function (code, msg) {
        console.log(msg);
      },
      getStorageInfo = function (userAddress, cb) {
        webfinger.getAttributes(
          userAddress, {
            allowHttpWebfinger: true,
            allowSingleOriginWebfinger: false,
            allowFakefinger: true
          },
          function (err, data) {
            cb(err, null);
          },
          function (attributes) {
            cb(0, attributes);
            var storageAddresses = {};
          }
        );
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
        require([api === 'CouchDB'?'./lib/couch':'./lib/dav'], cb);
      },
      createClient = function (storageInfo, category, token) {
        var storageAddress = webfinger.resolveTemplate(storageInfo.template, category);
        return {
          get: function (key, cb) {
            getDriver(storageInfo.api, function (d) {
              d.get(storageAddress, token, key, cb);
            });
          },
          put: function (key, value, cb) {
            getDriver(storageInfo.api, function (d) {
              d.put(storageAddress, token, key, value, cb);
            });
          },
          'delete': function (key, cb) {
            getDriver(storageInfo.api, function (d) {
              d['delete'](storageAddress, token, key, cb);
            });
          }
        };
      },
      receiveToken = function () {
        var params, kv;
        /**
          this needs more attention.
        **/
        if(location.hash.length > 0) {
          params = location.hash.split('&');
          for(var i = 0; i < params.length; i++) {
            if(params[i].length && params[i][0] === '#') {
              params[i] = params[i].substring(1);
            }
            kv = params[i].split('=');
            if(kv.length >= 2) {
              if(kv[0]==='access_token') {
                ///XXX: ok im guessing its a base64 string and you somehow adding an = sign to the end of it ok, why?
                var token = unescape(kv[1]);//unescaping is needed in chrome, otherwise you get %3D%3D at the end instead of ==
                for(var i = 2; i < kv.length; i++) {
                  token += '='+kv[i];
                }
                return token;
              }
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
