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
