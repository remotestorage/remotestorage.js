import 'mocha';
import { expect } from 'chai';

import { BaseClient } from '../../../build/baseclient.js';

const Types = BaseClient.Types;

describe('BaseClient.Types', () => {
  describe('#inScope', () => {
    it('returns all schemas defined for the given module', () => {
      Types.declare('foo', 'a', 'http://foo/a', { type: 'object' });
      Types.declare('foo', 'b', 'http://foo/b', { type: 'object' });
      Types.declare('bar', 'c', 'http://bar/c', { type: 'object' });

      const fooResult = Types.inScope('foo');
      expect(fooResult).to.be.an('object');
      expect(fooResult['http://foo/a']).to.be.an('object');
      expect(fooResult['http://foo/b']).to.be.an('object');
      expect(fooResult['http://bar/c']).to.be.undefined;

      const barResult = Types.inScope('bar');
      expect(barResult).to.be.an('object');
      expect(barResult['http://foo/a']).to.be.undefined;
      expect(barResult['http://foo/b']).to.be.undefined;
      expect(barResult['http://bar/c']).to.be.an('object');
    });
  });
});
