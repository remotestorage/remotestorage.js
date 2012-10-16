define(['./getputdelete', './util'], function (getputdelete, util) {

  "use strict";

  var prefix = 'remote_storage_wire_';

  var events = util.getEventEmitter('connected', 'error');

  function setSetting(key, value) {
    localStorage.setItem(prefix+key, JSON.stringify(value));

    if(getState() == 'connected') {
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
    removeSetting('storageType');
    removeSetting('storageHref');
    removeSetting('bearerToken');
  }
  function getState() {
    if(getSetting('storageType') && getSetting('storageHref')) {
      if(getSetting('bearerToken')) {
        return 'connected';
      } else {
        return 'authing';
      }
    } else {
      return 'anonymous';
    }
  }
  function on(eventType, cb) {
    events.on(eventType, cb);
  }

  function resolveKey(storageType, storageHref, basePath, relPath) {
    var item = ((basePath.length?(basePath + '/'):'') + relPath);
    return storageHref + item;
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
    var storageType = getSetting('storageType'),
    storageHref = getSetting('storageHref'),
    token = getSetting('bearerToken');
    if(typeof(path) != 'string') {
      cb('argument "path" should be a string');
    } else {
      getputdelete.get(resolveKey(storageType, storageHref, '', path), token, cb);
    }
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
    var storageType = getSetting('storageType'),
    storageHref = getSetting('storageHref'),
    token = getSetting('bearerToken');
    if(typeof(path) != 'string') {
      cb('argument "path" should be a string');
    } else {
      if(valueStr && typeof(valueStr) != 'string') {
        valueStr = JSON.stringify(valueStr);
      }
      getputdelete.set(resolveKey(storageType, storageHref, '', path), valueStr, mimeType, token, cb);
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
    var storageType = getSetting('storageType');
    var storageHref = getSetting('storageHref');
    var token = getSetting('bearerToken');
    getputdelete.set(
      resolveKey(storageType, storageHref, '', path),
      undefined, undefined, token, cb
    );
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
      return getSetting('storageHref')
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
    getState         : getState
  };
});
