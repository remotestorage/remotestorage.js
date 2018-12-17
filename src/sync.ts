const { isFolder, isDocument, equal, deepClone, pathsFromRoot } = require('./util');
const Env = require('./env');
const eventHandling = require('./eventhandling');
const log = require('./log');
const Authorize = require('./authorize');
const config = require('./config');

let syncCycleCb, syncOnConnect;

function taskFor (action, path, promise) {
  return {
    action:  action,
    path:    path,
    promise: promise
  };
}

function nodeChanged (node, etag) {
  return node.common.revision !== etag &&
         (!node.remote || node.remote.revision !== etag);
}

function isStaleChild (node) {
  return node.remote && node.remote.revision && !node.remote.itemsMap && !node.remote.body;
}

function hasCommonRevision (node) {
  return node.common && node.common.revision;
}

function hasNoRemoteChanges (node) {
  if (node.remote && node.remote.revision &&
      node.remote.revision !== node.common.revision) {
    return false;
  }
  return (node.common.body === undefined && node.remote.body === false) ||
    (node.remote.body === node.common.body &&
     node.remote.contentType === node.common.contentType);
}

function mergeMutualDeletion (node) {
  if (node.remote && node.remote.body === false &&
      node.local && node.local.body === false) {
    delete node.local;
  }
  return node;
}

function handleVisibility (rs) {
  function handleChange(isForeground) {
    var oldValue, newValue;
    oldValue = rs.getCurrentSyncInterval();
    config.isBackground = !isForeground;
    newValue = rs.getCurrentSyncInterval();
    rs._emit('sync-interval-change', {oldValue: oldValue, newValue: newValue});
  }
  Env.on('background', () => handleChange(false));
  Env.on('foreground', () => handleChange(true));
}

/**
 * Class: RemoteStorage.Sync
 *
 * This class basically does six things:
 *
 * - retrieve the remote version of relevant documents and folders
 * - add all local and remote documents together into one tree
 * - push local documents out if they don't exist remotely
 * - push local changes out to remote documents (conditionally, to avoid race
 *   conditions where both have changed)
 * - adopt the local version of a document to its remote version if both exist
 *   and they differ
 * - delete the local version of a document if it was deleted remotely
 * - if any GET requests were waiting for remote data, resolve them once this
 *   data comes in.
 *
 * It does this using requests to documents and folders. Whenever a folder GET
 * comes in, it gives information about all the documents it contains (this is
 * the `markChildren` function).
 **/
class Sync {
  rs: { [propName: string]: any }

  numThreads: number
  done: boolean
  stopped: boolean

  _tasks: object
  _running: object
  _timeStarted: object

  constructor (remoteStorage: object) {
    this.rs = remoteStorage;

    this._tasks       = {};
    this._running     = {};
    this._timeStarted = {};

    this.numThreads = 10;

    this.rs.local.onDiff(path => {
      this.addTask(path);
      this.doTasks();
    });

    this.rs.caching.onActivate(path => {
      this.addTask(path);
      this.doTasks();
    });

    eventHandling(this, 'done', 'req-done');
  }

  public now () {
    return new Date().getTime();
  }

  public queueGetRequest (path) {
    return new Promise((resolve, reject) => {
      if (!this.rs.remote.connected) {
        reject('cannot fulfill maxAge requirement - remote is not connected');
      } else if (!this.rs.remote.online) {
        reject('cannot fulfill maxAge requirement - remote is not online');
      } else {
        this.addTask(path, function () {
          this.rs.local.get(path).then(function (r) {
            return resolve(r);
          });
        }.bind(this));

        this.doTasks();
      }
    });
  }

  // FIXME force02 sounds like rs spec 02, thus could be removed
  public corruptServerItemsMap (itemsMap, force02?: boolean) {
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
  }

  public corruptItemsMap (itemsMap) {
    if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
      return true;
    }

    for (var itemName in itemsMap) {
      if (typeof(itemsMap[itemName]) !== 'boolean') {
        return true;
      }
    }

    return false;
  }

  public corruptRevision (rev) {
    return ((typeof(rev) !== 'object') ||
            (Array.isArray(rev)) ||
            (rev.revision && typeof(rev.revision) !== 'string') ||
            (rev.body && typeof(rev.body) !== 'string' && typeof(rev.body) !== 'object') ||
            (rev.contentType && typeof(rev.contentType) !== 'string') ||
            (rev.contentLength && typeof(rev.contentLength) !== 'number') ||
            (rev.timestamp && typeof(rev.timestamp) !== 'number') ||
            (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
  }

  public isCorrupt (node) {
    return ((typeof(node) !== 'object') ||
            (Array.isArray(node)) ||
            (typeof(node.path) !== 'string') ||
            (this.corruptRevision(node.common)) ||
            (node.local && this.corruptRevision(node.local)) ||
            (node.remote && this.corruptRevision(node.remote)) ||
            (node.push && this.corruptRevision(node.push)));
  }

  public hasTasks () {
    return Object.getOwnPropertyNames(this._tasks).length > 0;
  }

  public collectDiffTasks () {
    var num = 0;

    return this.rs.local.forAllNodes(node => {
      if (num > 100) { return; }

      if (this.isCorrupt(node)) {
        log('[Sync] WARNING: corrupt node in local cache', node);
        if (typeof(node) === 'object' && node.path) {
          this.addTask(node.path);
          num++;
        }
      } else if (this.needsFetch(node) && this.rs.access.checkPathPermission(node.path, 'r')) {
        this.addTask(node.path);
        num++;
      } else if (isDocument(node.path) && this.needsPush(node) &&
                 this.rs.access.checkPathPermission(node.path, 'rw')) {
        this.addTask(node.path);
        num++;
      }
    }).then(function () {
      return num;
    }, function (err) {
      throw err;
    });
  }

  public inConflict (node) {
    return (node.local && node.remote &&
            (node.remote.body !== undefined || node.remote.itemsMap));
  }

  public needsRefresh (node) {
    if (node.common) {
      if (!node.common.timestamp) {
        return true;
      }
      return (this.now() - node.common.timestamp > config.syncInterval);
    }
    return false;
  }

  public needsFetch (node) {
    if (this.inConflict(node)) {
      return true;
    }
    if (node.common &&
        node.common.itemsMap === undefined &&
        node.common.body === undefined) {
      return true;
    }
    if (node.remote &&
        node.remote.itemsMap === undefined &&
        node.remote.body === undefined) {
      return true;
    }
    return false;
  }

  public needsPush (node) {
    if (this.inConflict(node)) {
      return false;
    }
    if (node.local && !node.push) {
      return true;
    }
  }

  public needsRemotePut (node) {
    return node.local && node.local.body;
  }

  public needsRemoteDelete (node) {
    return node.local && node.local.body === false;
  }

  public getParentPath (path) {
    var parts = path.match(/^(.*\/)([^\/]+\/?)$/);

    if (parts) {
      return parts[1];
    } else {
      throw new Error('Not a valid path: "'+path+'"');
    }
  }

  public deleteChildPathsFromTasks () {
    for (var path in this._tasks) {
      var paths = pathsFromRoot(path);

      for (var i=1; i<paths.length; i++) {
        if (this._tasks[paths[i]]) {
          // move pending promises to parent task
          if (Array.isArray(this._tasks[path]) && this._tasks[path].length) {
            Array.prototype.push.apply(
              this._tasks[paths[i]],
              this._tasks[path]
            );
          }
          delete this._tasks[path];
        }
      }
    }
  }

  public collectRefreshTasks () {
    return this.rs.local.forAllNodes(node => {
      var parentPath;
      if (this.needsRefresh(node)) {
        try {
          parentPath = this.getParentPath(node.path);
        } catch(e) {
          // node.path is already '/', can't take parentPath
        }
        if (parentPath && this.rs.access.checkPathPermission(parentPath, 'r')) {
          this.addTask(parentPath);
        } else if (this.rs.access.checkPathPermission(node.path, 'r')) {
          this.addTask(node.path);
        }
      }
    }).then(() => { this.deleteChildPathsFromTasks(); },
            err => { throw err; });
  }

  public flush (nodes) {
    for (var path in nodes) {
      // Strategy is 'FLUSH' and no local changes exist
      if (this.rs.caching.checkPath(path) === 'FLUSH' &&
          nodes[path] && !nodes[path].local) {
        log('[Sync] Flushing', path);
        nodes[path] = undefined; // Cause node to be flushed from cache
      }
    }
    return nodes;
  }

  public doTask (path) {
    return this.rs.local.getNodes([path]).then(nodes => {
      var node = nodes[path];
      // First fetch:
      if (typeof(node) === 'undefined') {
        return taskFor('get', path, this.rs.remote.get(path));
      }
      // Fetch known-stale child:
      else if (isStaleChild(node)) {
        return taskFor('get', path, this.rs.remote.get(path));
      }
      // Push PUT:
      else if (this.needsRemotePut(node)) {
        node.push = deepClone(node.local);
        node.push.timestamp = this.now();

        return this.rs.local.setNodes(this.flush(nodes)).then(() => {
          var options;
          if (hasCommonRevision(node)) {
            options = { ifMatch: node.common.revision };
          } else {
            // Initial PUT (fail if something is already there)
            options = { ifNoneMatch: '*' };
          }

          return taskFor('put', path,
            this.rs.remote.put(path, node.push.body, node.push.contentType, options)
          );
        });
      }
      // Push DELETE:
      else if (this.needsRemoteDelete(node)) {
        node.push = { body: false, timestamp: this.now() };

        return this.rs.local.setNodes(this.flush(nodes)).then(() => {
          if (hasCommonRevision(node)) {
            return taskFor('delete', path,
              this.rs.remote.delete(path, { ifMatch: node.common.revision })
            );
          } else { // Ascertain current common or remote revision first
            return taskFor('get', path, this.rs.remote.get(path));
          }
        });
      }
      // Conditional refresh:
      else if (hasCommonRevision(node)) {
        return taskFor('get', path,
          this.rs.remote.get(path, { ifNoneMatch: node.common.revision })
        );
      }
      else {
        return taskFor('get', path, this.rs.remote.get(path));
      }
    });
  }

  public autoMergeFolder (node) {
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
  }

  public autoMergeDocument (node) {
    if (hasNoRemoteChanges(node)) {
      node = mergeMutualDeletion(node);
      delete node.remote;
    } else if (node.remote.body !== undefined) {
      // keep/revert:
      log('[Sync] Emitting keep/revert');

      this.rs.local._emitChange({
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
  }

  public autoMerge (node) {
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
              this.rs.local._emitChange(change);
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
        this.rs.local._emitChange({
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
  }

  public updateCommonTimestamp (path, revision) {
    return this.rs.local.getNodes([path]).then(nodes => {
      if (nodes[path] &&
          nodes[path].common &&
          nodes[path].common.revision === revision) {
        nodes[path].common.timestamp = this.now();
      }
      return this.rs.local.setNodes(this.flush(nodes));
    });
  }

  public markChildren (path, itemsMap, changedNodes, missingChildren) {
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

    return this.rs.local.getNodes(paths).then(nodes => {
      var cachingStrategy;
      var node;

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
            cachingStrategy = this.rs.caching.checkPath(nodePath);
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

      return this.deleteRemoteTrees(Object.keys(recurse), changedNodes)
        .then(changedObjs2 => {
          return this.rs.local.setNodes(this.flush(changedObjs2));
        });
    });
  }

  public deleteRemoteTrees (paths, changedNodes) {
    if (paths.length === 0) {
      return Promise.resolve(changedNodes);
    }

    return this.rs.local.getNodes(paths).then(nodes => {
      var subPaths = {};

      var collectSubPaths = function (folder, path) {
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
      return this.deleteRemoteTrees(Object.keys(subPaths), changedNodes)
        .then(changedNodes2 => {
          return this.rs.local.setNodes(this.flush(changedNodes2));
        });
    });
  }

  public completeFetch (path, bodyOrItemsMap, contentType, revision) {
    var paths;
    var parentPath;
    var pathsFromRootArr = pathsFromRoot(path);

    if (isFolder(path)) {
      paths = [path];
    } else {
      parentPath = pathsFromRootArr[1];
      paths = [path, parentPath];
    }

    return this.rs.local.getNodes(paths).then(nodes => {
      var itemName;
      var missingChildren = {};
      var node = nodes[path];
      var parentNode;

      var collectMissingChildren = function (folder) {
        if (folder && folder.itemsMap) {
          for (itemName in folder.itemsMap) {
            if (!bodyOrItemsMap[itemName]) {
              missingChildren[itemName] = true;
            }
          }
        }
      };

      if (typeof(node) !== 'object'  ||
          node.path !== path ||
          typeof(node.common) !== 'object') {
        node = { path: path, common: {} };
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
    });
  }

  public completePush (path, action, conflict, revision) {
    return this.rs.local.getNodes([path]).then(nodes => {
      var node = nodes[path];

      if (!node.push) {
        this.stopped = true;
        throw new Error('completePush called but no push version!');
      }

      if (conflict) {
        log('[Sync] We have a conflict');

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

      return this.rs.local.setNodes(this.flush(nodes));
    });
  }

  public dealWithFailure (path) {
    return this.rs.local.getNodes([path]).then(nodes => {
      if (nodes[path]) {
        delete nodes[path].push;
        return this.rs.local.setNodes(this.flush(nodes));
      }
    });
  }

  public interpretStatus (statusCode) {
    const status = {
      statusCode:      statusCode,
      successful:      undefined,
      conflict:        undefined,
      unAuth:          undefined,
      notFound:        undefined,
      changed:         undefined,
      networkProblems: undefined
    }

    if (statusCode === 'offline' || statusCode === 'timeout') {
      status.successful = false;
      status.networkProblems = true;
      return status;
    }

    let series = Math.floor(statusCode / 100);

    status.successful = (series === 2 ||
                         statusCode === 304 ||
                         statusCode === 412 ||
                         statusCode === 404),
    status.conflict   = (statusCode === 412);
    status.unAuth     = ((statusCode === 401 && this.rs.remote.token !== Authorize.IMPLIED_FAKE_TOKEN) ||
                         statusCode === 402 ||
                         statusCode === 403);
    status.notFound   = (statusCode === 404);
    status.changed    = (statusCode !== 304);

    return status;
  }

  public handleGetResponse (path, status, bodyOrItemsMap, contentType, revision) {
    if (status.notFound) {
      if (isFolder(path)) {
        bodyOrItemsMap = {};
      } else {
        bodyOrItemsMap = false;
      }
    }

    if (status.changed) {
      return this.completeFetch(path, bodyOrItemsMap, contentType, revision)
        .then(dataFromFetch => {
          if (isFolder(path)) {
            if (this.corruptServerItemsMap(bodyOrItemsMap)) {
              log('[Sync] WARNING: Discarding corrupt folder description from server for ' + path);
              return false;
            } else {
              return this.markChildren(path, bodyOrItemsMap, dataFromFetch.toBeSaved, dataFromFetch.missingChildren)
                .then(() => { return true; });
            }
          } else {
            return this.rs.local.setNodes(this.flush(dataFromFetch.toBeSaved))
              .then(() => { return true; });
          }
        });
    } else {
      return this.updateCommonTimestamp(path, revision)
        .then(() => { return true; });
    }
  }

  public handleResponse (path, action, r) {
    var status = this.interpretStatus(r.statusCode);

    if (status.successful) {
      if (action === 'get') {
        return this.handleGetResponse(path, status, r.body, r.contentType, r.revision);
      } else if (action === 'put' || action === 'delete') {
        return this.completePush(path, action, status.conflict, r.revision).then(function () {
          return true;
        });
      } else {
        throw new Error(`cannot handle response for unknown action ${action}`);
      }
    } else {
    // Unsuccessful
      var error;
      if (status.unAuth) {
        error = new Authorize.Unauthorized();
      } else if (status.networkProblems) {
        error = new SyncError('Network request failed.');
      } else {
        error = new Error('HTTP response code ' + status.statusCode + ' received.');
      }

      return this.dealWithFailure(path).then(() => {
        this.rs._emit('error', error);
        throw error;
      });
    }
  }

  public finishTask (task) {
    if (task.action === undefined) {
      delete this._running[task.path];
      return;
    }

    return task.promise
      .then(res => {
        return this.handleResponse(task.path, task.action, res);
      }, err => {
        log('[Sync] wireclient rejects its promise!', task.path, task.action, err);
        return this.handleResponse(task.path, task.action, { statusCode: 'offline' });
      })
      .then(completed => {
        delete this._timeStarted[task.path];
        delete this._running[task.path];

        if (completed) {
          if (this._tasks[task.path]) {
            for (var i=0; i < this._tasks[task.path].length; i++) {
              this._tasks[task.path][i]();
            }
            delete this._tasks[task.path];
          }
        }

        this.rs._emit('sync-req-done');

        this.collectTasks(false).then(() => {
          // See if there are any more tasks that are not refresh tasks
          if (!this.hasTasks() || this.stopped) {
            log('[Sync] Sync is done! Reschedule?', Object.getOwnPropertyNames(this._tasks).length, this.stopped);
            if (!this.done) {
              this.done = true;
              this.rs._emit('sync-done');
            }
          } else {
            // Use a 10ms timeout to let the JavaScript runtime catch its breath
            // (and hopefully force an IndexedDB auto-commit?), and also to cause
            // the threads to get staggered and get a good spread over time:
            setTimeout(() => { this.doTasks(); }, 10);
          }
        });
      }, err => {
        log('[Sync] Error', err);
        delete this._timeStarted[task.path];
        delete this._running[task.path];
        this.rs._emit('sync-req-done');
        if (!this.done) {
          this.done = true;
          this.rs._emit('sync-done');
        }
      });
  }

  public doTasks () {
    let numToHave, numAdded = 0, numToAdd, path;
    if (this.rs.remote.connected) {
      if (this.rs.remote.online) {
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
        this._timeStarted[path] = this.now();
        this._running[path] = this.doTask(path);
        this._running[path].then(this.finishTask.bind(this));
        numAdded++;
        if (numAdded >= numToAdd) {
          return true;
        }
      }
    }
    return (numAdded >= numToAdd);
  }

  public collectTasks (alsoCheckRefresh?: boolean) {
    if (this.hasTasks() || this.stopped) {
      return Promise.resolve();
    }

    return this.collectDiffTasks().then(numDiffs => {
      if (numDiffs || alsoCheckRefresh === false) {
        return Promise.resolve();
      } else {
        return this.collectRefreshTasks();
      }
    }, function (err) { throw err; });
  }

  public addTask (path, cb?) {
    if (!this._tasks[path]) {
      this._tasks[path] = [];
    }
    if (typeof(cb) === 'function') {
      this._tasks[path].push(cb);
    }
  }

  /**
   * Method: sync
   **/
  public sync () {
    this.done = false;

    if (!this.doTasks()) {
      return this.collectTasks().then(() => {
        try {
          this.doTasks();
        } catch(e) {
          log('[Sync] doTasks error', e);
        }
      }, function (e) {
        log('[Sync] Sync error', e);
        throw new Error('Local cache unavailable');
      });
    } else {
      return Promise.resolve();
    }
  }

  static _rs_init (remoteStorage) {
    syncCycleCb = function () {
      // if (!config.cache) return false
      log('[Sync] syncCycleCb calling syncCycle');
      if (Env.isBrowser()) { handleVisibility(remoteStorage); }

      if (!remoteStorage.sync) {
        // Call this now that all other modules are also ready:
        remoteStorage.sync = new Sync(remoteStorage);

        if (remoteStorage.syncStopped) {
          log('[Sync] Instantiating sync stopped');
          remoteStorage.sync.stopped = true;
          delete remoteStorage.syncStopped;
        }
      }

      log('[Sync] syncCycleCb calling syncCycle');
      remoteStorage.syncCycle();
    };

    syncOnConnect = function() {
      remoteStorage.removeEventListener('connected', syncOnConnect);
      remoteStorage.startSync();
    };

    remoteStorage.on('ready', syncCycleCb);
    remoteStorage.on('connected', syncOnConnect);
  }

  static _rs_cleanup (remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
    remoteStorage.removeEventListener('connected', syncOnConnect);

    remoteStorage.sync = undefined;
    delete remoteStorage.sync;
  }
};

class SyncError extends Error {
  originalError: Error

  constructor (originalError) {
    super()
    this.name = 'SyncError';
    let msg = 'Sync failed: ';
    if (typeof(originalError) === 'object' && 'message' in originalError) {
      msg += originalError.message;
      this.stack = originalError.stack;
      this.originalError = originalError;
    } else {
      msg += originalError;
    }
    this.message = msg;
  }
}

module.exports = Sync;
