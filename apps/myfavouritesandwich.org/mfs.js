$(document).ready(function() {
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
  addEventListener('storage', storage_event, false)
  initSyncStorage(onStatus)
  syncStorage.syncItems(['favSandwich'])
  show()
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

function storage_event(e) {
  if(e.storageArea == null) {//i'm trying to set e.storageArea to window.syncStorage, but it comes out null
    show()
  }
}

function onsave() {
  var sandwich = { ingredients: [ document.getElementById('firstIngredient').value
                                , document.getElementById('secondIngredient').value
                                ]
                 }
  syncStorage.setItem('favSandwich', JSON.stringify(sandwich))
  show()
}

function show() {
  var sandwich
  try {
    sandwich = JSON.parse(syncStorage.getItem('favSandwich'))
  } catch(e) {
    syncStorage.flushItems([ 'favSandwich' ])
  }
  if(sandwich) {
    document.getElementById('firstIngredient').value = sandwich.ingredients[0]
    document.getElementById('secondIngredient').value = sandwich.ingredients[1]
    for(var i=0;i < 2; i++) {
      if(!(sandwich.ingredients[i])) {
        sandwich.ingredients[i]='...'
      }
    }
    document.getElementById('showIngredients').innerHTML = 'My favourite sandwich has <strong>'
      +sandwich.ingredients[0]
      +'</strong> and <strong>'
      +sandwich.ingredients[1]
      +'</strong> on it';
  } else {
    document.getElementById('showIngredients').innerHTML = 'My favourite sandwich has'
    document.getElementById('firstIngredient').value = ''
    document.getElementById('secondIngredient').value = ''
  }
}
