import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import IndexedDB from '../../build/indexeddb.js';

// Controlled transaction boundaries allow failures without browser timing.
// These fixtures test adapter behavior, not a browser's IndexedDB implementation.
function storage() {
  const requests = new Map();
  const store = {
    get: sinon.spy(path => {
      const request = {};
      requests.set(path, request);
      return request;
    }),
    put: sinon.spy(),
    delete: sinon.spy()
  };
  const transaction = { objectStore: sinon.stub().returns(store) };
  const db = { transaction: sinon.stub().returns(transaction) };
  return { adapter: new IndexedDB(db), db, transaction, store, requests };
}

function node(body) {
  return { path: '/notes/a', common: { body, contentType: 'text/plain' } };
}

describe('IndexedDB storage boundaries', () => {
  afterEach(() => sinon.restore());

  it('prefers queued edits over running edits and combines them with database misses', async () => {
    const { adapter } = storage();
    adapter.changesRunning['/notes/a'] = node('running');
    adapter.changesQueued['/notes/a'] = node('queued');
    const read = sinon.stub(adapter, 'getNodesFromDb').resolves({ '/notes/b': { path: '/notes/b' } });
    const result = await adapter.getNodes(['/notes/a', '/notes/b']);
    expect(read.firstCall.args[0]).to.deep.equal(['/notes/b']);
    expect(result['/notes/a'].common.body).to.equal('queued');
    expect(result['/notes/b'].path).to.equal('/notes/b');
    result['/notes/a'].common.body = 'caller mutation';
    expect(adapter.changesQueued['/notes/a'].common.body).to.equal('queued');
  });

  it('reads running edits without a database round trip and returns a copy', async () => {
    const { adapter, db } = storage();
    adapter.changesRunning['/notes/a'] = node('running');
    const result = await adapter.getNodes(['/notes/a']);
    result['/notes/a'].common.body = 'caller mutation';
    expect(adapter.changesRunning['/notes/a'].common.body).to.equal('running');
    expect(db.transaction.called).to.equal(false);
  });

  for (const layer of ['changesQueued', 'changesRunning']) {
    it(`honors a ${layer} deletion instead of resurrecting a database node`, async () => {
      const { adapter, db } = storage();
      adapter[layer]['/notes/a'] = false;
      expect(await adapter.getNodes(['/notes/a'])).to.deep.equal({ '/notes/a': undefined });
      expect(db.transaction.called).to.equal(false);
    });
  }

  it('accepts setNodes and exposes the optimistic value before the commit finishes', async () => {
    const { adapter, transaction } = storage();
    await adapter.setNodes({ '/notes/a': node('accepted') });
    // No transaction completion has been delivered yet.
    expect(adapter.putsRunning).to.equal(1);
    expect((await adapter.getNodes(['/notes/a']))['/notes/a'].common.body).to.equal('accepted');
    transaction.oncomplete();
    await Promise.resolve();
    expect(adapter.putsRunning).to.equal(0);
  });

  it('does not resolve a database read until its transaction completes', async () => {
    const { adapter, db, transaction, requests } = storage();
    let settled = false;
    const result = adapter.getNodesFromDb(['/notes/a']).then(value => { settled = true; return value; });
    expect(db.transaction.firstCall.args).to.deep.equal([['nodes'], 'readonly']);
    requests.get('/notes/a').onsuccess({ target: { result: node('stored') } });
    await Promise.resolve();
    expect(settled).to.equal(false);
    transaction.oncomplete();
    expect((await result)['/notes/a'].common.body).to.equal('stored');
    expect(adapter.getsRunning).to.equal(0);
  });

  for (const event of ['onerror', 'onabort']) {
    it(`rejects a failed database read on ${event}`, async () => {
      const { adapter, transaction } = storage();
      const result = adapter.getNodesFromDb(['/notes/a']);
      transaction[event]();
      await result.then(
        () => { throw new Error('Expected transaction rejection'); },
        error => expect(error).to.equal('get transaction error/abort')
      );
      expect(adapter.getsRunning).to.equal(0);
    });

    it(`rejects a failed explicit database write on ${event}`, async () => {
      const { adapter, transaction } = storage();
      const result = adapter.setNodesInDb({ '/notes/a': node('uncommitted') });
      transaction[event]();
      await result.then(
        () => { throw new Error('Expected transaction rejection'); },
        error => expect(error).to.equal(event === 'onabort' ? 'transaction abort' : 'transaction error')
      );
      expect(adapter.putsRunning).to.equal(0);
    });
  }

  it('writes documents and deletions in one readwrite transaction', async () => {
    const { adapter, db, transaction, store } = storage();
    const document = node('saved');
    const result = adapter.setNodesInDb({ '/notes/a': document, '/notes/b': undefined });
    expect(db.transaction.firstCall.args).to.deep.equal([['nodes'], 'readwrite']);
    expect(store.put.firstCall.args).to.deep.equal([document]);
    expect(store.delete.firstCall.args).to.deep.equal(['/notes/b']);
    transaction.oncomplete();
    await result;
    expect(adapter.putsRunning).to.equal(0);
  });
});
