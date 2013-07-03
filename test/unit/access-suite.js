if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['requirejs', 'fs'], function(requirejs, fs, undefined) {
  var suites = [];
  
  suites.push({
    name: "access",
    desc: "access knows all about the scope we claimed and which paths that gives us access to",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      require('./src/access');

      env.Access = RemoteStorage.Access;

      env.access = new env.Access();

      test.result(true);
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
        desc: "#rootPaths contain correct private paths",
        run: function(env, test) {
          test.assertFailAnd(env.access.rootPaths.indexOf('/a/'), -1);
          test.assertFail(env.access.rootPaths.indexOf('/b/'), -1);
        }
      },

      {
        desc: "#rootPaths contain correct public paths",
        run: function(env, test) {
          test.assertAnd(env.access.rootPaths.indexOf('/public/a/') !== -1, true);
          test.assert(env.access.rootPaths.indexOf('/public/b/') !== -1, true);
        }
      },

      {
        desc: "root access causes #rootPaths to only contain '/'",
        run: function(env, test) {
          env.access.set('root', 'rw');
          test.assert(env.access.rootPaths, ['/']);
        }
      },

      {
        desc: "#reset clears all scopes and paths",
        run: function(env, test) {
          env.access.reset();
          test.assertAnd(env.access.scopes, []);
          test.assert(env.access.rootPaths, []);
        }
      },

      {
        desc: "#scopeParameter is correct for one module",
        run: function(env, test) {
          env.access.reset();
          env.access.set('foo', 'rw');
          console.log('foo:rw !=' , env.access.scopeParameter);
          test.assert(env.access.scopeParameter, 'foo:rw');

          env.access.reset();
          env.access.set('foo', 'r');
          test.assert(env.access.scopeParameter, 'foo:r');
        }
      },

      {
        desc: "#scopeParameter is correct for multiple modules",
        run: function(env, test) {
          env.access.reset();
          env.access.set('foo', 'rw');
          env.access.set('bar', 'r');
          test.assert(env.access.scopeParameter, 'foo:rw bar:r');
        }
      },

      {
        desc: "[2012.04] #scopeParameter is correct for the root module",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('2012.04');
          env.access.set('root', 'rw');
          test.assert(env.access.scopeParameter, ':rw');
        }
      },

      {
        desc: "[remotestorage-00] #scopeParameter is correct for the root module",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('remotestorage-00');
          env.access.set('root', 'rw');
          test.assert(env.access.scopeParameter, 'root:rw');
        }
      }

    ]
  });

  return suites;
});
