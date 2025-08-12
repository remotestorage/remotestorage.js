import type RemoteStorage from './remotestorage';
import type { RSItem, RSNode, RSNodes } from './interfaces/rs_node';
import type { QueuedRequestResponse } from './interfaces/queued_request_response';
import type { RemoteResponse } from './remote';
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

let setupSync, syncOnConnect;

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
  action: "get" | "put" | "delete";
  path: string;
  promise: Promise<RemoteResponse>;
}

function taskFor (action: SyncTask["action"], path: SyncTask["path"], promise: SyncTask["promise"]): SyncTask {
  return { action, path, promise };
}

function nodeChanged (node: RSNode, etag: string): boolean {
  return node.common.revision !== etag &&
         (!node.remote || node.remote.revision !== etag);
}

function isStaleChild (node: RSNode): boolean {
  return !!node.remote && !!node.remote.revision &&
         !node.remote.itemsMap && !node.remote.body;
}

function hasCommonRevision (node: RSNode): boolean {
  return !!node.common && !!node.common.revision;
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
 */
export class Sync {
  rs: RemoteStorage;

  /**
   * Maximum number of parallel requests to execute
   */
  numThreads: number = 10;

  /**
   * Sync done? `false` when periodic sync is currently running
   */
  done: boolean;

  /**
   * Sync stopped entirely
   */
  stopped: boolean;

  /**
   * Paths queued for sync, sometimes with callbacks
   */
  _tasks: { [key: string]: Array<() => void>; } = {};

  /**
   * Promises of currently running sync tasks per path
   */
  _running: { [key: string]: Promise<SyncTask>; } = {};

  /**
   * Start times of current sync per path
   */
  _timeStarted: { [key: string]: number; } = {};

  /**
   * Holds finished tasks for orderly processing
   */
  _finishedTasks: SyncTask[] = [];

  constructor (remoteStorage: RemoteStorage) {
    this.rs = remoteStorage;

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

  /**
   * Return current time
   */
  now (): number {
    return new Date().getTime();
  }

  /**
   * When getting a path from the caching layer, this function might be handed
   * in to first check if it was updated on the remote, in order to fulfill a
   * maxAge requirement
   */
  async queueGetRequest (path: string): Promise<QueuedRequestResponse> {
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

  corruptServerItemsMap (itemsMap): boolean {
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
      }
    }

    return false;
  }

  corruptItemsMap (itemsMap): boolean {
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

  corruptRevision (rev): boolean {
    return ((typeof(rev) !== 'object') ||
            (Array.isArray(rev)) ||
            (rev.revision && typeof(rev.revision) !== 'string') ||
            (rev.body && typeof(rev.body) !== 'string' && typeof(rev.body) !== 'object') ||
            (rev.contentType && typeof(rev.contentType) !== 'string') ||
            (rev.contentLength && typeof(rev.contentLength) !== 'number') ||
            (rev.timestamp && typeof(rev.timestamp) !== 'number') ||
            (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
  }

  isCorrupt (node: RSNode): boolean {
    return ((typeof(node) !== 'object') ||
            (Array.isArray(node)) ||
            (typeof(node.path) !== 'string') ||
            (this.corruptRevision(node.common)) ||
            (node.local && this.corruptRevision(node.local)) ||
            (node.remote && this.corruptRevision(node.remote)) ||
            (node.push && this.corruptRevision(node.push)));
  }

  hasTasks (): boolean {
    return Object.keys(this._tasks).length > 0;
  }

  /**
   * Collect sync tasks for changed nodes
   */
  async collectDiffTasks (): Promise<number> {
    let num = 0;

    return this.rs.local.forAllNodes((node: RSNode) => {
      if (num > 100) { return; }

      if (this.isCorrupt(node)) {
        log('[Sync] WARNING: corrupt node in local cache', node);
        if (typeof(node) === 'object' && node.path) {
          this.addTask(node.path);
          num++;
        }
      } else if (this.needsFetch(node) &&
                 this.rs.access.checkPathPermission(node.path, 'r')) {
        this.addTask(node.path);
        num++;
      } else if (isDocument(node.path) && this.needsPush(node) &&
                 this.rs.access.checkPathPermission(node.path, 'rw')) {
        this.addTask(node.path);
        num++;
      }
    })
    .then((): number => num);
  }

  inConflict (node: RSNode): boolean {
    return (!!node.local && !!node.remote &&
            (node.remote.body !== undefined || !!node.remote.itemsMap));
  }

  needsRefresh (node: RSNode): boolean {
    if (node.common) {
      if (!node.common.timestamp) {
        return true;
      }
      return (this.now() - node.common.timestamp > config.syncInterval);
    }
    return false;
  }

  needsFetch (node: RSNode): boolean {
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

  needsPush (node: RSNode): boolean {
    if (this.inConflict(node)) {
      return false;
    }
    if (node.local && !node.push) {
      return true;
    }
  }

  needsRemotePut (node: RSNode): boolean {
    return node.local && typeof(node.local.body) === "string";
  }

  needsRemoteDelete (node: RSNode): boolean {
    return node.local && node.local.body === false;
  }

  getParentPath (path: string): string {
    const parts = path.match(/^(.*\/)([^\/]+\/?)$/);

    if (parts) {
      return parts[1];
    } else {
      throw new Error('Not a valid path: "'+path+'"');
    }
  }

  deleteChildPathsFromTasks (): void {
    for (const path in this._tasks) {
      const paths = pathsFromRoot(path);

      for (let i=1; i < paths.length; i++) {
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

  /**
   * Collect tasks to refresh highest outdated folder in tree
   */
  async collectRefreshTasks (): Promise<void> {
    await this.rs.local.forAllNodes((node: RSNode) => {
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
    });

    this.deleteChildPathsFromTasks();
  }

  /**
   * Flush nodes from cache after sync to remote
   */
  flush (nodes: RSNodes): RSNodes {
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

  /**
   * Sync one path
   */
  async doTask (path: string): Promise<SyncTask> {
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
            this.rs.remote.put(
              path,
              node.push.body as string, // TODO string | ArrayBuffer?
              node.push.contentType,
              options
            )
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

  /**
   * Merge/process folder node items after updates from remote
   */
  autoMergeFolder (node: RSNode): RSNode {
    if (node.remote.itemsMap) {
      node.common = node.remote;
      delete node.remote;

      if (node.common.itemsMap) {
        for (const itemName in node.common.itemsMap) {
          if (!node.local.itemsMap[itemName]) {
            // Indicates the node is either newly being fetched, or
            // has been deleted locally (whether or not leading to
            // conflict); before listing it in local listings, check
            // if a local deletion exists.
            node.local.itemsMap[itemName] = false;
          }
        }

        for (const itemName in node.local.itemsMap) {
          if (!node.common.itemsMap[itemName]) {
            // When an item appears in a folder's local itemsMap, but
            // not in remote/common, it may or may not have been
            // changed or deleted locally. The local itemsMap may
            // only contain it, beause the item existed when
            // *another* local item was changed, so we need to make
            // sure that it's checked/processed again, so it will be
            // deleted if there's no local change waiting to be
            // pushed out.
            this.addTask(node.path+itemName);
          }
        }

        if (equal(node.local.itemsMap, node.common.itemsMap)) {
          delete node.local;
        }
      }
    }
    return node;
  }

  /**
   * Merge/process document node items after updates from remote
   */
  autoMergeDocument (node: RSNode): RSNode {
    if (hasNoRemoteChanges(node)) {
      node = mergeMutualDeletion(node);
      delete node.remote;
    } else if (node.remote.body !== undefined) {
      if (node.remote.body === false && node.local?.body === false) {
        // Deleted on both sides, nothing to do
      } else {
        log('[Sync] Emitting conflict event');
        setTimeout(this.rs.local.emitChange.bind(this.rs.local), 10, {
          origin:          'conflict',
          path:            node.path,
          oldValue:        node.local.body,
          newValue:        node.remote.body,
          lastCommonValue: node.common.body,
          oldContentType:  node.local.contentType,
          newContentType:  node.remote.contentType,
          lastCommonContentType: node.common.contentType
        });
      }

      if (node.remote.body === false) {
        node.common = {};
      } else {
        node.common = node.remote;
      }
      delete node.remote;
      delete node.local;
    }

    return node;
  }

  /**
   * Merge/process node items after various updates from remote
   */
  autoMerge (node: RSNode): RSNode {
    if (!node.remote) {
      if (node.common.body) {
        this.rs.local.emitChange({
          origin:   'remote',
          path:     node.path,
          oldValue: node.common.body,
          newValue: undefined,
          oldContentType: node.common.contentType,
          newContentType: undefined
        });
      }
      return;
    }

    // Local changes
    if (node.local) {
      if (isFolder(node.path)) {
        return this.autoMergeFolder(node);
      } else {
        return this.autoMergeDocument(node);
      }
    }

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

        if (change.oldValue !== undefined || change.newValue !== undefined) {
          this.rs.local.emitChange(change);
        }

        if (node.remote.body === false) {
          return; // no remote, so delete
        }

        node.common = node.remote;
        delete node.remote;
      }
    }

    return node;
  }

  async updateCommonTimestamp (path: string, revision: string): Promise<void> {
    return this.rs.local.getNodes([path]).then((nodes: RSNodes) => {
      if (nodes[path] &&
          nodes[path].common &&
          nodes[path].common.revision === revision) {
        nodes[path].common.timestamp = this.now();
      }
      return this.rs.local.setNodes(this.flush(nodes));
    });
  }

  /**
   * After successful GET of a folder, mark its children/items for
   * changes and further processing
   */
  async markChildren (path: string, itemsMap: RSItem["itemsMap"], changedNodes: RSNodes, missingChildren: { [key: string]: boolean }): Promise<void> {
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

    const nodes = await this.rs.local.getNodes(paths);

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

    const changedNodes2 = await this.markRemoteDeletions(Object.keys(recurse), changedNodes);
    if (changedNodes2) {
      await this.rs.local.setNodes(this.flush(changedNodes2));
    }
  }

  /**
   * Recursively process paths to mark documents as remotely deleted
   * where applicable
   */
  async markRemoteDeletions (paths: string[], changedNodes: RSNodes): Promise<RSNodes | void> {
    if (paths.length === 0) { return changedNodes; }

    const nodes = await this.rs.local.getNodes(paths);
    const subPaths = {};

    function collectSubPaths (folder: RSItem, path: string): void {
      if (folder && folder.itemsMap) {
        for (const itemName in folder.itemsMap) {
          subPaths[path+itemName] = true;
        }
      }
    }

    for (const path in nodes) {
      const node = nodes[path];
      if (!node) { continue; }

      if (isFolder(path)) {
        collectSubPaths(node.common, path);
        collectSubPaths(node.local, path);
      } else {
        if (node.common && typeof(node.common.body) !== 'undefined') {
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
    const changedNodes2 = await this.markRemoteDeletions(Object.keys(subPaths), changedNodes);
    if (changedNodes2) {
      await this.rs.local.setNodes(this.flush(changedNodes2));
    }
  }

  /**
   * Complete a successful GET request
   */
  async completeFetch (path: string, bodyOrItemsMap: RSItem["body"], contentType: string, revision: string): Promise<any> {
    let paths: string[];
    let parentPath: string;
    const pathsFromRootArr = pathsFromRoot(path);

    if (isFolder(path)) {
      paths = [path];
    } else {
      parentPath = pathsFromRootArr[1];
      paths = [path, parentPath];
    }

    const nodes = await this.rs.local.getNodes(paths);
    const parentNode: RSNode = nodes[parentPath];
    const missingChildren = {};
    let node: RSNode = nodes[path];
    let itemName: string;

    function collectMissingChildren (folder): void {
      if (folder && folder.itemsMap) {
        for (itemName in folder.itemsMap) {
          if (!bodyOrItemsMap[itemName]) {
            missingChildren[itemName] = true;
          }
        }
      }
    }

    if (typeof(node) !== 'object' ||
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
      for (itemName in bodyOrItemsMap as RSItem["itemsMap"]) {
        node.remote.itemsMap[itemName] = true;
      }
    } else {
      node.remote.body = bodyOrItemsMap;
      node.remote.contentType = contentType;

      if (parentNode && parentNode.local && parentNode.local.itemsMap) {
        itemName = path.substring(parentPath.length);

        if (bodyOrItemsMap !== false) {
          parentNode.local.itemsMap[itemName] = true;
        } else {
          if (parentNode.local.itemsMap[itemName]) {
            // node is 404 on remote, can safely be removed from
            // parent's local itemsMap now
            delete parentNode.local.itemsMap[itemName];
          }
        }

        if (equal(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
          delete parentNode.local;
        }
      }
    }

    nodes[path] = this.autoMerge(node);

    return { toBeSaved: nodes, missingChildren };
  }

  /**
   * Handle successful PUT or DELETE request
   */
  async completePush (path: string, action: "put" | "delete", conflict: boolean, revision: string): Promise<void> {
    const nodes = await this.rs.local.getNodes([path]);
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

    await this.rs.local.setNodes(this.flush(nodes));
  }

  /**
   * Remove push item from cached nodes that failed to sync
   */
  async dealWithFailure (path: string): Promise<void> {
    const nodes = await this.rs.local.getNodes([path]);

    if (nodes[path]) {
      delete nodes[path].push;
      return this.rs.local.setNodes(this.flush(nodes));
    }
  }

  interpretStatus (statusCode: string | number): ResponseStatus {
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

  /**
   * Handle successful GET request
   */
  async handleGetResponse (path: string, status: ResponseStatus, bodyOrItemsMap: RSItem["body"], contentType: string, revision: string): Promise<boolean> {
    if (status.notFound) {
      bodyOrItemsMap = isFolder(path) ? {} : false;
    }

    if (status.changed) {
      const data = await this.completeFetch(path, bodyOrItemsMap, contentType, revision);

      if (isFolder(path)) {
        if (this.corruptServerItemsMap(bodyOrItemsMap)) {
          log('[Sync] WARNING: Discarding corrupt folder description from server for ' + path);
          return false;
        }
        await this.markChildren(path, bodyOrItemsMap as RSItem["itemsMap"], data.toBeSaved, data.missingChildren);
      } else {
        await this.rs.local.setNodes(this.flush(data.toBeSaved));
      }
    } else {
      await this.updateCommonTimestamp(path, revision);
    }
    return true;
  }

  /**
   * Handle response of executed request
   */
  async handleResponse (path: string, action: SyncTask["action"], r: RemoteResponse): Promise<boolean> {
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

  /**
   * Execute/finish running tasks, one at a time
   */
  async finishTask (task: SyncTask, queueTask: boolean = true): Promise<void> {
    if (task.action === undefined) {
      delete this._running[task.path];
      return;
    }

    if (queueTask) {
      log("[Sync] queue finished task:", task.path);
      this._finishedTasks.push(task);
      if (this._finishedTasks.length > 1) {
        log("[Sync] delaying finished task:", task.path);
        return;
      }
    }

    log("[Sync] run task:", task.path);

    let res;
    try {
      res = await task.promise;
    } catch (err) {
      log('[Sync] wire client rejects its promise', task.path, task.action, err);
      res = { statusCode: 'offline' };
    }

    try {
      const completed = await this.handleResponse(task.path, task.action, res);
      this.finishSuccessfulTask(task, completed);
    } catch (err) {
      this.finishUnsuccessfulTask(task, err);
    }
  }

  async finishSuccessfulTask (task: SyncTask, completed: boolean): Promise<void> {
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

    this.rs._emit('sync-req-done', {
      tasksRemaining: Object.keys(this._tasks).length
    });

    if (this._finishedTasks.length > 0) {
      await this.finishTask(this._finishedTasks[0], false);
      return;
    }

    await this.collectTasks(false).then(() => {
      // See if there are any more tasks that are not refresh tasks
      if (!this.hasTasks() || this.stopped) {
        if (!this.done) { this.done = true; }
        this.rs._emit('sync-done', { completed: true });
      } else {
        // Use a 10ms timeout to let the JavaScript runtime catch its breath
        // (and hopefully force an IndexedDB auto-commit?), and also to cause
        // the threads to get staggered and get a good spread over time:
        setTimeout(() => { this.doTasks(); }, 10);
      }
    });
  }

  async finishUnsuccessfulTask (task: SyncTask, err: Error): Promise<void> {
    log('[Sync]', err.message);

    this._finishedTasks.shift();
    delete this._timeStarted[task.path];
    delete this._running[task.path];

    this.rs._emit('sync-req-done', {
      tasksRemaining: Object.keys(this._tasks).length
    });

    if (this._finishedTasks.length > 0) {
      await this.finishTask(this._finishedTasks[0], false);
      return;
    }

    if (!this.done) {
      this.done = true;
      this.rs._emit('sync-done', { completed: false });
    }
  }

  /**
   * Determine how many tasks we want to have
   */
  tasksWanted (): number {
    if (!this.rs.remote.connected) {
      // Nothing to sync if no remote connected
      return 0;
    }

    if (this.rs.remote.online) {
      // Run as many tasks as threads are available/configured
      return this.numThreads;
    } else {
      // Only run 1 task when we're offline
      return 1;
    }
  }

  /**
   * Check if more tasks can be queued, and start running
   * tasks
   *
   * @returns {Boolean} `true` when all tasks have been started or
   *                    there's nothing to do, `false` if we could
   *                    or want to run more
   */
  doTasks (): boolean {
    const numToHave = this.tasksWanted();
    const numToAdd = numToHave - Object.keys(this._running).length;
    if (numToAdd <= 0) { return true; }

    // `this.done` is `true` for immediate sync and `false` for
    // periodic sync
    if (this.hasTasks() && !this.done) {
      this.rs._emit('sync-started');
    }

    let numAdded: number = 0, path: string;

    for (path in this._tasks) {
      if (!this._running[path]) {
        this._timeStarted[path] = this.now();
        this._running[path] = this.doTask(path).then(this.finishTask.bind(this));
        numAdded++;
        if (numAdded >= numToAdd) { break; }
      }
    }

    return (numAdded >= numToAdd);
  }

  /**
   * Collect any potential sync tasks if none are queued
   */
  async collectTasks (alsoCheckRefresh: boolean = true): Promise<void> {
    if (this.hasTasks() || this.stopped) { return; }

    const numDiffs = await this.collectDiffTasks();
    if (numDiffs > 0) { return; }

    if (alsoCheckRefresh) {
      return this.collectRefreshTasks();
    }
  }

  /**
   * Add a sync task for the given path
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addTask (path: string, cb?: () => void): void {
    if (!this._tasks[path]) {
      this._tasks[path] = [];
    }
    if (typeof(cb) === 'function') {
      this._tasks[path].push(cb);
    }
  }

  /**
   * Start a sync procedure
   */
  public async sync (): Promise<void> {
    this.done = false;

    if (!this.doTasks()) {
      try {
        await this.collectTasks();
      } catch (e) {
        log('[Sync] Sync error', e);
        throw new Error('Local cache unavailable');
      };

      this.doTasks();
    }
  }

  static _rs_init (remoteStorage: RemoteStorage): void {
    setupSync = function (): void {
      // if (!config.cache) return false
      const env = new Env();
      if (env.isBrowser()) { handleVisibility(env, remoteStorage); }

      if (!remoteStorage.sync) {
        // Call this now that all other modules are also ready:
        remoteStorage.sync = new Sync(remoteStorage);

        if (remoteStorage.syncStopped) {
          log('[Sync] Initializing with sync stopped');
          remoteStorage.sync.stopped = true;
          delete remoteStorage.syncStopped;
        }
      }

      remoteStorage.setupSyncCycle();
    };

    syncOnConnect = function (): void {
      remoteStorage.removeEventListener('connected', syncOnConnect);
      remoteStorage.startSync();
    };

    remoteStorage.on('ready', setupSync);
    remoteStorage.on('connected', syncOnConnect);
  }

  static _rs_cleanup (remoteStorage: RemoteStorage): void {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', setupSync);
    remoteStorage.removeEventListener('connected', syncOnConnect);

    remoteStorage.sync = undefined;
    delete remoteStorage.sync;
  }
}

export interface Sync extends EventHandling {}
applyMixins(Sync, [EventHandling]);

export default Sync;
