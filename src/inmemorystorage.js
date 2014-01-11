(function(global) {
  function makeNode(path) {
    var node = { path: path };
    if (path[path.length - 1] === '/') {
      node.body = {};
      node.cached = {};
      node.contentType = 'application/json';
    }
    return node;
  }

  RemoteStorage.InMemoryStorage = function(rs) {
    this.rs = rs;
    RemoteStorage.cachingLayer(this);
    RemoteStorage.eventHandling(this, 'change', 'conflict');
    this._storage = {};
    this._changes = {};
  };

  RemoteStorage.InMemoryStorage.prototype = {
    get: function(path) {
      var node = this._storage[path];
      if (node) {
        return promising().fulfill(200, node.body, node.contentType, node.revision);
      } else {
        return promising().fulfill(404);
      }
    },

    put: function(path, body, contentType, incoming, revision) {
      var oldNode = this._storage[path];
      var node = {
        path: path,
        contentType: contentType,
        body: body
      };
      this._storage[path] = node;

      this._emit('change', {
        path: path,
        origin: incoming ? 'remote' : 'window',
        oldValue: oldNode ? oldNode.body : undefined,
        newValue: body
      });

      if (incoming) {
        this.setRevision(path, revision);
      }
      if (!incoming) {
        this._recordChange(path, { action: 'PUT' });
        // TODO why not set a revision?
      }

      return promising().fulfill(200);
    },

    putFolder: function(path, body, revision) {
      this._addFolderCacheNode(path, body);
      this._addToParent(path, 'body');
      this.setRevision(path, revision);
      return promising().fulfill();
    },

    'delete': function(path, incoming) {
      var oldNode = this._storage[path];
      delete this._storage[path];
      this._removeFromParent(path, 'cached');
      if (!incoming) {
        this._recordChange(path, { action: 'DELETE' });
      }

      if (oldNode) {
        this._emit('change', {
          path: path,
          origin: incoming ? 'remote' : 'window',
          oldValue: oldNode.body,
          newValue: undefined
        });
      }
      return promising().fulfill(200);
    },

    _addToParent: function(path, key, revision) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
      if (parts) {
        var storage = this._storage;
        var foldername = parts[1], basename = parts[2];
        var node = storage[foldername] || makeNode(foldername);
        node[key][basename] = revision || true;
        storage[foldername] = node;
        if (foldername !== '/') {
          this._addToParent(foldername, key, true);
        }
      }
    },

    _addFolderCacheNode: function(path, body) {
      var storage = this._storage;
      var node = storage[path] || makeNode(path);
      node.body = body;
      storage[path] = node;
      return true;
    },

    _removeFromParent: function(path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
      if (parts) {
        var storage = this._storage;
        var foldername = parts[1], basename = parts[2];
        var node = storage[foldername];
        if (node) {
          delete node.cached[basename];
          if (Object.keys(node.cached).length === 0) {
            delete storage[foldername];
            if (foldername !== '/') {
              this._removeFromParent(foldername);
            }
          }
        }
      }
    },

    _recordChange: function(path, attributes) {
      var change = this._changes[path] || {};
      for (var key in attributes) {
        change[key] = attributes[key];
      }
      change.path = path;
      this._changes[path] = change;
    },

    clearChange: function(path) {
      delete this._changes[path];
      return promising().fulfill();
    },

    changesBelow: function(path) {
      var changes = [];
      var l = path.length;
      for (var key in this._changes) {
        if (key.substr(0,l) === path) {
          changes.push(this._changes[key]);
        }
      }
      return promising().fulfill(changes);
    },

    setConflict: function(path, attributes) {
      var event = this._createConflictEvent(path, attributes);
      this._recordChange(path, { conflict: attributes });
      this._emit('conflict', event);
    },

    setRevision: function(path, revision) {
      var node = this._storage[path] || makeNode(path);
      node.revision = revision;
      this._storage[path] = node;
      this._addToParent(path, 'cached', revision);
      return promising().fulfill();
    },

    getRevision: function(path) {
      var rev;
      if (this._storage[path]) {
        rev = this._storage[path].revision;
      }
      return promising().fulfill(rev);
    },

    fireInitial: function() {
      // fireInital fires a change event for each item in the store
      // inMemoryStorage is always empty on pageLoad
    }
  };

  RemoteStorage.InMemoryStorage._rs_init = function() {};

  RemoteStorage.InMemoryStorage._rs_supported = function() {
    return true;
  };

  RemoteStorage.InMemoryStorage._rs_cleanup = function() {};
})(typeof(window) !== 'undefined' ? window : global);
