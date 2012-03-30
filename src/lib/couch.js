define(
  ['./platform'],
  function (platform) {
    var shadowCouchRev = null;
    function getShadowCouchRev(url) {
      if(!shadowCouchRev) {
        try {
          shadowCouchRev = JSON.parse(localStorage.getItem('_shadowCouchRev'));
        } catch(e) {
        }
        if(!shadowCouchRev) {
          shadowCouchRev = {};
        }
      }
      return shadowCouchRev[url];
    }
    function setShadowCouchRev(url, rev) {
      if(!shadowCouchRev) {
        try {
          shadowCouchRev=JSON.parse(localStorage.getItem('_shadowCouchRev'));
        } catch(e) {
        }
      }
      if(!shadowCouchRev) {
        shadowCouchRev = {};
      }
      shadowCouchRev[url] = rev;
      localStorage.setItem('_shadowCouchRev', JSON.stringify(shadowCouchRev));
    }
    function doCall(method, url, value, token, cb) {
      var platformObj = {
        url: url,
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
        platformObj.headers = {Authorization: 'Bearer '+token};
      }
      platformObj.fields = {withCredentials: 'true'};
      if(method!='GET') {
        platformObj.data = value;
      }
      platform.ajax(platformObj);
    }
    function get(url, token, cb) {
      doCall('GET', url, null, token, function(err, data) {
        if(err) {
          cb(err, data);
        } else {
          var obj;
          try {
            obj = JSON.parse(data);
          } catch(e) {
          }
          if(obj && obj._rev) {
            setShadowCouchRev(url, obj._rev);
            cb(null, obj.value);
          } else if(typeof(data) == 'undefined') {
            cb(null, undefined);
          } else {
            cb('unparsable data from couch');
          }
        }
      });
    }
    function put(url, value, token, cb) {
      var revision = getShadowCouchRev(url);
      var obj = {
        value: value
      };
      if(revision) {
        obj._rev = revision;
      }
      doCall('PUT', url, JSON.stringify(obj), token, function(err, data) {
        if(err) {
          if(err == 409) {//conflict; fetch, update and retry
            doCall('GET', url, null, token, function(err2, data2) {
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
                  setShadowCouchRev(url, rightRev);
                    doCall('PUT', url, JSON.stringify(obj), token, function(err3, data3) {
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
            setShadowCouchRev(url, obj.rev);
          }
          cb(null);
        }
      });
    }
    function delete_(url, token, cb) {
      var revision = getShadowCouchRev(url);
      doCall('DELETE', url+(revision?'?rev='+revision:''), null, token, function(err, data) {
        if(err == 409) {
          doCall('GET', url, null, token, function(err2, data2) {
            if(err2) {
              cb('after 409, got a '+err2);
            } else {
              var rightRev;
              try {
                rightRev = JSON.parse(data2)._rev;
              } catch(e) {
              }
              if(rightRev) {
                setShadowCouchRev(url, rightRev);
                doCall('DELETE', url + '?rev=' + rightRev, null, token, function(err3, data3) {
                  if(err3) {
                    cb('after 409, second attempt got '+err3);
                  } else {
                    setShadowCouchRev(url, undefined);
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
            setShadowCouchRev(url, undefined);
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
