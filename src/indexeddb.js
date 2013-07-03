(function(global) {

  var RS = RemoteStorage;
  
  var DEFAULT_DB_NAME = 'remotestorage';
  var DEFAULT_DB;
  
  function keepDirNode(node) {
    return Object.keys(node.body).length > 0 ||
      Object.keys(node.cached).length > 0;
  }

  function removeFromParent(nodes, path, key) {
    var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
    if(parts) {
      var dirname = parts[1], basename = parts[2];
      nodes.get(dirname).onsuccess = function(evt) {
        var node = evt.target.result;
        delete node[key][basename];
        if(keepDirNode(node)) {
          nodes.put(node);
        } else {
          nodes.delete(node.path).onsuccess = function() {
            if(dirname != '/') {
              removeFromParent(nodes, dirname, key);
            }
          };
        }
      };
    }
  }

  function makeNode(path) {
    var node = { path: path };
    if(path[path.length - 1] == '/') {
      node.body = {};
      node.cached = {};
      node.contentType = 'application/json';
    }
    return node;
  }

  function addToParent(nodes, path, key) {
    var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
    if(parts) {
      var dirname = parts[1], basename = parts[2];
      nodes.get(dirname).onsuccess = function(evt) {
        var node = evt.target.result || makeNode(dirname);
        node[key][basename] = true;
        nodes.put(node).onsuccess = function() {
          if(dirname != '/') {
            addToParent(nodes, dirname, key);
          }
        };
      };
    }
  }

  RS.IndexedDB = function(database) {
    this.db = database || DEFAULT_DB;
    RS.eventHandling(this, 'change', 'conflict');
  };
  RS.IndexedDB.prototype = {

    get: function(path) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var nodes = transaction.objectStore('nodes');
      var nodeReq = nodes.get(path);
      var node;
      nodeReq.onsuccess = function() {
        node = nodeReq.result;
      };
      transaction.oncomplete = function() {
        if(node) {
          promise.fulfill(200, node.body, node.contentType, node.revision);
        } else {
          promise.fulfill(404);
        }
      };
      return promise;
    },

    put: function(path, body, contentType, incoming) {
      var promise = promising();
      if(path[path.length - 1] == '/') { throw "Bad: don't PUT folders"; }
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodes = transaction.objectStore('nodes');
      var oldNode;
      nodes.get(path).onsuccess = function(evt) {
        oldNode = evt.target.result;
        var node = {
          path: path, contentType: contentType, body: body
        };
        nodes.put(node).onsuccess = function() { addToParent(nodes, path, 'body'); };
      };
      transaction.oncomplete = function() {
        this._emit('change', {
          path: path,
          origin: incoming ? 'remote' : 'window',
          oldValue: oldNode ? oldNode.body : undefined,
          newValue: body
        });
        if(! incoming) {
          this._recordChange(path, { action: 'PUT' });
        }
        promise.fulfill(200);
      }.bind(this);
      return promise;
    },

    delete: function(path, incoming) {
      var promise = promising();
      if(path[path.length - 1] == '/') { throw "Bad: don't DELETE folders"; }
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodes = transaction.objectStore('nodes');
      var oldNode;
      nodes.get(path).onsuccess = function(evt) {
        oldNode = evt.target.result;
        nodes.delete(path).onsuccess = function() {
          removeFromParent(nodes, path, 'body', incoming);
        };
      }
      transaction.oncomplete = function() {
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
        promise.fulfill(200);
      }.bind(this);
      return promise;
    },

    setRevision: function(path, revision) {
      return this.setRevisions([[path, revision]]);
    },

    setRevisions: function(revs) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      revs.forEach(function(rev) {
        var nodes = transaction.objectStore('nodes');
        nodes.get(rev[0]).onsuccess = function(event) {
          var node = event.target.result || makeNode(rev[0]);
          node.revision = rev[1];
          nodes.put(node).onsuccess = function() {
            addToParent(nodes, rev[0], 'cached');
          };
        };
      });
      transaction.oncomplete = function() {
        promise.fulfill();
      };
      return promise;
    },

    getRevision: function(path) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var rev;
      transaction.objectStore('nodes').
        get(path).onsuccess = function(evt) {
          if(evt.target.result) {
            rev = evt.target.result.revision;
          }
        };
      transaction.oncomplete = function() {
        promise.fulfill(rev);
      };
      return promise;
    },

    getCached: function(path) {
      if(path[path.length - 1] != '/') {
        return this.get(path);
      }
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var nodes = transaction.objectStore('nodes');
      nodes.get(path).onsuccess = function(evt) {
        var node = evt.target.result || {};
        promise.fulfill(200, node.cached, node.contentType, node.revision);
      };
      return promise;
    },

    reset: function(callback) {
      var dbName = this.db.name;
      this.db.close();
      var self = this;
      RS.IndexedDB.clean(this.db.name, function() {
        RS.IndexedDB.open(dbName, function(other) {
          // hacky!
          self.db = other.db;
          callback(self);
        });
      });
    },

    _fireInitial: function() {
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var cursorReq = transaction.objectStore('nodes').openCursor();
      cursorReq.onsuccess = function(evt) {
        var cursor = evt.target.result;
        if(cursor) {
          var path = cursor.key;
          if(path.substr(-1) != '/') {
            this._emit('change', {
              path: path,
              origin: 'remote',
              oldValue: undefined,
              newValue: cursor.value.body
            });
          }
          cursor.continue();
        }
      }.bind(this);
    },

    _recordChange: function(path, attributes) {
      var transaction = this.db.transaction(['changes'], 'readwrite');
      var changes = transaction.objectStore('changes');
      var change;
      changes.get(path).onsuccess = function(evt) {
        change = evt.target.result || {};
        change.path = path;
        for(var key in attributes) {
          change[key] = attributes[key];
        }
        changes.put(change);
      };
      transaction.oncomplete = function() {
      };
    },

    clearChange: function(path) {
      var promise = promising();
      var transaction = this.db.transaction(['changes'], 'readwrite');
      var changes = transaction.objectStore('changes');
      changes.delete(path);
      transaction.oncomplete = function() {
        promise.fulfill();
      }
      return promise;
    },

    changesBelow: function(path) {
      var promise = promising();
      var transaction = this.db.transaction(['changes'], 'readonly');
      var cursorReq = transaction.objectStore('changes').
        openCursor(IDBKeyRange.lowerBound(path));
      var pl = path.length;
      var changes = [];
      cursorReq.onsuccess = function() {
        var cursor = cursorReq.result;
        if(cursor) {
          if(cursor.key.substr(0, pl) == path) {
            changes.push(cursor.value);
            cursor.continue();
          }
        }
      };
      transaction.oncomplete = function() {
        promise.fulfill(changes);
      };
      return promise;
    },

    setConflict: function(path, attributes) {
      var event = { path: path };
      for(var key in attributes) {
        event[key] = attributes[key];
      }
      this._recordChange(path, { conflict: attributes }).
        then(function() {
          // fire conflict once conflict has been recorded.
          this._emit('conflict', event);
        }.bind(this));
      event.resolve = function(resolution) {
        if(resolution == 'remote' || resolution == 'local') {
          attributes = resolution;
          this._recordChange(path, { conflict: attributes });
        } else {
          throw "Invalid resolution: " + resolution;
        }
      }.bind(this);
      event.resolve = makeResolver(local, path);
    }

  };

  var DB_VERSION = 2;
  RS.IndexedDB.open = function(name, callback) {
    var dbOpen = indexedDB.open(name, DB_VERSION);
    dbOpen.onerror = function() {
      console.error("Opening db failed: ", dbOpen.errorCode);
    };
    dbOpen.onupgradeneeded = function() {
      var db = dbOpen.result;
      db.createObjectStore('nodes', { keyPath: 'path' });
      db.createObjectStore('changes', { keyPath: 'path' });
    }
    dbOpen.onsuccess = function() {
      callback(dbOpen.result);
    };
  };

  RS.IndexedDB.clean = function(databaseName, callback) {
    var req = indexedDB.deleteDatabase(databaseName);
    req.onsuccess = function() {
      console.log('done removing db');
      callback();
    };
    req.onerror = function(evt) {
      console.error('failed to remove database "' + databaseName + '"', evt);
    };
  };

  RS.IndexedDB._rs_init = function(remoteStorage) {
    var promise = promising();
    remoteStorage.on('ready', function() {
      promise.then(function() {
        remoteStorage.local._fireInitial();
      });
    });
    RS.IndexedDB.open(DEFAULT_DB_NAME, function(db) {
      DEFAULT_DB = db;
      promise.fulfill();
    });
    return promise;
  };

  RS.IndexedDB._rs_supported = function() {
    return 'indexedDB' in global;
  }

  RS.IndexedDB._rs_cleanup = function() {
    var promise = promising();
    RS.IndexedDB.clean(DEFAULT_DB_NAME, function() {
      promise.fulfill();
    });
    return promise;
  }

})(this);
