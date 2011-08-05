
function initSyncStorage( onStatus ){
  var numConns = 0
  var remoteStorage = null
  var keys = {}
  var error = false
  function cacheGet( key ){
    var obj = {}
    if( keys[key] ){
      try {
        obj = JSON.parse( sessionStorage.getItem('_syncStorage_'+ key ) )
        if( obj === null ){
          obj = {}
        }
      } catch(e) {//unparseable. remove.
        sessionStorage.removeItem('_syncStorage_'+ key )
      }
    }
    return obj
  }
  function cacheSet( key, obj ){
    if( obj === null ){//negative caching.
      obj = { value: null }
    }
    sessionStorage.setItem('_syncStorage_'+ key, JSON.stringify( obj ) )
  }
  function triggerStorageEvent( key, oldValue, newValue ){
    var e = document.createEvent('StorageEvent')
    e.initStorageEvent('storage', false, false, key, oldValue, newValue, window.location.href, window.syncStorage )
    dispatchEvent(e)
  }
  var reportStatus = function( deltaConns ){
    if( onStatus ){
      numConns += deltaConns
      var userAddress
      if( remoteStorage ){
        userAddress = remoteStorage.getUserAddress()
      } else {
        userAddress = null
      }
      if( status.userAddress ){
        text = "Logged in as "+ status.userAddress
        try {
          session = sessionStorage.getItem('session')
//        if(JSON.parse(session).isHosted) {
            text +=" (hosted: <a href='https://myfavouritesandwich.org:444/'>see your data</a>, <a href='https://myfavouritesandwich.org:444/apps/unhosted_web/admin.php'>control panel</a>)"
//        } else {
//          text +=" (unhosted)"
//        }
        } catch( e ){
          text +=' (no session)'
        }
        if(status.online) {
          text +=" [online]"
        }
        if(status.lock) {
          text +="[local is master]"
        }
        if(status.working) {
          text +=" [working]"
        }
        if(status.error) {
          text +=" [ERROR: "+status.error+"]"
        }
      } else {
        text = "Log in to save your ingredients to your hosted or unhosted account"
      }
      onStatus( { userAddress: userAddress
                , online: true
                , lock: true
                , working: (numConns > 0)
                , error: error
                , asHtml: text
                } )
    }
  }
      
  var prefetch = function( keysArg ){
    for(var i=0; i<keysArg.length; i++ ){
      var key = keysArg[i]
      keys[key] = true
      var cachedObj = cacheGet( key )
      if( cachedObj.value == undefined ){
        reportStatus( +1 )
        remoteStorage.get( key, function( result ){
          if( result.success ){
            error = false
            cacheSet( key, result )
            triggerStorageEvent( key, false, result.value )
          } else {
            error = result.error
          }
          reportStatus( -1 )
        })
      } else {
        triggerStorageEvent( key, false, cachedObj )
      }
    }
  }
  var writeThrough = function( key, oldObj, newObj ){
    reportStatus( +1 )
    remoteStorage.set( key, newObj, function( result ){
      if( result.success ){
        error = false
        //the following is not required for current spec, but might be for future versions:
        if( result.rev ){
          var cacheObj = cacheGet( key )
          cacheObj._rev = result.rev
          cacheSet( key, cacheObj )
        }
      } else {
        error = result.error
        cacheSet( key, oldObj )
        triggerStorageEvent( key, newObj.value, oldObj.value )
      }
      reportStatus( -1 )
    })
  }
	function connectSyncStorage() {//this will only happen when a logged-in session exists in sessionStorage
		var sessionStr = sessionStorage.getItem("session")
		if(sessionStr) {
			var session = {}
			try {
				session = JSON.parse(sessionStr)
			} catch (e) {
				sessionStorage.removeItem("session")
			}
			if(session.davToken) {
				document.getElementById('loginButton').style.display = 'none'
				document.getElementById('logoutButton').style.display = 'block'
				window.syncStorage.pullFrom(session)
				window.syncStorage.syncItems(["favSandwich"])
			}
		}
	}

	function registerHosted(assertion) {
		//info to user: this site accepts hosted and unhosted accounts.
		//the user address you're logging in with is not usable as an unhosted account, we will create a hosted data store for you.
		//soon, we hope to offer unhosted accounts @myfavouritesandwich.org, for use elsewhere.
		$.ajax({ type: 'POST'
			, url: config.hostedOwncloudBase+'/apps/unhosted_web/ajax/link.php'
			, data: {browserIdAssertion: assertion, dataScope: 'sandwiches'}
			, error: function() {
					alert('oops')
				}
			, success: function(retObj) {
					if(retObj.error) {
						alert('que?')
					}
					var sessionStr = sessionStorage.getItem('session')
					var session = JSON.parse(sessionStr)
					if(!session) {
						session = {}
					}
					session.storageType = "http://unhosted.org/spec/dav/0.1"
					session.userAddress = retObj.data.userAddress
					session.davToken = retObj.data.authToken
					session.dataScope = 'sandwiches'
					session.davUrl = config.hostedOwncloudBase+'/apps/unhosted_web/compat.php/'+retObj.data.userAddress+'/unhosted/'
					sessionStorage.setItem('session', JSON.stringify(session))
					connectSyncStorage()
				}
		})
	}

	function signIn() {
		navigator.id.getVerifiedEmail(function(assertion) {
			if(assertion) {
				$.ajax({ type: 'POST'
					, url: config.sessionServiceUrl+'/init'
					, data: { browserIdAssertion: assertion, dataScope: 'sandwiches' }
					, dataType: "text"
					, success: function(sessionStr) {
						var session = JSON.parse(sessionStr)
						if(session.userAddress && session.davUrl && session.davToken && session.cryptoPwdForRead) {//coming back
							sessionStorage.setItem('session', sessionStr)
							connectSyncStorage()
						} else {//if webfinger succeeds, oauth. if not, register:
							webfinger.getDavBaseUrl(session.userAddress, 0, 1, function() {
								registerHosted()
							}, function(davUrl) {
								session.davUrl = davUrl
								session.storageType = 'http://unhosted.org/spec/dav/0.1'
								session.dataScope = config.dataScope
								session.isHosted = false
								sessionStorage.setItem('session', JSON.stringify(session))
								window.location = session.davUrl
									+ "oauth2/auth"
									+ "?client_id="+encodeURIComponent(config.clientId)
									+ "&redirect_uri="+encodeURIComponent(config.callbackUrl)
									+ "&scope="+encodeURIComponent(session.dataScope)
									+ "&response_type=token"
									+ "&user_address="+encodeURIComponent(session.userAddress)
							})
						}
					}
				})
			}
		})
	}

	function register() {
		window.location = 'http://myfavouritesandwich.org/register.html'
	}

	function signOut() {
		sessionStorage.removeItem('session')
		sessionStorage.removeItem('browserid-asertion')
		//show()
		onStatus({})
	}
  var syncStorage =
    { error: null
    , length: keys.length
    , key: function( i ){
      return 'return keys[i]';//need to find array_keys() function in js
    }
    , getItem: function( key ){
      return cacheGet(key).value
    }
    , setItem: function( key, val ){
      keys[key] = true
      localObj = cacheGet(key)
      if( localObj.value == val ){
        return
      } else {
        //the following trick, putting the value into an object which may have
        //other fields present than just .value, may in the future be necessary
        //for maintaining CouchDb metadata:
        var newObj = localObj
        newObj.value = val
        cacheSet( key, newObj )
        writeThrough( key, localObj, newObj )
      }
    }
    , flushItems: function( keys ){
      for( var i=0; i<keys.length; i++ ){
        var key = keys[i]
        window.localStorage.removeItem('_syncStorage_'+ key )
      }
    }
    , pullFrom: function( params ){
      if( params.storageType == 'http://unhosted.org/spec/dav/0.1' ){
        remoteStorage = UnhostedDav_0_1( params )
        reportStatus( 0 )
      } else {
        syncStorage.error = 'unsupported remote storage type '+ remoteStorageType
      }
    }
    , syncItems: function(keys) {
      prefetch(keys)
    }
    , signIn: signIn
    , signOut: signOut
  }
  reportStatus(0)
  window.syncStorage = syncStorage
}
