/*global localStorage */
/*global ArrayBuffer */

define(['./getputdelete', './util'], function (getputdelete, util) {

  "use strict";

  var prefix = 'remote_storage_wire_';

  var events = util.getEventEmitter('connected', 'disconnected', 'error', 'busy', 'unbusy');

  var state = 'anonymous';

  var settings = util.getSettingStore('remotestorage_wire');

  // BUSY handling to indicate busy state in the widget.
  //
  // This is happening here instead of in "sync" (where it was before),
  // because we only want to indicate busyness when pushing out data
  // (i.e. sending PUT or DELETE requests).
  //
  var busyCounter = 0;

  // Increment busy counter and emit "busy" event, if needed
  function setBusy() {
    if(busyCounter === 0) {
      events.emit('busy');
    }
    busyCounter++;
  }

  // Decrement busy counter and emit "unbusy" event, if the counter hits zero
  function releaseBusy() {
    busyCounter--;
    if(busyCounter === 0) {
      events.emit('unbusy');
    }
  }

  function setSetting(key, value) {
    settings.set(key, value);

    calcState();
  }

  function removeSetting(key) {
    settings.remove(key);
  }

  function getSetting(key) {
    return settings.get(key);
  }

  function disconnectRemote() {
    settings.clear();
    calcState();
  }

  function getState() {
    return state;
  }

  function calcState() {
    var oldState = state;

    if(getSetting('storageType') && getSetting('storageHref')) {
      if(getSetting('bearerToken')) {
        state = 'connected';
      } else {
        state = 'authing';
      }
    } else {
      state = 'anonymous';
    }

    if(oldState !== state) {
      if(state === 'connected') {
        events.emit('connected');
      } else if(state === 'anonymous' && oldState === 'connected') {
        events.emit('disconnected');
      }
    }
    return state;
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
  // Get data from given path from remote storage.
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //
  function get(path) {
    if(isForeign(path)) {
      return getForeign(path);
    } else if(state != 'connected') {
      throw new Error('not-connected');
    }
    return getputdelete.get(
      resolveKey(path),
      getSetting('bearerToken')
    );
  }

  function getForeign(fullPath) {
    var md = fullPath.match(foreignKeyRE);
    var userAddress = md[1];
    var path = md[2];
    var base = getStorageHrefForUser(userAddress);
    return getputdelete.get(base + path, null);
  }

  // Method: set
  //
  // Write data to given path in remote storage.
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //   valueStr - raw data to write
  //   mimeType - MIME type to set as Content-Type header
  //   callback - see <getputdelete.set> for details on the callback parameters.
  function set(path, valueStr, mimeType, cb) {
    if(isForeign(path)) {
      throw new Error("Foreign storage is read-only");
    } else if(state != 'connected') {
      throw new Error('not-connected');
    }
    var token = getSetting('bearerToken');
    if(typeof(path) != 'string') {
      throw new Error('argument "path" should be a string');
    } else {
      if(valueStr && typeof(valueStr) != 'string' &&
         !(typeof(valueStr) == 'object' && valueStr instanceof ArrayBuffer)) {
        valueStr = JSON.stringify(valueStr);
      }
      setBusy();
      return getputdelete.set(resolveKey(path), valueStr, mimeType, token).
        then(releaseBusy);
    }
  }

  // Method: remove
  //
  // Remove data at given path from remote storage.
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //   callback - see <getputdelete.set> for details on the callback parameters.
  function remove(path, cb) {
    if(isForeign(path)) {
      return cb(new Error("Foreign storage is read-only"));
    }
    var token = getSetting('bearerToken');
    setBusy();
    return getputdelete.set(resolveKey(path), undefined, undefined, token, cb).
      then(releaseBusy);
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


  var typeAliasMap = {
    'draft-dejong-remotestorage-00': 'remotestorage-00',
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': '2012.04'
  }

  return util.extend(events, {

    get: get,
    set: set,
    remove: remove,

    // Method: setStorageInfo
    //
    // Configure wireClient.
    //
    // Storage info object:
    //   type - the storage type (see specification)
    //   href - base URL of the storage server
    //
    // Fires:
    //   configured - if wireClient is now fully configured
    //
    setStorageInfo   : function(info) {
      info = util.extend({}, info);
      info.type = typeAliasMap[info.type] || info.type;
      setSetting('storageType', info.type);
      setSetting('storageHref', info.href);
      return info;
    },

    getStorageInfo: function() {
      return {
        type: getSetting('storageType'),
        href: getSetting('storageHref')
      };
    },

    // Method: getStorageHref
    //
    // Get base URL of the user's remote storage.
    getStorageHref   : function() {
      return getSetting('storageHref');
    },

    // Method: getStorageType
    //
    // Get API version of the user's remote storage, probably '2012.04' or 'remotestorage-00'.
    getStorageType   : function() {
      return getSetting('storageType');
    },

    // Method: SetBearerToken
    //
    // Set the bearer token for authorization.
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
    // Clear the wireClient configuration.
    disconnectRemote : disconnectRemote,

    // Method: on
    //
    // Install an event handler.
    //
    // 

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
  });
});
