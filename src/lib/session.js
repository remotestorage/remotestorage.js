define(['./platform', './webfinger', './hardcoded'], function(platform, webfinger, hardcoded) {
  var prefix = 'remoteStorage_session_',
    memCache = {},
    stateHandler = function(){},
    errorHandler = function(){};
  function set(key, value) {
    localStorage.setItem(prefix+key, JSON.stringify(value));
    memCache[key]=value;
  }
  function get(key) {
    if(typeof(memCache[key]) == 'undefined') {
      var valStr = localStorage.getItem(prefix+key);
      if(typeof(valStr) == 'string') {
        try {
          memCache[key] = JSON.parse(valStr);
        } catch(e) {
          localStorage.removeItem(prefix+key);
          memCache[key] = null;
        }
      } else {
        memCache[key] = null;
      }
    }
    return memCache[key];
  }
  function discoverStorageInfo(userAddress, cb) {
    webfinger.getStorageInfo(userAddress, {}, function(err, data) {
      if(err) {
        hardcoded.guessStorageInfo(userAddress, {}, function(err2, data2) {
          if(err2) {
            cb(err2);
          } else {
            set('storageInfo', data2);
            cb(null);
          }
        });
      } else {
        set('storageInfo', data);
        cb(null);
      }
    });
  }
  function redirectUriToClientId(loc) {
    //TODO: add some serious unit testing to this function
    if(loc.substring(0, 'http://'.length) == 'http://') {
      loc = loc.substring('http://'.length);
    } else if(loc.substring(0, 'https://'.length) == 'https://') {
      loc = loc.substring('https://'.length);
    } else {
      return loc;//for all other schemes
    }
    var hostParts = loc.split('/')[0].split('@');
    if(hostParts.length > 2) {
      return loc;//don't know how to simplify URLs with more than 1 @ before the third slash
    }
    if(hostParts.length == 2) {
      hostParts.shift();
    }
    return hostParts[0].split(':')[0];
  }
  function dance() {
    var endPointParts = get('storageInfo').properties['auth-endpoint'].split('?');
    var queryParams = [];
    if(endPointParts.length == 2) {
      queryParams=endPointParts[1].split('&');
    } else if(endPointParts.length>2) {
      errorHandler('more than one questionmark in auth-endpoint - ignoring');
    }
    var loc = platform.getLocation();
    var scopesObj = get('scopes');
    if(!scopesObj) {
      return errorHandler('no modules loaded - cannot connect');
    }
    var scopesArr = [];
    for(var i in scopesObj) {
      scopesArr.push(i+':'+scopesObj[i]);
    }
    queryParams.push('scope='+encodeURIComponent(scopesArr));
    queryParams.push('redirect_uri='+encodeURIComponent(loc));
    queryParams.push('client_id='+encodeURIComponent(redirectUriToClientId(loc)));
    
    platform.setLocation(endPointParts[0]+'?'+queryParams.join('&'));
  }
  function discoverStorageInfo(userAddress) {
    set('userAddress', userAddress);
    discoverStorageInfo(function(err) {
      if(err) {
        errorHandler(err);
        stateHandler('failed');
      } else {
        dance();
      }
    });
  }
  function onLoad() {
    var tokenHarvested = platform.harvestToken();
    if(tokenHarvested) {
      set('bearerToken', tokenHarvested);
    }
  }
  function disconnectRemote() {
    set('storageType', undefined);
    set('storageHref', undefined);
    set('bearerToken', undefined);
  }
  function addScope(scope) {
    var scopes = get('scopes') || {};
    var scopeParts = scope.split(':');
    scopes[scopeParts[0]] = scopeParts[1];
    set('scopes', scopes);
  }
  function getState() {
    if(get('userAddress')) {
      if(get('storageInfo')) {
        if(get('bearerToken')) {
          return 'connected';
        } else {
          return 'authing';
        }
      } else {
        return 'connecting';
      }
    } else {
      return 'anonymous';
    }
  }
  function on(eventType, cb) {
    if(eventType == 'state') {
      stateHandler = cb;
    } else if(eventType == 'error') {
      errorHandler = cb;
    }
  }

  onLoad();
  
  return {
    setStorageInfo   : function(type, href) { set('storageType', type); set('storageHref', href); },
    getStorageType   : function() { return get('storageType'); },
    getStorageHref   : function() { return get('storageHref'); },
    
    setBearerToken   : function(bearerToken) { set('bearerToken', bearerToken); },
    getBearerToken   : function() { return get('bearerToken'); },
    
    disconnectRemote : disconnectRemote,
    on               : on,
    getState         : getState
  }
});
