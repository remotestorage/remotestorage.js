if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs'], function (Promise, requirejs) {
  global.Promise = Promise;

  var suites = [];

  suites.push({
    name: 'InMemoryStorage',
    desc: 'In-memory caching layer',

    setup: function (env, test) {
      global.RemoteStorage = function () {};
      global.RemoteStorage.log = function () {};
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

      require('src/inmemorystorage.js');
      if (global.rs_ims) {
        RemoteStorage.InMemoryStorage = global.rs_ims;
      } else {
        global.rs_ims = RemoteStorage.InMemoryStorage;
      }

      env.rs = new RemoteStorage();
      env.rs.local = new RemoteStorage.InMemoryStorage();
      global.remoteStorage = env.rs;
      test.done();
    },

    beforeEach: function (env, test) {
      env.ims = new RemoteStorage.InMemoryStorage();
      test.done();
    },

    tests: [
      {
        desc: "#get loads a node from local",
        run: function (env, test) {
          var node = {
            path: '/foo',
            local: { body: 'bar', contentType: 'text/plain', revision: 'someRev' }
          };
          env.ims._storage['/foo'] = node;

          env.ims.get('/foo').then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, node.local.body);
            test.assertAnd(r.contentType, node.local.contentType);
            test.done();
          });
        }
      },

      {
        desc: "#get loads a node from common",
        run: function (env, test) {
          var node = {
            path: '/foo',
            common: { body: 'bar', contentType: 'text/plain', revision: 'someRev' }
          };
          env.ims._storage['/foo'] = node;

          env.ims.get('/foo').then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, node.common.body);
            test.assertAnd(r.contentType, node.common.contentType);
            test.done();
          });
        }
      },

      {
        desc: "#get yields 404 when it doesn't find a node",
        run: function (env, test) {
          env.ims.get('/bar').then(function (r) {
            test.assert(r.statusCode,404);
          });
        }
      },

      {
        desc: "#get gets queued as a sync request if its maxAge param cannot be satisfied because no node exists",
        run: function (env, test) {
          var requestQueued = false;

          env.rs.sync = {
            queueGetRequest: function (path) {
              test.assertAnd(path, '/foo');
              requestQueued = true;
              return Promise.resolve({statusCode: 200, body: 'asdf', contentType: 'qwer'});
            }
          };

          env.rs.local.get('/foo', 100, env.rs.sync.queueGetRequest.bind(env.rs.sync)).then(function (r) {
            test.assertAnd(requestQueued, true);
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, 'asdf');
            test.assertAnd(r.contentType, 'qwer');
            test.done();
          });
        }
      },

      {
        desc: "#get removes falsy items from local version itemsMap",
        run: function (env, test) {
          var requestQueued = false;
          var oldTimestamp = (new Date().getTime()) - 1000;

          env.rs.local._storage['/'] = {
            path: '/',
            common: {
              itemsMap: { foo: true, bar: true },
              timestamp: oldTimestamp,
              revision: '123'
            },
            local: {
              itemsMap: { foo: true, bar: false },
              timestamp: oldTimestamp,
              revision: '123'
            }
          };
          env.rs.local.get('/', false).then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, { foo: true });
            test.done();
          });
        }
      },

      {
        desc: "#get gets queued as a sync request if node is older than the maxAge",
        run: function (env, test) {
          var requestQueued = false;
          var oldTimestamp = (new Date().getTime()) - 1000;

          env.rs.local._storage['/'] = {
            path: '/',
            common: {
              itemsMap: { foo: true },
              timestamp: oldTimestamp,
              revision: '123'
            }
          };

          env.rs.local._storage['/foo'] = {
            path: '/foo',
            common: {
              timestamp: oldTimestamp,
              body: 'old body',
              contentType: 'text/old',
              revision: '123'
            }
          };

          env.rs.sync = {
            queueGetRequest: function (path) {
              test.assertAnd(path, '/foo');
              requestQueued = true;
              return Promise.resolve({statusCode: 200, body: 'new body', contentType: 'text/new'});
            }
          };

          env.rs.local.get('/foo', 100, env.rs.sync.queueGetRequest.bind(env.rs.sync)).then(function (r) {
            test.assertAnd(requestQueued, true);
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, 'new body');
            test.assertAnd(r.contentType, 'text/new');
            test.done();
          });
        }
      },

      {
        desc: "#get returns local data if it's newer than the maxAge param",
        run: function (env, test) {
          env.rs.local._storage['/note'] = {
            path: '/note',
            common: {
              timestamp: new Date().getTime(),
              body: 'cached note',
              contentType: 'text/plain',
              revision: '123'
            }
          };

          env.rs.sync = {
            queueGetRequest: function (path) {
              test.result(false, 'should have been served from local cache');
            }
          };

          env.rs.local.get('/note', 10000).then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, 'cached note');
            test.assertAnd(r.contentType, 'text/plain');
            test.done();
          });
        }
      },

      {
        desc: "#get rejects the promise when there is an error reading the local data",
        run: function (env, test) {
          env.rs.local.getNodes = function (paths) {
            return Promise.reject('Could not read local data');
          };

          env.rs.local.get('/note').then(function (r) {
            test.result(false);
          }, function (error) {
            test.assert('Could not read local data', error);
          });
        }
      },

      {
        desc: "#put yields 200 and stores the node",
        run: function (env, test) {
          env.ims.put('/foo', 'bar', 'text/plain').then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(env.ims._storage['/foo'].path, '/foo');
            test.assertAnd(env.ims._storage['/foo'].local.contentType,'text/plain');
            test.assertAnd(env.ims._storage['/foo'].local.body,'bar');
            test.done();
          });
        }
      },

      {
        desc: "#put adds node to parents",
        run: function (env, test) {
          env.ims.put('/foo', 'bar', 'text/plain').then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(env.ims._storage['/'].path, '/');
            test.assertAnd(env.ims._storage['/'].local.itemsMap, {'foo': true});
            test.done();
          });
        }
      },

      {
        desc: "#put fires a 'change' with origin=window for outgoing changes",
        timeout: 250,
        run: function (env, test) {
          RemoteStorage.config.changeEvents.window = true;
          env.ims.on('change', function (event) {
            test.assert(event, {
              path: '/foo/bla',
              origin: 'window',
              oldValue: undefined,
              newValue: 'basdf',
              oldContentType: undefined,
              newContentType: 'text/plain'
            });
          });
          env.ims.put('/foo/bla', 'basdf', 'text/plain');
        }
      },

      {
        desc: "#put attaches the newValue and oldValue correctly for updates",
        run: function (env, test) {
          var i = 0;

          env.ims.on('change', function (event) {
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
              setTimeout(function () {
                test.done();
              }, 0);
            } else {
              console.error("UNEXPECTED THIRD CHANGE EVENT");
              test.result(false);
            }
          });

          env.ims.put('/foo/bla', 'basdf', 'text/plain').then(function () {
            env.ims.put('/foo/bla', 'fdsab', 'text/plain');
          });
        }
      },

      {
        desc: "#delete removes the node and empty parents",
        run: function (env, test) {
          var storage = env.ims._storage;
          var getLatest = env.ims._getInternals().getLatest;

          return env.ims.put('/foo/bar/baz', 'bla', 'text/plain', 'a1b2c3').then(function (r) {
            console.log('response: ', r);
            var storageKeys = ['/foo/bar/baz', '/foo/bar/', '/foo/', '/'];

            test.assertAnd(Object.keys(storage), storageKeys);

            return env.ims.delete('/foo/bar/baz').then(function (r) {
              test.assertAnd(r.statusCode, 200, 'Wrong statusCode: '+r.statusCode); //TODO belongs in seperate test
              test.assertAnd(getLatest(storage['/foo/bar/baz']), undefined);
              test.assertAnd(getLatest(storage['/foo/bar/']).itemsMap, {});
              test.assertAnd(getLatest(storage['/foo/']).itemsMap, {});
              test.assertAnd(getLatest(storage['/']).itemsMap, {});
              test.done();
            });
          });
        }
      },

      {
        desc: "#delete emits change event",
        run: function (env, test) {
          return env.ims.put('/foo/bar/baz', 'bla', 'text/plain', 'a1b2c3').then(function () {

            env.ims.on('change', function (event) {
              test.assert(event, {
                path: '/foo/bar/baz',
                origin: 'window',
                oldValue: 'bla',
                oldContentType: 'text/plain',
                newValue: undefined,
                newContentType: undefined
              });
            });

            return env.ims.delete('/foo/bar/baz');
          });
        }
      },

      {
        desc: "#delete doesn't remove nonempty nodes",
        run: function (env, test) {
          var storage = env.ims._storage;
          var getLatest = env.ims._getInternals().getLatest;

          return env.ims.put('/foo/bar/baz', 'bla', 'text/plain', true, 'a1b2c3').then(function () {
            return env.ims.put('/foo/baz', 'bla', 'text/plain', true, 'a1b2c3').then(function () {
              return env.ims.delete('/foo/bar/baz').then(function (status) {
                test.assertAnd(getLatest(storage['/']).itemsMap, { 'foo/': true });
                test.assertAnd(getLatest(storage['/foo/']).itemsMap, { 'baz': true });
                test.assertAnd(getLatest(storage['/foo/baz']).body, 'bla');
                test.assertAnd(getLatest(storage['/foo/baz']).contentType, 'text/plain');
                test.done();
              });
            });
          });
        }
      },

      {
        desc: "#delete propagates changes through empty folders",
        run: function (env, test) {
          return env.ims.put('/foo/bar/baz', 'bla', 'text/plain', 'a1b2c3').then(function () {
            return env.ims.put('/foo/baz', 'bla', 'text/plain', 'a1b2c3').then(function () {
              return env.ims.delete('/foo/bar/baz').then(function (status) {
                test.assert(env.ims._storage['/'].local.itemsMap, {'foo/': true});
              });
            });
          });
        }
      },

      {
        // TODO belongs in separate examples; missing description
        desc: "getNodes, setNodes",
        run: function (env, test) {
          return env.ims.getNodes(['/foo/bar/baz']).then(function (objs) {
            test.assertAnd(objs, {'/foo/bar/baz': undefined});
          }).then(function () {
            return env.ims.setNodes({
              '/foo/bar': {
                path: '/foo/bar',
                common: { body: 'asdf' }
              }
            });
          }).then(function () {
            return env.ims.getNodes(['/foo/bar', '/foo/bar/baz']);
          }).then(function (objs) {
            test.assertAnd(objs, {
              '/foo/bar/baz': undefined,
              '/foo/bar': {
                path: '/foo/bar',
                common: { body: 'asdf' }
              }
            });
          }).then(function () {
            return env.ims.setNodes({
              '/foo/bar/baz': {
                path: '/foo/bar/baz/',
                common: { body: 'qwer' }
              },
              '/foo/bar': undefined
            });
          }).then(function () {
            return env.ims.getNodes(['/foo/bar', '/foo/bar/baz']);
          }).then(function (objs) {
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
      },

      {
        desc: "fireInitial leads to local-events-done event",
        run: function (env, test) {
          env.ims.on('local-events-done', function () {
            test.done();
          });
          env.ims.fireInitial();
        }
      }
    ]
  });

  return suites;
});
