import 'mocha';
import { expect } from 'chai';

import { localStorage } from '../helpers/memoryStorage.mjs';
import LocalStorage from '../../build/localstorage.js';
import { RemoteStorage } from '../../build/remotestorage.js';

const NODES_PREFIX = 'remotestorage:cache:nodes:';
const CHANGES_PREFIX = 'remotestorage:cache:changes:';
const WIRECLIENT_SETTINGS_KEY = 'remotestorage:wireclient';

function seedCache() {
  localStorage.setItem(
    NODES_PREFIX + 'notes/private.txt',
    JSON.stringify({ path: 'notes/private.txt', local: { body: 'A_ONLY' } })
  );
  localStorage.setItem(
    CHANGES_PREFIX + 'notes/private.txt',
    JSON.stringify({ path: 'notes/private.txt', action: 'push' })
  );
}

describe('LocalStorage', function() {
  beforeEach(function() {
    localStorage.clear();
  });

  afterEach(function() {
    localStorage.clear();
  });

  describe('_rs_cleanup', function() {
    it('removes remoteStorage cache keys', function() {
      seedCache();

      LocalStorage._rs_cleanup();

      expect(localStorage.getItem(NODES_PREFIX + 'notes/private.txt')).to.be.null;
      expect(localStorage.getItem(CHANGES_PREFIX + 'notes/private.txt')).to.be.null;
    });

    it('leaves unrelated cache values untouched', function() {
      localStorage.setItem('unrelated', 'keep-me');
      localStorage.setItem(NODES_PREFIX + 'notes/private.txt', JSON.stringify({ path: 'notes/private.txt' }));

      LocalStorage._rs_cleanup();

      expect(localStorage.getItem('unrelated')).to.equal('keep-me');
      expect(localStorage.getItem(NODES_PREFIX + 'notes/private.txt')).to.be.null;
    });

    it('leaves unrelated entries with numeric names untouched', function() {
      localStorage.setItem('0', 'keep-zero');
      localStorage.setItem('1', 'keep-one');
      localStorage.setItem(NODES_PREFIX + 'notes/private.txt', JSON.stringify({ path: 'notes/private.txt' }));

      LocalStorage._rs_cleanup();

      expect(localStorage.getItem('0')).to.equal('keep-zero');
      expect(localStorage.getItem('1')).to.equal('keep-one');
      expect(localStorage.getItem(NODES_PREFIX + 'notes/private.txt')).to.be.null;
    });
  });

  describe('disconnect() integration', function() {
    it('removes the cache entries when disconnect() is called', async function() {
      const rs = new RemoteStorage();
      await new Promise((resolve) => rs.on('features-loaded', resolve));
      expect(rs.local).to.be.an.instanceOf(LocalStorage);

      seedCache();
      localStorage.setItem('unrelated', 'keep-me');

      await new Promise((resolve) => {
        rs.on('disconnected', resolve);
        rs.disconnect();
      });

      expect(localStorage.getItem(NODES_PREFIX + 'notes/private.txt')).to.be.null;
      expect(localStorage.getItem(CHANGES_PREFIX + 'notes/private.txt')).to.be.null;
      expect(localStorage.getItem('unrelated')).to.equal('keep-me');
    });

    it('removes the cache entries when disconnecting from a ready handler', async function() {
      // A restored session: the stored WireClient settings make the remote
      // connected, so `ready` fires during feature loading.
      localStorage.setItem(WIRECLIENT_SETTINGS_KEY, JSON.stringify({
        userAddress: 'user@example.com',
        href: 'https://storage.example.com/user/',
        storageApi: 'draft-dejong-remotestorage-02',
        token: 'access-token'
      }));
      seedCache();
      localStorage.setItem('unrelated', 'keep-me');

      const rs = new RemoteStorage();
      let disconnected = false;

      await new Promise((resolve) => {
        rs.on('ready', () => {
          if (disconnected) { return; }
          disconnected = true;
          rs.on('disconnected', resolve);
          rs.disconnect();
        });
      });

      expect(localStorage.getItem(NODES_PREFIX + 'notes/private.txt')).to.be.null;
      expect(localStorage.getItem(CHANGES_PREFIX + 'notes/private.txt')).to.be.null;
      expect(localStorage.getItem('unrelated')).to.equal('keep-me');
    });

    it('removes the cache entries when disconnecting from a connected handler', async function() {
      localStorage.setItem(WIRECLIENT_SETTINGS_KEY, JSON.stringify({
        userAddress: 'user@example.com',
        href: 'https://storage.example.com/user/',
        storageApi: 'draft-dejong-remotestorage-02',
        token: 'access-token'
      }));
      seedCache();
      localStorage.setItem('unrelated', 'keep-me');

      const rs = new RemoteStorage();
      let disconnected = false;

      await new Promise((resolve) => {
        rs.on('connected', () => {
          if (disconnected) { return; }
          disconnected = true;
          rs.on('disconnected', resolve);
          rs.disconnect();
        });
      });

      expect(localStorage.getItem(NODES_PREFIX + 'notes/private.txt')).to.be.null;
      expect(localStorage.getItem(CHANGES_PREFIX + 'notes/private.txt')).to.be.null;
      expect(localStorage.getItem('unrelated')).to.equal('keep-me');
    });
  });
});
