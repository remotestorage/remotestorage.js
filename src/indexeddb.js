(function(global) {

  /**
   * Class: RemoteStorage.IndexedDB
   *
   *
   * IndexedDB Interface
   * -------------------
   *
   * This file exposes a get/put/delete interface, accessing data in an indexedDB.
   *
   * There are multiple parts to this interface:
   *
   *   The RemoteStorage integration:
   *     - RemoteStorage.IndexedDB._rs_supported() determines if indexedDB support
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

  var DEFAULT_DB_NAME = 'remotestorage';
  var DEFAULT_DB;

  RS.IndexedDB = function(database) {
    this.db = database || DEFAULT_DB;
    if (! this.db) {
      RemoteStorage.log("Failed to open indexedDB");
      return undefined;
    }
    RS.cachingLayer(this);
    RS.eventHandling(this, 'change');
    this.getsRunning = 0;
    this.putsRunning = 0;
  };

  RS.IndexedDB.prototype = {
    getNodes: function(paths) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var nodes = transaction.objectStore('nodes');
      var ret = {}, i, nodeReq, startTime = new Date().getTime();
      this.getsRunning++;
//      RemoteStorage.log('starting get', paths, this.getsRunning);
      for (i=0; i<paths.length; i++) {
        (function(captureI) {
          nodes.get(paths[captureI]).onsuccess = function(evt) {
            ret[paths[captureI]] = evt.target.result;
          };
        })(i);
      }
      
      transaction.oncomplete = function() {
        promise.fulfill(ret);
        this.getsRunning--;
//        RemoteStorage.log('finished get', paths, this.getsRunning, (new Date().getTime() - startTime)+'ms');
      }.bind(this);

      transaction.onerror = transaction.onabort = function() {
        promise.reject('get transaction error/abort');
        this.getsRunning--;
      }.bind(this);
      
      return promise;
    },

    setNodes: function(objs) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodes = transaction.objectStore('nodes');
      var i, nodeReq, startTime = new Date().getTime();
      this.putsRunning++;
      RemoteStorage.log('starting put', objs, this.putsRunning);
      for (i in objs) {
        if(typeof(objs[i]) === 'object') {
          try {
            nodes.put(objs[i]);
          } catch(e) {
            RemoteStorage.log('error while putting', objs[i], e);
            throw e;
          }
        } else {
          try {
            nodes.delete(i);
          } catch(e) {
            RemoteStorage.log('error while removing', nodes, objs[i], e);
            throw e;
          }
        }
      }
      
      transaction.oncomplete = function() {
        promise.fulfill();
        this.putsRunning--;
        RemoteStorage.log('finished put', objs, this.putsRunning, (new Date().getTime() - startTime)+'ms');
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

  var DB_VERSION = 2;

  RS.IndexedDB.open = function(name, callback) {
    var timer = setTimeout(function() {
      callback("timeout trying to open db");
    }, 3500);

    var dbOpen = indexedDB.open(name, DB_VERSION);

    dbOpen.onerror = function() {
      RemoteStorage.log('opening db failed', dbOpen);
      clearTimeout(timer);
      callback(dbOpen.error);
    };

    dbOpen.onupgradeneeded = function(event) {
      RemoteStorage.log("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);
      var db = dbOpen.result;
      if (event.oldVersion !== 1) {
        RemoteStorage.log("[IndexedDB] Creating object store: nodes");
        db.createObjectStore('nodes', { keyPath: 'path' });
      }
      RemoteStorage.log("[IndexedDB] Creating object store: changes");
      db.createObjectStore('changes', { keyPath: 'path' });
    };

    dbOpen.onsuccess = function() {
      clearTimeout(timer);
      callback(null, dbOpen.result);
    };
  };

  RS.IndexedDB.clean = function(databaseName, callback) {
    var req = indexedDB.deleteDatabase(databaseName);
    req.onsuccess = function() {
      RemoteStorage.log('done removing db');
      callback();
    };
    req.onerror = req.onabort = function(evt) {
      console.error('failed to remove database "' + databaseName + '"', evt);
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
    return 'indexedDB' in global;
  };

  RS.IndexedDB._rs_cleanup = function(remoteStorage) {
    if (remoteStorage.local) {
      remoteStorage.local.closeDB();
    }
    var promise = promising();
    RS.IndexedDB.clean(DEFAULT_DB_NAME, function() {
      promise.fulfill();
    });
    return promise;
  };

})(typeof(window) !== 'undefined' ? window : global);
