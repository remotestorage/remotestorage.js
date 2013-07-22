(function(global) {

  var NODES_PREFIX = "remotestorage:cache:nodes:";
  var CHANGES_PREFIX = "remotestorage:cache:changes:";

  RemoteStorage.LocalStorage = function() {
    RemoteStorage.eventHandling(this, 'change', 'conflict');
  };

  function makeNode(path) {
    var node = { path: path };
    if(path[path.length - 1] == '/') {
      node.body = {};
      node.cached = {};
      node.contentType = 'application/json';
    }
    return node;
  }

  RemoteStorage.LocalStorage.prototype = {

    get: function(path) {
      var node = this._get(path);
      if(node) {
        return promising().fulfill(200, node.body, node.contentType, node.revision);
      } else {
        return promising().fulfill(404);
      }
    },

    put: function(path, body, contentType, incoming) {
      var oldNode = this._get(path);
      var node = {
        path: path, contentType: contentType, body: body
      };
      localStorage[NODES_PREFIX + path] = JSON.stringify(node);
      this._addToParent(path);
      this._emit('change', {
        path: path,
        origin: incoming ? 'remote' : 'window',
        oldValue: oldNode ? oldNode.body : undefined,
        newValue: body
      });
      if(! incoming) {
        this._recordChange(path, { action: 'PUT' });
      }
      return promising().fulfill(200);
    },

    'delete': function(path, incoming) {
      console.log('(localStorage) DELETE', path, incoming);
      var oldNode = this._get(path);
      delete localStorage[NODES_PREFIX + path];
      this._removeFromParent(path);
      if(oldNode) {
        this._emit('change', {
          path: path,
          origin: incoming ? 'remote' : 'window',
          oldValue: oldNode.body,
          newValue: undefined
        });
      }
      if(! incoming) {
        this._recordChange(path, { action: 'DELETE' });
      }
      return promising().fulfill(200);
    },

    setRevision: function(path, revision) {
      var node = this._get(path) || makeNode(path);
      node.revision = revision;
      localStorage[NODES_PREFIX + path] = JSON.stringify(node);
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
        if(key.substr(0, pl) == prefix) {
          changes.push(JSON.parse(localStorage[key]));
        }
      }
      return promising().fulfill(changes);
    },

    setConflict: function(path, attributes) {
      var event = { path: path };
      for(var key in attributes) {
        event[key] = attributes[key];
      }
      this._recordChange(path, { conflict: attributes });
      event.resolve = function(resolution) {
        if(resolution == 'remote' || resolution == 'local') {
          attributes.resolution = resolution;
          this._recordChange(path, { conflict: attributes });
        } else {
          throw "Invalid resolution: " + resolution;
        }
      }.bind(this);
      this._emit('conflict', event);
    },

    _addToParent: function(path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
      if(parts) {
        var dirname = parts[1], basename = parts[2];
        var node = this._get(dirname) || makeNode(dirname);
        node.body[basename] = true;
        localStorage[NODES_PREFIX + dirname] = JSON.stringify(node);
        if(dirname != '/') {
          this._addToParent(dirname);
        }
      }
    },

    _removeFromParent: function(path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
      if(parts) {
        var dirname = parts[1], basename = parts[2];
        var node = this._get(dirname);
        if(node) {
          delete node.body[basename];
          if(Object.keys(node.body).length > 0) {
            localStorage[NODES_PREFIX + dirname] = JSON.stringify(node);
          } else {
            delete localStorage[NODES_PREFIX + dirname];
            if(dirname != '/') {
              this._removeFromParent(dirname);
            }
          }
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
      if(key.substr(0, npl) == NODES_PREFIX ||
         key.substr(0, cpl) == CHANGES_PREFIX) {
        remove.push(key);
      }
    }
    remove.forEach(function(key) {
      console.log('removing', key);
      delete localStorage[key];
    });
  };

})(this);
