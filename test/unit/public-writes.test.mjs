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
