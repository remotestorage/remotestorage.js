import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import { Dropbox } from '../../build/dropbox.js';
import { RemoteStorage } from '../../build/remotestorage.js';

chai.use(chaiAsPromised);

describe("RemoteStorage", function() {
  const sandbox = sinon.createSandbox();

  afterEach(function() {
    fetchMock.reset();
    sandbox.restore();
  });

  describe('#addModule', function() {
    beforeEach(function() {
      this.rs = new RemoteStorage({ cache: false });
    });

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

  describe("#setApiKeys", function() {
    before(function() {
      this.dropboxRsInit = Dropbox._rs_init;
    });

    beforeEach(function() {
      this.rs = new RemoteStorage({ cache: false });
    });

    afterEach(function() {
      Dropbox._rs_init = this.dropboxRsInit;
    });

    it("initializes the configured backend when it's not initialized yet", function(done) {
      Dropbox._rs_init = function() {
        done();
      };

      this.rs.setApiKeys({ dropbox: 'testkey' });
    });

    it("reinitializes the configured backend when the key changed", function(done) {
      this.rs.apiKeys.dropbox = { appKey: 'old key' };

      Dropbox._rs_init = function() {
        done();
      };

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
