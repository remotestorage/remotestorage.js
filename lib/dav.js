define(['./ajax'], function(ajax) {
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
      var ajaxObj = {
        url: key,
        method: method,
        error: function(err) {
          cb(err, null);
        },
        success: function(data) {
          try {
            data = JSON.parse(data);//this is a temporary thing, only on Libre Docs
          } catch(e) {
            cb(418, null);
          }
          cb(null, data);
        },
        timeout: 3000
      };

      ajaxObj.headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'text/plain;charset=UTF-8'
      };

      ajaxObj.fields = {withCredentials: 'true'};
      if(method != 'GET') {
        ajaxObj.data =JSON.stringify(value);//this is a temporary thing, only on Libre Docs
      }

      ajax.ajax(ajaxObj);
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
