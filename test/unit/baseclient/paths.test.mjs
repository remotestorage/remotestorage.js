import 'mocha';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import { BaseClient } from '../../../build/baseclient.js';

chai.use(chaiAsPromised);

const makeStorage = () => ({
  onChange: () => {},
  access: { checkPathPermission: () => true },
  get: sinon.stub(),
  put: sinon.stub(),
  delete: sinon.stub(),
});

describe('BaseClient document path validation', () => {
  let storage;
  let client;

  beforeEach(() => {
    storage = makeStorage();
    client = new BaseClient(storage, '/foo/');
  });

  const folderPaths = ['foo/', 'foo//', 'foo/bar/', ''];
  const documentPaths = ['foo', 'foo/bar', 'foo.bar'];

  describe('#storeFile', () => {
    it('rejects folder and empty paths', async () => {
      for (const path of folderPaths) {
        await expect(client.storeFile('text/plain', path, 'x'))
          .to.be.rejectedWith('Not a document: ' + path);
      }
      expect(storage.put.called).to.equal(false);
    });

    it('accepts document paths', async () => {
      storage.put.resolves({ statusCode: 200, revision: 'r1' });
      for (const path of documentPaths) {
        storage.put.resetHistory();
        await expect(client.storeFile('text/plain', path, 'x'))
          .to.eventually.equal('r1');
        expect(storage.put.calledOnce).to.equal(true);
      }
    });
  });

  describe('#storeObject', () => {
    beforeEach(() => {
      client.declareType('test', {});
    });

    it('rejects folder and empty paths', async () => {
      for (const path of folderPaths) {
        await expect(client.storeObject('test', path, { test: 1 }))
          .to.be.rejectedWith('Not a document: ' + path);
      }
      expect(storage.put.called).to.equal(false);
    });

    it('accepts document paths', async () => {
      storage.put.resolves({ statusCode: 200, revision: 'r1' });
      for (const path of documentPaths) {
        storage.put.resetHistory();
        await expect(client.storeObject('test', path, { test: 1 }))
          .to.eventually.equal('r1');
        expect(storage.put.calledOnce).to.equal(true);
      }
    });
  });

  describe('#remove', () => {
    it('rejects folder and empty paths', async () => {
      for (const path of folderPaths) {
        await expect(client.remove(path))
          .to.be.rejectedWith('Not a document: ' + path);
      }
      expect(storage.delete.called).to.equal(false);
    });

    it('accepts document paths', async () => {
      storage.delete.resolves({ statusCode: 200 });
      for (const path of documentPaths) {
        storage.delete.resetHistory();
        await client.remove(path);
        expect(storage.delete.calledOnce).to.equal(true);
      }
    });
  });

  describe('#getFile', () => {
    it('rejects folder and empty paths', async () => {
      for (const path of folderPaths) {
        await expect(client.getFile(path))
          .to.be.rejectedWith('Not a document: ' + path);
      }
      expect(storage.get.called).to.equal(false);
    });

    it('accepts document paths', async () => {
      storage.get.resolves({ statusCode: 200, body: 'x', contentType: 'text/plain' });
      for (const path of documentPaths) {
        storage.get.resetHistory();
        await client.getFile(path);
        expect(storage.get.calledOnce).to.equal(true);
      }
    });
  });

  describe('#getObject', () => {
    it('rejects folder and empty paths', async () => {
      for (const path of folderPaths) {
        await expect(client.getObject(path))
          .to.be.rejectedWith('Not a document: ' + path);
      }
      expect(storage.get.called).to.equal(false);
    });

    it('accepts document paths', async () => {
      storage.get.resolves({ statusCode: 200, body: '{"test":1}' });
      for (const path of documentPaths) {
        storage.get.resetHistory();
        await expect(client.getObject(path)).to.eventually.deep.equal({ test: 1 });
        expect(storage.get.calledOnce).to.equal(true);
      }
    });
  });
});
