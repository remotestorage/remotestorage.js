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
        desc: "#get loads a node",
        run: function(env, test) {
          var node = {
            body: 'bar',
            contentType: 'text/plain',
            revision: 'someRev'
          };
          env.ims._storage['/foo'] = node;
          env.ims.get('/foo').then(function(status, body,
                                           contentType, revision) {
            test.assertAnd(status, 200);
            test.assertAnd(body, node.body);
            test.assertAnd(contentType, node.contentType);
            test.assertAnd(revision, node.revision);
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
            test.assertAnd(env.ims._storage['/foo'].path,'/foo');
            test.assertAnd(env.ims._storage['/foo'].contentType,'text/plain');
            test.assertAnd(env.ims._storage['/foo'].body,'bar');
            test.assertAnd(env.ims._storage['/foo'], {path:'/foo',body:'bar',contentType:'text/plain'});
            test.done();
          });
        }
      },

      {
        desc: "#put records a change for outgoing changes",
        run: function(env, test) {
          env.ims.put('/foo/bla', 'basdf', 'text/plain').then(function() {
            test.assert(env.ims._changes['/foo/bla'], {
              action: 'PUT',
              path: '/foo/bla'
            });
          });
        }
      },

      {
        desc: "#put doesn't record a change for incoming changes",
        run: function(env, test) {
          env.ims.put('/foo/bla', 'basdf', 'text/plain', true).then(function() {
            test.assertType(env.ims._changes['/foo/bla'], 'undefined');
          });
        }
      },

      {
        desc: "#put doesn't record a change for incoming changes",
        run: function(env, test) {
          env.ims.put('/foo/bla', 'basdf', 'text/plain', true).then(function() {
            env.ims.delete('/foo/bla', true).then(function() {
              test.assertType(env.ims._changes['/foo/bla'], 'undefined');
            });
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
        desc: "#put fires a 'change' with origin=remote for incoming changes",
        run: function(env, test) {
          env.ims.on('change', function(event) {
            test.assert(event, {
              path: '/foo/bla',
              origin: 'remote',
              oldValue: undefined,
              newValue: 'adsf'
            });
          });
          env.ims.put('/foo/bla', 'adsf', 'text/plain', true);
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
          env.ims.put('/foo/bla', 'basdf', 'text/plain', true).then(function() {
            env.ims.put('/foo/bla', 'fdsab', 'text/plain');
          });
        }
      },

      {
        desc: "#putFolder adds the folder cache node with the given body",
        run: function(env, test) {
          var folderItems = {item1: {'ETag': '123', 'Content-Type': 'text/plain'},
                                'subfolder/': {'ETag': '321'}};

          env.ims.putFolder('/foo/bar/', folderItems).then(function() {
            var cacheNode = env.ims._storage['/foo/bar/'];
            test.assertAnd(cacheNode.body, folderItems);
            test.assertAnd(cacheNode.cached, {});
            test.assertAnd(cacheNode.contentType, 'application/json');
            test.done();
          });
        }
      },

      {
        desc: "#putFolder adds the path to the parents",
        run: function(env, test) {
          var folderItems = {item1: {'ETag': '123', 'Content-Type': 'text/plain'},
                                'subfolder/': {'ETag': '321'}};

          env.ims.putFolder('/foo/bar/', folderItems).then(function() {
            test.assertAnd(env.ims._storage['/foo/'].body['bar/'], true);
            test.assertAnd(env.ims._storage['/'].body['foo/'], true);
            test.done();
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
              test.assertAnd(Object.keys(env.ims._storage), [],
                             'wrong nodes after delete : '+Object.keys(env.ims._storage));
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
                test.assertAnd(Object.keys(env.ims._storage).sort(), ['/', '/foo/', '/foo/baz'], 'wrong nodes after delete '+Object.keys(env.ims._storage).sort());
                test.assertAnd(env.ims._storage['/foo/'], {
                  path: '/foo/',
                  body: {},
                  cached: { 'baz': 'a1b2c3' },
                  contentType: 'application/json'
                }, JSON.stringify(env.ims._storage['/foo/']));
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
      },

      {
        desc: "#setRevision updates `cached` items of parent folders",
        run: function(env, test) {
          env.ims.setRevision('/foo/bar/baz', 'a1b2c3').then(function() {
            test.assertAnd(env.ims._storage['/foo/bar/'], {
              body: {},
              cached: { 'baz': 'a1b2c3' },
              contentType: 'application/json',
              path: '/foo/bar/'
            });

            test.assertAnd(env.ims._storage['/foo/'], {
              body: {},
              cached: { 'bar/': true },
              contentType: 'application/json',
              path: '/foo/'
            }, JSON.stringify( env.ims._storage['/foo/'] ));

            test.assertAnd(env.ims._storage['/'], {
              body: {},
              cached: { 'foo/': true },
              contentType: 'application/json',
              path: '/'
            });

            test.done();
          });
        }
      },

      {
        desc: "#setRevision doesn't overwrite `cached` items in parent folders",
        run: function(env, test) {
          env.ims.setRevision('/foo/bar/baz', 'a1b2c3').then(function() {
            env.ims.setRevision('/foo/bar/booze', 'd4e5f6').then(function() {
              test.assert(env.ims._storage['/foo/bar/'], {
                body: {},
                cached: { 'baz': 'a1b2c3', 'booze': 'd4e5f6' },
                contentType: 'application/json',
                path: '/foo/bar/'
              });
            });
          });
        }
      },

      {
        desc: '#getRevision returns right revision',
        run: function(env, test) {
          env.ims.put('/foo/bar','blablub', 'text/plain', true, '123987').then(function() {
            env.ims.getRevision('/foo/bar').then(function(rev) {
              test.assert(rev, '123987');
            });
          });
        }
      },

      {
        desc: '#changesBelow fulfills with the right changes',
        run: function(env, test) {
          env.ims._changes = {'/foo/': true,
                              '/foo/bar/': true,
                              '/foo/bar/baz': true,
                              '/foo/baz': true,
                              '/foobar/': false,
                              '/foobar/baz': false,
                              '/a': false,
                              '/b/' : false,
                              '/b/foo/': false};
          env.ims.changesBelow('/foo/').then(function(changes) {
            changes.forEach(function(val) {
              test.assertAnd(val, true);
            });
            test.assertAnd(changes.length, 4, 'wrong ammount found '+changes.length);
            test.done();
          });
        }
      },

      {
        desc: "#setConflict emits conflicy event",
        run: function(env, test) {
          env.ims.on('conflict', function(event) {
            test.assertTypeAnd(event.resolve, 'function');
            test.assertAnd(event.remoteAction, 'foo');
            test.assertAnd(event.localAction, 'bar');
            test.assertAnd(event.path, '/foobar');
            test.done();
          });
          env.ims.setConflict('/foobar', { remoteAction: 'foo', localAction: 'bar' });
        }
      },

      {
        desc: "#setConflict event.resolve emits Error when resolved wrong",
        run: function(env, test) {
          env.ims.on('conflict', function(event) {
            var success = false;
            var err = 'no error';
            try {
              event.resolve('nonsense');
            } catch(e) {
              if (e.message === 'Invalid resolution: nonsense') {
                success = true;
              }
              err = e;
            }
            test.assertAnd(success, true, "yielded : " + JSON.stringify(err));
            test.done();
          });
          env.ims.setConflict('/foobar', { remoteAction: 'foo', localAction: 'bar' });
        }
      },

      {
        desc: "#setConflict event resolve records Changes after beeing resolved",
        run: function(env, test) {
          env.ims.on('conflict', function(event) {
            event.resolve('remote');
            test.assertAnd(env.ims._changes['/foobar'],
                           { conflict:
                             { remoteAction: 'PUT',
                               localAction: 'DELETE',
                               resolution: 'remote' },
                             path: '/foobar' });
            test.done();
          });
          env.ims.setConflict('/foobar', {remoteAction: 'PUT', localAction: 'DELETE'});
        }
      }
    ]
  });

  return suites;
});
