(function(global) {

  var syncInterval = 10000;

  /**
   * Class: RemoteStorage.Sync
   **/
  RemoteStorage.Sync = function(setLocal, setRemote, setAccess, setCaching, setOnConflict) {
    this.local = setLocal;
    this.remote = setRemote;
    this.access = setAccess;
    this.caching = setCaching;
    this.onConflict = setOnConflict;
    this._tasks = {};
    this._running = {};

  }
  RemoteStorage.Sync.prototype = {
    now: function() {
      return new Date().getTime();
    },
    checkDiffs: function() {
      return [];
    },
    tooOld: function(node) {
      if (node.official && node.official.timestamp) {
        return (this.now() - node.official.timestamp > syncInterval);
      }
      return false;
    },
    getParentPath: function(path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
      if (parts) {
        return parts[1];
      } else {
        throw new Error('not a valid path: "'+path+'"');
      }
    },
    checkRefresh: function() {
      return this.local.forAllNodes(function(node) {
        var parentPath;
        if (this.tooOld(node)) {
          parentPath = this.getParentPath(node.path);
          if (this.access.checkPath(parentPath, 'r')) {
            this._tasks[parentPath] = true;
          } else if (this.access.checkPath(node.path, 'r')) {
            this._tasks[node.path] = true;
          }
        }
      }.bind(this)).then(function() {
        var i, j;
        for(i in this._tasks) {
          nodes = this.local._getInternals()._nodesFromRoot(i);
          for (j=1; j<nodes.length; j++) {
            if (this._tasks[nodes[j]]) {
              delete this._tasks[i];
            }
          }
        }
      }.bind(this));
    },
    doTask: function(path) {
      return this.local.getNodes([path]).then(function(objs) {
        if(typeof(objs[path]) === 'undefined') {
          return { action: undefined };
        } else if (objs[path].remote && objs[path].remote.revision && !objs[path].remote.itemsMap && !objs[path].remote.body) {
          console.log('getting 1', path);
          return {
            action: 'get',
            promise: this.remote.get(path)
          };
        } else if (objs[path].local && objs[path].local.body) {
          objs[path].push = this.local._getInternals()._deepClone(objs[path].local);
          objs[path].push.timestamp =  this.now();
          return this.local.setNodes(objs).then(function() {
            return {
              action: 'put',
              promise: this.remote.put(path, objs[path].push.body, objs[path].push.contentType)
            };
          }.bind(this));
        } else if (objs[path].local) {
          objs[path].push = { timestamp: this.now() };
          return this.local.setNodes(objs).then(function() {
            return {
              action: 'delete',
              promise: this.remote.delete(path)
            };
          }.bind(this));
        } else {
          console.log('getting by default', path);
          return {
            action: 'get',
            promise: this.remote.get(path)
          };
        }
      }.bind(this));
    },
    autoMerge: function(obj) {
      console.log('autoMerge', obj);
      var resolution, fetched;
      if (!obj.remote) {
        console.log('no remote')
        return obj;
      }
      if (!obj.local) {
        if (obj.remote) {
          if (obj.path.substr(-1) === '/') {
            fetched = !!obj.remote.itemsMap;
          } else {
            fetched = !!obj.remote.body;
          }
          if (fetched) {
            console.log('remote has been fetched');
            obj.official = obj.remote;
            delete obj.remote;
          }
            console.log('remote has ? been fetched');
        }
        return obj;
      }
      console.log('have local');
      resolution = this.onConflict.check(obj);
      if (resolution === 'local') {
        obj.official = obj.remote;
        delete obj.remote;
        return obj;
      }
      if (resolution === 'remote') {
        if (obj.remote.body) {
          obj.official = obj.remote;
          delete obj.remote;
          delete obj.push;
          delete obj.local;
          return obj;
        } else {
          resolution = 'fetch';
        }
      }
      if (resolution === 'wait' || resolution === undefined) {
        return obj;
      }
      if (resolution === 'fetch') {
        return obj;
      }
      return obj;
    },
    markChildren: function(path, itemsMap, changedObjs) {
      var i, paths = [], meta = {};
      for (i in itemsMap) {
        paths.push(path+i);
        meta[path+i] = itemsMap[i];
      }
      return this.local.getNodes(paths).then(function(objs) {
        var j, cachingStrategy, create;
        for (j in objs) {
          if (objs[j] && objs[j].official) {
            if (objs[j].official.revision != meta[j].ETag) {
              if (!objs[j].remote || objs[j].remote.revision != meta[j].ETag) {
                changedObjs[j] = this.local._getInternals()._deepClone(objs[j]);
                changedObjs[j].remote = {
                  revision: meta[j].ETag,
                  contentType: meta[j]['Content-Type'],
                  contentLength: meta[j]['Content-Length']
                };
                changedObjs[j] = this.autoMerge(changedObjs[j]);
              }
            }
          } else {
            cachingStrategy = this.caching.checkPath(j);
            if(j.substr(-1) === '/') {
              create = (cachingStrategy === this.caching.FOLDERS || cachingStrategy === this.caching.SEEN_AND_FOLDERS || cachingStrategy === this.caching.ALL);
            } else {
              create = (cachingStrategy === this.caching.ALL);
            }
            if (create) {
              changedObjs[j] = { official: {
                revision: meta[j].ETag,
                contentType: meta[j]['Content-Type'],
                contentLength: meta[j]['Content-Length']
              } };
            }
          }
        }
        return this.local.setNodes(changedObjs);
      }.bind(this));
    },
    completeFetch: function(path, bodyOrItemsMap, contentType, revision) {
      console.log('completeFetch', path, bodyOrItemsMap, contentType, revision);
      return this.local.getNodes([path]).then(function(objs) {
        objs[path].remote = {
          revision: revision
        };
        if (path.substr(-1) === '/') {
          objs[path].remote.itemsMap = bodyOrItemsMap;
        } else {
          objs[path].remote.body = bodyOrItemsMap;
          objs[path].remote.contentType = contentType;
        }
        console.log('passing to autoMerge', objs[path]);
        objs[path] = this.autoMerge(objs[path]);
        return objs;
      }.bind(this));
    },
    completePush: function(path, action, conflict, revision) {
      return this.local.getNodes([path]).then(function(objs) {
        if (conflict) {
          if (!objs[path].remote || objs[path].remote.revision !== revision) {
            objs[path].remote = { revision: revision };
          }
          objs[path] = this.autoMerge(objs[path]);
        } else {
          objs[path].official = {
            revision: revision
          };
          if (action === 'put') {
            objs[path].official.body = objs[path].push.body;
            objs[path].official.contentType = objs[path].push.contentType;
          }
          if (objs[path].local.body === objs[path].push.body && objs[path].local.contentType === objs[path].push.contentType) {
            delete objs[path].local;
          }
          delete objs[path].push;
        }
        return this.local.setNodes(objs);
      }.bind(this));
    },
    interpretStatus: function(statusCode) {
      var series = Math.floor(statusCode / 100);
      return {
        successful: (series === 2 || statusCode === 304 || statusCode === 412),
        conflict: (statusCode === 412)
      }
    },
    handleResponse: function(path, action, status, bodyOrItemsMap, contentType, revision) {
      console.log('handleResponse');
      var statusMeaning = this.interpretStatus(status);
      if (statusMeaning.successful) {
        if (action === 'get') {
          console.log('handleResponse get');
          return this.completeFetch(path, bodyOrItemsMap, contentType, revision).then(function(objs) {
            if (path.substr(-1) === '/') {
              return this.markChildren(path, bodyOrItemsMap, objs);
            } else {
              return this.remote.setNodes(objs);
            }
          }.bind(this));
        } else if (action === 'put') {
          return this.completePush(path, action, statusMeaning.conflict, revision);
        } else if (action === 'delete') {
          return this.completePush(path, action, statusMeaning.conflict, revision);
        }
      } else {
        //TODO: deal with notAuthorized, overQuota, backOff, timeout, serverError, etc.
      }
      return promising().fulfill();
    },
    doTasks: function() {
      var numToHave, numAdded = 0, numToAdd;
      if (this.remote.connected) {
        if (this.remote.online) {
          numToHave = this.numThreads;
        } else {
          numToHave = 1;
        }
      } else {
        numToHave = 0;
      }
      numToAdd = numToHave - Object.getOwnPropertyNames(this._running).length;
      if (numToAdd === 0) {
        return 0;
      }
      for (path in this._tasks) {
        if (!this._running[path]) {
          this._running[path] = this.doTask(path);
          this._running[path].then(function(obj) {
            if(obj.action === undefined) {
              delete this._running[path];
            } else {
              console.log('thenning', path, obj);
              obj.promise.then(function(status, body, contentType, revision) {
                console.log('thenned', path);
                return this.handleResponse(path, obj.action, status, body, contentType, revision);
              }.bind(this)).then(function() {
                  delete this._running[path];
              }.bind(this));
            }
          }.bind(this));
          numAdded++;
          if (numAdded === numToAdd) {
            return true;
          }
        }
      }
      return (numAdded > 0);
    },
    findTasks: function() {
      var i,
        refresh,
        diffs = this.checkDiffs();
      if (diffs.length) {
        for (i=0; i<diffs.length; i++) {
          this.addTask(diffs[i], function() {});
        }
        promise = promising();
        promise.fulfill();
        return promise;
      } else {
        return this.checkRefresh().then(function(refresh) {
          for (i=0; i<refresh.length; i++) {
            this.addTask(refresh[i], function() {});
          }
        });
      }
    },
    addTask: function(path, cb) {
      if(!this._tasks[path]) {
        this._tasks[path] = [];
      }
      this._tasks[path].push(cb);
    },

    /**
     * Method: sync
     **/
    sync: function(remote, local, path) {
      var promise = promising();
      if (!this.doTasks()) {
        return this.findTasks().then(function() {
          this.doTasks();
        }.bind(this));
      } else {
        return promising().fulfill();
      }
    },
    
    /**
     * Method: syncTree
     **/
    syncTree: function(remote, local, path) {
      var promise = promising();
      promise.fulfill();
      return promise;
    }
  };

  /**
   * Method: getSyncInterval
   *
   * Get the value of the sync interval when application is in the foreground
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getSyncInterval = function() {
    return syncInterval;
  };

  /**
   * Method: setSyncInterval
   *
   * Set the value of the sync interval when application is in the foreground
   *
   * Parameters:
   *   interval - sync interval in milliseconds
   *
   */
  RemoteStorage.prototype.setSyncInterval = function(interval) {
    if (typeof(interval) !== 'number') {
      throw interval + " is not a valid sync interval";
    }
    syncInterval = parseInt(interval, 10);
    if (this._syncTimer) {
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), interval);
    }
  };

  var SyncError = function(originalError) {
    var msg = 'Sync failed: ';
    if (typeof(originalError) === 'object' && 'message' in originalError) {
      msg += originalError.message;
    } else {
      msg += originalError;
    }
    this.originalError = originalError;
    Error.apply(this, [msg]);
  };

  SyncError.prototype = Object.create(Error.prototype);

  RemoteStorage.prototype.doSync = function() {
    if (! (this.local && this.caching)) {
      throw "Sync requires 'local' and 'caching'!";
    }
    if (! this.remote.connected) {
      return promising().fulfill();
    }
    var aborted = false;
    var rs = this;

    return promising(function(promise) {
      return promise.fulfill();
    });
  };

  RemoteStorage.SyncError = SyncError;

  RemoteStorage.prototype.syncCycle = function() {
    this.sync().then(function() {
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), this.getSyncInterval());
    }.bind(this),
    function(e) {
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), this.getSyncInterval());
    }.bind(this));
  };

  RemoteStorage.prototype.stopSync = function() {
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      delete this._syncTimer;
    }
  };

  var syncCycleCb;
  RemoteStorage.Sync._rs_init = function(remoteStorage) {
    syncCycleCb = function() {
      remoteStorage.syncCycle();
    };
    remoteStorage.on('ready', syncCycleCb);
  };

  RemoteStorage.Sync._rs_cleanup = function(remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
  };

})(typeof(window) !== 'undefined' ? window : global);
