/**
 * TODO rewrite, doesn't expose GPD anymore, it's in cachinglayer now
 *
 * This file exposes a get/put/delete interface, accessing data in an IndexedDB.
 *
 * There are multiple parts to this interface:
 *
 *   The RemoteStorage integration:
 *     - IndexedDB._rs_supported() determines if IndexedDB support
 *       is available. If it isn't, RemoteStorage won't initialize the feature.
 *     - IndexedDB._rs_init() initializes the feature. It returns
 *       a promise that is fulfilled as soon as the database has been opened and
 *       migrated.
 *
 *   The storage interface (IndexedDB object):
 *     - Usually this is accessible via "remoteStorage.local"
 *     - #get() takes a path and returns a promise.
 *     - #put() takes a path, body and contentType and also returns a promise.
 *     - #delete() takes a path and also returns a promise.
 *     - #on('change', ...) events, being fired whenever something changes in
 *       the storage. Change events roughly follow the StorageEvent pattern.
 *       They have "oldValue" and "newValue" properties, which can be used to
 *       distinguish create/update/delete operations and analyze changes in
 *       change handlers. In addition they carry a "origin" property, which
 *       is either "window", "local", or "remote". "remote" events are fired
 *       whenever a change comes in from Sync.
 *
 *   The sync interface (also on IndexedDB object):
 *     - #getNodes([paths]) returns the requested nodes in a promise.
 *     - #setNodes(map) stores all the nodes given in the (path -> node) map.
 *
 * @interface
 */

import type { RSNode, RSNodes } from './interfaces/rs_node';
import EventHandling from './eventhandling';
import CachingLayer from './cachinglayer';
import log from './log';
import {
  applyMixins,
  deepClone,
  getGlobalContext
} from './util';

const DB_VERSION = 2;

const DEFAULT_DB_NAME = 'remotestorage';

// TODO very weird that this is re-assigned
let DEFAULT_DB;

class IndexedDB extends CachingLayer {
  db: any;
  getsRunning: number;
  putsRunning: number;
  changesQueued: { [key: string]: unknown };
  changesRunning: { [key: string]: unknown };
  commitSlownessWarning: any; // TODO null | number (but node's setInterval returns an unknown type)

  constructor(database) {
    super();
    this.addEvents(['change', 'local-events-done']);

    this.db = database || DEFAULT_DB;

    if (!this.db) {
      // TODO shouldn't this throw an error?
      log("[IndexedDB] Failed to open DB");
      return undefined;
    }

    this.getsRunning = 0;
    this.putsRunning = 0;

    /**
     * Given a node for which uncommitted changes exist, this cache
     * stores either the entire uncommitted node, or false for a deletion.
     * The node's path is used as the key.
     *
     * changesQueued stores changes for which no IndexedDB transaction has
     * been started yet.
     */
    this.changesQueued = {};

    /**
     * Given a node for which uncommitted changes exist, this cache
     * stores either the entire uncommitted node, or false for a deletion.
     * The node's path is used as the key.
     *
     * At any time there is at most one IndexedDB transaction running.
     * changesRunning stores the changes that are included in that currently
     * running IndexedDB transaction, or if none is running, of the last one
     * that ran.
     */
    this.changesRunning = {};

    // TODO document
    this.commitSlownessWarning = null;
  }

  /**
   * TODO: Document
   */
  async getNodes (paths: string[]): Promise<RSNodes> {
    const misses = [], fromCache = {};
    for (let i = 0, len = paths.length; i < len; i++) {
      if (this.changesQueued[paths[i]] !== undefined) {
        fromCache[paths[i]] = deepClone(this.changesQueued[paths[i]] || undefined);
      } else if (this.changesRunning[paths[i]] !== undefined) {
        fromCache[paths[i]] = deepClone(this.changesRunning[paths[i]] || undefined);
      } else {
        misses.push(paths[i]);
      }
    }
    if (misses.length > 0) {
      return this.getNodesFromDb(misses).then(function (nodes) {
        for (const i in fromCache) {
          nodes[i] = fromCache[i];
        }
        return nodes;
      });
    } else {
      return Promise.resolve(fromCache);
    }
  }

  /**
   * TODO: Document
   */
  async setNodes (nodes: RSNodes): Promise<void> {
    for (const i in nodes) {
      this.changesQueued[i] = nodes[i] || false;
    }
    this.maybeFlush();
    return Promise.resolve();
  }

  /**
   * TODO: Document
   */
  maybeFlush (): void {
    if (this.putsRunning === 0) {
      this.flushChangesQueued();
    } else {
      if (!this.commitSlownessWarning) {
        this.commitSlownessWarning = global.setInterval(function () {
          console.warn('WARNING: waited more than 10 seconds for previous commit to finish');
        }, 10000);
      }
    }
  }

  /**
   * TODO: Document
   */
  flushChangesQueued (): void {
    if (this.commitSlownessWarning) {
      clearInterval(this.commitSlownessWarning);
      this.commitSlownessWarning = null;
    }
    if (Object.keys(this.changesQueued).length > 0) {
      this.changesRunning = this.changesQueued;
      this.changesQueued = {};
      this.setNodesInDb(this.changesRunning).then(this.flushChangesQueued.bind(this));
    }
  }

  /**
   * TODO: Document
   */
  getNodesFromDb (paths: string[]): Promise<RSNodes> {
    return new Promise((resolve, reject) => {

      const transaction = this.db.transaction(['nodes'], 'readonly');
      const nodes = transaction.objectStore('nodes');
      const retrievedNodes = {};

      this.getsRunning++;

      paths.map((path: string) => {
        nodes.get(path).onsuccess = (evt) => {
          retrievedNodes[path] = evt.target.result;
        };
      });

      transaction.oncomplete = () => {
        resolve(retrievedNodes);
        this.getsRunning--;
      };

      transaction.onerror = transaction.onabort = () => {
        reject('get transaction error/abort');
        this.getsRunning--;
      };

    });
  }

  /**
   * TODO: Document
   */
  async setNodesInDb (nodes: { [key: string]: unknown }): Promise<void> {
    return new Promise((resolve, reject) => {

      const transaction = this.db.transaction(['nodes'], 'readwrite');
      const nodesStore = transaction.objectStore('nodes');
      const startTime = new Date().getTime();

      this.putsRunning++;

      log('[IndexedDB] Starting put', nodes, this.putsRunning);

      for (const path in nodes) {
        const node = nodes[path];
        if (typeof (node) === 'object') {
          try {
            nodesStore.put(node);
          } catch (e) {
            log('[IndexedDB] Error while putting', node, e);
            throw e;
          }
        } else {
          try {
            nodesStore.delete(path);
          } catch (e) {
            log('[IndexedDB] Error while removing', nodesStore, node, e);
            throw e;
          }
        }
      }

      transaction.oncomplete = () => {
        this.putsRunning--;
        log('[IndexedDB] Finished put', nodes, this.putsRunning, (new Date().getTime() - startTime) + 'ms');
        resolve();
      };

      transaction.onerror = () => {
        this.putsRunning--;
        reject('transaction error');
      };

      transaction.onabort = () => {
        reject('transaction abort');
        this.putsRunning--;
      };

    });
  }

  /**
   * TODO: Document
   */
  // TODO add real types once known
  reset (callback: (p: unknown) => unknown): void {
    const dbName = this.db.name;

    this.db.close();

    IndexedDB.clean(this.db.name, () => {
      IndexedDB.open(dbName, (err, other) => {
        if (err) {
          log('[IndexedDB] Error while resetting local storage', err);
        } else {
          // hacky!
          this.db = other;
        }
        if (typeof callback === 'function') {
          callback(self);
        }
      });
    });
  }

  /**
   * TODO: Document
   */
  async forAllNodes (cb: (node: RSNode) => void): Promise<void> {
    return new Promise((resolve/*, reject*/) => {

      const transaction = this.db.transaction(['nodes'], 'readonly');
      const cursorReq = transaction.objectStore('nodes').openCursor();

      cursorReq.onsuccess = (evt) => {
        const cursor = evt.target.result;

        if (cursor) {
          cb(this.migrate(cursor.value));
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  closeDB (): void {
    if (this.putsRunning === 0) { // check if we are currently writing to the DB
      this.db.close();
    } else {
      setTimeout(this.closeDB.bind(this), 100); // try again a little later
    }
  }

  /**
   * TODO: Document
   */
  // TODO add real types once known
  static open (name: string, callback: (p: unknown, p2?: unknown) => unknown) {
    const timer = setTimeout(function () {
      callback("timeout trying to open db");
    }, 10000);

    try {
      const req = indexedDB.open(name, DB_VERSION);

      req.onerror = function () {
        log('[IndexedDB] Opening DB failed', req);

        clearTimeout(timer);
        callback(req.error);
      };

      req.onupgradeneeded = function (event) {
        const db = req.result;

        log("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);

        if (event.oldVersion !== 1) {
          log("[IndexedDB] Creating object store: nodes");
          db.createObjectStore('nodes', {keyPath: 'path'});
        }

        log("[IndexedDB] Creating object store: changes");

        db.createObjectStore('changes', {keyPath: 'path'});
      };

      req.onsuccess = function () {
        clearTimeout(timer);

        // check if all object stores exist
        const db = req.result;
        if (!db.objectStoreNames.contains('nodes') || !db.objectStoreNames.contains('changes')) {
          log("[IndexedDB] Missing object store. Resetting the database.");
          IndexedDB.clean(name, function () {
            IndexedDB.open(name, callback);
          });
          return;
        }

        callback(null, req.result);
      };
    } catch (error) {
      log("[IndexedDB] Failed to open database: " + error);
      log("[IndexedDB] Resetting database and trying again.");

      clearTimeout(timer);

      IndexedDB.clean(name, function () {
        IndexedDB.open(name, callback);
      });
    }
  }

  /**
   * TODO: Document
   */
  static clean (databaseName: string, callback: () => void) {
    const req = indexedDB.deleteDatabase(databaseName);

    req.onsuccess = function () {
      log('[IndexedDB] Done removing DB');
      callback();
    };

    // TODO check if this does anything as onabort does not exist on type according to ts
    req.onerror = (req as any).onabort = function (evt) {
      console.error('Failed to remove database "' + databaseName + '"', evt);
    };
  }

  /**
   * Initialize the IndexedDB backend.
   *
   * @param {Object} remoteStorage - RemoteStorage instance
   *
   * @protected
   */
  // TODO add real type once known
  static _rs_init (remoteStorage: unknown): Promise<void> {

    return new Promise((resolve, reject) => {

      IndexedDB.open(DEFAULT_DB_NAME, function (err, db) {
        if (err) {
          reject(err);
        } else {
          DEFAULT_DB = db;
          // TODO remove once real type once known
          (db as any).onerror = () => {
            (remoteStorage as any)._emit('error', err);
          };
          resolve();
        }
      });

    });
  }

  /**
   * Inform about the availability of the IndexedDB backend.
   *
   * @param {Object} rs - RemoteStorage instance
   * @returns {Boolean}
   *
   * @protected
   */
  static _rs_supported (): Promise<void> {
    return new Promise((resolve, reject) => {

      const context = getGlobalContext();

      // FIXME: this is causing an error in chrome
      // context.indexedDB = context.indexedDB    || context.webkitIndexedDB ||
      //                    context.mozIndexedDB || context.oIndexedDB      ||
      //                    context.msIndexedDB;

      // Detect browsers with known IndexedDb issues (e.g. Android pre-4.4)
      let poorIndexedDbSupport = false;
      if (typeof navigator !== 'undefined' &&
        navigator.userAgent.match(/Android (2|3|4\.[0-3])/)) {
        // Chrome and Firefox support IndexedDB
        if (!navigator.userAgent.match(/Chrome|Firefox/)) {
          poorIndexedDbSupport = true;
        }
      }

      if ('indexedDB' in context && !poorIndexedDbSupport) {
        try {
          const check = indexedDB.open("rs-check");
          check.onerror = function (/* event */) {
            reject();
          };
          check.onsuccess = function (/* event */) {
            check.result.close();
            indexedDB.deleteDatabase("rs-check");
            resolve();
          };
        } catch (e) {
          reject();
        }
      } else {
        reject();
      }

    });
  }

  /**
   * Remove IndexedDB as a backend.
   *
   * @param {Object} remoteStorage - RemoteStorage instance
   *
   * @protected
   */
  static _rs_cleanup (remoteStorage: any) {
    return new Promise((resolve/*, reject*/) => {
      if (remoteStorage.local) {
        remoteStorage.local.closeDB();
      }

      IndexedDB.clean(DEFAULT_DB_NAME, resolve as () => void);
    });
  }

  diffHandler() {
    // empty
  }
}

// TODO move to CachingLayer, same for all layers
interface IndexedDB extends EventHandling {}
applyMixins(IndexedDB, [EventHandling]);

export = IndexedDB;
