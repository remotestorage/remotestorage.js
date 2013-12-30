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
   *       In addition it also takes a 'incoming' flag, which indicates that the
   *       change is not fresh, but synchronized from remote.
   *     - #delete() takes a path and also returns a promise. It also supports
   *       the 'incoming' flag described for #put().
   *     - #on('change', ...) events, being fired whenever something changes in
   *       the storage. Change events roughly follow the StorageEvent pattern.
   *       They have "oldValue" and "newValue" properties, which can be used to
   *       distinguish create/update/delete operations and analyze changes in
   *       change handlers. In addition they carry a "origin" property, which
   *       is either "window", "local", or "remote". "remote" events are fired
   *       whenever the "incoming" flag is passed to #put() or #delete(). This
   *       is usually done by RemoteStorage.Sync.
   *
   *   The revision interface (also on RemoteStorage.IndexedDB object):
   *     - #_setRevision(path, revision) sets the current revision for the given
   *       path. Revisions are only generated by the remotestorage server, so
   *       this is usually done from #put on an incoming change or from
   *       #putDirectory.
   *     - #_setRevisions(revisions) takes path/revision pairs in the form:
   *       [[path1, rev1], [path2, rev2], ...] and updates all revisions in a
   *       single transaction.
   *     - #getRevision(path) returns the currently stored revision for the given
   *       path.
   *
   *   The changes interface (also on RemoteStorage.IndexedDB object):
   *     - Used to record local changes between sync cycles.
   *     - Changes are stored in a separate ObjectStore called "changes".
   *     - #_recordChange() records a change and is called by #put() and #delete(),
   *       given the "incoming" flag evaluates to false. It is private and should
   *       never be used from the outside.
   *     - #changesBelow() takes a path and returns a promise that will be fulfilled
   *       with an Array of changes that are pending for the given path or below.
   *       This is usually done in a sync cycle to push out pending changes.
   *     - #clearChange removes the change for a given path. This is usually done
   *       RemoteStorage.Sync once a change has successfully been pushed out.
   *     - #setConflict sets conflict attributes on a change. It also fires the
   *       "conflict" event.
   *     - #on('conflict', ...) event. Conflict events usually have the following
   *       attributes: path, localAction and remoteAction. Both actions are either
   *       "PUT" or "DELETE". They also bring a "resolve" method, which can be
   *       called with either of the strings "remote" and "local" to mark the
   *       conflict as resolved. The actual resolution will usually take place in
   *       the next sync cycle.
   */

  var RS = RemoteStorage;

  var DEFAULT_DB_NAME = 'remotestorage';
  var DEFAULT_DB;

  function getBody(bodyStore, path, cb) {
    bodyStore.get(path).onsuccess = function(evt) {
      var node = evt.target.result;
      if(node) {
        cb(node.body);
      } else {
        cb();
      }
    };
  }

  function setBody(bodyStore, path, body, cb) {
    if(cb) {
      bodyStore.get(path).onsuccess = function(evt) {
        var oldBody;
        if(evt.target.result) {
          oldBody = evt.target.result.body;
        }
        setBody(bodyStore, path, body);
        cb(oldBody);
      };
    } else {
      bodyStore.put({
        path: path,
        body: body
      });
    }
  }

  function getMetas(metaStore, path, cb) {
    metaStore.get(path).onsuccess = function(evt) {
      var node = evt.target.result;
      if(node) {
        cb(node.items);
      } else {
        cb({});
      }
    };
  }

  function setMetas(metaStore, path, items) {
    metaStore.put({
      path: path,
      items: items
    });
  }
    
  function addToParent(metaStore, pathObj, revision, contentType, contentLength, cb) {
    getMetas(metaStore, pathObj.containingFolder, function(items) {
      var oldRevision, parentPathObj = parsePath(pathObj.containingFolder);
      //creating this folder's path up to the root:
      if(!parentPathObj.isRoot ) {
        addToParent(metaStore, parentPathObj, true);
      }
      if(items[pathObj.itemName]) {
        oldRevision = items[pathObj.itemName].ETag;
      } else {
         items[pathObj.itemName] = {};
      }
      items[pathObj.itemName].ETag = (revision || true);
      setMetas(metaStore, pathObj.containingFolder, items);
      if(cb) {
        cb(oldRevision);
      }
    });
  }

  RS.IndexedDB = function(database) {
    this.db = database || DEFAULT_DB;
    if (! this.db) {
      RemoteStorage.log("Failed to open indexedDB");
      return undefined;
    }
    RS.cachingLayer(this);
    RS.eventHandling(this, 'change', 'conflict');
  };
  
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
    return ret;
  }

  function deleteMeta(metaStore, pathObj, cb) {
    if(pathObj.isRoot) {
      cb();
      return;
    }
    getMetas(metaStore, pathObj.containingFolder, function(items) {
      if(items[pathObj.itemName]) {
        oldRevision = items[pathObj.itemName].ETag;
        delete items[pathObj.itemName];
        if(items.length) {
          setMetas(metaStore, pathObj.containingFolder, items);
          cb(oldRevision);
        } else {
          deleteMeta(metaStore, parsePath(pathObj.containingFolder), function() {
            cb(oldRevision);
          });
        }
      }
    });
  }

  RS.IndexedDB.prototype = {

    get: function(path) {
      var pathObj = parsePath(path);
      var storesNeeded = (pathObj.isFolder ? 'meta' : ['meta', 'bodies']);
      var promise = promising();
      var transaction = this.db.transaction(storesNeeded, 'readonly');
      var metaStore = transaction.objectStore('meta'),
         parentReq, metaData, itemReq, item;
      if(pathObj.isFolder) {
        getMetas(metaStore, path, function(items) {
          item = items;
        });
      } else {
        getBody(transaction.objectStore('bodies'), path, function(body) {
          item = body;
        });
      }
      getMetas(metaStore, pathObj.containingFolder, function(items) {
          metaData = items[pathObj.itemName];
      });
      transaction.oncomplete = function() {
        if (metaData && item) {
          promise.fulfill(200, item, metaData['Content-Type'], metaData['ETag']);
        } else {
          promise.fulfill(404);
        }
      };

      transaction.onerror = transaction.onabort = function(err) {
        promise.reject('error while getting '+path+' '+err);
      };
      return promise;
    },

    put: function(path, body, contentType, incoming, revision) {
      var pathObj = parsePath(path),
        promise = promising(),
        transaction = this.db.transaction(['meta', 'bodies'], 'readwrite'),
        oldBody, oldRevision, done;
      if (pathObj.isFolder) {
        throw "Bad: don't PUT folders";
      }
      try {
        addToParent(transaction.objectStore('meta'), pathObj, revision, contentType, body.length, function(setOldRevision) {
          oldRevision = setOldRevision;
        });
        setBody(transaction.objectStore('bodies'), path, body, function(setOldBody) {
          oldBody = setOldBody;
        });
      } catch(e) {
        if (typeof(done) === 'undefined') {
          done = true;
          promise.reject(e);
        }
      }

      transaction.oncomplete = function() {
        //TODO: emit change event with origin 'device' to other tabs & windows of the same browser
        this._emit('change', {
          path: path,
          origin: incoming ? 'remote' : 'window',
          oldValue: oldBody,
          newValue: body
        });
        if (!incoming) {
          this._recordChange(path, { action: 'PUT', revision: oldRevision });
        }
        if (typeof(done) === 'undefined') {
          done = true;
          promise.fulfill(200);
        }
      }.bind(this);

      transaction.onerror = transaction.onabort = promise.reject;

      return promise;
    },

    putDirectory: function(path, items, revision) {
      var promise = promising(),
        transaction = this.db.transaction(['meta'], 'readwrite'),
        metaStore = transaction.objectStore('meta');
      
      setMetas(metaStore, path, items);
      addToParent(metaStore, parsePath(path), revision);

      transaction.oncomplete = function() {
        promise.fulfill();
      };

      transaction.onerror = transaction.onabort = promise.reject;

      return promise;
    },

    delete: function(path, incoming) {
      var pathObj = parsePath(path), oldBody, oldRevision;
      if (pathObj.isRoot) {
        throw "Bad: don't DELETE root";
      }
      var transaction = this.db.transaction(['meta', 'bodies'], 'readwrite'),
        promise = promising(),
        oldBody, bodies;
      deleteMeta(transaction.objectStore('meta'), pathObj, function(setOldRevision) {
        oldRevision = setOldRevision;
        getBody(transaction.objectStore('bodies'), path, function(setOldBody) {
          oldBody = setOldBody;
          bodies.delete(path);
        });
      });
      
      transaction.oncomplete = function() {
        if (oldBody) {
          //TODO: emit change event with origin 'device' to other tabs & windows of the same browser
          this._emit('change', {
            path: path,
            origin: incoming ? 'remote' : 'window',
            oldValue: oldBody,
            newValue: undefined
          });
        }
        if (! incoming) {
          this._recordChange(path, { action: 'DELETE', revision: oldRevision });
        }
        promise.fulfill(200);
      }.bind(this);

      transaction.onerror = transaction.onabort = promise.reject;
      return promise;
    },

    setRevision: function(path, revision) {
      var pathObj = parsePath(path),
        transaction = this.db.transaction(['meta'], 'readwrite'),
        promise = promising();
      this._addToParent(transaction.objectStore('meta'), pathObj, revision);

      transaction.oncomplete = function() {
        promise.fulfill();
      };

      transaction.onerror = transaction.onabort = promise.reject;
      return promise;
    },

    getRevision: function(path) {
      var promise = promising(),
        pathObj = parsePath(path),
        transaction = this.db.transaction(['meta'], 'readonly')
        promise = promising();
      getMetas(transaction.objectStore('meta'), pathObj.containingDir, function(items) {
        if(items[pathObj.itemName]) {
          rev =  items[pathObj.itemName].ETag;
        }
      });

      transaction.oncomplete = function() {
        promise.fulfill(rev);
      };

      transaction.onerror = transaction.onabort = promise.reject;
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

    fireInitial: function() {
      var transaction = this.db.transaction(['bodies'], 'readonly');
      var cursorReq = transaction.objectStore('bodies').openCursor();
      cursorReq.onsuccess = function(evt) {
        var cursor = evt.target.result;
        if (cursor) {
          this._emit('change', {
            path: cursor.value.path,
            origin: 'local',
            oldValue: undefined,
            newValue: cursor.value.body
          });
          cursor.continue();
        }
      }.bind(this);
    },

    _recordChange: function(path, attributes) {
      var promise = promising();
      var transaction = this.db.transaction(['changes'], 'readwrite');
      var changes = transaction.objectStore('changes');
      var change;

      changes.get(path).onsuccess = function(evt) {
        change = evt.target.result || {};
        change.path = path;
        for (var key in attributes) {
          change[key] = attributes[key];
        }
        changes.put(change);
      };

      transaction.oncomplete = promise.fulfill;
      transaction.onerror = transaction.onabort = promise.reject;
      return promise;
    },

    clearChange: function(path) {
      var promise = promising();
      var transaction = this.db.transaction(['changes'], 'readwrite');
      var changes = transaction.objectStore('changes');
      changes.delete(path);

      transaction.oncomplete = function() {
        promise.fulfill();
      };

      return promise;
    },

    changesBelow: function(path) {
      var promise = promising();
      var transaction = this.db.transaction(['changes'], 'readonly');
      var cursorReq = transaction.objectStore('changes').
        openCursor(IDBKeyRange.lowerBound(path));
      var pl = path.length;
      var changes = [];

      cursorReq.onsuccess = function(evt) {
        var cursor = evt.target.result;
        if (cursor) {
          if (cursor.key.substr(0, pl) === path) {
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
      var event = this._createConflictEvent(path, attributes);
      this._recordChange(path, { conflict: attributes }).
        then(function() {
          // fire conflict once conflict has been recorded.
          if (this._handlers.conflict.length > 0) {
            this._emit('conflict', event);
          } else {
            setTimeout(function() { event.resolve('remote'); }, 0);
          }
        }.bind(this));
    },

    closeDB: function() {
      this.db.close();
    }

  };

  var DB_VERSION = 3;

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
      RemoteStorage.log("[IndexedDB] Creating object store: nodes");
      db.createObjectStore('meta', { keyPath: 'path' });
      RemoteStorage.log("[IndexedDB] Creating object store: nodes");
      db.createObjectStore('bodies', { keyPath: 'path' });
      if(event.oldVersion != 2) {
        RemoteStorage.log("[IndexedDB] Creating object store: changes");
        db.createObjectStore('changes', { keyPath: 'path' });
      }
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
