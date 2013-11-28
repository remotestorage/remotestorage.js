if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
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
        desc: "#get() returns undefined for paths that haven't been configured",
        run: function(env, test) {
          test.assertType(env.caching.get('/foo/'), 'undefined');
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
        desc: "#remove() with no path given throws an error",
        run: function(env, test) {
          try {
            env.caching.remove();
            test.result(false, "remove() didn't fail");
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
        desc: "#set() sets caching settings for given path",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          test.assert(env.caching.get('/foo/'), { data: true });
        }
      },

      {
        desc: "#remove() removes caching settings from given path",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          test.assertTypeAnd(env.caching.get('/foo/'), 'object');
          env.caching.remove('/foo/');
          test.assertType(env.caching.get('/foo/'), 'undefined');
        }
      },

      {
        desc: "#descendIntoPath() with no path given throws an error",
        run: function(env, test) {
          try {
            env.caching.descendIntoPath();
            test.result(false, "descendIntoPath() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#cachePath() with no path given throws an error",
        run: function(env, test) {
          try {
            env.caching.cachePath();
            test.result(false, "syncDataIn() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      },


      {
        desc: "#descendIntoPath() with a file path given throws an error",
        run: function(env, test) {
          try {
            env.caching.descendIntoPath('/foo/bar');
            test.result(false, "descendIntoPath() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "#descendIntoPath() works for configured paths",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          test.assertAnd(env.caching.descendIntoPath('/foo/'), true);
          test.assert(env.caching.descendIntoPath('/bar/'), false);
        }
      },

      {
        desc: "#descendIntoPath() works for subdirectories",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          test.assertAnd(env.caching.descendIntoPath('/foo/bar/'), true);
          test.assert(env.caching.descendIntoPath('/foo/bar/baz/'), true);
        }
      },

      {
        desc: "#rootPaths contains configured paths",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          test.assert(env.caching.rootPaths, ['/foo/']);
        }
      },

      {
        desc: "#rootPaths doesn't contain paths that overlap entirely, but only the shortest one",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          env.caching.set('/bar/', { data: true });
          env.caching.set('/foo/bar/baz/', { data: true });
          test.assert(env.caching.rootPaths, ['/foo/', '/bar/']);
        }
      },

      {
        desc: "#rootPaths doesn't contain paths that have been removed",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          env.caching.set('/bar/', { data: true });
          env.caching.set('/foo/bar/baz/', { data: true });
          env.caching.remove('/foo/');
          test.assert(env.caching.rootPaths, ['/foo/bar/baz/', '/bar/']);
        }
      },

      {
        desc: "#reset resets the state",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          env.caching.set('/bar/', { data: false });
          env.caching.reset();
          test.assertTypeAnd(env.caching.get('/foo/'), 'undefined');
          test.assertTypeAnd(env.caching.get('/bar/'), 'undefined');
          test.assert(env.caching.rootPaths, []);
        }
      },

      {
        desc: "cachePathReady returns true if ready is set",
        run: function(env, test) {
          env.caching.enable('/foo/');
          env.caching.enable('/bar/');
          test.assertAnd(env.caching.cachePathReady('/foo/'), false);
          test.assertAnd(env.caching.cachePathReady('/foo/bar/'), false);
          test.assertAnd(env.caching.cachePathReady('/foo/baz.txt'), false);
          test.assertAnd(env.caching.cachePathReady('/foo/bar/baz.txt'), false);
          test.assertAnd(env.caching.cachePathReady('/bar/'), false);
          test.assertAnd(env.caching.cachePathReady('/bar/foo/'), false);
          test.assertAnd(env.caching.cachePathReady('/bar/baz.txt'), false);
          test.assertAnd(env.caching.cachePathReady('/bar/foo/baz.txt'), false);
          env.caching.set('/bar/', { data: true, ready: true });
          test.assertAnd(env.caching.cachePathReady('/foo/'), false);
          test.assertAnd(env.caching.cachePathReady('/foo/bar/'), false);
          test.assertAnd(env.caching.cachePathReady('/foo/baz.txt'), false);
          test.assertAnd(env.caching.cachePathReady('/foo/bar/baz.txt'), false);
          test.assertAnd(env.caching.cachePathReady('/bar/'), true);
          test.assertAnd(env.caching.cachePathReady('/bar/foo/'), true);
          test.assertAnd(env.caching.cachePathReady('/bar/baz.txt'), true);
          test.assert(env.caching.cachePathReady('/bar/foo/baz.txt'), true);
        }
      }

    ]

  });

  return suites;
});
