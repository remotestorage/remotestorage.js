(function (global) {

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
   *       whenever a change comes in from RemoteStorage.Sync.
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

  RS.IndexedDB = function (database) {
    this.db = database || DEFAULT_DB;

    if (!this.db) {
      RemoteStorage.log("[IndexedDB] Failed to open DB");
      return undefined;
    }

    RS.cachingLayer(this);
    RS.eventHandling(this, 'change', 'local-events-done');

    this.getsRunning = 0;
    this.putsRunning = 0;

    /**
     * Property: changesQueued
     *
     * Given a node for which uncommitted changes exist, this cache
     * stores either the entire uncommitted node, or false for a deletion.
     * The node's path is used as the key.
     *
     * changesQueued stores changes for which no IndexedDB transaction has
     * been started yet.
     */
    this.changesQueued = {};

    /**
     * Property: changesRunning
     *
     * Given a node for which uncommitted changes exist, this cache
     * stores either the entire uncommitted node, or false for a deletion.
     * The node's path is used as the key.
     *
     * At any time there is at most one IndexedDB transaction running.
     * changesRunning stores the changes that are included in that currently
     * running IndexedDB transaction, or if none is running, of the last one
     * that ran.
     */
    this.changesRunning = {};
  };

  RS.IndexedDB.prototype = {
    getNodes: function (paths) {
      var misses = [], fromCache = {};
      for (var i = 0, len = paths.length; i < len; i++) {
        if (this.changesQueued[paths[i]] !== undefined) {
          fromCache[paths[i]] = RemoteStorage.util.deepClone(this.changesQueued[paths[i]] || undefined);
        } else if(this.changesRunning[paths[i]] !== undefined) {
          fromCache[paths[i]] = RemoteStorage.util.deepClone(this.changesRunning[paths[i]] || undefined);
        } else {
          misses.push(paths[i]);
        }
      }
      if (misses.length > 0) {
        return this.getNodesFromDb(misses).then(function (nodes) {
          for (var i in fromCache) {
            nodes[i] = fromCache[i];
          }
          return nodes;
        });
      } else {
        return Promise.resolve(fromCache);
      }
    },

    setNodes: function (nodes) {
      for (var i in nodes) {
        this.changesQueued[i] = nodes[i] || false;
      }
      this.maybeFlush();
      return Promise.resolve();
    },

    maybeFlush: function () {
      if (this.putsRunning === 0) {
        this.flushChangesQueued();
      } else {
        if (!this.commitSlownessWarning) {
          this.commitSlownessWarning = setInterval(function () {
            console.log('WARNING: waited more than 10 seconds for previous commit to finish');
          }, 10000);
        }
      }
    },

    flushChangesQueued: function () {
      if (this.commitSlownessWarning) {
        clearInterval(this.commitSlownessWarning);
        this.commitSlownessWarning = null;
      }
      if (Object.keys(this.changesQueued).length > 0) {
        this.changesRunning = this.changesQueued;
        this.changesQueued = {};
        this.setNodesInDb(this.changesRunning).then(this.flushChangesQueued.bind(this));
      }
    },

    getNodesFromDb: function (paths) {
      return new Promise(function(resolve, reject) {
        var transaction = this.db.transaction(['nodes'], 'readonly');
        var nodes = transaction.objectStore('nodes');
        var retrievedNodes = {};
        var startTime = new Date().getTime();

        this.getsRunning++;

        paths.map(function (path, i) {
          nodes.get(path).onsuccess = function (evt) {
            retrievedNodes[path] = evt.target.result;
          };
        });

        transaction.oncomplete = function () {
          resolve(retrievedNodes);
          this.getsRunning--;
        }.bind(this);

        transaction.onerror = transaction.onabort = function () {
          reject('get transaction error/abort');
          this.getsRunning--;
        }.bind(this);
      }.bind(this));
    },

    setNodesInDb: function (nodes) {
      return new Promise(function(resolve, reject) {
        var transaction = this.db.transaction(['nodes'], 'readwrite');
        var nodesStore = transaction.objectStore('nodes');
        var startTime = new Date().getTime();

        this.putsRunning++;

        RemoteStorage.log('[IndexedDB] Starting put', nodes, this.putsRunning);

        for (var path in nodes) {
          var node = nodes[path];
          if(typeof(node) === 'object') {
            try {
              nodesStore.put(node);
            } catch(e) {
              RemoteStorage.log('[IndexedDB] Error while putting', node, e);
              throw e;
            }
          } else {
            try {
              nodesStore.delete(path);
            } catch(e) {
              RemoteStorage.log('[IndexedDB] Error while removing', nodesStore, node, e);
              throw e;
            }
          }
        }

        transaction.oncomplete = function () {
          this.putsRunning--;
          RemoteStorage.log('[IndexedDB] Finished put', nodes, this.putsRunning, (new Date().getTime() - startTime)+'ms');
          resolve();
        }.bind(this);

        transaction.onerror = function () {
          this.putsRunning--;
          reject('transaction error');
        }.bind(this);

        transaction.onabort = function () {
          reject('transaction abort');
          this.putsRunning--;
        }.bind(this);
      }.bind(this));
    },

    reset: function (callback) {
      var dbName = this.db.name;
      var self = this;

      this.db.close();

      RS.IndexedDB.clean(this.db.name, function() {
        RS.IndexedDB.open(dbName, function (err, other) {
          if (err) {
            RemoteStorage.log('[IndexedDB] Error while resetting local storage', err);
          } else {
            // hacky!
            self.db = other;
          }
          if (typeof callback === 'function') { callback(self); }
        });
      });
    },

    forAllNodes: function (cb) {
      return new Promise(function(resolve) {
        var transaction = this.db.transaction(['nodes'], 'readonly');
        var cursorReq = transaction.objectStore('nodes').openCursor();

        cursorReq.onsuccess = function (evt) {
          var cursor = evt.target.result;

          if (cursor) {
            cb(this.migrate(cursor.value));
            cursor.continue();
          } else {
            resolve();
          }
        }.bind(this);
      }.bind(this));
    },

    closeDB: function () {
      this.db.close();
    }

  };

  RS.IndexedDB.open = function (name, callback) {
    var timer = setTimeout(function () {
      callback("timeout trying to open db");
    }, 10000);

    try {
      var req = indexedDB.open(name, DB_VERSION);

      req.onerror = function () {
        RemoteStorage.log('[IndexedDB] Opening DB failed', req);

        clearTimeout(timer);
        callback(req.error);
      };

      req.onupgradeneeded = function (event) {
        var db = req.result;

        RemoteStorage.log("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);

        if (event.oldVersion !== 1) {
          RemoteStorage.log("[IndexedDB] Creating object store: nodes");
          db.createObjectStore('nodes', { keyPath: 'path' });
        }

        RemoteStorage.log("[IndexedDB] Creating object store: changes");

        db.createObjectStore('changes', { keyPath: 'path' });
      };

      req.onsuccess = function () {
        clearTimeout(timer);

        // check if all object stores exist
        var db = req.result;
        if(!db.objectStoreNames.contains('nodes') || !db.objectStoreNames.contains('changes')) {
          RemoteStorage.log("[IndexedDB] Missing object store. Resetting the database.");
          RS.IndexedDB.clean(name, function() {
            RS.IndexedDB.open(name, callback);
          });
          return;
        }

        callback(null, req.result);
      };
    } catch(error) {
      RemoteStorage.log("[IndexedDB] Failed to open database: " + error);
      RemoteStorage.log("[IndexedDB] Resetting database and trying again.");

      clearTimeout(timer);

      RS.IndexedDB.clean(name, function() {
        RS.IndexedDB.open(name, callback);
      });
    };
  };

  RS.IndexedDB.clean = function (databaseName, callback) {
    var req = indexedDB.deleteDatabase(databaseName);

    req.onsuccess = function () {
      RemoteStorage.log('[IndexedDB] Done removing DB');
      callback();
    };

    req.onerror = req.onabort = function (evt) {
      console.error('Failed to remove database "' + databaseName + '"', evt);
    };
  };

  RS.IndexedDB._rs_init = function (remoteStorage) {
    return new Promise(function(resolve, reject) {
      RS.IndexedDB.open(DEFAULT_DB_NAME, function (err, db) {
        if (err) {
          reject(err);
        } else {
          DEFAULT_DB = db;
          db.onerror = function () { remoteStorage._emit('error', err); };
          resolve();
        }
      });
    });
  };

  RS.IndexedDB._rs_supported = function () {
    global.indexedDB = global.indexedDB    || global.webkitIndexedDB ||
                       global.mozIndexedDB || global.oIndexedDB      ||
                       global.msIndexedDB;

    // Detect browsers with known IndexedDb issues (e.g. Android pre-4.4)
    var poorIndexedDbSupport = false;
    if (typeof global.navigator !== 'undefined' &&
        global.navigator.userAgent.match(/Android (2|3|4\.[0-3])/)) {
      // Chrome and Firefox support IndexedDB
      if (!navigator.userAgent.match(/Chrome|Firefox/)) {
        poorIndexedDbSupport = true;
      }
    }

    return new Promise(function(resolve, reject) {
      if ('indexedDB' in global && !poorIndexedDbSupport) {
        try {
          var check = indexedDB.open("rs-check");
          check.onerror = function (event) {
            reject();
          };
          check.onsuccess = function (event) {
            check.result.close();
            indexedDB.deleteDatabase("rs-check");
            resolve();
          };
        } catch(e) {
          reject();
        }
      } else {
        reject();
      }
    });
  };

  RS.IndexedDB._rs_cleanup = function (remoteStorage) {
    return new Promise(function(resolve) {
      if (remoteStorage.local) {
        remoteStorage.local.closeDB();
      }

      RS.IndexedDB.clean(DEFAULT_DB_NAME, function () {
        resolve();
      });
    });
  };

})(typeof(window) !== 'undefined' ? window : global);
