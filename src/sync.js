(function(global) {

  var syncInterval = 10000;

  /**
   * Class: RemoteStorage.Sync
   **/
  RemoteStorage.Sync = function(setLocal, setRemote, setAccess, setCaching) {
    this.local = setLocal;
    this.local.onDiff(function(path) {
      this.addTask(path);
      this.doTasks();
    }.bind(this));
    this.remote = setRemote;
    this.access = setAccess;
    this.caching = setCaching;
    this._tasks = {};
    this._running = {};
    this._timeStarted = {};
    RemoteStorage.eventHandling(this, 'done', 'req-done');
    this.caching.onActivate(function(path) {
      this.addTask(path);
      this.doTasks();
    }.bind(this));
  };
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
        this.doTasks();
      }
    },
    corruptServerItemsMap: function(itemsMap, force02) {
      var i;
      if ((typeof(itemsMap) !== 'object') ||
          (Array.isArray(itemsMap))) {
        return true;
      }
      for (i in itemsMap) {
        if (typeof(itemsMap[i]) !== 'object') {
          return true;
        }
        if(typeof(itemsMap[i].ETag) !== 'string') {
          return true;
        }
        if (i.substr(-1) === '/') {
          if (i.substring(0, i.length-1).indexOf('/') !== -1) {
            return true;
          }
        } else {
          if (i.indexOf('/') !== -1) {
            return true;
          }
          if (force02) {
            if (typeof(itemsMap[i]['Content-Type']) !== 'string') {
              return true;
            }
            if (typeof(itemsMap[i]['Content-Length']) !== 'number') {
              return true;
            }
          }
        }
      }
      return false;
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
          (rev.revision && typeof(rev.revision) !== 'string') ||
          (rev.body && typeof(rev.body) !== 'string' && typeof(rev.body) !== 'object') ||
          (rev.contentType && typeof(rev.contentType) !== 'string') ||
          (rev.contentLength && typeof(rev.contentLength) !== 'number') ||
          (rev.timestamp && typeof(rev.timestamp) !== 'number') ||
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
    isFolderNode: function(node) {
      return (node.path.substr(-1) === '/');
    },
    isDocumentNode: function(node) {
      return (!this.isFolderNode(node));
    },
    checkDiffs: function() {
      var num = 0;
      return this.local.forAllNodes(function(node) {
        if (num > 100) {
          return;
        }
        if (this.isCorrupt(node, false)) {
          RemoteStorage.log('WARNING: corrupt node in local cache', node);
          if (typeof(node) === 'object' && node.path) {
            this.addTask(node.path);
            num++;
          }
        } else if (this.needsFetch(node)
            && this.access.checkPathPermission(node.path, 'r')) {
          this.addTask(node.path);
          num++;
        } else if (this.isDocumentNode(node) && this.needsPush(node)
            && this.access.checkPathPermission(node.path, 'rw')) {
          this.addTask(node.path);
          num++;
        }
      }.bind(this)).then(function() {
        return num;
      }, function(err) {
        throw err;
      });
    },
    tooOld: function(node) {
      if (node.common) {
        if (!node.common.timestamp) {
          return true;
        }
        return (this.now() - node.common.timestamp > syncInterval);
      }
      return false;
    },
    inConflict: function(node) {
      return (node.local && node.remote && (node.remote.body !== undefined || node.remote.itemsMap));
    },
    needsFetch: function(node) {
      if (this.inConflict(node)) {
        return true;
      }
      if (node.common && node.common.itemsMap === undefined && node.common.body === undefined) {
        return true;
      }
      if (node.remote && node.remote.itemsMap === undefined && node.remote.body === undefined) {
        return true;
      }
    },
    needsPush: function(node) {
      if (this.inConflict(node)) {
        return false;
      }
      if (node.local && !node.push) {
        return true;
      }
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
            //node.path is already '/', can't take parentPath
          }
          if (parentPath && this.access.checkPathPermission(parentPath, 'r')) {
            this._tasks[parentPath] = [];
          } else if (this.access.checkPathPermission(node.path, 'r')) {
            this._tasks[node.path] = [];
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
      }.bind(this), function(err) {
        throw err;
      });
    },
    flush: function(objs) {
      var i;
      for (i in objs) {
        if (this.caching.checkPath(i) === this.caching.FLUSH && !objs[i].local) {//strategy is FLUSH and no local changes exist
          RemoteStorage.log('flushing', i);
          objs[i] = undefined;//cause node to be flushed from cache
        }
      }
      return objs;
    },
    doTask: function(path) {
      return this.local.getNodes([path]).then(function(objs) {
        if(typeof(objs[path]) === 'undefined') {
          //first fetch:
          return {
            action: 'get',
            path: path,
            promise: this.remote.get(path)
          };
        } else if (objs[path].remote && objs[path].remote.revision && !objs[path].remote.itemsMap && !objs[path].remote.body) {
          //fetch known-stale child:
          return {
            action: 'get',
            path: path,
            promise: this.remote.get(path)
          };
        } else if (objs[path].local && objs[path].local.body) {
          //push put:
          objs[path].push = this.local._getInternals()._deepClone(objs[path].local);
          objs[path].push.timestamp =  this.now();
          return this.local.setNodes(this.flush(objs)).then(function() {
            var options;
            if (objs[path].common && objs[path].common.revision) {
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
              path: path,
              promise: this.remote.put(path, objs[path].push.body, objs[path].push.contentType, options)
            };
          }.bind(this));
        } else if (objs[path].local && objs[path].local.body === false) {
          //push delete:
          objs[path].push = { body: false, timestamp: this.now() };
          return this.local.setNodes(this.flush(objs)).then(function() {
            if (objs[path].common && objs[path].common.revision) {
              return {
                action: 'delete',
                path: path,
                promise: this.remote.delete(path, {
                  ifMatch: objs[path].common.revision
                })
              };
            } else { //ascertain current common or remote revision first
              return {
                action: 'get',
                path: path,
                promise: this.remote.get(path)
              };
            }
          }.bind(this));
        } else if (objs[path].common && objs[path].common.revision) {
          //conditional refresh:
          return {
            action: 'get',
            path: path,
            promise: this.remote.get(path, {
              ifNoneMatch: objs[path].common.revision
            })
          };
        } else {
          return {
            action: 'get',
            path: path,
            promise: this.remote.get(path)
          };
        }
      }.bind(this));
    },
    autoMerge: function(obj) {
      var newValue, oldValue, i;
      if (!obj.remote) {
        return obj;
      }
      if (!obj.local) {
        if (obj.remote) {
          if (obj.path.substr(-1) === '/') {
            newValue = (typeof(obj.remote.itemsMap) === 'object' && Object.keys(obj.remote.itemsMap).length ? obj.remote.itemsMap : undefined);
            oldValue = (typeof(obj.common.itemsMap) === 'object' && Object.keys(obj.common.itemsMap).length ? obj.common.itemsMap : undefined);
          } else {
            newValue = (obj.remote.body === false ? undefined : obj.remote.body);
            oldValue = (obj.common.body === false ? undefined : obj.common.body);
          }

          if (newValue) {
            this.local._emit('change', {
              origin: 'remote',
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
        //auto merge folder once remote was fetched:
        if (obj.remote.itemsMap) {
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
        }
        return obj;
      } else {
        if (obj.remote.body !== undefined) {
          //keep/revert:
          RemoteStorage.log('emitting keep/revert');
          this.local._emit('change', {
            origin: 'conflict',
            path: obj.path,
            oldValue: obj.local.body,
            newValue: obj.remote.body,
            oldContentType: obj.local.contentType,
            newContentType: obj.remote.contentType
          });
          obj.common = obj.remote;
          delete obj.remote;
          delete obj.local;
        }
        delete obj.push;
        return obj;
      }
    },
    markChildren: function(path, itemsMap, changedObjs, missingChildren) {

      var i, paths = [], meta = {}, recurse = {};
      for (i in itemsMap) {
        paths.push(path+i);
        meta[path+i] = itemsMap[i];
      }
      for (i in missingChildren) {
        paths.push(path+i);
      }
      return this.local.getNodes(paths).then(function(objs) {
        var j, k, cachingStrategy, create;
        for (j in objs) {
          if (meta[j]) {
            if (objs[j] && objs[j].common) {
              if (objs[j].common.revision !== meta[j].ETag) {
                if (!objs[j].remote || objs[j].remote.revision !== meta[j].ETag) {
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
              create = (cachingStrategy === this.caching.ALL);
              if (create) {
                changedObjs[j] = {
                  path: j,
                  common: {
                    timestamp: this.now()
                  },
                  remote: {
                    revision: meta[j].ETag,
                    timestamp: this.now()
                  }
                };
              }
            }
            if (changedObjs[j] && meta[j]['Content-Type']) {
              changedObjs[j].remote.contentType = meta[j]['Content-Type'];
            }
            if (changedObjs[j] && meta[j]['Content-Length']) {
              changedObjs[j].remote.contentLength = meta[j]['Content-Length'];
            }
          } else if (missingChildren[i] && objs[j] && objs[j].common) {
            if (objs[j].common.itemsMap) {
              for (k in objs[j].common.itemsMap) {
                recurse[j+k] = true;
              }
            }
            if (objs[j].local && objs[j].local.itemsMap) {
              for (k in objs[j].local.itemsMap) {
                recurse[j+k] = true;
              }
            }
            changedObjs[j] = undefined;
          }
        }
        RemoteStorage.log('line 421', this);
        return this.deleteRemoteTrees(Object.keys(recurse), changedObjs).then(function(changedObjs2) {
          return this.local.setNodes(this.flush(changedObjs2));
        }.bind(this));
      }.bind(this));
    },
    deleteRemoteTrees: function(paths, changedObjs) {
      if (paths.length === 0) {
        return promising().fulfill(changedObjs);
      }
      RemoteStorage.log('431');
      this.local.getNodes(paths).then(function(objs) {
        var i, j, subPaths = {};
        for (i in objs) {
          if (objs[i]) {
            if (i.substr(-1) === '/') {
              if (objs[i].common && objs[i].common.itemsMap) {
                for (j in objs[i].common.itemsMap) {
                  subPaths[i+j] = true;
                }
              }
              if (objs[i].local && objs[i].local.itemsMap) {
                for (j in objs[i].local.itemsMap) {
                  subPaths[i+j] = true;
                }
              }
            } else {
              if (objs[i].common && typeof(objs[i].common.body) !== undefined) {
                RemoteStorage.log('cloning', changedObjs, i, objs, j);
                changedObjs[i] = this.local._getInternals()._deepClone(objs[i]);
                changedObjs[i].remote = {
                  body: false,
                  timestamp: this.now()
                };
                changedObjs[i] = this.autoMerge(changedObjs[i]);
              }
            }
          }
        }
        //recurse whole tree depth levels at once:
        return this.deleteRemoteTrees(Object.keys(subPaths), changedObjs).then(function(changedObjs2) {
          return this.local.setNodes(this.flush(changedObjs2));
        }.bind(this));
      }.bind(this));
    },
    completeFetch: function(path, bodyOrItemsMap, contentType, revision) {
      return this.local.getNodes([path]).then(function(objs) {
        var i, missingChildren = {};
        if(typeof(objs[path]) !== 'object'  || objs[path].path !== path || typeof(objs[path].common) !== 'object') {
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
          if (objs[path].common && objs[path].common.itemsMap) {
            for (i in objs[path].common.itemsMap) {
              if (!bodyOrItemsMap[i]) {
                missingChildren[i] = true;
              }
            }
          }
          if (objs[path].local && objs[path].local.itemsMap) {
            for (i in objs[path].local.itemsMap) {
              if (!bodyOrItemsMap[i]) {
                missingChildren[i] = true;
              }
            }
          }
          if (objs[path].remote && objs[path].remote.itemsMap) {
            for (i in objs[path].remote.itemsMap) {
              if (!bodyOrItemsMap[i]) {
                missingChildren[i] = true;
              }
            }
          }
          for (i in bodyOrItemsMap) {
            objs[path].remote.itemsMap[i] = true;
          }
        } else {
          objs[path].remote.body = bodyOrItemsMap;
          objs[path].remote.contentType = contentType;
        }

        objs[path] = this.autoMerge(objs[path]);

        return {
          toBeSaved: objs,
          missingChildren: missingChildren
        };
      }.bind(this));
    },
    completePush: function(path, action, conflict, revision) {
      return this.local.getNodes([path]).then(function(objs) {
        if (!objs[path].push) {
          RemoteStorage.log('whoops!', path, action, conflict, revision, objs);
          this.stopped = true;
          throw new Error('completePush called but no push version!');
        }
        if (conflict) {
          RemoteStorage.log('we have conflict');
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
        return this.local.setNodes(this.flush(objs));
      }.bind(this));
    },
    dealWithFailure: function(path, action, statusMeaning) {
      return this.local.getNodes([path]).then(function(objs) {
        if (objs[path]) {
          delete objs[path].push;
          return this.local.setNodes(this.flush(objs));
        }
      }.bind(this));
    },
    interpretStatus: function(statusCode) {
      if (statusCode === 'offline' || statusCode === 'timeout') {
        return {
          successful: false,
          networkProblems: true
        };
      }
      var series = Math.floor(statusCode / 100);
      return {
        successful: (series === 2 || statusCode === 304 || statusCode === 412 || statusCode === 404),
        conflict: (statusCode === 412),
        unAuth: (statusCode === 401 || statusCode === 402 ||statusCode === 403),
        notFound: (statusCode === 404),
        changed: (statusCode !== 304)
      };
    },
    handleResponse: function(path, action, status, bodyOrItemsMap, contentType, revision) {
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
          if(statusMeaning.changed) {
            return this.completeFetch(path, bodyOrItemsMap, contentType, revision).then(function(dataFromFetch) {
              if (path.substr(-1) === '/') {
                if (this.corruptServerItemsMap(bodyOrItemsMap)) {
                  RemoteStorage.log('WARNING: discarding corrupt folder description from server for ' + path);
                  return false;
                } else {
                  return this.markChildren(path, bodyOrItemsMap, dataFromFetch.toBeSaved, dataFromFetch.missingChildren).then(function() {
                    return true;//task completed
                  });
                }
              } else {
                return this.local.setNodes(this.flush(dataFromFetch.toBeSaved)).then(function() {
                  return true;//task completed
                });
              }
            }.bind(this));
          } else {
            return promising().fulfill(true);//task completed
          }
        } else if (action === 'put') {
          return this.completePush(path, action, statusMeaning.conflict, revision).then(function() {
            return true;//task completed
          });
        } else if (action === 'delete') {
          return this.completePush(path, action, statusMeaning.conflict, revision).then(function() {
            return true;//task completed
          });
        } else {
          throw new Error('cannot handle response for unknown action', action);
        }
      } else {
        if (statusMeaning.unAuth) {
          remoteStorage._emit('error', new RemoteStorage.Unauthorized());
        }
        if (statusMeaning.networkProblems) {
          remoteStorage._emit('error', new RemoteStorage.SyncError());
        }
        return this.dealWithFailure(path, action, statusMeaning).then(function() {
          return false;
        });
      }
    },
    numThreads: 10,
    finishTask: function (obj) {
      if(obj.action === undefined) {
        delete this._running[obj.path];
      } else {
        obj.promise.then(function(status, bodyOrItemsMap, contentType, revision) {
          return this.handleResponse(obj.path, obj.action, status, bodyOrItemsMap, contentType, revision);
        }.bind(this), function(err) {
          RemoteStorage.log('wireclient rejects its promise!', obj.path, obj.action, err);
          return this.handleResponse(obj.path, obj.action, 'offline');
        }.bind(this)).then(function(completed) {
          delete this._timeStarted[obj.path];
          delete this._running[obj.path];
          if (completed) {
            if (this._tasks[obj.path]) {
              for(i=0; i<this._tasks[obj.path].length; i++) {
                this._tasks[obj.path][i]();
              }
              delete this._tasks[obj.path];
            }
          }
          this._emit('req-done');
          this.findTasks(false).then(function() {//see if there are any more tasks that are not refresh tasks
            if (Object.getOwnPropertyNames(this._tasks).length === 0 || this.stopped) {
              RemoteStorage.log('sync is done! reschedule?', Object.getOwnPropertyNames(this._tasks).length, this.stopped);
              this._emit('done');
            } else {
              //use a 10ms timeout to let the JavaScript runtime catch its breath
              //(and hopefully force an IndexedDB auto-commit?), and also to cause
              //the threads to get staggered and get a good spread over time:
              setTimeout(function() {
                this.doTasks();
              }.bind(this), 10);
            }
          }.bind(this));
        }.bind(this),
        function(err) {
          RemoteStorage.log('bug!', err);
          this.remote.online = false;
          delete this._timeStarted[obj.path];
          delete this._running[obj.path];
          this._emit('req-done');
          if (!this.stopped) {
            setTimeout(function() {
              this.doTasks();
            }.bind(this), 0);
          }
        }.bind(this));
      }
    },
    doTasks: function() {
      var numToHave, numAdded = 0, numToAdd, path;
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
          this._timeStarted = this.now();
          this._running[path] = this.doTask(path);
          this._running[path].then(this.finishTask.bind(this));
          numAdded++;
          if (numAdded >= numToAdd) {
            return true;
          }
        }
      }
      return (numAdded >= numToAdd);
    },
    findTasks: function(alsoCheckRefresh) {
      if (Object.getOwnPropertyNames(this._tasks).length > 0 || this.stopped) {
        promise = promising();
        promise.fulfill();
        return promise;
      }
      return this.checkDiffs().then(function(numDiffs) {
        if (numDiffs || alsoCheckRefresh === false) {
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
      if (!this._tasks[path]) {
        this._tasks[path] = [];
      }
      if (typeof(cb) === 'function') {
        this._tasks[path].push(cb);
      }
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
            RemoteStorage.log('doTasks error', e);
          }
        }.bind(this), function(err) {
          RemoteStorage.log('sync error', err);
          throw new Error('local cache unavailable');
        });
      } else {
        RemoteStorage.log('doTasks returned true');
        return promising().fulfill();
      }
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

  RemoteStorage.prototype.syncCycle = function() {
    if (this.sync.stopped) {
      return;
    }
    this.sync.on('done', function() {
      RemoteStorage.log('done caught! setting timer', this.getSyncInterval());
      if (!this.sync.stopped) {
        this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getSyncInterval());
      }
    }.bind(this));
    RemoteStorage.log('syncCycle calling sync.sync:');
    this.sync.sync();
  };

  RemoteStorage.prototype.stopSync = function() {
    if (this.sync) {
      RemoteStorage.log('stopping sync');
      this.sync.stopped = true;
    } else {
      RemoteStorage.log('will instantiate sync stopped');
      this.syncStopped = true;
    }
  };
  RemoteStorage.prototype.startSync = function() {
    this.sync.stopped = false;
    this.syncStopped = false;
    this.sync.sync();
  };

  var syncCycleCb;
  RemoteStorage.Sync._rs_init = function(remoteStorage) {
    syncCycleCb = function() {
      RemoteStorage.log('syncCycleCb calling syncCycle:');
      if(!remoteStorage.sync) {
        //call this now that all other modules are also ready:
        remoteStorage.sync = new RemoteStorage.Sync(
            remoteStorage.local, remoteStorage.remote, remoteStorage.access,
            remoteStorage.caching);
        if (remoteStorage.syncStopped) {
          RemoteStorage.log('instantiating sync stopped');
          remoteStorage.sync.stopped = true;
          delete remoteStorage.syncStopped;
        }
      }
      RemoteStorage.log('syncCycleCb calling syncCycle:');
      remoteStorage.syncCycle();
    };
    remoteStorage.on('ready', syncCycleCb);
  };

  RemoteStorage.Sync._rs_cleanup = function(remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
  };

})(typeof(window) !== 'undefined' ? window : global);
