if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(['require', 'fs'], function(require, fs, undefined) {
  var suites = [];

  suites.push({
    name: "caching",
    desc: "Caching stores settings about which paths to cache locally",
    setup: function(env, test) {
      env.Caching = require('./src/caching');

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
          test.assertAnd(env.caching.checkPath('/foo/'), 'SEEN');
          test.done();
        }
      },

      {
        desc: "#set() with no path given throws an error",
        run: function(env, test) {
          try {
            env.caching.set();
            test.result(false, "set() didn't fail on undefined path/arguments");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#set() with empty string given throws an error",
        run: function(env, test) {
          try {
            env.caching.set("");
            test.result(false, "set() didn't fail on empty string");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#set() with invalid path (no backslash) given throws an error",
        run: function(env, test) {
          try {
            env.caching.set("asdf");
            test.result(false, "set() didn't fail on invalid path");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#set() with undefined strategy given throws an error",
        run: function(env, test) {
          try {
            env.caching.set('/foo/');
            test.result(false, "set() didn't fail on undefined strategy");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#set() with invalid strategy given throws an error",
        run: function(env, test) {
          try {
            env.caching.set('/foo/', 'YOLO');
            test.result(false, "set() didn't fail on invalid strategy");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#set() sets caching settings for given path and subtree",
        run: function(env, test) {
          env.caching.set('/foo/', 'FLUSH');
          test.assertAnd(env.caching.checkPath('/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/bar'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/bar/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/bar/foo'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/foo/'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/foo/bar'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/foo/bar/'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/foo/bar/baz'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/foo/bar/baz/'), 'FLUSH');
          test.done();
        }
      },

      {
        desc: "#_rootPaths contains configured paths",
        run: function(env, test) {
          env.caching.set('/foo/', 'ALL');
          test.assert(env.caching._rootPaths, {'/foo/': 'ALL' });
        }
      },

      {
        desc: "#checkPath returns value of tightest fitting rootPath",
        run: function(env, test) {
          env.caching.set('/foo/', 'ALL');
          env.caching.set('/foo/bar/baz/', 'FLUSH');
          env.caching.set('/foo/baf/', 'SEEN');
          env.caching.set('/bar/', 'FLUSH');
          test.assertAnd(env.caching.checkPath('/foo/'), 'ALL');
          test.assertAnd(env.caching.checkPath('/foo/1'), 'ALL');
          test.assertAnd(env.caching.checkPath('/foo/2/'), 'ALL');
          test.assertAnd(env.caching.checkPath('/foo/2/3'), 'ALL');
          test.assertAnd(env.caching.checkPath('/foo/bar/'), 'ALL');
          test.assertAnd(env.caching.checkPath('/foo/bar/baz/'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/foo/baf/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/foo/baf/1'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/foo/baf/2/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/foo/baf/2/1/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/bar/'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/bar/1'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/bar/2/'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/bar/2/3/'), 'FLUSH');
          test.assertAnd(env.caching.checkPath('/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/1/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/2/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/2/3/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/2/3/'), 'SEEN');
          test.done();
        }
      },

      {
        desc: "#reset resets the state",
        run: function(env, test) {
          env.caching.set('/foo/', 'ALL');
          env.caching.set('/foo/bar/baz/', 'ALL');
          env.caching.set('/bar/foo/baz/', 'FLUSH');
          env.caching.reset();
          test.assertAnd(env.caching.checkPath('/foo/'), 'SEEN');
          test.assertAnd(env.caching.checkPath('/bar/'), 'SEEN');
          test.assertAnd(env.caching._rootPaths, {});
          test.done();
        }
      }
    ]
  });

  return suites;
});
