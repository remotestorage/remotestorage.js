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
      var objectStore = function() {
        return {
          get: function() {
            return {
              onsuccess: function() {}
            };
          },
          openCursor: function() {
            setTimeout(function() {
              cursor.onsuccess({
                target: {
                  result: {
                    key: '/hi',
                    value: {
                      path: '/hi',
                      body: 'basdf'
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
          return {
            objectStore: objectStore
          };
        }
      });
      test.done();
    },

    tests: [
      {
        desc: "fireInitial fires change event with 'local' origin for initial cache content",
        timeout: 250,
        run: function(env, test) {
          env.idb.on('change', function(event) {
            test.assert(event.origin, 'local');
          });
          env.idb.fireInitial();
        }
      }
    ]
  });

  return suites;
});
