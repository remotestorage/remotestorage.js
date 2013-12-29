(function(global) {

  var META_PREFIX = "remotestorage:cache:meta:";
  var BODIES_PREFIX = "remotestorage:cache:bodies:";
  var CHANGES_PREFIX = "remotestorage:cache:changes:";

  RemoteStorage.LocalStorage = function() {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.eventHandling(this, 'change', 'conflict');
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

  function parsePath(path) {
    var parts, ret = {
      isRoot: (path === '')
    };
    if(path.substr(-1) === '/') {
      parts = path.substring(0, path.length-1).split('/');
      ret.isFolder = true;
      ret.itemName = parts[parts.length-1]+'/';
    } else {
      parts = path.split('/');
      ret.isFolder = false;
      ret.itemName = parts[parts.length-1];
    }
    parts.pop();
    ret.containingFolder = parts.join('/')+ (parts.length ? '/' : '');
    console.log('parsePath', path, parts, ret);
    return ret;
  }

  // Helper to decide if node body is binary or not
  function isBinary(node){
    return node.match(/charset=binary/);
  }

  RemoteStorage.LocalStorage.prototype = {
    toBase64: function(data){
      var arr = new Uint8Array(data);
      var str = '';
      for(var i = 0; i < arr.length; i++) {
        //atob(btoa(String.fromCharCode(arr[0]))).charCodeAt(0)
        str+=String.fromCharCode(arr[i]);
      }
      return btoa(str);
    },

    toArrayBuffer: base64DecToArr,

    put: function(path, body, contentType, incoming, revision) {
      var oldBody = this._getBody(path),
        pathObj = parsePath(path);
      this._emit('change', {
        path: path,
        origin: incoming ? 'remote' : 'window',
        oldValue: oldBody,
        newValue: body
      });
      if (isBinary(contentType)){
        body = this.toBase64(body);
      }
      localStorage[BODIES_PREFIX + path] = body;
      this._addToParent(pathObj, revision, contentType, body.length);
      if (!incoming) {
        this._recordChange(path, { action: 'PUT' });
      }
      return promising().fulfill(200);
    },

    putFolder: function(path, items, revision) {
      var pathObj = parsePath(path);
      this._setMetas(path, items);
      this._addToParent(pathObj, revision);
      return promising().fulfill();
    },

    get: function(path) {
      var body = this._getBody(path),
        meta = this._getMeta(path);
      if (body) {
        if (isBinary(meta.contentType)){
          body = this.toArrayBuffer(body);
        }
        return promising().fulfill(200, body, meta.contentType, meta.revision);
      } else {
        return promising().fulfill(404);
      }
    },

    'delete': function(path, incoming) {
      var oldBody = this._getBody(path);
      delete localStorage[BODIES_PREFIX + path];
      this._removeFromParent(path);
      if (oldBody) {
        this._emit('change', {
          path: path,
          origin: incoming ? 'remote' : 'window',
          oldValue: oldBody,
          newValue: undefined
        });
      }
      if (! incoming) {
        this._recordChange(path, { action: 'DELETE' });
      }
      return promising().fulfill(200);
    },

    setRevision: function(path, revision) {
      var pathObj = parsePath(path);
      this._addToParent(pathObj, revision);
      return promising().fulfill();
    },

    getRevision: function(path) {
      var meta = this._getMeta(path);
      return promising.fulfill(meta ? meta.ETag : undefined);
    },

    _getBody: function(path) {
      return localStorage[BODIES_PREFIX + path];
    },

    _getMeta: function(path) {
      var pathObj = parsePath(path),
        parentItems = this._getMetas(pathObj.containingFolder);
      return parentItems[pathObj.itemName];
    },

    _getMetas: function(path) {
      var str = localStorage[META_PREFIX + path], items;
      if(str.length) {
        try {
          items = JSON.parse(str);
        } catch(e) {
        }
      }
      return items || {};
    },

    _setMetas: function(path, items) {
      localStorage[BODIES_PREFIX + path] = JSON.stringify(items);
    },

    _recordChange: function(path, attributes) {
      var change;
      try {
        change = JSON.parse(localStorage[CHANGES_PREFIX + path]);
      } catch(e) {
        change = {};
      }
      for(var key in attributes) {
        change[key] = attributes[key];
      }
      change.path = path;
      localStorage[CHANGES_PREFIX + path] = JSON.stringify(change);
    },

    clearChange: function(path) {
      delete localStorage[CHANGES_PREFIX + path];
      return promising().fulfill();
    },

    changesBelow: function(path) {
      var changes = [];
      var kl = localStorage.length;
      var prefix = CHANGES_PREFIX + path, pl = prefix.length;
      for(var i=0;i<kl;i++) {
        var key = localStorage.key(i);
        if (key.substr(0, pl) === prefix) {
          changes.push(JSON.parse(localStorage[key]));
        }
      }
      return promising().fulfill(changes);
    },

    setConflict: function(path, attributes) {
      var event = this._createConflictEvent(path, attributes);
      this._recordChange(path, { conflict: attributes });
      this._emit('conflict', event);
    },

    _addToParent: function(pathObj, revision, contentType, contentLength) {
      var items = this._getMetas(pathObj.containingFolder);// should trigger creation up to the root
      //creating this folder's path up to the root:
      if(!pathObj.isRoot && items === {}) {
        this._addToParent(parsePath(pathObj.containingFolder), true);
      }
      if(!items[pathObj.itemName]) {
        items[pathObj.itemName] = {};
      }
      if(revision) {
        items[pathObj.itemName].ETag = revision;
      }
      if(contentType) {
        items[pathObj.itemName]['Content-Type'] = contentType;
      }
      if(contentLength) {
        items[pathObj.itemName]['Content-Length'] = contentLength;
      }
      this._setMetas(pathObj.containingFolder, items);
    },

    _removeFromParent: function(pathObj) {
      var items = this._getMetas(pathObj.containingFolder);// should trigger creation up to the root
      delete items[pathObj.itemName];
      this._setMetas(pathObj.containingFolder, items);
    },

    fireInitial: function() {
      var l = localStorage.length, bpl = BODIES_PREFIX.length;
      for(var i=0;i<l;i++) {
        var key = localStorage.key(i);
        if (key.substr(0, bpl) === BODIES_PREFIX) {
          var path = key.substr(bpl);
          var body = this._getBody(path);
          this._emit('change', {
            path: path,
            origin: 'local',
            oldValue: undefined,
            newValue: body
          });
        }
      }
    }

  };

  RemoteStorage.LocalStorage._rs_init = function() {};

  RemoteStorage.LocalStorage._rs_supported = function() {
    return 'localStorage' in global;
  };

  RemoteStorage.LocalStorage._rs_cleanup = function() {
    var l = localStorage.length;
    var bpl = BODIES_PREFIX.length, mpl = META_PREFIX.length, cpl = CHANGES_PREFIX.length;
    var remove = [];
    for(var i=0;i<l;i++) {
      var key = localStorage.key(i);
      if (key.substr(0, bpl) === BODIES_PREFIX ||
         key.substr(0, mpl) === META_PREFIX ||
         key.substr(0, cpl) === CHANGES_PREFIX) {
        remove.push(key);
      }
    }
    remove.forEach(function(key) {
      console.log('removing', key);
      delete localStorage[key];
    });
  };

})(typeof(window) !== 'undefined' ? window : global);
