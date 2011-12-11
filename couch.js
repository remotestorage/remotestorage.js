
define(['./ajax'], function(ajax) {
    function keyToAddress(key) {
      var i = 0;
      while(i < key.length && key[i] =='u') {
       i++;
      }
      if((i < key.length) && (key[i] == '_')) {
        key = 'u'+key;
      }
      return localStorage.getItem('_shadowBackendAddress') + key;
    }
    function doCall(method, key, value, err, cb, deadLine) {
      var ajaxObj = {
        url: keyToAddress(key),
        method: method,
        error: err,
        success: cb,
        deadLine: deadLine
      }
      ajaxObj.headers= {Authorization: 'Bearer '+localStorage.getItem('_shadowBackendToken')};
      ajaxObj.fields={withCredentials: 'true'};
      if(method!='GET') {
        ajaxObj.data=value;
      }
      ajax.ajax(ajaxObj);
    }
    function init(address, bearerToken) {
      localStorage.setItem('_shadowBackendAddress', address);
      localStorage.setItem('_shadowBackendToken', bearerToken);
    }
    function get(key, err, cb, deadLine) {
      console.log('couch.get("'+key+'", err, cb, '+deadLine+');');
      doCall('GET', key, null, err, function(str) {
        var obj = JSON.parse(str);
        localStorage.setItem('_shadowCouchRev_'+key, obj._rev);
        cb(obj.value);
      }, deadLine);
    }
    function set(key, value, err, cb, deadLine) {
      console.log('couch.set("'+key+'", "'+value+'", err, cb, '+deadLine+');');
      var revision = localStorage.getItem('_shadowCouchRev_'+key);
      var obj = {
        value: value
      };
      if(revision) {
        obj._rev = revision;
      }
      doCall('PUT', key, JSON.stringify(obj), err, function(str) {
        var obj = JSON.parse(str);
        if(obj.rev) {
          localStorage.setItem('_shadowCouchRev_'+key, obj.rev);
        }
        cb();
      }, deadLine);
    }
    function remove(key, err, cb, deadLine) {
      console.log('couch.remove("'+key+'", err, cb, '+deadLine+');');
      doCall('DELETE', key, null, err, cb, deadLine);
    }
    return {
      init: init,
      set: set,
      get: get,
      remove: remove
    }
});
