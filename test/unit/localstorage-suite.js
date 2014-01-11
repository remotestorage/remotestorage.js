if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  var NODES_PREFIX = 'remotestorage:cache:nodes:';
  var CHANGES_PREFIX = 'remotestorage:cache:changes:';

  function assertBody(test, path, expected) {
    var node = JSON.parse(localStorage[NODES_PREFIX + path]).body;
    test.assertAnd(node, expected);
  }

  function assertMeta(test, path, expected) {
    var node = JSON.parse(localStorage[NODES_PREFIX + path]).items;
    test.assertAnd(node, expected);
  }

  function assertChange(test, path, expected) {
    var change = JSON.parse(localStorage[CHANGES_PREFIX + path]);
    test.assertAnd(change, expected);
  }

  function assertNoChange(test, path) {
    test.assertTypeAnd(localStorage[CHANGES_PREFIX + path], 'undefined');
  }

  function assertHaveBodies(test, expected) {
    var haveNodes = [];
    var keys = Object.keys(localStorage), kl = keys.length;
    for (var i=0;i<kl;i++) {
      if (keys[i].substr(0, NODES_PREFIX.length) === NODES_PREFIX) {
        haveNodes.push(keys[i].substr(NODES_PREFIX.length));
      }
    }
    test.assertAnd(haveNodes, expected);
  }

  suites.push({
    name: "LocalStorage",
    desc: "localStorage caching layer",
    setup: function(env, test) {
      require('./lib/promising');
      global.RemoteStorage = function() {};
      require('./src/eventhandling');
      if (global.rs_eventhandling) {
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
      require('./src/localstorage');
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
            body: 'bar'
          });
          global.localStorage[NODES_PREFIX + '/'] = JSON.stringify({
            items: {
             foo: {
               'Content-Type': "text/plain",
                ETag: "123"
              }
            }
          });
          env.ls.get('/foo').then(function(status, body, contentType, revision) {
            test.assertAnd(status, 200);
            test.assertAnd(body, "bar");
            test.assertAnd(contentType, "text/plain");
            test.assertAnd(revision, "123");
            test.done();
          });
        }
      },

      {
        desc: "#get yields 404 when it doesn't find a node",
        run: function(env, test) {
          env.ls.get('/bar').then(function(status) {
            test.assert(status, 404);
          });
        }
      },

      {
        desc: "#put yields 200",
        run: function(env, test) {
          env.ls.put('/foo', 'bar', 'text/plain').then(function(status) {
            test.assert(status, 200);
          });
        }
      },

      {
        desc: "#put creates a new node",
        run: function(env, test) {
          env.ls.put('/foo/bar/baz', 'bar', 'text/plain').then(function() {
            assertBody(test, '/foo/bar/baz', 'bar');
            assertMeta(test, '/foo/bar/', {
              baz: {
                'Content-Type': 'text/plain',
                'Content-Length': 3,
                ETag: true
              }
            });
            test.done();
          });
        }
      },

      {
        desc: "#put records a change for outgoing changes",
        run: function(env, test) {
          env.ls.put('/foo/bla', 'basdf', 'text/plain').then(function() {
            assertChange(test, '/foo/bla', {
              action: 'PUT',
              path: '/foo/bla'
            });
            test.done();
          });
        }
      },

      {
        desc: "#put doesn't record a change for incoming changes",
        run: function(env, test) {
          env.ls.put('/foo/bla', 'basdf', 'text/plain', true).then(function() {
            assertNoChange(test, '/foo/bla');
            test.done();
          });
        }
      },

      {
        desc: "#put sets a revision for incoming changes",
        run: function(env, test) {
          env.ls.put('/foo/bla', 'basdf', 'text/plain', true, 'meh').then(function() {
            var expectedMeta = {
              bla: {
                'Content-Type': 'text/plain',
                'Content-Length': 5,
                ETag: 'meh'
              }
            };
            assertMeta(test, '/foo/', expectedMeta);
            assertBody(test, '/foo/bla', 'basdf');
            test.done();
          });
        }
      },

      {
        desc: "#put fires a 'change' with origin=window for outgoing changes",
        timeout: 250,
        run: function(env, test) {
          env.ls.on('change', function(event) {
            test.assert(event, {
              path: '/foo/bla',
              origin: 'window',
              oldValue: undefined,
              newValue: 'basdf'
            });
          });
          env.ls.put('/foo/bla', 'basdf', 'text/plain');
        }
      },

      {
        desc: "#put fires a 'change' with origin=remote for incoming changes",
        run: function(env, test) {
          env.ls.on('change', function(event) {
            test.assert(event, {
              path: '/foo/bla',
              origin: 'remote',
              oldValue: undefined,
              newValue: 'adsf'
            });
          });
          env.ls.put('/foo/bla', 'adsf', 'text/plain', true);
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
                origin: 'remote',
                oldValue: undefined,
                newValue: 'basdf'
              });
            } else if (i === 2) {
              test.assertAnd(event, {
                path: '/foo/bla',
                origin: 'window',
                oldValue: 'basdf',
                newValue: 'fdsab'
              });
              setTimeout(function() {
                test.done();
              }, 0);
            } else {
              console.error("UNEXPECTED THIRD CHANGE EVENT");
              test.result(false);
            }
          });
          env.ls.put('/foo/bla', 'basdf', 'text/plain', true).then(function() {
            env.ls.put('/foo/bla', 'fdsab', 'text/plain');
          });
        }
      },

      {
        desc: "#putFolder adds the folder cache node with the given body",
        run: function(env, test) {
          var folderItems = {'item1': {'ETag': '123', 'Content-Type': 'text/plain'},
                                'subfolder/': {'ETag': '321'}};

          env.ls.putFolder('/foo/bar/', folderItems, 'meh').then(function() {
            var expectedParentMeta = { 'bar/': { ETag: 'meh' } };
            assertMeta(test, '/foo/', expectedParentMeta);
            assertMeta(test, '/foo/bar/', folderItems);
            test.done();
          });
        }
      },

      {
        desc: "#putFolder adds the path to the parents",
        run: function(env, test) {
          var folderItems = {item1: {'ETag': '123', 'Content-Type': 'text/plain'},
                                'subfolder/': {'ETag': '321'}};

          env.ls.putFolder('/foo/bar/', folderItems).then(function() {
            var fooNode = JSON.parse(localStorage[NODES_PREFIX + '/foo/']);
            var rootNode = JSON.parse(localStorage[NODES_PREFIX + '/']);

            test.assertAnd(fooNode.items['bar/'], { ETag: true });
            test.assertAnd(rootNode.items['foo/'], { ETag: true });
            test.done();
          });
        }
      },

      {
        desc: "#delete records a change for outgoing changes",
        run: function(env, test) {
          env.ls.put('/foo/bla', 'basdf', 'text/plain', true).then(function() {
            env.ls.delete('/foo/bla').then(function() {
              assertChange(test, '/foo/bla', {
                action: 'DELETE',
                path: '/foo/bla'
              });
              test.done();
            });
          });
        }
      },

      {
        desc: "#delete doesn't record a change for incoming changes",
        run: function(env, test) {
          env.ls.put('/foo/bla', 'basfd', 'text/plain', true).then(function() {
            env.ls.delete('/foo/bla', true).then(function() {
              assertNoChange(test, '/foo/bla');
              test.done();
            });
          });
        }
      },

      // TODO delete removes node and cached item from parent nodes

      {
        desc: "fireInitial fires change event with 'local' origin for initial cache content",
        timeout: 250,
        run: function(env, test) {
          env.ls.put('/foo/bla', 'basdf', 'text/plain');
          env.ls.on('change', function(event) {
            test.assert(event.origin, 'local');
          });
          //the mock is just an in-memory object; need to explicitly set its .length and its .key() function now:
          localStorage.length = 1;
          localStorage.key = function(i) {
            if (i === 0) {
              return NODES_PREFIX+'/foo/bla';
            }
          };
          env.ls.fireInitial();
        }
      },

      {
        desc: "#setRevision updates `cached` items of parent directories",
        run: function(env, test) {
          env.ls.setRevision('/foo/bar/baz', 'a1b2c3').then(function() {
            test.assertAnd(env.ls._getMetas('/foo/bar/'), { 'baz': { ETag: 'a1b2c3' } });
            test.assertAnd(env.ls._getMetas('/foo/'), { 'bar/': { ETag: true } });
            test.assertAnd(env.ls._getMetas('/'), { 'foo/': { ETag: true } });
            test.done();
          });
        }
      },

      {
        desc: "#setRevision doesn't overwrite `cached` items in parent folders",
        run: function(env, test) {
          env.ls.setRevision('/foo/bar/baz', 'a1b2c3').then(function() {
            env.ls.setRevision('/foo/bar/booze', 'd4e5f6').then(function() {
              test.assert(env.ls._getMetas('/foo/bar/'), { 'baz': { ETag: 'a1b2c3' }, 'booze': { ETag: 'd4e5f6' } });
            });
          });
        }
      }
    ]
  });

  return suites;
});
