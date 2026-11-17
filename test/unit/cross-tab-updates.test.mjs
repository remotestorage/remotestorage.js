import 'mocha';
import { expect } from 'chai';

import { localStorage } from '../helpers/memoryStorage.mjs';
import IndexedDB from '../../build/indexeddb.js';
import LocalStorage from '../../build/localstorage.js';
import config from '../../build/config.js';

/**
 * Minimal IndexedDB double shared by several "tabs". Requests and commits
 * complete asynchronously, like the real API.
 */
function createFakeDb (name, { failPuts = false } = {}) {
  const rows = new Map();
  return {
    name,
    rows,
    failPuts,
    transaction (stores, mode) {
      const tx = { oncomplete () {}, onerror () {}, onabort () {} };
      const pending = [];
      tx.abort = () => { pending.length = 0; tx.aborted = true; };
      tx.objectStore = () => ({
        get (path) {
          const req = {};
          pending.push(() => {
            const value = rows.get(path);
            req.onsuccess?.({ target: { result: value && structuredClone(value) } });
          });
          return req;
        },
        put (node) { pending.push(() => rows.set(node.path, structuredClone(node))); },
        delete (path) { pending.push(() => rows.delete(path)); }
      });
      setTimeout(() => {
        if (tx.aborted) { return; }
        if (mode === 'readwrite' && this.failPuts) {
          tx.onerror();
          tx.onabort();
          return;
        }
        pending.forEach(run => run());
        tx.oncomplete();
      }, 0);
      return tx;
    }
  };
}

/**
 * Pause the first `getNodes` call on `cache` that reads `path`, after it has
 * taken its snapshot, until `resume` is called.
 */
function pauseFirstRead (cache, path) {
  const getNodes = cache.getNodes.bind(cache);
  let reached, resume;
  const reachedP = new Promise(resolve => { reached = resolve; });
  const gate = new Promise(resolve => { resume = resolve; });
  let paused = false;
  cache.getNodes = async paths => {
    const snapshot = await getNodes(paths);
    if (!paused && paths.includes(path)) {
      paused = true;
      reached();
      await gate;
    }
    return snapshot;
  };
  return { reached: reachedP, resume, restore: () => { resume(); cache.getNodes = getNodes; } };
}

async function writeConcurrently (tabA, tabB) {
  const pause = pauseFirstRead(tabA, '/foo/');
  try {
    const a = tabA.put('/foo/a', 'from A', 'text/plain');
    await pause.reached;
    const b = tabB.put('/foo/b', 'from B', 'text/plain');
    // Let tab B read and write if nothing stops it.
    await new Promise(resolve => setTimeout(resolve, 5));
    pause.resume();
    await Promise.all([a, b]);
  } finally {
    pause.restore();
  }
}

describe('Updates from several tabs sharing one cache (#1437)', function () {
  let originalChangeEvents;

  before(function () {
    originalChangeEvents = config.changeEvents;
    config.changeEvents = { local: false, window: false, remote: false, conflict: false };
  });

  after(function () {
    config.changeEvents = originalChangeEvents;
  });

  describe('LocalStorage', function () {
    // Older Node.js versions lack navigator.locks.
    before(function () { if (!globalThis.navigator?.locks) { this.skip(); } });

    beforeEach(function () { localStorage.clear(); });
    afterEach(function () { localStorage.clear(); });

    it('keeps both tabs\' entries in a shared folder listing', async function () {
      const tabA = new LocalStorage();
      const tabB = new LocalStorage();

      await writeConcurrently(tabA, tabB);

      const nodes = await new LocalStorage().getNodes(['/foo/']);
      expect(nodes['/foo/'].local.itemsMap).to.deep.equal({ a: true, b: true });
    });
  });

  describe('IndexedDB', function () {
    // Older Node.js versions lack navigator.locks.
    before(function () { if (!globalThis.navigator?.locks) { this.skip(); } });

    it('keeps both tabs\' entries in a shared folder listing', async function () {
      const db = createFakeDb('rs-test-listing');
      const tabA = new IndexedDB(db);
      const tabB = new IndexedDB(db);

      await writeConcurrently(tabA, tabB);

      expect(db.rows.get('/foo/').local.itemsMap).to.deep.equal({ a: true, b: true });
    });

    it('reads a node another tab updated instead of its own committed copy', async function () {
      const db = createFakeDb('rs-test-stale');
      const tabA = new IndexedDB(db);
      const tabB = new IndexedDB(db);

      await tabB.put('/foo/b1', 'from B', 'text/plain');
      await tabA.put('/foo/a', 'from A', 'text/plain');
      await tabB.put('/foo/b2', 'from B', 'text/plain');

      expect(db.rows.get('/foo/').local.itemsMap).to.deep.equal({ b1: true, a: true, b2: true });
    });

    it('reports a failed commit and releases the lock', async function () {
      const db = createFakeDb('rs-test-failure', { failPuts: true });
      const tabA = new IndexedDB(db);
      const tabB = new IndexedDB(db);

      let error;
      await tabA.put('/foo/a', 'from A', 'text/plain').catch(e => { error = e; });
      expect(error).to.equal('transaction error');
      expect(tabA.putsRunning).to.equal(0);

      db.failPuts = false;
      // Would never settle if the failed commit kept the lock.
      await tabB.put('/foo/b', 'from B', 'text/plain');
      await tabA.put('/foo/c', 'from A', 'text/plain');

      // Tab A must not reuse its uncommitted snapshot of the folder.
      expect(db.rows.get('/foo/').local.itemsMap).to.deep.equal({ b: true, c: true });
    });
  });

  describe('without the Web Locks API', function () {
    let descriptor;

    beforeEach(function () {
      descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    });

    afterEach(function () {
      Object.defineProperty(globalThis, 'navigator', descriptor);
    });

    it('still serializes updates within one tab', async function () {
      const db = createFakeDb('rs-test-no-locks');
      const tab = new IndexedDB(db);

      await Promise.all([
        tab.put('/foo/a', 'a', 'text/plain'),
        tab.put('/foo/b', 'b', 'text/plain')
      ]);
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(db.rows.get('/foo/').local.itemsMap).to.deep.equal({ a: true, b: true });
    });
  });
});
