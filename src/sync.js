(function (global) {

  var syncInterval = 10000,
      backgroundSyncInterval = 60000,
      isBackground = false;

  var isFolder = RemoteStorage.util.isFolder;
  var isDocument = RemoteStorage.util.isDocument;
  var equal = RemoteStorage.util.equal;
  var deepClone = RemoteStorage.util.deepClone;
  var pathsFromRoot = RemoteStorage.util.pathsFromRoot;

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

  function handleVisibility() {
    var hidden,
        visibilityChange,
        rs = this;

    function handleVisibilityChange(fg) {
      var oldValue, newValue;
      oldValue = rs.getCurrentSyncInterval();
      isBackground = !fg;
      newValue = rs.getCurrentSyncInterval();
      rs._emit('sync-interval-change', {oldValue: oldValue, newValue: newValue});
    }

    RemoteStorage.Env.on("background", function () {
      handleVisibilityChange(false);
    });

    RemoteStorage.Env.on("foreground", function () {
      handleVisibilityChange(true);
    });
  }

  /**
   * Check if interval is valid: numeric and between 1000ms and 3600000ms
   *
   */
  function isValidInterval(interval) {
    return (typeof interval === 'number' && interval > 1000 && interval < 3600000);
  }

  /**
   * Class: RemoteStorage.Sync
   *
   * What this class does is basically six things:
   * - retrieving the remote version of relevant documents and folders
   * - add all local and remote documents together into one tree
   * - push local documents out if they don't exist remotely
   * - push local changes out to remote documents (conditionally, to
   *      avoid race conditions where both have changed)
   * - adopt the local version of a document to its remote version if
   *      both exist and they differ
   * - delete the local version of a document if it was deleted remotely
   * - if any get requests were waiting for remote data, resolve them once
   *      this data comes in.
   *
   * It does this using requests to documents, and to folders. Whenever a
   * folder GET comes in, it gives information about all the documents it
   * contains (this is the `markChildren` function).
   **/
  RemoteStorage.Sync = function (setLocal, setRemote, setAccess, setCaching) {
    this.local = setLocal;
    this.local.onDiff(function (path) {
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
    this.caching.onActivate(function (path) {
      this.addTask(path);
      this.doTasks();
    }.bind(this));
  };

  RemoteStorage.Sync.prototype = {

    now: function () {
      return new Date().getTime();
    },

    queueGetRequest: function (path) {
      var pending = Promise.defer();
      if (!this.remote.connected) {
        pending.reject('cannot fulfill maxAge requirement - remote is not connected');
      } else if (!this.remote.online) {
        pending.reject('cannot fulfill maxAge requirement - remote is not online');
      } else {
        this.addTask(path, function () {
          this.local.get(path).then(function (r) {
            return pending.resolve(r);
          });
        }.bind(this));

        this.doTasks();
      }
      return pending.promise;
    },

    corruptServerItemsMap: function (itemsMap, force02) {
      if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
        return true;
      }

      for (var itemName in itemsMap) {
        var item = itemsMap[itemName];

        if (typeof(item) !== 'object') {
          return true;
        }
        if (typeof(item.ETag) !== 'string') {
          return true;
        }
        if (isFolder(itemName)) {
          if (itemName.substring(0, itemName.length-1).indexOf('/') !== -1) {
            return true;
          }
        } else {
          if (itemName.indexOf('/') !== -1) {
            return true;
          }
          if (force02) {
            if (typeof(item['Content-Type']) !== 'string') {
              return true;
            }
            if (typeof(item['Content-Length']) !== 'number') {
              return true;
            }
          }
        }
      }

      return false;
    },

    corruptItemsMap: function (itemsMap) {
      if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
        return true;
      }

      for (var itemName in itemsMap) {
        if (typeof(itemsMap[itemName]) !== 'boolean') {
          return true;
        }
      }

      return false;
    },

    corruptRevision: function (rev) {
      return ((typeof(rev) !== 'object') ||
              (Array.isArray(rev)) ||
              (rev.revision && typeof(rev.revision) !== 'string') ||
              (rev.body && typeof(rev.body) !== 'string' && typeof(rev.body) !== 'object') ||
              (rev.contentType && typeof(rev.contentType) !== 'string') ||
              (rev.contentLength && typeof(rev.contentLength) !== 'number') ||
              (rev.timestamp && typeof(rev.timestamp) !== 'number') ||
              (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
    },

    isCorrupt: function (node) {
      return ((typeof(node) !== 'object') ||
              (Array.isArray(node)) ||
              (typeof(node.path) !== 'string') ||
              (this.corruptRevision(node.common)) ||
              (node.local && this.corruptRevision(node.local)) ||
              (node.remote && this.corruptRevision(node.remote)) ||
              (node.push && this.corruptRevision(node.push)));
    },

    hasTasks: function () {
      return Object.getOwnPropertyNames(this._tasks).length > 0;
    },

    collectDiffTasks: function () {
      var num = 0;

      return this.local.forAllNodes(function (node) {

        if (num > 100) {
          return;
        }

        if (this.isCorrupt(node)) {
          RemoteStorage.log('[Sync] WARNING: corrupt node in local cache', node);
          if (typeof(node) === 'object' && node.path) {
            this.addTask(node.path);
            num++;
          }
        } else if (this.needsFetch(node) && this.access.checkPathPermission(node.path, 'r')) {
          this.addTask(node.path);
          num++;
        } else if (isDocument(node.path) && this.needsPush(node) &&
                   this.access.checkPathPermission(node.path, 'rw')) {
          this.addTask(node.path);
          num++;
        }
      }.bind(this)).then(function () {
        return num;
      }, function (err) {
        throw err;
      });
    },

    inConflict: function (node) {
      return (node.local && node.remote &&
              (node.remote.body !== undefined || node.remote.itemsMap));
    },

    needsRefresh: function (node) {
      if (node.common) {
        if (!node.common.timestamp) {
          return true;
        }
        return (this.now() - node.common.timestamp > syncInterval);
      }
      return false;
    },

    needsFetch: function (node) {
      if (this.inConflict(node)) {
        return true;
      }
      if (node.common && node.common.itemsMap === undefined && node.common.body === undefined) {
        return true;
      }
      if (node.remote && node.remote.itemsMap === undefined && node.remote.body === undefined) {
        return true;
      }
      return false;
    },

    needsPush: function (node) {
      if (this.inConflict(node)) {
        return false;
      }
      if (node.local && !node.push) {
        return true;
      }
    },

    needsRemotePut: function (node) {
      return node.local && node.local.body;
    },

    needsRemoteDelete: function (node) {
      return node.local && node.local.body === false;
    },

    getParentPath: function (path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);

      if (parts) {
        return parts[1];
      } else {
        throw new Error('Not a valid path: "'+path+'"');
      }
    },

    deleteChildPathsFromTasks: function () {
      for (var path in this._tasks) {
        paths = pathsFromRoot(path);

        for (var i=1; i<paths.length; i++) {
          if (this._tasks[paths[i]]) {
            delete this._tasks[path];
          }
        }
      }
    },

    collectRefreshTasks: function () {
      return this.local.forAllNodes(function (node) {
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
      }.bind(this)).then(function () {
        this.deleteChildPathsFromTasks();
      }.bind(this), function (err) {
        throw err;
      });
    },

    flush: function (nodes) {
      for (var path in nodes) {
        // Strategy is 'FLUSH' and no local changes exist
        if (this.caching.checkPath(path) === 'FLUSH' && nodes[path] && !nodes[path].local) {
          RemoteStorage.log('[Sync] Flushing', path);
          nodes[path] = undefined; // Cause node to be flushed from cache
        }
      }
      return nodes;
    },

    doTask: function (path) {
      return this.local.getNodes([path]).then(function (nodes) {
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
          node.push = deepClone(node.local);
          node.push.timestamp = this.now();

          return this.local.setNodes(this.flush(nodes)).then(function () {
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

          return this.local.setNodes(this.flush(nodes)).then(function () {
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
    },

    autoMergeFolder: function (node) {
      if (node.remote.itemsMap) {
        node.common = node.remote;
        delete node.remote;

        if (node.common.itemsMap) {
          for (var itemName in node.common.itemsMap) {
            if (!node.local.itemsMap[itemName]) {
              // Indicates the node is either newly being fetched
              // has been deleted locally (whether or not leading to conflict);
              // before listing it in local listings, check if a local deletion
              // exists.
              node.local.itemsMap[itemName] = false;
            }
          }

          if (equal(node.local.itemsMap, node.common.itemsMap)) {
            delete node.local;
          }
        }
      }
      return node;
    },

    autoMergeDocument: function (node) {
      hasNoRemoteChanges = function (node) {
        if (node.remote && node.remote.revision && node.remote.revision !== node.common.revision) {
          return false;
        }
        return (node.common.body === undefined && node.remote.body === false) ||
               (node.remote.body === node.common.body &&
                node.remote.contentType === node.common.contentType);
      };
      mergeMutualDeletion = function (node) {
        if (node.remote && node.remote.body === false
            && node.local && node.local.body === false) {
           delete node.local;
        }
        return node;
      };

      if (hasNoRemoteChanges(node)) {
        node = mergeMutualDeletion(node);
        delete node.remote;
      } else if (node.remote.body !== undefined) {
        // keep/revert:
        RemoteStorage.log('[Sync] Emitting keep/revert');

        this.local._emitChange({
          origin:         'conflict',
          path:           node.path,
          oldValue:       node.local.body,
          newValue:       node.remote.body,
          lastCommonValue: node.common.body,
          oldContentType: node.local.contentType,
          newContentType: node.remote.contentType,
          lastCommonContentType: node.common.contentType
        });

        if (node.remote.body) {
          node.common = node.remote;
        } else {
          node.common = {};
        }
        delete node.remote;
        delete node.local;
      }
      return node;
    },

    autoMerge: function (node) {
      if (node.remote) {
        if (node.local) {
          if (isFolder(node.path)) {
            return this.autoMergeFolder(node);
          } else {
            return this.autoMergeDocument(node);
          }
        } else { // no local changes
          if (isFolder(node.path)) {
            if (node.remote.itemsMap !== undefined) {
              node.common = node.remote;
              delete node.remote;
            }
          } else {
            if (node.remote.body !== undefined) {
              var change = {
                origin:   'remote',
                path:     node.path,
                oldValue: (node.common.body === false ? undefined : node.common.body),
                newValue: (node.remote.body === false ? undefined : node.remote.body),
                oldContentType: node.common.contentType,
                newContentType: node.remote.contentType
              };
              if (change.oldValue || change.newValue) {
                this.local._emitChange(change);
              }

              if (!node.remote.body) { // no remote, so delete/don't create
                return;
              }

              node.common = node.remote;
              delete node.remote;
            }
          }
        }
      } else {
        if (node.common.body) {
          this.local._emitChange({
            origin:   'remote',
            path:     node.path,
            oldValue: node.common.body,
            newValue: undefined,
            oldContentType: node.common.contentType,
            newContentType: undefined
          });
        }

        return undefined;
      }
      return node;
    },

    updateCommonTimestamp: function (path, revision) {
      return this.local.getNodes([path]).then(function (nodes) {
        if (nodes[path] && nodes[path].common && nodes[path].common.revision === revision) {
          nodes[path].common.timestamp = this.now();
        }
        return this.local.setNodes(this.flush(nodes));
      }.bind(this));
    },

    markChildren: function (path, itemsMap, changedNodes, missingChildren) {
      var paths = [];
      var meta = {};
      var recurse = {};

      for (var item in itemsMap) {
        paths.push(path+item);
        meta[path+item] = itemsMap[item];
      }
      for (var childName in missingChildren) {
        paths.push(path+childName);
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var cachingStrategy;
        var node;

        nodeChanged = function (node, etag) {
          return node.common.revision !== etag && (!node.remote || node.remote.revision !== etag);
        };

        for (var nodePath in nodes) {
          node = nodes[nodePath];

          if (meta[nodePath]) {
            if (node && node.common) {
              if (nodeChanged(node, meta[nodePath].ETag)) {
                changedNodes[nodePath] = deepClone(node);
                changedNodes[nodePath].remote = {
                  revision:  meta[nodePath].ETag,
                  timestamp: this.now()
                };
                changedNodes[nodePath] = this.autoMerge(changedNodes[nodePath]);
              }
            } else {
              cachingStrategy = this.caching.checkPath(nodePath);
              if (cachingStrategy === 'ALL') {
                changedNodes[nodePath] = {
                  path: nodePath,
                  common: {
                    timestamp: this.now()
                  },
                  remote: {
                    revision: meta[nodePath].ETag,
                    timestamp: this.now()
                  }
                };
              }
            }

            if (changedNodes[nodePath] && meta[nodePath]['Content-Type']) {
              changedNodes[nodePath].remote.contentType = meta[nodePath]['Content-Type'];
            }

            if (changedNodes[nodePath] && meta[nodePath]['Content-Length']) {
              changedNodes[nodePath].remote.contentLength = meta[nodePath]['Content-Length'];
            }
          } else if (missingChildren[nodePath.substring(path.length)] && node && node.common) {
            if (node.common.itemsMap) {
              for (var commonItem in node.common.itemsMap) {
                recurse[nodePath+commonItem] = true;
              }
            }

            if (node.local && node.local.itemsMap) {
              for (var localItem in node.local.itemsMap) {
                recurse[nodePath+localItem] = true;
              }
            }

            if (node.remote || isFolder(nodePath)) {
              changedNodes[nodePath] = undefined;
            } else {
              changedNodes[nodePath] = this.autoMerge(node);

              if (typeof changedNodes[nodePath] === 'undefined') {
                var parentPath = this.getParentPath(nodePath);
                var parentNode = changedNodes[parentPath];
                var itemName = nodePath.substring(path.length);
                if (parentNode && parentNode.local) {
                  delete parentNode.local.itemsMap[itemName];

                  if (equal(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
                    delete parentNode.local;
                  }
                }
              }
            }
          }
        }

        return this.deleteRemoteTrees(Object.keys(recurse), changedNodes).then(function (changedObjs2) {
          return this.local.setNodes(this.flush(changedObjs2));
        }.bind(this));
      }.bind(this));
    },

    deleteRemoteTrees: function (paths, changedNodes) {
      if (paths.length === 0) {
        return Promise.resolve(changedNodes);
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var subPaths = {};

        collectSubPaths = function (folder, path) {
          if (folder && folder.itemsMap) {
            for (var itemName in folder.itemsMap) {
              subPaths[path+itemName] = true;
            }
          }
        };

        for (var path in nodes) {
          var node = nodes[path];

          // TODO Why check for the node here? I don't think this check ever applies
          if (!node) {
            continue;
          }

          if (isFolder(path)) {
            collectSubPaths(node.common, path);
            collectSubPaths(node.local, path);
          } else {
            if (node.common && typeof(node.common.body) !== undefined) {
              changedNodes[path] = deepClone(node);
              changedNodes[path].remote = {
                body:      false,
                timestamp: this.now()
              };
              changedNodes[path] = this.autoMerge(changedNodes[path]);
            }
          }
        }

        // Recurse whole tree depth levels at once:
        return this.deleteRemoteTrees(Object.keys(subPaths), changedNodes).then(function (changedNodes2) {
          return this.local.setNodes(this.flush(changedNodes2));
        }.bind(this));
      }.bind(this));
    },

    completeFetch: function (path, bodyOrItemsMap, contentType, revision) {
      var paths;
      var parentPath;
      var pathsFromRootArr = pathsFromRoot(path);

      if (isFolder(path)) {
        paths = [path];
      } else {
        parentPath = pathsFromRootArr[1];
        paths = [path, parentPath];
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var itemName;
        var missingChildren = {};
        var node = nodes[path];
        var parentNode;

        collectMissingChildren = function (folder) {
          if (folder && folder.itemsMap) {
            for (var itemName in folder.itemsMap) {
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
          nodes[path] = node;
        }

        node.remote = {
          revision: revision,
          timestamp: this.now()
        };

        if (isFolder(path)) {
          collectMissingChildren(node.common);
          collectMissingChildren(node.remote);

          node.remote.itemsMap = {};
          for (itemName in bodyOrItemsMap) {
            node.remote.itemsMap[itemName] = true;
          }
        } else {
          node.remote.body = bodyOrItemsMap;
          node.remote.contentType = contentType;

          parentNode = nodes[parentPath];
          if (parentNode && parentNode.local && parentNode.local.itemsMap) {
            itemName = path.substring(parentPath.length);
            parentNode.local.itemsMap[itemName] = true;
            if (equal(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
              delete parentNode.local;
            }
          }
        }

        nodes[path] = this.autoMerge(node);
        return {
          toBeSaved:       nodes,
          missingChildren: missingChildren
        };
      }.bind(this));
    },

    completePush: function (path, action, conflict, revision) {
      return this.local.getNodes([path]).then(function (nodes) {
        var node = nodes[path];

        if (!node.push) {
          this.stopped = true;
          throw new Error('completePush called but no push version!');
        }

        if (conflict) {
          RemoteStorage.log('[Sync] We have a conflict');

          if (!node.remote || node.remote.revision !== revision) {
            node.remote = {
              revision:  revision || 'conflict',
              timestamp: this.now()
            };
            delete node.push;
          }

          nodes[path] = this.autoMerge(node);
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
              nodes[path] = undefined;
            } else {
              delete node.push;
            }
          }
        }

        return this.local.setNodes(this.flush(nodes));
      }.bind(this));
    },

    dealWithFailure: function (path, action, statusMeaning) {
      return this.local.getNodes([path]).then(function (nodes) {
        if (nodes[path]) {
          delete nodes[path].push;
          return this.local.setNodes(this.flush(nodes));
        }
      }.bind(this));
    },

    interpretStatus: function (statusCode) {
      // if (typeof statusCode.length === 'number') {
      //   statusCode = statusCode[0];
      // }
      if (statusCode === 'offline' || statusCode === 'timeout') {
        return {
          successful:      false,
          networkProblems: true,
          statusCode: statusCode
        };
      }

      var series = Math.floor(statusCode / 100);

      return {
        successful: (series === 2 || statusCode === 304 || statusCode === 412 || statusCode === 404),
        conflict:   (statusCode === 412),
        unAuth:     ((statusCode === 401 && this.remote.token !== RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN) ||
                     statusCode === 402 || statusCode === 403),
        notFound:   (statusCode === 404),
        changed:    (statusCode !== 304),
        statusCode: statusCode
      };
    },

    handleGetResponse: function (path, status, bodyOrItemsMap, contentType, revision) {
      if (status.notFound) {
        if (isFolder(path)) {
          bodyOrItemsMap = {};
        } else {
          bodyOrItemsMap = false;
        }
      }

      if (status.changed) {
        return this.completeFetch(path, bodyOrItemsMap, contentType, revision).then(function (dataFromFetch) {
          if (isFolder(path)) {
            if (this.corruptServerItemsMap(bodyOrItemsMap)) {
              RemoteStorage.log('[Sync] WARNING: Discarding corrupt folder description from server for ' + path);
              return false;
            } else {
              return this.markChildren(path, bodyOrItemsMap, dataFromFetch.toBeSaved, dataFromFetch.missingChildren).then(function () {
                return true;
              });
            }
          } else {
            return this.local.setNodes(this.flush(dataFromFetch.toBeSaved)).then(function () {
              return true;
            });
          }
        }.bind(this));
      } else {
        return this.updateCommonTimestamp(path, revision).then(function () {
          return true;
        });
      }
    },

    handleResponse: function (path, action, r) {
      var status = this.interpretStatus(r.statusCode);
      if (status.successful) {
        if (action === 'get') {
          return this.handleGetResponse(path, status, r.body, r.contentType, r.revision);
        } else if (action === 'put' || action === 'delete') {
          return this.completePush(path, action, status.conflict, r.revision).then(function () {
            return true;
          });
        } else {
          throw new Error('cannot handle response for unknown action', action);
        }
      } else {
      // Unsuccessful
        var error;
        if (status.unAuth) {
          error = new RemoteStorage.Unauthorized();
        } else if (status.networkProblems) {
          error = new RemoteStorage.SyncError('Network request failed.');
          this.remote.online = false;
        } else {
          error = new Error('HTTP response code ' + status.statusCode + ' received.');
        }

        return this.dealWithFailure(path, action, status).then(function () {
          remoteStorage._emit('error', error);
          throw error;
        });
      }
    },

    numThreads: 10,

    finishTask: function (task) {
      if (task.action === undefined) {
        delete this._running[task.path];
        return;
      }
      var self = this;

      return task.promise.then(function (r) {
        return self.handleResponse(task.path, task.action, r);
      }, function (err) {
        RemoteStorage.log('[Sync] wireclient rejects its promise!', task.path, task.action, err);
        return self.handleResponse(task.path, task.action, {statusCode: 'offline'});
      })

      .then(function (completed) {
        delete self._timeStarted[task.path];
        delete self._running[task.path];
        self.remote.online = true;

        if (completed) {
          if (self._tasks[task.path]) {
            for (i=0; i<self._tasks[task.path].length; i++) {
              self._tasks[task.path][i]();
            }
            delete self._tasks[task.path];
          }
        }

        self._emit('req-done');

        self.collectTasks(false).then(function () {
          // See if there are any more tasks that are not refresh tasks
          if (!self.hasTasks() || self.stopped) {
            RemoteStorage.log('[Sync] Sync is done! Reschedule?', Object.getOwnPropertyNames(self._tasks).length, self.stopped);
            if (!self.done) {
              self.done = true;
              self._emit('done');
            }
          } else {
            // Use a 10ms timeout to let the JavaScript runtime catch its breath
            // (and hopefully force an IndexedDB auto-commit?), and also to cause
            // the threads to get staggered and get a good spread over time:
            setTimeout(function () {
              self.doTasks();
            }, 10);
          }
        });
      }, function (err) {
        console.error('[Sync] Error', err);
        delete self._timeStarted[task.path];
        delete self._running[task.path];
        self._emit('req-done');
        if (!self.done) {
          self.done = true;
          self._emit('done');
        }
      });
    },

    doTasks: function () {
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

    collectTasks: function (alsoCheckRefresh) {
      if (this.hasTasks() || this.stopped) {
        return Promise.resolve();
      }

      return this.collectDiffTasks().then(function (numDiffs) {
        if (numDiffs || alsoCheckRefresh === false) {
          return Promise.resolve();
        } else {
          return this.collectRefreshTasks();
        }
      }.bind(this), function (err) {
        throw err;
      });
    },

    addTask: function (path, cb) {
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
    sync: function () {
      this.done = false;

      if (!this.doTasks()) {
        return this.collectTasks().then(function () {
          try {
            this.doTasks();
          } catch(e) {
            console.error('[Sync] doTasks error', e);
          }
        }.bind(this), function (e) {
          console.error('[Sync] Sync error', e);
          throw new Error('Local cache unavailable');
        });
      } else {
        return Promise.resolve();
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
  RemoteStorage.prototype.getSyncInterval = function () {
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
  RemoteStorage.prototype.setSyncInterval = function (interval) {
    if (!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    var oldValue = syncInterval;
    syncInterval = parseInt(interval, 10);
    this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
  };

  /**
   * Method: getBackgroundSyncInterval
   *
   * Get the value of the sync interval when application is in the background
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getBackgroundSyncInterval = function () {
    return backgroundSyncInterval;
  };

  /**
   * Method: setBackgroundSyncInterval
   *
   * Set the value of the sync interval when the application is in the background
   *
   * Parameters:
   *   interval - sync interval in milliseconds
   *
   */
  RemoteStorage.prototype.setBackgroundSyncInterval = function (interval) {
    if(!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    var oldValue = backgroundSyncInterval;
    backgroundSyncInterval = parseInt(interval, 10);
    this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
  };

  /**
   * Method: getCurrentSyncInterval
   *
   * Get the value of the current sync interval
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getCurrentSyncInterval = function () {
    return isBackground ? backgroundSyncInterval : syncInterval;
  };

  var SyncError = function (originalError) {
    var msg = 'Sync failed: ';
    if (typeof(originalError) === 'object' && 'message' in originalError) {
      msg += originalError.message;
    } else {
      msg += originalError;
    }
    this.originalError = originalError;
    this.message = msg;
  };

  SyncError.prototype = new Error();
  SyncError.prototype.constructor = SyncError;

  RemoteStorage.SyncError = SyncError;

  RemoteStorage.prototype.syncCycle = function () {
    if (this.sync.stopped) {
      return;
    }

    this.sync.on('done', function () {
      RemoteStorage.log('[Sync] Sync done. Setting timer to', this.getCurrentSyncInterval());
      if (!this.sync.stopped) {
        if (this._syncTimer) {
          clearTimeout(this._syncTimer);
        }
        this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getCurrentSyncInterval());
      }
    }.bind(this));

    this.sync.sync();
  };

  RemoteStorage.prototype.stopSync = function () {
    if (this.sync) {
      RemoteStorage.log('[Sync] Stopping sync');
      this.sync.stopped = true;
    } else {
      // TODO When is this ever the case and what is syncStopped for then?
      RemoteStorage.log('[Sync] Will instantiate sync stopped');
      this.syncStopped = true;
    }
  };

  RemoteStorage.prototype.startSync = function () {
    this.sync.stopped = false;
    this.syncStopped = false;
    this.sync.sync();
  };

  var syncCycleCb;

  RemoteStorage.Sync._rs_init = function (remoteStorage) {
    syncCycleCb = function () {
      RemoteStorage.log('[Sync] syncCycleCb calling syncCycle');
      if (RemoteStorage.Env.isBrowser()) {
        handleVisibility.bind(remoteStorage)();
      }
      if (!remoteStorage.sync) {
        // Call this now that all other modules are also ready:
        remoteStorage.sync = new RemoteStorage.Sync(
            remoteStorage.local, remoteStorage.remote, remoteStorage.access,
            remoteStorage.caching);

        if (remoteStorage.syncStopped) {
          RemoteStorage.log('[Sync] Instantiating sync stopped');
          remoteStorage.sync.stopped = true;
          delete remoteStorage.syncStopped;
        }
      }

      RemoteStorage.log('[Sync] syncCycleCb calling syncCycle');
      remoteStorage.syncCycle();
    };

    remoteStorage.on('ready', syncCycleCb);
  };

  RemoteStorage.Sync._rs_cleanup = function (remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
  };

})(typeof(window) !== 'undefined' ? window : global);
