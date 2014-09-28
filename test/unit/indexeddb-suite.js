if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs'], function (Promise, requirejs) {
  global.Promise = Promise;

  var suites = [];

  suites.push({
    name: "IndexedDB",
    desc: "indexedDB caching layer",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      global.RemoteStorage.log = function() {};
      global.RemoteStorage.config = {
        changeEvents: { local: true, window: false, remote: true, conflict: true }
      };

      require('src/util');
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

      require('src/indexeddb.js');
      if (global.rs_IndexedDB) {
        RemoteStorage.IndexedDB = global.rs_IndexedDB;
      } else {
        global.rs_IndexedDB = RemoteStorage.IndexedDB;
      }

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
          env.idb.putsRunning = 0;
          env.idb.put('/foo/bla', 'basdf', 'text/plain').then(function() {
            env.idb.on('change', function(event) {
              test.assertAnd(event.origin, 'local');
              setTimeout(function() {
                test.done();
              }, 50);
            });
            //the mock is just an in-memory object; need to explicitly set its .length and its .key() function now:
            env.idb.fireInitial();
          }, function(e) {
            test.result(false, e);
          });
          env._gets[0].onsuccess({ target: {}});
          env._transactions[0].oncomplete();
        }
      },

      {
        desc: "setNodes calls setNodesInDb when putsRunning is 0",
        run: function(env, test) {
          var setNodesInDb = env.idb.setNodesInDb,
            getNodesFromDb = env.idb.getNodesFromDb;
          env.idb.setNodesInDb = function(nodes) {
            test.assertAnd(nodes, {foo: {path: 'foo'}});
            setTimeout(function() {
              env.idb.setNodesInDb = setNodesInDb;
              env.idb.getNodesFromDb = getNodesFromDb;
              test.done();
            }, 10);
            return Promise.resolve();
          };
          env.idb.putsRunning = 0;
          env.idb.setNodes({foo: {path: 'foo'}});
        }
      },

      {
        desc: "setNodes doesn't call setNodesInDb when putsRunning is 1, but will flush later",
        run: function(env, test) {
          var setNodesInDb = env.idb.setNodesInDb,
            getNodesFromDb = env.idb.getNodesFromDb;
          env.idb.changesQueued = {};
          env.idb.changesRunning = {};
          env.idb.setNodesInDb = function(nodes) {
            test.result(false, 'should not have called this function');
          };
          env.idb.putsRunning = 1;
          env.idb.setNodes({foo: {path: 'foo'}});
          test.assertAnd(env.idb.changesQueued, {foo: {path: 'foo'}});
          test.assertAnd(env.idb.changesRunning, {});

          env.idb.setNodesInDb = function(nodes) {
            test.assertAnd(nodes, {foo: {path: 'foo'}});
            setTimeout(function() {
              env.idb.setNodesInDb = setNodesInDb;
              env.idb.getNodesFromDb = getNodesFromDb;
              test.done();
            }, 10);
            return Promise.resolve();
          };
          env.idb.putsRunning = 0;
          env.idb.maybeFlush();
          test.assertAnd(env.idb.changesQueued, {});
          test.assertAnd(env.idb.changesRunning, {foo: {path: 'foo'}});
        }
      }
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
