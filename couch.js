exports.couch = (function() {
  
  function keyToAddress(key) {
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
    doCall('GET', key, null, err, cb, timeout);
  }
  function set(key, value, err, cb, timeout) {
    console.log('couch.set("'+key+'", "'+value+'", err, cb, '+timeout+');');
    doCall('PUT', key, value, err, cb, timeout);
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

