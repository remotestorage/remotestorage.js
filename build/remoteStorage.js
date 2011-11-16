// INTERFACE:
//
// 1) interface for data is the same as localStorage and sessionStorage, namely:
//
// window.remoteStorage.length
// window.remoteStorage.key(i)
// window.remoteStorage.getItem(key)
// window.remoteStorage.setItem(key, value);
// window.remoteStorage.removeItem(key);
// window.remoteStorage.clear();
//
// Note: we don't support syntactic sugar like localStorage.key or localStorage['key'] - please stick to getItem()/setItem()
//
//
// 2) additional interface to connect/check/disconnect backend:
//
// window.remoteStorage.connect('user@host', 'sandwiches');
// window.remoteStorage.isConnected();//boolean
// window.remoteStorage.getUserAddress();//'user@host'
// window.remoteStorage.disconnect();


(function() {
  if(!window.remoteStorage) {//shim switch
var jsFileName = 'remoteStorage.js';
var cssFilePath = '../style/remoteStorage.css';
      function _tryConnect() {
        oauth.harvestToken(function(token) {
          backend.setToken(token);
        });
        var configuration = remoteStorage.configure();
        backend.connect(configuration.userAddress, configuration.category, function() {
          work();
        });
      }


      ///////////////////////
     // poor man's jQuery //
    ///////////////////////

    //implementing $(document).ready(embody):
    document.addEventListener('DOMContentLoaded', function() {
      document.removeEventListener('DOMContentLoaded', arguments.callee, false );
      {
        var scripts = document.getElementsByTagName('script');
        for(i in scripts) {
          if((new RegExp(jsFileName+'$')).test(scripts[i].src)) {
            var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
            window.remoteStorage.configure(options);
          }
        }
        _tryConnect();
      }
    }, false)

    //implementing $.ajax():
    function ajax(params) {
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
//      if(params.fields) {
//        for(var field in params.fields) {
//          xhr[field] = params.fields[field];
//        }
//      }
      xhr.onreadystatechange = function() {
        if(xhr.readyState == 4) {
          if(xhr.status == 0) {
            //alert('looks like '+params.url+' has no CORS headers on it! try copying this scraper and that file both onto your localhost')
            params.error(xhr);
          } else {
            params.success(xhr.responseText);
          }
        }
      }
      xhr.send(params.data);
    }

    //implementing $():
    function $(str) {
      return document.getElementById(str);
    }

      ///////////////
     // Webfinger //
    ///////////////

    var webfinger = (function(){
      var userAddress, userName, host, templateParts;//this is all a bit messy, but there are a lot of callbacks here, so globals help us with that.
      function getDavBaseAddress(ua, error, cb){
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
            ajax({
              //url: 'https://'+host+'/.well-known/host-meta',
              url: 'http://'+host+'/.well-known/host-meta',
              success: function(data) {
                afterHttpsHostmetaSuccess(data, error, cb);
              },
              error: function(data) {
                afterHttpsHostmetaError(data, error, cb);
              },
            })
          }
        }
      }
      function afterHttpsHostmetaSuccess(data, error, cb) {
        //error('Https Host-meta found.');
        continueWithHostmeta(data, error, cb);
      }

      function afterHttpsHostmetaError(data, error, cb) {
            //error('Https Host-meta error. Trying http.');
            ajax({
              url: 'http://'+host+'/.well-known/host-meta',
              success: function(data) {
                afterHttpHostmetaSuccess(data, error, cb);
              },
              error: function(data) {
                afterHttpHostmetaError(data, error, cb);
              },
            })
      }

      function afterHttpHostmetaSuccess(data, error, cb) {
        //error('Http Host-meta found.');
        continueWithHostmeta(data, error, cb);
      }

      function afterHttpHostmetaError(data, error, cb) {
        error('Cross-origin host-meta failed. Trying through proxy');
        //$.ajax(
        //  { url: 'http://useraddress.net/single-origin-webfinger...really?'+ua
        //   , success: afterWebfingerSuccess
        //   , error: afterProxyError
        //  })
      }

      function continueWithHostmeta(data, error, cb) {
        data = (new DOMParser()).parseFromString(data, 'text/xml');
        if(!data.getElementsByTagName) {
          error('Host-meta is not an XML document, or doesnt have xml mimetype.');
          return;
        }
        var linkTags = data.getElementsByTagName('Link');
        if(linkTags.length == 0) {
          error('no Link tags found in host-meta');
        } else {
          var lrddFound = false;
          var errorStr = 'none of the Link tags have a lrdd rel-attribute';
          for(var linkTagI in linkTags) {
            for(var attrI in linkTags[linkTagI].attributes) {
              var attr = linkTags[linkTagI].attributes[attrI];
              if((attr.name=='rel') && (attr.value=='lrdd')) {
                lrddFound = true;
                errorStr = 'the first Link tag with a lrdd rel-attribute has no template-attribute';
                for(var attrJ in linkTags[linkTagI].attributes) {
                  var attr2 = linkTags[linkTagI].attributes[attrJ];
                  if(attr2.name=='template') {
                    templateParts = attr2.value.split('{uri}');
                    if(templateParts.length == 2) {
                      ajax({
                        url: templateParts[0]+userAddress+templateParts[1],
                        success: function(data) {afterLrddSuccess(data, error, cb);},
                        error: function(data){afterLrddNoAcctError(data, error, cb);},
                      })
                    } else {
                      errorStr = 'the template doesn\'t contain "{uri}"';
                    }
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
      function afterLrddNoAcctError() {
        error('the template doesn\'t contain "{uri}"');
        ajax({
          url: templateParts[0]+'acct:'+ua+templateParts[1],
          success: function() {afterLrddSuccess(error, cb);},
          error: function() {afterLrddAcctError(error, cb);}
        })
      }
      function afterLrddSuccess(data, error, cb) {
        data = (new DOMParser()).parseFromString(data, 'text/xml');
        if(!data.getElementsByTagName) {
          error('Lrdd is not an XML document, or doesnt have xml mimetype.');
          return;
        }
        var linkTags = data.getElementsByTagName('Link');
        if(linkTags.length == 0) {
          error('no Link tags found in lrdd');
        } else {
          var linkFound = false;
          var errorStr = 'none of the Link tags have a remoteStorage rel-attribute';
          for(var linkTagI in linkTags) {
            for(var attrI in linkTags[linkTagI].attributes) {
              var attr = linkTags[linkTagI].attributes[attrI];
              if((attr.name=='rel') && (attr.value=='remoteStorage')) {
                linkFound = true;
                errorStr = 'the first Link tag with a dav rel-attribute has no template-attribute';
                var authAddress, kvAddress, api;
                for(var attrJ in linkTags[linkTagI].attributes) {
                  var attr2 = linkTags[linkTagI].attributes[attrJ];
                  if(attr2.name=='template') {
                    rStemplate = attr2.value;
                  }
                  if(attr2.name=='auth') {
                    rSauth = attr2.value;
                  }
                  if(attr2.name=='api') {
                    rSapi = attr2.value;
                  }
                }
                break;
              }
            }
            if(linkFound) {
              cb(rSauth, rStemplate, rSapi);
              break;
            }
          }
          if(!linkFound) {
            error(errorStr);
          }
        }
      }
      return {getDavBaseAddress: getDavBaseAddress};
    })()
      ///////////////////////////
     // OAuth2 implicit grant //
    ///////////////////////////

    var oauth = (function() {
      function go(address, category, userAddress) {
        var loc = encodeURIComponent((''+window.location).split('#')[0]);
        window.location = address
          + '?client_id=' + loc
          + '&redirect_uri=' + loc
          + '&scope=' + category
          + '&user_address=' + userAddress
          + '&response_type=token';
      }
      function harvestToken(cb) {
        if(location.hash.length == 0) {
          return;
        }
        var params = location.hash.split('&');
        var paramsToStay = [];
        for(param in params){
          if(params[param].length && params[param][0] =='#') {
            params[param] = params[param].substring(1);
          }
          var kv = params[param].split('=');
          if(kv.length >= 2) {
            if(kv[0]=='access_token') {
              var token = kv[1];
              for(var i = 2; i < kv.length; i++) {
                token += '='+kv[i];
              }
              cb(token);
            } else if(kv[0]=='token_type') {
              //ignore silently
            } else {
              paramsToStay.push(params[param]);
            }
          } else {
            paramsToStay.push(params[param]);
          }
        }
        if(paramsToStay.length) {
          window.location='#'+paramsToStay.join('&');
        } else {
          window.location='';
        }
      }
      return {
        go: go,
        harvestToken: harvestToken,
        }
    })()

      //////////////////////
     // GET, PUT, DELETE //
    //////////////////////

    var backend = (function(){
      function keyToAddress(key) {
        var userAddressParts = localStorage.getItem('_remoteStorageUserAddress').split('@')
        var resource = localStorage.getItem('_remoteStorageCategory');
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

      ////////////////////////////////////////
     // asynchronous synchronization tasks //
    ////////////////////////////////////////

      return {
        tryOutbound: function(key, cb) {//presumably we don't have to re-check versions here
          var value=JSON.parse(localStorage.getItem('_remoteStorage_'+key));
          doCall('PUT', key, value, function() {
            //index[key]=revision;
            //localStorage.setItem('remoteStorageIndex', JSON.stringify(index));
            //doCall('PUT', 'remoteStorageIndex', index, cb);
            cb();
          });
        },
        removeItem: function(key, revision, cb) {
          var index = JSON.parse(localStorage.getItem('remoteStorageIndex'));
          if((!index[key]) || (index[key]<revision)) {
            doCall('DELETE', key, null, function() {
              //index[keys]=revision;
              //localStorage.setItem('remoteStorageIndex', JSON.stringify(index));
              //doCall('PUT', 'remoteStorageIndex', index, cb);
              cb();
            });
          }
        },
        connect: function(userAddress, category, cb) {
          var onError = function(errorMsg) {
            alert(errorMsg);
          }
          var callback = function(rsAuth, rStemplate, rSapi) {
            cb();
            var rSkvParts = rStemplate.split('{scope}');
            var rSkv = rSkvParts[0]+category+rSkvParts[1];
            localStorage.setItem('_remoteStorageUserAddress', userAddress);
            localStorage.setItem('_remoteStorageCategory', category);
            localStorage.setItem('_remoteStorageKV', rSkv)
            localStorage.setItem('_remoteStorageAPI', rSapi)
            localStorage.setItem('_remoteStorageAuthAddress', rSauth)
            oauth.go(rSauth, category, userAddress);
          }
          webfinger.getDavBaseAddress(userAddress, onError, callback);
        },
        setToken: function(token) {
          localStorage.setItem('_remoteStorageOauthToken', token);
        },
        sync: function() {
          var localIndex = JSON.parse(localStorage.getItem('remoteStorageIndex'));
          if(!localIndex) {
            localIndex = {};
          }
          doCall('GET', 'remoteStorageIndex', null, function(data) {
            var remoteIndex;
            try {
              remoteIndex = JSON.parse(data.value);
            } catch(e) {
              remoteIndex = {};
            }
            for(var i in remoteIndex) {
              if((localIndex[i] == undefined) || (remoteIndex[i] > localIndex[i])) {//need to pull it
                doCall('GET', i, null, function(data) {
                  localStorage.setItem('_remoteStorage_'+i, data.value);
                  var localIndex = JSON.parse(localStorage.getItem('remoteStorageIndex'));
                  if(!localIndex) {
                    localIndex = {};
                  }
                  localIndex[i]=data.revision;
                  localStorage.setItem('remoteStorageIndex', JSON.stringify(localIndex));
                  var oldValue = localStorage.getItem('_remoteStorage_'+i);
                  if(window.remoteStorage.options.onChange) {
                    window.remoteStorage.options.onChange(i, oldValue, data.value);
                  }
                });
              } else if(remoteIndex[i] < localIndex[i]) {//need to push it
                localValue = localStorage.getItem('_remoteStorage_'+i);
                var obj = JSON.parse(localValue);
                obj.revision = localIndex[i];
                doCall('PUT', i, obj, function() {});
              }
            }
          });
        }
      }
    })()

      ////////////////////////////////////////
     // asynchronous synchronization queue //
    ////////////////////////////////////////

    window.remoteStorage = (function(){
      function work() {
        if(!(localStorage.getItem('_remoteStorageOauthToken'))) {
          return;
        }
        var time = 1;
        var dirties = JSON.parse(localStorage.getItem('_remoteStorageDirties'));
        for(dirty in dirties) {
          //var alreadyWorking = localStorage.getItem('_remoteStorageWorking_'+dirty);
          //if(!alreadyWorking) {
          if(true) {
            //localStorage.setItem('_remoteStorageWorking_'+dirty, time);
            localStorage.setItem('_remoteStorageDirties', JSON.stringify(dirties));
            if(dirties[dirty]) {
              backend.tryOutbound(dirty, function() {
                //localStorage.removeItem('_remoteStorageWorking_'+dirty);
              });
            } else {
              backend.tryInbound(dirty, function() {
                //localStorage.removeItem('_remoteStorageWorking_'+dirty);
              });
            }
            delete dirties[dirty];
          }
        }
      }
      function markDirty(key, outbound) {
        if(outbound==undefined) {
          outbound = true;
        }
        var dirties = JSON.parse(localStorage.getItem('_remoteStorageDirties'));
        if(dirties==null){
          dirties={};
        }
        var time;
        if(outbound) {
          time = new Date().getTime();
        } else {
          time = 0;
        }
        dirties[key] = time;
        localStorage.setItem('_remoteStorageDirties', JSON.stringify(dirties));
      }
      work();

        //////////////////
       // DOM API shim //
      //////////////////

      function calcLength() {
        var len = 0;
        for(var i=0; i<localStorage.length; i++) {
          if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
            len++;
          }
        }
        return len;
      }

      return {
        length: calcLength(),
        _tryConnect: _tryConnect,
        key: function(req) {
          for(var i=0; i<localStorage.length; i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              if(req == 0) {
                return localStorage.key(i).substring(15);
              }
              req--;
            }
          }
        },
        getItem: function(k) {
          var cacheObj = localStorage.getItem('_remoteStorage_'+k);
          if(cacheObj) {
            try {
              return JSON.parse(cacheObj).value;
            }catch(e) {}
          }
          return null;
        },
        setItem: function(k,v) {
          var cacheObj = {};
          var cacheStr = localStorage.getItem('_remoteStorage_'+k);
          if(cacheStr) {
            try {
              var cacheObj = JSON.parse(cacheStr);
              var oldValue = cacheObj.value;
              if(v == oldValue) {
                return;
              }
            }catch(e) {}
          }
          cacheObj.value=v;
          localStorage.setItem('_remoteStorage_'+k, JSON.stringify(cacheObj));
          window.remoteStorage.length = calcLength();
          markDirty(k);
          work();
        },
        removeItem: function(k) {
          localStorage.removeItem('_remoteStorage_'+k);
          window.remoteStorage.length = calcLength();
          markDirty(k);
          work();
        },
        clear: function() {
          var keysToRemove = [];
          for(var i=0;i<localStorage.length;i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              keysToRemove.push(localStorage.key(i));
              keysToRemove.push('_remoteStorageWorking_'+localStorage.key(i));
              markDirty(localStorage.key(i));
            }
          }
          keysToRemove.forEach(function(key){
            localStorage.removeItem(key);
          });
          window.remoteStorage.length = 0;
          work();
        },
        isConnected: function() {
          return (localStorage.getItem('_remoteStorageOauthToken') != null);
        },
        getUserAddress: function() {
          return localStorage.getItem('_remoteStorageUserAddress');
        },
        disconnect: function() {
          localStorage.removeItem('_remoteStorageUserAddress');
          localStorage.removeItem('_remoteStorageCategory');
          localStorage.removeItem('_remoteStorageKV');
          localStorage.removeItem('_remoteStorageAPI');
          localStorage.removeItem('_remoteStorageAuthAddress');
          localStorage.removeItem('_remoteStorageOauthToken');
          localStorage.removeItem('_remoteStorageDirties');
          localStorage.removeItem('remoteStorageIndex');
          var keysToRemove = [];
          for(var i=0; i<localStorage.length; i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              keysToRemove.push(localStorage.key(i));
            }
          }
          keysToRemove.forEach(function(key){
            if(window.remoteStorage.options.onChange) {
              remoteStorage.options.onChange(key.substring(15), localStorage.getItem(key), null);
            }
            localStorage.removeItem(key);
          });
        },
        _init: function() {
          backend.sync();
        },
        cssFilePath: cssFilePath
      }
    })()
  }
})()

  ////////
 // UI //
////////
function DisplayConnectionState() {
  if(remoteStorage.isConnected()) {
    //button to disconnect:
    document.getElementById('userButton').value='Disconnect';
    //display span:
    document.getElementById('userAddress').style.display='inline';
    document.getElementById('userAddress').innerHTML=remoteStorage.getUserAddress();
    //hide input:
    document.getElementById('userAddressInput').style.display='none';
    document.getElementById('userAddressInput').disabled='disabled';
  } else {
    //button to Sign in:
    document.getElementById('userButton').value='Sign in';
    //display input:
    document.getElementById('userAddressInput').value='';
    document.getElementById('userAddressInput').style.display='inline';
    document.getElementById('userAddressInput').disabled='';
    //hide input:
    document.getElementById('userAddress').style.display='none';
    document.getElementById('userAddress').disabled='disabled';
  }
}

function InputKeyUp(el) {
  if(el.value=='') {
    document.getElementById('userButton').className='';
    document.getElementById('userButton').disabled='disabled';
    el.parentNode.style.opacity='.5';
  } else {
    document.getElementById('userButton').disabled='';
    document.getElementById('userButton').className='green';
    el.parentNode.style.opacity='1';
  }
}
function SpanMouseOver(el) {
  el.className='red';
}
function SpanMouseOut(el) {
  el.className='';
}
function SpanClick(el) {
  window.remoteStorage.disconnect();
}
function ButtonClick(el, category) {
  if(window.remoteStorage.isConnected()) {
    window.remoteStorage.disconnect();
    DisplayConnectionState();
  } else {
    if(document.getElementById('userAddressInput').value!='') {
      window.remoteStorage._tryConnect();
      window.remoteStorage.configure({
        userAddress: document.getElementById('userAddressInput').value,
        category: category
      });
      DisplayConnectionState();
    }
  }
}

function NeedLoginBox() {
  if(window.remoteStorage.options.suppressDialog) {
    return 'none';
  } else {
    return 'legacy';
  }
}

window.remoteStorage.configure = function(setOptions) {
  window.remoteStorage.options = {//set defaults
    category: location.host,
    onChange: function() {},
    preferBrowserSessionIfNative: true,
    preferBrowserIdIfNative: true,
    preferBrowserIdAlways: false
  };
  if(setOptions) {
    for(var option in setOptions) {
      window.remoteStorage.options[option] = setOptions[option];
    }
  }
  if(window.remoteStorage.options.userAddress) {
    localStorage.setItem('_remoteStorageUserAddress', window.remoteStorage.options.userAddress);
  }
  if(window.remoteStorage.options.token) {
    localStorage.setItem('_remoteStorageOauthToken', window.remoteStorage.options.token);
  }

  if(NeedLoginBox()=='legacy') {
    var divEl = document.createElement('div');
    divEl.id = 'remoteStorageDiv';
    divEl.innerHTML = '<link rel="stylesheet" href="'+remoteStorage.cssFilePath+'" />'
      +'<input id="userAddressInput" type="text" placeholder="you@yourremotestorage" onkeyup="InputKeyUp(this);">'
      +'<span id="userAddress" style="display:none" onmouseover="SpanMouseOver(this);" onmouseout="SpanMouseOut(this);" onclick="SpanClick(this)"></span>'
      +'<input id="userButton" type="submit" value="Sign in" onclick="ButtonClick(this,'
      +'\''+window.remoteStorage.options.category+'\')">';
    document.body.insertBefore(divEl, document.body.firstChild);
  }
  window.remoteStorage._tryConnect();
  if(window.remoteStorage.isConnected()) {
    window.remoteStorage._init();
  }
  if(NeedLoginBox()=='legacy') {
    DisplayConnectionState();
  }
  return window.remoteStorage.options;
}
