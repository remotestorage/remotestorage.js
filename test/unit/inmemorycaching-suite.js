if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  suites.push({
    name: 'InMemoryStorage',
    desc: 'inmemory caching as a fallback for indexdb and localstorage',
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
        desc: "#put adds node to parents",
        run: function(env, test) {
          env.ims.put('/foo', 'bar', 'text/plain').then(function(status) {
            test.assertAnd(status, 200);
            test.assertAnd(env.ims._storage['/'].path, '/');
            test.assertAnd(env.ims._storage['/'].local.itemsMap, {
              'foo': true
            });
            test.done();
          });
        }
      },

      {
        desc: "#get loads a node from local",
        run: function(env, test) {
          var node = {
            path: '/foo',
            local: {
              body: 'bar',
              contentType: 'text/plain',
              revision: 'someRev'
            }
          };
          env.ims._storage['/foo'] = node;
          env.ims.get('/foo').then(function(status, body,
                                           contentType) {
            test.assertAnd(status, 200);
            test.assertAnd(body, node.local.body);
            test.assertAnd(contentType, node.local.contentType);
            test.done();
          });
        }
      },

      {
        desc: "#get loads a node from official",
        run: function(env, test) {
          var node = {
            path: '/foo',
            official: {
              body: 'bar',
              contentType: 'text/plain',
              revision: 'someRev'
            }
          };
          env.ims._storage['/foo'] = node;
          env.ims.get('/foo').then(function(status, body,
                                           contentType) {
            test.assertAnd(status, 200);
            test.assertAnd(body, node.official.body);
            test.assertAnd(contentType, node.official.contentType);
            test.done();
          });
        }
      },

      {
        desc: "#get yields 404 when it doesn't find a node",
        run: function(env, test) {
          env.ims.get('/bar').then(function(status) {
            test.assert(status,404);
          });
        }
      },

      {
        desc: "#put yields 200 and stores the node",
        run: function(env, test) {
          env.ims.put('/foo', 'bar', 'text/plain').then(function(status) {
            test.assertAnd(status, 200);
            test.assertAnd(env.ims._storage['/foo'].path, '/foo');
            test.assertAnd(env.ims._storage['/foo'].local.contentType,'text/plain');
            test.assertAnd(env.ims._storage['/foo'].local.body,'bar');
            test.done();
          });
        }
      },

      {
        desc: "#put adds node to parents",
        run: function(env, test) {
          env.ims.put('/foo', 'bar', 'text/plain').then(function(status) {
            test.assertAnd(status, 200);
            test.assertAnd(env.ims._storage['/'].path, '/');
            test.assertAnd(env.ims._storage['/'].local.itemsMap, {
              'foo': true
            });
            test.done();
          });
        }
      },

      {
        desc: "#put fires a 'change' with origin=window for outgoing changes",
        timeout: 250,
        run: function(env, test) {
          env.ims.on('change', function(event) {
            test.assert(event, {
              path: '/foo/bla',
              origin: 'window',
              oldValue: undefined,
              newValue: 'basdf'
            });
          });
          env.ims.put('/foo/bla', 'basdf', 'text/plain');
        }
      },

      {
        desc: "#put attaches the newValue and oldValue correctly for updates",
        run: function(env, test) {
          var i = 0;
          env.ims.on('change', function(event) {
            i++;
            if (i === 1) {
              test.assertAnd(event, {
                path: '/foo/bla',
                origin: 'window',
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
          env.ims.put('/foo/bla', 'basdf', 'text/plain').then(function() {
            env.ims.put('/foo/bla', 'fdsab', 'text/plain');
          });
        }
      },

      {
        desc: "#delete removes the node and empty parents",
        run: function(env, test) {
          env.ims.put('/foo/bar/baz', 'bla', 'text/pain', 'a1b2c3').then(function() {
            var storageKeys = ['/foo/bar/baz', '/foo/bar/', '/foo/', '/'];
            test.assertAnd(Object.keys(env.ims._storage), storageKeys);

            env.ims.delete('/foo/bar/baz').then(function(status) {
              test.assertAnd(status, 200, 'wrong status code: '+status); //TODO belongs in seperate test
              test.assertAnd(env.ims._getInternals()._getLatest(env.ims._storage['/foo/bar/baz']), undefined);
              test.assertAnd(env.ims._getInternals()._getLatest(env.ims._storage['/foo/bar/']), undefined);
              test.assertAnd(env.ims._getInternals()._getLatest(env.ims._storage['/foo/']), undefined);
              test.assertAnd(env.ims._getInternals()._getLatest(env.ims._storage['/']), undefined);
              test.done();
            });
          });
        }
      },

      {
        desc: "#delete doesn't remove nonempty nodes",
        run: function(env, test) {
          env.ims.put('/foo/bar/baz', 'bla', 'text/pain', true, 'a1b2c3').then(function() {
            env.ims.put('/foo/baz', 'bla', 'text/pain', true, 'a1b2c3').then(function() {
              env.ims.delete('/foo/bar/baz').then(function(status) {
                console.log('after deletion', env.ims._storage);
                test.assertAnd(env.ims._getInternals()._getLatest(env.ims._storage['/']).itemsMap, {
                  'foo/': true
                });
                test.assertAnd(env.ims._getInternals()._getLatest(env.ims._storage['/foo/']).itemsMap, {
                  'baz': true
                });
                test.assertAnd(env.ims._getInternals()._getLatest(env.ims._storage['/foo/baz']).body, 'bla');
                test.assertAnd(env.ims._getInternals()._getLatest(env.ims._storage['/foo/baz']).contentType,
                    'text/plain');
                test.done();
              });
            });
          });
        }
      },

      {
        desc: "#delete propagates changes through empty folders",
        run: function(env, test) {
          env.ims.put('/foo/bar/baz', 'bla', 'text/pain', 'a1b2c3').then(function() {
            env.ims.put('/foo/baz', 'bla', 'text/pain', 'a1b2c3').then(function() {
              env.ims.delete('/foo/bar/baz').then(function(status) {
                test.assert(env.ims._storage['/'].cached['foo/'], true);
              });
            });
          });
        }
      },

      {
        desc: "#delete records a change for outgoing changes",
        run: function(env, test) {
          env.ims.put('/foo/bla', 'basdf', 'text/plain', true, 'a1b2c3').then(function() {
            env.ims.delete('/foo/bla').then(function() {
              test.assert(env.ims._changes['/foo/bla'], {
                action: 'DELETE',
                path: '/foo/bla'
              });
            });
          });
        }
      }
    ]
  });

  return suites;
});
