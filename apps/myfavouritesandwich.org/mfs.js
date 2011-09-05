$(document).ready(function() {
  var tokenReceived = gup("access_token")
  if(tokenReceived) {
    var sessionStr = sessionStorage.getItem("session")
    var session
    if(sessionStr) {
      session = JSON.parse(sessionStr)
    } else {
      //fail
    }
    session.storage.davToken = gup("access_token")
    session.unsaved = true
    sessionStorage.setItem("session", JSON.stringify(session))
  }
  if (window.location.href != config.appUrl + window.location.hash) {
    window.location = config.appUrl
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
  document.getElementById('status').innerHTML = status.asHtml;
  if(status.userAddress) {
    document.getElementById('loginButton').style.display = 'none';
    document.getElementById('logoutButton').style.display = 'block';
  } else {
    document.getElementById('loginButton').style.display = 'block';
    document.getElementById('logoutButton').style.display = 'none';
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
