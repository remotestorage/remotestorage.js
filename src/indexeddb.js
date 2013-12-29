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

  function makeNode(path) {
    var node = { path: path };
    if (path[path.length - 1] === '/') {
      node.body = {};
      node.cached = {};
      node.contentType = 'application/json';
    }
    return node;
  }

  function addToParent(metaStore, path, revision) {
    //FIXME: this function overlaps with createMeta
    var pathObj = parsePath(path);
    metaStore.get(pathObj.containingDir).onsuccess = function(evt) {
        var node = evt.target.result || makeNode(dirname);
        node[itemName].ETag = revision || true;
        metaStore.put(node).onsuccess = function() {
          if (dirname !== '/') {
            addToParent(nodes, dirname, key, true);
          }
        };
      };
    }
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
    console.log('parsePath', path, parts, ret);
    return ret;
  }

  function deleteMeta(transaction, pathObj, incoming, cb) {
    //FIXME: we should also have a rootParent in which we can store the revision of root
    if(pathObj.isRoot) {
      cb();
      return;
    }
    var meta = transaction.objectStore('meta');
    meta.get(pathObj.containingFolder).onsuccess = function(evt) {
      var parentMeta = evt.target.result;
      if(parentMeta.items[pathObj.itemName]) {
        oldRevision = parentMeta.items[pathObj.itemName].ETag;
        delete parentMeta.items[pathObj.itemName];
        if(parentMeta.items.length) {
          meta.put(parentMeta);
          cb(oldRevision);
        } else {
          deleteMeta(transaction, parsePath(pathObj.containingFolder), incoming, function() {
            cb(oldRevision);
          });
        };
      }
    };
  }
  
  function createMeta(metaStore, path, revision) {
    var pathObj = parsePath(path);
    if(!pathObj.isRoot) {
      metaStore.get(pathObj.containingFolder).onsuccess = function(evt) {
        if(!evt.result) {
          createMeta(metaStore, pathObj.containingFolder);
        }
      };
    }
    var items = {};
    items[pathObj.itemName] = (revision ? {ETag: revision} : {});
    metaStore.put({
      path: pathObj.containingFolder,
      items: items
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
        itemReq = metaStore.get(path);
        itemReq.onsuccess = function(evt) {
          if(itemReq.result) {
            item = itemReq.result.items;
          }
        };
      } else {
        itemReq = transaction.objectStore('bodies')
            .get(path);
        itemReq.onsuccess = function(evt) {
          console.log('bodies get success', evt);
          if(itemReq.result) {
            item = itemReq.result.value;
          }
        };
      }
      console.log('getting containingFolder', pathObj);
      parentReq = metaStore.get(pathObj.containingFolder);

      parentReq.onsuccess = function(evt) {
        console.log('parentReq success', evt);
        if(parentReq.result) {
          metaData = parentReq.result[pathObj.itemName];
        }
      };
      itemReq.onerror = function(evt) {
        console.log('itemReq error', evt);
      };
      parentReq.onerror = function(evt) {
        console.log('parentReq error', evt);
      };
      transaction.oncomplete = function() {
        if (metaData && item) {
          console.log('fulfulling as success', item, metaData);
          promise.fulfill(200, item, metaData['Content-Type'], metaData['ETag']);
        } else {
          console.log('fulfulling as not found', item, metaData);
          promise.fulfill(404);
        }
      };

      transaction.onerror = transaction.onabort = promise.reject;
      return promise;
    },

    put: function(path, body, contentType, incoming, revision) {
      var pathObj = parsePath(path),
       promise = promising(),
       transaction = this.db.transaction(['meta', 'bodies'], 'readwrite'),
       metaStore = transaction.objectStore('meta'),
       bodiesStore = transaction.objectStore('bodies'),
       oldBody, oldRevision, done;
console.log('putting', path, pathObj);
      if (pathObj.isFolder) {
        throw "Bad: don't PUT folders";
      }
      
      metaStore.get(pathObj.containingFolder).onsuccess = function(evt) {
        try {
          if(evt.target.result) {
            parentMeta = evt.target.result;
          } else {
            createMeta(metaStore, pathObj.containingFolder);
            parentMeta = {
              path: pathObj.containingFolder,
              items: {}
            };
          }
          if(parentMeta.items[pathObj.itemName]) {
            oldRevision = parentMeta.items[pathObj.itemName].ETag;
          }
          parentMeta.items[pathObj.itemName] = {
            ETag: revision,
            'Content-Type': contentType,
            'Content-Length': body.length//FIXME: how can we find out the number of bytes, rather than the number of utf-8 chars of a JavaScript String?
          };
          metaStore.put(parentMeta);

        } catch(e) {
          if (typeof(done) === 'undefined') {
            done = true;
            promise.reject(e);
          }
        }
      };
      
      bodiesStore.get(path).onsuccess = function(evt) {
        if(evt.target.result) {
          oldBody = evt.target.result.value;
        }
        bodiesStore.put({
          path: path,
          value: body
        });
      };
      
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
      
      metaStore.add({
        path: path,
        items: items
      });
      
      addToParent(metaStore, path, revision);

      transaction.oncomplete = function() {
        promise.fulfill();
      };

      transaction.onerror = transaction.onabort = promise.reject;

      return promise;
    },

    delete: function(path, incoming) {
      var pathObj = parsePath(path);
      if (pathObj.isRoot) {
        throw "Bad: don't DELETE root";
      }
      var transaction = this.db.transaction(['meta', 'bodies'], 'readwrite'),
        promise = promising(),
        oldBody, bodies;
      deleteMeta(transaction, pathObj, incoming, function(oldRevision) {
        if(!pathObj.isFolder) {
          bodies = transaction.objectStore('bodies');
          bodies.get(path).onsuccess = function(evt) {
            oldBody = evt.target.value;
            bodies.delete(path);
          };
        }
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

    _setRevision: function(path, revision) {
      console.log('setting revision', path, revision);
      var pathObj = parsePath(path),
        transaction =  this.db.transaction(['meta'], 'readwrite'),
        metaStore = transaction.objectStore('meta'),
        promise = promising();
      metaStore.get(pathObj.containingFolder).onsuccess = function(evt) {
        var folder = evt.target.result;
        if(!folder.items[pathObj.itemName]) {
          folder.items[pathObj.itemName] = {};
        }
        folder.items[pathObj.itemName].ETag = revision;
        metaStore.put(folder);
      };

      transaction.oncomplete = function() {
        promise.fulfill();
      };

      transaction.onerror = transaction.onabort = promise.reject;
      return promise;
    },

    getRevision: function(path) {
      var promise = promising(),
        pathObj = parsePath(path);
      var transaction = this.db.transaction(['meta'], 'readonly');
      var rev;

      transaction.objectStore('meta').
        get(pathObj.containingFolder).onsuccess = function(evt) {
          if (evt.target.result && evt.target.result.items && evt.target.result.items[pathObj.itemName]) {
            rev =  evt.target.result.items[pathObj.itemName].ETag;
          }
        };

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
            newValue: cursor.value.value
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
        for(var key in attributes) {
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
      if(err) {
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
