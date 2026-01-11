import 'mocha';
import { expect } from 'chai';

import { Access } from '../../build/access.js';

describe('Access', () => {
  let access;

  beforeEach(() => {
    access = new Access();
  });

  describe('#claim / #get', () => {
    it('stores claimed scope with mode r', () => {
      access.claim('readings', 'r');
      expect(access.get('readings')).to.equal('r');
    });

    it('stores claimed scope with mode rw', () => {
      access.claim('writings', 'rw');
      expect(access.get('writings')).to.equal('rw');
    });
  });

  describe('#checkPermission', () => {
    beforeEach(() => {
      access.claim('readings', 'r');
      access.claim('writings', 'rw');
    });

    it('returns true for readings:r', () => {
      expect(access.checkPermission('readings', 'r')).to.equal(true);
    });

    it('returns true for writings:r', () => {
      expect(access.checkPermission('writings', 'r')).to.equal(true);
    });

    it('returns false for readings:rw', () => {
      expect(access.checkPermission('readings', 'rw')).to.equal(false);
    });

    it('returns true for writings:rw', () => {
      expect(access.checkPermission('writings', 'rw')).to.equal(true);
    });
  });

  describe('#_getModuleName', () => {
    it('throws an error for sub-root paths', () => {
      const invalidPaths = ['a', 'a/', 'a/b', 'a/b/', 'a/b/c', 'a/b/c/', 'public', 'public/', 'public/a', 'public/a/'];
      let errors = 0;
      invalidPaths.forEach(p => {
        try { access._getModuleName(p); } catch (e) { errors++; }
      });
      expect(errors).to.equal(10);
    });

    it("returns '*' for sub-module paths", () => {
      expect(access._getModuleName('/a')).to.equal('*');
      expect(access._getModuleName('/public')).to.equal('*');
      expect(access._getModuleName('/public/a')).to.equal('*');
    });

    it('returns the module name for in-module paths', () => {
      expect(access._getModuleName('/a/')).to.equal('a');
      expect(access._getModuleName('/a/b')).to.equal('a');
      expect(access._getModuleName('/a/b/')).to.equal('a');
      expect(access._getModuleName('/a/b/c')).to.equal('a');
      expect(access._getModuleName('/a/b/c/')).to.equal('a');
      expect(access._getModuleName('/public/a/')).to.equal('a');
      expect(access._getModuleName('/public/a/b')).to.equal('a');
      expect(access._getModuleName('/public/a/b/')).to.equal('a');
      expect(access._getModuleName('/public/a/b/c')).to.equal('a');
      expect(access._getModuleName('/public/a/b/c/')).to.equal('a');
    });
  });

  describe('#checkPathPermission', () => {
    beforeEach(() => {
      access.claim('writings', 'rw');
      access.claim('readings', 'r');
    });

    it('returns true for paths inside writings with mode rw', () => {
      expect(access.checkPathPermission('/writings/a', 'rw')).to.equal(true);
      expect(access.checkPathPermission('/writings/a/', 'rw')).to.equal(true);
      expect(access.checkPathPermission('/writings/a/b', 'rw')).to.equal(true);
      expect(access.checkPathPermission('/public/writings/a', 'rw')).to.equal(true);
      expect(access.checkPathPermission('/public/writings/a/', 'rw')).to.equal(true);
      expect(access.checkPathPermission('/public/writings/a/b', 'rw')).to.equal(true);
    });

    it('returns true for paths inside writings with mode r', () => {
      expect(access.checkPathPermission('/writings/a', 'r')).to.equal(true);
      expect(access.checkPathPermission('/writings/a/', 'r')).to.equal(true);
      expect(access.checkPathPermission('/writings/a/b', 'r')).to.equal(true);
      expect(access.checkPathPermission('/public/writings/a', 'r')).to.equal(true);
      expect(access.checkPathPermission('/public/writings/a/', 'r')).to.equal(true);
      expect(access.checkPathPermission('/public/writings/a/b', 'r')).to.equal(true);
    });

    it('returns true for paths inside readings with mode r', () => {
      expect(access.checkPathPermission('/readings/a', 'r')).to.equal(true);
      expect(access.checkPathPermission('/readings/a/', 'r')).to.equal(true);
      expect(access.checkPathPermission('/readings/a/b', 'r')).to.equal(true);
      expect(access.checkPathPermission('/public/readings/a', 'r')).to.equal(true);
      expect(access.checkPathPermission('/public/readings/a/', 'r')).to.equal(true);
      expect(access.checkPathPermission('/public/readings/a/b', 'r')).to.equal(true);
    });

    it('returns false for paths inside readings with mode rw', () => {
      expect(access.checkPathPermission('/readings/a', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/readings/a/', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/readings/a/b', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/public/readings/a', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/public/readings/a/', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/public/readings/a/b', 'rw')).to.equal(false);
    });

    it('returns false for paths outside readings and writings with mode rw', () => {
      expect(access.checkPathPermission('/redings/a', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/radings/a/', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/eadings/a/b', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/public/readngs/a', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/public/reaings/a/', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/public/redings/a/b', 'rw')).to.equal(false);
    });

    it('returns false for paths outside readings and writings with mode r', () => {
      expect(access.checkPathPermission('/redings/a', 'r')).to.equal(false);
      expect(access.checkPathPermission('/radings/a/', 'r')).to.equal(false);
      expect(access.checkPathPermission('/eadings/a/b', 'r')).to.equal(false);
      expect(access.checkPathPermission('/public/readngs/a', 'r')).to.equal(false);
      expect(access.checkPathPermission('/public/reaings/a/', 'r')).to.equal(false);
      expect(access.checkPathPermission('/public/redings/a/b', 'r')).to.equal(false);
    });

    it('returns false for paths outside modules', () => {
      expect(access.checkPathPermission('/', 'r')).to.equal(false);
      expect(access.checkPathPermission('/a', 'r')).to.equal(false);
      expect(access.checkPathPermission('/public/a', 'r')).to.equal(false);
      expect(access.checkPathPermission('/', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/a', 'rw')).to.equal(false);
      expect(access.checkPathPermission('/public/a', 'rw')).to.equal(false);
    });
  });

  describe('#checkPathPermission (wildcard)', () => {
    describe("*:r (read everywhere)", () => {
      beforeEach(() => {
        access.claim('*', 'r');
      });

      it('allows reading across all modules and paths', () => {
        // readings
        expect(access.checkPathPermission('/readings/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/readings/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/readings/a/b', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a/b', 'r')).to.equal(true);
        // writings
        expect(access.checkPathPermission('/writings/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/writings/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/writings/a/b', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a/b', 'r')).to.equal(true);
        // others
        expect(access.checkPathPermission('/foo/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/foo/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/foo/a/b', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a/b', 'r')).to.equal(true);
        expect(access.checkPathPermission('/foo', 'r')).to.equal(true);
        expect(access.checkPathPermission('/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/foo', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/', 'r')).to.equal(true);
      });
    });

    describe("*:r with writings:rw", () => {
      beforeEach(() => {
        access.claim('*', 'r');
        access.claim('writings', 'rw');
      });

      it('disallows writes except inside writings', () => {
        // readings
        expect(access.checkPathPermission('/readings/a', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/readings/a/', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/readings/a/b', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/public/readings/a', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/public/readings/a/', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/public/readings/a/b', 'rw')).to.equal(false);
        // writings
        expect(access.checkPathPermission('/writings/a', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/writings/a/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/writings/a/b', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a/b', 'rw')).to.equal(true);
        // others
        expect(access.checkPathPermission('/foo/a', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/foo/a/', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/foo/a/b', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/public/foo/a', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/public/foo/a/', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/public/foo/a/b', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/foo', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/public/foo', 'rw')).to.equal(false);
        expect(access.checkPathPermission('/public/', 'rw')).to.equal(false);
      });
    });

    describe('*:rw (read/write everywhere)', () => {
      beforeEach(() => {
        access.claim('*', 'rw');
      });

      it('allows reading across all modules and paths', () => {
        // readings
        expect(access.checkPathPermission('/readings/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/readings/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/readings/a/b', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a/b', 'r')).to.equal(true);
        // writings
        expect(access.checkPathPermission('/writings/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/writings/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/writings/a/b', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a/b', 'r')).to.equal(true);
        // others
        expect(access.checkPathPermission('/foo/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/foo/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/foo/a/b', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a/b', 'r')).to.equal(true);
        expect(access.checkPathPermission('/foo', 'r')).to.equal(true);
        expect(access.checkPathPermission('/', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/foo', 'r')).to.equal(true);
        expect(access.checkPathPermission('/public/', 'r')).to.equal(true);
      });

      it('allows writing across all modules and paths', () => {
        // readings
        expect(access.checkPathPermission('/readings/a', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/readings/a/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/readings/a/b', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/readings/a/b', 'rw')).to.equal(true);
        // writings
        expect(access.checkPathPermission('/writings/a', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/writings/a/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/writings/a/b', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/writings/a/b', 'rw')).to.equal(true);
        // others
        expect(access.checkPathPermission('/foo/a', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/foo/a/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/foo/a/b', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/foo/a/b', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/foo', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/foo', 'rw')).to.equal(true);
        expect(access.checkPathPermission('/public/', 'rw')).to.equal(true);
      });
    });
  });

  describe('#rootPaths', () => {
    it('contain correct private paths', () => {
      access.claim('readings', 'r');
      access.claim('writings', 'rw');
      expect(access.rootPaths).to.include('/readings/');
      expect(access.rootPaths).to.include('/writings/');
    });

    it('contain correct public paths', () => {
      access.claim('readings', 'r');
      access.claim('writings', 'rw');
      expect(access.rootPaths).to.include('/public/readings/');
      expect(access.rootPaths).to.include('/public/writings/');
    });

    it("'*' access causes rootPaths to only contain '/'", () => {
      access.claim('*', 'r');
      access.claim('readings', 'r');
      access.claim('writings', 'rw');
      expect(access.rootPaths).to.deep.equal(['/']);
    });
  });

  describe('#scopeParameter', () => {
    it('is correct for one module', () => {
      access.reset();
      access.claim('foo', 'rw');
      expect(access.scopeParameter).to.equal('foo:rw');

      access.reset();
      access.claim('foo', 'r');
      expect(access.scopeParameter).to.equal('foo:r');
    });

    it('is correct for multiple modules', () => {
      access.reset();
      access.claim('foo', 'rw');
      access.claim('bar', 'r');
      expect(access.scopeParameter).to.equal('foo:rw bar:r');
    });

    it('[2012.04] is correct for root access', () => {
      access.reset();
      access.setStorageType('2012.04');
      access.claim('*', 'rw');
      expect(access.scopeParameter).to.equal(':rw');
    });

    it('[remotestorage-00] is correct for root access', () => {
      access.reset();
      access.setStorageType('remotestorage-00');
      access.claim('*', 'rw');
      expect(access.scopeParameter).to.equal('root:rw');
    });

    it('[remotestorage-01] is correct for root access', () => {
      access.reset();
      access.setStorageType('remotestorage-01');
      access.claim('*', 'rw');
      expect(access.scopeParameter).to.equal('root:rw');
    });

    it('[remotestorage-02] is correct for root access', () => {
      access.reset();
      access.setStorageType('remotestorage-02');
      access.claim('*', 'rw');
      expect(access.scopeParameter).to.equal('*:rw');
    });
  });

  describe('#reset', () => {
    it('clears all scopes and paths', () => {
      access.claim('foo', 'rw');
      access.claim('bar', 'r');
      expect(access.scopes.length).to.equal(2);
      expect(access.rootPaths.length).to.be.greaterThan(0);
      access.reset();
      expect(access.scopes).to.deep.equal([]);
      expect(access.rootPaths).to.deep.equal([]);
    });
  });
});
