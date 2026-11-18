import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import GoogleDrive from '../../build/googledrive.js';
import { GoogleDriveChanges } from '../../build/googledrive-changes.js';
import { Sync } from '../../build/sync.js';
import InMemoryStorage from '../../build/inmemorystorage.js';
import UnauthorizedError from '../../build/unauthorized-error.js';

const response = (body, status = 200) => ({ status, responseText: JSON.stringify(body) });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const folder = (title, id = title) => ({ title, id, mimeType: 'application/vnd.google-apps.folder', etag: '"unchanged-folder"' });
const file = (title, etag = 'file-v1') => ({ title, id: title, mimeType: 'text/plain', fileSize: 4, etag: '"' + etag + '"' });
async function rejection(promise) {
  try { await promise; } catch (error) { return error; }
  throw new Error('Expected rejection');
}

describe('Google Drive changes', () => {
  let tracker, request, changed;
  beforeEach(() => {
    request = sinon.stub();
    request.onFirstCall().resolves(response({ startPageToken: 'start' }));
    changed = sinon.spy();
    tracker = new GoogleDriveChanges(request, changed);
  });
  afterEach(() => sinon.restore());

  it('keeps validators stable when the fully drained feed has no changes', async () => {
    await tracker.prepare();
    changed.resetHistory();
    const revision = tracker.revision;
    tracker.markListed('/notes/', revision);
    request.onSecondCall().resolves(response({ newStartPageToken: 'next', changes: [] }));
    await tracker.prepare();
    expect(tracker.getRevision('/notes/')).to.equal(revision);
    expect(changed.called).to.equal(false);
  });

  it('invalidates every ancestor after a change on a later page', async () => {
    await tracker.prepare();
    changed.resetHistory();
    const revision = tracker.revision;
    for (const path of ['/', '/notes/', '/notes/nested/']) { tracker.markListed(path, revision); }
    request.onSecondCall().resolves(response({ nextPageToken: 'page/2', changes: [] }));
    request.onThirdCall().resolves(response({ newStartPageToken: 'end', changes: [{ fileId: 'nested-file' }] }));
    await tracker.prepare();
    expect(request.thirdCall.args[0]).to.include('pageToken=page%2F2');
    expect(tracker.revision).not.to.equal(revision);
    for (const path of ['/', '/notes/', '/notes/nested/']) { expect(tracker.getRevision(path)).to.equal(undefined); }
    expect(changed.calledOnce).to.equal(true);
  });

  it('retries from the old committed cursor after a failed later page', async () => {
    await tracker.prepare();
    changed.resetHistory();
    tracker.markListed('/notes/', tracker.revision);
    request.onSecondCall().resolves(response({ nextPageToken: 'second', changes: [{ fileId: 'a' }] }));
    request.onThirdCall().resolves(response({}, 503));
    expect((await rejection(tracker.prepare())).message).to.include('503');
    expect(tracker.getRevision('/notes/')).to.equal(undefined);
    request.onCall(3).resolves(response({ newStartPageToken: 'end', changes: [{ fileId: 'a' }] }));
    await tracker.prepare();
    expect(request.getCall(3).args[0]).to.include('pageToken=start');
    expect(changed.calledOnce).to.equal(true);
  });

  it('coalesces concurrent refreshes', async () => {
    const pending = deferred();
    request.onFirstCall().returns(pending.promise);
    const first = tracker.prepare();
    expect(tracker.prepare()).to.equal(first);
    pending.resolve(response({ startPageToken: 'start' }));
    await first;
    expect(request.calledOnce).to.equal(true);
  });

  it('does not publish an old login cursor or clear the new login pending request', async () => {
    const old = deferred(), current = deferred();
    request.onFirstCall().returns(old.promise);
    request.onSecondCall().returns(current.promise);
    const stale = tracker.prepare();
    tracker.reset();
    const fresh = tracker.prepare();
    old.resolve(response({ startPageToken: 'old-login' }));
    expect((await rejection(stale)).message).to.include('session changed');
    expect(tracker.prepare()).to.equal(fresh);
    current.resolve(response({ startPageToken: 'new-login' }));
    await fresh;
    expect(tracker.revision).to.include('new-login');
  });

  it('does not reuse listed validators on reset, even with the same server cursor', async () => {
    await tracker.prepare();
    const previous = tracker.revision;
    tracker.markListed('/notes/', tracker.revision);
    tracker.reset();
    request.onSecondCall().resolves(response({ startPageToken: 'start' }));
    await tracker.prepare();
    expect(tracker.getRevision('/notes/')).to.equal(undefined);
    expect(tracker.revision).not.to.equal(previous);
  });

  it('uses distinct folder revisions after reopening even if the server token is identical', async () => {
    await tracker.prepare();
    const reopened = new GoogleDriveChanges(async () => response({ startPageToken: 'start' }), () => {});
    await reopened.prepare();
    expect(reopened.revision).not.to.equal(tracker.revision);
  });

  it('reinitializes an expired cursor and invalidates IDs and listings', async () => {
    await tracker.prepare();
    changed.resetHistory();
    tracker.markListed('/notes/', tracker.revision);
    request.onSecondCall().resolves(response({}, 410));
    request.onThirdCall().resolves(response({ startPageToken: 'replacement' }));
    await tracker.prepare();
    expect(tracker.getRevision('/notes/')).to.equal(undefined);
    expect(changed.callCount).to.equal(2);
    expect(tracker.revision).to.include('replacement');
  });

  it('rejects repeated page tokens instead of looping or accepting a partial feed', async () => {
    await tracker.prepare();
    request.onSecondCall().resolves(response({ nextPageToken: 'start' }));
    expect((await rejection(tracker.prepare())).message).to.include('Repeated');
  });

  for (const body of [{}, { changes: {}, newStartPageToken: 'end' }, { nextPageToken: '' }]) {
    it('rejects malformed change pages: ' + JSON.stringify(body), async () => {
      await tracker.prepare();
      tracker.markListed('/notes/', tracker.revision);
      request.onSecondCall().resolves(response(body));
      expect(await rejection(tracker.prepare())).to.be.instanceOf(Error);
      expect(tracker.getRevision('/notes/')).to.equal(undefined);
    });
  }
});

describe('Google Drive backend reliability', () => {
  let drive, rs, request;
  beforeEach(() => {
    rs = { _emit: sinon.spy(), setBackend: sinon.spy(), authorize: sinon.spy() };
    drive = new GoogleDrive(rs, 'test-client');
    drive.token = 'token';
    drive.connected = true;
    request = sinon.stub(drive, '_request');
  });
  afterEach(() => sinon.restore());

  it('reads all listing pages, including empty intermediate pages', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.onFirstCall().resolves(response({ items: [file('a')], nextPageToken: 'a/b' }));
    request.onSecondCall().resolves(response({ nextPageToken: 'third' }));
    request.onThirdCall().resolves(response({ items: [file('b')] }));
    const result = await drive.get('/notes/');
    expect(Object.keys(result.body)).to.deep.equal(['a', 'b']);
    expect(request.secondCall.args[1]).to.include('pageToken=a%2Fb');
    expect(drive._fileIdCache.get('/remotestorage/notes/b')).to.equal('b');
  });

  for (const existing of [false, true]) {
    it(`returns a successful public put result for ${existing ? 'updates' : 'new files'}`, async () => {
      sinon.stub(drive, '_getFileId').resolves(existing ? 'file-id' : undefined);
      sinon.stub(drive, '_getParentId').resolves('parent-id');
      request.onFirstCall().resolves({ status: 200, getResponseHeader: () => 'https://www.googleapis.com/upload/session' });
      request.onSecondCall().resolves(response({ id: 'file-id', etag: '"new"', mimeType: 'text/plain' }));
      expect(await drive.put('/notes/a', 'contents', 'text/plain')).to.deep.equal({ statusCode: 200, revision: 'new', contentType: 'text/plain' });
    });
  }

  for (const status of [403, 404, 500]) {
    it(`does not turn a failed ${status} download into file contents`, async () => {
      sinon.stub(drive, '_getFileId').resolves('file-id');
      sinon.stub(drive, '_getMeta').resolves({ etag: '"old"', mimeType: 'text/plain', downloadUrl: 'https://www.googleapis.com/download' });
      request.resolves({ status, response: new TextEncoder().encode('error page').buffer });
      expect(await drive.get('/notes/a')).to.deep.equal({ statusCode: status });
    });
  }

  it('round-trips listing names through the public get API without encoding them twice', async () => {
    const title = "space % café's.txt";
    drive._fileIdCache.set('/remotestorage/notes/', 'folder-id');
    request.onFirstCall().resolves(response({ items: [file(title)] }));
    request.onSecondCall().resolves(response({ etag: '"file-v1"', mimeType: 'text/plain', fileSize: '0' }));
    const listing = await drive.get('/notes/');
    expect(Object.keys(listing.body)).to.deep.equal([title]);
    expect((await drive.get('/notes/' + Object.keys(listing.body)[0])).statusCode).to.equal(200);
    expect(request.secondCall.args[1]).to.equal('https://www.googleapis.com/drive/v2/files/' + encodeURIComponent(title));
  });

  it('discards path IDs learned before the initial change-feed baseline', async () => {
    drive._fileIdCache.set('/remotestorage/notes/', 'moved-folder');
    request.resolves(response({ startPageToken: 'start' }));
    await drive.prepareSync();
    expect(drive._fileIdCache.get('/remotestorage/notes/')).to.equal(undefined);
  });

  it('rejects a malformed listing ID instead of treating the file as missing', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.resolves(response({ items: [{ ...file('a'), id: undefined }] }));
    expect(await rejection(drive.get('/notes/'))).to.be.instanceOf(Error);
    expect(drive._fileIdCache.get('/remotestorage/notes/a')).to.equal(undefined);
  });

  for (const body of [new TextEncoder().encode('{"value":1}'), new Blob(['{"value":1}'])]) {
    it(`preserves JSON supplied as ${body.constructor.name} bytes`, async () => {
      request.onFirstCall().resolves({ status: 200, getResponseHeader: () => 'https://www.googleapis.com/upload/session' });
      request.onSecondCall().resolves(response({ etag: '"new"' }));
      await drive._updateFile('id', '/a', body, 'application/json', {});
      expect(request.secondCall.args[2].body).to.equal(body);
    });
  }

  it('does not publish partial IDs when the second listing page fails', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.onFirstCall().resolves(response({ items: [file('a')], nextPageToken: 'second' }));
    request.onSecondCall().resolves(response({}, 503));
    await rejection(drive.get('/notes/'));
    expect(drive._fileIdCache.get('/remotestorage/notes/a')).to.equal(undefined);
  });

  it('rejects incomplete search results rather than treating omitted files as deleted', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.resolves(response({ items: [], incompleteSearch: true }));
    expect((await rejection(drive.get('/notes/'))).message).to.include('Incomplete');
  });

  it('rejects a repeated listing cursor', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.resolves(response({ items: [], nextPageToken: 'same' }));
    expect((await rejection(drive.get('/notes/'))).message).to.include('page token');
    expect(request.callCount).to.equal(2);
  });

  it('preserves prototype-like filenames', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.resolves(response({ items: [file('__proto__')] }));
    const result = await drive.get('/notes/');
    expect(Object.keys(result.body)).to.deep.equal(['__proto__']);
    expect(result.body.__proto__.ETag).to.equal('file-v1');
  });

  it('rejects slash-containing names instead of aliasing a different remoteStorage path', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.resolves(response({ items: [file('a/b')] }));
    expect((await rejection(drive.get('/notes/'))).message).to.include('cannot be represented');
  });

  it('rejects listings invalidated before a change-feed baseline exists', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    const pending = deferred();
    request.returns(pending.promise);
    const listing = drive.get('/notes/');
    await Promise.resolve();
    drive.changes.invalidate();
    pending.resolve(response({ items: [file('old')] }));
    expect((await rejection(listing)).message).to.include('changed during listing');
    expect(drive._fileIdCache.get('/remotestorage/notes/old')).to.equal(undefined);
  });

  for (const operation of ['put', 'delete']) {
    it(`invalidates a folder listing read before an in-flight ${operation} completes`, async () => {
      request.onFirstCall().resolves(response({ startPageToken: 'start' }));
      await drive.prepareSync();
      sinon.stub(drive, '_getFileId').resolves('id');
      sinon.stub(drive, '_getMeta').resolves({ etag: '"old"' });
      const pending = deferred();
      sinon.stub(drive, '_updateFile').returns(pending.promise);
      request.callsFake(async method => method === 'DELETE' ? pending.promise : response({ items: [file('a')] }));
      const mutation = operation === 'put' ? drive.put('/notes/a', 'data', 'text/plain') : drive.delete('/notes/a');
      await drive.get('/notes/');
      expect(drive.changes.getRevision('/remotestorage/notes/')).to.be.a('string');
      pending.resolve(response({ etag: '"new"', mimeType: 'text/plain' }));
      await mutation;
      expect(drive.changes.getRevision('/remotestorage/notes/')).to.equal(undefined);
      expect(drive._fileIdCache.get('/remotestorage/notes/a')).to.equal(undefined);
    });
  }

  for (const meta of [{ fileSize: '4', mimeType: 'text/plain' }, { mimeType: 'application/vnd.google-apps.spreadsheet' }]) {
    it(`does not replace an unavailable ${meta.mimeType} download with an empty file`, async () => {
      sinon.stub(drive, '_getFileId').resolves('id');
      sinon.stub(drive, '_getMeta').resolves({ etag: '"old"', ...meta });
      expect((await rejection(drive.get('/notes/a'))).message).to.include('download URL');
    });
  }

  it('rejects incomplete upload metadata instead of publishing an undefined revision', async () => {
    sinon.stub(drive, '_getFileId').resolves('id');
    sinon.stub(drive, '_updateFile').resolves(response({}));
    expect((await rejection(drive.put('/notes/a', 'data', 'text/plain'))).message).to.include('upload result');
  });

  it('rejects a late download after switching accounts', async () => {
    sinon.stub(drive, '_getFileId').resolves('id');
    sinon.stub(drive, '_getMeta').resolves({ etag: '"old"', mimeType: 'text/plain', downloadUrl: 'https://www.googleapis.com/download' });
    const pending = deferred(), started = deferred();
    request.callsFake(() => { started.resolve(); return pending.promise; });
    const download = drive.get('/notes/a');
    await started.promise;
    drive.configure({ userAddress: 'new@example.test', token: 'new-token' });
    pending.resolve({ status: 200, response: new TextEncoder().encode('old account').buffer });
    expect((await rejection(download)).message).to.include('session changed');
  });

  for (const failure of [false, true]) {
    it(`balances request events after a stale ${failure ? 'failure' : 'response'} without changing the new session`, async () => {
      request.restore();
      const pending = deferred();
      sinon.stub(globalThis, 'fetch').returns(pending.promise.then(() => {
        if (failure) { throw new Error('offline'); }
        return new Response('{}');
      }));
      const download = drive._request('GET', 'https://www.googleapis.com/test', {});
      drive.configure({ userAddress: 'new@example.test', token: 'new-token' });
      pending.resolve();
      expect((await rejection(download)).message).to.include('session changed');
      expect(rs._emit.getCalls().filter(call => call.args[0] === 'wire-done')).to.have.length(1);
      expect(rs._emit.calledWith('network-offline')).to.equal(false);
    });
  }

  it('rejects requests after disconnect without sending a bearer token', async () => {
    request.restore();
    const fetch = sinon.stub(globalThis, 'fetch');
    drive.configure({ token: null, userAddress: null });
    expect((await rejection(drive._request('GET', 'https://www.googleapis.com/test', {}))).name).to.equal('Unauthorized');
    expect(fetch.called).to.equal(false);
  });

  it('invalidates IDs of children missing from a complete listing', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    drive._fileIdCache.set('/remotestorage/notes/deleted', 'stale-id');
    request.resolves(response({ items: [file('kept')] }));
    await drive.get('/notes/');
    expect(drive._fileIdCache.get('/remotestorage/notes/deleted')).to.equal(undefined);
  });

  it('rejects ambiguous duplicate names instead of choosing an arbitrary file ID', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.resolves(response({ items: [file('same'), { ...file('same'), id: 'different-id' }] }));
    expect((await rejection(drive.get('/notes/'))).message).to.include('Ambiguous');
    expect(drive._fileIdCache.get('/remotestorage/notes/same')).to.equal(undefined);
  });

  it('keeps IDs for five minutes, not 300 milliseconds', () => {
    const clock = sinon.useFakeTimers({ toFake: ['Date'] });
    drive._fileIdCache.set('/a', 'id');
    clock.tick(1000);
    expect(drive._fileIdCache.get('/a')).to.equal('id');
    clock.tick(300000);
    expect(drive._fileIdCache.get('/a')).to.equal(undefined);
  });

  it('ignores personal Drive root names and preserves the legacy app root selection', async () => {
    request.resolves(response({ items: [
      file('personal/name'), file('duplicate'), file('duplicate'),
      folder('remotestorage', 'older-mapping'), folder('remotestorage', 'legacy-mapping')
    ] }));
    const warning = sinon.stub(console, 'warn');
    expect(await drive._getFileId('/remotestorage/')).to.equal('legacy-mapping');
    expect(drive._fileIdCache.get('/personal/name')).to.equal(undefined);
    expect(warning.calledOnce).to.equal(true);
  });

  it('preserves legacy module directory selection without blocking other modules', async () => {
    drive._fileIdCache.set('/remotestorage/', 'root-id');
    request.resolves(response({ items: [
      folder('inbox', 'duplicate-id'), folder('bookmarks'), folder('inbox', 'legacy-id')
    ] }));
    sinon.stub(console, 'warn');
    expect(await drive._getFileId('/remotestorage/bookmarks/')).to.equal('bookmarks');
    expect(await drive._getFileId('/remotestorage/inbox/')).to.equal('legacy-id');
  });

  it('does not create missing directories during a read', async () => {
    sinon.stub(drive, '_getFolder').resolves({ statusCode: 200, body: {} });
    const create = sinon.spy(drive, '_createFolder');
    expect(await drive._getFileId('/missing/')).to.equal(undefined);
    expect(create.called).to.equal(false);
  });

  it('returns 404 for a missing file without requesting undefined metadata', async () => {
    sinon.stub(drive, '_getFileId').resolves(undefined);
    expect(await drive.get('/missing')).to.deep.equal({ statusCode: 404 });
    expect(request.called).to.equal(false);
  });

  for (const operation of ['put', 'delete']) {
    it('does not start ' + operation + ' with a previous account ID after reconnecting', async () => {
      const pending = deferred();
      sinon.stub(drive, '_getFileId').returns(pending.promise);
      const result = operation === 'put' ? drive.put('/a', 'data', 'text/plain') : drive.delete('/a');
      drive.configure({ userAddress: 'other@example.test', token: 'new-token' });
      pending.resolve('old-id');
      expect((await rejection(result)).message).to.include('session changed');
      expect(request.called).to.equal(false);
    });
  }

  it('checks the feed for explicit conditional reads outside periodic sync', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.onFirstCall().resolves(response({ startPageToken: 'start' }));
    await drive.prepareSync();
    request.onSecondCall().resolves(response({ items: [folder('nested')] }));
    const initial = await drive.get('/notes/');
    request.onThirdCall().resolves(response({ changes: [{ fileId: 'nested-edit' }], newStartPageToken: 'changed' }));
    request.onCall(3).resolves(response({ items: [folder('nested')] }));
    const updated = await drive.get('/notes/', { ifNoneMatch: initial.revision });
    expect(updated.statusCode).to.equal(200);
    expect(updated.revision).not.to.equal(initial.revision);
    expect(updated.body['nested/'].ETag).not.to.equal(initial.body['nested/'].ETag);
  });

  it('avoids folder listings after a verified unchanged feed', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.onFirstCall().resolves(response({ startPageToken: 'start' }));
    await drive.prepareSync();
    request.onSecondCall().resolves(response({ items: [folder('nested')] }));
    const initial = await drive.get('/notes/');
    request.onThirdCall().resolves(response({ changes: [], newStartPageToken: 'next' }));
    expect(await drive.get('/notes/', { ifNoneMatch: initial.revision })).to.deep.equal({ statusCode: 304, revision: initial.revision });
    expect(request.callCount).to.equal(3);
  });

  it('syncs a nested external edit without assuming folder metadata ETags change', async () => {
    let revision = 'file-v1', token = 'start', changed = false;
    const listings = [];
    sinon.stub(drive, '_getFileId').callsFake(async path => path);
    sinon.stub(drive, '_getFile').callsFake(async () => ({
      statusCode: 200, body: revision, contentType: 'text/plain', revision
    }));
    request.callsFake(async (method, url) => {
      if (url.includes('/startPageToken')) { return response({ startPageToken: token }); }
      if (url.includes('/changes?')) {
        const changes = changed ? [{ fileId: 'nested-file' }] : [];
        if (changed) { token = 'next'; changed = false; }
        return response({ newStartPageToken: token, changes });
      }
      const path = new URL(url).searchParams.get('q').match(/^'(.+)' in parents$/)[1];
      listings.push(path);
      return response({ items: path === '/remotestorage/notes/' ? [folder('nested')] : [file('a', revision)] });
    });
    rs.local = new InMemoryStorage();
    rs.remote = drive;
    rs.access = { checkPathPermission: path => path.startsWith('/notes/') };
    rs.caching = { onActivate() {}, checkPath: () => 'ALL' };
    const sync = new Sync(rs);
    rs.sync = sync;
    sinon.stub(sync, 'doTasks').returns(false);
    const drain = async () => {
      for (let i = 0; sync.hasTasks() && i < 20; i++) {
        const path = Object.keys(sync._tasks)[0];
        const task = await sync.doTask(path);
        await sync.handleResponse(path, task.action, await task.promise);
        delete sync._tasks[path];
        await sync.collectTasks(false);
      }
      expect(sync.hasTasks()).to.equal(false);
    };
    await drive.prepareSync();
    sync.addTask('/notes/');
    await drain();
    const originalListingCount = listings.length;
    const stale = await rs.local.getNodes(['/notes/', '/notes/nested/', '/notes/nested/a']);
    for (const node of Object.values(stale)) { node.common.timestamp = 0; }
    await rs.local.setNodes(stale);
    await sync.sync();
    await drain();
    expect(listings.length).to.equal(originalListingCount);
    revision = 'file-v2'; changed = true;
    for (const node of Object.values(stale)) { node.common.timestamp = 0; }
    await rs.local.setNodes(stale);
    await sync.sync();
    await drain();
    expect((await rs.local.getNodes(['/notes/nested/a']))['/notes/nested/a'].common.body).to.equal('file-v2');
    expect(listings.slice(originalListingCount)).to.deep.equal(['/remotestorage/notes/', '/remotestorage/notes/nested/']);
  });

  it('rejects a late listing after switching accounts without publishing its IDs', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    const pending = deferred();
    request.returns(pending.promise);
    const listing = drive.get('/notes/');
    await Promise.resolve();
    drive.configure({ userAddress: 'other@example.test', token: 'new-token' });
    pending.resolve(response({ items: [file('old-account')] }));
    expect((await rejection(listing)).message).to.include('session changed');
    expect(drive._fileIdCache.get('/remotestorage/notes/old-account')).to.equal(undefined);
  });

  it('does not restore listings invalidated by a concurrent change refresh', async () => {
    sinon.stub(drive, '_getFileId').resolves('folder-id');
    request.onFirstCall().resolves(response({ startPageToken: 'start' }));
    await drive.prepareSync();
    const pending = deferred();
    request.onSecondCall().returns(pending.promise);
    const listing = drive.get('/notes/');
    await Promise.resolve();
    request.onThirdCall().resolves(response({ changes: [{ fileId: 'a' }], newStartPageToken: 'end' }));
    await drive.prepareSync();
    pending.resolve(response({ items: [file('old')] }));
    expect((await rejection(listing)).message).to.include('changed during listing');
    expect(drive._fileIdCache.get('/remotestorage/notes/old')).to.equal(undefined);
    expect(drive.changes.getRevision('/remotestorage/notes/')).to.equal(undefined);
  });

  it('enforces conditional DELETE at the server even after metadata matched', async () => {
    sinon.stub(drive, '_getFileId').resolves('file-id');
    sinon.stub(drive, '_getMeta').resolves({ etag: '"old"' });
    request.resolves(response({}, 412));
    expect(await drive.delete('/notes/a', { ifMatch: 'old' })).to.deep.equal({ statusCode: 412 });
    expect(request.firstCall.args[2].headers['If-Match']).to.equal('"old"');
  });

  it('does not mistake an invalidated lookup for a missing file and create a duplicate', async () => {
    request.onFirstCall().resolves(response({ startPageToken: 'start' }));
    await drive.prepareSync();
    drive._fileIdCache.set('/remotestorage/notes/', 'folder-id');
    const pending = deferred();
    request.onSecondCall().returns(pending.promise);
    const create = sinon.spy(drive, '_createFile');
    const writing = drive.put('/notes/old', 'body', 'text/plain');
    await Promise.resolve();
    request.onThirdCall().resolves(response({ changes: [{ fileId: 'a' }], newStartPageToken: 'end' }));
    await drive.prepareSync();
    pending.resolve(response({ items: [file('old')] }));
    expect((await rejection(writing)).message).to.include('changed during listing');
    expect(create.called).to.equal(false);
  });

  it('does not recreate a missing file for an If-Match update', async () => {
    sinon.stub(drive, '_getFileId').resolves(undefined);
    const create = sinon.spy(drive, '_createFile');
    expect((await drive.put('/missing', 'body', 'text/plain', { ifMatch: 'old' })).statusCode).to.equal(412);
    expect(create.called).to.equal(false);
  });

  it('rejects a conditional deletion of a missing file', async () => {
    sinon.stub(drive, '_getFileId').resolves(undefined);
    expect((await drive.delete('/missing', { ifMatch: 'old' })).statusCode).to.equal(412);
    expect(request.called).to.equal(false);
  });

  it('uploads newly created JSON through PUT without double-stringifying a JSON string', async () => {
    sinon.stub(drive, '_getParentId').resolves('parent');
    request.onFirstCall().resolves({ status: 200, getResponseHeader: () => 'https://www.googleapis.com/upload/session' });
    request.onSecondCall().resolves(response({ etag: '"new"' }));
    await drive._createFile('/notes/a', '{"value":1}', 'application/json');
    expect(request.secondCall.args[0]).to.equal('PUT');
    expect(request.secondCall.args[2].body).to.equal('{"value":1}');
  });

  it('does not upload bytes when resumable initiation fails or lacks a Location', async () => {
    request.resolves({ status: 503, getResponseHeader: () => null });
    expect((await rejection(drive._updateFile('id', '/a', 'data', 'text/plain', {}))).message).to.include('503');
    expect(request.calledOnce).to.equal(true);
  });

  it('preserves If-Match on the final resumable upload request', async () => {
    request.onFirstCall().resolves({ status: 200, getResponseHeader: () => 'https://www.googleapis.com/upload/session' });
    request.onSecondCall().resolves(response({}, 412));
    const result = await drive._updateFile('id', '/a', 'data', 'text/plain', { ifMatch: 'old' });
    expect(request.firstCall.args[2].headers['If-Match']).to.equal('"old"');
    expect(request.secondCall.args[2].headers['If-Match']).to.equal('"old"');
    expect(result.status).to.equal(412);
  });

  for (const location of [null, 'https://elsewhere.example/upload']) {
    it('rejects an invalid upload session location: ' + location, async () => {
      request.resolves({ status: 200, getResponseHeader: () => location });
      expect(await rejection(drive._updateFile('id', '/a', 'data', 'text/plain', {}))).to.be.instanceOf(Error);
      expect(request.calledOnce).to.equal(true);
    });
  }

  it('reports unauthorized HTTP responses without redirecting or returning undefined', async () => {
    request.restore();
    sinon.stub(globalThis, 'fetch').resolves(new Response('{}', { status: 401 }));
    const error = await rejection(drive._request('GET', 'https://www.googleapis.com/test', {}));
    expect(error.name).to.equal('Unauthorized');
    expect(rs.authorize.called).to.equal(false);
    expect(rs._emit.calledWith('wire-done', { method: 'GET', isFolder: false, success: false })).to.equal(true);
  });
});

describe('Sync backend preparation', () => {
  let rs, sync;
  beforeEach(() => {
    rs = { local: new InMemoryStorage(), remote: { connected: true }, caching: { onActivate() {} }, _emit: sinon.spy() };
    sync = new Sync(rs);
    rs.sync = sync;
    sinon.stub(sync, 'doTasks').returns(true);
  });
  afterEach(() => sinon.restore());

  it('awaits change tracking before examining cached revisions', async () => {
    const pending = deferred();
    rs.remote.prepareSync = () => pending.promise;
    const run = sync.sync();
    expect(sync.doTasks.called).to.equal(false);
    pending.resolve();
    await run;
    expect(sync.doTasks.calledOnce).to.equal(true);
  });

  it('does not request a change feed before the backend is connected', async () => {
    rs.remote.connected = false;
    rs.remote.prepareSync = sinon.stub().rejects(new UnauthorizedError());
    await sync.sync();
    expect(rs.remote.prepareSync.called).to.equal(false);
    expect(rs._emit.called).to.equal(false);
  });

  it('reports failed preparation and reschedules rather than syncing stale revisions', async () => {
    rs.remote.prepareSync = async () => { throw new Error('feed unavailable'); };
    await sync.sync();
    expect(sync.doTasks.called).to.equal(false);
    expect(rs._emit.calledWith('sync-done', { completed: false })).to.equal(true);
    expect(rs._emit.firstCall.args[1].message).to.include('feed unavailable');
  });

  it('reports expired authorization during preparation so the app can reconnect', async () => {
    rs.remote.prepareSync = async () => { throw new UnauthorizedError(); };
    await sync.sync();
    expect(rs._emit.firstCall.args[1]).to.be.instanceOf(UnauthorizedError);
    expect(sync.doTasks.called).to.equal(false);
  });

  it('reports expired authorization during a file request rather than a network failure', async () => {
    sinon.stub(sync, 'dealWithFailure').resolves();
    sinon.stub(sync, 'finishUnsuccessfulTask').resolves();
    await sync.finishTask({ path: '/notes/a', action: 'get', promise: Promise.reject(new UnauthorizedError()) }, true);
    expect(rs._emit.firstCall.args[1]).to.be.instanceOf(UnauthorizedError);
  });

  for (const replacement of ['sync', 'remote']) {
    it('ignores preparation from a replaced ' + replacement, async () => {
      const pending = deferred();
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
