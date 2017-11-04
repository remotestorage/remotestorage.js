if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['./src/util'], function (util) {
  var suites = [];

  function stringToArrayBuffer(str) {
    var buf = new ArrayBuffer(str.length * 2);
    var view = new Uint16Array(buf);
    for (var i = 0, c = str.length; i < c; i++)
    {
      view[i] = str.charCodeAt(i);
    }
    return buf;
  }

  suites.push({
    name: 'util',
    desc: 'util utility functions',
    setup: function(env, test) {

      test.done();
    },

    tests: [
      {
        desc: "isFolder",
        run: function(env, test) {
          test.assertAnd(util.isFolder('/'), true);
          test.assertAnd(util.isFolder('/foo/'), true);
          test.assertAnd(util.isFolder('/foo//'), true);
          test.assertAnd(util.isFolder('/foo/b ar/'), true);
          test.assertAnd(util.isFolder('/foo'), false);
          test.assertAnd(util.isFolder('/%2F'), false);
          test.assertAnd(util.isFolder('/foo/%2F'), false);
          test.assertAnd(util.isFolder('/foo/ '), false);
          test.done();
        }
      },

      {
        desc: "isDocument",
        run: function(env, test) {
          test.assertAnd(util.isDocument('/'), false);
          test.assertAnd(util.isDocument('/foo/'), false);
          test.assertAnd(util.isDocument('/foo//'), false);
          test.assertAnd(util.isDocument('/foo/b ar/'), false);
          test.assertAnd(util.isDocument('/foo'), true);
          test.assertAnd(util.isDocument('/%2F'), true);
          test.assertAnd(util.isDocument('/foo/%2F'), true);
          test.assertAnd(util.isDocument('/foo/ '), true);
          test.done();
        }
      },

      {
        desc: "cleanPath encodes quotes",
        run: function(env, test) {
          test.assertAnd(util.cleanPath("Capture d'écran"), 'Capture%20d%27%C3%A9cran');
          test.assertAnd(util.cleanPath('So they said "hey"'), 'So%20they%20said%20%22hey%22');
          test.done();
        }
      },

      {
        desc: "equal",
        run: function(env, test) {
          var deepClone = util.deepClone;
          var equal = util.equal;
          var obj = { str: 'a', i: 0, b: true, obj: { str: 'a' } };
          var obj2 = deepClone(obj);

          test.assertAnd(equal(obj, obj2), true);
          obj.nested = obj2;
          test.assertAnd(equal(obj, obj2), false);
          obj2 = deepClone(obj);

          var buf1 = stringToArrayBuffer('foo');
          var buf2 = stringToArrayBuffer('foo');
          var buf3 = stringToArrayBuffer('bar');

          test.assertAnd(equal(obj, obj2), true);
          test.assertAnd(equal(buf1, buf2), true);
          test.assertAnd(equal(buf1, buf3), false);

          var arr1 = [ stringToArrayBuffer('foo'), function() { return 1; } ];
          var arr2 = [ stringToArrayBuffer('foo'), function() { return 1; } ];
          var arr3 = [ stringToArrayBuffer('bar'), function() { return 1; } ];
          var arr4 = [ stringToArrayBuffer('foo'), function() { return 0; } ];

          test.assertAnd(equal(arr1, arr2), true);
          test.assertAnd(equal(arr1, arr3), false);
          test.assertAnd(equal(arr1, arr4), false);

          test.done();
        }
      },

      {
        desc: "deepClone",
        run: function(env, test) {
          var deepClone = util.deepClone;
          var obj = { str: 'a', i: 0, b: true };
          var cloned = deepClone(obj);

          test.assertAnd(cloned, obj);
          obj.nested = cloned;
          cloned = deepClone(obj);
          test.assertAnd(cloned, obj);
          test.done();
        }
      },

      {
        desc: "pathsFromRoot",
        run: function(env, test) {
          var pathsFromRoot = util.pathsFromRoot;
          var p1 = '/',
              p2 = '/a/b/c/d/e',
              p3 = '/a/b/c',
              p4 = '/a/b//',
              p5 = '//',
              p6 = '/a/b/c d/e/',
              p7 = '/foo';

          test.assertAnd(pathsFromRoot(p1), [p1]);
          test.assertAnd(pathsFromRoot(p2), [p2, '/a/b/c/d/', '/a/b/c/', '/a/b/', '/a/', '/']);
          test.assertAnd(pathsFromRoot(p3), [p3, '/a/b/', '/a/', '/']);
          test.assertAnd(pathsFromRoot(p4), [p4, '/a/b/', '/a/', '/']);
          test.assertAnd(pathsFromRoot(p5), [p5, '/']);
          test.assertAnd(pathsFromRoot(p6), [p6, '/a/b/c d/', '/a/b/', '/a/', '/']);
          test.assertAnd(pathsFromRoot(p7), [p7, '/']);
          test.done();
        }
      },

      {
        desc: "localStorageAvailable is false when saving items throws an error",
        run: function(env, test) {
          var QuotaExceededError = function(message) {
            this.name = 'QuotaExceededError';
            this.message = message;
          };
          QuotaExceededError.prototype = new Error();

          global.localStorage = {
            setItem: function(key, value) {
              throw new QuotaExceededError('DOM exception 22');
            }
          };

          test.assert(util.localStorageAvailable(), false);
        }
      }

    ]
  });

  return suites;
});
