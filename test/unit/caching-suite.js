if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

var promising = require('./lib/promising');

//    this.FLUSH = 0;
//    this.SEEN = 1;
//    this.FOLDERS = 2;
//    this.SEEN_AND_FOLDERS = 3;
//    this.DOCUMENTS = 4;
//    this.ALL = 7;
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
          test.assertAnd(env.caching.get('/foo/'), env.caching.SEEN);
          test.done();
        }
      },

      {
        desc: "#get() with no path given throws an error",
        run: function(env, test) {
          try {
            env.caching.get();
            test.result(false, "get() didn't fail");
          } catch(e) {
            test.result(true);
          }
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
          env.caching.set('/foo/', env.caching.FOLDERS);
          test.assertAnd(env.caching.get('/'), env.caching.SEEN);
          test.assertAnd(env.caching.get('/bar'), env.caching.SEEN);
          test.assertAnd(env.caching.get('/bar/'), env.caching.SEEN);
          test.assertAnd(env.caching.get('/bar/foo'), env.caching.SEEN);
          test.assertAnd(env.caching.get('/foo/'), env.caching.FOLDERS);
          test.assertAnd(env.caching.get('/foo/bar'), env.caching.FOLDERS);
          test.assertAnd(env.caching.get('/foo/bar/'), env.caching.FOLDERS);
          test.assertAnd(env.caching.get('/foo/bar/baz'), env.caching.FOLDERS);
          test.assertAnd(env.caching.get('/foo/bar/baz/'), env.caching.FOLDERS);
        }
      },

      {
        desc: "#rootPaths contains configured paths",
        run: function(env, test) {
          env.caching.set('/foo/', env.caching.ALL);
          test.assert(env.caching.rootPaths, {'/foo/': env.caching.ALL });
        }
      },

      {
        desc: "#rootPaths doesn't contain paths that set their inherited value",
        run: function(env, test) {
          env.caching.set('/foo/', env.caching.ALL);
          env.caching.set('/foo/bar/baz/', env.caching.ALL);
          env.caching.set('/bar/foo/baz/', env.caching.FOLDERS);
          env.caching.set('/bar/', env.caching.FOLDERS);
          test.assert(env.caching.rootPaths, {
            '/foo/': env.caching.ALL,
            '/bar/': env.caching.FOLDERS
          });
        }
      },

      {
        desc: "#checkPath returns value of tightest fitting rootPath",
        run: function(env, test) {
          env.caching.set('/foo/', env.caching.ALL);
          env.caching.set('/foo/bar/baz', env.caching.DOCUMENTS);
          env.caching.set('/foo/baf/', env.caching.SEEN);
          env.caching.set('/bar/', env.caching.FOLDERS);
          test.assertAnd(env.caching.checkPaths('/foo/'), env.caching.ALL);
          test.assertAnd(env.caching.checkPaths('/foo/1'), env.caching.ALL);
          test.assertAnd(env.caching.checkPaths('/foo/2/'), env.caching.ALL);
          test.assertAnd(env.caching.checkPaths('/foo/2/3'), env.caching.ALL);
          test.assertAnd(env.caching.checkPaths('/foo/bar/'), env.caching.ALL);
          test.assertAnd(env.caching.checkPaths('/foo/bar/baz'), env.caching.DOCUMENTS);
          test.assertAnd(env.caching.checkPaths('/foo/baf/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPaths('/foo/baf/1'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPaths('/foo/baf/2/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPaths('/foo/baf/2/1'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPaths('/bar/'), env.caching.FOLDERS);
          test.assertAnd(env.caching.checkPaths('/bar/1'), env.caching.FOLDERS);
          test.assertAnd(env.caching.checkPaths('/bar/2/'), env.caching.FOLDERS);
          test.assertAnd(env.caching.checkPaths('/bar/2/3'), env.caching.FOLDERS);
          test.assertAnd(env.caching.checkPaths('/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPaths('/1'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPaths('/2/'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPaths('/2/3'), env.caching.SEEN);
          test.assertAnd(env.caching.checkPaths('/2/3/'), env.caching.SEEN);
          test.done();
        }
      },

      {
        desc: "#reset resets the state",
        run: function(env, test) {
          env.caching.set('/foo/', env.caching.ALL);
          env.caching.set('/foo/bar/baz/', env.caching.ALL);
          env.caching.set('/bar/foo/baz/', env.caching.FOLDERS);
          env.caching.set('/bar/', env.caching.FOLDERS);
          env.caching.reset();
          test.assertTypeAnd(env.caching.get('/foo/'), env.caching.SEEN);
          test.assertTypeAnd(env.caching.get('/bar/'), env.caching.SEEN);
          test.assert(env.caching.rootPaths, []);
        }
      }
    ]
  });

  return suites;
});
