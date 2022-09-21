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
declare class IndexedDB extends CachingLayer {
    db: any;
    getsRunning: number;
    putsRunning: number;
    changesQueued: {
        [key: string]: unknown;
    };
    changesRunning: {
        [key: string]: unknown;
    };
    commitSlownessWarning: any;
    constructor(database: any);
    /**
     * TODO: Document
     */
    getNodes(paths: string[]): Promise<RSNodes>;
    /**
     * TODO: Document
     */
    setNodes(nodes: RSNodes): Promise<void>;
    /**
     * TODO: Document
     */
    maybeFlush(): void;
    /**
     * TODO: Document
     */
    flushChangesQueued(): void;
    /**
     * TODO: Document
     */
    getNodesFromDb(paths: string[]): Promise<RSNodes>;
    /**
     * TODO: Document
     */
    setNodesInDb(nodes: {
        [key: string]: unknown;
    }): Promise<void>;
    /**
     * TODO: Document
     */
    reset(callback: (p: unknown) => unknown): void;
    /**
     * TODO: Document
     */
    forAllNodes(cb: (node: RSNode) => void): Promise<void>;
    closeDB(): void;
    /**
     * TODO: Document
     */
    static open(name: string, callback: (p: unknown, p2?: unknown) => unknown): void;
    /**
     * TODO: Document
     */
    static clean(databaseName: string, callback: () => void): void;
    /**
     * Initialize the IndexedDB backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(remoteStorage: unknown): Promise<void>;
    /**
     * Inform about the availability of the IndexedDB backend.
     *
     * @param {Object} rs - RemoteStorage instance
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported(): Promise<void>;
    /**
     * Remove IndexedDB as a backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(remoteStorage: any): Promise<unknown>;
    diffHandler(): void;
}
interface IndexedDB extends EventHandling {
}
export = IndexedDB;
//# sourceMappingURL=indexeddb.d.ts.map