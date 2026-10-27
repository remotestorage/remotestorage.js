import 'mocha';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { Solid } from '../../build/solid.js';
import { SolidStorage } from '../../build/solid-storage.js';
import { RemoteStorageWithSolid } from '../../build/remotestorage-solid.js';
import { RemoteStorage } from '../../build/remotestorage.js';
import config from '../../build/config.js';
import { Authorize } from '../../build/authorize.js';
import { MemoryStorage, localStorage } from '../helpers/memoryStorage.mjs';

chai.use(chaiAsPromised);

const POD = 'https://pod.example/';

function response(body, status = 200, headers = {}, url = POD) {
  const result = new Response(body, { status, headers });
  Object.defineProperty(result, 'url', { value: url });
  return result;
}

function fakeRS() {
  return {
    _emit: sinon.spy(),
    setBackend(type) { this.backend = type; },
    on: sinon.spy()
  };
}

describe('Solid session storage', () => {
  let browser, storage;

  beforeEach(() => {
    browser = new MemoryStorage();
    storage = new SolidStorage(browser);
  });

  it('returns delegated OIDC state and other non-session keys', async () => {
    await storage.set('oidc-state', 'saved-state');
    expect(await storage.get('oidc-state')).to.equal('saved-state');
  });

  it('keeps SDK session records separate instead of merging their contents', async () => {
    await storage.set('solidClientAuthenticationUser:a', '{"issuer":"one"}');
    await storage.set('solidClientAuthenticationUser:b', '{"issuer":"two"}');
    expect(await storage.get('solidClientAuthenticationUser:a')).to.equal('{"issuer":"one"}');
    expect(await storage.get('solidClientAuthenticationUser:b')).to.equal('{"issuer":"two"}');
  });

  it('distinguishes empty stored values from missing values', async () => {
    await storage.set('empty', '');
    expect(await storage.get('empty')).to.equal('');
    expect(await storage.get('missing')).to.equal(undefined);
  });

  it('deletes only its namespaced key', async () => {
    browser.setItem('state', 'app-state');
    await storage.set('state', 'solid-state');
    await storage.delete('state');
    expect(await storage.get('state')).to.equal(undefined);
    expect(browser.getItem('state')).to.equal('app-state');
  });
});

describe('Solid backend', () => {
  let rs, solid, fetchStub, publicFetch;

  beforeEach(() => {
    localStorage.removeItem('remotestorage:solid');
    rs = fakeRS();
    solid = new Solid(rs);
    solid.selectedPodURL = POD;
    solid.connected = true;
    fetchStub = sinon.stub(solid.session, 'fetch');
    publicFetch = sinon.stub(globalThis, 'fetch').rejects(new Error('Unexpected external request'));
  });

  afterEach(() => {
    sinon.restore();
    localStorage.removeItem('remotestorage:solid');
  });

  describe('file reads', () => {
    it('preserves every byte in a binary response', async () => {
      const bytes = new Uint8Array([0, 255, 128, 65]);
      fetchStub.resolves(response(bytes, 200, { 'Content-Type': 'image/png', ETag: '"rev-1"' }));
      const result = await solid.get('/pictures/a.png');
      expect(result.body).to.be.instanceOf(ArrayBuffer);
      expect([...new Uint8Array(result.body)]).to.deep.equal([...bytes]);
      expect(result.revision).to.equal('rev-1');
    });

    for (const type of ['application/json', 'application/ld+json', 'text/plain; charset=UTF-8', 'application/xml']) {
      it('reads ' + type + ' as text', async () => {
        fetchStub.resolves(response('{"hello":true}', 200, { 'Content-Type': type, ETag: '"r"' }));
        expect((await solid.get('/file')).body).to.equal('{"hello":true}');
      });
    }

    it('uses binary data when Content-Type is absent', async () => {
      fetchStub.resolves(response(new Uint8Array([255]), 200, { ETag: '"r"' }));
      const result = await solid.get('/file');
      expect(result.contentType).to.equal('application/octet-stream');
      expect([...new Uint8Array(result.body)]).to.deep.equal([255]);
    });

    it('sends a conditional GET and returns 304 without reading a body', async () => {
      fetchStub.resolves(response(null, 304, { ETag: '"r"' }));
      const result = await solid.get('/file', { ifNoneMatch: 'r' });
      expect(fetchStub.firstCall.args[1].headers.get('If-None-Match')).to.equal('"r"');
      expect(result.statusCode).to.equal(304);
      expect(result.body).to.equal(undefined);
    });

    it('bypasses browser HTTP caching so synchronization owns freshness', async () => {
      fetchStub.resolves(response('fresh', 200, { ETag: '"r"' }));
      await solid.get('/file');
      expect(fetchStub.firstCall.args[1].cache).to.equal('no-store');
    });

    for (const status of [401, 403, 404, 429, 503]) {
      it('preserves HTTP status ' + status, async () => {
        fetchStub.resolves(response(null, status));
        expect((await solid.get('/file')).statusCode).to.equal(status);
      });
    }

    it('fails clearly when a file has no exposed ETag', async () => {
      fetchStub.resolves(response('content'));
      await expect(solid.get('/file')).to.be.rejectedWith('must expose an ETag');
    });

    it('rejects weak file validators that cannot protect an If-Match write', async () => {
      fetchStub.resolves(response('content', 200, { ETag: 'W/"weak"' }));
      await expect(solid.get('/file')).to.be.rejectedWith('strong ETags');
    });
  });

  describe('conditional mutations', () => {
    for (const status of [200, 201, 204, 205]) {
      it('normalizes successful PUT ' + status + ' for BaseClient', async () => {
        fetchStub.resolves(response(null, status, { ETag: '"r"' }));
        expect((await solid.put('/file', 'content', 'text/plain')).statusCode).to.equal(201);
      });
    }

    for (const status of [200, 204, 205]) {
      it('normalizes successful DELETE ' + status, async () => {
        fetchStub.resolves(response(null, status));
        expect((await solid.delete('/file')).statusCode).to.equal(200);
      });
    }

    it('sends If-Match with the PUT itself and returns the written revision', async () => {
      fetchStub.resolves(response(null, 201, { ETag: '"new"' }));
      const body = new Uint8Array([255, 0]);
      const result = await solid.put('/file', body, 'image/png', { ifMatch: 'old' });
      expect(fetchStub.callCount).to.equal(1);
      const [url, init] = fetchStub.firstCall.args;
      expect(url).to.equal(POD + 'file');
      expect(init.method).to.equal('PUT');
      expect(init.body).to.equal(body);
      expect(init.headers.get('If-Match')).to.equal('"old"');
      expect(init.headers.get('Content-Type')).to.equal('image/png');
      expect(result.revision).to.equal('new');
    });

    it('creates only if absent, without a racy preliminary GET', async () => {
      fetchStub.resolves(response(null, 412));
      const result = await solid.put('/file', 'new', 'text/plain', { ifNoneMatch: '*' });
      expect(fetchStub.callCount).to.equal(1);
      expect(fetchStub.firstCall.args[1].headers.get('If-None-Match')).to.equal('*');
      expect(result.statusCode).to.equal(412);
    });

    it('returns a stale PUT conflict without retrying unconditionally', async () => {
      fetchStub.resolves(response(null, 412, { ETag: '"other-writer"' }));
      expect((await solid.put('/file', 'new', 'text/plain', { ifMatch: 'old' })).statusCode).to.equal(412);
      expect(fetchStub.callCount).to.equal(1);
    });

    it('does not associate a later HEAD revision with a PUT that omitted ETag', async () => {
      fetchStub.resolves(response(null, 204));
      const result = await solid.put('/file', 'new', 'text/plain', { ifMatch: 'old' });
      expect(result.revision).to.equal(undefined);
      expect(fetchStub.callCount).to.equal(1);
    });

    it('sends If-Match on DELETE and preserves a conflict', async () => {
      fetchStub.resolves(response(null, 412));
      expect((await solid.delete('/file', { ifMatch: '"old"' })).statusCode).to.equal(412);
      expect(fetchStub.firstCall.args[1].headers.get('If-Match')).to.equal('"old"');
      expect(fetchStub.firstCall.args[1].method).to.equal('DELETE');
    });

    it('treats a missing deleted file as already removed', async () => {
      fetchStub.resolves(response(null, 404));
      expect((await solid.delete('/file')).statusCode).to.equal(200);
    });

    it('refuses container mutations before making a request', async () => {
      await expect(solid.put('/folder/', '', 'text/plain')).to.be.rejectedWith('containers');
      await expect(solid.delete('/folder/')).to.be.rejectedWith('containers');
      expect(fetchStub.called).to.equal(false);
    });
  });

  describe('container listings', () => {
    const container = POD + 'folder/';
    const turtle = '<' + container + '> <http://www.w3.org/ns/ldp#contains> <' + container + 'file> .';

    function serveContainer(body = turtle) {
      fetchStub.callsFake(async (url, init) => {
        if (init.method === 'HEAD') {
          return response(null, 200, { ETag: '"real-file-etag"', 'Content-Length': '4' }, url);
        }
        return response(body, 200, { 'Content-Type': 'text/turtle', ETag: '"folder-etag"' }, url);
      });
    }

    it('parses real Turtle without stat:mtime or modified and uses HTTP ETags', async () => {
      serveContainer();
      const result = await solid.get('/folder/');
      expect(result.body).to.deep.equal({ file: { ETag: 'real-file-etag', 'Content-Length': 4 } });
      expect(result.revision).to.equal('folder-etag');
      expect(fetchStub.secondCall.args[0]).to.equal(container + 'file');
    });

    it('returns a missing container as 404', async () => {
      fetchStub.resolves(response(null, 404, {}, container));
      expect((await solid.get('/folder/')).statusCode).to.equal(404);
    });

    it('keeps authentication and authorization status codes', async () => {
      for (const status of [401, 403]) {
        fetchStub.resolves(response(null, status, {}, container));
        expect((await solid.get('/folder/')).statusCode).to.equal(status);
      }
    });

    it('skips a child deleted between listing and metadata retrieval', async () => {
      serveContainer();
      fetchStub.onSecondCall().resolves(response(null, 404));
      expect((await solid.get('/folder/')).body).to.deep.equal({});
    });

    it('fails rather than replacing missing child validators with mtime', async () => {
      serveContainer();
      fetchStub.onSecondCall().resolves(response(null, 200));
      await expect(solid.get('/folder/')).to.be.rejectedWith('must expose an ETag');
    });

    it('preserves a child metadata authorization failure for sync error handling', async () => {
      serveContainer();
      fetchStub.onSecondCall().resolves(response(null, 403));
      expect((await solid.get('/folder/')).statusCode).to.equal(403);
    });

    it('limits the number of simultaneous metadata requests', async () => {
      const children = Array.from({ length: 12 }, (_, i) => '<' + container + 'file' + i + '>').join(', ');
      let running = 0, peak = 0;
      fetchStub.callsFake(async (url, init) => {
        if (init.method !== 'HEAD') {
          return response('<' + container + '> <http://www.w3.org/ns/ldp#contains> ' + children + ' .',
            200, { 'Content-Type': 'text/turtle' }, url);
        }
        peak = Math.max(peak, ++running);
        await new Promise(resolve => setImmediate(resolve));
        running--;
        return response(null, 200, { ETag: '"r"' }, url);
      });
      expect(Object.keys((await solid.get('/folder/')).body)).to.have.length(12);
      expect(peak).to.equal(4);
    });

    it('decodes filenames and safely handles __proto__', async () => {
      serveContainer('<' + container + '> <http://www.w3.org/ns/ldp#contains> <' + container + 'a%20b>, <' + container + '__proto__> .');
      const result = await solid.get('/folder/');
      expect(Object.keys(result.body).sort()).to.deep.equal(['__proto__', 'a b']);
      expect(Object.getPrototypeOf(result.body)).to.equal(Object.prototype);
    });

    it('does not fetch resources outside the requested container', async () => {
      serveContainer('<' + container + '> <http://www.w3.org/ns/ldp#contains> <https://other.example/file> .');
      expect((await solid.get('/folder/')).body).to.deep.equal({});
      expect(fetchStub.callCount).to.equal(1);
    });
  });

  describe('authentication and lifecycle', () => {
    let previousWindow;

    beforeEach(() => {
      previousWindow = globalThis.window;
      globalThis.window = { location: { href: 'https://app.example/nested/editor?view=one#item' }, localStorage };
    });

    afterEach(() => { globalThis.window = previousWindow; });

    it('reports a missing issuer without selecting the Solid backend', async () => {
      await solid.connect();
      expect(rs.backend).to.equal(undefined);
      expect(rs._emit.firstCall.args[0]).to.equal('error');
    });

    it('preserves the callback path and query instead of redirecting to the origin root', async () => {
      const login = sinon.stub(solid.session, 'login').resolves();
      solid.setAuthURL('https://issuer.example/');
      await solid.connect();
      expect(login.firstCall.args[0].redirectUrl).to.equal('https://app.example/nested/editor?view=one');
      expect(rs.backend).to.equal('solid');
      expect(JSON.parse(localStorage.getItem('remotestorage:solid')).href).to.equal('https://issuer.example/');
      expect(JSON.parse(localStorage.getItem('remotestorage:solid')).properties.appHash).to.equal('#item');
    });

    it('routes rejected login promises through the error event', async () => {
      sinon.stub(solid.session, 'login').rejects(new Error('login failed'));
      solid.setAuthURL('https://issuer.example/');
      await solid.connect();
      expect(rs._emit.lastCall.args[1].message).to.equal('login failed');
    });

    it('validates pod selection and reports pending selection even with zero pods', () => {
      solid.session.info.isLoggedIn = true;
      solid.podURLs = [];
      solid.setPodURL(null);
      expect(solid.connected).to.equal(false);
      expect(rs._emit.lastCall.args).to.deep.equal(['pod-not-selected']);
      expect(() => solid.setPodURL(POD)).to.throw('getPodURLs');
    });

    it('connects only to a discovered pod and returns a copy of the pod list', () => {
      solid.session.info.isLoggedIn = true;
      solid.podURLs = [POD];
      const connected = sinon.spy();
      solid.on('connected', connected);
      solid.setPodURL(POD);
      solid.getPodURLs().length = 0;
      expect(solid.podURLs).to.deep.equal([POD]);
      expect(solid.getPodURL()).to.equal(POD);
      expect(solid.connected).to.equal(true);
      expect(connected.calledOnce).to.equal(true);
    });

    for (const pods of [[], [POD], [POD, 'https://second.example/']]) {
      it('discovers ' + pods.length + ' pods from an authenticated extended profile', async () => {
        solid.session.info.isLoggedIn = true;
        solid.session.info.webId = 'https://id.example/profile#me';
        solid.selectedPodURL = null;
        sinon.stub(solid.session, 'handleIncomingRedirect').resolves();
        const profile = pods.map(pod => '<https://id.example/profile#me> <http://www.w3.org/ns/pim/space#storage> <' + pod + '> .').join('\n');
        publicFetch.callsFake(async url => response(
          '<https://id.example/profile#me> <http://www.w3.org/2000/01/rdf-schema#seeAlso> <https://id.example/private> .',
          200, { 'Content-Type': 'text/turtle' }, String(url)
        ));
        fetchStub.callsFake(async url => response(profile, 200, { 'Content-Type': 'text/turtle' }, String(url)));
        await solid.restore();
        expect(solid.podURLs).to.deep.equal(pods);
        expect(solid.connected).to.equal(false);
        expect(fetchStub.called).to.equal(true);
        expect(rs._emit.lastCall.args).to.deep.equal(['pod-not-selected']);
      });
    }

    it('does not let the generic OAuth handler consume a Solid callback', () => {
      rs.backend = 'solid';
      Authorize._rs_init(rs);
      expect(rs.on.called).to.equal(false);
    });

    it('restores the saved application fragment after the SDK finishes its callback', async () => {
      localStorage.setItem('remotestorage:solid', JSON.stringify({
        properties: { appHash: '#/notes/one' }
      }));
      const restored = new Solid(rs);
      restored.session.info.isLoggedIn = true;
      restored.session.info.webId = 'https://id.example/profile#me';
      sinon.stub(restored.session, 'handleIncomingRedirect').resolves();
      publicFetch.callsFake(async url => response('', 200, { 'Content-Type': 'text/turtle' }, String(url)));
      window.history = { replaceState: sinon.spy() };
      await restored.restore();
      expect(window.history.replaceState.firstCall.args[2]).to.equal('https://app.example/nested/editor?view=one#/notes/one');
      expect(JSON.parse(localStorage.getItem('remotestorage:solid')).properties.appHash).to.equal(null);
    });

    it('replays the zero-pod state to a listener registered after feature loading', async () => {
      const previousBackend = localStorage.getItem('remotestorage:backend');
      localStorage.setItem('remotestorage:backend', 'solid');
      sinon.stub(Solid.prototype, 'restore').callsFake(async function() {
        this.podURLs = [];
        this.selectedPodURL = null;
      });
      const remote = new RemoteStorageWithSolid({ cache: false });
      sinon.stub(remote.solid.session, 'logout').resolves();
      try {
        await new Promise(resolve => remote.on('features-loaded', resolve));
        await new Promise(resolve => remote.on('pod-not-selected', resolve));
        expect(remote.solid.getPodURLs()).to.deep.equal([]);
      } finally {
        const disconnected = new Promise(resolve => remote.on('disconnected', resolve));
        remote.disconnect();
        await disconnected;
        if (previousBackend === null) {
          localStorage.removeItem('remotestorage:backend');
        } else {
          localStorage.setItem('remotestorage:backend', previousBackend);
        }
      }
    });

    it('does not reactivate an adapter disconnected during pod discovery', async () => {
      solid.session.info.isLoggedIn = true;
      solid.session.info.webId = 'https://id.example/profile#me';
      sinon.stub(solid.session, 'handleIncomingRedirect').resolves();
      let finishProfile;
      publicFetch.returns(new Promise(resolve => { finishProfile = resolve; }));
      const restoration = solid.restore();
      await new Promise(resolve => setImmediate(resolve));
      solid.configure({ properties: null });
      finishProfile(response('<https://id.example/profile#me> <http://www.w3.org/ns/pim/space#storage> <' + POD + '> .',
        200, { 'Content-Type': 'text/turtle' }, 'https://id.example/profile'));
      await restoration;
      expect(solid.connected).to.equal(false);
      expect(solid.selectedPodURL).to.equal(null);
      expect(solid.podURLs).to.equal(null);
      expect(rs._emit.calledWith('pod-not-selected')).to.equal(false);
    });

    it('surfaces initialization failures rather than losing a rejected promise', async () => {
      rs.backend = 'solid';
      sinon.stub(Solid.prototype, 'restore').rejects(new Error('callback failed'));
      await Solid._rs_init(rs);
      expect(rs._emit.lastCall.args[1].message).to.equal('callback failed');
    });

    it('awaits SDK logout during cleanup', async () => {
      rs.solid = solid;
      rs.remote = solid;
      rs.backend = 'solid';
      let finish;
      const logout = sinon.stub(solid.session, 'logout').returns(new Promise(resolve => { finish = resolve; }));
      let complete = false;
      const cleanup = Solid._rs_cleanup(rs).then(() => { complete = true; });
      expect(logout.calledOnce).to.equal(true);
      expect(complete).to.equal(false);
      expect(solid.connected).to.equal(false);
      expect(rs.backend).to.equal(undefined);
      finish();
      await cleanup;
      expect(complete).to.equal(true);
    });
  });

  describe('URL and connection handling', () => {
    it('returns the selected pod URL without patching BaseClient prototypes', async () => {
      expect(await solid.getItemURL('/folder/a b')).to.equal(POD + 'folder/a%20b');
      expect(solid.getFileURL('/')).to.equal(POD);
      solid.connected = false;
      expect(await solid.getItemURL('/file')).to.equal(undefined);
    });

    it('rejects dot traversal before constructing a resource URL', () => {
      expect(() => solid.getFileURL('/../file')).to.throw('dot segments');
    });

    it('rejects unsafe identity provider URLs', () => {
      for (const url of ['javascript:alert(1)', 'http://issuer.example', 'https://user:pass@issuer.example', 'https://issuer.example/#fragment']) {
        expect(() => solid.setAuthURL(url)).to.throw();
      }
      expect(() => solid.setAuthURL('http://localhost:3000/')).not.to.throw();
    });

    it('reports a failed network request and recovery', async () => {
      fetchStub.onFirstCall().rejects(new Error('offline'));
      fetchStub.onSecondCall().resolves(response('ok', 200, { ETag: '"r"' }));
      await expect(solid.get('/file')).to.be.rejectedWith('offline');
      expect(solid.online).to.equal(false);
      await solid.get('/file');
      expect(solid.online).to.equal(true);
      expect(rs._emit.getCalls().map(call => call.args[0])).to.deep.equal(['network-offline', 'network-online']);
    });

    it('aborts a request that exceeds the configured timeout', async () => {
      const previousTimeout = config.requestTimeout;
      const clock = sinon.useFakeTimers();
      config.requestTimeout = 20;
      fetchStub.callsFake((url, init) => new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      }));
      try {
        const check = expect(solid.get('/file')).to.be.rejectedWith('aborted');
        await clock.tickAsync(21);
        await check;
      } finally {
        config.requestTimeout = previousTimeout;
      }
    });
  });
});

describe('Solid entry point isolation', () => {
  it('enables Solid on the optional constructor without modifying the default constructor', () => {
    expect(RemoteStorageWithSolid.Solid).to.equal(Solid);
    expect(RemoteStorage.Solid).to.equal(undefined);
  });

  it('supports the core library in Node without a browser Solid session', () => {
    const rs = new RemoteStorageWithSolid({ cache: false });
    expect(rs.solid).to.equal(undefined);
    rs.disconnect();
  });
});
