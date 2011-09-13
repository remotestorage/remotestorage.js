
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

  function signIn() {
    navigator.id.getVerifiedEmail(function(assertion) {
      if(assertion) {
        $.ajax(//we only use BrowserId to avoid nascar here, not to authenticate. the audience is the current client-side app, which has not interest in who you are.
          { type: 'POST'
          , url: 'https://browserid.org/verify'
          , data: 
            { assertion: assertion
            , audience: 'myfavouritesandwich.org'
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
    , signIn: signIn
    , disconnect: disconnect
    , reconnect: reconnect
    , signOut: signOut
  }

  function pull() {
    remoteStorage.get( 'index', function( result ){
      var keys
      if(result.value){
        keys = result.value
        for(var i=0; i<keys.length; i++) {
          var key = keys[i]
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
        keys = []
      }
      
      for(var i=0; i<localStorage.length; i++) {
        var key = localStorage.key(i)
        remoteStorage.set( key, localStorage.getItem(key), function( result ){
        })
        keys.push(key)
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
    +'<input type="submit" id="flushButton" onclick="flushButtonClick()" value="remove local data">'
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
    document.getElementById('syncButton').syncStatus = status
    document.getElementById('status').innerHTML = 'with your remote storage'
    document.getElementById('flushButton').style.display = 'none'
   } else if(status.sync == 'working') {
    document.getElementById('syncButton').value = 'syncing'
    document.getElementById('syncButton').syncStatus = status
    document.getElementById('status').innerHTML = 'with '+status.userAddress
    document.getElementById('flushButton').style.display = 'none'
  } else if(status.sync == 'synced') {
    document.getElementById('syncButton').value = 'synced'
    document.getElementById('syncButton').syncStatus = status
    document.getElementById('status').innerHTML = 'with '+status.userAddress
    document.getElementById('flushButton').style.display = 'none'
  } else if(status.sync == 'offline') {
    document.getElementById('syncButton').value = 'reconnect'
    document.getElementById('syncButton').syncStatus = status
    document.getElementById('status').innerHTML = 'with '+status.userAddress+' or '
    document.getElementById('flushButton').style.display = 'inline'
  }
}
function syncButtonClick() {
  if(document.getElementById('syncButton').syncStatus.sync == 'synced') {
    syncStorage.disconnect()
  } else if(document.getElementById('syncButton').syncStatus.sync == 'unsynced') {
    syncStorage.signIn()
  } else if(document.getElementById('syncButton').syncStatus.sync == 'offline') {
    syncStorage.reconnect()
  }
}
function flushButtonClick() {
  syncStorage.signOut()
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
