if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs'], function (Promise, requirejs) {
  global.Promise = Promise;

  var suites = [];

  var NODES_PREFIX = 'remotestorage:cache:nodes:';
  var CHANGES_PREFIX = 'remotestorage:cache:changes:';

  function assertNode(test, path, expected) {
    var node = JSON.parse(localStorage[NODES_PREFIX + path]);

    if (node && node.local && node.local.timestamp) {
      delete node.local.timestamp;
    }
    if (node && node.common && node.common.timestamp) {
      delete node.common.timestamp;
    }
    test.assertAnd(node, expected);
  }

  function assertChange(test, path, expected) {
    var change = JSON.parse(localStorage[CHANGES_PREFIX + path]);
    test.assertAnd(change, expected);
  }

  function assertNoChange(test, path) {
    test.assertTypeAnd(localStorage[CHANGES_PREFIX + path], 'undefined');
  }

  function assertHaveNodes(test, expected) {
    var haveNodes = [];
    var keys = Object.keys(localStorage);

    for (var i=0; i<keys.length; i++) {
      if (isNodeKey(keys[i])) {
        haveNodes.push(keys[i].substr(NODES_PREFIX.length));
      }
    }
    test.assertAnd(haveNodes, expected);
  }

  suites.push({
    name: "LocalStorage",
    desc: "localStorage caching layer",

    setup: function(env, test) {
      global.RemoteStorage = function() {};
      global.RemoteStorage.log = function() {};
      global.RemoteStorage.config = {
        changeEvents: { local: true, window: false, remote: true, conflict: true }
      };

      require('./src/util');
      if (global.rs_util) {
        RemoteStorage.util = global.rs_util;
      } else {
        global.rs_util = RemoteStorage.util;
      }

      require('src/eventhandling.js');
      if (global.rs_eventhandling) {
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

      require('src/localstorage.js');
      if (global.rs_LocalStorage) {
        RemoteStorage.LocalStorage = global.rs_LocalStorage;
      } else {
        global.rs_LocalStorage = RemoteStorage.LocalStorage;
      }

      test.done();
    },

    beforeEach: function(env, test) {
      global.localStorage = {};
      env.ls = new RemoteStorage.LocalStorage();
      test.done();
    },

    tests: [
      {
        desc: "#get loads a node",
        run: function(env, test) {
          global.localStorage[NODES_PREFIX + '/foo'] = JSON.stringify({
            path: '/foo',
            local: {
              body: "bar",
              contentType: "text/plain",
              revision: "123"
            }
          });
          env.ls.get('/foo').then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, "bar");
            test.assertAnd(r.contentType, "text/plain");
            test.done();
          });
        }
      },

      {
        desc: "#get yields 404 when it doesn't find a node",
        run: function(env, test) {
          env.ls.get('/bar').then(function (r) {
            test.assert(r.statusCode, 404);
          });
        }
      },

      {
        desc: "#put yields 200",
        run: function(env, test) {
          env.ls.put('/foo', 'bar', 'text/plain').then(function (r) {
            test.assert(r.statusCode, 200);
          });
        }
      },

      {
        desc: "#put creates a new node",
        run: function(env, test) {
          env.ls.put('/foo/bar/baz', 'bar', 'text/plain').then(function () {
            assertNode(test, '/foo/bar/baz', {
              path: '/foo/bar/baz',
              local: {
                body: 'bar',
                contentType: 'text/plain'
              },
              common: {}
            });
            test.done();
          });
        }
      },

      {
        desc: "#put fires a 'change' with origin=window for outgoing changes",
        timeout: 250,
        run: function(env, test) {
          RemoteStorage.config.changeEvents.window = true;
          env.ls.on('change', function(event) {
            test.assert(event, {
              path: '/foo/bla',
              origin: 'window',
              oldValue: undefined,
              newValue: 'basdf',
              oldContentType: undefined,
              newContentType: 'text/plain'
            });
          });
          env.ls.put('/foo/bla', 'basdf', 'text/plain');
        }
      },

      {
        desc: "#put attaches the oldValue correctly for updates",
        run: function(env, test) {
          var i = 0;

          env.ls.on('change', function(event) {
            i++;
            if (i === 1) {
              test.assertAnd(event, {
                path: '/foo/bla',
                origin: 'window',
                oldValue: undefined,
                newValue: 'basdf',
                oldContentType: undefined,
                newContentType: 'text/plain'
              });
            } else if (i === 2) {
              test.assertAnd(event, {
                path: '/foo/bla',
                origin: 'window',
                oldValue: 'basdf',
                newValue: 'fdsab',
                oldContentType: 'text/plain',
                newContentType: 'text/plain'
              });
              setTimeout(function() {
                test.done();
              }, 0);
            } else {
              console.error("UNEXPECTED THIRD CHANGE EVENT");
              test.result(false);
            }
          });

          env.ls.put('/foo/bla', 'basdf', 'text/plain').then(function() {
            env.ls.put('/foo/bla', 'fdsab', 'text/plain');
          });
        }
      },


      {
        desc: "fireInitial fires change event with 'local' origin for initial cache content",
        timeout: 250,
        run: function(env, test) {
          env.ls.put('/foo/bla', 'basdf', 'text/plain').then(function() {
            env.ls.on('change', function(event) {
              test.assert(event.origin, 'local');
            });

            // The mock is just an in-memory object; need to explicitly set its
            // .length and its .key() function now:
            localStorage.length = 1;
            localStorage.key = function(i) {
              if (i === 0) {
                return NODES_PREFIX+'/foo/bla';
              }
            };

            env.ls.fireInitial();
          });
        }
      },

      // TODO belongs in separate examples; missing description
      {
        desc: "getNodes, setNodes",
        run: function(env, test) {
          env.ls.getNodes(['/foo/bar/baz']).then(function(objs) {
            test.assertAnd(objs, {'/foo/bar/baz': undefined});
          }).then(function() {
            return env.ls.setNodes({
              '/foo/bar': {
                path: '/foo/bar',
                common: { body: 'asdf' }
              }
            });
          }).then(function() {
            return env.ls.getNodes(['/foo/bar', '/foo/bar/baz']);
          }).then(function(objs) {
            test.assertAnd(objs, {
              '/foo/bar/baz': undefined,
              '/foo/bar': {
                path: '/foo/bar',
                common: { body: 'asdf' }
              }
            });
          }).then(function() {
            return env.ls.setNodes({
              '/foo/bar/baz': {
                path: '/foo/bar/baz/',
                common: { body: 'qwer' }
              },
              '/foo/bar': undefined
            });
          }).then(function() {
            return env.ls.getNodes(['/foo/bar', '/foo/bar/baz']);
          }).then(function(objs) {
            test.assertAnd(objs, {
              '/foo/bar': undefined,
              '/foo/bar/baz': {
                path: '/foo/bar/baz/',
                common: { body: 'qwer' }
              }
            });
            test.done();
          });
        }
      }
    ]
  });

  return suites;
});
