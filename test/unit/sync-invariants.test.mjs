import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import InMemoryStorage from '../../build/inmemorystorage.js';
import { Sync } from '../../build/sync.js';
import config from '../../build/config.js';

const PATH = '/notes/doc';
const item = (body, contentType = 'text/plain') => ({ body, contentType });

function session() {
  const local = new InMemoryStorage();
  const rs = {
    local,
    remote: { connected: true, online: true, put: sinon.stub().resolves({ statusCode: 201 }) },
    caching: { onActivate() {}, checkPath: () => 'ALL' },
    access: { checkPathPermission: () => true },
    _emit: sinon.spy()
  };
  rs.sync = new Sync(rs);
  rs.sync.doTasks = () => {};
  return rs;
}

async function readNode(rs, path = PATH) {
  return (await rs.local.getNodes([path]))[path];
}

function receive(rs, path, body, revision = 'remote', statusCode = 200) {
  return rs.sync.handleResponse(path, 'get', { statusCode, body, revision, contentType: 'text/plain' });
}

describe('Sync invariants', () => {
  let rs;
  beforeEach(() => { rs = session(); });
  afterEach(() => sinon.restore());

  for (const [description, newer] of [
    ['a newer body', item('B')],
    ['a newer content type', item('A', 'text/markdown')],
    ['a deletion made during upload', { body: false }]
  ]) {
    it(`a PUT acknowledgement preserves ${description}`, async () => {
      await rs.local.setNodes({ [PATH]: {
        path: PATH, common: { ...item('base'), revision: 'base' }, local: newer, push: item('A')
      } });
      await rs.sync.handleResponse(PATH, 'put', { statusCode: 201, revision: 'uploaded-A' });
      const node = await readNode(rs);
      expect(node.common).to.include({ ...item('A'), revision: 'uploaded-A' });
      expect(node.local).to.deep.equal(newer);
      expect(node.push).to.equal(undefined);
    });
  }

  it('a DELETE acknowledgement preserves a document recreated while deletion was in flight', async () => {
    await rs.local.setNodes({ [PATH]: {
      path: PATH, common: { ...item('base'), revision: 'base' }, local: item('recreated'), push: { body: false }
    } });
    await rs.sync.handleResponse(PATH, 'delete', { statusCode: 204, revision: 'deleted' });
    const node = await readNode(rs);
    expect(node.local.body).to.equal('recreated');
    expect(node.push).to.equal(undefined);
    expect(node.common.body).to.equal(undefined);
  });

  it('a failed push clears its in-flight snapshot and leaves the local edit retryable', async () => {
    await rs.local.setNodes({ [PATH]: {
      path: PATH, common: {}, local: item('pending'), push: item('pending')
    } });
    await rs.sync.handleResponse(PATH, 'put', { statusCode: 503 }).then(
      () => { throw new Error('Expected HTTP failure'); },
      error => expect(error.message).to.include('503')
    );
    expect((await readNode(rs)).local.body).to.equal('pending');
    expect((await readNode(rs)).push).to.equal(undefined);
    const retry = await rs.sync.doTask(PATH);
    expect(retry.action).to.equal('put');
    expect(rs.remote.put.firstCall.args[3]).to.deep.equal({ ifNoneMatch: '*' });
    await retry.promise;
  });

  it('a known common revision protects an update with If-Match', async () => {
    await rs.local.setNodes({ [PATH]: {
      path: PATH, common: { ...item('base'), revision: 'base' }, local: item('pending')
    } });
    const task = await rs.sync.doTask(PATH);
    expect(rs.remote.put.firstCall.args[3]).to.deep.equal({ ifMatch: 'base' });
    expect((await readNode(rs)).push.body).to.equal('pending');
    await task.promise;
  });

  it('a 412 retains the local edit until the conflicting remote body is fetched', async () => {
    const clock = sinon.useFakeTimers();
    const originalEvents = config.changeEvents;
    config.changeEvents = { ...originalEvents, conflict: true };
    try {
      const changes = [];
      rs.local.on('change', change => changes.push(change));
      await rs.local.setNodes({ [PATH]: {
        path: PATH, common: { ...item('base'), revision: 'base' }, local: item('local'), push: item('local')
      } });
      await rs.sync.handleResponse(PATH, 'put', { statusCode: 412, revision: 'other' });
      expect((await readNode(rs)).local.body).to.equal('local');
      expect((await readNode(rs)).remote.revision).to.equal('other');
      expect(changes).to.deep.equal([]);
      await receive(rs, PATH, 'remote', 'other');
      const node = await readNode(rs);
      expect(node.common.body).to.equal('remote');
      expect(node.local).to.equal(undefined);
      await clock.tickAsync(10);
      expect(changes).to.have.length(1);
      expect(changes[0]).to.include({
        origin: 'conflict', oldValue: 'local', newValue: 'remote', lastCommonValue: 'base'
      });
    } finally {
      config.changeEvents = originalEvents;
    }
  });

  for (const revision of ['base', 'different']) {
    it(`a 304 for ${revision} only refreshes a matching common revision`, async () => {
      sinon.stub(rs.sync, 'now').returns(500);
      await rs.local.setNodes({ [PATH]: {
        path: PATH, common: { ...item('base'), revision: 'base', timestamp: 1 }, local: item('pending')
      } });
      await receive(rs, PATH, undefined, revision, 304);
      const node = await readNode(rs);
      expect(node.common.timestamp).to.equal(revision === 'base' ? 500 : 1);
      expect(node.common.body).to.equal('base');
      expect(node.local.body).to.equal('pending');
    });
  }

  it('FLUSH retains pending local data but drops an acknowledged clean document', async () => {
    rs.caching.checkPath = () => 'FLUSH';
    await rs.local.setNodes({ [PATH]: {
      path: PATH, common: {}, local: item('pending'), push: item('old')
    } });
    await rs.sync.handleResponse(PATH, 'put', { statusCode: 201, revision: 'old' });
    expect((await readNode(rs)).local.body).to.equal('pending');
    const task = await rs.sync.doTask(PATH);
    await task.promise;
    await rs.sync.handleResponse(PATH, 'put', { statusCode: 201, revision: 'pending' });
    expect(await readNode(rs)).to.equal(undefined);
  });

  it('a remote change event describes the merge before its cache write has completed', async () => {
    const originalEvents = config.changeEvents;
    config.changeEvents = { ...originalEvents, remote: true };
    try {
      await rs.local.setNodes({ [PATH]: { path: PATH, common: { ...item('before'), revision: 'before' } } });
      let readDuringEvent;
      rs.local.on('change', change => {
        if (change.origin === 'remote') {
          expect(change.newValue).to.equal('after');
          readDuringEvent = rs.local.get(PATH);
        }
      });
      await receive(rs, PATH, 'after');
      expect((await readDuringEvent).body).to.equal('before');
      expect((await rs.local.get(PATH)).body).to.equal('after');
    } finally {
      config.changeEvents = originalEvents;
    }
  });

  it('rejects a push acknowledgement with no in-flight snapshot instead of claiming success', async () => {
    await rs.local.setNodes({ [PATH]: { path: PATH, common: {}, local: item('pending') } });
    await rs.sync.handleResponse(PATH, 'put', { statusCode: 201 }).then(
      () => { throw new Error('Expected invalid push rejection'); },
      error => expect(error.message).to.include('no push version')
    );
    expect(rs.sync.stopped).to.equal(true);
    expect((await readNode(rs)).local.body).to.equal('pending');
  });
});

// Desired behavior, not assertions that the existing bugs are acceptable.
// Opt in to reproduce known failures on master; unskip when the fixes land.
const knownGap = process.env.RS_TEST_KNOWN_GAPS === '1' ? it : it.skip;

describe('Known sync expectation gaps', () => {
  knownGap('lists a fetched nested document through every cached ancestor (#1387, #1412)', async () => {
    const rs = session();
    await rs.local.setNodes({
      '/notes/': {
        path: '/notes/', common: { itemsMap: { 'incoming/': true, pending: true } },
        local: { itemsMap: { 'incoming/': false, pending: true } }
      },
      '/notes/incoming/': { path: '/notes/incoming/', common: { itemsMap: { doc: true } } }
    });
    await receive(rs, '/notes/incoming/doc', 'incoming');
    expect((await rs.local.get('/notes/incoming/doc')).body).to.equal('incoming');
    expect((await rs.local.get('/notes/')).body).to.have.property('incoming/', true);
  });

  knownGap('does not lose a concurrent local listing edit during fetch reconciliation (#1413)', async () => {
    const rs = session();
    await rs.local.setNodes({ '/notes/': {
      path: '/notes/', common: { itemsMap: { incoming: true } },
      local: { itemsMap: { incoming: false } }
    } });
    const getNodes = rs.local.getNodes.bind(rs.local);
    let paused, resume;
    const reached = new Promise(resolve => { paused = resolve; });
    const gate = new Promise(resolve => { resume = resolve; });
    let intercepted = false;
    rs.local.getNodes = async paths => {
      const snapshot = await getNodes(paths);
      if (!intercepted && paths.includes('/notes/')) {
        intercepted = true;
        paused();
        await gate;
      }
      return snapshot;
    };
    try {
      const sync = receive(rs, '/notes/incoming', 'incoming');
      await reached;
      const localWrite = rs.local.put('/notes/new', 'pending', 'text/plain');
      await new Promise(resolve => setImmediate(resolve));
      resume();
      await Promise.all([sync, localWrite]);
    } finally {
      resume();
      rs.local.getNodes = getNodes;
    }
    expect((await rs.local.get('/notes/new')).body).to.equal('pending');
    expect((await rs.local.get('/notes/')).body).to.have.property('new', true);
  });
});
