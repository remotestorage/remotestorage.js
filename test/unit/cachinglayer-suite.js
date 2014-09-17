if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs'], function (Promise, requirejs) {
  global.Promise = Promise;
  var suites = [];

  suites.push({
    name: 'CachingLayer',
    desc: 'CachingLayer that is mixed into all local storage implementations',
    setup: function (env, test) {
      global.RemoteStorage = function() {};
      global.RemoteStorage.log = function() {};
      global.RemoteStorage.config = {
        changeEvents: { local: true, window: false, remote: true, conflict: true }
      };

      require('src/util.js');
      if (global.rs_util) {
        RemoteStorage.util = global.rs_util;
      } else {
        global.rs_util = RemoteStorage.util;
      }

      require('src/eventhandling');
      if ( global.rs_eventhandling ) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      require('src/cachinglayer.js');
      if (global.rs_cachinglayer) {
        RemoteStorage.cachingLayer = global.rs_cachinglayer;
      } else {
        global.rs_cachinglayer = RemoteStorage.cachingLayer;
      }
      require('src/inmemorystorage');
      if (global.rs_ims) {
        RemoteStorage.InMemoryStorage = global.rs_ims;
      } else {
        global.rs_ims = RemoteStorage.InMemoryStorage;
      }
      test.done();
    },

    beforeEach: function (env, test) {
      env.ims = new RemoteStorage.InMemoryStorage();
      test.done();
    },

    tests: [
      {
        desc: "getLatest",
        run: function (env, test) {
          var getLatest = env.ims._getInternals().getLatest;
          var localNode = {
            path:   '/a/b',
            local:  { body: 'b', contentType: 'c' },
            common: { foo: 'bar' },
            push:   { foo: 'bar' },
            remote: { foo: 'bar' }
          },
          commonNode = {
            path:   '/a/b',
            common: { body: 'b', contentType: 'c' },
            local:  { foo: 'bar' },
            push:   { foo: 'bar' },
            remote: { foo: 'bar' }
          },
          legacyNode = {
            path:        '/foo',
            body:        'asdf',
            contentType: 'text/plain'
          };

          test.assertAnd(getLatest(undefined), undefined);
          test.assertAnd(getLatest({local: { revision: 1, timestamp: 1 }}), undefined);
          test.assertAnd(getLatest(localNode).body, 'b');
          test.assertAnd(getLatest(localNode).contentType, 'c');
          test.assertAnd(getLatest(commonNode).body, 'b');
          test.assertAnd(getLatest(commonNode).contentType, 'c');
          test.assertAnd(getLatest(legacyNode).body, 'asdf');
          test.assertAnd(getLatest(legacyNode).contentType, 'text/plain');
          test.done();
        }
      },

      {
        desc: "makeNode",
        run: function (env, test) {
          var makeNode = env.ims._getInternals().makeNode;

          test.assertAnd(makeNode('/a/b/'), {
            path: '/a/b/',
            common: { itemsMap: {} }
          });
          test.assert(makeNode('/a/b'), {
            path: '/a/b',
            common: { }
          });
        }
      },

      {
        desc: "locally created documents are considered outdated",
        run: function (env, test) {
          env.ims.put('/new/document', 'content', 'text/plain').then(function () {
            var paths = RemoteStorage.util.pathsFromRoot('/new/document');
            env.ims.getNodes(paths).then(function (nodes) {
              test.assert(env.ims._getInternals().isOutdated(nodes, 1000), true);
            });
          });
        }
      },

      {
        desc: "this._getAllDescendentPaths",
        run: function (env, test) {
          env.ims.put('/foo/bar/baz/baf', 'asdf', 'qwer').then(function () {
            env.ims._getAllDescendentPaths('/').then(function (paths) {
              console.log("paths: ",paths);
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
            return env.ims.forAllNodes(function (node) {
              test.assertAnd((node.path === '/' || node.path === '/foo/'), true);
              count++;
            }).then(function() {
              test.assertAnd(count, 2);
              test.done();
            });
          });
        }
      },

      {
        desc: "_emitChange emits change events",
        run: function(env, test) {
          var changeEvent = {
            path:   '/foo',
            origin: 'local'
          };

          env.ims.on('change', function(event) {
            test.assert(event, changeEvent);
          });

          env.ims._emitChange(changeEvent);
        }
      },

      {
        desc: "_emitChange doesn't emit events that are not enabled",
        run: function(env, test) {
          var changeEvent = {
            path:   '/foo',
            origin: 'local'
          };

          RemoteStorage.config.changeEvents.local = false;

          env.ims.on('change', function(event) {
            test.result(false, 'change event should not have been fired');
          });

          env.ims._emitChange(changeEvent);

          setTimeout(function() {
            test.done();
          }, 10);
        }
      },

      {
        desc: "_updateNodes calls run sequentially",
        run: function(env, test) {
          var jobOneCbCalled = false;
          var jobOneCompleted = false;
          var jobTwoCbCalled = false;
          var jobTwoCompleted = false;
          var jobThreeCbCalled = false;

          env.ims._updateNodes(['/foo'], function (paths, nodes) {
            test.assertAnd(jobOneCbCalled, false);
            test.assertAnd(jobTwoCbCalled, false);
            test.assertAnd(jobThreeCbCalled, false);

            test.assertAnd(jobOneCompleted, false);
            test.assertAnd(jobTwoCompleted, false);

            test.assertAnd(nodes, {
              '/foo': undefined
            }, 'first pass');
            jobOneCbCalled = true;
            throw new Error('boom!');
          }).then(function() {
            test.result(false, 'this promise should have been rejected');
          }, function (err) {
            test.assertAnd(jobOneCbCalled, true);
            test.assertAnd(jobTwoCbCalled, false);
            test.assertAnd(jobThreeCbCalled, false);

            test.assertAnd(jobOneCompleted, false);
            test.assertAnd(jobTwoCompleted, false);

            test.assertAnd(err.message, 'boom!');
            jobOneCompleted = true;
          });

          env.ims._updateNodes(['/foo'], function (paths, nodes) {
            test.assertAnd(jobOneCbCalled, true);
            test.assertAnd(jobTwoCbCalled, false);
            test.assertAnd(jobThreeCbCalled, false);

            test.assertAnd(jobOneCompleted, true);
            test.assertAnd(jobTwoCompleted, false);

            test.assertAnd(nodes, {
              '/foo': undefined
            }, 'second pass');
            nodes['/foo'] = {local: {some: 'data'}};
            jobTwoCbCalled = true;
            return nodes;
          }).then(function() {
            test.assertAnd(jobOneCbCalled, true);
            test.assertAnd(jobTwoCbCalled, true);
            test.assertAnd(jobThreeCbCalled, false);

            test.assertAnd(jobOneCompleted, true);
            test.assertAnd(jobTwoCompleted, false);

            jobTwoCompleted = true;
          });

          env.ims._updateNodes(['/foo'], function (paths, nodes) {
            test.assertAnd(jobOneCbCalled, true);
            test.assertAnd(jobTwoCbCalled, true);
            test.assertAnd(jobThreeCbCalled, false);

            test.assertAnd(jobOneCompleted, true);
            test.assertAnd(jobTwoCompleted, true);

            test.assertAnd(nodes, {
              '/foo': {
                local: {some: 'data'}
              }
            }, 'third pass');
            nodes['/foo'] = {local: {some: 'other data'}};
            jobThreeCbCalled = true;
            return nodes;
          }).then(function() {
            test.assertAnd(jobOneCbCalled, true);
            test.assertAnd(jobTwoCbCalled, true);
            test.assertAnd(jobThreeCbCalled, true);

            test.assertAnd(jobOneCompleted, true);
            test.assertAnd(jobTwoCompleted, true);

            test.done();
          });
        }
      }
    ]
  });

  return suites;
});
