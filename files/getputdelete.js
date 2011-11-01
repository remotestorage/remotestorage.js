
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
      function doCall(method, key, value, revision, cb) {
        var ajaxObj = {
          url: keyToAddress(key),
          method: method,
          success: function(text){
            var obj={};
            try {//this is not necessary for current version of protocol, but might be in future:
              obj = JSON.parse(text);
              obj.success = true;
            } catch(e){
              obj.success = false;
            }
            cb(obj);
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
          ajaxObj.data=JSON.stringify({
            value: value,
            revision: revision
          });
        }
        ajax(ajaxObj);
      }
