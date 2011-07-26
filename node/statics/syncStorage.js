//in JS app, you have an object. you stringify it
//in sjcl, you encrypt a string to a string
//you pass a string to syncStorage.
//syncStorage puts that string inside an object, possibly adds couch-attributes stringifies it again.
//syncStorage 

function initSyncStorage(onStatus) {
  var numConns = 0;
  var remoteStorage = null;
  var keys = {};
  var error = false;
  function cacheGet(key) {
    var obj = {};
    if(keys[key]) {
      try {
        obj = JSON.parse(localStorage.getItem("_syncStorage_"+key));
        if(obj === null) {
          obj = {};
        }
      } catch(e) {//unparseable. remove.
        localStorage.removeItem("_syncStorage_"+key);
      }
    }
    return obj;
  }
  function cacheSet(key, obj) {
    if(obj === null) {//negative caching.
      obj = {value: null};
    }
    localStorage.setItem("_syncStorage_"+key, JSON.stringify(obj));
  }
  function triggerStorageEvent(key, oldValue, newValue) {
    var e = document.createEvent("StorageEvent");
    e.initStorageEvent('storage', false, false, key, oldValue, newValue, window.location.href, window.syncStorage);
    dispatchEvent(e);
  }
  var reportStatus = function(deltaConns) {
    if(onStatus) {
      numConns+= deltaConns;
      var userAddress;
      if(remoteStorage) {
        userAddress = remoteStorage.getUserAddress();
      } else {
        userAddress = null;
      }
      onStatus({
        userAddress: userAddress,
        online: true,
        lock: true,
        working: (numConns > 0),
        error: error
      });
    }
  }
      
  var prefetch = function(keysArg) {
    var i;
    for(i=0;i<keysArg.length;i++) {
      var key = keysArg[i];
      keys[key] = true;
      var cachedObj = cacheGet(key);
      if(cachedObj.value == undefined) {
        reportStatus(+1);
        remoteStorage.get(key, function(result) {
          if(result.success) {
            error = false;
            cacheSet(key, result);
            triggerStorageEvent(key, false, result.value);
          } else {
            error = result.error;
          }
          reportStatus(-1);
        });
      } else {
        triggerStorageEvent(key, false, cachedObj);
      }
    }
  };
  var writeThrough = function(key, oldObj, newObj) {
    reportStatus(+1);
    remoteStorage.set(key, newObj, function(result) {
      if(result.success) {
        error = false;
        //the following is not required for current spec, but might be for future versions:
        if(result.rev) {
          var cacheObj = cacheGet(key);
          cacheObj._rev = result.rev;
          cacheSet(key, cacheObj);
        }
      } else {
        error = result.error;
        cacheSet(key, oldObj);
        triggerStorageEvent(key, newObj.value, oldObj.value);
      }
      reportStatus(-1);
    });
  };
  var syncStorage = {
    error: null,
    length: keys.length,
    key: function(i) {
      return "return keys[i]";//need to find array_keys() function in js
    },
    getItem: function(key) {
      return cacheGet(key).value;
    },
    setItem: function(key, val) {
      keys[key] = true;
      localObj = cacheGet(key);
      if(localObj.value == val) {
        return;
      } else {
        //the following trick, putting the value into an object which may have
        //other fields present than just .value, may in the future be necessary
        //for maintaining CouchDb metadata:
        var newObj = localObj;
        newObj.value = val;
        cacheSet(key, newObj);
        writeThrough(key, localObj, newObj);
      }
    },
    flushItems: function(keys) {
      var i;
      for(i=0; i<keys.length; i++) {
        var key = keys[i];
        window.localStorage.removeItem("_syncStorage_"+key);
      }
    },
    pullFrom: function(params) {
      if(params.storageType == "http://unhosted.org/spec/dav/0.1") {
        remoteStorage = UnhostedDav_0_1(params);
        reportStatus(0);
      } else {
        syncStorage.error = "unsupported remote storage type "+remoteStorageType;
      }
    },
    syncItems: function(keys) {
      prefetch(keys);
    }
  };
  reportStatus(0);
  window.syncStorage = syncStorage;
}
