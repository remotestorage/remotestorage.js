(function(global) {

  var syncInterval = 10000;

  function taskFor(action, path, promise) {
    return {
      action:  action,
      path:    path,
      promise: promise
    };
  }

  function isStaleChild(node) {
    return node.remote && node.remote.revision && !node.remote.itemsMap && !node.remote.body;
  }

  function hasCommonRevision(node) {
    return node.common && node.common.revision;
  }

  function equal(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  function isFolder(path) {
    return path.substr(-1) === '/';
  }

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
      if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
        return true;
      }
      for (var i in itemsMap) {
        if (typeof(itemsMap[i]) !== 'object') {
          return true;
        }
        if (typeof(itemsMap[i].ETag) !== 'string') {
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
      if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
        return true;
      }
      for (var i in itemsMap) {
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

    hasTasks: function() {
      return Object.getOwnPropertyNames(this._tasks).length > 0;
    },

    collectDiffTasks: function() {
      var num = 0;

      return this.local.forAllNodes(function(node) {
        if (num > 100) {
          return;
        }

        if (this.isCorrupt(node)) {
          RemoteStorage.log('WARNING: corrupt node in local cache', node);
          if (typeof(node) === 'object' && node.path) {
            this.addTask(node.path);
            num++;
          }
        } else if (this.needsFetch(node) && this.access.checkPathPermission(node.path, 'r')) {
          this.addTask(node.path);
          num++;
        } else if (this.isDocumentNode(node) && this.needsPush(node) &&
                   this.access.checkPathPermission(node.path, 'rw')) {
          this.addTask(node.path);
          num++;
        }
      }.bind(this)).then(function() {
        return num;
      }, function(err) {
        throw err;
      });
    },

    inConflict: function(node) {
      return (node.local && node.remote &&
              (node.remote.body !== undefined || node.remote.itemsMap));
    },

    needsRefresh: function(node) {
      if (node.common) {
        if (!node.common.timestamp) {
          return true;
        }
        return (this.now() - node.common.timestamp > syncInterval);
      }
      return false;
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

    needsRemotePut: function(node) {
      return node.local && node.local.body;
    },

    needsRemoteDelete: function(node) {
      return node.local && node.local.body === false;
    },

    getParentPath: function(path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);

      if (parts) {
        return parts[1];
      } else {
        throw new Error('Not a valid path: "'+path+'"');
      }
    },

    deleteChildPathsFromTasks: function() {
      for (var path in this._tasks) {
        paths = this.local._getInternals().pathsFromRoot(path);

        for (var i=1; i<paths.length; i++) {
          if (this._tasks[paths[i]]) {
            delete this._tasks[path];
          }
        }
      }
    },

    collectRefreshTasks: function() {
      return this.local.forAllNodes(function(node) {
        var parentPath;
        if (this.needsRefresh(node)) {
          try {
            parentPath = this.getParentPath(node.path);
          } catch(e) {
            // node.path is already '/', can't take parentPath
          }
          if (parentPath && this.access.checkPathPermission(parentPath, 'r')) {
            this.addTask(parentPath);
          } else if (this.access.checkPathPermission(node.path, 'r')) {
            this.addTask(node.path);
          }
        }
      }.bind(this)).then(function() {
        this.deleteChildPathsFromTasks();
      }.bind(this), function(err) {
        throw err;
      });
    },

    flush: function(nodes) {
      for (var path in nodes) {
        // Strategy is 'FLUSH' and no local changes exist
        if (this.caching.checkPath(path) === 'FLUSH' && !nodes[path].local) {
          RemoteStorage.log('Flushing', path);
          nodes[path] = undefined; // Cause node to be flushed from cache
        }
      }
      return nodes;
    },

    doTask: function(path) {
      var promise = this.local.getNodes([path]).then(function(nodes) {
        var node = nodes[path];

        // First fetch:
        if (typeof(node) === 'undefined') {
          return taskFor('get', path, this.remote.get(path));
        }
        // Fetch known-stale child:
        else if (isStaleChild(node)) {
          return taskFor('get', path, this.remote.get(path));
        }
        // Push PUT:
        else if (this.needsRemotePut(node)) {
          node.push = this.local._getInternals().deepClone(node.local);
          node.push.timestamp = this.now();

          return this.local.setNodes(this.flush(nodes)).then(function() {
            var options;
            if (hasCommonRevision(node)) {
              options = { ifMatch: node.common.revision };
            } else {
              // Initial PUT (fail if something is already there)
              options = { ifNoneMatch: '*' };
            }

            return taskFor('put', path,
              this.remote.put(path, node.push.body, node.push.contentType, options)
            );
          }.bind(this));
        }
        // Push DELETE:
        else if (this.needsRemoteDelete(node)) {
          node.push = { body: false, timestamp: this.now() };

          return this.local.setNodes(this.flush(nodes)).then(function() {
            if (hasCommonRevision(node)) {
              return taskFor('delete', path,
                this.remote.delete(path, { ifMatch: node.common.revision })
              );
            } else { // Ascertain current common or remote revision first
              return taskFor('get', path, this.remote.get(path));
            }
          }.bind(this));
        }
        // Conditional refresh:
        else if (hasCommonRevision(node)) {
          return taskFor('get', path,
            this.remote.get(path, { ifNoneMatch: node.common.revision })
          );
        }
        else {
          return taskFor('get', path, this.remote.get(path));
        }
      }.bind(this));

      return promise;
    },
    autoMergeFolder: function(node) {
      if (node.remote.itemsMap) {
        node.common = node.remote;
        delete node.remote;

        if (node.common.itemsMap) {
          for (var i in node.common.itemsMap) {
            if (!node.local.itemsMap[i]) {
              // Indicates the node is either newly being fetched
              // has been deleted locally (whether or not leading to conflict);
              // before listing it in local listings, check if a local deletion
              // exists.
              node.local.itemsMap[i] = false;
            }
          }
        }
      }
      return node;
    },
    autoMergeDocument: function(node) {
      if (node.remote.body !== undefined) {
        //keep/revert:
        RemoteStorage.log('Emitting keep/revert');

        this.local._emit('change', {
          origin:         'conflict',
          path:           node.path,
          oldValue:       node.local.body,
          newValue:       node.remote.body,
          oldContentType: node.local.contentType,
          newContentType: node.remote.contentType
        });

        node.common = node.remote;
        delete node.remote;
        delete node.local;
      }
      delete node.push;
      return node;
    },
    autoMerge: function(node) {
      if (node.remote) {
        if (node.local) {
          if (node.path.substr(-1) === '/') {
            return autoMergeFolder(node);
          } else {
            return autoMergeDocument(node);
          }
        } else {//remotely created node
          if (node.path.substr(-1) === '/') {//remotely created folder
            if (node.remote.itemsMap !== undefined) {
              node.common = node.remote;
              delete node.remote;
            }
          } else {//remotely created document
            if (node.remote.body !== undefined) {
              this.local._emit('change', {
                origin:   'remote',
                path:     node.path,
                oldValue: (node.common.body === false ? undefined : node.common.body),
                newValue: (node.remote.body === false ? undefined : node.remote.body)
              });
              node.common = node.remote;
              delete node.remote;
            }
          }
        }
      }
      return node;
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

      return this.local.getNodes(paths).then(function(nodes) {
        var j, k, cachingStrategy, create;

        for (j in nodes) {
          if (meta[j]) {
            if (nodes[j] && nodes[j].common) {
              if (nodes[j].common.revision !== meta[j].ETag) {
                if (!nodes[j].remote || nodes[j].remote.revision !== meta[j].ETag) {
                  changedObjs[j] = this.local._getInternals().deepClone(nodes[j]);
                  changedObjs[j].remote = {
                    revision: meta[j].ETag,
                    timestamp: this.now()
                  };
                  changedObjs[j] = this.autoMerge(changedObjs[j]);
                }
              }
            } else {
              cachingStrategy = this.caching.checkPath(j);
              create = (cachingStrategy === 'ALL');
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
          } else if (missingChildren[j.substring(path.length)] && nodes[j] && nodes[j].common) {
            if (nodes[j].common.itemsMap) {
              for (k in nodes[j].common.itemsMap) {
                recurse[j+k] = true;
              }
            }
            if (nodes[j].local && nodes[j].local.itemsMap) {
              for (k in nodes[j].local.itemsMap) {
                recurse[j+k] = true;
              }
            }
            changedObjs[j] = undefined;
          }
        }
        return this.deleteRemoteTrees(Object.keys(recurse), changedObjs).then(function(changedObjs2) {
          return this.local.setNodes(this.flush(changedObjs2));
        }.bind(this));
      }.bind(this));
    },

    deleteRemoteTrees: function(paths, changedNodes) {
      if (paths.length === 0) {
        return promising().fulfill(changedNodes);
      }

      this.local.getNodes(paths).then(function(nodes) {
        var subPaths = {};
        var itemName;

        for (var path in nodes) {
          var node = nodes[path];

          // TODO Why check for the node here? I don't think this check ever applies
          if (!node) {
            continue;
          }

          if (isFolder(path)) {
            if (node.common && node.common.itemsMap) {
              for (itemName in node.common.itemsMap) {
                subPaths[path+itemName] = true;
              }
            }

            if (node.local && node.local.itemsMap) {
              for (itemName in node.local.itemsMap) {
                subPaths[path+itemName] = true;
              }
            }
          } else {
            if (node.common && typeof(node.common.body) !== undefined) {
              changedNodes[path] = this.local._getInternals().deepClone(node);
              changedNodes[path].remote = {
                body:      false,
                timestamp: this.now()
              };
              changedNodes[path] = this.autoMerge(changedNodes[path]);
            }
          }
        }

        // Recurse whole tree depth levels at once:
        return this.deleteRemoteTrees(Object.keys(subPaths), changedNodes).then(function(changedNodes2) {
          return this.local.setNodes(this.flush(changedNodes2));
        }.bind(this));
      }.bind(this));
    },

    completeFetch: function(path, bodyOrItemsMap, contentType, revision) {
      var promise = this.local.getNodes([path]).then(function(nodes) {
        var itemName;
        var missingChildren = {};
        var node = nodes[path];

        collectMissingChildren = function(nodeSet) {
          if (nodeSet && nodeSet.itemsMap) {
            for (var itemName in nodeSet.itemsMap) {
              if (!bodyOrItemsMap[itemName]) {
                missingChildren[itemName] = true;
              }
            }
          }
        };

        if (typeof(node) !== 'object'  || node.path !== path ||
            typeof(node.common) !== 'object') {
          node = {
            path: path,
            common: {}
          };
        }

        node.remote = {
          revision: revision,
          timestamp: this.now()
        };

        if (isFolder(path)) {
          collectMissingChildren(node.common);
          collectMissingChildren(node.local);
          collectMissingChildren(node.remote);

          node.remote.itemsMap = {};
          for (itemName in bodyOrItemsMap) {
            node.remote.itemsMap[itemName] = true;
          }
        } else {
          node.remote.body = bodyOrItemsMap;
          node.remote.contentType = contentType;
        }

        node = this.autoMerge(node);

        return {
          toBeSaved:       nodes,
          missingChildren: missingChildren
        };
      }.bind(this));

      return promise;
    },

    completePush: function(path, action, conflict, revision) {
      var promise = this.local.getNodes([path]).then(function(nodes) {
        var node = nodes[path];

        if (!node.push) {
          this.stopped = true;
          throw new Error('completePush called but no push version!');
        }

        if (conflict) {
          RemoteStorage.log('We have a conflict');

          if (!node.remote || node.remote.revision !== revision) {
            node.remote = {
              revision:  revision,
              timestamp: this.now()
            };
          }

          node = this.autoMerge(node);
        } else {
          node.common = {
            revision:  revision,
            timestamp: this.now()
          };

          if (action === 'put') {
            node.common.body = node.push.body;
            node.common.contentType = node.push.contentType;

            if (equal(node.local.body, node.push.body) &&
                node.local.contentType === node.push.contentType) {
              delete node.local;
            }

            delete node.push;
          } else if (action === 'delete') {
            if (node.local.body === false) { // No new local changes since push; flush it.
              node = undefined;
            } else {
              delete node.push;
            }
          }
        }

        return this.local.setNodes(this.flush(nodes));
      }.bind(this));

      return promise;
    },

    dealWithFailure: function(path, action, statusMeaning) {
      return this.local.getNodes([path]).then(function(nodes) {
        if (nodes[path]) {
          delete nodes[path].push;
          return this.local.setNodes(this.flush(nodes));
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
          if (statusMeaning.changed) {
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

    finishTask: function(task) {
      if (task.action === undefined) {
        delete this._running[task.path];
        return;
      }

      task.promise.then(function(status, bodyOrItemsMap, contentType, revision) {
        return this.handleResponse(task.path, task.action, status, bodyOrItemsMap, contentType, revision);
      }.bind(this), function(err) {
        RemoteStorage.log('wireclient rejects its promise!', task.path, task.action, err);
        return this.handleResponse(task.path, task.action, 'offline');
      }.bind(this))

      .then(function(completed) {
        delete this._timeStarted[task.path];
        delete this._running[task.path];

        if (completed) {
          if (this._tasks[task.path]) {
            for (i=0; i<this._tasks[task.path].length; i++) {
              this._tasks[task.path][i]();
            }
            delete this._tasks[task.path];
          }
        }

        this._emit('req-done');

        this.collectTasks(false).then(function() {
          // See if there are any more tasks that are not refresh tasks
          if (!this.hasTasks() || this.stopped) {
            RemoteStorage.log('sync is done! reschedule?', Object.getOwnPropertyNames(this._tasks).length, this.stopped);
            this._emit('done');
          } else {
            // Use a 10ms timeout to let the JavaScript runtime catch its breath
            // (and hopefully force an IndexedDB auto-commit?), and also to cause
            // the threads to get staggered and get a good spread over time:
            setTimeout(function() {
              this.doTasks();
            }.bind(this), 10);
          }
        }.bind(this));
      }.bind(this),

      function(err) {
        RemoteStorage.log('Error', err);
        this.remote.online = false;
        delete this._timeStarted[task.path];
        delete this._running[task.path];
        this._emit('req-done');
        if (!this.stopped) {
          setTimeout(function() {
            this.doTasks();
          }.bind(this), 0);
        }
      }.bind(this));
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

    collectTasks: function(alsoCheckRefresh) {
      if (this.hasTasks() || this.stopped) {
        promise = promising();
        promise.fulfill();
        return promise;
      }

      return this.collectDiffTasks().then(function(numDiffs) {
        if (numDiffs || alsoCheckRefresh === false) {
          promise = promising();
          promise.fulfill();
          return promise;
        } else {
          return this.collectRefreshTasks();
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
        return this.collectTasks().then(function() {
          try {
            this.doTasks();
          } catch(e) {
            RemoteStorage.log('doTasks error', e);
          }
        }.bind(this), function(e) {
          RemoteStorage.log('Sync error', e);
          throw new Error('Local cache unavailable');
        });
      } else {
        return promising().fulfill();
      }
    },
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
      RemoteStorage.log('Sync done. Setting timer to', this.getSyncInterval());
      if (!this.sync.stopped) {
        this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getSyncInterval());
      }
    }.bind(this));

    this.sync.sync();
  };

  RemoteStorage.prototype.stopSync = function() {
    if (this.sync) {
      RemoteStorage.log('Stopping sync');
      this.sync.stopped = true;
    } else {
      // TODO When is this ever the case and what is syncStopped for then?
      RemoteStorage.log('Will instantiate sync stopped');
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

      if (!remoteStorage.sync) {
        // Call this now that all other modules are also ready:
        remoteStorage.sync = new RemoteStorage.Sync(
            remoteStorage.local, remoteStorage.remote, remoteStorage.access,
            remoteStorage.caching);

        if (remoteStorage.syncStopped) {
          RemoteStorage.log('Instantiating sync stopped');
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
