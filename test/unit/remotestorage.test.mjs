import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import Dropbox from '../../build/dropbox.js';
import { EventHandling } from '../../build/eventhandling.js';
import { RemoteStorage } from '../../build/remotestorage.js';
import { applyMixins } from '../../build/util.js';
import { localStorage } from '../helpers/memoryStorage.mjs';

chai.use(chaiAsPromised);

const AUTHORIZED_SCOPE_KEY = 'remotestorage:authorized-scope';
const WIRECLIENT_SETTINGS_KEY = 'remotestorage:wireclient';

class FakeRemote {
  constructor (connected) {
    this.fakeRemote = true;
    this.connected = (typeof connected === 'boolean') ? connected : true;
    this.configure = function() {};
    this.stopWaitingForToken = function() {
      if (!this.connected) { this._emit('not-connected'); }
    };
    this.addEvents(['connected', 'disconnected', 'not-connected']);
  }
}
applyMixins(FakeRemote, [ EventHandling ]);

describe("RemoteStorage", function() {
  beforeEach(function() {
    this.rs = new RemoteStorage({ cache: false });
  });

  afterEach(function() {
    this.rs.disconnect();
    this.rs = undefined;
    fetchMock.reset();
    sinon.reset();
  });

  describe('#addModule', function() {
    it('creates a module', function() {
      this.rs.addModule({ name: 'foo', builder: function() {
        return { exports: { it: 'worked' } };
      }});

      expect(this.rs.foo.it).to.equal('worked');
    });

    it('allows hyphens in module names', function() {
      this.rs.addModule({ name: 'foo-bar', builder: function() {
        return { exports: { it: 'worked' } };
      }});

      expect(this.rs['foo-bar'].it).to.equal('worked');
    });

    it('is called when passing a module to the RemoteStorage constructor', function() {
      const rs = new RemoteStorage({ modules: [
        {
          name: 'bar', builder: function() {
            return { exports: { it: 'worked' } };
          }
        }
      ]});

      expect(rs['bar'].it).to.equal('worked');
    });
  });

  describe("#connect", function() {
    before(function() {
      fetchMock.mock(/acct\:timeout@example\.com/, 200, {
        delay: 1000
      });
      fetchMock.mock(/personal\.ho\.st/, 200);
      fetchMock.mock(/acct\:user@ho\.st/, 200);
    });

    beforeEach(function() {
      this.rs = new RemoteStorage({
        cache: false,
        discoveryTimeout: 10
      });
    });

    it("throws DiscoveryError when userAddress doesn't contain an @ or URL", function(done) {
      this.rs.on('error', function(e) {
        expect(e).to.be.an.instanceof(RemoteStorage.DiscoveryError);
        expect(e.message).to.match(/Not a valid user address/);
        done();
      });

      this.rs.connect('somestring');
    });

    it("throws DiscoveryError on timeout of RemoteStorage.Discover", function(done) {
      this.rs.on('error', function(e) {
        expect(e).to.be.an.instanceof(RemoteStorage.DiscoveryError);
        expect(e.message).to.match(/No storage information found/);
        done();
      });

      this.rs.connect("timeout@example.com");
    });

    it("accepts URLs for the userAddress", function(done) {
      this.rs.on('error', function(/* err */) {
        throw new Error('URL userAddress was not accepted.');
      });

      this.rs.remote = new FakeRemote(false);
      this.rs.remote.configure = function (options) {
        expect(options.userAddress).to.equal('https://personal.ho.st');
        done();
      };

      this.rs.connect('https://personal.ho.st');
    });

    it("adds missing https:// to URLs", function(done) {
      this.rs.on('error', function(/* err */) {
        throw new Error('URL userAddress was not accepted.');
      });

      this.rs.remote = new FakeRemote(false);
      this.rs.remote.configure = function (options) {
        expect(options.userAddress).to.equal('https://personal.ho.st');
        done();
      };

      this.rs.connect('personal.ho.st');
    });

    it("sets the backend to remotestorage", function() {
      this.rs.remote = new FakeRemote(false);
      this.rs.backend = undefined;

      this.rs.connect('user@ho.st');

      expect(this.rs.backend).to.equal('remotestorage');
    });
  });

  describe("#setApiKeys", function() {
    before(function() {
      this.dropboxRsInit = Dropbox._rs_init;
    });

    afterEach(function() {
      Dropbox._rs_init = this.dropboxRsInit;
    });

    it("initializes the configured backend when it's not initialized yet", function(done) {
      Dropbox._rs_init = function() { done(); };

      this.rs.setApiKeys({ dropbox: 'testkey' });
    });

    it("reinitializes the configured backend when the key changed", function(done) {
      this.rs.apiKeys.dropbox = { appKey: 'old key' };

      Dropbox._rs_init = function() { done(); };

      this.rs.setApiKeys({ dropbox: 'new key' });
    });

    it("does not reinitialize the configured backend when key didn't change", function(done) {
      this.rs.setApiKeys({ dropbox: 'old key' });

      Dropbox._rs_init = function() {
        done(new Error('Backend got reinitialized again although the key did not change.'));
      };

      this.rs.setApiKeys({ dropbox: 'old key' });
      done();
    });

    it("allows setting values for 'googledrive' and 'dropbox'", function() {
      this.rs.setApiKeys({ dropbox: '123abc', googledrive: '456def' });

      expect(this.rs.apiKeys['dropbox'].appKey).to.equal('123abc');
      expect(this.rs.apiKeys['googledrive'].clientId).to.equal('456def');
      expect(this.rs.dropbox.clientId).to.equal('123abc');
      expect(this.rs.googledrive.clientId).to.equal('456def');
    });

    // TODO only works in JS, not TS
    // it("returns false when receiving invalid config", function() {
    //   expect(this.rs.setApiKeys({ icloud: '123abc' }).to.be.false);
    // });

    it("clears config when receiving null values", function() {
      this.rs.setApiKeys({ dropbox: null, googledrive: null });

      expect(this.rs.apiKeys['dropbox']).to.be.undefined;
      expect(this.rs.apiKeys['googledrive']).to.be.undefined;
      // TODO actually reset the backend?
      // expect(this.rs.dropbox.clientId).to.be.null;
      // expect(this.rs.googledrive.clientId).to.be.null;
    });
  });

  describe("#getSyncInterval", function() {
    it("returns the configured sync interval", function() {
      expect(this.rs.getSyncInterval()).to.equal(10000);
    });
  });

  describe("#setSyncInterval", function() {
    before(function() {
      this.rs = new RemoteStorage({ cache: false });
    });

    it("sets the sync interval to the given value", function() {
      this.rs.setSyncInterval(2000);
      expect(this.rs.getSyncInterval()).to.equal(2000);
    });

    it("expects a number", function() {
      expect(() => this.rs.setSyncInterval('60000')).to.throw(/not a valid sync interval/);
    });

    it("must more than (or equal to) 2 seconds", function() {
      expect(() => this.rs.setSyncInterval(1000)).to.throw(/not a valid sync interval/);
    });

    it("must be less than (or equal to) 1 hour", function() {
      expect(() => this.rs.setSyncInterval(3600001)).to.throw(/not a valid sync interval/);
    });
  });

  describe("#scope-change-required", function() {
    beforeEach(function() {
      this.rs.disconnect();
      localStorage.clear();

      localStorage.setItem('remotestorage:backend', 'remotestorage');
      localStorage.setItem(WIRECLIENT_SETTINGS_KEY, JSON.stringify({
        userAddress: 'user@example.com',
        href: 'https://storage.example.com/users/user/',
        storageApi: 'draft-dejong-remotestorage-02',
        token: 'sekrit'
      }));
    });

    it("emits a sticky event when claimed permissions differs from the stored authorized scope", function(done) {
      localStorage.setItem(AUTHORIZED_SCOPE_KEY, JSON.stringify({
        backend: 'remotestorage',
        scope: 'contacts:rw'
      }));

      this.rs = new RemoteStorage({ cache: false });
      this.rs.access.claim('contacts', 'r');

      setTimeout(() => {
        this.rs.on('scope-change-required', (event) => {
          expect(event.authorizedScope).to.equal('contacts:rw');
          expect(event.requestedScope).to.equal('contacts:r');
          expect(this.rs.scopeChangeRequired).to.equal(true);
          done();
        });
      }, 0);
    });

    
    it("emits a sticky event when claimed category differs from the stored authorized scope", function(done) {
      localStorage.setItem(AUTHORIZED_SCOPE_KEY, JSON.stringify({
        backend: 'remotestorage',
        scope: 'contacts:rw'
      }));

      this.rs = new RemoteStorage({ cache: false });
      this.rs.access.claim('addressbook', 'rw');

      setTimeout(() => {
        this.rs.on('scope-change-required', (event) => {
          expect(event.authorizedScope).to.equal('addressbook:rw');
          expect(event.requestedScope).to.equal('addressbook:rw');
          expect(this.rs.scopeChangeRequired).to.equal(true);
          done();
        });
      }, 0);
    });

    it("clears the pending scope-change state after authorization completes with the current scope", function() {
      localStorage.setItem(AUTHORIZED_SCOPE_KEY, JSON.stringify({
        backend: 'remotestorage',
        scope: 'contacts:rw'
      }));

      this.rs = new RemoteStorage({ cache: false });
      this.rs.access.claim('contacts', 'r');

      expect(this.rs.scopeChangeRequired).to.equal(true);

      this.rs._completeAuthorization('contacts:r');

      expect(this.rs.scopeChangeRequired).to.equal(false);
      expect(JSON.parse(localStorage.getItem(AUTHORIZED_SCOPE_KEY))).to.deep.equal({
        backend: 'remotestorage',
        scope: 'contacts:r'
      });
    });

    it("clears runtime scope-change state when the backend is cleared", function() {
      localStorage.setItem(AUTHORIZED_SCOPE_KEY, JSON.stringify({
        backend: 'remotestorage',
        scope: 'contacts:rw'
      }));

      this.rs = new RemoteStorage({ cache: false });
      this.rs.access.claim('contacts', 'r');

      expect(this.rs.scopeChangeRequired).to.equal(true);

      this.rs.setBackend(undefined);

      expect(this.rs.scopeChangeRequired).to.equal(false);
      expect(this.rs._scopeChangeEvent).to.equal(null);
      expect(JSON.parse(localStorage.getItem(AUTHORIZED_SCOPE_KEY))).to.deep.equal({
        backend: 'remotestorage',
        scope: 'contacts:rw'
      });
    });
  });
});
