if(typeof(define) === 'undefined') {
  var defined = require('amdefine').define;
}

define(['requirejs', 'localStorage'], function(requirejs, localStorage) {
  var suites = [];

  global.localStorage = localStorage;

  suites.push({
    name: "Without connecting",
    desc: "using remoteStorage methods prior to connecting to a server",
    setup: function(env, test) {
      requirejs([
        './src/remoteStorage',
        './test/helper/root-module',
        './src/lib/store'
      ], function(remoteStorage, root, store) {

        env.remoteStorage = remoteStorage;
        env.root = root;
        env.store = store;

        test.result(true);
      });
    },

    beforeEach: function(env, test) {
      env.remoteStorage.claimAccess('root', 'rw').
        then(function() { test.result(true); });
    },

    afterEach: function(env, test) {
      env.store.forgetAll().
        then(function() { test.result(true); });
    },

    tests: [

      {
        desc: "Storing an object",
        run: function(env, test) {
          return env.root.storeObject('test', 'test-object', { phu: 'quoc' });
        }
      },

      {
        desc: "Storing and retrieving an object",
        run: function(env, test) {
          return env.root.storeObject('test', 'test-object', { phu: 'quoc' }).
            then(function() {
              return env.root.getObject('test-object');
            }).then(function(result) {
              test.assert(result.phu, 'quoc');
            });
        }
      },

      {
        desc: "Retrieving an empty listing",
        run: function(env, test) {
          return env.root.getListing('foo/').
            then(function(listing) {
              test.assert(listing, []);
            });
        }
      },

      {
        desc: "Retrieving an empty collection",
        run: function(env, test) {
          return env.root.getAll('foo/').
            then(function(collection) {
              test.assert(collection, {});
            });
        }
      },

      {
        desc: "Storing some objects, then retrieving them as a collection",
        run: function(env, test) {
          return env.remoteStorage.util.asyncEach(['a', 'b', 'c'], function(x) {
            return env.root.storeObject('test', 'foo/' + x, { x: x });
          }).then(function() {
            return env.root.getAll('foo/');
          }).then(function(collection) {
            test.assert(collection, {
              a: {
                x: 'a',
                '@context': 'http://remotestoragejs.com/spec/modules/root/test'
              },
              b: {
                x: 'b',
                '@context': 'http://remotestoragejs.com/spec/modules/root/test'
              },
              c: {
                x: 'c',
                '@context': 'http://remotestoragejs.com/spec/modules/root/test'
              }
            });
          });
        }
      }

    ]
  });

  return suites;
});
