import * as cachingLayer from './cachinglayer';
import * as log from './log';
import * as eventHandling from './eventhandling';
import {localStorageAvailable} from './util';

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

interface Nodes {
  [key: string]: string;
}

export default class LocalStorage {
  /**
   * Initialize the LocalStorage backend.
   *
   * @protected
   */
  protected static _rs_init() {
  }


  /**
   * Inform about the availability of the LocalStorage backend.
   *
   * @returns {Boolean}
   *
   * @protected
   */
  protected static _rs_supported() {
    return localStorageAvailable();
  };

  /**
   * Remove LocalStorage as a backend.
   *
   * @protected
   *
   * TODO: tests missing!
   */
  protected static _rs_cleanup() {
    const keys = [];

    for (let i = 0, len = localStorage.length; i < len; i++) {
      let key = localStorage.key(i);
      if(isRemoteStorageKey(key)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      log('[LocalStorage] Removing', key);
      delete localStorage[key];
    });
  };

  constructor() {
    cachingLayer(this);
    log('[LocalStorage] Registering events');
    eventHandling(this, 'change', 'local-events-done');
  }

  getNodes(paths: string[]): Promise<Nodes> {
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

  setNodes(nodes: Nodes): Promise<void> {
    for (const path in nodes) {
      // TODO shouldn't we use getItem/setItem?
      localStorage[NODES_PREFIX + path] = JSON.stringify(nodes[path]);
    }

    return Promise.resolve();
  }

  forAllNodes(cb: (node) => any): Promise<void> {
    let node;

    for (let i = 0, len = localStorage.length; i < len; i++) {
      if(isNodeKey(localStorage.key(i))) {
        try {
          // NOTE: this is coming from caching layer todo fix via interface or similar
          node = this.migrate(JSON.parse(localStorage[localStorage.key(i)]));
        } catch (e) {
          node = undefined;
        }
        if(node) {
          cb(node);
        }
      }
    }
    return Promise.resolve();
  }
}

// TODO should be removed after refactor in favor of adjusting the imports
module.exports = LocalStorage;
