import {eventHandlingMixedIn} from './eventhandling-new';
import {CachingLayer} from './cachinglayer-new';

/**
 * In-memory caching adapter. Used when no IndexedDB or localStorage
 * available.
 *
 * @class
 **/

class InMemoryStorageBase extends CachingLayer {

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _storage: { [key: string]: any } = {};

  constructor() {
    super();
  }


  getNodes(paths: string[]): Promise<RSNodes> {
    const nodes: RSNodes = {};

    for (let i = 0, len = paths.length; i < len; i++) {
      nodes[paths[i]] = this._storage[paths[i]];
    }

    return Promise.resolve(nodes);
  }

  setNodes(nodes: RSNodes): Promise<void> {
    for (const path in nodes) {
      if(nodes[path] === undefined) {
        delete this._storage[path];
      } else {
        this._storage[path] = nodes[path];
      }
    }

    return Promise.resolve();
  }

  forAllNodes(cb: (node) => any): Promise<void> {
    for (const path in this._storage) {
      cb(this.migrate(this._storage[path]));
    }
    return Promise.resolve();
  }

  // NOTE: will be overwritten by eventHandlingMíxin
  _emit(...args): void {
    throw new Error('Should never be called');
    // empty
  }

  diffHandler() {
    // empty
  }
}

// Also add event handling class
const InMemoryStorage = eventHandlingMixedIn(InMemoryStorageBase, ['change', 'local-events-done']);

module.exports = InMemoryStorage;
