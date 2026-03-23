import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import locationFactory from '../helpers/location.mjs';
import { localStorage } from '../helpers/memoryStorage.mjs';
import Dropbox from '../../build/dropbox.js';
import { EventHandling } from '../../build/eventhandling.js';
import { RemoteStorage } from '../../build/remotestorage.js';
import ExtensionBridgeModule from '../../build/extension-bridge.js';
import { applyMixins } from '../../build/util.js';

const ExtensionBridge = ExtensionBridgeModule.ExtensionBridge || ExtensionBridgeModule.default;

/**
 * Install a fake extension bridge that responds to CustomEvent messages
 * on `document`, mimicking a real content script.
 */
function installFakeBridge (handlers) {
  function listener (event) {
    const detail = event.detail;
    if (!detail || detail.direction !== 'page-to-extension') { return; }

    const handler = handlers[detail.method];
    if (!handler) {
      document.dispatchEvent(new CustomEvent('remotestorage-bridge', {
        detail: { id: detail.id, error: { code: 'unsupported', message: 'Unknown method' } }
      }));
      return;
    }

    Promise.resolve()
      .then(() => handler(detail.payload))
      .then((payload) => {
        document.dispatchEvent(new CustomEvent('remotestorage-bridge', {
          detail: { id: detail.id, payload }
        }));
      })
      .catch((error) => {
        document.dispatchEvent(new CustomEvent('remotestorage-bridge', {
          detail: { id: detail.id, error: error instanceof Error ? { code: error.code, message: error.message } : error }
        }));
      });
  }

  document.addEventListener('remotestorage-bridge', listener);
  return () => document.removeEventListener('remotestorage-bridge', listener);
}

chai.use(chaiAsPromised);

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

const webFingerRecord = {
  subject: 'acct:user@ho.st',
  links: [
    {
      rel: 'http://tools.ietf.org/id/draft-dejong-remotestorage',
      href: 'https://storage.ho.st/user',
      type: 'draft-dejong-remotestorage-13',
      properties: {
        'http://remotestorage.io/spec/version': 'draft-dejong-remotestorage-13',
        'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://storage.ho.st/oauth'
      }
    }
  ]
};

locationFactory('https://todo.app/app');

describe("RemoteStorage", function() {
  beforeEach(function() {
    globalThis.document.location.href = 'https://todo.app/app';
    this.rs = new RemoteStorage({ cache: false });
    localStorage.clear();
    if (ExtensionBridge) {
      if (ExtensionBridge._resetVerification) { ExtensionBridge._resetVerification(); }
      if (ExtensionBridge._setHandshakeTimeout) { ExtensionBridge._setHandshakeTimeout(50); }
    }
    if (this._removeBridge) { this._removeBridge(); this._removeBridge = null; }
  });

  afterEach(function() {
    this.rs.disconnect();
    this.rs = undefined;
    fetchMock.reset();
    sinon.reset();
    localStorage.clear();
    if (this._removeBridge) { this._removeBridge(); this._removeBridge = null; }
    if (ExtensionBridge) {
      if (ExtensionBridge._resetVerification) { ExtensionBridge._resetVerification(); }
      if (ExtensionBridge._setHandshakeTimeout) { ExtensionBridge._setHandshakeTimeout(2000); }
    }
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
    beforeEach(function() {
      fetchMock.mock(/acct\:timeout@example\.com/, 200, {
        delay: 1000
      });
      fetchMock.mock(/personal\.ho\.st/, 200);
      fetchMock.mock('https://ho.st/.well-known/webfinger?resource=acct:user@ho.st', {
        status: 200,
        body: webFingerRecord,
        headers: {
          'Content-Type': 'application/jrd+json; charset=utf-8'
        }
      });
      if (this._removeBridge) { this._removeBridge(); this._removeBridge = null; }
      this.rs = new RemoteStorage({
        cache: false,
        discoveryTimeout: 10
      });
    });

    afterEach(function() {
      if (this._removeBridge) { this._removeBridge(); this._removeBridge = null; }
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

    it('falls back to page OAuth when no extension bridge is available', async function() {
      this.rs.access.claim('notes', 'rw');
      const authorizeSpy = sinon.spy(this.rs, 'authorize');

      this.rs.connect('user@ho.st');
      // Wait longer than the bridge handshake timeout (50ms in test mode)
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(authorizeSpy.calledOnce).to.equal(true);
      expect(authorizeSpy.getCall(0).args[0].authURL).to.equal('https://storage.ho.st/oauth');
      expect(authorizeSpy.getCall(0).args[0].scope).to.equal('notes:rw');
    });

    it('uses the extension bridge when available and keeps tokens out of page state', async function() {
      this.rs.access.claim('notes', 'rw');
      const authorizeSpy = sinon.spy(this.rs, 'authorize');
      let connectPayload = null;
      this._removeBridge = installFakeBridge({
        ping: async () => ({ version: 1 }),
        connect: async (request) => {
          connectPayload = request;
          return {
            sessionId: 'session-123',
            href: request.href,
            storageApi: request.storageApi,
            userAddress: request.userAddress,
            grantedScopes: request.requestedScopes
          };
        },
        request: async () => ({ statusCode: 200, body: 'ok', contentType: 'text/plain' })
      });

      const connected = new Promise(resolve => this.rs.on('connected', resolve));
      this.rs.connect('user@ho.st');
      await connected;

      expect(authorizeSpy.called).to.equal(false);
      expect(connectPayload).to.not.equal(null);
      expect(connectPayload).to.include({
        backend: 'remotestorage',
        origin: 'https://todo.app',
        requestedScopes: 'notes:rw',
        userAddress: 'user@ho.st'
      });
      expect(this.rs.remote.connected).to.equal(true);
      expect(this.rs.remote.sessionId).to.equal('session-123');
      expect(this.rs.remote.token).to.equal(undefined);
      expect(JSON.parse(localStorage.getItem('remotestorage:wireclient'))).to.deep.equal({
        userAddress: 'user@ho.st'
      });
    });

    it('sends the full claimed scope set to the extension', async function() {
      this.rs.access.claim('notes', 'rw');
      this.rs.access.claim('contacts', 'r');
      let connectPayload = null;
      this._removeBridge = installFakeBridge({
        ping: async () => ({ version: 1 }),
        connect: async (request) => {
          connectPayload = request;
          return {
            sessionId: 'session-456',
            href: request.href,
            storageApi: request.storageApi,
            userAddress: request.userAddress,
            grantedScopes: request.requestedScopes
          };
        },
        request: async () => ({ statusCode: 200, body: 'ok', contentType: 'text/plain' })
      });

      const connected = new Promise(resolve => this.rs.on('connected', resolve));
      this.rs.connect('user@ho.st');
      await connected;

      expect(connectPayload).to.not.equal(null);
      expect(connectPayload.requestedScopes).to.equal('notes:rw contacts:r');
    });

    it('uses the active extension account when connect() is called without a user address', async function() {

      this.rs.access.claim('notes', 'rw');
      const authorizeSpy = sinon.spy(this.rs, 'authorize');
      let connectPayload = null;
      this._removeBridge = installFakeBridge({
        ping: async () => ({
          version: 1,
          activeAccountId: 'active@ho.st',
          accounts: [
            {
              accountId: 'active@ho.st',
              active: true,
              href: 'https://storage.ho.st/active',
              storageApi: 'draft-dejong-remotestorage-13',
              userAddress: 'active@ho.st'
            }
          ]
        }),
        connect: async (request) => {
          connectPayload = request;
          return {
            sessionId: 'session-active',
            href: request.href,
            storageApi: request.storageApi,
            userAddress: request.userAddress,
            grantedScopes: request.requestedScopes
          };
        },
        request: async () => ({ statusCode: 200, body: 'ok', contentType: 'text/plain' })
      });

      const connected = new Promise(resolve => this.rs.on('connected', resolve));
      this.rs.connect();
      await connected;

      expect(authorizeSpy.called).to.equal(false);
      expect(connectPayload).to.not.equal(null);
      expect(connectPayload).to.include({
        origin: 'https://todo.app',
        requestedScopes: 'notes:rw',
        userAddress: 'active@ho.st',
        href: 'https://storage.ho.st/active',
        storageApi: 'draft-dejong-remotestorage-13'
      });
      expect(this.rs.remote.connected).to.equal(true);
      expect(this.rs.remote.sessionId).to.equal('session-active');
    });

    it('emits an auth error and does not fall back when the extension denies access', async function() {

      this.rs.access.claim('notes', 'rw');
      const authorizeSpy = sinon.spy(this.rs, 'authorize');
      this._removeBridge = installFakeBridge({
        ping: async () => ({ version: 1 }),
        connect: async () => { throw { code: 'access_denied', message: 'nope' }; }
      });

      const error = new Promise(resolve => this.rs.on('error', resolve));
      this.rs.connect('user@ho.st');
      const err = await error;

      expect(authorizeSpy.called).to.equal(false);
      expect(err.name).to.equal('Unauthorized');
      expect(err.code).to.equal('extension_denied');
      expect(this.rs.remote.connected).to.equal(false);
    });

    it('falls back to page OAuth when the extension bridge version is unsupported', async function() {
      this.rs.access.claim('notes', 'rw');
      const authorizeSpy = sinon.spy(this.rs, 'authorize');
      this._removeBridge = installFakeBridge({
        ping: async () => ({ version: 2 })
      });

      this.rs.connect('user@ho.st');
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(authorizeSpy.calledOnce).to.equal(true);
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
});
