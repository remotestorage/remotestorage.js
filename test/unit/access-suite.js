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

      env.Access = RemoteStorage.Access;

      env.access = new env.Access();

      test.result(true);
    },

    tests: [
      // tests are dependent on each other, as they modify the same 'access' object

      {
        desc: "#set scope=readings, mode=r, #get scope=readings",
        run: function(env, test) {
          env.access.set('readings', 'r');
          test.assert(env.access.get('readings'), 'r');
        }
      },

      {
        desc: "#set scope=writings, mode=rw, #get scope=writings",
        run: function(env, test) {
          env.access.set('writings', 'rw');
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
        desc: "#getModuleName throws an error for sub-root paths",
        run: function(env, test) {
          var errors = 0;
          try { env.access.getModuleName('a'); } catch(e) { errors++; }
          try { env.access.getModuleName('a/'); } catch(e) { errors++; }
          try { env.access.getModuleName('a/b'); } catch(e) { errors++; }
          try { env.access.getModuleName('a/b/'); } catch(e) { errors++; }
          try { env.access.getModuleName('a/b/c'); } catch(e) { errors++; }
          try { env.access.getModuleName('a/b/c/'); } catch(e) { errors++; }
          try { env.access.getModuleName('public'); } catch(e) { errors++; }
          try { env.access.getModuleName('public/'); } catch(e) { errors++; }
          try { env.access.getModuleName('public/a'); } catch(e) { errors++; }
          try { env.access.getModuleName('public/a/'); } catch(e) { errors++; }
          test.assert(errors, 10);
          test.assertAnd(env.access.getModuleName('/a'), '*');
          test.assertAnd(env.access.getModuleName('/public'), '*');
          test.assertAnd(env.access.getModuleName('/public/a'), '*');
          test.done();
        }
      },

      {
        desc: "#getModuleName return '*' for sub-module paths",
        run: function(env, test) {
          test.assertAnd(env.access.getModuleName('/a'), '*');
          test.assertAnd(env.access.getModuleName('/public'), '*');
          test.assertAnd(env.access.getModuleName('/public/a'), '*');
          test.done();
        }
      },
      
      {
        desc: "#getModuleName return the module name for various in-module paths",
        run: function(env, test) {
          test.assertAnd(env.access.getModuleName('/a/'), 'a');
          test.assertAnd(env.access.getModuleName('/a/b'), 'a');
          test.assertAnd(env.access.getModuleName('/a/b/'), 'a');
          test.assertAnd(env.access.getModuleName('/a/b/c'), 'a');
          test.assertAnd(env.access.getModuleName('/a/b/c/'), 'a');
          test.assertAnd(env.access.getModuleName('/public/a/'), 'a');
          test.assertAnd(env.access.getModuleName('/public/a/b'), 'a');
          test.assertAnd(env.access.getModuleName('/public/a/b/'), 'a');
          test.assertAnd(env.access.getModuleName('/public/a/b/c'), 'a');
          test.assertAnd(env.access.getModuleName('/public/a/b/c/'), 'a');
          test.done();
        }
      },

      {
        desc: "#checkPath returns true for paths inside writings, mode=rw",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/b', 'rw'), true);
          test.done();
        }
      },

      {
        desc: "#checkPath returns true for paths inside writings, mode=r",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/b', 'r'), true);
          test.done();
        }
      },

      {
        desc: "#checkPath returns true for paths inside readings, mode=r",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a/b', 'r'), true);
          test.done();
        }
      },
      
      {
        desc: "#checkPath returns false for paths inside readings, mode=rw",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/readings/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/readings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/readings/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/readings/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/readings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/readings/a/b', 'rw'), false);
          test.done();
        }
      },
      
      {
        desc: "#checkPath returns false for paths outside readings and writings, mode=rw",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/redings/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/radings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/eadings/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/readngs/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/reaings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/redings/a/b', 'rw'), false);
          test.done();
        }
      },
      
      {
        desc: "#checkPath returns false for paths outside readings and writings, mode=r",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/redings/a', 'r'), false);
          test.assertAnd(env.access.checkPath('/radings/a/', 'r'), false);
          test.assertAnd(env.access.checkPath('/eadings/a/b', 'r'), false);
          test.assertAnd(env.access.checkPath('/public/readngs/a', 'r'), false);
          test.assertAnd(env.access.checkPath('/public/reaings/a/', 'r'), false);
          test.assertAnd(env.access.checkPath('/public/redings/a/b', 'r'), false);
          test.done();
        }
      },
      
      {
        desc: "#checkPath returns false for paths outside modules",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/', 'r'), false);
          test.assertAnd(env.access.checkPath('/a', 'r'), false);
          test.assertAnd(env.access.checkPath('/public/a', 'r'), false);
          test.assertAnd(env.access.checkPath('/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/a', 'rw'), false);
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
          env.access.set('*', 'r');
          env.access.set('readings', 'r');
          env.access.set('writings', 'rw');
          test.assert(env.access.rootPaths, ['/']);
        }
      },

      {
        desc: "#checkPath returns true for read with *:r access",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/foo/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/foo/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/foo/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/foo', 'r'), true);
          test.assertAnd(env.access.checkPath('/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/foo', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/', 'r'), true);
          test.done();
        }
      },
      
      {
        desc: "#checkPath returns false for write with *:r access, except inside writings",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/readings/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/readings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/readings/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/readings/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/readings/a/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/readings/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPath('/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/foo/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/foo/a/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/foo/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/foo/a', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/foo/a/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/foo/a/b', 'rw'), false);
          test.assertAnd(env.access.checkPath('/foo', 'rw'), false);
          test.assertAnd(env.access.checkPath('/', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/foo', 'rw'), false);
          test.assertAnd(env.access.checkPath('/public/', 'rw'), false);
          test.done();
        }
      },
      

      {
        desc: "#checkPath returns true for read with *:rw access",
        run: function(env, test) {
          env.access.set('*', 'rw');
          test.assertAnd(env.access.checkPath('/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/foo/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/foo/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/foo/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a/b', 'r'), true);
          test.assertAnd(env.access.checkPath('/foo', 'r'), true);
          test.assertAnd(env.access.checkPath('/', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/foo', 'r'), true);
          test.assertAnd(env.access.checkPath('/public/', 'r'), true);
          test.done();
        }
      },
      
      {
        desc: "#checkPath returns true for write with *:rw access",
        run: function(env, test) {
          test.assertAnd(env.access.checkPath('/readings/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/readings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/readings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/readings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/writings/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/foo/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/foo/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/foo/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/foo/a/b', 'rw'), true);
          test.assertAnd(env.access.checkPath('/foo', 'rw'), true);
          test.assertAnd(env.access.checkPath('/', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/foo', 'rw'), true);
          test.assertAnd(env.access.checkPath('/public/', 'rw'), true);
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
          env.access.set('foo', 'rw');
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
        desc: "[2012.04] #scopeParameter is correct for root access",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('2012.04');
          env.access.set('*', 'rw');
          test.assert(env.access.scopeParameter, ':rw');
        }
      },

      {
        desc: "[remotestorage-00] #scopeParameter is correct for root access",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('remotestorage-00');
          env.access.set('*', 'rw');
          test.assert(env.access.scopeParameter, 'root:rw');
        }
      },

      {
        desc: "[remotestorage-01] #scopeParameter is correct for root access",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('remotestorage-01');
          env.access.set('*', 'rw');
          test.assert(env.access.scopeParameter, 'root:rw');
        }
      },

      {
        desc: "[remotestorage-02] #scopeParameter is correct for root access",
        run: function(env, test) {
          env.access.reset();
          env.access.setStorageType('remotestorage-02');
          env.access.set('*', 'rw');
          test.assert(env.access.scopeParameter, '*:rw');
        }
      }

    ]
  });

  return suites;
});
