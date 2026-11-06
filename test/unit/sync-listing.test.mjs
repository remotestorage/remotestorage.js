import 'mocha';
import { expect } from 'chai';
import InMemoryStorage from '../../build/inmemorystorage.js';
import { RemoteStorage } from '../../build/remotestorage.js';
import { Sync } from '../../build/sync.js';
import config from '../../build/config.js';

function receive(sync, path, body, revision = path, statusCode = 200) {
  return sync.handleResponse(path, 'get', {
    statusCode, body, revision,
    contentType: path.endsWith('/') ? 'application/ld+json' : 'text/plain'
  });
}

describe('Sync nested folder listings', function() {
  beforeEach(function(done) {
    this.originalCache = config.cache;
    this.rs = new RemoteStorage({ cache: true });
    this.rs.on('features-loaded', () => {
      this.rs.local = new InMemoryStorage();
      this.rs.syncStopped = true;
      this.rs.sync = new Sync(this.rs);
      this.rs.sync.doTasks = () => {};
      this.rs.access.claim('foo', 'rw');
      this.rs.caching.enable('/foo/');
      this.client = this.rs.scope('/foo/');
      done();
    });
  });

  afterEach(function() {
    Sync._rs_cleanup(this.rs);
    config.cache = this.originalCache;
  });

  it('lists a remote subtree after the local upload and incoming sync complete (#1387)', async function() {
    const changes = [];
    this.rs.local.on('change', change => changes.push(change));
    await this.rs.local.put('/foo/local/doc', 'local body', 'text/plain');
    this.rs.remote.put = () => Promise.resolve({ statusCode: 201, revision: 'local-doc' });
    const task = await this.rs.sync.doTask('/foo/local/doc');
    await this.rs.sync.handleResponse(task.path, task.action, await task.promise);

    await receive(this.rs.sync, '/foo/', {
      'local/': { ETag: 'local-folder' }, 'remote/': { ETag: 'remote-folder' }
    });
    await receive(this.rs.sync, '/foo/local/', { doc: { ETag: 'local-doc' } }, 'local-folder');
    await receive(this.rs.sync, '/foo/remote/', { doc: { ETag: 'remote-doc' } }, 'remote-folder');
    await receive(this.rs.sync, '/foo/remote/doc', 'remote body', 'remote-doc');

    expect(changes.some(change => change.origin === 'remote' && change.path === '/foo/remote/doc')).to.be.true;
    expect(await this.client.getListing('remote/', false)).to.deep.equal({ doc: true });
    expect(await this.client.getListing('', false)).to.deep.equal({ 'local/': true, 'remote/': true });
    const nodes = await this.rs.local.getNodes(['/foo/', '/foo/local/doc']);
    expect(nodes['/foo/'].local).to.be.undefined;
    expect(nodes['/foo/local/doc'].local).to.be.undefined;
  });

  it('propagates a fetched document through multiple pending folder listings', async function() {
    await this.rs.local.put('/foo/existing', 'pending', 'text/plain');
    await receive(this.rs.sync, '/foo/', { 'remote/': { ETag: 'remote' } });
    await receive(this.rs.sync, '/foo/remote/', { 'nested/': { ETag: 'nested' } });
    await receive(this.rs.sync, '/foo/remote/nested/', { doc: { ETag: 'doc' } });
    await receive(this.rs.sync, '/foo/remote/nested/doc', 'remote body');

    expect(await this.client.getListing('', false)).to.deep.equal({ existing: true, 'remote/': true });
    expect(await this.client.getListing('remote/', false)).to.deep.equal({ 'nested/': true });
    const nodes = await this.rs.local.getNodes(['/foo/existing']);
    expect(nodes['/foo/existing'].local.body).to.equal('pending');
  });

  it('keeps unfetched sibling folders hidden until their documents arrive', async function() {
    await this.rs.local.setNodes({
      '/foo/': {
        path: '/foo/',
        common: { itemsMap: { 'one/': true, 'two/': true } },
        local: { itemsMap: { 'one/': false, 'two/': false } }
      }
    });
    await receive(this.rs.sync, '/foo/one/', { doc: { ETag: 'one-doc' } });
    await receive(this.rs.sync, '/foo/one/doc', 'one');
    expect(await this.client.getListing('', false)).to.deep.equal({ 'one/': true });

    await receive(this.rs.sync, '/foo/two/', { doc: { ETag: 'two-doc' } });
    await receive(this.rs.sync, '/foo/two/doc', 'two');
    expect(await this.client.getListing('', false)).to.deep.equal({ 'one/': true, 'two/': true });
    const nodes = await this.rs.local.getNodes(['/foo/']);
    expect(nodes['/foo/'].local).to.be.undefined;
  });

  it('preserves a local deletion when the folder and document are unchanged remotely', async function() {
    await this.rs.local.setNodes({
      '/': { path: '/', common: { itemsMap: { 'foo/': true } } },
      '/foo/': { path: '/foo/', common: { itemsMap: { 'remote/': true } } },
      '/foo/remote/': { path: '/foo/remote/', common: { itemsMap: { doc: true } } },
      '/foo/remote/doc': {
        path: '/foo/remote/doc',
        common: { body: 'old body', contentType: 'text/plain', revision: 'doc' }
      }
    });
    await this.rs.local.delete('/foo/remote/doc', true);
    await receive(this.rs.sync, '/foo/', { 'remote/': { ETag: 'folder' } });
    await receive(this.rs.sync, '/foo/remote/', { doc: { ETag: 'doc' } }, 'folder');
    await receive(this.rs.sync, '/foo/remote/doc', 'old body', 'doc');

    expect(await this.client.getListing('', false)).to.deep.equal({});
    expect(await this.client.getListing('remote/', false)).to.deep.equal({});
    const nodes = await this.rs.local.getNodes(['/foo/remote/doc']);
    expect(nodes['/foo/remote/doc'].local.body).to.equal(false);
  });

  it('does not list an empty or missing remote folder as an incoming subtree', async function() {
    await this.rs.local.setNodes({
      '/foo/': {
        path: '/foo/',
        common: { itemsMap: { 'empty/': true, 'missing/': true } },
        local: { itemsMap: { 'empty/': false, 'missing/': false } }
      }
    });
    await receive(this.rs.sync, '/foo/empty/', {});
    await receive(this.rs.sync, '/foo/missing/', undefined, undefined, 404);
    expect(await this.client.getListing('', false)).to.deep.equal({});
  });

  it('repairs an existing hidden folder when its cached listing is confirmed by a 304', async function() {
    await this.rs.local.setNodes({
      '/foo/': {
        path: '/foo/',
        common: { itemsMap: { 'remote/': true } },
        local: { itemsMap: { 'remote/': false } }
      },
      '/foo/remote/': {
        path: '/foo/remote/', common: { itemsMap: { doc: true }, revision: 'folder' }
      }
    });
    await receive(this.rs.sync, '/foo/remote/', undefined, 'folder', 304);
    expect(await this.client.getListing('', false)).to.deep.equal({ 'remote/': true });
  });

  it('updates a retained listing even when the fetched document is flushed', async function() {
    this.rs.caching.disable('/foo/');
    await this.rs.local.setNodes({
      '/foo/': {
        path: '/foo/',
        common: { itemsMap: { incoming: true } },
        local: { itemsMap: { incoming: false, pending: true } }
      }
    });
    await receive(this.rs.sync, '/foo/incoming', 'incoming body');
    const nodes = await this.rs.local.getNodes(['/foo/', '/foo/incoming']);
    expect(nodes['/foo/'].local.itemsMap).to.deep.equal({ incoming: true, pending: true });
    expect(nodes['/foo/incoming']).to.be.undefined;
  });
  for (const status of [200, 304]) {
    for (const operation of ['put', 'delete']) {
      for (const first of ['sync', 'local']) {
        it(`preserves ${operation} with ${first} reading first during ${status} ancestor reconciliation (#1413)`, async function() {
          await this.rs.local.setNodes({
            '/foo/': {
              path: '/foo/', common: { itemsMap: { 'remote/': true, existing: true } },
              local: { itemsMap: { 'remote/': false, existing: true } }
            },
            '/foo/remote/': { path: '/foo/remote/', common: { itemsMap: { doc: true }, revision: 'folder' } },
            '/foo/remote/doc': { path: '/foo/remote/doc', common: { body: 'remote', contentType: 'text/plain', revision: 'doc' } },
            '/foo/existing': { path: '/foo/existing', common: { body: 'old', contentType: 'text/plain', revision: 'old' } }
          });
          const local = this.rs.local;
          const getNodes = local.getNodes.bind(local);
          let paused, resume;
          const reached = new Promise(resolve => { paused = resolve; });
          const gate = new Promise(resolve => { resume = resolve; });
          let intercepted = false;
          local.getNodes = async paths => {
            const snapshot = await getNodes(paths);
            if (!intercepted && paths.includes('/foo/')) {
              intercepted = true;
              paused();
              await gate;
            }
            return snapshot;
          };
          const sync = () => receive(this.rs.sync, '/foo/remote/doc', 'remote', 'doc', status);
          const write = () => operation === 'put'
            ? local.put('/foo/new', 'pending', 'text/plain')
            : local.delete('/foo/existing', true);
          try {
            const one = first === 'sync' ? sync() : write();
            await reached;
            const two = first === 'sync' ? write() : sync();
            // Let the competing operation attempt its read before releasing the snapshot.
            await new Promise(resolve => setImmediate(resolve));
            resume();
            await Promise.all([one, two]);
          } finally {
            resume();
            local.getNodes = getNodes;
          }
          const listing = await this.client.getListing('', false);
          expect(listing).to.deep.equal(operation === 'put'
            ? { 'remote/': true, existing: true, new: true }
            : { 'remote/': true });
          const nodes = await local.getNodes([operation === 'put' ? '/foo/new' : '/foo/existing']);
          expect(nodes[operation === 'put' ? '/foo/new' : '/foo/existing'].local.body)
            .to.equal(operation === 'put' ? 'pending' : false);
        });
      }
    }
  }

  for (const phase of ['prepare push', 'fetch', 'complete put', 'complete delete', 'failure']) {
    for (const operation of ['put', 'delete']) {
      it(`preserves concurrent ${operation} of the same document during ${phase}`, async function() {
        const local = this.rs.local;
        const path = '/foo/doc';
        const deleted = phase === 'complete delete';
        const node = {
          path, common: { body: 'base', contentType: 'text/plain', revision: 'base' },
          local: { body: deleted ? false : 'old', contentType: 'text/plain' },
          push: { body: deleted ? false : 'old', contentType: 'text/plain' }
        };
        if (phase === 'fetch') { delete node.local; delete node.push; }
        await local.setNodes({ [path]: node });
        this.rs.remote.put = () => Promise.resolve({ statusCode: 201 });
        const getNodes = local.getNodes.bind(local);
        let paused, resume;
        const reached = new Promise(resolve => { paused = resolve; });
        const gate = new Promise(resolve => { resume = resolve; });
        let intercepted = false;
        local.getNodes = async paths => {
          const snapshot = await getNodes(paths);
          if (!intercepted && paths.includes(path)) {
            intercepted = true;
            paused();
            await gate;
          }
          return snapshot;
        };
        let sync;
        try {
          if (phase === 'prepare push') { sync = this.rs.sync.doTask(path); }
          else if (phase === 'fetch') { sync = receive(this.rs.sync, path, 'remote'); }
          else {
            sync = this.rs.sync.handleResponse(path, deleted ? 'delete' : 'put', {
              statusCode: phase === 'failure' ? 500 : 201, revision: 'next'
            });
          }
          // Attach a rejection handler before the injected failure settles.
          if (phase === 'failure') { sync = sync.catch(error => expect(error.message).to.include('500')); }
          await reached;
          const write = operation === 'put'
            ? local.put(path, 'new', 'text/plain') : local.delete(path, true);
          await new Promise(resolve => setImmediate(resolve));
          resume();
          await Promise.all([sync, write]);
        } finally {
          resume();
          local.getNodes = getNodes;
        }
        const nodes = await local.getNodes([path]);
        if (deleted && operation === 'delete') {
          expect(nodes[path]).to.be.undefined; // Both deletes completed; no tombstone is needed.
        } else {
          expect(nodes[path].local.body).to.equal(operation === 'put' ? 'new' : false);
        }
      });
    }
  }

  it('does not hold the local update queue while a network request is pending', async function() {
    await this.rs.local.put('/foo/doc', 'old', 'text/plain');
    this.rs.remote.put = () => new Promise(() => {});
    const task = await this.rs.sync.doTask('/foo/doc');
    expect(task.action).to.equal('put');
    await this.rs.local.put('/foo/doc', 'new', 'text/plain');
    expect((await this.rs.local.getNodes(['/foo/doc']))['/foo/doc'].local.body).to.equal('new');
  });

  it('does not resurrect flushed nodes from an earlier sync snapshot', async function() {
    const local = this.rs.local;
    await local.put('/foo/doc', 'old', 'text/plain');
    const getNodes = local.getNodes.bind(local);
    let paused, resume;
    const reached = new Promise(resolve => { paused = resolve; });
    const gate = new Promise(resolve => { resume = resolve; });
    let intercepted = false;
    local.getNodes = async paths => {
      const snapshot = await getNodes(paths);
      if (!intercepted && paths.includes('/foo/doc')) {
        intercepted = true;
        paused();
        await gate;
      }
      return snapshot;
    };
    try {
      const sync = receive(this.rs.sync, '/foo/doc', 'remote');
      await reached;
      const flush = local.flush('/foo/');
      await new Promise(resolve => setImmediate(resolve));
      resume();
      await Promise.all([sync, flush]);
    } finally {
      resume();
      local.getNodes = getNodes;
    }
    expect((await local.getNodes(['/foo/doc']))['/foo/doc']).to.be.undefined;
  });

  it('continues local writes after sync reconciliation fails', async function() {
    const local = this.rs.local;
    const getNodes = local.getNodes.bind(local);
    local.getNodes = () => Promise.reject(new Error('storage failed'));
    try {
      await receive(this.rs.sync, '/foo/doc', 'body').then(
        () => { throw new Error('Expected storage failure'); },
        error => expect(error.message).to.equal('storage failed')
      );
    } finally {
      local.getNodes = getNodes;
    }
    await local.put('/foo/new', 'pending', 'text/plain');
    expect(await this.client.getListing('', false)).to.deep.equal({ new: true });
  });

});
