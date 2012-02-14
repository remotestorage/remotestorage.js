
define(['http://unhosted.org/lib/ajax-0.4.2.js'], function(ajax) {
    function normalizeKey(key) {
      var i = 0;
      while(i < key.length && key[i] =='u') {
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
          cb(null, data);
        }
      }
      ajaxObj.headers= {Authorization: 'Bearer '+token};
      ajaxObj.fields={withCredentials: 'true'};
      if(method!='GET') {
        ajaxObj.data=value;
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
      get: get,
      put: put,
      delete: delete_
    }
});
