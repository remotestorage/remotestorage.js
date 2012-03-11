define(
  ['./platform'],
  function (platform) {
    function normalizeKey(key) {
      var i = 0;
      while(i < key.length && key[i] == 'u') {
       i++;
      }
      if((i < key.length) && (key[i] == '_')) {
        key = 'u'+key;
      }
      return key;
    }

    function doCall(method, key, value, token, cb, deadLine) {
      var platformObj = {
        url: key,
        method: method,
        error: function(err) {
          if(err == 404) {
            cb(null, undefined);
          } else {
            cb(err, null);
          }
        },
        success: function(data) {
          cb(null, data);
        },
        timeout: 3000
      }

      platformObj.headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'text/plain;charset=UTF-8'
      };

      platformObj.fields = {withCredentials: 'true'};
      if(method != 'GET') {
        platformObj.data =value;
      }

      platform.ajax(platformObj);
    }

    function get(storageAddress, token, key, cb) {
      doCall('GET', storageAddress+normalizeKey(key), null, token, cb);
    }

    function put(storageAddress, token, key, value, cb) {
      doCall('PUT', storageAddress+normalizeKey(key), value, token, cb);
    }

    function delete_(storageAddress, token, key, cb) {
      doCall('DELETE', storageAddress+normalizeKey(key), null, token, cb);
    }

    return {
      get:    get,
      put:    put,
      delete: delete_
    }
});
