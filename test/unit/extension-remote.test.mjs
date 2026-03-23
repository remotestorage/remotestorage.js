import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { localStorage } from '../helpers/memoryStorage.mjs';
import ExtensionRemoteModule from '../../build/extension-remote.js';
import { RemoteStorage } from '../../build/remotestorage.js';

chai.use(chaiAsPromised);

const ExtensionRemote = ExtensionRemoteModule.default || ExtensionRemoteModule;

describe('ExtensionRemote', () => {
  let rs;
  let remote;

  beforeEach(() => {
    rs = new RemoteStorage({ cache: false });
    remote = new ExtensionRemote(rs);
    localStorage.clear();
    globalThis.remoteStorageExtension = {
      ping: async () => ({ version: 1 }),
      request: async () => ({ statusCode: 200, body: 'ok', contentType: 'text/plain' }),
      disconnect: async () => undefined
    };
  });

  afterEach(() => {
    localStorage.clear();
    delete globalThis.remoteStorageExtension;
    rs.disconnect();
    rs = undefined;
    remote = undefined;
  });

  it('connects with session state and no token', () => {
    remote.configure({
      sessionId: 'session-123',
      grantedScopes: 'notes:rw',
      href: 'https://storage.example.com/user',
      storageApi: 'draft-dejong-remotestorage-13',
      userAddress: 'user@example.com'
    });

    expect(remote.connected).to.equal(true);
    expect(remote.token).to.equal(undefined);
    expect(localStorage.getItem('remotestorage:wireclient')).to.equal(null);
  });

  it('parses folder listings like WireClient', async () => {
    remote.configure({
      sessionId: 'session-123',
      href: 'https://storage.example.com/user',
      storageApi: 'draft-dejong-remotestorage-13',
      userAddress: 'user@example.com'
    });
    globalThis.remoteStorageExtension.request = async () => ({
      statusCode: 200,
      body: JSON.stringify({
        '@context': 'http://remotestorage.io/spec/folder-description',
        items: {
          'note-1': { ETag: 'rev-1' }
        }
      }),
      contentType: 'application/json',
      revision: 'folder-rev'
    });

    const response = await remote.get('/notes/');
    expect(response.statusCode).to.equal(200);
    expect(response.body).to.deep.equal({
      'note-1': { ETag: 'rev-1' }
    });
  });

  it('emits Unauthorized when the extension returns 401', async () => {
    remote.configure({
      sessionId: 'session-123',
      href: 'https://storage.example.com/user',
      storageApi: 'draft-dejong-remotestorage-13',
      userAddress: 'user@example.com'
    });
    globalThis.remoteStorageExtension.request = async () => ({
      statusCode: 401
    });

    const error = new Promise(resolve => rs.on('error', resolve));
    const response = await remote.get('/notes/item');
    const err = await error;

    expect(response.statusCode).to.equal(401);
    expect(err.name).to.equal('Unauthorized');
  });

  it('emits network-offline when the bridge request fails', async () => {
    remote.configure({
      sessionId: 'session-123',
      href: 'https://storage.example.com/user',
      storageApi: 'draft-dejong-remotestorage-13',
      userAddress: 'user@example.com'
    });
    let offline = 0;
    rs.on('network-offline', () => { offline++; });
    globalThis.remoteStorageExtension.request = async () => Promise.reject(new Error('boom'));

    await expect(remote.get('/notes/item')).to.be.rejected;
    expect(offline).to.equal(1);
  });
});
