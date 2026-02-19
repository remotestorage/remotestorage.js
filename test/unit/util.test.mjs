import 'mocha';
import { expect } from 'chai';
import * as util from '../../build/util.js';

function stringToArrayBuffer(str) {
  const buf = new ArrayBuffer(str.length * 2);
  const view = new Uint16Array(buf);
  for (let i = 0, c = str.length; i < c; i++) {
    view[i] = str.charCodeAt(i);
  }
  return buf;
}

describe('util', () => {
  describe('path checking', () => {
    it('checks if path is a folder', () => {
      expect(util.isFolder('/')).to.equal(true);
      expect(util.isFolder('/foo/')).to.equal(true);
      expect(util.isFolder('/foo//')).to.equal(true);
      expect(util.isFolder('/foo/b ar/')).to.equal(true);
      expect(util.isFolder('/foo')).to.equal(false);
      expect(util.isFolder('/%2F')).to.equal(false);
      expect(util.isFolder('/foo/%2F')).to.equal(false);
      expect(util.isFolder('/foo/ ')).to.equal(false);
    });

    it('checks if path is a document', () => {
      expect(util.isDocument('/')).to.equal(false);
      expect(util.isDocument('/foo/')).to.equal(false);
      expect(util.isDocument('/foo//')).to.equal(false);
      expect(util.isDocument('/foo/b ar/')).to.equal(false);
      expect(util.isDocument('/foo')).to.equal(true);
      expect(util.isDocument('/%2F')).to.equal(true);
      expect(util.isDocument('/foo/%2F')).to.equal(true);
      expect(util.isDocument('/foo/ ')).to.equal(true);
    });
  });

  describe('path encoding', () => {
    it('encodes quotes in paths', () => {
      expect(util.cleanPath("Capture d'écran")).to.equal('Capture%20d%27%C3%A9cran');
      expect(util.cleanPath('So they said "hey"')).to.equal('So%20they%20said%20%22hey%22');
    });
  });

  describe('equality and cloning', () => {
    it('compares objects deeply', () => {
      const deepClone = util.deepClone;
      const equal = util.equal;
      const obj = { str: 'a', i: 0, b: true, obj: { str: 'a' } };
      const obj2 = deepClone(obj);

      expect(equal(obj, obj2)).to.equal(true);
      obj.nested = obj2;
      expect(equal(obj, obj2)).to.equal(false);

      const buf1 = stringToArrayBuffer('foo');
      const buf2 = stringToArrayBuffer('foo');
      const buf3 = stringToArrayBuffer('bar');

      expect(equal(obj, deepClone(obj))).to.equal(true);
      expect(equal(buf1, buf2)).to.equal(true);
      expect(equal(buf1, buf3)).to.equal(false);

      const arr1 = [ stringToArrayBuffer('foo'), function() { return 1; } ];
      const arr2 = [ stringToArrayBuffer('foo'), function() { return 1; } ];
      const arr3 = [ stringToArrayBuffer('bar'), function() { return 1; } ];
      const arr4 = [ stringToArrayBuffer('foo'), function() { return 0; } ];

      expect(equal(arr1, arr2)).to.equal(true);
      expect(equal(arr1, arr3)).to.equal(false);
      expect(equal(arr1, arr4)).to.equal(false);

      expect(equal(null, null)).to.equal(true);
      expect(equal(undefined, null)).to.equal(false);
      expect(equal(null, {key: "value"})).to.equal(false);
      expect(equal({key: "value"}, null)).to.equal(false);
      expect(equal({key: null}, {key: undefined})).to.equal(false);
      expect(equal({key: null}, {key: null})).to.equal(true);
    });

    it('clones objects deeply', () => {
      const deepClone = util.deepClone;
      const obj = { str: 'a', i: 0, b: true };
      const cloned = deepClone(obj);

      expect(cloned).to.deep.equal(obj);
      obj.nested = cloned;
      const cloned2 = deepClone(obj);
      expect(cloned2).to.deep.equal(obj);
    });
  });

  describe('path utilities', () => {
    it('generates paths from root', () => {
      const pathsFromRoot = util.pathsFromRoot;
      const p1 = '/';
      const p2 = '/a/b/c/d/e';
      const p3 = '/a/b/c';
      const p4 = '/a/b//';
      const p5 = '//';
      const p6 = '/a/b/c d/e/';
      const p7 = '/foo';

      expect(pathsFromRoot(p1)).to.deep.equal([p1]);
      expect(pathsFromRoot(p2)).to.deep.equal([p2, '/a/b/c/d/', '/a/b/c/', '/a/b/', '/a/', '/']);
      expect(pathsFromRoot(p3)).to.deep.equal([p3, '/a/b/', '/a/', '/']);
      expect(pathsFromRoot(p4)).to.deep.equal([p4, '/a/b/', '/a/', '/']);
      expect(pathsFromRoot(p5)).to.deep.equal([p5, '/']);
      expect(pathsFromRoot(p6)).to.deep.equal([p6, '/a/b/c d/', '/a/b/', '/a/', '/']);
      expect(pathsFromRoot(p7)).to.deep.equal([p7, '/']);
    });
  });

  describe('localStorage utilities', () => {
    it('detects when localStorage is unavailable', () => {
      const QuotaExceededError = function(message) {
        this.name = 'QuotaExceededError';
        this.message = message;
      };
      QuotaExceededError.prototype = new Error();

      global.localStorage = {
        setItem: function(key, value) {
          throw new QuotaExceededError('DOM exception 22');
        }
      };

      expect(util.localStorageAvailable()).to.equal(false);
    });

    it('retrieves JSON from localStorage', () => {
      global.localStorage = {
        getItem: function() {
          return '{ "foo": "bar" }';
        }
      };

      expect(util.getJSONFromLocalStorage('somekey')).to.deep.equal({ foo: 'bar' });
    });

    it('returns null when key is missing', () => {
      global.localStorage = {
        getItem: function() {
          return null;
        }
      };

      expect(util.getJSONFromLocalStorage('somekey')).to.equal(null);
    });
  });
});
