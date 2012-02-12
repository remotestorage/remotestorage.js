
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
    function doCall(method, key, value, token, cb) {
      var ajaxObj = {
        url: key,
        method: method,
        error: cb,
        success: cb
      }
      if(token) {
        ajaxObj.headers= {Authorization: 'Bearer '+token};
      }
      ajaxObj.fields={withCredentials: 'true'};
      if(method!='GET') {
        ajaxObj.data=value;
      }
      ajax.ajax(ajaxObj);
    }
    function get(storageAddress, token, key, cb) {
      doCall('GET', storageAddress+normalizeKey(key), null, token, function(err, data) {
        if(err) {
          cb(err, data);
        } else {
          var obj = JSON.parse(data);
          localStorage.setItem('_shadowCouchRev_'+key, obj._rev);
          cb(null, obj.value);
        }
      });
    }
    function put(storageAddress, token, key, value, cb) {
      var revision = localStorage.getItem('_shadowCouchRev_'+key);
      var obj = {
        value: value
      };
      if(revision) {
        obj._rev = revision;
      }
      doCall('PUT', storageAddress+normalizeKey(key), JSON.stringify(obj), token, function(err, data) {
        if(err) {
          cb(err, data);
        } else {
          var obj = JSON.parse(data);
          if(obj.rev) {
            localStorage.setItem('_shadowCouchRev_'+key, obj.rev);
          }
          cb(null, null);
        }
      });
    }
    function delete_(storageAddress, token, key, cb) {
      doCall('DELETE', storageAddress+normalizeKey(key), null, token, cb);
    }
    return {
      get: get,
      put: put,
      delete: delete_
    };
});
