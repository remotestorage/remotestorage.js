import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import Dropbox from '../../build/dropbox.js';
import { EventHandling } from '../../build/eventhandling.js';
import { RemoteStorage } from '../../build/remotestorage.js';
import { applyMixins } from '../../build/util.js';

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
});
