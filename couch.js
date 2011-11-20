exports.couch = (function() {
  
  function keyToAddress(key) {
    return localStorage.getItem('_shadowBackendAddress') + key;
  }
  function doCall(method, key, obj, err, cb, timeout) {
    var ajaxObj = {
      url: keyToAddress(key),
      method: method,
      success: function(text){
        var retObj={};
        try {//this is not necessary for current version of protocol, but might be in future:
          retObj = JSON.parse(text);
          retObj.success = true;
          if(retObj.rev) {//store rev as _rev in localStorage
            obj._rev = retObj.rev;
            localStorage.setItem('_remoteStorage_'+key, JSON.stringify(obj));
          }
        } catch(e){
          retObj.success = false;
        }
        cb(retObj);
      },
      error: err,
      timeout: timeout
    }
    ajaxObj.headers= {Authorization: 'Bearer '+localStorage.getItem('_remoteStorageOauthToken')};
    ajaxObj.fields={withCredentials: 'true'};
    if(method!='GET') {
      ajaxObj.data=JSON.stringify(obj);
    }
    exports.ajax(ajaxObj);
  }
  function init(address) {
    localStorage.setItem('_shadowBackendApi', api);
    localStorage.setItem('_shadowBackendAddress', address);
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

