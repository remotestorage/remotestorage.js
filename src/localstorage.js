(function(global) {

  var NODES_PREFIX = "remotestorage:cache:nodes:";
  var CHANGES_PREFIX = "remotestorage:cache:changes:";

  RemoteStorage.LocalStorage = function() {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.eventHandling(this, 'change');
  };

  function b64ToUint6 (nChr) {
    return nChr > 64 && nChr < 91 ?
      nChr - 65
      : nChr > 96 && nChr < 123 ?
      nChr - 71
      : nChr > 47 && nChr < 58 ?
      nChr + 4
      : nChr === 43 ?
      62
      : nChr === 47 ?
      63
      :
      0;
  }

  function base64DecToArr (sBase64, nBlocksSize) {
    var
    sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
    nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);

    for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
      nMod4 = nInIdx & 3;
      nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
      if (nMod4 === 3 || nInLen - nInIdx === 1) {
        for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
          taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
        }
        nUint24 = 0;
      }
    }
    return taBytes;
  }

  // Helper to decide if node body is binary or not
  function isBinary(node){
    return node.match(/charset=binary/);
  }

  RemoteStorage.LocalStorage.prototype = {
    getNodes: function(paths) {
      var i, ret = {}, promise = promising();
      for(i=0; i<paths.length; i++) {
        try {
          ret[paths[i]] = JSON.parse(localStorage[NODES_PREFIX+paths[i]]);
        } catch(e) {
        }
      }
      promise.fulfill(ret);
      return promise;
    },

    setNodes: function(objs) {
      var i, promise = promising();
      for(i in objs) {
        localStorage[NODES_PREFIX+i] = JSON.stringify(objs[i]);
      }
      promise.fulfill();
      return promise;
    },

    forAllNodes: function(cb) {
      var i, node;
      for(i=0; i<localStorage.length; i++) {
        if(localStorage.key(i).substring(0, NODES_PREFIX.length) === NODES_PREFIX) {
          try {
            node = this.migrate(JSON.parse(localStorage[localStorage.key(i)]));
          } catch(e) {
            node = undefined;
          }
          if(node) {
            cb(node);
          }
        }
      }
      return promising().fulfill();
    }
  };

  RemoteStorage.LocalStorage._rs_init = function() {};

  RemoteStorage.LocalStorage._rs_supported = function() {
    return 'localStorage' in global;
  };

  RemoteStorage.LocalStorage._rs_cleanup = function() {
    var l = localStorage.length;
    var npl = NODES_PREFIX.length, cpl = CHANGES_PREFIX.length;
    var remove = [];
    for (var i=0;i<l;i++) {
      var key = localStorage.key(i);
      if (key.substr(0, npl) === NODES_PREFIX ||
         key.substr(0, cpl) === CHANGES_PREFIX) {
        remove.push(key);
      }
    }
    remove.forEach(function(key) {
      RemoteStorage.log('removing', key);
      delete localStorage[key];
    });
  };

})(typeof(window) !== 'undefined' ? window : global);
