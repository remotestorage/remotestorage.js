import 'mocha';
import { expect } from 'chai';

import { localStorage } from '../helpers/memoryStorage.mjs';
import LocalStorage from '../../build/localstorage.js';

const NODES_PREFIX = 'remotestorage:cache:nodes:';
const CHANGES_PREFIX = 'remotestorage:cache:changes:';

describe('LocalStorage', function() {
  beforeEach(function() {
    localStorage.clear();
  });

  afterEach(function() {
    localStorage.clear();
  });

  describe('_rs_cleanup', function() {
    it('removes remoteStorage cache keys', function() {
      localStorage.setItem(
        NODES_PREFIX + 'notes/private.txt',
        JSON.stringify({ path: 'notes/private.txt', local: { body: 'A_ONLY' } })
      );
      localStorage.setItem(
        CHANGES_PREFIX + 'notes/private.txt',
        JSON.stringify({ path: 'notes/private.txt', action: 'push' })
      );

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
});
