
      //////////////////////
     // GET, PUT, DELETE //
    //////////////////////

    var backend = (function(){
      function keyToAddress(key) {
        var userAddressParts = localStorage.getItem('_remoteStorageUserAddress').split('@')
        var resource = localStorage.getItem('_remoteStorageDataScope');
        var address = localStorage.getItem('_remoteStorageKV') + key
        return address
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
            cb({
              success:false,
              error: xhr.status
            });
          },
        }
        ajaxObj.headers= {Authorization: 'Bearer '+localStorage.getItem('_remoteStorageOauthToken')};
        ajaxObj.fields={withCredentials: 'true'};
        if(method!='GET') {
          ajaxObj.data=JSON.stringify(obj);
        }
        ajax(ajaxObj);
      }
