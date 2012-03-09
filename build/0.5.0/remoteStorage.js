var remoteStorage = (function() {
//implementing $.ajax() like a poor man's jQuery:

      //////////
     // ajax //
    //////////

var ajax = (function() {
  var ajax = function(params) {
    var timedOut = false;
    var timer;
    if(params.timeout) {
      timer = window.setTimeout(function() {
        timedOut = true;
        params.error('timeout');
      }, params.timeout);
    }
    var xhr = new XMLHttpRequest();
    if(!params.method) {
      params.method='GET';
    }
    if(!params.data) {
      params.data = null;
    }
    xhr.open(params.method, params.url, true);
    if(params.headers) {
      for(var header in params.headers) {
        xhr.setRequestHeader(header, params.headers[header]);
      }
    }
    xhr.onreadystatechange = function() {
      if((xhr.readyState == 4) && (!timedOut)) {
        if(timer) {
          window.clearTimeout(timer);
        }
        if(xhr.status == 200 || xhr.status == 201 || xhr.status == 204) {
          params.success(xhr.responseText);
        } else {
          params.error(xhr.status);
        }
      }
    }
    xhr.send(params.data);
  };
  return {
    ajax: ajax
  };
})();
var couch = (function(ajax) {
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
        shadowCouchRev={};
      }
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
})(ajax);
var dav = (function(ajax) {
  function normalizeKey(key) {
    var i = 0;
    while(i < key.length && key[i] == 'u') {
     i++;
    }
    if((i < key.length) && (key[i] == '_')) {
      key = 'u'+key;
    }
    return key;
  }

  function doCall(method, key, value, token, cb, deadLine) {
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
    }

    ajaxObj.headers = {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'text/plain;charset=UTF-8'
    };

    ajaxObj.fields = {withCredentials: 'true'};
    if(method != 'GET') {
      ajaxObj.data =value;
    }

    ajax.ajax(ajaxObj);
  }

  function get(storageAddress, token, key, cb) {
    doCall('GET', storageAddress+normalizeKey(key), null, token, cb);
  }

  function put(storageAddress, token, key, value, cb) {
    doCall('PUT', storageAddress+normalizeKey(key), value, token, cb);
  }

  function delete_(storageAddress, token, key, cb) {
    doCall('DELETE', storageAddress+normalizeKey(key), null, token, cb);
  }

  return {
    get:    get,
    put:    put,
    delete: delete_
  }
})(ajax);
var webfinger = (function(ajax) {

    ///////////////
   // Webfinger //
  ///////////////

  var options, userAddress, userName, host, templateParts;//this is all a bit messy, but there are a lot of callbacks here, so globals help us with that.
  function getAttributes(ua, setOptions, error, cb){
    options = setOptions;
    userAddress = ua;
    var parts = ua.split('@');
    if(parts.length < 2) {
      error('That is not a user address. There is no @-sign in it');
    } else if(parts.length > 2) {
      error('That is not a user address. There is more than one @-sign in it');
    } else {
      if(!(/^[\.0-9A-Za-z]+$/.test(parts[0]))) {
        error('That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+parts[0]+'"');
      } else if(!(/^[\.0-9A-Za-z\-]+$/.test(parts[1]))) {
        error('That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+parts[1]+'"');
      } else {
        userName = parts[0];
        host = parts[1];
        //error('So far so good. Looking up https host-meta for '+host);
        ajax.ajax({
          url: 'https://'+host+'/.well-known/host-meta',
          success: function(data) {
            afterHostmetaSuccess(data, error, cb);
          },
          error: function(data) {
            afterHttpsHostmetaError(error, cb);
          },
          timeout: 3000
        })
      }
    }
  }

  function afterHttpsHostmetaError(error, cb) {
    if(options.allowHttpWebfinger) {
      //console.log('Https Host-meta error. Trying http.');
      ajax.ajax({
        url: 'http://'+host+'/.well-known/host-meta',
        success: function(data) {
          afterHostmetaSuccess(data, error, cb);
        },
        error: function(err) {
          afterHttpHostmetaError(error, cb);
        },
        timeout: 3000
      })
    } else {
       afterHttpHostmetaError(error, cb);
    }
  }

  function afterHttpHostmetaError(error, cb) {
    if(options.allowFakefinger) {
      //console.log('Trying Fakefinger');
      ajax.ajax({
        url: 'http://proxy.unhosted.org/lookup?q='+encodeURIComponent('acct:'+userAddress),
        success: function(data) {
          cb(JSON.parse(data));
        },
        error: function(err) {
          afterFakefingerError(error, cb);
        },
        timeout: 3000
      });
    } else {
      afterFakefingerError(error, cb);
    }
  }
  function afterFakefingerError(error, cb) {
    error(5, 'user address "'+userAddress+'" doesn\'t seem to have remoteStorage linked to it');
  }
  function continueWithTemplate(template, error, cb) {
    var templateParts = template.split('{uri}');
    if(templateParts.length == 2) {
      ajax.ajax({
        url: templateParts[0]+'acct:'+userAddress+templateParts[1],
        success: function(data) {afterLrddSuccess(data, error, cb);},
        error: function(err){
          afterLrddNoAcctError(error, cb);
        },
        timeout: 3000
      });
    } else {
      errorStr = 'the template doesn\'t contain "{uri}"';
    }
  }
  function afterHostmetaSuccess(data, error, cb) {
    var dataXml = (new DOMParser()).parseFromString(data, 'text/xml');
    if(!dataXml.getElementsByTagName) {
      error('Host-meta is not an XML document, or doesnt have xml mimetype.');
      return;
    }
    var linkTags = dataXml.getElementsByTagName('Link');
    if(linkTags.length == 0) {
      //console.log('no Link tags found in host-meta, trying as JSON');
      try{
        continueWithTemplate(JSON.parse(data).links.lrdd[0].template, error, cb);
      } catch(e) {
        error('JSON parsing failed - '+data);
      }
    } else {
      var lrddFound = false;
      var errorStr = 'none of the Link tags have a lrdd rel-attribute';
      for(var linkTagI = 0; linkTagI < linkTags.length; linkTagI++) {
        for(var attrI = 0; attrI < linkTags[linkTagI].attributes.length; attrI++) {
          var attr = linkTags[linkTagI].attributes[attrI];
          if((attr.name=='rel') && (attr.value=='lrdd')) {
            lrddFound = true;
            errorStr = 'the first Link tag with a lrdd rel-attribute has no template-attribute';
            for(var attrJ = 0; attrJ < linkTags[linkTagI].attributes.length; attrJ++) {
              var attr2 = linkTags[linkTagI].attributes[attrJ];
              if(attr2.name=='template') {
                continueWithTemplate(attr2.value, error, cb);
                break;
              }
            }
            break;
          }
        }
        if(lrddFound) {
          break;
        }
      }
      if(!lrddFound) {
        error(errorStr);//todo: make this error flow nicer
      }
    }
  }
  function afterLrddNoAcctError(error, cb) {
    error('the template doesn\'t contain "{uri}"');
  }
  function afterLrddSuccess(data, error, cb) {
    var dataXml = (new DOMParser()).parseFromString(data, 'text/xml');
    if(!dataXml.getElementsByTagName) {
      error('Lrdd is not an XML document, or doesnt have xml mimetype.');
      return;
    }
    var linkTags = dataXml.getElementsByTagName('Link');
    if(linkTags.length == 0) {
      //console.log('trying to pars lrdd as jrd');
      try {
        cb(JSON.parse(data).links.remoteStorage[0]);
      } catch(e) {
        error('no Link tags found in lrdd');
      }
    } else {
      var linkFound = false;
      var errorStr = 'none of the Link tags have a remoteStorage rel-attribute';
      for(var linkTagI = 0; linkTagI < linkTags.length; linkTagI++) {
        var attributes = {};
        for(var attrI = 0; attrI < linkTags[linkTagI].attributes.length; attrI++) {
          var attr = linkTags[linkTagI].attributes[attrI];
          if((attr.name=='rel') && (attr.value=='remoteStorage')) {
            linkFound = true;
            errorStr = 'the first Link tag with a dav rel-attribute has no template-attribute';
            for(var attrJ = 0; attrJ < linkTags[linkTagI].attributes.length; attrJ++) {
              var attr2 = linkTags[linkTagI].attributes[attrJ];
              if(attr2.name=='template') {
                attributes.template = attr2.value;
              }
              if(attr2.name=='auth') {
                attributes.auth = attr2.value;
              }
              if(attr2.name=='api') {
                attributes.api = attr2.value;
              }
            }
            break;
          }
        }
        if(linkFound) {
          cb(attributes);
          break;
        }
      }
      if(!linkFound) {
        error(errorStr);
      }
    }
  }
  function resolveTemplate(template, dataCategory) {
    var parts = template.split('{category}');
    if(parts.length != 2) {
      return 'cannot-resolve-template:'+template;
    }
    return parts[0]+dataCategory+parts[1];
  }
  return {
    getAttributes: getAttributes,
    resolveTemplate: resolveTemplate
  }
})(ajax);
var remoteStorage = (function(couch, dav, webfinger) {
  var onError = function (code, msg) {
      console.log(msg);
    },
    getStorageInfo = function (userAddress, cb) {
      webfinger.getAttributes(
        userAddress, {
          allowHttpWebfinger: true,
          allowSingleOriginWebfinger: false,
          allowFakefinger: true
        },
        function (err, data) {
          cb(err, null);
        },
        function (attributes) {
          cb(0, attributes);
          var storageAddresses = {};
        }
      );
    },
    createOAuthAddress = function (storageInfo, categories, redirectUri) {
      var terms = [
        'redirect_uri='+encodeURIComponent(redirectUri),
        'scope='+encodeURIComponent(categories.join(',')),
        'response_type=token',
        'client_id='+encodeURIComponent(redirectUri)
      ];
      return storageInfo.auth + (storageInfo.auth.indexOf('?') === -1?'?':'&') + terms.join('&');
    },
    getDriver = function (api, cb) {
      cb(api === 'CouchDB'?couch:dav);
    },
    createClient = function (storageInfo, category, token) {
      var storageAddress = webfinger.resolveTemplate(storageInfo.template, category);
      return {
        get: function (key, cb) {
          if(typeof('key') != 'string') {
            cb('argument "key" should be a string');
          } else {
            getDriver(storageInfo.api, function (d) {
              d.get(storageAddress, token, key, cb);
            });
          }
        },
        put: function (key, value, cb) {
          if(typeof('key') != 'string') {
            cb('argument "key" should be a string');
          } else if(typeof('value') != 'string') {
            cb('argument "value" should be a string');
          } else {
            getDriver(storageInfo.api, function (d) {
              d.put(storageAddress, token, key, value, cb);
            });
          }
        },
        'delete': function (key, cb) {
          if(typeof('key') != 'string') {
            cb('argument "key" should be a string');
          } else {
            getDriver(storageInfo.api, function (d) {
              d['delete'](storageAddress, token, key, cb);
            });
          }
        }
      };
    },
    receiveToken = function () {
      var params, kv;
      if(location.hash.length > 0) {
        params = location.hash.split('&');
        for(var i = 0; i < params.length; i++) {
          if(params[i][0]=='#') {
            params[i] = params[i].substring(1);
          }
          if(params[i].substring(0, 'access_token='.length)=='access_token=') {
            return params[i].substring('access_token='.length);
          }
        }
      }
      return null;
    };

  return {
    getStorageInfo     : getStorageInfo,
    createOAuthAddress : createOAuthAddress,
    createClient       : createClient,
    receiveToken       : receiveToken
  };
})(couch, dav, webfinger);
  return remoteStorage;
})();
