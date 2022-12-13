import type { RSNode, RSNodes } from './interfaces/rs_node';
import EventHandling from './eventhandling';
import CachingLayer from './cachinglayer';
import { applyMixins, deepClone } from './util';

/**
 * In-memory caching adapter. Used when no IndexedDB or localStorage
 * available.
 *
 * @class
 **/

class InMemoryStorage extends CachingLayer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _storage: { [key: string]: any } = {};

  constructor() {
    super();
    this.addEvents(['change', 'local-events-done']);
  }

  getNodes(paths: string[]): Promise<RSNodes> {
    const nodes: RSNodes = {};

    for (let i = 0, len = paths.length; i < len; i++) {
      // Should use a clone of whatever we are retrieving to prevent
      // mutation, also to follow the same behavior as localStorage
      // and indexeddb.
      nodes[paths[i]] = deepClone(this._storage[paths[i]]);
    }

    return Promise.resolve(nodes);
  }

  setNodes(nodes: RSNodes): Promise<void> {
    for (const path in nodes) {
      if (nodes[path] === undefined) {
        delete this._storage[path];
      } else {
        this._storage[path] = nodes[path];
      }
    }

    return Promise.resolve();
  }

  forAllNodes(cb: (node: RSNode) => void): Promise<void> {
    for (const path in this._storage) {
      cb(this.migrate(this._storage[path]));
    }
    return Promise.resolve();
  }

  diffHandler(): void {
    // empty
  }

  /**
   * Initialize the InMemoryStorage backend.
   *
   * @param {Object} remoteStorage - RemoteStorage instance
   *
   * @protected
   */
  protected static _rs_init(): void {
    // empty
  }

  /**
   * Inform about the availability of the InMemoryStorage backend.
   *
   * @returns {Boolean}
   *
   * @protected
   */
  protected static _rs_supported(): true {
    // In-memory storage is always supported
    return true;
  }

  /**
   * Remove InMemoryStorage as a backend.
   *
   * @protected
   */
  protected static _rs_cleanup(): void {
    // empty
  }
}

// TODO move to CachingLayer, same for all layers
interface InMemoryStorage extends EventHandling {}
applyMixins(InMemoryStorage, [EventHandling]);

export = InMemoryStorage;
