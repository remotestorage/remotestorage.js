define(['./ajax'], function(ajax) {
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
        error: function(err) {
          if(err == 404) {
            cb(null, undefined);
          } else {
            cb(err, null);
          }
        },
        success: function(data) {
          cb(null, data);
        },
        timeout: 3000
      };
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
      doCall('PUT', storageAddress+normalizeKey(key), JSON.stringify(obj), token, function(err) {
        if(err) {
          if(err == 409) {//conflict; fetch, update and retry
            doCall('GET', storageAddress+normalizeKey(key), null, token, function(err2, data) {
              if(err2) {
                cb('after 409, got a '+err2);
              } else {
                var rightRev;
                try {
                  rightRev=JSON.parse(data)._rev;
                } catch(e) {
                }
                if(rightRev) {
                  obj = {
                    value: value,
                    _rev: rightRev
                  };
                  localStorage.setItem('_shadowCouchRev_'+key, rightRev);
                  doCall('PUT', storageAddress+normalizeKey(key), JSON.stringify(obj), token, function(err3) {
                    if(err3) {
                      cb('after 409, second attempt got '+err3);
                    } else {
                      cb(null);
                    }
                  });
                } else {
                  cb('after 409, got unparseable JSON');
                }
              }
            });
          } else {
            cb(err);
          }
        } else {
          var obj = JSON.parse(data);
          if(obj.rev) {
            localStorage.setItem('_shadowCouchRev_'+key, obj.rev);
          }
          cb(null);
        }
      });
    }
    function delete_(storageAddress, token, key, cb) {
      var revision = localStorage.getItem('_shadowCouchRev_'+key);
      doCall('DELETE', storageAddress+normalizeKey(key)+'?rev='+revision, null, token, cb);
    }
    return {
      get: get,
      put: put,
      delete: delete_
    };
});
