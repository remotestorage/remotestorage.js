if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

var promising = require('./lib/promising');

//    this.FLUSH = 0;
//    this.SEEN = 1; <- false
//    this.FOLDERS = 2;
//    this.DOCUMENTS = 4;
//    this.ALL = 7; <- { data: true }
// default: SEEN
define(['requirejs', 'fs'], function(requirejs, fs, undefined) {
  var suites = [];

  suites.push({
    name: "caching",
    desc: "Caching stores settings about which paths to cache locally",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      RemoteStorage.log = function() {};
      require('./src/caching');
      env.Caching = RemoteStorage.Caching;

      test.result(true);
    },

    beforeEach: function(env, test) {
      env.caching = new env.Caching();
      test.result(true);
    },

    tests: [
      {
        desc: "#get() returns the default caching.SEEN for paths that haven't been configured",
        run: function(env, test) {
          test.assertAnd(env.caching.checkPath('/foo/'), env.caching.SEEN);
          test.done();
        }
      },

      {
        desc: "#set() with no path given throws an error",
        run: function(env, test) {
          try {
            env.caching.set();
            test.result(false, "set() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#set() with undefined settings given throws an error",
        run: function(env, test) {
          try {
            env.caching.set('/foo/');
            test.result(false, "set() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#set() sets caching settings for given path and subtree",
        run: function(env, test) {
          env.caching.set('/foo/', env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/bar'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/bar/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/bar/foo'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/foo/'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/foo/bar'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/foo/bar/'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/foo/bar/baz'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/foo/bar/baz/'), env.caching.FLUSH);
          test.done();
        }
      },

      {
        desc: "#_rootPaths contains configured paths",
        run: function(env, test) {
          env.caching.set('/foo/', env.caching.ALL);
          test.assert(env.caching._rootPaths, {'/foo/': env.caching.ALL });
        }
      },

      {
        desc: "#checkPath returns value of tightest fitting rootPath",
        run: function(env, test) {
          env.caching.set('/foo/', env.caching.ALL);
          env.caching.set('/foo/bar/baz', env.caching.FLUSH);
          env.caching.set('/foo/baf/', env.caching.SEEN);
          env.caching.set('/bar/', env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/foo/'), env.caching.ALL);
          test.assertAnd(env.caching.checkPath('/foo/1'), env.caching.ALL);
          test.assertAnd(env.caching.checkPath('/foo/2/'), env.caching.ALL);
          test.assertAnd(env.caching.checkPath('/foo/2/3'), env.caching.ALL);
          test.assertAnd(env.caching.checkPath('/foo/bar/'), env.caching.ALL);
          test.assertAnd(env.caching.checkPath('/foo/bar/baz'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/foo/baf/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/foo/baf/1'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/foo/baf/2/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/foo/baf/2/1'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/bar/'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/bar/1'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/bar/2/'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/bar/2/3'), env.caching.FLUSH);
          test.assertAnd(env.caching.checkPath('/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/1'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/2/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/2/3'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/2/3/'), env.caching.SEEN);
          test.done();
        }
      },

      {
        desc: "#reset resets the state",
        run: function(env, test) {
          env.caching.set('/foo/', env.caching.ALL);
          env.caching.set('/foo/bar/baz/', env.caching.ALL);
          env.caching.set('/bar/foo/baz/', env.caching.FLUSH);
          env.caching.reset();
          test.assertAnd(env.caching.checkPath('/foo/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPath('/bar/'), env.caching.SEEN);
          test.assertAnd(env.caching._rootPaths, {});
          test.done();
        }
      }
    ]
  });

  return suites;
});
