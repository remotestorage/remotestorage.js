(function() {
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
        if(keepDirnode(node)) {
          nodes.put(node);
        } else {
          nodes.remove(node).onsuccess = function() {
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
        console.log('try to set key', key, 'on node', node);
        node[key][basename] = true;
        nodes.put(node).onsuccess = function() {
          if(dirname != '/') {
            addToParent(nodes, dirname, key);
          }
        };
      };
    }
  }

  RemoteStorage.IndexedDB = function(database) {
    this.db = database;
  };
  RemoteStorage.IndexedDB.prototype = {

    get: function(path) {
      var promise = promising();
      console.log('GET', path);
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

    put: function(path, body, contentType) {
      var promise = promisinog();
      console.log('PUT', path);
      if(path[path.length - 1] == '/') { throw "Bad: don't PUT folders"; }
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodes = transaction.objectStore('nodes');
      nodes.put({ path: path, contentType: contentType, body: body }).
        onsuccess = function() { addToParent(nodes, path, 'body'); };
      transaction.oncomplete = function() {
        promise.fulfill(200);
      };
      return promise;
    },

    delete: function(path) {
      var promise = promising();
      console.log('DELETE', path);
      if(path[path.length - 1] == '/') { throw "Bad: don't DELETE folders"; }
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodes = transaction.objectStore('nodes');
      nodes.remove(path).onsuccess = function() {
        removeFromParent(nodes, path, 'body');
      };
      transaction.oncomplete = function() {
        promise.fulfill(200);
      };
      return promise;
    },

    setRevision: function(path, revision) {
      return this.setRevisions([[path, revision]]);
    },

    setRevisions: function(revs) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      revs.forEach(function(rev) {
        console.log('set rev', rev);
        var nodes = transaction.objectStore('nodes');
        nodes.get(rev[0]).onsuccess = function(event) {
          var node = event.target.result || makeNode(rev[0]);
          node.revision = rev[1];
          console.log('putting', node);
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
        console.log('getCached', path, '->', node.cached);
        promise.fulfill(200, node.cached, node.contentType, node.revision);
      };
      return promise;
    },

    reset: function(callback) {
      var dbName = this.db.name;
      this.db.close();
      var self = this;
      RemoteStorage.IndexedDB.clean(this.db.name, function() {
        RemoteStorage.IndexedDB.open(dbName, function(other) {
          // hacky!
          self.db = other.db;
          callback(self);
        });
      });
    }

  };

  var DB_VERSION = 1;
  RemoteStorage.IndexedDB.open = function(name, callback) {
    var dbOpen = indexedDB.open(name, DB_VERSION);
    dbOpen.onerror = function() {
      console.error("Opening db failed: ", dbOpen.errorCode);
    };
    dbOpen.onupgradeneeded = function() {
      var db = dbOpen.result;
      db.createObjectStore('nodes', { keyPath: 'path' });
    }
    dbOpen.onsuccess = function() {
      callback(new RemoteStorage.IndexedDB(dbOpen.result));
    };
  };

  RemoteStorage.IndexedDB.clean = function(databaseName, callback) {
    var req = indexedDB.deleteDatabase(databaseName);
    req.onsuccess = function() {
      console.log('done removing db');
      callback();
    };
    req.onerror = function(evt) {
      console.error('failed to remove database "' + databaseName + '"', evt);
    };
  };

})();