
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
        log('PUSH: '+key)
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
    log('PULL INDEX')
    remoteStorage.get( 'index', function( result ){
      if(result.value){
        var keys = result.value
        for(key in keys) {
          log('PULL: '+key)
          remoteStorage.get( key, function( result ){
            localStorage.setItem(key, result.value)
          })
        }
      }
    })
  }

  function push() {
    log('PULL INDEX')
    remoteStorage.get( 'index', function( result ){
      var keys
      if(result.value){
        keys = result.value
      }else{
        keys = {}
      }
      
      for(var i=0; i<localStorage.length; i++) {
        var key = localStorage.key(i)
        log('PUSH: '+key)
        remoteStorage.set( key, localStorage.getItem(key), function( result ){
        })
        keys['key']= getTime()
      }
      log('PUSH INDEX')
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
