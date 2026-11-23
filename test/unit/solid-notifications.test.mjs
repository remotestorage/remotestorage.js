import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { SolidNotifications } from '../../build/solid-notifications.js';
import { Sync } from '../../build/sync.js';
import InMemoryStorage from '../../build/inmemorystorage.js';

const POD = 'https://pod.example/';
const SERVICE = POD + '.notifications/WebSocketChannel2023/';
const description = `@prefix notify: <http://www.w3.org/ns/solid/notifications#>.
  <${POD}description> notify:subscription <${SERVICE}>.
  <${SERVICE}> notify:channelType notify:WebSocketChannel2023; notify:feature notify:endAt.`;

function response(body, url, headers = {}, status = 200) {
  const result = new Response(body, { status, headers });
  Object.defineProperty(result, 'url', { value: url });
  return result;
}

describe('Solid notifications', () => {
  let clock, notifications, rs, solid, nodes, sockets, globals;

  beforeEach(() => {
    clock = sinon.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    globals = { window: globalThis.window, document: globalThis.document, WebSocket: globalThis.WebSocket };
    globalThis.window = new EventTarget();
    globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    sockets = [];
    globalThis.WebSocket = class {
      constructor(url) { this.url = url; this.close = sinon.spy(); sockets.push(this); }
    };
    nodes = [{ path: '/notes/' }, { path: '/notes/nested/' }, { path: '/notes/nested/a.json' }];
    rs = {
      on: sinon.spy(), removeEventListener: sinon.spy(),
      local: { forAllNodes: async cb => { nodes.forEach(cb); } },
      access: { checkPathPermission: path => path.startsWith('/notes/') },
      caching: { checkPath: () => 'ALL' },
      sync: { refreshRemote: sinon.spy() }
    };
    let id = 0;
    solid = {
      getFileURL: path => POD + path.slice(1),
      session: { fetch: sinon.stub().callsFake(async (url, init = {}) => {
        if (init.method === 'HEAD') {
          return response(null, url, { Link: `<${POD}description>; rel="http://www.w3.org/ns/solid/terms#storageDescription"` });
        }
        if (init.method === 'POST') {
          return response(JSON.stringify({ id: SERVICE + ++id, receiveFrom: 'wss://pod.example/socket/' + id }), url);
        }
        if (init.method === 'DELETE') { return response(null, url, {}, 204); }
        return response(description, url, { 'Content-Type': 'text/turtle' });
      }) }
    };
    notifications = new SolidNotifications(rs, solid);
    // Explicitly await reconciliation instead of racing real I/O with timers.
    notifications.active = true;
  });

  afterEach(async () => {
    await notifications.stop();
    Object.assign(globalThis, globals);
    clock.restore();
    sinon.restore();
  });

  it('discovers the service from Turtle and subscribes separately to files and containers', async () => {
    await notifications.reconcile();
    const posts = solid.session.fetch.getCalls().filter(call => call.args[1].method === 'POST');
    expect(posts.map(call => JSON.parse(call.args[1].body).topic)).to.deep.equal(nodes.map(node => solid.getFileURL(node.path)));
    expect(JSON.parse(posts[0].args[1].body).endAt).to.be.a('string');
    expect(sockets).to.have.length(3);
  });

  it('revalidates after the socket opens, then refreshes the exact changed file', async () => {
    await notifications.reconcile();
    sockets[2].onopen();
    expect(rs.sync.refreshRemote.lastCall.args).to.deep.equal(['/notes/nested/a.json']);
    sockets[2].onmessage({ data: JSON.stringify({ type: 'Update', object: POD + 'notes/nested/a.json' }) });
    expect(rs.sync.refreshRemote.callCount).to.equal(2);
  });

  it('only suppresses polling for the exact opened, unexpired resource', async () => {
    const path = '/notes/nested/';
    await notifications.reconcile();
    const socket = sockets[1];
    expect(notifications.hasActiveSubscription(path)).to.equal(false);
    socket.readyState = 1;
    expect(notifications.hasActiveSubscription(path)).to.equal(false);
    socket.onopen();
    expect(rs.sync.refreshRemote.calledWith(path)).to.equal(true);
    expect(notifications.hasActiveSubscription(path)).to.equal(true);
    expect(notifications.hasActiveSubscription('/notes/nested/a.json')).to.equal(false);
    socket.readyState = 2;
    expect(notifications.hasActiveSubscription(path)).to.equal(false);
    socket.readyState = 1;
    await clock.tickAsync(30 * 60 * 1000);
    expect(notifications.hasActiveSubscription(path)).to.equal(false);
  });

  it('resumes polling during renewal and revalidates before suppressing it again', async () => {
    const path = '/notes/nested/a.json';
    await notifications.reconcile();
    sockets[2].readyState = 1;
    sockets[2].onopen();
    expect(notifications.hasActiveSubscription(path)).to.equal(true);
    await clock.tickAsync(30 * 60 * 1000);
    await notifications.reconcile();
    expect(notifications.hasActiveSubscription(path)).to.equal(false);
    sockets[5].readyState = 1;
    sockets[5].onopen();
    expect(rs.sync.refreshRemote.callCount).to.equal(2);
    expect(notifications.hasActiveSubscription(path)).to.equal(true);
    sockets[5].onclose();
    expect(notifications.hasActiveSubscription(path)).to.equal(false);
    await notifications.stop();
    expect(notifications.hasActiveSubscription(path)).to.equal(false);
  });

  it('refreshes the watched container for membership events but ignores unrelated URLs and malformed messages', async () => {
    await notifications.reconcile();
    sockets[1].onmessage({ data: JSON.stringify({ type: 'Add', object: POD + 'notes/nested/new', target: POD + 'notes/nested/' }) });
    expect(rs.sync.refreshRemote.lastCall.args).to.deep.equal(['/notes/nested/']);
    sockets[1].onmessage({ data: JSON.stringify({ type: 'Update', object: 'https://elsewhere.example/secret' }) });
    sockets[1].onmessage({ data: '{broken' });
    sockets[1].onmessage({ data: null });
    expect(rs.sync.refreshRemote.callCount).to.equal(1);
  });

  it('recovers cached folders without redundant file reads or notification support', async () => {
    solid.session.fetch.resolves(response(null, POD));
    nodes.push({ path: '/private/secret' });
    notifications.recovery = true;
    await notifications.reconcile();
    expect(rs.sync.refreshRemote.getCalls().map(call => call.args[0])).to.deep.equal(['/notes/', '/notes/nested/']);
    expect(sockets).to.have.length(0);
  });

  it('bounds channels to eight and paces recovery over the entire cache', async () => {
    nodes = Array.from({ length: 80 }, (_, index) => ({ path: '/notes/' + index }));
    notifications.recovery = true;
    await notifications.reconcile();
    expect(sockets).to.have.length(8);
    expect(rs.sync.refreshRemote.callCount).to.equal(2);
    await clock.tickAsync(39000);
    expect(rs.sync.refreshRemote.callCount).to.equal(80);
  });

  it('cancels queued recovery when the session is stopped', async () => {
    nodes = Array.from({ length: 10 }, (_, index) => ({ path: '/notes/' + index }));
    notifications.recovery = true;
    await notifications.reconcile();
    expect(rs.sync.refreshRemote.callCount).to.equal(2);
    await notifications.stop();
    await clock.tickAsync(10000);
    expect(rs.sync.refreshRemote.callCount).to.equal(2);
    expect(notifications.recoveryQueue.size).to.equal(0);
  });

  it('bounds simultaneous subscriptions to four', async () => {
    nodes = Array.from({ length: 10 }, (_, index) => ({ path: '/notes/' + index }));
    let inFlight = 0, maximum = 0;
    const fetch = solid.session.fetch;
    solid.session.fetch = async (url, init) => {
      if (init?.method !== 'POST') { return fetch(url, init); }
      maximum = Math.max(maximum, ++inFlight);
      await Promise.resolve();
      const result = await fetch(url, init);
      inFlight--;
      return result;
    };
    await notifications.reconcile();
    expect(maximum).to.equal(4);
  });

  it('backs off failed channels and revalidates after reconnection', async () => {
    await notifications.reconcile();
    const old = sockets[2];
    old.onclose();
    await notifications.reconcile();
    expect(sockets).to.have.length(3);
    await clock.tickAsync(3000);
    await notifications.reconcile();
    expect(sockets).to.have.length(4);
    sockets[3].onopen();
    expect(rs.sync.refreshRemote.lastCall.args).to.deep.equal(['/notes/nested/a.json']);
    expect(old.close.calledOnce).to.equal(true);
  });

  it('removes subscriptions when a resource leaves the cache', async () => {
    await notifications.reconcile();
    nodes.pop();
    await notifications.reconcile();
    expect(sockets[2].close.calledOnce).to.equal(true);
    expect(notifications.watches.size).to.equal(2);
  });

  it('ignores delayed callbacks belonging to a replaced socket', async () => {
    await notifications.reconcile();
    const staleClose = sockets[2].onclose;
    const staleMessage = sockets[2].onmessage;
    sockets[2].onclose();
    await clock.tickAsync(3000);
    await notifications.reconcile();
    staleClose();
    staleMessage({ data: JSON.stringify({ object: POD + 'notes/nested/a.json' }) });
    expect(sockets[3].close.called).to.equal(false);
    expect(rs.sync.refreshRemote.called).to.equal(false);
  });

  it('disposes of a late subscription response instead of opening a socket after shutdown', async () => {
    nodes = nodes.slice(0, 1);
    let resolve;
    solid.session.fetch.withArgs(SERVICE).returns(new Promise(done => { resolve = done; }));
    const pending = notifications.reconcile();
    // Discovery includes asynchronous RDF stream parsing.
    while (!solid.session.fetch.getCalls().some(call => call.args[1].method === 'POST')) {
      await new Promise(done => setImmediate(done));
    }
    await notifications.stop();
    resolve(response(JSON.stringify({ id: SERVICE + 'late', receiveFrom: 'wss://pod.example/socket' }), SERVICE));
    await pending;
    expect(sockets).to.have.length(0);
    expect(solid.session.fetch.getCalls().some(call => call.args[0] === SERVICE + 'late' && call.args[1].method === 'DELETE')).to.equal(true);
  });

  it('recovers on browser online and foreground events, and removes those listeners on stop', async () => {
    solid.session.fetch.resolves(response(null, POD));
    notifications.active = false;
    notifications.start();
    await clock.tickAsync(101);
    expect(rs.sync.refreshRemote.callCount).to.equal(2);
    window.dispatchEvent(new Event('online'));
    await clock.tickAsync(101);
    document.dispatchEvent(new Event('visibilitychange'));
    await clock.tickAsync(101);
    expect(rs.sync.refreshRemote.callCount).to.equal(2);
    await clock.tickAsync(60000);
    window.dispatchEvent(new Event('online'));
    await clock.tickAsync(101);
    expect(rs.sync.refreshRemote.callCount).to.equal(4);
    await notifications.stop();
    window.dispatchEvent(new Event('online'));
    await clock.tickAsync(101);
    expect(rs.sync.refreshRemote.callCount).to.equal(4);
  });

  it('renews expired channels and retires sockets with stalled handshakes', async () => {
    await notifications.reconcile();
    await clock.tickAsync(31000);
    await notifications.reconcile();
    expect(sockets).to.have.length(6);
    expect(sockets.slice(0, 3).every(socket => socket.close.calledOnce)).to.equal(true);
  });

  it('closes sockets and ignores queued messages after shutdown', async () => {
    await notifications.reconcile();
    const delayed = sockets[2].onmessage;
    await notifications.stop();
    delayed({ data: JSON.stringify({ object: POD + 'notes/nested/a.json' }) });
    expect(rs.sync.refreshRemote.called).to.equal(false);
    expect(sockets.every(socket => socket.close.calledOnce)).to.equal(true);
    expect(notifications.watches.size).to.equal(0);
  });

  it('does not DELETE an arbitrary channel identifier supplied by a server', async () => {
    solid.session.fetch.withArgs(SERVICE).resolves(response(JSON.stringify({
      id: POD + 'notes/valuable-file', receiveFrom: 'wss://pod.example/socket'
    }), SERVICE));
    await notifications.reconcile();
    await notifications.stop();
    expect(solid.session.fetch.getCalls().some(call => call.args[0] === POD + 'notes/valuable-file')).to.equal(false);
  });
});

describe('Solid sync recovery', () => {
  let rs, sync;
  beforeEach(() => {
    rs = {
      backend: 'solid',
      local: new InMemoryStorage(),
      remote: { connected: true, online: true, folderETagsAreRecursive: false, get: sinon.stub().resolves({ statusCode: 304, revision: 'r1' }) },
      access: { checkPathPermission: () => true },
      caching: { onActivate() {}, checkPath: () => 'ALL' },
      _emit: sinon.spy()
    };
    sync = new Sync(rs);
    rs.sync = sync;
    sinon.stub(sync, 'doTasks');
  });
  afterEach(() => sinon.restore());

  it('leaves idle sync-done unchanged for other backends', async () => {
    rs.backend = 'remotestorage';
    await sync.sync();
    expect(rs._emit.calledWith('sync-done')).to.equal(false);
  });

  it('applies the Solid recovery minimum without delaying writes or explicit invalidation', async () => {
    const path = '/notes/file';
    rs.remote.minRefreshInterval = 60000;
    sinon.stub(sync, 'now').returns(50000);
    await rs.local.setNodes({ [path]: { path, common: { revision: 'r1', timestamp: 1000, body: 'cached' } } });
    await sync.collectRefreshTasks();
    expect(sync.hasTasks()).to.equal(false);
    sync.refreshRemote(path);
    expect(sync._tasks).to.have.property(path);
    delete sync._tasks[path];
    sync.remoteChanges.clear();
    sync.now.returns(62000);
    await sync.collectRefreshTasks();
    expect(sync._tasks).to.have.property(path);
  });

  it('keeps a new local edit after an ETag-less PUT and its own notification readback', async () => {
    const path = '/notes/file';
    await rs.local.setNodes({ [path]: { path,
      common: { revision: 'r1', body: 'old', contentType: 'text/plain' },
      local: { body: 'first edit', contentType: 'text/plain' },
      push: { body: 'first edit', contentType: 'text/plain' }
    } });
    await sync.completePush(path, 'put', false, undefined);
    let nodes = await rs.local.getNodes([path]);
    nodes[path].local = { body: 'second edit', contentType: 'text/plain' };
    await rs.local.setNodes(nodes);
    rs.remote.get.resolves({ statusCode: 200, body: 'first edit', contentType: 'text/plain', revision: 'verified' });
    rs.remote.put = sinon.stub().resolves({ statusCode: 200, revision: 'next' });
    const changes = sinon.spy(rs.local, 'emitChange');
    sync.refreshRemote(path);
    const read = await sync.doTask(path);
    await sync.handleResponse(path, read.action, await read.promise);
    nodes = await rs.local.getNodes([path]);
    expect(nodes[path].local.body).to.equal('second edit');
    expect(nodes[path].common.revision).to.equal('verified');
    expect(changes.called).to.equal(false);
    const write = await sync.doTask(path);
    expect(write.action).to.equal('put');
    expect(rs.remote.put.lastCall.args).to.deep.equal([path, 'second edit', 'text/plain', { ifMatch: 'verified' }]);
  });

  it('keeps descendant checks even when an ancestor is queued', () => {
    sync.addTask('/notes/');
    sync.refreshRemote('/notes/nested/file');
    sync.deleteChildPathsFromTasks();
    expect(Object.keys(sync._tasks)).to.have.members(['/notes/', '/notes/nested/file']);
  });

  it('checks all cached containers despite unchanged ancestors without duplicate file GETs', async () => {
    await rs.local.setNodes(Object.fromEntries(['/notes/', '/notes/nested/', '/notes/nested/file'].map(path =>
      [path, { path, common: { revision: 'unchanged', timestamp: 0, ...(path.endsWith('/') ? { itemsMap: {} } : { body: 'old' }) } }])));
    await sync.collectRefreshTasks();
    expect(Object.keys(sync._tasks)).to.have.members(['/notes/', '/notes/nested/']);
  });

  it('preserves the recursive-folder optimization for other backends', () => {
    delete rs.remote.folderETagsAreRecursive;
    sync.addTask('/notes/');
    sync.addTask('/notes/nested/file');
    sync.deleteChildPathsFromTasks();
    expect(Object.keys(sync._tasks)).to.deep.equal(['/notes/']);
  });

  it('keeps container recovery and explicit file invalidation despite subscriptions', async () => {
    const paths = ['/notes/', '/notes/nested/', '/notes/nested/file'];
    await rs.local.setNodes(Object.fromEntries(paths.map(path =>
      [path, { path, common: { revision: 'r1', timestamp: 0 } }])));
    rs.remote.hasActiveSubscription = path => path === '/notes/nested/';
    await sync.collectRefreshTasks();
    expect(Object.keys(sync._tasks)).to.have.members(['/notes/', '/notes/nested/']);
    sync.refreshRemote('/notes/nested/file');
    expect(Object.keys(sync._tasks)).to.have.members(paths);
    const task = await sync.doTask('/notes/nested/');
    expect(task.action).to.equal('get');
    expect(rs.remote.get.lastCall.args).to.deep.equal(['/notes/nested/', { ifNoneMatch: 'r1' }]);
  });

  it('completes an idle subscribed cycle and polls again after subscription failure', async () => {
    const path = '/notes/file';
    await rs.local.setNodes({ [path]: { path, common: { revision: 'r1', timestamp: 0, body: 'cached' } } });
    rs.remote.hasActiveSubscription = () => true;
    await sync.sync();
    expect(sync.hasTasks()).to.equal(false);
    expect(sync.done).to.equal(true);
    expect(rs._emit.calledWith('sync-done', { completed: true })).to.equal(true);
    rs.remote.hasActiveSubscription = () => false;
    await sync.sync();
    expect(sync._tasks).to.have.property(path);
  });

  it('keeps a notification received during a request for the next request', async () => {
    const path = '/notes/file';
    await rs.local.setNodes({ [path]: { path, common: { revision: 'r1', body: 'old' } } });
    sync.refreshRemote(path);
    const task = await sync.doTask(path);
    sync.refreshRemote(path);
    sinon.stub(sync, 'collectTasks').resolves();
    await sync.finishSuccessfulTask(task, true);
    expect(sync._tasks).to.have.property(path);
    await sync.doTask(path);
    expect(rs.remote.get.callCount).to.equal(2);
  });

  it('revalidates local edits through normal conflict handling before pushing', async () => {
    const path = '/notes/file';
    await rs.local.setNodes({ [path]: { path, common: { revision: 'r1', body: 'old' }, local: { body: 'mine' } } });
    sync.refreshRemote(path);
    const task = await sync.doTask(path);
    expect(task.action).to.equal('get');
    expect(rs.remote.get.firstCall.args).to.deep.equal([path, { ifNoneMatch: 'r1' }]);
    expect((await rs.local.getNodes([path]))[path].local.body).to.equal('mine');
  });

  it('retains invalidations while synchronization is stopped', () => {
    sync.stopped = true;
    sync.refreshRemote('/notes/file');
    expect(sync.doTasks.called).to.equal(false);
    expect(sync._tasks).to.have.property('/notes/file');
  });

  it('discards a pending notification fetch when the session changes during cache lookup', async () => {
    const path = '/notes/file';
    let resolveNodes;
    sinon.stub(rs.local, 'getNodes').returns(new Promise(resolve => { resolveNodes = resolve; }));
    sync.refreshRemote(path);
    const pending = sync.doTask(path);
    rs.sync = {};
    resolveNodes({});
    const error = await pending.catch(err => err);
    expect(error.name).to.equal('SessionEndedError');
    expect(rs.remote.get.called).to.equal(false);
  });
});
