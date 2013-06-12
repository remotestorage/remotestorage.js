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
        './test/helper/root-module'
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
      env.serverHelper.resetState();
      env.serverHelper.setScope([':rw']);
      env.serverHelper.captureRequests();

      env.rsDisconnect = function() {
        return env.remoteStorage.flushLocal(true);
      }

      env.rsConnect = function() {
        storageInfo = env.serverHelper.getStorageInfo();
        env.remoteStorage.setStorageInfo(
          storageInfo
        );
        env.remoteStorage.setBearerToken(
          env.serverHelper.getBearerToken()
        );

        env.remoteStorage.access.setStorageType(
          storageInfo.type
        );

        env.remoteStorage.claimAccess('root', 'rw');

        console.log('in rsConnect, wireClient state: ', env.remoteStorage.wireClient.getState());
      };

      env.rsConnect();
      console.log('end of beforeEach, state:', 'CACHING', env.remoteStorage.caching, 'ACCESS', env.remoteStorage.access);

      this.result(true);
    },
    
    afterEach: function(env, test) {
      env.rsDisconnect().then(curry(test.result.bind(test), true));
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            then(env.rsDisconnect).
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
            });
        }
      },

      {
        desc: "Syncing trees w/ data",
        run: function(env) {
          var _this = this;
          // push initial tree ( a/{1,2,3} and b/{1,2,3} ):
          util.asyncEach(['a', 'b'], function(d) {
            return util.asyncEach([1,2,3], function(i) {
              return env.client.storeObject('test', d + '/obj-' + i, { d: d, i: i });
            })
          }).
            then(env.remoteStorage.fullSync).
            // dis- and reconnect
            then(env.rsDicsonnect).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            // release root (which was set up by claimAccess):
            then(curry(env.client.release, '')).
            // use /a/, but not /b/
            then(curry(env.client.use, 'a/')).
            then(function() {
              console.log('CACHING', env.remoteStorage.caching);
              env.remoteStorage.util.unsilenceLogger('sync');
            }).
            // do a full sync
            then(curry(env.remoteStorage.fullSync)).
            then(function() {
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-1');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-2');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-3');
              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
            });
        }
      },

      {
        desc: "store public data",
        run: function(env, test) {
          env.client.storeFile('text/plain', 'public/foo', 'bar').
            then(function() {
              env.serverHelper.expectRequest(test, 'GET', 'me/public/');
              env.serverHelper.expectRequest(test, 'GET', 'me/public/foo');
              env.serverHelper.expectRequest(test, 'PUT', 'me/public/foo', 'bar');
              env.serverHelper.expectRequest(test, 'GET', 'me/public/');
              env.serverHelper.expectNoMoreRequest(test);
              test.assert(true, true);
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
            });
        }
      },

      {
        desc: "getting an object with tree-only sync",
        run: function(env, test) {
          // store the file first
          return env.remoteStorage.fullSync().
            then(function(obj) {
              return env.client.storeObject('test', 'locations/hackerbeach/2013', { island: "Phu Quoc" });
            }).
            // disconnect client
            then(env.rsDisconnect).
            then(function() {
              // reconnect client
              env.rsConnect();
              // configure tree-only sync
              env.client.use('', true);
              // synchronize
              return env.remoteStorage.fullSync();
            }).
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
            });
        }
      },

      {
        desc: "getting a file with tree-only sync",
        run: function(env, test) {
          // store the file first
          return env.remoteStorage.fullSync().
            then(function() {
              return env.client.storeFile('text/plain', 'locations/hackerbeach/2013', 'Phu Quoc Island')
            }).
            // disconnect client
            then(env.rsDisconnect).
            then(function() {
              // reconnect client
              env.rsConnect();
              // configure tree-only sync
              env.client.use('', true);
              // synchronize
              return env.remoteStorage.fullSync();
            }).
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
            });
        }
      },

      {
        desc: "getting a listing with no forced sync at all",
        run: function(env, test) {
          return env.client.storeFile('text/plain', 'locations/hackerbeach/2013', 'Phu Quoc Island').
            then(env.rsDicsonnect).
            then(env.rsConnect).
            then(function() {
              return env.client.release('');
            }).
            then(function() {
              return env.client.getListing('locations/hackerbeach/');
            }).
            then(function(listing) {
              test.assert(listing, ['2013']);
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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

              // required to update local version
              env.serverHelper.expectRequest(test, 'GET', 'me/greetings/');

              env.serverHelper.expectNoMoreRequest(test);
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            }, function(err) {
              console.log('err', err);
              _this.result(false);
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
            then(env.rsDisconnect).
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
              console.log('FILE NOW', file);
              // verify file
              test.assert(file, { mimeType: 'text/plain', data: 'content-a' });
            }, function(err) {
              console.log('err', err, err.stack);
              test.result(false);
            });
        }
      },

      {
        desc: "removing a file without using cache",
        run: function(env, test) {
          env.remoteStorage.util.unsilenceLogger('store::remote_cache');
          env.remoteStorage.util.setLogLevel('debug');
          // * save something
          env.client.storeFile('text/plain', 'something', 'blue', false).
            then(function() {
              console.log('saved something');
              return env.client.getFile('something');
            }).
            then(function(something) {
              console.log('something contains', something);
            }).
          // * disconnect, then reconnect
            then(env.remoteStorage.flushLocal).
            then(env.rsConnect).
            then(curry(env.client.release, '')).
          // * check that the listing shows the item we saved
            then(curry(env.client.getListing, '')).
            then(function(listing) {
              console.log('got listing', listing);
              test.assertAnd(listing, ['something']);
            }).
            then(function() {
              env.serverHelper.clearCaptured();
            }).
          // * remove the item
            then(curry(env.client.remove, 'something')).
          // * check that the right request was sent
            then(function() {
              env.serverHelper.expectRequest(
                test, 'DELETE', 'me/something'
              );
            }).
          // * check that getListing doesn't have the item anymore
            then(curry(env.client.getListing, '')).
            then(function(listing) {
              console.log('listing now', listing);
              test.assert(listing, []);
            });
          // * disconnect, then reconnect again
          // * check that getListing still doesn't show the item
        }
      },

      {
        desc: "removing a file with cache enabled",
        run: function(env, test) {
          env.client.storeFile('text/plain', 'something', 'blue').
            then(env.remoteStorage.flushLocal).
            then(env.rsConnect).
            then(env.remoteStorage.fullSync).
            then(curry(env.client.getListing, '')).
            then(function(listing) {
              test.assertAnd(listing, ['something']);
            }).
            then(env.serverHelper.clearCaptured).
            then(curry(env.client.remove, 'something')).
            then(function() {
              console.log('serverHelper', env.serverHelper);
              env.serverHelper.expectRequest(
                test, 'DELETE', 'me/something'
              );
            }).
            then(curry(env.client.getListing, '')).
            then(function(listing) {
              test.assert(listing, []);
            });

        }
      },

      {
        desc: "deleting something triggers a 'change' event",
        timeout: 750,
        run: function(env, test) {
          env.client.storeFile('text/plain', 'hello', 'hello world').
            then(function() {
              env.client.on('change', function(event) {
                test.assert(event, {
                  origin: 'window',
                  path: '/hello',
                  oldValue: 'hello world',
                  newValue: undefined
                });
              });
              return env.client.remove('hello');
            });
        }
      },

      {
        desc: "creating something triggers a 'change' event",
        timeout: 750,
        run: function(env, test) {
          env.client.on('change', function(event) {
            console.log('got change', event);
            test.assert(event, {
              origin: 'window',
              path: '/hello',
              oldValue: undefined,
              newValue: 'hello world'
            });
          });
          env.client.storeFile('text/plain', 'hello', 'hello world');
        }
      }
 
    ]
  });

  return suites;

});
