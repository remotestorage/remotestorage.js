(function(global) {

  var NODES_PREFIX = "remotestorage:cache:nodes:";
  var CHANGES_PREFIX = "remotestorage:cache:changes:";

  RemoteStorage.LocalStorage = function() {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.eventHandling(this, 'change', 'conflict');
  };

  function makeNode(path) {
    var node = { path: path };
    if (path[path.length - 1] === '/') {
      node.body = {};
      node.cached = {};
      node.contentType = 'application/json';
    }
    return node;
  }

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
      var oldNode = this._get(path);
      if (isBinary(contentType)){
        body = this.toBase64(body);
      }
      var node = {
        path: path,
        contentType: contentType,
        body: body
      };
      localStorage[NODES_PREFIX + path] = JSON.stringify(node);
      this._emit('change', {
        path: path,
        origin: incoming ? 'remote' : 'window',
        oldValue: oldNode ? oldNode.body : undefined,
        newValue: body
      });
      if (incoming) {
        this._setRevision(path, revision);
      }
      if (!incoming) {
        this._recordChange(path, { action: 'PUT' });
      }
      return promising().fulfill(200);
    },

    putDirectory: function(path, body, revision) {
      this._addDirectoryCacheNode(path, body);
      this._addToParent(path, 'body');
      this._setRevision(path, revision);
      return promising().fulfill();
    },

    get: function(path) {
      var node = this._get(path);
      if (node) {
        if (isBinary(node.contentType)){
          node.body = this.toArrayBuffer(node.body);
        }
        return promising().fulfill(200, node.body, node.contentType, node.revision);
      } else {
        return promising().fulfill(404);
      }
    },

    'delete': function(path, incoming) {
      var oldNode = this._get(path);
      delete localStorage[NODES_PREFIX + path];
      this._removeFromParent(path);
      if (oldNode) {
        this._emit('change', {
          path: path,
          origin: incoming ? 'remote' : 'window',
          oldValue: oldNode.body,
          newValue: undefined
        });
      }
      if (! incoming) {
        this._recordChange(path, { action: 'DELETE' });
      }
      return promising().fulfill(200);
    },

    _setRevision: function(path, revision) {
      var node = this._get(path) || makeNode(path);
      node.revision = revision;
      localStorage[NODES_PREFIX + path] = JSON.stringify(node);
      this._addToParent(path, 'cached', revision);
      return promising().fulfill();
    },

    getRevision: function(path) {
      var node = this._get(path);
      return promising.fulfill(node ? node.revision : undefined);
    },

    _get: function(path) {
      var node;
      try {
        node = JSON.parse(localStorage[NODES_PREFIX + path]);
      } catch(e) { /* ignored */ }
      return node;
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

    _addToParent: function(path, key, revision) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
      if (parts) {
        var dirname = parts[1], basename = parts[2];
        var node = this._get(dirname) || makeNode(dirname);
        node[key][basename] = revision || true;
        localStorage[NODES_PREFIX + dirname] = JSON.stringify(node);
        if (dirname !== '/') {
          this._addToParent(dirname, key, true);
        }
      }
    },

    _addDirectoryCacheNode: function(path, body) {
      var node = this._get(path) || makeNode(path);
      node.body = body;
      localStorage[NODES_PREFIX + path] = JSON.stringify(node);
    },

    _removeFromParent: function(path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
      if (parts) {
        var dirname = parts[1], basename = parts[2];
        var node = this._get(dirname);
        if (node) {
          delete node.cached[basename];
          if (Object.keys(node.cached).length > 0) {
            localStorage[NODES_PREFIX + dirname] = JSON.stringify(node);
          } else {
            delete localStorage[NODES_PREFIX + dirname];
            if (dirname !== '/') {
              this._removeFromParent(dirname);
            }
          }
        }
      }
    },

    fireInitial: function() {
      var l = localStorage.length, npl = NODES_PREFIX.length;
      for(var i=0;i<l;i++) {
        var key = localStorage.key(i);
        if (key.substr(0, npl) === NODES_PREFIX) {
          var path = key.substr(npl);
          var node = this._get(path);
          this._emit('change', {
            path: path,
            origin: 'local',
            oldValue: undefined,
            newValue: node.body
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
    var npl = NODES_PREFIX.length, cpl = CHANGES_PREFIX.length;
    var remove = [];
    for(var i=0;i<l;i++) {
      var key = localStorage.key(i);
      if (key.substr(0, npl) === NODES_PREFIX ||
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
