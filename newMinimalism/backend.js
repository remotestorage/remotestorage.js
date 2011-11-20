var backend = (function() {
  function init(api, address) {
    localStorage.setItem('_shadowBackendApi', api);
    localStorage.setItem('_shadowBackendAddress', address);
  }
  function get(key, err, cb, timeout) {
    console.log('backend.get("'+key+'", "'+value+'", err, cb, '+timeout+');');
  }
  function set(key, value, err, cb, timeout) {
    console.log('backend.set("'+key+'", "'+value+'", err, cb, '+timeout+');');
  }
  function remove(key, err, cb, timeout) {
    console.log('backend.remove("'+key+'", "'+value+'", err, cb, '+timeout+');');
  }
  return {
    init: init,
    set: set,
    get: get,
    remove: remove
  };
})();
