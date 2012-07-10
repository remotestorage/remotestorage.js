define(['./platform', './couch', './dav', './getputdelete'], function (platform, couch, dav, getputdelete) {
  var prefix = 'remoteStorage_wire_',
    memCache = {},
    stateHandler = function(){},
    errorHandler = function(){};
  function set(key, value) {
    localStorage.setItem(prefix+key, JSON.stringify(value));
    memCache[key]=value;
  }
  function remove(key) {
    localStorage.removeItem(prefix+key);
    delete memCache[key];
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
    remove('storageType');
    remove('storageHref');
    remove('bearerToken');
  }
  function getState() {
    if(get('storageType') && get('storageHref')) {
      if(get('bearerToken')) {
        return 'connected';
      } else {
        return 'authing';
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

  function getDriver(type, cb) {
    if(type === 'https://www.w3.org/community/rww/wiki/read-write-web-00#couchdb'
      || type === 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb') {
      cb(couch);
    } else if(type === 'https://www.w3.org/community/rww/wiki/read-write-web-00#webdav'
      || type === 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav') {
      cb(dav);
    } else {
      cb(getputdelete);
    }
  }
  function resolveKey(storageType, storageHref, basePath, relPath) {
    //var nodirs=true;
    var nodirs=false;
    var itemPathParts = ((basePath.length?(basePath + '/'):'') + relPath).split('/');
    var item = itemPathParts.splice(2).join(nodirs ? '_' : '/');
    return storageHref + '/' + itemPathParts[1]
      //+ (storageInfo.properties.legacySuffix ? storageInfo.properties.legacySuffix : '')
      + '/' + (item[2] == '_' ? 'u' : '') + item;
  }
  return {
    get: function (path, cb) {
      var storageType = get('storageType'),
        storageHref = get('storageHref'),
        token = get('bearerToken');
      if(typeof(path) != 'string') {
        cb('argument "path" should be a string');
      } else {
        getDriver(storageType, function (d) {
          d.get(resolveKey(storageType, storageHref, '', path), token, cb);
        });
      }
    },
    set: function (path, valueStr, cb) {
      var storageType = get('storageType'),
        storageHref = get('storageHref'),
        token = get('bearerToken');
      if(typeof(path) != 'string') {
        cb('argument "path" should be a string');
      } else if(typeof(valueStr) != 'string') {
        cb('argument "valueStr" should be a string');
      } else {
        getDriver(storageType, function (d) {
          d.set(resolveKey(storageType, storageHref, '', path), valueStr, token, cb);
        });
      }
    },
    setStorageInfo   : function(type, href) { set('storageType', type); set('storageHref', href); },
    setBearerToken   : function(bearerToken) { set('bearerToken', bearerToken); },
    disconnectRemote : disconnectRemote,
    on               : on,
    getState         : getState
  };
});
