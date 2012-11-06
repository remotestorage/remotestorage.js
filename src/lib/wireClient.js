define(['./getputdelete', './util'], function (getputdelete, util) {

  "use strict";

  var prefix = 'remote_storage_wire_';

  var events = util.getEventEmitter('connected', 'error');

  var state = 'anonymous';

  function setSetting(key, value) {
    localStorage.setItem(prefix+key, JSON.stringify(value));

    calcState();

    if(state == 'connected') {
      events.emit('connected');
    }
  }

  function removeSetting(key) {
    localStorage.removeItem(prefix+key);
  }

  function getSetting(key) {
    var valStr = localStorage.getItem(prefix+key);
    if(typeof(valStr) == 'string') {
      try {
        return JSON.parse(valStr);
      } catch(e) {
        localStorage.removeItem(prefix+key);
      }
    }
    return null;
  }

  function disconnectRemote() {
    util.grepLocalStorage(new RegExp('^' + prefix), function(key) {
      localStorage.removeItem(key);
    });
    calcState();
  }

  function getState() {
    return state;
  }

  function calcState() {
    if(getSetting('storageType') && getSetting('storageHref')) {
      if(getSetting('bearerToken')) {
        state = 'connected';
      } else {
        state = 'authing';
      }
    } else {
      state = 'anonymous';
    }
    return state;
  }

  function on(eventType, cb) {
    events.on(eventType, cb);
  }

  function resolveKey(path) {
    var storageHref = getSetting('storageHref');
    return storageHref + path;
  }

  var foreignKeyRE = /^([^\/][^:]+):(\/.*)$/;

  function isForeign(path) {
    return foreignKeyRE.test(path);
  }

  // Namespace: wireClient
  //
  // The wireClient stores the user's storage information and controls getputdelete accordingly.
  //
  // Event: connected
  //
  // Fired once everything is configured.

  // Method: get
  //
  // Get data from given path from remotestorage
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //   callback - see <getputdelete.get> for details on the callback parameters
  function get(path, cb) {
    if(isForeign(path)) {
      return getForeign(path, cb);
    } else if(state != 'connected') {
      cb(new Error('not-connected'));
    }
    var token = getSetting('bearerToken');
    if(typeof(path) != 'string') {
      cb(new Error('argument "path" should be a string'));
    } else {
      getputdelete.get(resolveKey(path), token, cb);
    }
  }

  function getForeign(fullPath, cb) {
    var md = fullPath.match(foreignKeyRE);
    var userAddress = md[1];
    var path = md[2];
    var base = getStorageHrefForUser(userAddress);
    getputdelete.get(base + path, null, cb);
  }

  // Method: set
  //
  // Write data to given path in remotestorage
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //   valueStr - raw data to write
  //   mimeType - MIME type to set as Content-Type header
  //   callback - see <getputdelete.set> for details on the callback parameters.
  function set(path, valueStr, mimeType, cb) {
    if(isForeign(path)) {
      return cb(new Error("Foreign storage is read-only"));
    } else if(state != 'connected') {
      cb(new Error('not-connected'));
    }
    var token = getSetting('bearerToken');
    if(typeof(path) != 'string') {
      cb(new Error('argument "path" should be a string'));
    } else {
      if(valueStr && typeof(valueStr) != 'string' &&
         !(typeof(valueStr) == 'object' && valueStr instanceof ArrayBuffer)) {
        valueStr = JSON.stringify(valueStr);
      }
      getputdelete.set(resolveKey(path), valueStr, mimeType, token, cb);
    }
  }

  // Method: remove
  //
  // Remove data at given path from remotestorage
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //   callback - see <getputdelete.set> for details on the callback parameters.
  function remove(path, cb) {
    if(isForeign(path)) {
      return cb(new Error("Foreign storage is read-only"));
    }
    var token = getSetting('bearerToken');
    getputdelete.set(resolveKey(path), undefined, undefined, token, cb);
  }

  function getStorageHrefForUser(userAddress) {
    var info = getSetting('storageInfo:' + userAddress);
    if(! info) {
      throw new Error("userAddress unknown to wireClient: " + userAddress);
    }
    return info.href;
  }

  function addStorageInfo(userAddress, storageInfo) {
    setSetting('storageInfo:' + userAddress, storageInfo);
  }

  function hasStorageInfo(userAddress) {
    return !! getSetting('storageInfo:' + userAddress);
  }

  return {

    get: get,
    set: set,
    remove: remove,

    // Method: setStorageInfo
    //
    // Configure wireClient.
    //
    // Parameters:
    //   type - the storage type (see specification)
    //   href - base URL of the storage server
    //
    // Fires:
    //   configured - if wireClient is now fully configured
    //
    setStorageInfo   : function(type, href) {
      setSetting('storageType', type);
      setSetting('storageHref', href);
    },

    // Method: getStorageHref
    //
    // Get base URL of the user's remotestorage.
    getStorageHref   : function() {
      return getSetting('storageHref');
    },
    
    // Method: SetBearerToken
    //
    // Set the bearer token for authorization
    //
    // Parameters:
    //   bearerToken - token to use
    //
    // Fires:
    //   configured - if wireClient is now fully configured.
    //
    setBearerToken   : function(bearerToken) {
      setSetting('bearerToken', bearerToken);
    },

    getBearerToken   : function(bearerToken) {
      return getSetting('bearerToken');
    },

    // Method: addStorageInfo
    //
    // Add another user's storage info.
    // After calling this, keys in the form userAddress:path can be resolved.
    //
    // Parameters:
    //   userAddress - a user address in the form user@host
    //   storageInfo - an object, with at least an 'href' attribute
    addStorageInfo: addStorageInfo,

    // Method: hasStorageInfo
    //
    // Find out if the wireClient has cached storageInfo for the given userAddress.
    //
    // Parameters:
    //   userAddress - a user address to look up
    hasStorageInfo: hasStorageInfo,

    // Method: disconnectRemote
    //
    // Clear the wireClient configuration
    disconnectRemote : disconnectRemote,

    // Method: on
    //
    // Install an event handler
    //
    // 
    on               : on,

    // Method: getState
    //
    // Get current state.
    //
    // Possible states are:
    //   anonymous - no information set
    //   authing   - storage's type & href set, but no token received yet
    //   connected - all information present.
    getState         : getState,
    calcState: calcState
  };
});
