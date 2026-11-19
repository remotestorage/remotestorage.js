import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import SyncedGetPutDelete from '../../build/syncedgetputdelete.js';

describe('public module writes', () => {
  for (const backend of ['dropbox', 'googledrive', 'solid']) {
    it('waits for the ' + backend + ' upload before resolving a public write', async () => {
      let finish;
      const remote = { put: sinon.stub().returns(new Promise(resolve => { finish = resolve; })) };
      const local = { put: sinon.stub().resolves({ statusCode: 200 }) };
      const storage = { backend, remote, local, _emit: sinon.spy() };
      let completed = false;
      const write = SyncedGetPutDelete.put.call(storage, '/public/shares/file', 'text', 'text/plain')
        .then(result => { completed = true; return result; });
      await Promise.resolve();
      expect(completed).to.equal(false);
      expect(local.put.called).to.equal(false);
      finish({ statusCode: 201 });
      expect((await write).statusCode).to.equal(201);
      await SyncedGetPutDelete.put.call(storage, '/shares/private', 'text', 'text/plain');
      expect(local.put.calledOnce).to.equal(true);
    });
  }
});

describe('public module deletion', () => {
  for (const backend of ['dropbox', 'googledrive', 'solid']) {
    it('waits for ' + backend + ' removal of an uncached public file', async () => {
      let finish;
      const remote = { delete: sinon.stub().returns(new Promise(resolve => { finish = resolve; })) };
      const local = { delete: sinon.stub().resolves({ statusCode: 200 }), flush: sinon.stub().resolves() };
      const storage = { backend, remote, local, _emit: sinon.spy() };
      let completed = false;
      const removal = SyncedGetPutDelete.delete.call(storage, '/public/shares/file', true)
        .then(result => { completed = true; return result; });
      await Promise.resolve();
      expect(completed).to.equal(false);
      expect(local.delete.called).to.equal(false);
      expect(local.flush.called).to.equal(false);
      finish({ statusCode: 204 });
      expect((await removal).statusCode).to.equal(204);
      expect(local.flush.calledWith('/public/shares/file')).to.equal(true);
      await SyncedGetPutDelete.delete.call(storage, '/shares/private', true);
      expect(local.delete.calledOnce).to.equal(true);
    });
  }
  it('keeps the cache when deletion is refused', async () => {
    const local = { flush: sinon.spy() };
    const storage = { backend: 'solid', remote: { delete: sinon.stub().resolves({ statusCode: 403 }) }, local, _emit: sinon.spy() };
    expect((await SyncedGetPutDelete.delete.call(storage, '/public/shares/file', true)).statusCode).to.equal(403);
    expect(local.flush.called).to.equal(false);
  });
});
