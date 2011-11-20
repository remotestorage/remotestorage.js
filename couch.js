exports.couch = (function() {
  
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
  function doCall(method, key, obj, err, cb, timeout) {
    var ajaxObj = {
      url: keyToAddress(key),
      method: method,
      error: err,
      success: cb,
      timeout: timeout
    }
    ajaxObj.headers= {Authorization: 'Bearer '+localStorage.getItem('_shadowBackendToken')};
    ajaxObj.fields={withCredentials: 'true'};
    if(method!='GET') {
      ajaxObj.data=JSON.stringify(obj);
    }
    exports.ajax(ajaxObj);
  }
  function init(address, bearerToken) {
    localStorage.setItem('_shadowBackendAddress', address);
    localStorage.setItem('_shadowBackendToken', bearerToken);
  }
  function get(key, err, cb, timeout) {
    console.log('couch.get("'+key+'", err, cb, '+timeout+');');
    doCall('GET', key, null, err, function(str) {
      var obj = JSON.parse(str);
      localStorage.setItem('_shadowCouchRev_'+key, obj._rev);
      cb(obj.value);
    }, timeout);
  }
  function set(key, value, err, cb, timeout) {
    console.log('couch.set("'+key+'", "'+value+'", err, cb, '+timeout+');');
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
    }, timeout);
  }
  function remove(key, err, cb, timeout) {
    console.log('couch.remove("'+key+'", err, cb, '+timeout+');');
    doCall('DELETE', key, null, err, cb, timeout);
  }
  return {
    init: init,
    set: set,
    get: get,
    remove: remove
  };
})();

