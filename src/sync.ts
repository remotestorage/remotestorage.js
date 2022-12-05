import type { RSNode, RSNodes } from './interfaces/rs_node';
import config from './config';
import Env from './env';
import EventHandling from './eventhandling';
import log from './log';
import Authorize from './authorize';
import SyncError from './sync-error';
import UnauthorizedError from './unauthorized-error';
import {
  applyMixins,
  deepClone,
  equal,
  isFolder,
  isDocument,
  pathsFromRoot
} from './util';

let syncCycleCb, syncOnConnect;

interface ResponseStatus {
  statusCode: string | number;
  successful: boolean | undefined;
  conflict: boolean | undefined;
  unAuth: boolean | undefined;
  notFound: boolean | undefined;
  changed: boolean | undefined;
  networkProblems: boolean | undefined;
}

interface SyncTask {
  action: any;
  path: string;
  promise: Promise<any>;
}

function taskFor (action, path: string, promise: Promise<any>): SyncTask {
  return { action, path, promise };
}

function nodeChanged (node: RSNode, etag: string): boolean {
  return node.common.revision !== etag &&
         (!node.remote || node.remote.revision !== etag);
}

function isStaleChild (node: RSNode): boolean {
  return node.remote && node.remote.revision && !node.remote.itemsMap && !node.remote.body;
}

function hasCommonRevision (node: RSNode): boolean {
  return node.common && node.common.revision;
}

function hasNoRemoteChanges (node: RSNode): boolean {
  if (node.remote && node.remote.revision &&
      node.remote.revision !== node.common.revision) {
    return false;
  }
  return (node.common.body === undefined && node.remote.body === false) ||
    (node.remote.body === node.common.body &&
     node.remote.contentType === node.common.contentType);
}

function mergeMutualDeletion (node: RSNode): RSNode {
  if (node.remote && node.remote.body === false &&
      node.local && node.local.body === false) {
    delete node.local;
  }
  return node;
}

function handleVisibility (env, rs): void {
  function handleChange (isForeground): void {
    const oldValue = rs.getCurrentSyncInterval();
    config.isBackground = !isForeground;
    const newValue = rs.getCurrentSyncInterval();
    rs._emit('sync-interval-change', {oldValue: oldValue, newValue: newValue});
  }
  env.on('background', () => handleChange(false));
  env.on('foreground', () => handleChange(true));
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
  // TODO remove when RS is defined, or if unnecessary
  rs: { [propName: string]: any };

  numThreads: number;
  done: boolean;
  stopped: boolean;

  // TODO define in more detail
  _tasks: object;
  _running: object;
  _timeStarted: object;
  _finishedTasks: Array<SyncTask> = [];

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

    this.rs.caching.onActivate((path: string): void => {
      this.addTask(path);
      this.doTasks();
    });

    this.addEvents(['done', 'req-done']);
  }

  public now (): number {
    return new Date().getTime();
  }

  public queueGetRequest (path: string): object {
    return new Promise((resolve, reject) => {
      if (!this.rs.remote.connected) {
        reject('cannot fulfill maxAge requirement - remote is not connected');
      } else if (!this.rs.remote.online) {
        reject('cannot fulfill maxAge requirement - remote is not online');
      } else {
        this.addTask(path, function (): void {
          this.rs.local.get(path).then(r => resolve(r));
        }.bind(this));

        this.doTasks();
      }
    });
  }

  // FIXME force02 sounds like rs spec 02, thus could be removed
  public corruptServerItemsMap (itemsMap, force02?: boolean): boolean {
    if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
      return true;
    }

    for (const itemName in itemsMap) {
      const item = itemsMap[itemName];

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

  public corruptItemsMap (itemsMap): boolean {
    if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
      return true;
    }

    for (const path in itemsMap) {
      if (typeof itemsMap[path] !== 'boolean') {
        return true;
      }
    }

    return false;
  }

  public corruptRevision (rev): boolean {
    return ((typeof(rev) !== 'object') ||
            (Array.isArray(rev)) ||
            (rev.revision && typeof(rev.revision) !== 'string') ||
            (rev.body && typeof(rev.body) !== 'string' && typeof(rev.body) !== 'object') ||
            (rev.contentType && typeof(rev.contentType) !== 'string') ||
            (rev.contentLength && typeof(rev.contentLength) !== 'number') ||
            (rev.timestamp && typeof(rev.timestamp) !== 'number') ||
            (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
  }

  public isCorrupt (node: RSNode): boolean {
    return ((typeof(node) !== 'object') ||
            (Array.isArray(node)) ||
            (typeof(node.path) !== 'string') ||
            (this.corruptRevision(node.common)) ||
            (node.local && this.corruptRevision(node.local)) ||
            (node.remote && this.corruptRevision(node.remote)) ||
            (node.push && this.corruptRevision(node.push)));
  }

  public hasTasks (): boolean {
    return Object.getOwnPropertyNames(this._tasks).length > 0;
  }

  public async collectDiffTasks (): Promise<number> {
    let num = 0;

    return this.rs.local.forAllNodes((node: RSNode) => {
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
    })
    .then((): number => num)
    .catch(e => { throw e; });
  }

  public inConflict (node: RSNode): boolean {
    return (node.local && node.remote &&
            (node.remote.body !== undefined || node.remote.itemsMap));
  }

  public needsRefresh (node: RSNode): boolean {
    if (node.common) {
      if (!node.common.timestamp) {
        return true;
      }
      return (this.now() - node.common.timestamp > config.syncInterval);
    }
    return false;
  }

  public needsFetch (node: RSNode): boolean {
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

  public needsPush (node: RSNode): boolean {
    if (this.inConflict(node)) {
      return false;
    }
    if (node.local && !node.push) {
      return true;
    }
  }

  public needsRemotePut (node: RSNode): boolean {
    return node.local && node.local.body;
  }

  public needsRemoteDelete (node: RSNode): boolean {
    return node.local && node.local.body === false;
  }

  public getParentPath (path: string): string {
    const parts = path.match(/^(.*\/)([^\/]+\/?)$/);

    if (parts) {
      return parts[1];
    } else {
      throw new Error('Not a valid path: "'+path+'"');
    }
  }

  public deleteChildPathsFromTasks (): void {
    for (const path in this._tasks) {
      const paths = pathsFromRoot(path);

      for (let i=1; i<paths.length; i++) {
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

  public async collectRefreshTasks (): Promise<void> {
    return this.rs.local.forAllNodes((node: RSNode) => {
      let parentPath: string;
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
    })
    .then(() => this.deleteChildPathsFromTasks())
    .catch((e: Error) => { throw e; });
  }

  public flush (nodes: RSNodes): RSNodes {
    for (const path in nodes) {
      // Strategy is 'FLUSH' and no local changes exist
      if (this.rs.caching.checkPath(path) === 'FLUSH' &&
          nodes[path] && !nodes[path].local) {
        log('[Sync] Flushing', path);
        nodes[path] = undefined; // Cause node to be flushed from cache
      }
    }
    return nodes;
  }

  public doTask (path: string): object {
    return this.rs.local.getNodes([path]).then((nodes: RSNodes) => {
      const node = nodes[path];
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
          let options;
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

  public autoMergeFolder (node: RSNode): RSNode {
    if (node.remote.itemsMap) {
      node.common = node.remote;
      delete node.remote;

      if (node.common.itemsMap) {
        for (const itemName in node.common.itemsMap) {
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

  public autoMergeDocument (node: RSNode): RSNode {
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

  public autoMerge (node: RSNode): RSNode {
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
            const change = {
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

  public async updateCommonTimestamp (path: string, revision: string): Promise<void> {
    return this.rs.local.getNodes([path]).then((nodes: RSNodes) => {
      if (nodes[path] &&
          nodes[path].common &&
          nodes[path].common.revision === revision) {
        nodes[path].common.timestamp = this.now();
      }
      return this.rs.local.setNodes(this.flush(nodes));
    });
  }

  public async markChildren (path, itemsMap, changedNodes: RSNodes, missingChildren): Promise<void> {
    const paths = [];
    const meta = {};
    const recurse = {};

    for (const item in itemsMap) {
      paths.push(path+item);
      meta[path+item] = itemsMap[item];
    }
    for (const childName in missingChildren) {
      paths.push(path+childName);
    }

    return this.rs.local.getNodes(paths).then((nodes: RSNodes) => {
      let cachingStrategy;
      let node;

      for (const nodePath in nodes) {
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
            for (const commonItem in node.common.itemsMap) {
              recurse[nodePath+commonItem] = true;
            }
          }

          if (node.local && node.local.itemsMap) {
            for (const localItem in node.local.itemsMap) {
              recurse[nodePath+localItem] = true;
            }
          }

          if (node.remote || isFolder(nodePath)) {
            changedNodes[nodePath] = undefined;
          } else {
            changedNodes[nodePath] = this.autoMerge(node);

            if (typeof changedNodes[nodePath] === 'undefined') {
              const parentPath = this.getParentPath(nodePath);
              const parentNode = changedNodes[parentPath];
              const itemName = nodePath.substring(path.length);
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

  public async deleteRemoteTrees (paths: Array<string>, changedNodes: RSNodes): Promise<RSNodes> {
    if (paths.length === 0) {
      return Promise.resolve(changedNodes);
    }

    return this.rs.local.getNodes(paths).then(async (nodes: RSNodes) => {
      const subPaths = {};

      function collectSubPaths (folder, path: string): void {
        if (folder && folder.itemsMap) {
          for (const itemName in folder.itemsMap) {
            subPaths[path+itemName] = true;
          }
        }
      }

      for (const path in nodes) {
        const node = nodes[path];

        // TODO Why check for the node here? I don't think this check ever applies
        if (!node) { continue; }

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

  public async completeFetch (path: string, bodyOrItemsMap: object, contentType: string, revision: string): Promise<any> {
    let paths: Array<string>;
    let parentPath: string;
    const pathsFromRootArr = pathsFromRoot(path);

    if (isFolder(path)) {
      paths = [path];
    } else {
      parentPath = pathsFromRootArr[1];
      paths = [path, parentPath];
    }

    return this.rs.local.getNodes(paths).then((nodes: RSNodes) => {
      let itemName: string;
      let node: RSNode = nodes[path];
      let parentNode: RSNode;
      const missingChildren = {};

      function collectMissingChildren (folder): void {
        if (folder && folder.itemsMap) {
          for (itemName in folder.itemsMap) {
            if (!bodyOrItemsMap[itemName]) {
              missingChildren[itemName] = true;
            }
          }
        }
      }

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

  public async completePush (path: string, action, conflict, revision: string): Promise<void> {
    return this.rs.local.getNodes([path]).then((nodes: RSNodes) => {
      const node = nodes[path];

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

  public async dealWithFailure (path: string): Promise<void> {
    return this.rs.local.getNodes([path]).then((nodes: RSNodes) => {
      if (nodes[path]) {
        delete nodes[path].push;
        return this.rs.local.setNodes(this.flush(nodes));
      }
    });
  }

  public interpretStatus (statusCode: string | number): ResponseStatus {
    const status: ResponseStatus = {
      statusCode:      statusCode,
      successful:      undefined,
      conflict:        undefined,
      unAuth:          undefined,
      notFound:        undefined,
      changed:         undefined,
      networkProblems: undefined
    };

    if (typeof statusCode === 'string' &&
        (statusCode === 'offline' || statusCode === 'timeout')) {
      status.successful = false;
      status.networkProblems = true;
      return status;
    } else if (typeof statusCode === 'number') {
      const series = Math.floor(statusCode / 100);

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
  }

  public async handleGetResponse (path: string, status: ResponseStatus, bodyOrItemsMap, contentType: string, revision: string): Promise<boolean> {
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

  public handleResponse (path: string, action, r): Promise<boolean> {
    const status = this.interpretStatus(r.statusCode);

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
      let error: Error;
      if (status.unAuth) {
        error = new UnauthorizedError();
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

  public finishTask (task: SyncTask, queueTask = true): void | Promise<void> {
    if (task.action === undefined) {
      delete this._running[task.path];
      return;
    }

    if (queueTask){
      log("[Sync] queue finished task:", task.path);
      this._finishedTasks.push(task);
      if (this._finishedTasks.length > 1) {
        log("[Sync] delaying finished task:", task.path);
        return;
      }
    }

    log("[Sync] run task:", task.path);

    return task.promise
      .then(res => {
        return this.handleResponse(task.path, task.action, res);
      }, err => {
        log('[Sync] wireclient rejects its promise!', task.path, task.action, err);
        return this.handleResponse(task.path, task.action, { statusCode: 'offline' });
      })
      .then(completed => {
        this._finishedTasks.shift();
        delete this._timeStarted[task.path];
        delete this._running[task.path];

        if (completed) {
          if (this._tasks[task.path]) {
            for (let i=0; i < this._tasks[task.path].length; i++) {
              this._tasks[task.path][i]();
            }
            delete this._tasks[task.path];
          }
        }

        this.rs._emit('sync-req-done');

        if (this._finishedTasks.length > 0) {
          this.finishTask(this._finishedTasks[0], false);
          return;
        }

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
        this._finishedTasks.shift();
        delete this._timeStarted[task.path];
        delete this._running[task.path];
        this.rs._emit('sync-req-done');
        if (this._finishedTasks.length > 0) {
          this.finishTask(this._finishedTasks[0], false);
          return;
        }
        if (!this.done) {
          this.done = true;
          this.rs._emit('sync-done');
        }
      });
  }

  public doTasks (): boolean {
    let numToHave: number, numAdded = 0, path: string;
    if (this.rs.remote.connected) {
      if (this.rs.remote.online) {
        numToHave = this.numThreads;
      } else {
        numToHave = 1;
      }
    } else {
      numToHave = 0;
    }
    const numToAdd = numToHave - Object.getOwnPropertyNames(this._running).length;
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

  public async collectTasks (alsoCheckRefresh?: boolean): Promise<void> {
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

  public addTask (path: string, cb?): void {
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
  public sync (): Promise<void> {
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

  static _rs_init (remoteStorage): void {
    syncCycleCb = function (): void {
      // if (!config.cache) return false
      log('[Sync] syncCycleCb calling syncCycle');

      const env = new Env();
      if (env.isBrowser()) { handleVisibility(env, remoteStorage); }

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

    syncOnConnect = function (): void {
      remoteStorage.removeEventListener('connected', syncOnConnect);
      remoteStorage.startSync();
    };

    remoteStorage.on('ready', syncCycleCb);
    remoteStorage.on('connected', syncOnConnect);
  }

  static _rs_cleanup (remoteStorage): void {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
    remoteStorage.removeEventListener('connected', syncOnConnect);

    remoteStorage.sync = undefined;
    delete remoteStorage.sync;
  }
}

interface Sync extends EventHandling {}
applyMixins(Sync, [EventHandling]);

export = Sync;
