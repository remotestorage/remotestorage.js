import type { RSNode, RSNodes } from './interfaces/rs_node';
import CachingLayer from './cachinglayer';
import EventHandling from './eventhandling';
declare class LocalStorage extends CachingLayer {
    constructor();
    diffHandler(...args: any[]): void;
    getNodes(paths: string[]): Promise<RSNodes>;
    setNodes(nodes: RSNodes): Promise<void>;
    forAllNodes(cb: (node: RSNode) => void): Promise<void>;
    /**
     * Initialize the LocalStorage backend.
     *
     * @protected
     */
    static _rs_init(): void;
    /**
     * Inform about the availability of the LocalStorage backend.
     *
     * @protected
     */
    static _rs_supported(): boolean;
    /**
     * Remove LocalStorage as a backend.
     *
     * @protected
     *
     * TODO: tests missing!
     */
    static _rs_cleanup(): void;
}
interface LocalStorage extends EventHandling {
}
export = LocalStorage;
//# sourceMappingURL=localstorage.d.ts.map