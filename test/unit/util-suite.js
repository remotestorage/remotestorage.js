if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs'], function (Promise, requirejs) {
  global.Promise = Promise;
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
    desc: 'RemoteStorage.util utility functions',
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      global.RemoteStorage.log = function() {};
      global.RemoteStorage.config = {
        changeEvents: { local: true, window: false, remote: true, conflict: true }
      };

      require('src/util.js');
      if (global.rs_util) {
        RemoteStorage.util = global.rs_util;
      } else {
        global.rs_util = RemoteStorage.util;
      }

      test.done();
    },

    tests: [
      {
        desc: "isFolder",
        run: function(env, test) {
          test.assertAnd(RemoteStorage.util.isFolder('/'), true);
          test.assertAnd(RemoteStorage.util.isFolder('/foo/'), true);
          test.assertAnd(RemoteStorage.util.isFolder('/foo//'), true);
          test.assertAnd(RemoteStorage.util.isFolder('/foo/b ar/'), true);
          test.assertAnd(RemoteStorage.util.isFolder('/foo'), false);
          test.assertAnd(RemoteStorage.util.isFolder('/%2F'), false);
          test.assertAnd(RemoteStorage.util.isFolder('/foo/%2F'), false);
          test.assertAnd(RemoteStorage.util.isFolder('/foo/ '), false);
          test.done();
        }
      },

      {
        desc: "isDocument",
        run: function(env, test) {
          test.assertAnd(RemoteStorage.util.isDocument('/'), false);
          test.assertAnd(RemoteStorage.util.isDocument('/foo/'), false);
          test.assertAnd(RemoteStorage.util.isDocument('/foo//'), false);
          test.assertAnd(RemoteStorage.util.isDocument('/foo/b ar/'), false);
          test.assertAnd(RemoteStorage.util.isDocument('/foo'), true);
          test.assertAnd(RemoteStorage.util.isDocument('/%2F'), true);
          test.assertAnd(RemoteStorage.util.isDocument('/foo/%2F'), true);
          test.assertAnd(RemoteStorage.util.isDocument('/foo/ '), true);
          test.done();
        }
      },

      {
        desc: "cleanPath encodes quotes",
        run: function(env, test) {
          test.assertAnd(RemoteStorage.util.cleanPath("Capture d'écran"), 'Capture%20d%27%C3%A9cran');
          test.assertAnd(RemoteStorage.util.cleanPath('So they said "hey"'), 'So%20they%20said%20%22hey%22');
          test.done();
        }
      },

      {
        desc: "equal",
        run: function(env, test) {
          var deepClone = RemoteStorage.util.deepClone;
          var equal = RemoteStorage.util.equal;
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
          var deepClone = RemoteStorage.util.deepClone;
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
          var pathsFromRoot = RemoteStorage.util.pathsFromRoot;
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
        desc: "md5sum",
        run: function (env, test) {
          var md5sum = RemoteStorage.util.md5sum('this is a very happy string');
          test.assert(md5sum, '962e9575a9eba5bfedbad85cf125da20');
        }
      }
    ]
  });

  return suites;
});
