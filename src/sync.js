(function(global) {

  var syncInterval = 10000;

  /**
   * Class: RemoteStorage.Sync
   **/
  RemoteStorage.Sync = function(setLocal, setRemote, setAccess, setCaching) {
    this.local = setLocal;
    this.remote = setRemote;
    this.access = setAccess;
    this.caching = setCaching;
    this._tasks = {};
    this._running = {};
  }
  RemoteStorage.Sync.prototype = {
    now: function() {
      return new Date().getTime();
    },
    queueGetRequest: function(path, promise) {
      if (!this.remote.connected) {
        promise.reject('cannot fulfill maxAge requirement - remote is not connected');
      } else if (!this.remote.online) {
        promise.reject('cannot fulfill maxAge requirement - remote is not online');
      } else {
        this.addTask(path, function() {
          this.local.get(path).then(function(status, bodyOrItemsMap, contentType) {
            promise.fulfill(status, bodyOrItemsMap, contentType);
          });
        }.bind(this));
      }
    },
    corruptItemsMap: function(itemsMap) {
      var i;
      if ((typeof(itemsMap) !== 'object') ||
          (Array.isArray(itemsMap))) {
         return true;
      }
      for (i in itemsMap) {
        if (typeof(itemsMap[i]) !== 'boolean') {
          return true;
        }
      }
      return false;
    },
    corruptRevision: function(rev) {
      return ((typeof(rev) !== 'object') ||
          (Array.isArray(rev)) ||
          (rev.revision && typeof(rev.revision) != 'string') ||
          (rev.body && typeof(rev.body) != 'string' && typeof(rev.body) != 'object') ||
          (rev.contentType && typeof(rev.contentType) != 'string') ||
          (rev.contentLength && typeof(rev.contentLength) != 'number') ||
          (rev.timestamp && typeof(rev.timestamp) != 'number') ||
          (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
    },
    isCorrupt: function(node) {
      return ((typeof(node) !== 'object') ||
          (Array.isArray(node)) ||
          (typeof(node.path) !== 'string') ||
          (this.corruptRevision(node.common)) ||
          (node.local && this.corruptRevision(node.local)) ||
          (node.remote && this.corruptRevision(node.remote)) ||
          (node.push && this.corruptRevision(node.push)));
    },
    checkDiffs: function() {
      var num = 0;
      return this.local.forAllNodes(function(node) {
        if (num > 100) {
          return;
        }
        if (this.isCorrupt(node)) {
          console.log('WARNING: corrupt node in local cache', node);
          return;
        }
        if (this.needsFetch(node)
            && this.access.checkPath(node.path, 'r')) {
          console.log('enqueuing', node.path);
          this.addTask(node.path, function() {});
          num++;
        } else if (node.remote && node.remote.revision
            && !node.remote.body && !node.remote.itemsMap
            && this.access.checkPath(node.path, 'rw')) {
          this.addTask(node.path, function() {});
          num++;
        }
      }.bind(this)).then(function() {
        console.log('checkDiffs found', num, this._tasks);
        return num;
      }, function(err) {
        throw err;
      });
    },
    tooOld: function(node) {
      console.log('checking tooOld for', node.path); return true;
      if (node.common) {
        if (!node.common.timestamp) {
          return true;
        }
        return (this.now() - node.common.timestamp > syncInterval);
      }
      return false;
    },
    needsFetch: function(node) {
      if (node.common && node.common.itemsMap === undefined && node.common.body === undefined) {
        return true;
      }
      if (node.remote && node.remote.itemsMap === undefined && node.remote.body === undefined) {
        return true;
      }
      console.log('needsFetch false', node);
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
          try {
            parentPath = this.getParentPath(node.path);
          } catch(e) {
            console.log('WARNING: can\'t get parentPath of', node.path);
            //node.path is already '/', can't take parentPath
          }
          if (parentPath && this.access.checkPath(parentPath, 'r')) {
            this._tasks[parentPath] = [];
          } else if (this.access.checkPath(node.path, 'r')) {
            this._tasks[node.path] = [];
          }
        }
        console.log('at end of cb', this._tasks);
      }.bind(this)).then(function() {
        console.log('at start of then', this._tasks);
        var i, j;
        console.log('checkRefresh found', this._tasks);
        for(i in this._tasks) {
          nodes = this.local._getInternals()._nodesFromRoot(i);
          for (j=1; j<nodes.length; j++) {
            if (this._tasks[nodes[j]]) {
              delete this._tasks[i];
            }
          }
        }
        console.log('checkRefresh selected', this._tasks);
      }.bind(this), function(err) {
        throw err;
      });
    },
    doTask: function(path) {
      return this.local.getNodes([path]).then(function(objs) {
        if(typeof(objs[path]) === 'undefined') {
          //first fetch:
          return {
            action: 'get',
            promise: this.remote.get(path)
          };
        } else if (objs[path].remote && objs[path].remote.revision && !objs[path].remote.itemsMap && !objs[path].remote.body) {
          //fetch known-stale child:
          return {
            action: 'get',
            promise: this.remote.get(path)
          };
        } else if (objs[path].local && objs[path].local.body) {
          //push put:
          objs[path].push = this.local._getInternals()._deepClone(objs[path].local);
          objs[path].push.timestamp =  this.now();
          return this.local.setNodes(objs).then(function() {
            var options;
            if (objs[path].common.revision) {
              options = {
                ifMatch: objs[path].common.revision
              };
            } else {
              //force this to be an initial PUT (fail if something is already there)
              options = {
                ifNoneMatch: '*'
              };
            }
            return {
              action: 'put',
              promise: this.remote.put(path, objs[path].push.body, objs[path].push.contentType, options)
            };
          }.bind(this));
        } else if (objs[path].local && objs[path].local.body === false) {
          //push delete:
          objs[path].push = { body: false, timestamp: this.now() };
          return this.local.setNodes(objs).then(function() {
            var options;
            if (objs[path].common.revision) {
              options = {
                ifMatch: objs[path].common.revision
              };
            }
            return {
              action: 'delete',
              promise: this.remote.delete(path, options)
            };
          }.bind(this));
        } else {
          //refresh:
          var options = undefined;
          if (objs[path].common.revision) {
            return {
              action: 'get',
              promise: this.remote.get(path, {
                ifMatch: objs[path].common.revision
              })
            };
          } else {
            return {
              action: 'get',
              promise: this.remote.get(path)
            };
          }
        }
      }.bind(this));
    },
    autoMerge: function(obj) {
      console.log('autoMerge', obj);
      var resolution, newValue, oldValue;
      if (!obj.remote) {
        return obj;
      }
      if (!obj.local) {
        if (obj.remote) {
          if (obj.path.substr(-1) === '/') {
            newValue = obj.remote.itemsMap;
            oldValue = obj.common.itemsMap;
          } else {
            newValue = (obj.remote.body === false ? undefined : obj.remote.body);
            oldValue = (obj.common.body === false ? undefined : obj.common.body);
          }
          if (newValue) {
            this.local._emit('change', {
              path: obj.path,
              oldValue: oldValue,
              newValue: newValue
            });
            obj.common = obj.remote;
            delete obj.remote;
          }
        }
        return obj;
      }
      if (obj.path.substr(-1) === '/') {
        //auto merge folder:
        obj.common = obj.remote;
        delete obj.remote;
        if (obj.common.itemsMap) {
          for (i in obj.common.itemsMap) {
            if (!obj.local.itemsMap[i]) {
              //indicates the node is either newly being fetched
              //has been deleted locally (whether or not leading to conflict);
              //before listing it in local listings, check if a local deletion
              //exists.
              obj.local.itemsMap[i] = false;
            }
          }
        }
        return obj;
      } else {
        //leave to conflict resolution for document:
        delete obj.push;
        return obj;
      }
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
          if (objs[j] && objs[j].common) {
            if (objs[j].common.revision != meta[j].ETag) {
              if (!objs[j].remote || objs[j].remote.revision != meta[j].ETag) {
                changedObjs[j] = this.local._getInternals()._deepClone(objs[j]);
                changedObjs[j].remote = {
                  revision: meta[j].ETag,
                  timestamp: this.now()
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
              changedObjs[j] = {
                path: j,
                common: {
                  revision: meta[j].ETag,
                  timestamp: this.now()
                }
              };
            }
          }
          if (meta[j]['Content-Type']) {
            changedObjs[j].common.contentType = meta[j]['Content-Type'];
          }
          if (meta[j]['Content-Length']) {
            changedObjs[j].common.contentLength = meta[j]['Content-Length'];
          }       
        }
        return this.local.setNodes(changedObjs).then(function() {
          var j;
          for (j in changedObjs) {
            if(changedObjs[j].local && changedObjs[j].remote) {
              this.local._emit('conflict', changedObjs[j]);
            }
          }
        }.bind(this));
      }.bind(this));
    },
    completeFetch: function(path, bodyOrItemsMap, contentType, revision) {
      console.log('completeFetch', path, bodyOrItemsMap, contentType, revision);
      return this.local.getNodes([path]).then(function(objs) {
        var i;
        if(!objs[path]) {
          objs[path] = {
            path: path,
            common: {}
          };
        }
        objs[path].remote = {
          revision: revision,
          timestamp: this.now()
        };
        if (path.substr(-1) === '/') {
          objs[path].remote.itemsMap = {};
          for (i in bodyOrItemsMap) {
            objs[path].remote.itemsMap[i] = true;
          }
        } else {
          objs[path].remote.body = bodyOrItemsMap;
          objs[path].remote.contentType = contentType;
        }
        objs[path] = this.autoMerge(objs[path]);
        console.log('completeFetch after autoMerge', objs);
        return objs;
      }.bind(this));
    },
    completePush: function(path, action, conflict, revision) {
      return this.local.getNodes([path]).then(function(objs) {
        if (conflict) {
          if (!objs[path].remote || objs[path].remote.revision !== revision) {
            objs[path].remote = {
              revision: revision,
              timestamp: this.now()
            };
          }
          objs[path] = this.autoMerge(objs[path]);
        } else {
          objs[path].common = {
            revision: revision,
            timestamp: this.now()
          };
          if (action === 'put') {
            objs[path].common.body = objs[path].push.body;
            objs[path].common.contentType = objs[path].push.contentType;
            if (objs[path].local.body === objs[path].push.body && objs[path].local.contentType === objs[path].push.contentType) {
              delete objs[path].local;
            }
            delete objs[path].push;
          } else if (action === 'delete') {
            if (objs[path].local.body === false) {//successfully deleted and no new local changes since push; flush it.
              objs[path] = undefined;
            } else {
              delete objs[path].push;
            }
          }
        }
        return this.local.setNodes(objs).then(function() {
          var j;
          for (j in objs) {
            if(objs[j].local && objs[j].remote) {
              this.local._emit('conflict', objs[j]);
            }
          }
        }.bind(this));
      }.bind(this));
    },
    dealWithFailure: function(path, action, statusMeaning) {
      return this.local.getNodes([path]).then(function(objs) {
        if (objs[path]) {
          delete objs[path].push;
          return this.local.setNodes(objs);
        }
      }.bind(this));
    },
    interpretStatus: function(statusCode) {
      var series = Math.floor(statusCode / 100);
      return {
        successful: (series === 2 || statusCode === 304 || statusCode === 412 || statusCode === 404),
        conflict: (statusCode === 412),
        notFound: (statusCode === 404)
      }
    },
    handleResponse: function(path, action, status, bodyOrItemsMap, contentType, revision) {
      console.log('handleResponse', path, action, status, bodyOrItemsMap, contentType, revision);
      var statusMeaning = this.interpretStatus(status);
      if (statusMeaning.successful) {
        if (action === 'get') {
          if (statusMeaning.notFound) {
            if (path.substr(-1) === '/') {
              bodyOrItemsMap = {};
            } else {
              bodyOrItemsmap = false;
            }
          }
          return this.completeFetch(path, bodyOrItemsMap, contentType, revision).then(function(objs) {
            if (path.substr(-1) === '/') {
              return this.markChildren(path, bodyOrItemsMap, objs);
            } else {
              return this.local.setNodes(objs).then(function() {
                var j;
                for (j in objs) {
                  if(objs[j].local && objs[j].remote) {
                    this.local._emit('conflict', objs[j]);
                  }
                }
              }.bind(this));
            }
          }.bind(this));
        } else if (action === 'put') {
          return this.completePush(path, action, statusMeaning.conflict, revision);
        } else if (action === 'delete') {
          return this.completePush(path, action, statusMeaning.conflict, revision);
        }
      } else {
        return this.dealWithFailure(path, action, statusMeaning);
      }
      return promising().fulfill();
    },
    numThreads: 5,
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
      if (numToAdd <= 0) {
        return true;
      }
      for (path in this._tasks) {
        if (!this._running[path]) {
          this._running[path] = this.doTask(path);
          this._running[path].then(function(obj) {
            console.log('got task', obj);
            if(obj.action === undefined) {
              delete this._running[path];
            } else {
              obj.promise.then(function(status, body, contentType, revision) {
                return this.handleResponse(path, obj.action, status, body, contentType, revision);
              }.bind(this)).then(function() {
                delete this._running[path];
                if (this._tasks[path]) {
                  for(i=0; i<this._tasks[path].length; i++) {
                    this._tasks[path][i]();
                  }
                  delete this._tasks[path];
                }
              }.bind(this),
              function(err) {
                console.log('task error', err);
                this.remote.online = false;
                delete this._running[path];
              }.bind(this));
            }
          }.bind(this));
          numAdded++;
          if (numAdded >= numToAdd) {
            return true;
          }
        }
      }
      return (numAdded >= numToAdd);
    },
    findTasks: function() {
      return this.checkDiffs().then(function(numDiffs) {
        if (numDiffs) {
          promise = promising();
          promise.fulfill();
          return promise;
        } else {
          return this.checkRefresh();
        }
      }.bind(this), function(err) {
        throw err;
      });
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
    sync: function() {
      var promise = promising();
      if (!this.doTasks()) {
        return this.findTasks().then(function() {
          try {
            this.doTasks();
          } catch(e) {
            console.log('doTasks error', e);
          }
        }.bind(this), function(err) {
          console.log('sync error', err);
          throw new Error('local cache unavailable');
        });
      } else {
        return promising().fulfill();
      }
    },
    resolveConflict: function(path, resolution) {
      return this.local.getNodes([path]).then(function(objs) {
        var obj = objs[path];
        if (resolution === 'local') {
          //don't emit a change event for a local resolution
          obj.common = obj.remote;
          delete obj.remote;
        } else if (resolution === 'remote') {
          if (obj.remote.body === undefined) {
            this.local._emit('change', {
              path: obj.path,
              oldValue: (obj.local.body === false ? undefined : obj.local.body),
              newValue: (obj.common.body === false ? undefined : obj.common.body)
            });
            resolution = 'fetch';
          } else {
            this.local._emit('change', {
              path: obj.path,
              oldValue: (obj.remote.body === false ? undefined : obj.remote.body),
              newValue: (obj.common.body === false ? undefined : obj.common.body)
            });
            obj.common = obj.remote;
            delete obj.remote;
          }
          delete obj.local;
        }
        return obj;
      }.bind(this)).then(function(obj) {
        return this.local.setNodes({path: obj});
      }.bind(this));
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

  RemoteStorage.SyncError = SyncError;

  var stopped;
  RemoteStorage.prototype.syncCycle = function() {
    if (stopped) {
      return;
    }  
    this.sync.sync().then(function() {
      this._syncTimer = setTimeout(this.syncCycle.bind(this), this.getSyncInterval());
    }.bind(this),
    function(e) {
      this._syncTimer = setTimeout(this.syncCycle.bind(this), this.getSyncInterval());
    }.bind(this));
  };

  RemoteStorage.prototype.stopSync = function() {
    stopped = true;
 };

  var syncCycleCb;
  RemoteStorage.Sync._rs_init = function(remoteStorage) {
    syncCycleCb = function() {
      if(!remoteStorage.sync) {
        //call this now that all other modules are also ready:
        remoteStorage.sync = new RemoteStorage.Sync(
            remoteStorage.local, remoteStorage.remote, remoteStorage.access,
            remoteStorage.caching, function (path) {
              remoteStorage._emit('conflict', {path: path});
            });
      }  
      remoteStorage.syncCycle();
    };
    remoteStorage.on('ready', syncCycleCb);
  };

  RemoteStorage.Sync._rs_cleanup = function(remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
  };

})(typeof(window) !== 'undefined' ? window : global);
