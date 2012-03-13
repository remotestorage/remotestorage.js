define(
  ['./platform'],
  function (platform) {
    var shadowCouchRev=null;
    function getShadowCouchRev(key) {
      if(!shadowCouchRev) {
        try {
          shadowCouchRev=JSON.parse(localStorage.getItem('_shadowCouchRev'));
        } catch(e) {
        }
        if(!shadowCouchRev) {
          shadowCouchRev={};
        }
      }
      return shadowCouchRev[key];
    }
    function setShadowCouchRev(key, rev) {
      if(!shadowCouchRev) {
        try {
          shadowCouchRev=JSON.parse(localStorage.getItem('_shadowCouchRev'));
        } catch(e) {
        }
      }
      if(!shadowCouchRev) {
        shadowCouchRev={};
      }
      shadowCouchRev[key]=rev;
      localStorage.setItem('_shadowCouchRev', JSON.stringify(shadowCouchRev));
    }
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
      var platformObj = {
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
        platformObj.headers= {Authorization: 'Bearer '+token};
      }
      platformObj.fields={withCredentials: 'true'};
      if(method!='GET') {
        platformObj.data=value;
      }
      platform.ajax(platformObj);
    }
    function get(storageAddress, token, key, cb) {
      doCall('GET', storageAddress+normalizeKey(key), null, token, function(err, data) {
        if(err) {
          cb(err, data);
        } else {
          var obj;
          try {
            obj = JSON.parse(data);
          } catch(e) {
          }
          if(obj && obj._rev) {
            setShadowCouchRev(key, obj._rev);
            cb(null, obj.value);
          } else if(typeof(data) == 'undefined') {
            cb(null, undefined);
          } else {
            cb('unparsable data from couch');
          }
        }
      });
    }
    function put(storageAddress, token, key, value, cb) {
      var revision = getShadowCouchRev(key);
      var obj = {
        value: value
      };
      if(revision) {
        obj._rev = revision;
      }
      doCall('PUT', storageAddress+normalizeKey(key), JSON.stringify(obj), token, function(err, data) {
        if(err) {
          if(err == 409) {//conflict; fetch, update and retry
            doCall('GET', storageAddress+normalizeKey(key), null, token, function(err2, data2) {
              if(err2) {
                cb('after 409, got a '+err2);
              } else {
                var rightRev;
                try {
                  rightRev=JSON.parse(data2)._rev;
                } catch(e) {
                }
                if(rightRev) {
                  obj = {
                    value: value,
                    _rev: rightRev
                  };
                  setShadowCouchRev(key, rightRev);
                    doCall('PUT', storageAddress+normalizeKey(key), JSON.stringify(obj), token, function(err3, data3) {
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
          var obj;
          try {
            obj = JSON.parse(data);
          } catch(e) {
          }
          if(obj && obj.rev) {
            setShadowCouchRev(key, obj.rev);
          }
          cb(null);
        }
      });
    }
    function delete_(storageAddress, token, key, cb) {
      var revision = getShadowCouchRev(key);
      doCall('DELETE', storageAddress+normalizeKey(key)+(revision?'?rev='+revision:''), null, token, function(err, data) {
        if(err==409) {
          doCall('GET', storageAddress+normalizeKey(key), null, token, function(err2, data2) {
            if(err2) {
              cb('after 409, got a '+err2);
            } else {
              var rightRev;
              try {
                rightRev=JSON.parse(data2)._rev;
              } catch(e) {
              }
              if(rightRev) {
                setShadowCouchRev(key, rightRev);
                doCall('DELETE', storageAddress+normalizeKey(key)+'?rev='+rightRev, null, token, function(err3, data3) {
                  if(err3) {
                    cb('after 409, second attempt got '+err3);
                  } else {
                    setShadowCouchRev(key, undefined);
                    cb(null);
                  }
                });
              } else {
                cb('after 409, got unparseable JSON');
              }
            }
          });
        } else {
          if(!err) {
            setShadowCouchRev(key, undefined);
          }
          cb(err);
        }
      });
    }
    return {
      get: get,
      put: put,
      delete: delete_
    };
});
