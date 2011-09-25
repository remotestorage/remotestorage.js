  ///////////////
 // Webfinger //
///////////////


var webfinger = (function() {
  var webFinger = {}
  var getHostMeta = function( userAddress, linkRel, onError, cb ){
    //split the userAddress at the '@' symbol:
    var parts = userAddress.split('@')
    if( parts.length == 2 ){
      var user = parts[0]
      var domain = parts[1]

      $.ajax(
        { url: 'https://'+ domain +'/.well-known/host-meta'
        , timeout: 1000
        , dataType: 'xml'
        , success: function( xml ){
          try {
            $(xml).find('Link').each(function(){
              var rel = $(this).attr('rel')
              if( rel == linkRel ){
                cb( $(this).attr('template') )
              }
            })
          } catch(e) {
            onError()
          }
        }
        , error: function() {//retry with http:
          $.ajax(
            { url: 'http://'+ domain +'/.well-known/host-meta'
            , timeout: 1000
            , dataType: 'xml'
            , success: function( xml ){
              try {
                $(xml).find('Link').each(function(){
                  var rel = $(this).attr('rel')
                  if( rel == linkRel ){
                    cb( $(this).attr('template') )
                  }
                })
              } catch(e) {
                onError()
              }
            }
            , error: onError
            } )
          }
        } )
    } else {
      onError()
    }
  }
  var matchLinkRel = function( linkRel, majorDavVersion, minMinorDavVersion ){
    //TODO: do some real reg exp...
    var davVersion
    if( linkRel == 'http://unhosted.org/spec/dav/0.1' ){
      davVersion = { major:0, minor:1 }
    } else {
      davVersion = { major:0, minor:0 }
    }

    if(davVersion.major == majorDavVersion) {
      if(majorDavVersion == 0) {//pre-1.0.0, every minor version is breaking, see http://semver.org/
        return (davVersion.minor == minMinorDavVersion)
      } else {//from 1.0.0 onwards, check if available version is at least minMinorDavVersion
        return (davVersion.minor >= minMinorDavVersion)
      }
    } else {
      return false
    }
  }
  var processLrrd = function( lrrdXml, majorVersion, minMinorVersion, onError, cb ){
    try {
    } catch( e ){
      onError()
    }
  }
  webFinger.getDavBaseUrl = function( userAddress, majorVersion, minMinorVersion, onError, cb ){
    //get the WebFinger data for the user and extract the uDAVdomain:
    getHostMeta( userAddress, 'lrdd', onError, function( template ){
      $.ajax(
        { url: template.replace( /{uri}/, userAddress, true )
        , timeout: 10000
        , dataType: 'xml'
        , success: function(xml){
          try {
            $(xml).find('Link').each(function() {
              if( matchLinkRel( $(this).attr('rel'), majorVersion, minMinorVersion ) ){
                cb( $(this).attr('href') )
                //TODO: should exit loop now that a matching result was found.                
              }
            })
          } catch( e ) {
            onError()
          }
        }
        , error: onError
      })
    })
  }
  return webFinger
})()
/**
*
*  Base64 encode / decode
*  http://www.webtoolkit.info/
*
**/
 
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
//crypto layer: take care to keep one cryptoPwdForRead per key, so that you can update it to the session's cryptoPwdForWrite each time you write to a key
//    if(session.cryptoPwdForRead['favSandwich'] != session.cryptoPwdForWrite) {
//      session.cryptoPwdForRead['favSandwich'] = session.cryptoPwdForWrite
//      sessionStorage.setItem('session', JSON.stringify(session))
//      saveSession()
//    }
//sjcl.encrypt(session.cryptoPwdForWrite, clearText))

function UnhostedDav_0_1( params ){
  var dav = params
  function keyToUrl( userAddress, key ) {
    var userAddressParts = userAddress.split('@')
    var resource = dav.dataScope
    var url = dav.davUrl
            +'webdav/'+ userAddressParts[1]
            +'/'+ userAddressParts[0]
            +'/'+ resource
            +'/'+ key
    return url
  }

  dav.getUserAddress = function() {
    return dav.userAddress
  }

  dav.get = function( key, cb ){
    $.ajax(
      { url: keyToUrl( dav.userAddress, key )
      ,  dataType: 'json'
      ,  success: function(obj){
          cb({success: true, value: obj})
        }
      , error: function(xhr) {
          if(xhr.status == 404) {
            cb({success:true, value: null})
          } else {
            cb({success:false, error: xhr.status})
          }
        }
      } )
  }
  
  dav.set = function( key, obj, cb ){
    $.ajax( 
      { url: keyToUrl( dav.userAddress, key )
      , type: 'PUT'
      , headers: { Authorization: 'Basic '+ Base64.encode( dav.userAddress +':'+ dav.davToken ) }
      , fields: { withCredentials: 'true'}
      , data: JSON.stringify( obj )
      , success: function( text ){
          try {//this is not necessary for current version of protocol, but might be in future:
            var obj = JSON.parse( text )
            obj.success = true
            cb( obj )
          } catch( e ){
            cb( { success:true } )
          }
        }
     , error: function( xhr ){
         cb( { success:false, error: xhr.status } )
       }
     } )
  }
  return dav
}

function initSyncStorage( onStatus ){
  var numConns = 0
  var remoteStorage = null
  var keys = {}
  var pendingPush = {}
  var error = false
  var reportStatus = function( deltaConns ){
    var userAddress
    var syncStatus = 'unsynced'
    if( onStatus ){
      numConns += deltaConns
      if( remoteStorage ){
        userAddress = remoteStorage.getUserAddress()
      } else {
        userAddress = null
      }
      if( userAddress ){
        if(numConns) {
          syncStatus = 'syncing'
        } else {
          syncStatus = 'synced'
        }
      }
      onStatus( { userAddress: userAddress
                , sync: syncStatus
                } )
    }
  }
      
  function registerHosted(session) {
    alert("We looked for your remote storage at "+session.userAddress+", but couldn't find it there. Don't be sad though! Because if you stop by in our chat room, we can set up a test user for you. [http://webchat.freenode.net/?channels=unhosted] Probably you can even keep "+session.userAddress+" as your user address");
  }

  function signIn(audience) {
    navigator.id.getVerifiedEmail(function(assertion) {
      if(assertion) {
        $.ajax(//we only use BrowserId to avoid nascar here, not to authenticate. the audience is the current client-side app, which has not interest in who you are.
          { type: 'POST'
          , url: 'https://browserid.org/verify'
          , data: 
            { assertion: assertion
            , audience: audience
            }
          , dataType: 'json'
          , success: function(data) {
              webfinger.getDavBaseUrl(data.email, 0, 1, function() {
              }, function(davUrl) {
                var session =
                  { userAddress: data.email
                  , dataScope: 'simpleplanner'
                  , storage:
                    { userAddress: data.email
                    , davUrl: davUrl
                    , dataScope: 'simpleplanner'
                    , storageType: 'http://unhosted.org/spec/dav/0.1'
                    }
                  }
                sessionStorage.setItem('session', JSON.stringify(session))
                window.location = session.storage.davUrl
                  + "oauth2/auth"
                  + "?client_id="+encodeURIComponent('clientId')
                  + "&redirect_uri="+encodeURIComponent(window.location)
                  + "&scope="+encodeURIComponent(session.dataScope)
                  + "&response_type=token"
                  + "&user_address="+encodeURIComponent(session.userAddress)
              })
            }
          }
        )
      }
    })
  }

  function disconnect() {
    onStatus({sync:'offline', userAddress: remoteStorage.getUserAddress()})
  }
  function reconnect() {
    onStatus({sync:'synced', userAddress: remoteStorage.getUserAddress()})
  }
  function signOut() {
    sessionStorage.removeItem('session')
    sessionStorage.removeItem('browserid-asertion')
    onStatus({sync:'unsynced'})
  }
  window.syncStorage =
    { pushKey: function(key) {
        remoteStorage.set( key, localStorage.getItem(key), function( result ){
          var a=1
        }) 
      }
    , pull: pull
    , push: push
    , signIn: signIn
    , disconnect: disconnect
    , reconnect: reconnect
    , signOut: signOut
  }

  function pull() {
    remoteStorage.get( 'index', function( result ){
      if(result.value){
        var keys = result.value
        for(key in keys) {
          remoteStorage.get( key, function( result ){
            localStorage.setItem(key, result.value)
          })
        }
      }
    })
  }

  function push() {
    remoteStorage.get( 'index', function( result ){
      var keys
      if(result.value){
        keys = result.value
      }else{
        keys = {}
      }
      
      for(var i=0; i<localStorage.length; i++) {
        var key = localStorage.key(i)
        remoteStorage.set( key, localStorage.getItem(key), function( result ){
        })
        keys[key]= (new Date()).getTime()
      }
      remoteStorage.set( 'index', keys, function( result ){})
    })
  }

  //set it up:
  reportStatus( 0 )
  var sessionStr = sessionStorage.getItem("session")
  if(sessionStr) {
    var session = {}
    try {
      session = JSON.parse(sessionStr)
    } catch (e) {
      sessionStorage.removeItem("session")
    }
    if(session.storage) {
      if( session.storage.storageType == 'http://unhosted.org/spec/dav/0.1' ){
        remoteStorage = UnhostedDav_0_1( session.storage )
        reportStatus( 0 )
        pull()
        push()
      } else {
        syncStorage.error = 'unsupported remote storage type '+ remoteStorageType
      }
    }
  }
}

$(document).ready(function() {
  document.getElementById('syncStorage').innerHTML = 
     '<input type="submit" id="syncButton" onclick="syncButtonClick()" onmouseover="syncButtonMouseOver()" onmouseout="syncButtonMouseOut()">'
    +'<span id="status">status</span>'
  var tokenReceived = gup("access_token")
  if(tokenReceived) {
    document.location='#'
    var sessionStr = sessionStorage.getItem("session")
    var session
    if(sessionStr) {
      session = JSON.parse(sessionStr)
    } else {
      alert('fail')
    }
    session.storage.davToken = tokenReceived
    session.unsaved = true
    sessionStorage.setItem("session", JSON.stringify(session))
  }
  initSyncStorage(onStatus)
})

gup = function(paramName) {
  var regex = new RegExp("[\\?&#]"+paramName+"=([^&#]*)")
  var results = regex.exec(window.location.href)
  if(results) {
    return results[1]
  }
  return null
}

function onStatus( status ){
  if(status.sync == 'unsynced') {
    document.getElementById('syncButton').value = 'sync'
    document.getElementById('syncButton').className = 'sync'
    document.getElementById('syncButton').syncStatus = status
    document.getElementById('status').innerHTML = 'with your remote storage'
   } else if(status.sync == 'working') {
    document.getElementById('syncButton').value = 'syncing'
    document.getElementById('syncButton').className = 'syncing'
    document.getElementById('syncButton').syncStatus = status
    document.getElementById('status').innerHTML = 'with '+status.userAddress
  } else if(status.sync == 'synced') {
    document.getElementById('syncButton').value = 'synced'
    document.getElementById('syncButton').className = 'synced'
    document.getElementById('syncButton').syncStatus = status
    document.getElementById('status').innerHTML = 'with '+status.userAddress
  } else if(status.sync == 'offline') {
    document.getElementById('syncButton').value = 'reconnect'
    document.getElementById('syncButton').className = 'disconnected'
    document.getElementById('syncButton').syncStatus = status
    document.getElementById('status').innerHTML = 'with '+status.userAddress+' or '
  }
}
function syncButtonClick() {
  if(document.getElementById('syncButton').syncStatus.sync == 'synced') {
    syncStorage.disconnect()
    syncStorage.signOut()
  } else if(document.getElementById('syncButton').syncStatus.sync == 'unsynced') {
    syncStorage.signIn(window.location.host)
  } else if(document.getElementById('syncButton').syncStatus.sync == 'offline') {
    syncStorage.reconnect()
  }
}
function syncButtonMouseOver() {
  if(document.getElementById('syncButton').syncStatus.sync == 'synced') {
    document.getElementById('syncButton').value = 'disconnect'
    document.getElementById('status').innerHTML = 'from '+document.getElementById('syncButton').syncStatus.userAddress
  }
}
function syncButtonMouseOut() {
  if(document.getElementById('syncButton').syncStatus.sync == 'synced') {
    document.getElementById('syncButton').value = 'synced'
    document.getElementById('status').innerHTML = 'with '+document.getElementById('syncButton').syncStatus.userAddress
  }
}

var pushTimer = 0
$(document).ready(function() {
  if(window.addEventListener){
    window.addEventListener('storage', handle_storage, false)
  }else{
    window.attachEvent('onstorage', handle_storage)
    window.attachEvent('onblur', handle_storage)
  }
  setTimeout('pushTime()', 1000)
})
function pushTime() {
  if(--pushTimer <= 0) {
    syncStorage.push()
    pushTimer = 10
  }
  document.getElementById('syncButton').value = pushTimer
  setTimeout('pushTime()', 1000)
}

function handle_storage(e) {
  if(!e) {
    e = window.event
  }
  syncStorage.pushKey(e.key)
}
