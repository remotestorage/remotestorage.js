(function(global) {
  function makeNode(path) {
    var node = { path: path };
    if (path[path.length - 1] === '/') {
      node.body = {};
      node.contentType = 'application/json';
    }
    return node;
  }

  function applyRecursive(path, cb) {
    var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
    if (parts) {
      var dirname = parts[1];
      var basename = parts[2];

      if (cb(dirname, basename) && dirname != '/') {
        applyRecursive(dirname, cb);
      }
    } else {
      throw new Error('inMemoryStorage encountered invalid path : '+path);
    }
  }

  RemoteStorage.InMemoryStorage = function(rs) {
    this.rs = rs;
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

    put: function(path, body, contentType, incoming) {
      var oldNode = this._storage[path];
      var node = {
        path: path,
        contentType: contentType,
        body: body
      };
      this._storage[path] = node;
      this._addToParent(path);
      if (!incoming) {
        this._recordChange(path, {action: 'PUT' });
      }

      this._emit('change', {
        path: path,
        origin: incoming ? 'remote' : 'window',
        oldValue: oldNode ? oldNode.body : undefined,
        newValue: body
      });
      return promising().fulfill(200);
    },

    'delete': function(path, incoming) {
      var oldNode = this._storage[path];
      delete this._storage[path];
      this._removeFromParent(path);
      if (!incoming) {
        this._recordChange(path, {action: 'DELETE' });
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

    _addToParent: function(path) {
      var storage = this._storage;
      applyRecursive(path, function(dirname, basename) {
        var node = storage[dirname] || makeNode(dirname);
        node.body[basename] = true;
        storage[dirname] = node;
        return true;
      });
    },

    _removeFromParent: function(path) {
      var storage = this._storage;
      var self = this;
      applyRecursive(path, function(dirname, basename) {
        var node = storage[dirname];
        if (node) {
          delete node.body[basename];
          if (Object.keys(node.body).length === 0) {
            delete storage[dirname];
            return true;
          } else {
            self._addToParent(dirname);
          }
        }
      });
    },

    _recordChange: function(path, attributes) {
      var change = this._changes[path] || {};
      for(var k in attributes)
        change[k] = attributes[k];
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
      for(var k in this._changes) {
        if (k.substr(0,l) === path) {
          changes.push(this._changes[k]);
        }
      }
      return promising().fulfill(changes);
    },

    setConflict: function(path, attributes) {
      this._recordChange(path, { conflict: attributes });
      var self = this;
      var event = {path:path};
      for(var k in attributes)
        event[k] = attributes[k];

      event.resolve = function(resolution) {
        if (resolution === 'remote'|| resolution === 'local') {
          attributes.resolution = resolution;
          self._recordChange(path, { conflict: attributes });
        } else {
          throw new Error('Invalid resolution: '+resolution);
        }
      };
      this._emit('conflict', event);
    },

    setRevision: function(path, revision) {
      var node = this._storage[path] || makeNode(path);
      node.revision = revision;
      this._storage[path] = node;
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
