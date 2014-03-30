if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  suites.push({
    name: "IndexedDB",
    desc: "indexedDB caching layer",
    setup: function(env, test) {
      require('./lib/promising');
      global.RemoteStorage = function() {};
      global.RemoteStorage.log = function() {};
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
      require('./src/indexeddb');
      test.done();
    },

    beforeEach: function(env, test) {
      var cursor = {};
      env._data = [];
      env._gets = [];
      env._puts = [];
      env._transactions = [];
      var objectStore = function() {
        return {
          get: function() {
            var ret = {
              onsuccess: function() {}
            };
            env._gets.push(ret);
            return ret;
          },
          put: function(obj) {
            env._data.push(obj);
            var ret = {
              onsuccess: function() {}
            };
            env._puts.push(ret);
            return ret;
          },
          openCursor: function() {
            setTimeout(function() {
              cursor.onsuccess({
                target: {
                  result: {
                    key: 'hi',
                    value: env._data[0],
                    continue: function () {
                      cursor.onsuccess({ target: {}});
                    }
                  }
                }
              });
            }, 0);
            return cursor;
          }
        };
      };
      env.idb = new RemoteStorage.IndexedDB({
        transaction: function() {
          var ret = {
            objectStore: objectStore,
            oncomplete: function() {}
          };
          env._transactions.push(ret);
          return ret;
        }
      });
      test.done();
    },

    tests: [
      {
        desc: "fireInitial fires change event with 'local' origin for initial cache content",
        timeout: 250,
        run: function(env, test) {
          env.idb.put('/foo/bla', 'basdf', 'text/plain').then(function() {
            env.idb.on('change', function(event) {
              test.assert(event.origin, 'local');
            });
            //the mock is just an in-memory object; need to explicitly set its .length and its .key() function now:
            env.idb.fireInitial();
          }, function(e) {
            test.result(false, e);
          });
          setTimeout(function() {
            env._puts[0].onsuccess();
            env._transactions[1].oncomplete();
          }, 100);
          env._gets[0].onsuccess({ target: {}});
          env._transactions[0].oncomplete();
        }
      },
/* TODO: mock indexeddb with some nodejs library
      {
        desc: "getNodes, setNodes",
        run: function(env, test) {
          env.idb.getNodes(['/foo/bar/baz']).then(function(objs) {
            test.assertAnd(objs, {'/foo/bar/baz': undefined});
          }).then(function() {
            return env.idb.setNodes({
              '/foo/bar': {
                path: '/foo/bar',
                common: { body: 'asdf' }
              }
            });
          }).then(function() {
            return env.idb.getNodes(['/foo/bar', '/foo/bar/baz']);
          }).then(function(objs) {
            test.assertAnd(objs, {
              '/foo/bar/baz': undefined,
              '/foo/bar': {
                path: '/foo/bar',
                common: { body: 'asdf' }
              }
            });
          }).then(function() {
            return env.idb.setNodes({
              '/foo/bar/baz': {
                path: '/foo/bar/baz/',
                common: { body: 'qwer' }
              },
              '/foo/bar': undefined
            });
          }).then(function() {
            return env.idb.getNodes(['/foo/bar', '/foo/bar/baz']);
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
      }*/
    ]
  });

  return suites;
});
