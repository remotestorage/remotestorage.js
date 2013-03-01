if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['requirejs', 'fs'], function(requirejs, fs, undefined) {
  var suites = [];

  suites.push({
    name: "caching",
    desc: "Caching stores settings about which paths to cache locally",
    setup: function(env, test) {
      requirejs(['./src/lib/caching'], function(Caching) {
        env.Caching = Caching;

        test.result(true);
      });
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
          };
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
          };
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
          };
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
          };
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
          test.assertTypeAnd(env.caching.get('/foo/'), 'object')
          env.caching.remove('/foo/');
          test.assertType(env.caching.get('/foo/'), 'undefined');
        }
      },

      {
        desc: "#descendInto() with no path given throws an error",
        run: function(env, test) {
          try {
            env.caching.descendInto();
            test.result(false, "descendInto() didn't fail");
          } catch(e) {
            test.result(true);
          };
        }
      },

      {
        desc: "#cacheDataIn() with no path given throws an error",
        run: function(env, test) {
          try {
            env.caching.cacheDataIn();
            test.result(false, "syncDataIn() didn't fail");
          } catch(e) {
            test.result(true);
          };
        }
      },


      {
        desc: "#descendInto() with a file path given throws an error",
        run: function(env, test) {
          try {
            env.caching.descendInto('/foo/bar');
            test.result(false, "descendInto() didn't fail");
          } catch(e) {
            test.result(true);
          };
        }
      },

      {
        desc: "#descendInto() works for configured paths",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          test.assertAnd(env.caching.descendInto('/foo/'), true);
          test.assert(env.caching.descendInto('/bar/'), false);
        }
      },

      {
        desc: "#descendInto() works for subdirectories",
        run: function(env, test) {
          env.caching.set('/foo/', { data: true });
          test.assertAnd(env.caching.descendInto('/foo/bar/'), true);
          test.assert(env.caching.descendInto('/foo/bar/baz/'), true);
        }
      }

    ]

  });

  return suites;
});
