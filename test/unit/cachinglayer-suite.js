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
      test.done();
    },

    beforeEach: function(env, test) {
      env.ims = new RemoteStorage.InMemoryStorage();
      test.done();
    },

    tests: [
      {
        desc: "_getLatest gets the right version",
        run: function(env, test) {
          var localNode = {
            local: {
              body: 'b',
              contentType: 'c'
            },
            official: {
              foo: 'bar'
            },
            push: {
              foo: 'bar'
            },
            remote: {
              foo: 'bar'
            }
          },
          officialNode = {
            official: {
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
          };
          test.assertAnd(env.ims._getInternals()._getLatest(localNode).body, 'b');
          test.assertAnd(env.ims._getInternals()._getLatest(localNode).contentType, 'c');
          test.assertAnd(env.ims._getInternals()._getLatest(officialNode).body, 'b');
          test.assert(env.ims._getInternals()._getLatest(officialNode).contentType, 'c');
        }
      },
    ]
  });

  return suites;
});
