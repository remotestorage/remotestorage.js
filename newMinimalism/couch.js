exports.couch = (function() {
  
  function keyToAddress(key) {
    return localStorage.getItem('_shadowBackendAddress') + key;
  }
  function doCall(method, key, obj, cb) {
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
      error: function(xhr) {
        if(xhr.status==409) {//resolve CouchDB conflict:
          doCall('GET', key, null, function(text) {
            var correctVersion=JSON.parse(text);
            correctVersion.value=obj.value;
            doCall('PUT', key, correctVersion, cb);
          });
        } else {
          cb({
            success:false,
            error: xhr.status
          });
        }
      },
    }
    ajaxObj.headers= {Authorization: 'Bearer '+localStorage.getItem('_remoteStorageOauthToken')};
    ajaxObj.fields={withCredentials: 'true'};
    if(method!='GET') {
      ajaxObj.data=JSON.stringify(obj);
    }
    ajax(ajaxObj);
  }
  function init(api, address) {
    localStorage.setItem('_shadowBackendApi', api);
    localStorage.setItem('_shadowBackendAddress', address);
  }
  function get(key, err, cb, timeout) {
    console.log('couch.get("'+key+'", "'+value+'", err, cb, '+timeout+');');
    doCall('GET', key, null, cb);
  }
  function set(key, value, err, cb, timeout) {
    console.log('couch.set("'+key+'", "'+value+'", err, cb, '+timeout+');');
    doCall('PUT', key, value, cb);
  }
  function remove(key, err, cb, timeout) {
    console.log('couch.remove("'+key+'", "'+value+'", err, cb, '+timeout+');');
    doCall('DELETE', key, null, cb);
  }
  return {
    init: init,
    set: set,
    get: get,
    remove: remove
  };
})();

