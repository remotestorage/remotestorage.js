import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { RemoteStorage } from '../../build/remotestorage.js';
import config from '../../build/config.js';
import { Sync } from '../../build/sync.js';
import InMemoryStorage from '../../build/inmemorystorage.js';
import { OneDrive } from '../../build/onedrive.js';
import { OneDriveIndex, graphURL } from '../../build/onedrive-index.js';
import { Authorize } from '../../build/authorize.js';
import UnauthorizedError from '../../build/unauthorized-error.js';
import { localStorage, sessionStorage } from '../helpers/memoryStorage.mjs';

const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive';
const DOWNLOAD = 'https://download.example/content';
const UPLOAD = 'https://upload.example/session';
const root = { id: 'root', name: 'remotestorage', folder: {} };
const file = { id: 'f', name: 'file.json', eTag: '"v1"', file: { mimeType: 'application/json' },
  parentReference: { id: 'root' }, '@microsoft.graph.downloadUrl': DOWNLOAD };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const page = (items, token = '1') => ({ value: items, '@odata.deltaLink': GRAPH + '/root/delta?token=' + token });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function rejects(promise, text) {
  const error = await promise.then(() => undefined, e => e);
  expect(error).to.be.instanceOf(Error);
  expect(error.message).to.include(text);
}

describe('OneDrive delta index', () => {
  it('rejects files without validators before publishing a cursor', async () => {
    const index = new OneDriveIndex();
    await rejects(index.update('root', async () => page([root, { ...file, eTag: undefined }])), 'ETag');
    expect(index.cursor).to.equal(undefined);
  });

  it('rejects colliding paths instead of silently dropping a file', async () => {
    const index = new OneDriveIndex();
    await rejects(index.update('root', async () => page([root, file, { ...file, id: 'other', name: 'FILE.JSON' }])), 'duplicate');
    expect(index.paths.size).to.equal(0);
  });

  it('does not resurrect deleted descendants when a folder ID reappears', async () => {
    const index = new OneDriveIndex();
    const folder = { id: 'folder', name: 'notes', folder: {}, parentReference: { id: 'root' } };
    await index.update('root', async () => page([root, folder, { ...file, parentReference: { id: 'folder' } }]));
    await index.update('root', async () => page([{ id: 'folder', deleted: {} }], '2'));
    await index.update('root', async () => page([folder], '3'));
    expect(index.paths.has('/notes/file.json')).to.equal(false);
  });

  it('preserves a child moved out of a deleted subtree on a later page', async () => {
    const index = new OneDriveIndex();
    await index.update('root', async () => page([root,
      { id: 'folder', name: 'old', folder: {}, parentReference: { id: 'root' } },
      { id: 'nested', name: 'nested', folder: {}, parentReference: { id: 'folder' } },
      { ...file, parentReference: { id: 'nested' } },
      { ...file, id: 'gone', name: 'gone.json', parentReference: { id: 'nested' } }]));
    let count = 0;
    await index.update('root', async () => ++count === 1 ?
      { value: [{ id: 'folder', deleted: {} }], '@odata.nextLink': GRAPH + '/root/delta?page=2' } :
      page([{ id: 'f', parentReference: { id: 'root' } }], '2'));
    expect(index.paths.has('/file.json')).to.equal(true);
    expect(index.items.has('nested')).to.equal(false);
    expect(index.items.has('gone')).to.equal(false);
  });

  for (const links of [{ '@odata.nextLink': '' }, { '@odata.deltaLink': {} }]) {
    it('rejects malformed delta links: ' + JSON.stringify(links), async () => {
      const index = new OneDriveIndex();
      await rejects(index.update('root', async () => ({ ...page([root, file]), ...links })), 'OneDrive');
      expect(index.cursor).to.equal(undefined);
    });
  }
  it('propagates nested file revisions into all ancestor folder revisions', async () => {
    const index = new OneDriveIndex();
    const folder = { id: 'folder', name: 'nested', folder: {}, parentReference: { id: 'root' } };
    const nested = { ...file, parentReference: { id: 'folder' } };
    await index.update('root', async () => page([root, folder, nested]));
    const before = [index.revisions.get('/'), index.revisions.get('/nested/')];
    await index.update('root', async () => page([{ id: 'f', eTag: '"v2"' }], '2'));
    expect(index.revisions.get('/')).not.to.equal(before[0]);
    expect(index.revisions.get('/nested/')).not.to.equal(before[1]);
  });

  it('renames cached descendants by ID even when only their parent appears in delta', async () => {
    const index = new OneDriveIndex();
    await index.update('root', async () => page([root,
      { id: 'folder', name: 'old', folder: {}, parentReference: { id: 'root' } },
      { ...file, parentReference: { id: 'folder' } }]));
    await index.update('root', async () => page([{ id: 'folder', name: 'new' }], '2'));
    expect(index.paths.has('/old/file.json')).to.equal(false);
    expect(index.paths.has('/new/file.json')).to.equal(true);
  });

  it('excludes descendants of a deleted folder and files outside the app directory', async () => {
    const index = new OneDriveIndex();
    await index.update('root', async () => page([root, file,
      { id: 'elsewhere', name: 'private', parentReference: { id: 'other' }, file: {} }]));
    await index.update('root', async () => page([{ id: 'root', deleted: {} }], '2'));
    expect(index.paths.size).to.equal(0);
  });

  it('publishes all pages atomically and does not advance the cursor after failure', async () => {
    const index = new OneDriveIndex();
    await index.update('root', async () => page([root, file]));
    const before = index.revisions.get('/');
    let calls = 0;
    await rejects(index.update('root', async () => {
      if (++calls === 1) { return { value: [{ id: 'f', eTag: '"v2"' }], '@odata.nextLink': GRAPH + '/root/delta?page=2' }; }
      throw new Error('offline');
    }), 'offline');
    expect(index.revisions.get('/')).to.equal(before);
    expect(index.cursor).to.equal(GRAPH + '/root/delta?token=1');
  });

  it('rejects missing cursors and repeated pages', async () => {
    const index = new OneDriveIndex();
    await rejects(index.update('root', async () => ({ value: [] })), 'cursor');
    await rejects(index.update('root', async () => ({ value: [], '@odata.nextLink': GRAPH + '/root/delta' })), 'Repeated');
  });

  it('rejects untrusted continuation links before following them', async () => {
    const index = new OneDriveIndex();
    let calls = 0;
    await rejects(index.update('root', async () => {
      calls++;
      return { value: [], '@odata.nextLink': 'https://attacker.example/steal' };
    }), 'Graph URL');
    expect(calls).to.equal(1);
    expect(() => graphURL('https://user:pass@graph.microsoft.com/v1.0/me')).to.throw();
  });

  it('includes literal filenames in revision hashes', async () => {
    const index = new OneDriveIndex();
    await index.update('root', async () => page([root, { ...file, name: 'a #?.json' }]));
    const before = index.revisions.get('/');
    expect(index.paths.has('/a #?.json')).to.equal(true);
    await index.update('root', async () => page([{ id: 'f', name: 'renamed.json' }], '2'));
    expect(index.revisions.get('/')).not.to.equal(before);
  });
});

describe('OneDrive backend', () => {
  let rs, backend, fetchStub, originalStorage, originalSessionStorage;
  beforeEach(() => {
    originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage });
    sessionStorage.clear();
    originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
    localStorage.clear();
    rs = { apiKeys: { onedrive: { clientId: 'client' } }, _emit: sinon.spy(), setBackend: sinon.spy(), remote: {} };
    backend = new OneDrive(rs);
    rs.onedrive = backend;
    backend.token = 'token';
    backend.connected = true;
    fetchStub = sinon.stub(globalThis, 'fetch');
  });
  afterEach(() => {
    OneDrive._rs_cleanup(rs);
    sinon.restore();
    if (originalStorage) { Object.defineProperty(globalThis, 'localStorage', originalStorage); }
    else { delete globalThis.localStorage; }
    if (originalSessionStorage) { Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorage); }
    else { delete globalThis.sessionStorage; }
  });

  it('round-trips raw percent signs and Unicode in public paths and listings', async () => {
    const name = '100% café.json';
    const item = { ...file, name };
    fetchStub.withArgs(GRAPH + '/root:/remotestorage').callsFake(async () => json(root));
    fetchStub.withArgs(GRAPH + '/root/delta').resolves(json(page([root, item])));
    fetchStub.withArgs(GRAPH + '/root:/remotestorage/100%25%20caf%C3%A9.json').callsFake(async () => json(item));
    fetchStub.withArgs(DOWNLOAD).resolves(new Response('contents'));
    const listing = await backend.get('/');
    expect(Object.keys(listing.body)).to.deep.equal([name]);
    expect((await backend.get('/' + name)).body).to.equal('contents');
  });

  it('resolves folder reads case-insensitively like file reads', async () => {
    fetchStub.withArgs(GRAPH + '/root:/remotestorage').callsFake(async () => json(root));
    fetchStub.withArgs(GRAPH + '/root/delta').resolves(json(page([root,
      { id: 'notes', name: 'Notes', folder: {}, parentReference: { id: 'root' } },
      { ...file, parentReference: { id: 'notes' } }])));
    const listing = await backend.get('/notes/');
    expect(listing.statusCode).to.equal(200);
    expect(Object.keys(listing.body)).to.deep.equal(['file.json']);
  });

  it('preserves saved credentials when reconnecting fails temporarily', async () => {
    fetchStub.resolves(new Response(null, { status: 503 }));
    await backend.configure({ token: 'saved-token', refreshToken: 'saved-refresh' });
    expect(backend.connected).to.equal(false);
    expect(backend.token).to.equal('saved-token');
    expect(backend.refreshToken).to.equal('saved-refresh');
    expect(JSON.parse(localStorage.getItem('remotestorage:onedrive')).refreshToken).to.equal('saved-refresh');
  });

  it('does not pair a replacement access token with the old account refresh token', async () => {
    backend.refreshToken = 'old-refresh';
    fetchStub.resolves(json({ driveType: 'personal' }));
    await backend.configure({ token: 'new-account-token' });
    expect(backend.refreshToken).to.equal(undefined);
  });

  it('forgets refresh credentials on an explicit token clear', async () => {
    backend.refreshToken = 'old-refresh';
    await backend.configure({ token: null });
    expect(localStorage.getItem('remotestorage:onedrive')).to.equal(null);
  });

  it('returns no download link for a folder', async () => {
    fetchStub.resolves(json(root));
    expect(await backend.getItemURL('/')).to.equal(undefined);
  });

  it('does not revive saved credentials after an explicit clear before startup restoration', async () => {
    const clock = sinon.useFakeTimers();
    localStorage.setItem('remotestorage:onedrive', JSON.stringify({ token: 'saved' }));
    rs.backend = 'onedrive';
    backend = rs.onedrive = new OneDrive(rs);
    fetchStub.resolves(json({ driveType: 'personal' }));
    await backend.configure({ token: null });
    await clock.tickAsync(0);
    expect(fetchStub.called).to.equal(false);
    expect(backend.connected).to.equal(false);
  });

  it('times out a response body that stalls after headers arrive', async () => {
    const clock = sinon.useFakeTimers();
    const timeout = config.requestTimeout;
    config.requestTimeout = 25;
    let stream;
    fetchStub.resolves(new Response(new ReadableStream({ start(controller) { stream = controller; } })));
    try {
      const result = rejects(backend.get('/file.json'), 'timed out');
      await clock.tickAsync(26);
      await result;
      expect(fetchStub.firstCall.args[1].signal.aborted).to.equal(true);
    } finally { stream.close(); config.requestTimeout = timeout; }
  });

  it('cancels a stalled response body when the account is replaced', async () => {
    let stream;
    fetchStub.withArgs(GRAPH + '/root:/remotestorage/file.json').resolves(new Response(new ReadableStream({ start(controller) { stream = controller; } })));
    fetchStub.withArgs(GRAPH).resolves(json({ driveType: 'personal' }));
    const result = rejects(backend.get('/file.json'), 'session ended');
    try {
      await backend.configure({ token: 'new-account' });
      await result;
      expect(backend.online).to.equal(true);
    } finally { stream.close(); }
  });

  it('forgets revoked refresh credentials and reports an authorization error', async () => {
    backend.refreshToken = 'revoked';
    sinon.stub(Authorize, 'requestRefreshedToken').rejects(new UnauthorizedError('invalid_grant'));
    fetchStub.resolves(new Response(null, { status: 401 }));
    const error = await backend.get('/file.json').catch(e => e);
    expect(error).to.be.instanceOf(UnauthorizedError);
    expect(backend.token).to.equal(undefined);
    expect(backend.refreshToken).to.equal(undefined);
    expect(backend.connected).to.equal(false);
    expect(backend.online).to.equal(true);
  });

  it('reports a final HTTP 401 as authorization failure without marking the network offline', async () => {
    fetchStub.resolves(new Response(null, { status: 401 }));
    const error = await backend.get('/file.json').catch(e => e);
    expect(error).to.be.instanceOf(UnauthorizedError);
    expect(backend.online).to.equal(true);
  });

  it('restores the selected backend and routes uncached operations through it', async () => {
    localStorage.setItem('remotestorage:backend', 'onedrive');
    localStorage.setItem('remotestorage:api-keys', JSON.stringify({ onedrive: { clientId: 'client' } }));
    localStorage.setItem('remotestorage:onedrive', JSON.stringify({ token: 'restored' }));
    fetchStub.withArgs(GRAPH).resolves(json({ driveType: 'personal' }));
    fetchStub.withArgs(GRAPH + '/root:/remotestorage/file.json').callsFake(async () => json(file));
    fetchStub.withArgs(DOWNLOAD).resolves(new Response('{"restored":true}'));
    const cache = config.cache;
    const actual = new RemoteStorage({ cache: false });
    try {
      await new Promise(resolve => actual.on('connected', resolve));
      expect(actual.remote).to.equal(actual.onedrive);
      expect(await actual.get('/file.json')).to.include({ statusCode: 200, body: '{"restored":true}' });
      await new Promise(resolve => { actual.on('disconnected', resolve); actual.disconnect(); });
      expect(localStorage.getItem('remotestorage:onedrive')).to.equal(null);
      expect(actual.remote).not.to.equal(actual.onedrive);
    } finally { config.cache = cache; }
  });

  it('starts a PKCE code flow for personal accounts without a client secret', async () => {
    rs.authorize = sinon.spy();
    sinon.stub(Authorize, 'getLocation').returns(new URL('https://app.example/callback#notes'));
    await backend.connect();
    const options = rs.authorize.firstCall.args[0];
    expect(options.authURL).to.equal('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize');
    expect(options.response_type).to.equal('code');
    expect(options.code_challenge_method).to.equal('S256');
    expect(options.scope).to.equal('Files.ReadWrite offline_access');
    const transaction = Authorize.takePkceTransaction();
    expect(transaction.state).to.equal(options.state);
    expect(transaction.appState).to.equal('notes');
    expect(transaction.tokenURL).to.equal(backend.TOKEN_URL);
    expect(transaction.clientId).to.equal('client');
    expect(rs.remote).to.equal(backend);
  });

  it('accepts Personal accounts and rejects Business accounts explicitly', async () => {
    fetchStub.resolves(json({ driveType: 'personal', owner: { user: { email: 'person@example.test' } } }));
    await backend.configure({ token: 'new-token' });
    expect(backend.connected).to.equal(true);
    expect(backend.userAddress).to.equal('person@example.test');
    fetchStub.resolves(json({ driveType: 'business' }));
    await backend.configure({ token: 'business-token' });
    expect(backend.connected).to.equal(false);
    expect(backend.token).to.equal(undefined);
    expect(rs._emit.lastCall.args[1].message).to.include('Personal');
  });

  it('reads JSON without forwarding the Graph token to the download capability', async () => {
    fetchStub.withArgs(GRAPH + '/root:/remotestorage/file.json').callsFake(async () => json(file));
    fetchStub.withArgs(DOWNLOAD).resolves(new Response('{"text":"hello"}'));
    const result = await backend.get('/file.json');
    expect(result).to.include({ statusCode: 200, body: '{"text":"hello"}', revision: 'v1' });
    expect(fetchStub.withArgs(DOWNLOAD).firstCall.args[1].headers).not.to.have.property('Authorization');
    expect(fetchStub.firstCall.args[1].headers.Authorization).to.equal('Bearer token');
  });

  it('preserves arbitrary binary bytes', async () => {
    fetchStub.withArgs(GRAPH + '/root:/remotestorage/file.bin').callsFake(async () => json({ ...file, file: { mimeType: 'application/octet-stream' } }));
    fetchStub.withArgs(DOWNLOAD).resolves(new Response(new Uint8Array([0, 255, 128, 65])));
    const result = await backend.get('/file.bin');
    expect([...new Uint8Array(result.body)]).to.deep.equal([0, 255, 128, 65]);
  });

  it('does not download unchanged files', async () => {
    fetchStub.resolves(json(file));
    expect(await backend.get('/file.json', { ifNoneMatch: 'v1' })).to.deep.equal({ statusCode: 304, revision: 'v1' });
    expect(fetchStub.calledOnce).to.equal(true);
  });

  it('retries a read when metadata changes during the download', async () => {
    let reads = 0;
    fetchStub.withArgs(GRAPH + '/root:/remotestorage/file.json').callsFake(async () => json({ ...file, eTag: ++reads === 1 ? '"v1"' : '"v2"' }));
    fetchStub.withArgs(DOWNLOAD).callsFake(async () => new Response('"new"'));
    expect(await backend.get('/file.json')).to.include({ body: '"new"', revision: 'v2' });
    expect(fetchStub.withArgs(DOWNLOAD).callCount).to.equal(2);
  });

  it('retries when the path is replaced by a different item with the same ETag', async () => {
    let reads = 0;
    fetchStub.withArgs(GRAPH + '/root:/remotestorage/file.json').callsFake(async () => json({ ...file, id: ++reads === 1 ? 'old-id' : 'new-id' }));
    fetchStub.withArgs(DOWNLOAD).callsFake(async () => new Response('new contents'));
    expect((await backend.get('/file.json')).body).to.equal('new contents');
    expect(fetchStub.withArgs(DOWNLOAD).callCount).to.equal(2);
  });

  it('rejects unsafe transfer URLs and invalid path segments', async () => {
    fetchStub.resolves(json({ ...file, '@microsoft.graph.downloadUrl': 'http://insecure.example/file' }));
    await rejects(backend.get('/file.json'), 'transfer URL');
    await rejects(backend.get('/a/..'), 'path segment');
    await rejects(backend.get('/../secret'), 'path segment');
    expect(fetchStub.callCount).to.equal(1);
  });

  it('polls delta changes for folder reads and supplies synthesized revisions', async () => {
    fetchStub.withArgs(GRAPH + '/root:/remotestorage').callsFake(async () => json(root));
    fetchStub.withArgs(GRAPH + '/root/delta').resolves(json(page([root, file])));
    fetchStub.withArgs(GRAPH + '/root/delta?token=1').resolves(json(page([], '2')));
    const listing = await backend.get('/');
    expect(listing.body['file.json'].ETag).to.equal('v1');
    expect(listing.revision).to.match(/^onedrive-/);
    expect(await backend.get('/', { ifNoneMatch: listing.revision })).to.include({ statusCode: 304 });
    expect(fetchStub.withArgs(GRAPH + '/root/delta?token=1').calledOnce).to.equal(true);
  });

  it('rebuilds the index after an expired delta token', async () => {
    fetchStub.withArgs(GRAPH + '/root:/remotestorage').callsFake(async () => json(root));
    fetchStub.withArgs(GRAPH + '/root/delta').onFirstCall().resolves(json(page([root, file])));
    await backend.prepareSync();
    fetchStub.withArgs(GRAPH + '/root/delta?token=1').resolves(new Response(null, { status: 410 }));
    fetchStub.withArgs(GRAPH + '/root/delta').onSecondCall().resolves(json(page([root], 'fresh')));
    await backend.prepareSync();
    expect(backend.index.paths.has('/file.json')).to.equal(false);
    expect(backend.index.cursor).to.equal(GRAPH + '/root/delta?token=fresh');
  });

  function commitRequest() {
    return fetchStub.withArgs(GRAPH + '/root:/remotestorage', sinon.match.has('method', 'PUT'));
  }

  function uploadFixture() {
    fetchStub.withArgs(GRAPH + '/root:/remotestorage').callsFake(async () => json(root));
    fetchStub.withArgs(GRAPH + '/items/root:/file.json:/createUploadSession').resolves(json({ uploadUrl: UPLOAD }));
    fetchStub.withArgs(UPLOAD).callsFake(async (_url, init) => new Response(null, { status: init.method === 'DELETE' ? 204 : 202 }));
    commitRequest().resolves(json({ ...file, eTag: '"v2"' }, 201));
  }

  it('keeps percent-encoded-looking names literal during upload', async () => {
    uploadFixture();
    fetchStub.withArgs(GRAPH + '/items/root:/percent%252F.json:/createUploadSession').resolves(json({ uploadUrl: UPLOAD }));
    await backend.put('/percent%2F.json', 'data', 'text/plain');
    const commit = commitRequest().firstCall.args[1];
    expect(JSON.parse(commit.body).name).to.equal('percent%2F.json');
    expect(fetchStub.withArgs(GRAPH + '/items/root:/percent%252F.json:/createUploadSession').calledOnce).to.equal(true);
  });

  it('requires a completed explicit commit, not an accepted pending response', async () => {
    uploadFixture();
    commitRequest().resolves(json(file, 202));
    await rejects(backend.put('/file.json', 'data', 'text/plain'), 'commit failed (202)');
  });

  it('does not return an old upload result when the account changes during cleanup', async () => {
    uploadFixture();
    const cleanup = deferred(), started = deferred();
    fetchStub.withArgs(UPLOAD).callsFake(async (_url, init) => {
      if (init.method === 'DELETE') { started.resolve(); return cleanup.promise; }
      return new Response(null, { status: 202 });
    });
    fetchStub.withArgs(GRAPH).resolves(json({ driveType: 'personal' }));
    const result = rejects(backend.put('/file.json', 'data', 'text/plain'), 'session ended');
    await started.promise;
    await backend.configure({ token: 'replacement' });
    cleanup.resolve(new Response(null, { status: 204 }));
    await result;
  });

  it('uploads binary bytes without bearer credentials and sends If-Match at final commit', async () => {
    uploadFixture();
    const bytes = new Uint8Array([0, 255, 128]);
    expect(await backend.put('/file.json', bytes, 'application/octet-stream', { ifMatch: 'v1' })).to.include({ revision: 'v2' });
    const creation = fetchStub.withArgs(GRAPH + '/items/root:/file.json:/createUploadSession').firstCall.args[1];
    expect(JSON.parse(creation.body).deferCommit).to.equal(true);
    const upload = fetchStub.withArgs(UPLOAD).firstCall.args[1];
    expect(upload.headers).not.to.have.property('Authorization');
    expect(upload.headers['Content-Range']).to.equal('bytes 0-2/3');
    expect([...new Uint8Array(upload.body)]).to.deep.equal([...bytes]);
    const commit = commitRequest().firstCall.args[1];
    expect(commit.headers['If-Match']).to.equal('"v1"');
    expect(JSON.parse(commit.body)['@microsoft.graph.sourceUrl']).to.equal(UPLOAD);
  });

  it('uses conflict fail at final create and maps a concurrent create to 412', async () => {
    uploadFixture();
    commitRequest().resolves(json({ error: { code: 'nameAlreadyExists' } }, 409));
    expect(await backend.put('/file.json', 'data', 'text/plain', { ifNoneMatch: '*' })).to.deep.equal({ statusCode: 412 });
    const commit = commitRequest().firstCall.args[1];
    expect(JSON.parse(commit.body)['@microsoft.graph.conflictBehavior']).to.equal('fail');
    expect(fetchStub.withArgs(UPLOAD).lastCall.args[1].method).to.equal('DELETE');
  });

  it('does not mistake unrelated upload errors for concurrent edits', async () => {
    uploadFixture();
    commitRequest().resolves(json({ error: { code: 'quotaLimitReached' } }, 409));
    await rejects(backend.put('/file.json', 'data', 'text/plain'), '409');
  });

  it('reports a missing conditional update or delete as a conflict', async () => {
    uploadFixture();
    fetchStub.withArgs(GRAPH + '/items/root:/file.json:/createUploadSession').resolves(new Response(null, { status: 404 }));
    expect((await backend.put('/file.json', 'data', 'text/plain', { ifMatch: 'gone' })).statusCode).to.equal(412);
    expect(fetchStub.withArgs(UPLOAD).called).to.equal(false);
    fetchStub.withArgs(GRAPH + '/root:/remotestorage/file.json').resolves(new Response(null, { status: 404 }));
    expect((await backend.delete('/file.json', { ifMatch: 'gone' })).statusCode).to.equal(412);
  });

  it('rejects a stale final commit and cancels the temporary upload', async () => {
    uploadFixture();
    commitRequest().resolves(new Response(null, { status: 412 }));
    expect(await backend.put('/file.json', 'data', 'text/plain', { ifMatch: 'stale' })).to.deep.equal({ statusCode: 412 });
    expect(fetchStub.withArgs(UPLOAD).lastCall.args[1].method).to.equal('DELETE');
  });

  it('does not proceed if the provider ignores deferred commit', async () => {
    uploadFixture();
    fetchStub.withArgs(UPLOAD).resolves(json(file, 201));
    await rejects(backend.put('/file.json', 'data', 'text/plain', { ifMatch: 'v1' }), 'defer');
    expect(commitRequest().called).to.equal(false);
  });

  it('rejects empty uploads and directory mutations without network requests', async () => {
    await rejects(backend.put('/file', '', 'text/plain'), 'Empty');
    await rejects(backend.put('/folder/', 'text', 'text/plain'), 'file path');
    await rejects(backend.delete('/folder/'), 'file path');
    expect(fetchStub.called).to.equal(false);
  });

  it('sends delete preconditions to Graph', async () => {
    fetchStub.resolves(new Response(null, { status: 412 }));
    expect(await backend.delete('/file.json', { ifMatch: 'v1' })).to.deep.equal({ statusCode: 412 });
    expect(fetchStub.firstCall.args[1].headers['If-Match']).to.equal('"v1"');
  });

  it('coalesces token refresh and retries with the rotated token', async () => {
    backend.refreshToken = 'refresh';
    const refresh = sinon.stub(Authorize, 'requestRefreshedToken').resolves({ token: 'new', refreshToken: 'new-refresh' });
    fetchStub.callsFake(async (_url, init) => init.headers.Authorization === 'Bearer new' ? json(file) : new Response(null, { status: 401 }));
    await Promise.all([backend.get('/file.json', { ifNoneMatch: 'v1' }), backend.get('/file.json', { ifNoneMatch: 'v1' })]);
    expect(refresh.calledOnce).to.equal(true);
    expect(backend.refreshToken).to.equal('new-refresh');
  });

  it('does not retry forbidden responses as token failures', async () => {
    backend.refreshToken = 'refresh';
    const refresh = sinon.stub(Authorize, 'requestRefreshedToken');
    fetchStub.resolves(new Response(null, { status: 403 }));
    await rejects(backend.get('/file.json'), '403');
    expect(refresh.called).to.equal(false);
  });

  it('does not refresh a token explicitly cleared for reauthorization', async () => {
    backend.refreshToken = 'refresh';
    const refresh = sinon.stub(Authorize, 'requestRefreshedToken');
    await backend.configure({ token: null });
    expect(backend.connected).to.equal(false);
    expect(refresh.called).to.equal(false);
    expect(fetchStub.called).to.equal(false);
  });

  it('does not restore credentials from a refresh completed after disconnect', async () => {
    backend.refreshToken = 'refresh';
    let resolve;
    sinon.stub(Authorize, 'requestRefreshedToken').returns(new Promise(done => { resolve = done; }));
    fetchStub.resolves(new Response(null, { status: 401 }));
    const pending = backend.get('/file.json');
    while (!resolve) { await Promise.resolve(); }
    OneDrive._rs_cleanup(rs);
    resolve({ token: 'late-token', refreshToken: 'late-refresh' });
    await rejects(pending, 'session ended');
    expect(backend.token).to.equal(undefined);
    expect(localStorage.getItem('remotestorage:onedrive')).to.equal(null);
    expect(fetchStub.calledOnce).to.equal(true);
  });

  it('keeps the original remote when replacing the application registration', () => {
    const original = rs.remote;
    rs.backend = 'onedrive';
    OneDrive._rs_init(rs);
    const first = rs.remote;
    rs.apiKeys.onedrive.clientId = 'replacement';
    OneDrive._rs_init(rs);
    expect(rs.remote).not.to.equal(first);
    expect(rs.remote.clientId).to.equal('replacement');
    OneDrive._rs_cleanup(rs);
    expect(rs.remote).to.equal(original);
  });

  it('disconnects the backend when its application registration is removed', () => {
    const original = rs.remote;
    backend.select();
    rs.backend = 'onedrive';
    RemoteStorage.prototype.setApiKeys.call(rs, { onedrive: null });
    expect(rs.onedrive).to.equal(undefined);
    expect(rs.apiKeys.onedrive).to.equal(undefined);
    expect(rs.remote).to.equal(original);
    expect(backend.connected).to.equal(false);
    expect(backend.token).to.equal(undefined);
  });

  it('treats prototype-like filenames as ordinary listing entries', async () => {
    fetchStub.withArgs(GRAPH + '/root:/remotestorage').callsFake(async () => json(root));
    fetchStub.withArgs(GRAPH + '/root/delta').resolves(json(page([root, { ...file, name: '__proto__' }])));
    const result = await backend.get('/');
    expect(Object.hasOwn(result.body, '__proto__')).to.equal(true);
    expect(result.body.__proto__.ETag).to.equal('v1');
  });

  it('discards a response arriving after disconnect', async () => {
    let resolve;
    fetchStub.returns(new Promise(done => { resolve = done; }));
    const pending = backend.get('/file.json');
    OneDrive._rs_cleanup(rs);
    resolve(json(file));
    await rejects(pending, 'session ended');
  });
});

describe('OneDrive sync preparation', () => {
  let rs, sync;
  beforeEach(() => {
    rs = { local: new InMemoryStorage(), remote: { connected: true }, caching: { onActivate() {} }, _emit: sinon.spy() };
    sync = new Sync(rs);
    rs.sync = sync;
    sinon.stub(sync, 'doTasks').returns(true);
  });
  afterEach(() => sinon.restore());

  it('awaits change tracking before examining cached revisions', async () => {
    let resolve;
    const pending = { promise: new Promise(done => { resolve = done; }), resolve: () => resolve() };
    rs.remote.prepareSync = () => pending.promise;
    const run = sync.sync();
    expect(sync.doTasks.called).to.equal(false);
    pending.resolve();
    await run;
    expect(sync.doTasks.calledOnce).to.equal(true);
  });

  it('reports failed preparation and reschedules rather than syncing stale revisions', async () => {
    rs.remote.prepareSync = async () => { throw new Error('feed unavailable'); };
    await sync.sync();
    expect(sync.doTasks.called).to.equal(false);
    expect(rs._emit.calledWith('sync-done', { completed: false })).to.equal(true);
    expect(rs._emit.firstCall.args[1].message).to.include('feed unavailable');
  });

  it('does not prepare a disconnected backend', async () => {
    rs.remote.connected = false;
    rs.remote.prepareSync = sinon.stub().rejects(new Error('not connected'));
    await sync.sync();
    expect(rs.remote.prepareSync.called).to.equal(false);
    expect(rs._emit.called).to.equal(false);
  });

  it('preserves authorization errors during preparation', async () => {
    rs.remote.prepareSync = async () => { throw new UnauthorizedError(); };
    await sync.sync();
    expect(rs._emit.firstCall.args[1]).to.be.instanceOf(UnauthorizedError);
  });

  it('preserves authorization errors during file requests', async () => {
    sinon.stub(sync, 'dealWithFailure').resolves();
    sinon.stub(sync, 'finishUnsuccessfulTask').resolves();
    await sync.finishTask({ path: '/notes/a', action: 'get', promise: Promise.reject(new UnauthorizedError()) }, true);
    expect(rs._emit.firstCall.args[1]).to.be.instanceOf(UnauthorizedError);
  });

  for (const replacement of ['sync', 'remote']) {
    it('ignores preparation from a replaced ' + replacement, async () => {
      let resolve;
    const pending = { promise: new Promise(done => { resolve = done; }), resolve: () => resolve() };
      rs.remote.prepareSync = () => pending.promise;
      const run = sync.sync();
      rs[replacement] = {};
      pending.resolve();
      await run;
      expect(sync.doTasks.called).to.equal(false);
      expect(rs._emit.called).to.equal(false);
    });
  }
});
