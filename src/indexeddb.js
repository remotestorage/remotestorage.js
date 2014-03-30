(function(global) {

  /**
   * Class: RemoteStorage.IndexedDB
   *
   *
   * IndexedDB Interface
   * -------------------
   *
   * TODO rewrite, doesn't expose GPD anymore, it's in cachinglayer now
   *
   * This file exposes a get/put/delete interface, accessing data in an IndexedDB.
   *
   * There are multiple parts to this interface:
   *
   *   The RemoteStorage integration:
   *     - RemoteStorage.IndexedDB._rs_supported() determines if IndexedDB support
   *       is available. If it isn't, RemoteStorage won't initialize the feature.
   *     - RemoteStorage.IndexedDB._rs_init() initializes the feature. It returns
   *       a promise that is fulfilled as soon as the database has been opened and
   *       migrated.
   *
   *   The storage interface (RemoteStorage.IndexedDB object):
   *     - Usually this is accessible via "remoteStorage.local"
   *     - #get() takes a path and returns a promise.
   *     - #put() takes a path, body and contentType and also returns a promise.
   *     - #delete() takes a path and also returns a promise.
   *     - #on('change', ...) events, being fired whenever something changes in
   *       the storage. Change events roughly follow the StorageEvent pattern.
   *       They have "oldValue" and "newValue" properties, which can be used to
   *       distinguish create/update/delete operations and analyze changes in
   *       change handlers. In addition they carry a "origin" property, which
   *       is either "window", "local", or "remote". "remote" events are fired
   *       whenever a change comes in from RemoteStorage.Sync. In the future,
   *       "device" origin events will also be fired for changes happening in
   *       other windows on the same device.
   *
   *   The sync interface (also on RemoteStorage.IndexedDB object):
   *     - #getNodes([paths]) returns the requested nodes in a promise.
   *     - #setNodes(map) stores all the nodes given in the (path -> node) map.
   *
   */

  var RS = RemoteStorage;

  var DB_VERSION = 2;

  var DEFAULT_DB_NAME = 'remotestorage';
  var DEFAULT_DB;

  RS.IndexedDB = function(database) {
    this.db = database || DEFAULT_DB;

    if (!this.db) {
      RemoteStorage.log("Failed to open indexedDB");
      return undefined;
    }

    RS.cachingLayer(this);
    RS.eventHandling(this, 'change');

    this.getsRunning = 0;
    this.putsRunning = 0;
    //both these caches store path -> the uncommitted node, or false for a deletion:
    this.commitCache = {};
    this.flushing = {};
  };

  RS.IndexedDB.prototype = {
    getNodes: function(paths) {
      var i ,misses = [], fromCache = {};
      for (i=0; i<paths.length; i++) {
        if(this.commitCache[path[i]] !== undefined) {
          fromCache[paths[i]] = this._deepClone(this.commitCache[paths[i]] || undefined);
        } else if(this.flushing[path[i]] !== undefined) {
           fromCache[paths[i]] = this._deepClone(this.flushing[paths[i]] || undefined);
        } else {
          misses.push(paths[i]);
        }
      }
      if (misses.length > 0) {
        return this.getNodesFromDb(misses).then(function(nodes) {
          for (i in fromCache) {
            nodes[i] = fromCache[i];
          }
          return nodes;
        });
      } else {
        promise = Promising();
        promise.fulfill(results);
        return promise;
      }
    },
    setNodes: function(nodes) {
      for(var i in nodes) {
        this.commitCache[i] = nodes[i] || false;
      }
      this.maybeFlush();
    },
    maybeFlush: function() {
      if (this.putsRunning === 0) {
        this.flushCommitCache();
      }
    },
    flushCommitCache: function() {
      if (Object.keys(this.commitCache).length > 0) {
        this.flushing = this.commitCache;
        this.commitCache = {};
        this.setNodesToDb(this.flushing).then(this.flushCommitCache.bind(this));
      }
    },
    getNodesFromDb: function(paths) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var nodes = transaction.objectStore('nodes');
      var retrievedNodes = {};
      var startTime = new Date().getTime();

      this.getsRunning++;

      for (var i=0; i<paths.length; i++) {
        (function(index) {
          var path = paths[index];
          nodes.get(path).onsuccess = function(evt) {
            retrievedNodes[path] = evt.target.result;
          };
        })(i);
      }

      transaction.oncomplete = function() {
        promise.fulfill(retrievedNodes);
        this.getsRunning--;
      }.bind(this);

      transaction.onerror = transaction.onabort = function() {
        promise.reject('get transaction error/abort');
        this.getsRunning--;
      }.bind(this);

      return promise;
    },

    setNodesToDb: function(nodes) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodesStore = transaction.objectStore('nodes');
      var startTime = new Date().getTime();

      this.putsRunning++;

      RemoteStorage.log('Starting put', nodes, this.putsRunning);

      for (var path in nodes) {
        var node = nodes[path];
        if(typeof(node) === 'object') {
          try {
            nodesStore.put(node);
          } catch(e) {
            RemoteStorage.log('Error while putting', node, e);
            throw e;
          }
        } else {
          try {
            nodesStore.delete(path);
          } catch(e) {
            RemoteStorage.log('Error while removing', nodesStore, node, e);
            throw e;
          }
        }
      }

      transaction.oncomplete = function() {
        promise.fulfill();
        this.putsRunning--;
        RemoteStorage.log('Finished put', nodes, this.putsRunning, (new Date().getTime() - startTime)+'ms');
      }.bind(this);

      transaction.onerror = function() {
        promise.reject('transaction error');
        this.putsRunning--;
      }.bind(this);

      transaction.onabort = function() {
        promise.reject('transaction abort');
        this.putsRunning--;
      }.bind(this);

      return promise;
    },

    reset: function(callback) {
      var dbName = this.db.name;
      var self = this;

      this.db.close();

      RS.IndexedDB.clean(this.db.name, function() {
        RS.IndexedDB.open(dbName, function(other) {
          // hacky!
          self.db = other.db;
          callback(self);
        });
      });
    },

    forAllNodes: function(cb) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var cursorReq = transaction.objectStore('nodes').openCursor();

      cursorReq.onsuccess = function(evt) {
        var cursor = evt.target.result;

        if (cursor) {
          cb(this.migrate(cursor.value));
          cursor.continue();
        } else {
          promise.fulfill();
        }
      }.bind(this);

      return promise;
    },

    closeDB: function() {
      this.db.close();
    }

  };

  RS.IndexedDB.open = function(name, callback) {
    var timer = setTimeout(function() {
      callback("timeout trying to open db");
    }, 10000);

    var req = indexedDB.open(name, DB_VERSION);

    req.onerror = function() {
      RemoteStorage.log('Opening DB failed', req);

      clearTimeout(timer);
      callback(req.error);
    };

    req.onupgradeneeded = function(event) {
      var db = req.result;

      RemoteStorage.log("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);

      if (event.oldVersion !== 1) {
        RemoteStorage.log("[IndexedDB] Creating object store: nodes");
        db.createObjectStore('nodes', { keyPath: 'path' });
      }

      RemoteStorage.log("[IndexedDB] Creating object store: changes");

      db.createObjectStore('changes', { keyPath: 'path' });
    };

    req.onsuccess = function() {
      clearTimeout(timer);
      callback(null, req.result);
    };
  };

  RS.IndexedDB.clean = function(databaseName, callback) {
    var req = indexedDB.deleteDatabase(databaseName);

    req.onsuccess = function() {
      RemoteStorage.log('Done removing DB');
      callback();
    };

    req.onerror = req.onabort = function(evt) {
      console.error('Failed to remove database "' + databaseName + '"', evt);
    };
  };

  RS.IndexedDB._rs_init = function(remoteStorage) {
    var promise = promising();

    RS.IndexedDB.open(DEFAULT_DB_NAME, function(err, db) {
      if (err) {
        promise.reject(err);
      } else {
        DEFAULT_DB = db;
        db.onerror = function() { remoteStorage._emit('error', err); };
        promise.fulfill();
      }
    });

    return promise;
  };

  RS.IndexedDB._rs_supported = function() {
    return ('indexedDB' in global);
  };

  RS.IndexedDB._rs_cleanup = function(remoteStorage) {
    var promise = promising();

    if (remoteStorage.local) {
      remoteStorage.local.closeDB();
    }

    RS.IndexedDB.clean(DEFAULT_DB_NAME, function() {
      promise.fulfill();
    });

    return promise;
  };

})(typeof(window) !== 'undefined' ? window : global);
