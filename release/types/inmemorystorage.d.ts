import type { RSNode, RSNodes } from './interfaces/rs_node';
import EventHandling from './eventhandling';
import CachingLayer from './cachinglayer';
/**
 * In-memory caching adapter. Used when no IndexedDB or localStorage
 * available.
 *
 * @class
 **/
declare class InMemoryStorage extends CachingLayer {
    private _storage;
    constructor();
    getNodes(paths: string[]): Promise<RSNodes>;
    setNodes(nodes: RSNodes): Promise<void>;
    forAllNodes(cb: (node: RSNode) => void): Promise<void>;
    diffHandler(): void;
    /**
     * Initialize the InMemoryStorage backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    protected static _rs_init(): void;
    /**
     * Inform about the availability of the InMemoryStorage backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    protected static _rs_supported(): true;
    /**
     * Remove InMemoryStorage as a backend.
     *
     * @protected
     */
    protected static _rs_cleanup(): void;
}
interface InMemoryStorage extends EventHandling {
}
export = InMemoryStorage;
//# sourceMappingURL=inmemorystorage.d.ts.map