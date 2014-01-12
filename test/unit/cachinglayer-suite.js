if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  suites.push({
    name: 'CachingLayer',
    desc: 'CachingLayer that is mixed into all local storage implementations',
    setup: function(env, test) {
      require('./lib/promising');
      global.RemoteStorage = function() {};
      global.RemoteStorage.log = function() {};

      require('./src/eventhandling');
      if ( global.rs_eventhandling ) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      require('./src/cachinglayer');
      if (global.rs_cachinglayer) {
        RemoteStorage.cachingLayer = global.rs_cachinglayer;
      } else {
        global.rs_cachinglayer = RemoteStorage.cachingLayer;
      }
      require('./src/inmemorystorage');
      if (global.rs_ims) {
        RemoteStorage.InMemoryStorage = global.rs_ims;
      } else {
        global.rs_ims = RemoteStorage.InMemoryStorage;
      }
      test.done();
    },

    beforeEach: function(env, test) {
      env.ims = new RemoteStorage.InMemoryStorage();
      test.done();
    },

    tests: [
      {
        desc: "_isFolder, _isDocument",
        run: function(env, test) {
          test.assertAnd(env.ims._getInternals()._isFolder('/'), true);
          test.assertAnd(env.ims._getInternals()._isDocument('/'), false);
          test.assertAnd(env.ims._getInternals()._isFolder('/foo/'), true);
          test.assertAnd(env.ims._getInternals()._isDocument('/foo/'), false);
          test.assertAnd(env.ims._getInternals()._isFolder('/foo//'), true);
          test.assertAnd(env.ims._getInternals()._isDocument('/foo//'), false);
          test.assertAnd(env.ims._getInternals()._isFolder('/foo/b ar/'), true);
          test.assertAnd(env.ims._getInternals()._isDocument('/foo/b ar/'), false);
          test.assertAnd(env.ims._getInternals()._isFolder('/foo'), false);
          test.assertAnd(env.ims._getInternals()._isDocument('/foo'), true);
          test.assertAnd(env.ims._getInternals()._isFolder('/%2F'), false);
          test.assertAnd(env.ims._getInternals()._isDocument('/%2F'), true);
          test.assertAnd(env.ims._getInternals()._isFolder('/foo/%2F'), false);
          test.assertAnd(env.ims._getInternals()._isDocument('/foo/%2F'), true);
          test.assertAnd(env.ims._getInternals()._isFolder('/foo/ '), false);
          test.assert(env.ims._getInternals()._isDocument('/foo/ '), true);
        }
      },
      {
        desc: "_deepClone, _equal",
        run: function(env, test) {
          var obj = { str: 'a', i: 0, b: true };
          var cloned = env.ims._getInternals()._deepClone(obj);
          test.assertAnd(cloned, obj);
          test.assertAnd(env.ims._getInternals()._equal(cloned, obj), true);
          obj.nested = cloned;
          test.assertAnd(env.ims._getInternals()._equal(cloned, obj), false);
          cloned = env.ims._getInternals()._deepClone(obj);
          test.assertAnd(cloned, obj);
          test.assert(env.ims._getInternals()._equal(cloned, obj), true);
        }
      },
      {
        desc: "_getLatest",
        run: function(env, test) {
          var localNode = {
            path: '/a/b',
            local: {
              body: 'b',
              contentType: 'c'
            },
            common: {
              foo: 'bar'
            },
            push: {
              foo: 'bar'
            },
            remote: {
              foo: 'bar'
            }
          },
          commonNode = {
            path: '/a/b',
            common: {
              body: 'b',
              contentType: 'c'
            },
            local: {
              foo: 'bar'
            },
            push: {
              foo: 'bar'
            },
            remote: {
              foo: 'bar'
            }
          },
          legacyNode = {
            path: '/foo',
            body: 'asdf',
            contentType: 'text/plain'
          };
          test.assertAnd(env.ims._getInternals()._getLatest(undefined), undefined);
          test.assertAnd(env.ims._getInternals()._getLatest({local: {
            revision: 1,
            timestamp: 1
          }}), undefined);
          test.assertAnd(env.ims._getInternals()._getLatest(localNode).body, 'b');
          test.assertAnd(env.ims._getInternals()._getLatest(localNode).contentType, 'c');
          test.assertAnd(env.ims._getInternals()._getLatest(commonNode).body, 'b');
          test.assertAnd(env.ims._getInternals()._getLatest(commonNode).contentType, 'c');
          test.assertAnd(env.ims._getInternals()._getLatest(legacyNode).body, 'asdf');
          test.assertAnd(env.ims._getInternals()._getLatest(legacyNode).contentType, 'text/plain');
          test.done();
        }
      },
      {
        desc: "_nodesFromRoot",
        run: function(env, test) {
          var p1 = '/', p2 = '/a/b/c/d/e', p3 = '/a/b/c', p4 = '/a/b//', p5 = '//', p6 = '/a/b/c d/e/', p7 = '/foo';
          test.assertAnd(env.ims._getInternals()._nodesFromRoot(p1), [p1]);
          test.assertAnd(env.ims._getInternals()._nodesFromRoot(p2),
              [p2, '/a/b/c/d/', '/a/b/c/', '/a/b/', '/a/', '/']);
          test.assertAnd(env.ims._getInternals()._nodesFromRoot(p3), [p3, '/a/b/', '/a/', '/']);
          test.assertAnd(env.ims._getInternals()._nodesFromRoot(p4), [p4, '/a/b/', '/a/', '/']);
          test.assertAnd(env.ims._getInternals()._nodesFromRoot(p5), [p5, '/']);
          test.assertAnd(env.ims._getInternals()._nodesFromRoot(p6),
              [p6, '/a/b/c d/', '/a/b/', '/a/', '/']);
          test.assertAnd(env.ims._getInternals()._nodesFromRoot(p7), [p7, '/']);
          test.done();
        }
      },
      {
        desc: "_makeNode",
        run: function(env, test) {
          test.assertAnd(env.ims._getInternals()._makeNode('/a/b/', 1234567890123), {
            path: '/a/b/',
            common: {
              timestamp: 1234567890123,
              itemsMap: {}
            }
          });
          test.assert(env.ims._getInternals()._makeNode('/a/b', 1234567890123), {
            path: '/a/b',
            common: {
              timestamp: 1234567890123
            }
          });
        }
      },

      {
        desc: "this._getAllDescendentPaths",
        run: function(env, test) {
          env.ims.put('/foo/bar/baz/baf', 'asdf', 'qwer').then(function() {
            env.ims._getAllDescendentPaths('/').then(function(paths) {
              test.assertAnd(paths.sort(), ['/', '/foo/', '/foo/bar/', '/foo/bar/baz/', '/foo/bar/baz/baf'].sort());
              test.done();
            });
          });
        }
      },

      {
        desc: "flush",
        run: function(env, test) {
          env.ims.put('/foo/bar/baz/baf', 'asdf', 'qwer').then(function() {
            return env.ims.flush('/foo/bar/');
          }).then(function() {
            var count = 0;
            return env.ims.forAllNodes(function(node) {
              test.assertAnd((node.path === '/' || node.path === '/foo/'), true);
              count++;
            }).then(function() {
              test.assertAnd(count, 2);
              test.done();
            });
          });
        }
      }
    ]
  });

  return suites;
});
