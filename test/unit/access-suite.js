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
      RemoteStorage.log = function() {};
      require('./src/access');
      if (global.rs_access) {
        RemoteStorage.access = global.rs_access;
      } else {
        global.rs_access = RemoteStorage.access;
      }


      env.Access = RemoteStorage.Access;

      env.access = new env.Access();

      test.result(true);
    },

    tests: [
      // tests are dependent on each other, as they modify the same 'access' object

      {
        desc: "#claim scope=readings, mode=r, #get scope=readings",
        run: function(env, test) {
          env.access.claim('readings', 'r');
          test.assert(env.access.get('readings'), 'r');
        }
      },

      {
        desc: "#claim scope=writings, mode=rw, #get scope=writings",
        run: function(env, test) {
          env.access.claim('writings', 'rw');
          test.assert(env.access.get('writings'), 'rw');
        }
      },

      {
        desc: "#checkPermission returns true for scope=readings, mode=r",
        run: function(env, test) {
          test.assert(env.access.checkPermission('readings', 'r'), true);
        }
      },

      {
        desc: "#checkPermission returns true for scope=writings, mode=r",
        run: function(env, test) {
          test.assert(env.access.checkPermission('writings', 'r'), true);
        }
      },

      {
        desc: "#checkPermission returns false for scope=readings, mode=rw",
        run: function(env, test) {
          test.assert(env.access.checkPermission('readings', 'rw'), false);
        }
      },

      {
        desc: "#checkPermission returns true for scope=writings, mode=rw",
        run: function(env, test) {
          test.assert(env.access.checkPermission('writings', 'rw'), true);
        }
      },

      {
        desc: "#_getModuleName throws an error for sub-root paths",
        run: function(env, test) {
          var errors = 0;
          try { env.access._getModuleName('a'); } catch(e) { errors++; }
          try { env.access._getModuleName('a/'); } catch(e) { errors++; }
          try { env.access._getModuleName('a/b'); } catch(e) { errors++; }
          try { env.access._getModuleName('a/b/'); } catch(e) { errors++; }
          try { env.access._getModuleName('a/b/c'); } catch(e) { errors++; }
          try { env.access._getModuleName('a/b/c/'); } catch(e) { errors++; }
          try { env.access._getModuleName('public'); } catch(e) { errors++; }
          try { env.access._getModuleName('public/'); } catch(e) { errors++; }
          try { env.access._getModuleName('public/a'); } catch(e) { errors++; }
          try { env.access._getModuleName('public/a/'); } catch(e) { errors++; }
          test.assert(errors, 10);
          test.assertAnd(env.access._getModuleName('/a'), '*');
          test.assertAnd(env.access._getModuleName('/public'), '*');
          test.assertAnd(env.access._getModuleName('/public/a'), '*');
          test.done();
        }
      },

      {
        desc: "#_getModuleName return '*' for sub-module paths",
        run: function(env, test) {
          test.assertAnd(env.access._getModuleName('/a'), '*');
          test.assertAnd(env.access._getModuleName('/public'), '*');
          test.assertAnd(env.access._getModuleName('/public/a'), '*');
          test.done();
        }
      },

      {
        desc: "#_getModuleName return the module name for various in-module paths",
        run: function(env, test) {
          test.assertAnd(env.access._getModuleName('/a/'), 'a');
          test.assertAnd(env.access._getModuleName('/a/b'), 'a');
          test.assertAnd(env.access._getModuleName('/a/b/'), 'a');
          test.assertAnd(env.access._getModuleName('/a/b/c'), 'a');
          test.assertAnd(env.access._getModuleName('/a/b/c/'), 'a');
          test.assertAnd(env.access._getModuleName('/public/a/'), 'a');
          test.assertAnd(env.access._getModuleName('/public/a/b'), 'a');
          test.assertAnd(env.access._getModuleName('/public/a/b/'), 'a');
          test.assertAnd(env.access._getModuleName('/public/a/b/c'), 'a');
          test.assertAnd(env.access._getModuleName('/public/a/b/c/'), 'a');
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns true for paths inside writings, mode=rw",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/b', 'rw'), true);
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns true for paths inside writings, mode=r",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/b', 'r'), true);
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns true for paths inside readings, mode=r",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/b', 'r'), true);
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns false for paths inside readings, mode=rw",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/readings/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/readings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/readings/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/b', 'rw'), false);
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns false for paths outside readings and writings, mode=rw",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/redings/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/radings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/eadings/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/readngs/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/reaings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/redings/a/b', 'rw'), false);
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns false for paths outside readings and writings, mode=r",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/redings/a', 'r'), false);
          test.assertAnd(env.access.checkPathPermission('/radings/a/', 'r'), false);
          test.assertAnd(env.access.checkPathPermission('/eadings/a/b', 'r'), false);
          test.assertAnd(env.access.checkPathPermission('/public/readngs/a', 'r'), false);
          test.assertAnd(env.access.checkPathPermission('/public/reaings/a/', 'r'), false);
          test.assertAnd(env.access.checkPathPermission('/public/redings/a/b', 'r'), false);
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns false for paths outside modules",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/', 'r'), false);
          test.assertAnd(env.access.checkPathPermission('/a', 'r'), false);
          test.assertAnd(env.access.checkPathPermission('/public/a', 'r'), false);
          test.assertAnd(env.access.checkPathPermission('/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/a', 'rw'), false);
          test.done();
        }
      },

      {
        desc: "#rootPaths contain correct private paths",
        run: function(env, test) {
          test.assertFailAnd(env.access.rootPaths.indexOf('/readings/'), -1);
          test.assertFail(env.access.rootPaths.indexOf('/writings/'), -1);
        }
      },

      {
        desc: "#rootPaths contain correct public paths",
        run: function(env, test) {
          test.assertAnd(env.access.rootPaths.indexOf('/public/readings/') !== -1, true);
          test.assert(env.access.rootPaths.indexOf('/public/writings/') !== -1, true);
        }
      },

      {
        desc: "root access causes #rootPaths to only contain '/'",
        run: function(env, test) {
          env.access.claim('*', 'r');
          env.access.claim('readings', 'r');
          env.access.claim('writings', 'rw');
          test.assert(env.access.rootPaths, ['/']);
        }
      },

      {
        desc: "#checkPathPermission returns true for read with *:r access",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/foo', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/', 'r'), true);
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns false for write with *:r access, except inside writings",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/readings/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/readings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/readings/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/foo/a/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/foo/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/foo', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/foo', 'rw'), false);
          test.assertAnd(env.access.checkPathPermission('/public/', 'rw'), false);
          test.done();
        }
      },


      {
        desc: "#checkPathPermission returns true for read with *:rw access",
        run: function(env, test) {
          env.access.claim('*', 'rw');
          test.assertAnd(env.access.checkPathPermission('/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a/b', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/foo', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo', 'r'), true);
          test.assertAnd(env.access.checkPathPermission('/public/', 'r'), true);
          test.done();
        }
      },

      {
        desc: "#checkPathPermission returns true for write with *:rw access",
        run: function(env, test) {
          test.assertAnd(env.access.checkPathPermission('/readings/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/readings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/readings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/readings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/foo/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/foo', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/foo', 'rw'), true);
          test.assertAnd(env.access.checkPathPermission('/public/', 'rw'), true);
          test.done();
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
          env.access.claim('foo', 'rw');
          test.assert(env.access.scopeParameter, 'foo:rw');

          env.access.reset();
          env.access.claim('foo', 'r');
          test.assert(env.access.scopeParameter, 'foo:r');
        }
      },

      {
        desc: "#scopeParameter is correct for multiple modules",
        run: function(env, test) {
          env.access.reset();
          env.access.claim('foo', 'rw');
          env.access.claim('bar', 'r');
          test.assert(env.access.scopeParameter, 'foo:rw bar:r');
        }
      },

      {
        desc: "[2012.04] #scopeParameter is correct for root access",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('2012.04');
          env.access.claim('*', 'rw');
          test.assert(env.access.scopeParameter, ':rw');
        }
      },

      {
        desc: "[remotestorage-00] #scopeParameter is correct for root access",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('remotestorage-00');
          env.access.claim('*', 'rw');
          test.assert(env.access.scopeParameter, 'root:rw');
        }
      },

      {
        desc: "[remotestorage-01] #scopeParameter is correct for root access",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('remotestorage-01');
          env.access.claim('*', 'rw');
          test.assert(env.access.scopeParameter, 'root:rw');
        }
      },

      {
        desc: "[remotestorage-02] #scopeParameter is correct for root access",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('remotestorage-02');
          env.access.claim('*', 'rw');
          test.assert(env.access.scopeParameter, '*:rw');
        }
      }

    ]
  });

  return suites;
});
