if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs', 'localStorage'], function(requirejs, localStorage) {

  var suites = [];

  global.localStorage = localStorage;

  var util, curry;

  suites.push({
    name: "sync requests",
    desc: "verify requests that sync performs in various situations",

    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/remoteStorage',
        './server/nodejs-example',
        './test/helper/server',
        './src/modules/root'
      ], function(_util, remoteStorage, nodejsExampleServer, serverHelper, root) {
        util = _util;
        curry = util.curry;
        env.remoteStorage = remoteStorage;
        env.serverHelper = serverHelper;

        env.client = root;

        util.extend(env.serverHelper, nodejsExampleServer.server);

        env.serverHelper.disableLogs();

        env.serverHelper.start(function() {
          _this.result(true);
        });
      });
    },

    takedown: function(env) {
      var _this = this;
      env.serverHelper.stop(function() {
        _this.result(true);
      });
    },

    beforeEach: function(env) {
      var _this = this;

      env.serverHelper.resetState();
      env.serverHelper.setScope([':rw']);
      env.serverHelper.captureRequests();

      env.rsConnect = function() {
        env.remoteStorage.nodeConnect.setStorageInfo(
          env.serverHelper.getStorageInfo()
        );
        env.remoteStorage.nodeConnect.setBearerToken(
          env.serverHelper.getBearerToken()
        );

        return env.remoteStorage.claimAccess('root', 'rw');
      };

      env.rsConnect().
        then(function() {
          _this.result(true);
        });
    },
    
    afterEach: function(env, test) {
      env.remoteStorage.flushLocal().then(curry(test.result.bind(test), true));
    },
    
    tests: [

      {
        desc: "Simple outgoing requests",
        run: function(env) {
          var _this = this;
          return env.client.storeObject('test', 'testobj', { hello: 'world' }).
            then(function() {
              // check current version (we haven't done initial sync)
              env.serverHelper.expectRequest(
                _this, 'GET', 'me/'
              );
              env.serverHelper.expectRequest(
                _this, 'GET', 'me/testobj'
              );
              // update remote data
              env.serverHelper.expectRequest(
                _this, 'PUT', 'me/testobj',
                JSON.stringify({ 
                  'hello': 'world',
                  '@context': 'http://remotestoragejs.com/spec/modules/root/test'
                })
              );
              // fetch timestamp from parent
              env.serverHelper.expectRequest(
                _this, 'GET', 'me/'
              );

              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            });
        }
      },

      {
        desc: "Incoming data",
        run: function(env) {
          var _this = this;
          // push initial data to the server:
          util.asyncEach([1,2,3,4,5], function(i) {
            return env.client.storeObject('test', 'obj-' + i, { i: i })
          }).
            then(env.remoteStorage.flushLocal).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            then(env.remoteStorage.fullSync).
            then(function() {
              // initial root request
              env.serverHelper.expectRequest(_this, 'GET', 'me/');
              // requests for each object
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-1');
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-2');
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-3');
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-4');
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-5');

              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            });
        }
      },

      {
        desc: "Syncing trees w/ data",
        run: function(env) {
          util.silenceAllLoggers();
          util.unsilenceLogger('sync');
          var _this = this;
          // push initial tree ( a/{1,2,3} and b/{1,2,3} ):
          util.asyncEach(['a', 'b'], function(d) {
            return util.asyncEach([1,2,3], function(i) {
              return env.client.storeObject('test', d + '/obj-' + i, { d: d, i: i });
            })
          }).
            then(env.remoteStorage.fullSync).
            // dis- and reconnect
            then(env.remoteStorage.flushLocal).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            // release root (which was set up by claimAccess):
            then(curry(env.client.release, '')).
            // use /a/, but not /b/
            then(curry(env.client.use, 'a/')).
            // do a full sync
            then(curry(env.remoteStorage.fullSync)).
            then(function() {
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-1');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-2');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-3');
              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            });
        }
      },

      {
        desc: "store file, then store it again, then retrieve it",
        run: function(env) {
          var _this = this;
          env.client.storeFile('text/plain', 'note.txt', 'foo').
            then(curry(env.client.storeFile, 'text/plain', 'note.txt', 'bar')).
            then(curry(env.client.getFile, 'note.txt')).
            then(function(file) {
              _this.assertAnd(file.mimeType, 'text/plain');
              _this.assert(file.data, 'bar');
            });
        }
      },

      {
        desc: "store object, then check requests",
        run: function(env) {
          var _this = this;
          env.client.storeObject('test', 'test-dir/obj', { phu: 'quoc' }).
            then(function() {
              env.serverHelper.expectRequest(_this, 'GET', 'me/test-dir/');
              env.serverHelper.expectRequest(_this, 'GET', 'me/test-dir/obj');
              env.serverHelper.expectRequest(_this, 'PUT', 'me/test-dir/obj', '{"phu":"quoc","@context":"http://remotestoragejs.com/spec/modules/root/test"}');
              env.serverHelper.expectRequest(_this, 'GET', 'me/test-dir/');
              env.serverHelper.expectNoMoreRequest(_this);
              _this.assert(true, true);
            });
        }
      },

      {
        desc: "store file with plain text",
        run: function(env, test) {
          env.client.storeFile('text/plain', 'text-file', 'some text').
            then(function() {
              env.serverHelper.expectRequest(test, 'GET', 'me/');
              env.serverHelper.expectRequest(test, 'GET', 'me/text-file');
              env.serverHelper.expectRequest(test, 'PUT', 'me/text-file', 'some text');
              env.serverHelper.expectRequest(test, 'GET', 'me/');
              env.serverHelper.expectNoMoreRequest(test);
              test.assert(true, true);
            });
        }
      },

      {
        desc: "store empty file",
        run: function(env) {
          var _this = this;
          env.client.storeFile('text/plain', 'empty-file', '').
            then(function() {
              env.serverHelper.expectRequest(_this, 'GET', 'me/');
              env.serverHelper.expectRequest(_this, 'GET', 'me/empty-file');
              env.serverHelper.expectRequest(_this, 'PUT', 'me/empty-file', '');
              env.serverHelper.expectRequest(_this, 'GET', 'me/');
              env.serverHelper.expectNoMoreRequest(_this);
              _this.assert(true, true);
            });
        }
      },

      {
        desc: "store public data",
        run: function(env, test) {
          util.unsilenceLogger('sync');
          util.setLogLevel('debug');
          env.client.storeFile('text/plain', '/public/foo', 'bar').
            then(function() {
              env.serverHelper.expectRequest(test, 'GET', 'me/public/');
              env.serverHelper.expectRequest(test, 'GET', 'me/public/foo');
              env.serverHelper.expectRequest(test, 'PUT', 'me/public/foo', 'bar');
              env.serverHelper.expectRequest(test, 'GET', 'me/public/');
              env.serverHelper.expectNoMoreRequest(test);
              test.assert(true, true);
            });
        }
      },

      {
        desc: "change events with outgoing changes",
        run: function(env, test) {
          var receivedEvents = [];
          env.client.on('change', function(event) {
            receivedEvents.push(event);
          });

          function expectEvent(expected) {
            var rel = receivedEvents.length;
            var matching, matchIndex;
            for(var i=0;i<rel;i++) {
              var e = receivedEvents[i];
              for(var key in expected) {
                if(e[key] !== expected[key]) {
                  continue;
                }
              }
              matching = e;
              matchIndex = i;
              break;
            }
            test.assertTypeAnd(matching, 'object', "No event found matching: " + JSON.stringify(expected));
            if(matching) {
              receivedEvents.splice(matchIndex, 1);
            }
          }

          env.client.storeObject('test', 'foo/bar/test-obj', { phu: 'quoc' }).
            then(function() {
              expectEvent({
                origin: 'window',
                path: 'foo/bar/test-obj',
                oldValue: undefined,
                newValue: { phu: 'quoc', '@context': 'http://remotestoragejs.com/spec/modules/root/test' }
              });
              test.assert(receivedEvents, [], "There are still events in the queue: " + JSON.stringify(receivedEvents));
            });
        }
      },

      {
        desc: "getting an object with tree-only sync",
        run: function(env, test) {
          // store the file first
          return env.client.getObject('locations/hackerbeach/2013').
            then(function(obj) {
              return env.client.storeObject('test', 'locations/hackerbeach/2013', { island: "Phu Quoc" });
            }).
            // disconnect client
            then(env.remoteStorage.flushLocal).
            // reconnect client
            then(env.rsConnect).
            then(function() {
              // configure tree-only sync
              return env.client.use('', true);
            }).
            then(env.remoteStorage.fullSync).
            then(function() {
              return env.client.getListing('locations/hackerbeach/');
            }).
            then(function(listing) {
              // verify listing
              test.assertAnd(listing, ['2013']);
            }).
            then(function() {
              return env.client.getObject('locations/hackerbeach/2013');
            }).
            then(function(obj) {
              // verify file
              test.assert({
                island: "Phu Quoc",
                '@context': 'http://remotestoragejs.com/spec/modules/root/test'
              }, obj, "got object: " + JSON.stringify(obj));
            });
        }
      },

      {
        desc: "getting a file with tree-only sync",
        run: function(env, test) {
          // store the file first
          return env.client.storeFile('text/plain', 'locations/hackerbeach/2013', 'Phu Quoc Island').
            // disconnect client
            then(env.remoteStorage.flushLocal).
            // reconnect client
            then(env.rsConnect).
            then(function() {
              // configure tree-only sync
              return env.client.use('', true);
            }).
            then(env.remoteStorage.fullSync).
            then(function() {
              return env.client.getListing('locations/hackerbeach/');
            }).
            then(function(listing) {
              // verify listing
              test.assertAnd(listing, ['2013']);
            }).
            then(function() {
              return env.client.getFile('locations/hackerbeach/2013');
            }).
            then(function(file) {
              // verify file
              test.assert({
                mimeType: 'text/plain',
                data: 'Phu Quoc Island'
              }, file, "got object: " + JSON.stringify(file));
            });
        }
      },

      {
        desc: "getting a listing with no forced sync at all",
        run: function(env, test) {
          return env.client.storeFile('text/plain', 'locations/hackerbeach/2013', 'Phu Quoc Island').
            then(env.remoteStorage.flushLocal).
            then(env.rsConnect).
            then(function() {
              return env.client.release('');
            }).
            then(function() {
              return env.client.getListing('locations/hackerbeach/');
            }).
            then(function(listing) {
              test.assert(listing, ['2013']);
            });
        }
      },

      {
        desc: "getting an empty dir with tree-force enabled doesn't cause a request",
        run: function(env, test) {
          return env.remoteStorage.fullSync().
            then(function() {
              env.serverHelper.clearCaptured();
              return env.client.getListing('locations/hackerbeach/');
            }).
            then(function() {
              env.serverHelper.expectNoMoreRequest(test);
            });
        }
      },

      {
        desc: "storing a file directly to remote, without local caching",
        run: function(env, test) {
          return env.client.storeFile('text/plain', 'greetings/default', 'Hello World!', false).
            then(function() {
              // check requests
              env.serverHelper.expectRequest(test, 'PUT', 'me/greetings/default', 'Hello World!');
              env.serverHelper.expectNoMoreRequest(test);
              // check node is set to pending
              return env.remoteStorage.store.getNode('/greetings/default');
            }).
            then(function(node) {
              test.assert(node.pending, true);
            });
        }
      },

      {
        desc: "storing a file w/o caching, then listing & getting",
        run: function(env, test) {
          return env.client.release('/').
            then(function() {
              return env.client.storeFile('text/plain', 'greetings/default', 'Hello World!', false);
            }).
            then(function() {
              env.serverHelper.expectRequest(test, 'PUT', 'me/greetings/default', 'Hello World!');
              env.serverHelper.expectNoMoreRequest(test);
              return env.remoteStorage.store.getNode('/greetings/');
            }).
            then(function(dirNode) {
              console.log('dirNode', dirNode);
              // check that dirNode is pending
              test.assertAnd(dirNode.pending, true, "expected dir node to be pending, but it isn't");
              return env.client.getListing('greetings/');
            }).
            then(function(listing) {
              env.serverHelper.expectRequest(test, 'GET', 'me/greetings/');
              env.serverHelper.expectNoMoreRequest(test);
              test.assertAnd(listing, ['default']);
              return env.client.getFile('greetings/default');
            }).
            then(function(file) {
              env.serverHelper.expectRequest(test, 'GET', 'me/greetings/default');
              env.serverHelper.expectNoMoreRequest(test);
              test.assert(file, { mimeType: 'text/plain', data: 'Hello World!' });
            });
        }
      },

      {
        desc: "using, then releasing, then getting listing, then getting files",
        run: function(env, test) {
          // setup some files
          return util.asyncEach(['a', 'b', 'c'], function(name) {
            return env.client.storeFile('text/plain', 'test/' + name,
                                        'content-' + name);
          }).
            then(function(results, errors) {
              if(errors.length > 0) {
                console.error("storing failed", errors);
                test.result(false);
                return;
              }
              // sync
              return env.remoteStorage.fullSync();
            }).
              // logout & log in again
            then(env.remoteStorage.flushLocal).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            then(function() {
              // release root
              return env.client.release('');
            }).
            then(function() {
              // use test/ (creates dir node, but doesn't populate it)
              return env.client.use('test/');
            }).
            then(function() {
              // release test/ again
              return env.client.release('test/');
            }).
            then(function() {
              // get listing
              return env.client.getListing('test/');
            }).
            then(function(listing) {
              // verify listing
              test.assertAnd(listing.sort(), ['a', 'b', 'c']);
              // get file
              return env.client.getFile('test/a');
            }).
            then(function(file) {
              // verify file
              test.assert(file, { mimeType: 'text/plain', data: 'content-a' });
            });
        }
      }
 
    ]
  });

  return suites;

});
