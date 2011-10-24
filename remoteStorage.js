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

      ///////////////////////
     // poor man's jQuery //
    ///////////////////////

    //implementing $(document).ready(embody):
    document.addEventListener('DOMContentLoaded', function() {
      document.removeEventListener('DOMContentLoaded', arguments.callee, false );
      {
        var scripts = document.getElementsByTagName('script');
	for(i in scripts) {
          if(/remoteStorage.js$/.test(scripts[i].src)) {
            var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
            window.remoteStorage.init(options);
          }
        }
        oauth.harvestToken(function(token) {
          backend.setToken(token);
          //backend.sync();
        });
        //remoteStorage.init('sandwiches');
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
            params.error(xhr.responseText);
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


      //////////////////////////////
     // base64 (from webtoolkit) //
    //////////////////////////////
     
    var Base64 = {
     
      // private property
      _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
     
      // public method for encoding
      encode : function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
     
        input = Base64._utf8_encode(input);
     
        while (i < input.length) {
     
          chr1 = input.charCodeAt(i++);
          chr2 = input.charCodeAt(i++);
          chr3 = input.charCodeAt(i++);
     
          enc1 = chr1 >> 2;
          enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
          enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
          enc4 = chr3 & 63;
     
          if (isNaN(chr2)) {
            enc3 = enc4 = 64;
          } else if (isNaN(chr3)) {
            enc4 = 64;
          }
     
          output = output +
          this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
          this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
     
        }
     
        return output;
      },
     
      // public method for decoding
      decode : function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
     
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
     
        while (i < input.length) {
     
          enc1 = this._keyStr.indexOf(input.charAt(i++));
          enc2 = this._keyStr.indexOf(input.charAt(i++));
          enc3 = this._keyStr.indexOf(input.charAt(i++));
          enc4 = this._keyStr.indexOf(input.charAt(i++));
     
          chr1 = (enc1 << 2) | (enc2 >> 4);
          chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
          chr3 = ((enc3 & 3) << 6) | enc4;
     
          output = output + String.fromCharCode(chr1);
     
          if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
          }
          if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
          }
     
        }
     
        output = Base64._utf8_decode(output);
     
        return output;
     
      },
     
      // private method for UTF-8 encoding
      _utf8_encode : function (string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";
     
        for (var n = 0; n < string.length; n++) {
     
          var c = string.charCodeAt(n);
     
          if (c < 128) {
            utftext += String.fromCharCode(c);
          }
          else if((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
          }
          else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
          }
     
        }
     
        return utftext;
      },
     
      // private method for UTF-8 decoding
      _utf8_decode : function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;
     
        while ( i < utftext.length ) {
     
          c = utftext.charCodeAt(i);
     
          if (c < 128) {
            string += String.fromCharCode(c);
            i++;
          }
          else if((c > 191) && (c < 224)) {
            c2 = utftext.charCodeAt(i+1);
            string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
          }
          else {
            c2 = utftext.charCodeAt(i+1);
            c3 = utftext.charCodeAt(i+2);
            string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
          }
     
        }
     
        return string;
      }
     
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
              url: 'https://'+host+'/.well-known/host-meta',
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
          var davFound = false;
          var errorStr = 'none of the Link tags have a http://unhosted.org/spec/dav/0.1 rel-attribute';
          for(var linkTagI in linkTags) {
            for(var attrI in linkTags[linkTagI].attributes) {
              var attr = linkTags[linkTagI].attributes[attrI];
              if((attr.name=='rel') && (attr.value=='http://unhosted.org/spec/dav/0.1')) {
                davFound = true;
                errorStr = 'the first Link tag with a dav rel-attribute has no href-attribute';
                for(var attrJ in linkTags[linkTagI].attributes) {
                  var attr2 = linkTags[linkTagI].attributes[attrJ];
                  davAddress = attr2.value;
                  if(attr2.name=='href') {
                    //SUCCESS:
                    cb(davAddress);
                    break;
                  }
                }
                break;
              }
            }
            if(davFound) {
              break;
            }
          }
          if(!davFound) {
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
      function go(address, dataScope, userAddress) {
        var loc = encodeURIComponent((''+window.location).split('#')[0]);
        window.location = address
          + 'oauth2/auth?client_id=' + loc
          + '&redirect_uri=' + loc
          + '&scope=' + dataScope
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
          if(kv.length == 2) {
            if(kv[0]=='access_token') {
              cb(kv[1]);
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
        var resource = localStorage.getItem('_remoteStorageDataScope');
        var address = localStorage.getItem('_remoteStorageDavAddress')
          +'webdav/'+ userAddressParts[1]
          +'/'+ userAddressParts[0]
          +'/'+ resource
          +'/'+ key
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
        if(method!='GET') {
          var bearerToken=Base64.encode(localStorage.getItem('_remoteStorageUserAddress')+':'+localStorage.getItem('_remoteStorageOauthToken'));
          ajaxObj.headers= {Authorization: 'Basic '+bearerToken};
//          ajaxObj.fields={withCredentials: 'true'};
          ajaxObj.data=JSON.stringify({
            value: value,
            _revision: revision
          });
        }
        ajax(ajaxObj);
      }

      ////////////////////////////////////////
     // asynchronous synchronization tasks //
    ////////////////////////////////////////

      return {
        clear: function(cb) {
          var revision = 0;
          var index = JSON.parse(localStorage.getItem('_remoteStorageIndex'));
          for(var i in index) {
            doCall('DELETE', i, null, revision, function() {});
          }
          index={};
          localStorage.setItem('_remoteStorageIndex', JSON.stringify(index));
          doCall('PUT', '_remoteStorageIndex', JSON.stringify(index), revision, cb);
        },
        setItem: function(key, value, revision, cb) {
          var index = JSON.parse(localStorage.getItem('_remoteStorageIndex'));
          if(!index) {//first use
            index={};
            localStorage.setItem('_remoteStorageIndex', JSON.stringify(index));
          }
          if((!index[key]) || (index[key]<revision)) {
            doCall('PUT', key, value, revision, function() {
              index[key]=revision;
              localStorage.setItem('_remoteStorageIndex', JSON.stringify(index));
              doCall('PUT', '_remoteStorageIndex', JSON.stringify(index), revision, cb);
            });
          } else {//shouldn't happen!
            cb(revision+1);
          }
        },
        removeItem: function(key, revision, cb) {
          var index = JSON.parse(localStorage.getItem('_remoteStorageIndex'));
          if((!index[key]) || (index[key]<revision)) {
            doCall('DELETE', key, null, revision, function() {
              index[keys]=revision;
              localStorage.setItem('_remoteStorageIndex', JSON.stringify(index));
              doCall('PUT', '_remoteStorageIndex', JSON.stringify(index), revision, cb);
            });
          }
        },
        connect: function(userAddress, dataScope, cb) {
          var onError = function(errorMsg) {
            alert(errorMsg);
          }
          var callback = function(davAddress) {
            cb();
            localStorage.setItem('_remoteStorageUserAddress', userAddress);
            localStorage.setItem('_remoteStorageDataScope', dataScope);
            localStorage.setItem('_remoteStorageDavAddress', davAddress)
            oauth.go(davAddress, dataScope, userAddress);
          }
          webfinger.getDavBaseAddress(userAddress, onError, callback);
        },
        setToken: function(token) {
          localStorage.setItem('_remoteStorageOauthToken', token);
        },
        sync: function() {
          var localIndex = JSON.parse(localStorage.getItem('_remoteStorageIndex'));
          if(!localIndex) {
            localIndex = {};
          }
          doCall('GET', '_remoteStorageIndex', null, null, function(data) {
            var remoteIndex;
            try {
              remoteIndex = JSON.parse(data.value);
            } catch(e) {
              remoteIndex = {};
            }
            for(var i in remoteIndex) {
              if((localIndex[i] == undefined) || (remoteIndex[i] > localIndex[i])) {//need to pull it
                doCall('GET', i, null, null, function(data) {
                  localStorage.setItem('_remoteStorage_'+i, data.value);
                  var localIndex = JSON.parse(localStorage.getItem('_remoteStorageIndex'));
                  if(!localIndex) {
                    localIndex = {};
                  }
                  localIndex[i]=data._revision;
                  localStorage.setItem('_remoteStorageIndex', JSON.stringify(localIndex));
                  var oldValue = localStorage.getItem('_remoteStorage+'+i);
                  if(window.remoteStorage.options.onChange) {
                    window.remoteStorage.options.onChange(i, oldValue, data.value);
                  }
                });
              } else if(remoteIndex[i] < localIndex[i]) {//need to push it
                localValue = localStorage.getItem('_remoteStorage_'+i);
                doCall('PUT', i, localValue, localIndex[i], function() {});
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
      function work(minRevision) {
        if(!(localStorage.getItem('_remoteStorageOauthToken'))) {
          return;
        }
        var dirties = JSON.parse(localStorage.getItem('_remoteStorageDirties'));
        for(dirty in dirties) {
          var thisAction = dirties[dirty];
          if(thisAction.revision>=minRevision) {
            var alreadyWorking = localStorage.getItem('_remoteStorageWorking_'+thisAction.key);
            if(!alreadyWorking) {
              localStorage.setItem('_remoteStorageWorking_'+thisAction.key, thisAction.revision);
              dirties[dirty]=undefined;
              localStorage.setItem('_remoteStorageDirties', JSON.stringify(dirties));
              if(thisAction.action == 'clear') {
                backend.clear(function() {
                  localStorage.removeItem('_remoteStorageWorking_'+thisAction.key);
                  work(1);
                });
              } else if(thisAction.action == 'setItem') {
                backend.setItem(thisAction.key, thisAction.value, thisAction.revision, function(revision) {
                  localStorage.removeItem('_remoteStorageWorking_'+thisAction.key);
                  work(revision+1);
                });
              } else if(thisAction.action == 'removeItem') {
                backend.removeItem(thisAction.key, thisAction.revision, function(revision) {
                  localStorage.removeItem('_remoteStorageWorking_'+thisAction.key);
                  work(revision+1);
                });
              }
              return;
            }
          }
        }
      }
      function pushAction(action) {
        var dirties = JSON.parse(localStorage.getItem('_remoteStorageDirties'));
        if(dirties==null){
          dirties={};
        }
        action.revision = new Date().getTime();
        dirties[action.key] = action;
        localStorage.setItem('_remoteStorageDirties', JSON.stringify(dirties));
      }
      work(0);

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
          return localStorage.getItem('_remoteStorage_'+k);
        },
        setItem: function(k,v) {
          if(v == localStorage.getItem('_remoteStorage_'+k)) {
            return;
          }
          pushAction({action: 'setItem', key: k, value: v});
          if(this.isConnected()) {
            work(0);
          }
          var ret = localStorage.setItem('_remoteStorage_'+k, v);
          this.length = calcLength();
          return ret;
        },
        removeItem: function(k) {
          pushAction({action: 'removeItem', key: k});
          if(this.isConnected()) {
            work(0);
          }
          var ret = localStorage.removeItem('_remoteStorage_'+k);
          window.remoteStorage.length = calcLength();
          return ret;
        },
        clear: function() {
          localStorage.setItem('_remoteStorageActionQueue', '[{"action": "clear"}]');
          if(this.isConnected()) {
            work(0);
          }
          for(var i=0;i<localStorage.length;i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              localStorage.removeItem(localStorage.key(i));
            }
          }
        },
        connect: function(userAddress, dataScope) {
          backend.connect(userAddress, dataScope, function() {
            work(0);
          })
        },
        isConnected: function() {
          return (localStorage.getItem('_remoteStorageOauthToken') != null);
        },
        getUserAddress: function() {
          return localStorage.getItem('_remoteStorageUserAddress');
        },
        disconnect: function() {
          localStorage.removeItem('_remoteStorageUserAddress');
          localStorage.removeItem('_remoteStorageDataScope');
          localStorage.removeItem('_remoteStorageDavAddress');
          localStorage.removeItem('_remoteStorageOauthToken');
          localStorage.removeItem('_remoteStorageIndex');
          for(var i=0; i<localStorage.length; i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              var keyName = localStorage.key(i);
              localStorage.removeItem(keyName);
              if(window.remoteStorage.options.onChange) {
                remoteStorage.options.onChange(keyName.substring(15), localStorage.getItem(keyName), null);
              }
              localStorage.removeItem(keyName);
            }
          }
        },
        _init: function() {
          backend.sync();
        }
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
function ButtonClick(el, dataScope) {
  if(window.remoteStorage.isConnected()) {
    window.remoteStorage.disconnect();
    DisplayConnectionState();
  } else {
    if(document.getElementById('userAddressInput').value!='') {
      window.remoteStorage.connect(document.getElementById('userAddressInput').value, dataScope);
      DisplayConnectionState();
    }
  }
}

window.remoteStorage.init = function(options) {
  if(!options) {
    options = {};
  }
  if (!(options.dataScope)) {
    options.dataScope = location.host;
  }
  var divEl = document.createElement('div');
  divEl.id = 'remoteStorageDiv';
  divEl.innerHTML = '<link rel="stylesheet" href="../../remoteStorage.css" />'
    +'<input id="userAddressInput" type="text" placeholder="you@yourremotestorage" onkeyup="InputKeyUp(this);">'
    +'<span id="userAddress" style="display:none" onmouseover="SpanMouseOver(this);" onmouseout="SpanMouseOut(this);" onclick="SpanClick(this)"></span>'
    +'<input id="userButton" type="submit" value="Sign in" onclick="ButtonClick(this,'
    +'\''+options.dataScope+'\')">';
  document.body.insertBefore(divEl, document.body.firstChild);
  if(window.remoteStorage.isConnected()) {
    window.remoteStorage._init();
  }
  DisplayConnectionState();
  window.remoteStorage.options = options;
}
