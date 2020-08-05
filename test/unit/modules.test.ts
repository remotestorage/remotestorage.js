// TODO move to RemoteStorage suite, once it exists. (Functions from the source
// modules.ts file have already been moved.)
import 'mocha';
import { expect } from 'chai';
import RemoteStorage from '../../src/remotestorage';

describe('RemoteStorage module initialization', function() {
  const env = {
    rs: new RemoteStorage()
  };

  before(function() {
    RemoteStorage.prototype.remote = { connected: false };
  });

  describe('addModule()', function() {
    it('creates a module', function() {
      env.rs.addModule({name: 'foo', builder: function() {
        return { exports: { it: 'worked' } };
      }});

      expect(env.rs.foo.it).to.equal('worked');
    });

    it('allows hyphens in module names', function() {
      env.rs.addModule({name: 'foo-bar', builder: function() {
        return { exports: { it: 'worked' } };
      }});

      expect(env.rs.foo.it).to.equal('worked');
    });

    it('is called when passing a module to the RemoteStorage constructor', function() {
      const rs = new RemoteStorage({modules: [{ name: 'bar', builder: function() {
        return { exports: { it: 'worked' } };
      }}]});
      expect(rs.bar.it).to.equal('worked');
    });
  });
});
