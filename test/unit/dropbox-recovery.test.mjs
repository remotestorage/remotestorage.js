import 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Dropbox from '../../build/dropbox.js';
import RevisionCache from '../../build/revisioncache.js';

use(chaiAsPromised);

const ROOT = '/remotestorage';
const reply = (body, status = 200) => ({ status, responseText: JSON.stringify(body) });
const file = (path, rev) => ({ '.tag': 'file', path_display: ROOT + path, rev });
const missing = reply({ error: { '.tag': 'path', path: { '.tag': 'not_found' } } }, 409);
const conflict = reply({ error: { '.tag': 'path', path: { reason: { '.tag': 'conflict', conflict: { '.tag': 'file' } }, upload_session_id: 'session' } } }, 409);
const reset = reply({ error: { '.tag': 'reset' }, error_summary: 'reset/' }, 409);

describe('Dropbox conditional mutations and change-feed recovery', () => {
  let dropbox;
  beforeEach(() => {
    dropbox = Object.assign(Object.create(Dropbox.prototype), {
      connected: true, userAddress: 'user@example.test', _initialFetchDone: true,
      _revCache: new RevisionCache('rev'), _fetchDeltaCursor: null, _fetchDeltaPromise: null,
      _itemRefs: {}, rs: { _emit: sinon.spy() }, _request: sinon.stub(), _shareIfNeeded: sinon.spy()
    });
  });

  it('enforces revision updates at upload time, including identical contents and deletion races', async () => {
    dropbox._getMetadata = sinon.stub().resolves({ rev: 'old' });
    dropbox._request.resolves(reply({ rev: 'new' }));
    const result = await dropbox.put('/file', 'data', 'text/plain', { ifMatch: 'old' });
    const args = JSON.parse(dropbox._request.firstCall.args[2].headers['Dropbox-API-Arg']);
    expect(args).to.include({ strict_conflict: true, autorename: false });
    expect(args.mode).to.deep.equal({ '.tag': 'update', update: 'old' });
    expect(result).to.deep.equal({ statusCode: 200, revision: 'new' });
  });

  it('uses strict add mode for create-only uploads', async () => {
    dropbox._getMetadata = sinon.stub().resolves(undefined);
    dropbox._request.resolves(reply({ rev: 'new' }));
    await dropbox.put('/file', 'data', 'text/plain', { ifNoneMatch: '*' });
    const args = JSON.parse(dropbox._request.firstCall.args[2].headers['Dropbox-API-Arg']);
    expect(args.mode).to.deep.equal({ '.tag': 'add' });
    expect(args).to.include({ strict_conflict: true, autorename: false });
  });

  it('returns 412 when another writer changes the file after metadata lookup', async () => {
    dropbox._getMetadata = sinon.stub().onFirstCall().resolves({ rev: 'old' }).onSecondCall().resolves({ rev: 'other' });
    dropbox._request.resolves(conflict);
    expect(await dropbox.put('/file', 'ours', 'text/plain', { ifMatch: 'old' }))
      .to.deep.equal({ statusCode: 412, revision: 'other' });
    expect(dropbox._shareIfNeeded.called).to.equal(false);
    expect(dropbox._revCache.get('/file')).to.equal('rev');
  });

  it('preserves upload conflicts if the competing file disappears before metadata can be read', async () => {
    dropbox._getMetadata = sinon.stub().resolves(undefined);
    dropbox._request.resolves(conflict);
    expect((await dropbox.put('/file', 'ours', 'text/plain', { ifNoneMatch: '*' })).statusCode).to.equal(412);
  });

  it('does not recreate a missing file for ifMatch', async () => {
    dropbox._getMetadata = sinon.stub().resolves(undefined);
    expect((await dropbox.put('/file', 'ours', 'text/plain', { ifMatch: 'old' })).statusCode).to.equal(412);
    expect(dropbox._request.called).to.equal(false);
  });

  it('enforces conditional deletion with parent_rev and preserves cache on conflict', async () => {
    dropbox._revCache.set('/file', 'old');
    dropbox._getMetadata = sinon.stub().resolves({ rev: 'old' });
    dropbox._request.resolves(reply({ error: { '.tag': 'path_write', path_write: { '.tag': 'conflict' } } }, 409));
    expect((await dropbox.delete('/file', { ifMatch: 'old' })).statusCode).to.equal(412);
    expect(dropbox._request.firstCall.args[2].body).to.deep.equal({ path: ROOT + '/file', parent_rev: 'old' });
    expect(dropbox._revCache.get('/file')).to.equal('old');
  });

  it('accepts a conditional delete when the revision cache has not seen the file', async () => {
    dropbox._getMetadata = sinon.stub().resolves({ rev: 'old' });
    dropbox._request.resolves(reply({ rev: 'old' }));
    expect((await dropbox.delete('/file', { ifMatch: 'old' })).statusCode).to.equal(200);
    expect(dropbox._revCache.get('/file')).to.equal(null);
  });

  it('rebuilds from every page after an expired cursor, dropping stale old entries', async () => {
    dropbox._revCache.set('/gone', 'old');
    dropbox._fetchDeltaCursor = 'expired';
    dropbox._request.onCall(0).resolves(reset);
    dropbox._request.onCall(1).resolves(reply({ entries: [file('/nested/a', 'a')], cursor: 'page2', has_more: true }));
    dropbox._request.onCall(2).resolves(reply({ entries: [file('/nested/b', 'b')], cursor: 'current', has_more: false }));
    await dropbox.fetchDelta();
    expect(dropbox._request.secondCall.args[2].body).to.deep.equal({ path: ROOT, recursive: true, include_deleted: true });
    expect(dropbox._request.thirdCall.args[2].body).to.deep.equal({ cursor: 'page2' });
    expect(dropbox._fetchDeltaCursor).to.equal('current');
    expect(dropbox._revCache.get('/gone')).to.equal('rev');
    expect(dropbox._revCache.get('/nested/a')).to.equal('a');
    expect(dropbox._revCache.get('/nested/b')).to.equal('b');
    expect(dropbox._revCache.get('/nested/')).not.to.equal('rev');
  });

  it('keeps the previous cursor and revisions when a later delta page fails', async () => {
    dropbox._revCache.set('/file', 'old');
    const ancestor = dropbox._revCache.get('/');
    dropbox._fetchDeltaCursor = 'before';
    dropbox._request.onCall(0).resolves(reply({ entries: [file('/file', 'new')], cursor: 'page2', has_more: true }));
    dropbox._request.onCall(1).rejects('timeout');
    await expect(dropbox.fetchDelta()).to.be.rejected;
    expect(dropbox._fetchDeltaCursor).to.equal('before');
    expect(dropbox._revCache.get('/file')).to.equal('old');
    expect(dropbox._revCache.get('/')).to.equal(ancestor);
    expect(dropbox._fetchDeltaPromise).to.equal(null);
  });

  it('does not publish an incomplete initial listing', async () => {
    dropbox._initialFetchDone = false;
    dropbox._request.onCall(0).resolves(reply({ entries: [file('/file', 'new')], cursor: 'page2', has_more: true }));
    dropbox._request.onCall(1).resolves(reply({}, 503));
    await expect(dropbox.fetchDelta()).to.be.rejected;
    expect(dropbox._initialFetchDone).to.equal(false);
    expect(dropbox._revCache.get('/file')).to.equal('rev');
    expect(dropbox._fetchDeltaCursor).to.equal(null);
  });

  it('bounds repeated reset attempts', async () => {
    dropbox._fetchDeltaCursor = 'expired';
    dropbox._request.resolves(reset);
    await expect(dropbox.fetchDelta()).to.be.rejectedWith(/reset/);
    expect(dropbox._request.callCount).to.equal(2);
  });

  it('rebuilds an empty revision tree when the storage root disappears', async () => {
    dropbox._revCache.set('/file', 'old');
    dropbox._fetchDeltaCursor = 'previous';
    dropbox._request.resolves(missing);
    await dropbox.fetchDelta();
    expect(dropbox._fetchDeltaCursor).to.equal(null);
    expect(dropbox._revCache.get('/file')).to.equal('rev');
  });

  it('shares concurrent feed requests and advances even an empty feed cursor', async () => {
    let resolve;
    dropbox._request.returns(new Promise(done => { resolve = done; }));
    const first = dropbox.fetchDelta();
    expect(dropbox.fetchDelta()).to.equal(first);
    resolve(reply({ entries: [], cursor: 'new', has_more: false }));
    await first;
    expect(dropbox._fetchDeltaCursor).to.equal('new');
    expect(dropbox._request.callCount).to.equal(1);
  });

  it('rejects a malformed batch before applying any entries', async () => {
    dropbox._fetchDeltaCursor = 'old';
    dropbox._revCache.set('/file', 'old');
    dropbox._request.resolves(reply({ entries: [file('/file', 'new'), { '.tag': 'file', rev: 'bad' }], cursor: 'new' }));
    await expect(dropbox.fetchDelta()).to.be.rejectedWith(/Invalid Dropbox delta entry/);
    expect(dropbox._revCache.get('/file')).to.equal('old');
    expect(dropbox._fetchDeltaCursor).to.equal('old');
  });

  it('uses path_lower when the feed omits path_display', async () => {
    dropbox._request.resolves(reply({ entries: [{ '.tag': 'file', path_lower: ROOT + '/file', rev: 'new' }], cursor: 'new' }));
    await dropbox.fetchDelta();
    expect(dropbox._revCache.get('/file')).to.equal('new');
  });

  it('discards feed results belonging to a disconnected or replaced account', async () => {
    let resolve;
    dropbox._request.returns(new Promise(done => { resolve = done; }));
    const pending = dropbox.fetchDelta();
    dropbox.userAddress = 'other@example.test';
    resolve(reply({ entries: [file('/file', 'wrong-account')], cursor: 'wrong' }));
    await expect(pending).to.be.rejectedWith(/session changed/);
    expect(dropbox._revCache.get('/file')).to.equal('rev');
    expect(dropbox._fetchDeltaCursor).to.equal(null);
  });

  it('propagates a nested deletion to cached descendants and all ancestors', async () => {
    dropbox._revCache.set('/nested/file', 'old');
    const root = dropbox._revCache.get('/');
    dropbox._fetchDeltaCursor = 'before';
    dropbox._request.resolves(reply({ entries: [{ '.tag': 'deleted', path_display: ROOT + '/nested' }], cursor: 'after' }));
    await dropbox.fetchDelta();
    expect(dropbox._revCache.get('/nested/file')).to.equal(null);
    expect(dropbox._revCache.get('/')).not.to.equal(root);
  });

  it('changes ancestor revisions for newly added empty folders', async () => {
    dropbox._revCache.set('/existing/file', 'old');
    const root = dropbox._revCache.get('/');
    dropbox._fetchDeltaCursor = 'before';
    dropbox._request.resolves(reply({ entries: [{ '.tag': 'folder', path_display: ROOT + '/empty' }], cursor: 'after' }));
    await dropbox.fetchDelta();
    expect(dropbox._revCache.get('/')).not.to.equal(root);
    expect(dropbox._revCache.get('/existing/file')).to.equal('old');
  });

  it('awaits initial delta before checking a cached deletion', async () => {
    dropbox._initialFetchDone = false;
    dropbox._revCache.delete('/file');
    dropbox._request.onCall(0).resolves(reply({ entries: [file('/file', 'restored')], cursor: 'current' }));
    expect((await dropbox.get('/file', { ifNoneMatch: 'restored' })).statusCode).to.equal(304);
    expect(dropbox._request.callCount).to.equal(1);
  });
});
