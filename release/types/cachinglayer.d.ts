import type { QueuedRequestResponse } from './interfaces/queued_request_response';
import type { RSNode, RSNodes } from './interfaces/rs_node';
import EventHandling from './eventhandling';
declare function getLatest(node: RSNode): any;
declare function isOutdated(nodes: RSNodes, maxAge: number): boolean;
declare function makeNode(path: string): RSNode;
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
declare abstract class CachingLayer {
    private _updateNodesRunning;
    private _updateNodesQueued;
    abstract getNodes(paths: string[]): Promise<RSNodes>;
    abstract diffHandler(...args: any[]): any;
    abstract forAllNodes(cb: (node: any) => any): Promise<void>;
    abstract setNodes(nodes: RSNodes): Promise<void>;
    get(path: string, maxAge: number, queueGetRequest: (path2: string) => Promise<QueuedRequestResponse>): Promise<QueuedRequestResponse>;
    put(path: string, body: unknown, contentType: string): Promise<RSNodes>;
    delete(path: string): unknown;
    flush(path: string): unknown;
    private _emitChange;
    fireInitial(): void;
    onDiff(diffHandler: any): void;
    migrate(node: RSNode): RSNode;
    private _updateNodes;
    private _doUpdateNodes;
    private _emitChangeEvents;
    private _getAllDescendentPaths;
    _getInternals(): {
        getLatest: typeof getLatest;
        makeNode: typeof makeNode;
        isOutdated: typeof isOutdated;
    };
}
interface CachingLayer extends EventHandling {
}
export = CachingLayer;
//# sourceMappingURL=cachinglayer.d.ts.map