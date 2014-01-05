if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

if(typeof global === 'undefined') global = window
global.RemoteStorage = function() {};

define([
  '../../lib/promising',
  '../../src/eventhandling',
  '../../src/cachinglayer', 
  '../../src/indexeddb'
], function() {
         var suites = [];

  suites.push({
    name: "IndexedDB",
    desc: "indexedDB caching layer",
    setup: function(env, test) {
      
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }

      if (global.rs_cachinglayer) {
        RemoteStorage.cachingLayer = global.rs_cachinglayer;
      } else {
        global.rs_cachinglayer = RemoteStorage.cachingLayer;
      }

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
                    key: 'hi',
                    value: {
                      body: 'basdf'
                    },
                    continue: function() {
                      env.cursorContinued = true;
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
          env.idb.put('/foo/bla', 'basdf', 'text/plain');
          env.idb.on('change', function(event) {
            setTimeout(function() {
              test.assertAnd(env.cursorContinued, true, "cursor.continue() wasn't called by fireInitial. This will not work!");
              test.assert(event.origin, 'local');
            }, 0);
          });
          //the mock is just an in-memory object; need to explicitly set its .length and its .key() function now:
          env.idb.fireInitial();
        }
      }
    ]
  });

  return suites;
});
