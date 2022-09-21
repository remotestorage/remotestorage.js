import type { RSNode, RSNodes } from './interfaces/rs_node';
import CachingLayer from './cachinglayer';
import EventHandling from './eventhandling';
import log from './log';
import { applyMixins, localStorageAvailable } from './util';

/**
 * localStorage caching adapter. Used when no IndexedDB available.
 **/

const NODES_PREFIX = "remotestorage:cache:nodes:";
const CHANGES_PREFIX = "remotestorage:cache:changes:";

function isRemoteStorageKey(key: string): boolean {
  return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX ||
    key.substr(0, CHANGES_PREFIX.length) === CHANGES_PREFIX;
}

function isNodeKey(key: string): boolean {
  return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX;
}

class LocalStorage extends CachingLayer {
  constructor() {
    super();
    this.addEvents(['change', 'local-events-done']);
  }

  // TODO fix this
  diffHandler(...args: any[]): void {
    return;
  }

  getNodes(paths: string[]): Promise<RSNodes> {
    const nodes = {};

    for (let i = 0, len = paths.length; i < len; i++) {
      try {
        nodes[paths[i]] = JSON.parse(localStorage[NODES_PREFIX + paths[i]]);
      } catch (e) {
        nodes[paths[i]] = undefined;
      }
    }

    return Promise.resolve(nodes);
  }

  setNodes(nodes: RSNodes): Promise<void> {
    for (const path in nodes) {
      // TODO shouldn't we use getItem/setItem?
      localStorage[NODES_PREFIX + path] = JSON.stringify(nodes[path]);
    }

    return Promise.resolve();
  }

  forAllNodes(cb: (node: RSNode) => void): Promise<void> {
    let node: RSNode | undefined;

    for (let i = 0, len = localStorage.length; i < len; i++) {
      if (isNodeKey(localStorage.key(i))) {
        try {
          // NOTE: this is coming from caching layer todo fix via interface or similar
          node = this.migrate(JSON.parse(localStorage[localStorage.key(i)]));
        } catch (e) {
          node = undefined;
        }
        if (node) {
          cb(node);
        }
      }
    }
    return Promise.resolve();
  }

  /**
   * Initialize the LocalStorage backend.
   *
   * @protected
   */
  static _rs_init(): void {
    return;
  }

  /**
   * Inform about the availability of the LocalStorage backend.
   *
   * @protected
   */
  static _rs_supported(): boolean {
    return localStorageAvailable();
  }

  /**
   * Remove LocalStorage as a backend.
   *
   * @protected
   *
   * TODO: tests missing!
   */
  static _rs_cleanup(): void {
    const keys = [];

    for (let i = 0, len = localStorage.length; i < len; i++) {
      const key = localStorage.key(i);
      if (isRemoteStorageKey(key)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      log('[LocalStorage] Removing', key);
      delete localStorage[key];
    });
  }
}

// TODO move to CachingLayer, same for all layers
interface LocalStorage extends EventHandling {}
applyMixins(LocalStorage, [EventHandling]);

export = LocalStorage;
