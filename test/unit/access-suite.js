if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['requirejs', 'fs'], function(requirejs, fs, undefined) {
  var suites = [];

  suites.push({
    name: "util.js tests",
    desc: "a collection of tests for util.js",
    setup: function(env, test) {
      requirejs(['./src/lib/access'], function(Access) {
        env.Access = Access;

        env.access = new env.Access();

        test.result(true);
      });
    },

    tests: [
      // tests are dependent on each other, as they modify the same 'access' object

      {
        desc: "#set scope=a, mode=r, #get scope=a",
        run: function(env, test) {
          env.access.set('a', 'r');
          test.assert(env.access.get('a'), 'r');
        }
      },

      {
        desc: "#set scope=b, mode=rw, #get scope=b",
        run: function(env, test) {
          env.access.set('b', 'rw');
          test.assert(env.access.get('b'), 'rw');
        }
      },

      {
        desc: "#check returns true for scope=a, mode=r",
        run: function(env, test) {
          test.assert(env.access.check('a', 'r'), true);
        }
      },

      {
        desc: "#check returns true for scope=b, mode=r",
        run: function(env, test) {
          test.assert(env.access.check('b', 'r'), true);
        }
      },

      {
        desc: "#check returns false for scope=a, mode=rw",
        run: function(env, test) {
          test.assert(env.access.check('a', 'rw'), false);
        }
      },

      {
        desc: "#check returns true for scope=b, mode=rw",
        run: function(env, test) {
          test.assert(env.access.check('b', 'rw'), true);
        }
      },

      {
        desc: "#rootPaths returns correct private paths",
        run: function(env, test) {
          test.assertFailAnd(env.access.rootPaths.indexOf('/a/'), -1);
          test.assertFail(env.access.rootPaths.indexOf('/b/'), -1);
        }
      },

      {
        desc: "#rootPaths returns correct public paths",
        run: function(env, test) {
          test.assertFailAnd(env.access.rootPaths.indexOf('/public/a/'), -1);
          test.assertFail(env.access.rootPaths.indexOf('/public/b/'), -1);
        }
      }

    ]
  });

  return suites;
});
