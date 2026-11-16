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

  it('refreshes the watched container for membership events but ignores unrelated URLs and malformed messages', async () => {
    await notifications.reconcile();
    sockets[1].onmessage({ data: JSON.stringify({ type: 'Add', object: POD + 'notes/nested/new', target: POD + 'notes/nested/' }) });
    expect(rs.sync.refreshRemote.lastCall.args).to.deep.equal(['/notes/nested/']);
    sockets[1].onmessage({ data: JSON.stringify({ type: 'Update', object: 'https://elsewhere.example/secret' }) });
    sockets[1].onmessage({ data: '{broken' });
    sockets[1].onmessage({ data: null });
    expect(rs.sync.refreshRemote.callCount).to.equal(1);
  });

  it('recovers every cached permitted resource without requiring notification support', async () => {
    solid.session.fetch.resolves(response(null, POD));
    nodes.push({ path: '/private/secret' });
    notifications.recovery = true;
    await notifications.reconcile();
    expect(rs.sync.refreshRemote.getCalls().map(call => call.args[0])).to.deep.equal(nodes.slice(0, 3).map(node => node.path));
    expect(sockets).to.have.length(0);
  });

  it('bounds channel count while recovery still covers the entire cache', async () => {
    nodes = Array.from({ length: 80 }, (_, index) => ({ path: '/notes/' + index }));
    notifications.recovery = true;
    await notifications.reconcile();
    expect(sockets).to.have.length(64);
    expect(rs.sync.refreshRemote.callCount).to.equal(80);
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
    expect(rs.sync.refreshRemote.callCount).to.equal(3);
    window.dispatchEvent(new Event('online'));
    await clock.tickAsync(101);
    document.dispatchEvent(new Event('visibilitychange'));
    await clock.tickAsync(101);
    expect(rs.sync.refreshRemote.callCount).to.equal(9);
    await notifications.stop();
    window.dispatchEvent(new Event('online'));
    await clock.tickAsync(101);
    expect(rs.sync.refreshRemote.callCount).to.equal(9);
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
      local: new InMemoryStorage(),
      remote: { connected: true, online: true, folderETagsAreRecursive: false, get: sinon.stub().resolves({ statusCode: 304, revision: 'r1' }) },
      access: { checkPathPermission: () => true },
      caching: { onActivate() {}, checkPath: () => 'ALL' },
      _emit: sinon.spy()
    };
    sync = new Sync(rs);
    sinon.stub(sync, 'doTasks');
  });
  afterEach(() => sinon.restore());

  it('keeps descendant checks even when an ancestor is queued', () => {
    sync.addTask('/notes/');
    sync.refreshRemote('/notes/nested/file');
    sync.deleteChildPathsFromTasks();
    expect(Object.keys(sync._tasks)).to.have.members(['/notes/', '/notes/nested/file']);
  });

  it('periodically checks every stale cached node despite unchanged ancestor revisions', async () => {
    await rs.local.setNodes(Object.fromEntries(['/notes/', '/notes/nested/', '/notes/nested/file'].map(path =>
      [path, { path, common: { revision: 'unchanged', timestamp: 0, ...(path.endsWith('/') ? { itemsMap: {} } : { body: 'old' }) } }])));
    await sync.collectRefreshTasks();
    expect(Object.keys(sync._tasks)).to.have.members(['/notes/', '/notes/nested/', '/notes/nested/file']);
  });

  it('preserves the recursive-folder optimization for other backends', () => {
    delete rs.remote.folderETagsAreRecursive;
    sync.addTask('/notes/');
    sync.addTask('/notes/nested/file');
    sync.deleteChildPathsFromTasks();
    expect(Object.keys(sync._tasks)).to.deep.equal(['/notes/']);
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
});
