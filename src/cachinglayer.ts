import type { ChangeObj } from './interfaces/change_obj';
import type { QueuedRequestResponse } from './interfaces/queued_request_response';
import type { RSEvent } from './interfaces/rs_event';
import type { RSNode, RSNodes, ProcessNodes } from './interfaces/rs_node';
import EventHandling from './eventhandling';
import config from './config';
import log from './log';
import {
  applyMixins,
  deepClone,
  equal,
  isDocument,
  isFolder,
  pathsFromRoot
} from './util';

function getLatest (node: RSNode): any {
  if (typeof (node) !== 'object' || typeof (node.path) !== 'string') {
    return;
  }
  if (isFolder(node.path)) {
    if (node.local && node.local.itemsMap) {
      return node.local;
    }
    if (node.common && node.common.itemsMap) {
      return node.common;
    }
  } else {
    if (node.local) {
      if (node.local.body && node.local.contentType) {
        return node.local;
      }
      if (node.local.body === false) {
        return;
      }
    }
    if (node.common && node.common.body && node.common.contentType) {
      return node.common;
    }
    // Migration code! Once all apps use at least this version of the lib, we
    // can publish clean-up code that migrates over any old-format data, and
    // stop supporting it. For now, new apps will support data in both
    // formats, thanks to this:
    if (node.body && node.contentType) {
      return {
        body: node.body,
        contentType: node.contentType
      };
    }
  }
}

function isOutdated (nodes: RSNodes, maxAge: number): boolean {
  for (const path in nodes) {
    if (nodes[path] && nodes[path].remote) {
      return true;
    }
    const nodeVersion = getLatest(nodes[path]);
    if (nodeVersion && nodeVersion.timestamp && (new Date().getTime()) - nodeVersion.timestamp <= maxAge) {
      return false;
    } else if (!nodeVersion) {
      return true;
    }
  }
  return true;
}


function makeNode (path: string): RSNode {
  const node: RSNode = {path: path, common: {}};

  if (isFolder(path)) {
    node.common.itemsMap = {};
  }
  return node;
}

function updateFolderNodeWithItemName (node: RSNode, itemName: string): RSNode {
  if (!node.common) {
    node.common = {
      itemsMap: {}
    };
  }
  if (!node.common.itemsMap) {
    node.common.itemsMap = {};
  }
  if (!node.local) {
    node.local = deepClone(node.common);
  }
  if (!node.local.itemsMap) {
    node.local.itemsMap = node.common.itemsMap;
  }
  node.local.itemsMap[itemName] = true;

  return node;
}

/**
 * This module defines functions that are mixed into remoteStorage.local when
 * it is instantiated (currently one of indexeddb.js, localstorage.js, or
 * inmemorystorage.js).
 *
 * All remoteStorage.local implementations should therefore implement
 * this.getNodes, this.setNodes, and this.forAllNodes. The rest is blended in
 * here to create a GPD (get/put/delete) interface which the BaseClient can
 * talk to.
 *
 * @interface
 */

abstract class CachingLayer {
  // FIXME
  // this process of updating nodes needs to be heavily documented first, then
  // refactored. Right now it's almost impossible to refactor as there's no
  // explanation of why things are implemented certain ways or what the goal(s)
  // of the behavior are. -slvrbckt (+1 -les)
  private _updateNodesRunning = false;
  private _updateNodesQueued = [];


  // functions that will be overwritten
  // ----------------------------------
  abstract getNodes(paths: string[]): Promise<RSNodes>;

  abstract diffHandler(...args: any[]);

  abstract forAllNodes(cb: (node) => any): Promise<void>;

  abstract setNodes(nodes: RSNodes): Promise<void>;


  // --------------------------------------------------

  // TODO: improve our code structure so that this function
  // could call sync.queueGetRequest directly instead of needing
  // this hacky third parameter as a callback
  async get (path: string, maxAge: number, queueGetRequest: (path2: string) => Promise<QueuedRequestResponse>): Promise<QueuedRequestResponse> {

    if (typeof (maxAge) === 'number') {
      return this.getNodes(pathsFromRoot(path))
        .then((objs) => {
          const node: RSNode = getLatest(objs[path]);

          if (isOutdated(objs, maxAge)) {
            return queueGetRequest(path);
          } else if (node) {
            return {
              statusCode: 200,
              body: node.body || node.itemsMap,
              contentType: node.contentType
            };
          } else {
            return { statusCode: 404 };
          }
        });
    } else {
      return this.getNodes([path])
        .then((objs) => {
          const node: RSNode = getLatest(objs[path]);

          if (node) {
            if (isFolder(path)) {
              for (const i in node.itemsMap) {
                // the hasOwnProperty check here is only because our jshint settings require it:
                if (node.itemsMap.hasOwnProperty(i) && node.itemsMap[i] === false) {
                  delete node.itemsMap[i];
                }
              }
            }
            return {
              statusCode: 200,
              body: node.body || node.itemsMap,
              contentType: node.contentType
            };
          } else {
            return {statusCode: 404};
          }
        });
    }
  }

  async put (path: string, body: unknown, contentType: string): Promise<RSNodes> {
    const paths = pathsFromRoot(path);

    function _processNodes(nodePaths: string[], nodes: RSNodes): RSNodes {
      try {
        for (let i = 0, len = nodePaths.length; i < len; i++) {
          const nodePath = nodePaths[i];
          let node = nodes[nodePath];
          let previous: RSNode;

          if (!node) {
            nodes[nodePath] = node = makeNode(nodePath);
          }

          // Document
          if (i === 0) {
            previous = getLatest(node);
            node.local = {
              body: body,
              contentType: contentType,
              previousBody: (previous ? previous.body : undefined),
              previousContentType: (previous ? previous.contentType : undefined),
            };
          }
          // Folder
          else {
            const itemName = nodePaths[i - 1].substring(nodePath.length);
            node = updateFolderNodeWithItemName(node, itemName);
          }
        }
        return nodes;
      } catch (e) {
        log('[Cachinglayer] Error during PUT', nodes, e);
        throw e;
      }
    }

    return this._updateNodes(paths, _processNodes);
  }

  delete (path: string): unknown {
    const paths = pathsFromRoot(path);

    return this._updateNodes(paths, function (nodePaths, nodes) {
      for (let i = 0, len = nodePaths.length; i < len; i++) {
        const nodePath = nodePaths[i];
        const node = nodes[nodePath];
        let previous;

        if (!node) {
          console.error('Cannot delete non-existing node ' + nodePath);
          continue;
        }

        if (i === 0) {
          // Document
          previous = getLatest(node);
          node.local = {
            body: false,
            previousBody: (previous ? previous.body : undefined),
            previousContentType: (previous ? previous.contentType : undefined),
          };
        } else {
          // Folder
          if (!node.local) {
            node.local = deepClone(node.common);
          }
          const itemName = nodePaths[i - 1].substring(nodePath.length);
          delete node.local.itemsMap[itemName];

          if (Object.getOwnPropertyNames(node.local.itemsMap).length > 0) {
            // This folder still contains other items, don't remove any further ancestors
            break;
          }
        }
      }
      return nodes;
    });
  }

  flush(path: string): unknown {

    return this._getAllDescendentPaths(path).then((paths: string[]) => {
      return this.getNodes(paths);
    }).then((nodes: RSNodes) => {
      for (const nodePath in nodes) {
        const node = nodes[nodePath];

        if (node && node.common && node.local) {
          this._emitChange({
            path: node.path,
            origin: 'local',
            oldValue: (node.local.body === false ? undefined : node.local.body),
            newValue: (node.common.body === false ? undefined : node.common.body)
          });
        }
        nodes[nodePath] = undefined;
      }

      return this.setNodes(nodes);
    });
  }

  private _emitChange(obj: ChangeObj): void {
    if (config.changeEvents[obj.origin]) {
      this._emit('change', obj);
    }
  }

  fireInitial (): void {
    if (!config.changeEvents.local) { return; }

    this.forAllNodes((node) => {
      if (isDocument(node.path)) {
        const latest = getLatest(node);
        if (latest) {
          this._emitChange({
            path: node.path,
            origin: 'local',
            oldValue: undefined,
            oldContentType: undefined,
            newValue: latest.body,
            newContentType: latest.contentType
          });
        }
      }
    }).then(() => {
      this._emit('local-events-done');
    });
  }

  // TODO add proper type
  onDiff(diffHandler: any) {
    this.diffHandler = diffHandler;
  }

  migrate(node: RSNode): RSNode {
    if (typeof (node) === 'object' && !node.common) {
      node.common = {};
      if (typeof (node.path) === 'string') {
        if (node.path.substr(-1) === '/' && typeof (node.body) === 'object') {
          node.common.itemsMap = node.body;
        }
      } else {
        //save legacy content of document node as local version
        if (!node.local) {
          node.local = {};
        }
        node.local.body = node.body;
        node.local.contentType = node.contentType;
      }
    }
    return node;
  }


  private _updateNodes(paths: string[], _processNodes: ProcessNodes): Promise<RSNodes> {
    return new Promise((resolve, reject) => {
      this._doUpdateNodes(paths, _processNodes, {
        resolve: resolve,
        reject: reject
      });
    });
  }

  private _doUpdateNodes(paths: string[], _processNodes: ProcessNodes, promise) {
    if (this._updateNodesRunning) {
      this._updateNodesQueued.push({
        paths: paths,
        cb: _processNodes,
        promise: promise
      });
      return;
    } else {
      this._updateNodesRunning = true;
    }

    this.getNodes(paths).then((nodes) => {
      const existingNodes = deepClone(nodes);
      const changeEvents = [];

      nodes = _processNodes(paths, nodes);

      for (const path in nodes) {
        const node = nodes[path];
        if (equal(node, existingNodes[path])) {
          delete nodes[path];
        } else if (isDocument(path)) {
          if (
            !equal(node.local.body, node.local.previousBody) ||
            node.local.contentType !== node.local.previousContentType
          ) {
            changeEvents.push({
              path: path,
              origin: 'window',
              oldValue: node.local.previousBody,
              newValue: node.local.body === false ? undefined : node.local.body,
              oldContentType: node.local.previousContentType,
              newContentType: node.local.contentType
            });
          }
          delete node.local.previousBody;
          delete node.local.previousContentType;
        }
      }

      this.setNodes(nodes).then(() => {
        this._emitChangeEvents(changeEvents);
        promise.resolve({statusCode: 200});
      });
    }).then(() => {
      return Promise.resolve();
    }, (err) => {
      promise.reject(err);
    }).then(() => {
      this._updateNodesRunning = false;
      const nextJob = this._updateNodesQueued.shift();
      if (nextJob) {
        this._doUpdateNodes(nextJob.paths, nextJob.cb, nextJob.promise);
      }
    });
  }

  private _emitChangeEvents(events: RSEvent[]) {
    for (let i = 0, len = events.length; i < len; i++) {
      this._emitChange(events[i]);
      if (this.diffHandler) {
        this.diffHandler(events[i].path);
      }
    }
  }

  private _getAllDescendentPaths(path: string) {
    if (isFolder(path)) {
      return this.getNodes([path]).then((nodes) => {
        const allPaths = [path];
        const latest = getLatest(nodes[path]);

        const itemNames = Object.keys(latest.itemsMap);
        const calls = itemNames.map((itemName) => {
          return this._getAllDescendentPaths(path + itemName).then((paths) => {
            for (let i = 0, len = paths.length; i < len; i++) {
              allPaths.push(paths[i]);
            }
          });
        });
        return Promise.all(calls).then(() => {
          return allPaths;
        });
      });
    } else {
      return Promise.resolve([path]);
    }
  }

  // treated as private but made public for unit testing
  _getInternals() {
    return {
      getLatest: getLatest,
      makeNode: makeNode,
      isOutdated: isOutdated
    };
  }
}


interface CachingLayer extends EventHandling {}
applyMixins(CachingLayer, [EventHandling]);

export = CachingLayer;
