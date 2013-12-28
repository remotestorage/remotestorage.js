if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

var util = {
  extend: function() {
    var result = arguments[0];
    var objs = Array.prototype.slice.call(arguments, 1);
    objs.forEach(function(obj) {
        if(obj) {
          for(var key in obj) {
            result[key] = obj[key];
          }
        }
      });
    return result;
  },
  curry: function(f) {
    if(typeof(f) !== 'function') {
      throw new Error("Can only curry functions!");
    }
    var _a = Array.prototype.slice.call(arguments, 1);
    return function() {
      var a = Array.prototype.slice.call(arguments);
      for(var i=(_a.length-1);i>=0;i--) {
        a.unshift(_a[i]);
      }
      return f.apply(this, a);
    };
  },
  asyncEach: function(array, cb) {
    var promise = promising();
    var l = array.length;
    function doneNow() {
      l-=1;
      if (l === 0) {
        promise.fulfill();
      }
    }
    array.forEach(function(i) {
      cb(i).then( doneNow, promise.reject );
    });
    return promise;
  }
};

define(['requirejs', 'xmlhttprequest'], function(requirejs,  request) {
  global.XMLHttpRequest = request.XMLHttpRequest;
  var suites = [];

  suites.push({
    name: "sync requests",
    desc: "verify requests that sync performs in various situations",

    setup: function(env) {
      var _this = this;
      requirejs([
        './remotestorage-node',
        'remotestorage-example-server/remotestorage-server.js',
        './test/helper/server',
        './test/helper/root-module'
      ], function(remoteStorage, nodejsExampleServer, serverHelper, root) {
        
        curry = util.curry;
        //RemoteStorage._log = true;
        env.remoteStorage = new RemoteStorage();
        env.remoteStorage.setSyncInterval(-1);
        env.remoteStorage.caching.enable('/');
        env.serverHelper = serverHelper;

        env.client = env.remoteStorage.scope('/');

        util.extend(env.serverHelper, nodejsExampleServer);

        //env.serverHelper.enableLogs();
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

    beforeEach: function(env, test) {
      env.serverHelper.resetState(); 
      env.serverHelper.setScope([':rw']);
      
      env.rsDisconnect = function() {
        var promise = promising();
        function done() {
          env.remoteStorage.removeEventListener('disconnected', done);
          promise.fulfill();
        }
        env.remoteStorage.on('disconnected', done);
        env.remoteStorage.disconnect();
        return promise;
      };

      env.rsConnect = function() {
        env.remoteStorage.setSyncInterval(-1);
        env.remoteStorage.claimAccess('root', 'rw');
        settings = env.serverHelper.getStorageInfo();
        console.log("settings",settings);
        env.remoteStorage.remote.configure(settings.userAddress, settings.href, settings.type, settings.token);
        env.remoteStorage.stopSync();
        
        console.log('in rsConnect, wireClient state: ', env.remoteStorage.remote.connected);
        return promising().fulfill();
      };

      env.rsConnect().then(function() {
        console.log('end of beforeEach, state:', 'CACHING', env.remoteStorage.caching, 'ACCESS', env.remoteStorage.access);

        env.client.cache('', true);
      
        test.result(true);
      });
    },
    
    afterEach: function(env, test) {
      env.rsDisconnect().then(function() {
        env.serverHelper.clearCaptured();
      }).then(test.done.bind(test),
              function(e){
                test.result(false);
                throw e;
              });
    },
    
    tests: [

      // {
      //   desc: "Simple outgoing requests",
      //   run: function(env, test) {
      //     var _this = this;
      //     return env.client.storeObject('test', 'test/testobj', { hello: 'world' }).
      //       then(env.remoteStorage.sync.bind(env.remoteStorage)).
      //       then(function() {
      //         env.serverHelper.expectThisRequest(
      //           _this, 'PUT', 'me/test/testobj', JSON.stringify({ 
      //             'hello': 'world',
      //             '@context': 'http://remotestoragejs.com/spec/modules/root/test'
      //           })
      //         );
      //         env.serverHelper.expectThisRequest(_this, 'GET', 'me/');
      //         env.serverHelper.expectThisRequest(_this, 'GET', 'me/test/');
      //         env.serverHelper.expectNoMoreRequest(_this);
      //         test.done();
      //       }).then(undefined, function(err) {
      //         console.log('err', err);
      //         _this.result(false);
      //       });
      //   }
      // },

      {
        desc: "Incoming data",
        run: function(env) {
          var _this = this;
          // push initial data to the server:
          util.asyncEach([1,2,3,4,5], function(i) {
            return env.client.storeObject('test', 'obj-' + i, { i: i });
          }).
            then(env.remoteStorage.sync.bind(env.remoteStorage)).
            then(env.rsDisconnect).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            then(env.remoteStorage.sync.bind(env.remoteStorage)).
            then(function() {
              // initial root request
              
              env.serverHelper.expectThisRequest(_this, 'GET', 'me/');
              // requests for each object (the order doesn't matter though)
              env.serverHelper.expectTheseRequests(_this, [
                ['GET', 'me/obj-1'],
                ['GET', 'me/obj-2'],
                ['GET', 'me/obj-3'],
                ['GET', 'me/obj-4'],
                ['GET', 'me/obj-5']
              ]);

              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            }, function(err) {
              console.log('err', err, err.stack);
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
            });
          }).
            then(env.remoteStorage.sync.bind(env.remoteStorage)).
            // dis- and reconnect
            then(env.rsDisconnect).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            // release root (which was set up by claimAccess):
            then(curry(env.client.cache.bind(env.client),'',false)).
            // use /a/, but not /b/
            then(curry(env.client.cache.bind(env.client), 'a/')).
            then(function() {
              console.log('CACHING', env.remoteStorage.caching);
            }).
            // do a full sync
            then(curry(env.remoteStorage.sync.bind(env.remoteStorage))).
            then(function() {
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-1');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-2');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-3');
              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            }, function(err) {
              console.log('err', err, err.stack);
              _this.result(false);
            });
        }
      },

      // {
      //   desc: "store file, then store it again, then retrieve it",
      //   run: function(env) {
      //     var _this = this;
      //     env.client.storeFile('text/plain', 'note.txt', 'foo').
      //       then(curry(env.client.storeFile.bind(env.client), 'text/plain', 'note.txt', 'bar')).
      //       then(curry(env.client.getFile.bind(env.client), 'note.txt')).
      //       then(function(file) {
      //         console.log("testing mime-type and body now" , file.mimeType, file.data);
      //         _this.assertAnd(!!file.mimeType.match(/text\/plain/),true, 'wrong mime type '+file.mimeType);
      //         _this.assert(file.data, 'bar');
      //       }, function(err) {
      //         console.log('err', err, err.stack);
      //         _this.result(false);
      //       });
      //   }
      // },
      
      {
        desc: "store object, then check requests when caching is disabled",
        run: function(env) {
          var _this = this;
          env.client.cache('',false);
          env.client.storeObject('test', 'test-dir/obj', { phu: 'quoc' }).
            then(function() {
              env.serverHelper.expectRequest(_this, 'PUT', 'me/test-dir/obj', '{"phu":"quoc","@context":"http://remotestoragejs.com/spec/modules/root/test"}');
              
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
          env.client.cache('',false);
          env.client.storeFile('text/plain', 'text-file', 'some text').
            then(function() {
              env.serverHelper.expectRequest(test, 'PUT', 'me/text-file', 'some text');
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
          env.client.cache('',false);
          env.client.storeFile('text/plain', 'empty-file', '').then(function(){
            env.serverHelper.expectRequest(_this, 'PUT', 'me/empty-file', '');
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
          env.client.cache('', false);
          env.client.storeFile('text/plain', 'public/foo', 'bar').
            then(function() {
              env.serverHelper.expectRequest(test, 'PUT', 'me/public/foo', 'bar');
              env.serverHelper.expectNoMoreRequest(test);
              test.assert(true, true);
            }, function(err) {
              console.log('err', err);
              _this.result(false);
            });
        }
      },

      // {
      //   desc: "change events with outgoing changes with caching disabled ",
      //   run: function(env, test) {
      //     var receivedEvents = [];
      //     env.client.cache('', false);
      //     env.client.on('change', function(event) {
      //       receivedEvents.push(event);
      //     });
      
      //     function expectEvent(expected) {
      //       var rel = receivedEvents.length;
      //       var matching, matchIndex;
      //       for(var i=0;i<rel;i++) {
      //         var e = receivedEvents[i];
      //         for(var key in expected) {
      //           if(e[key] !== expected[key]) {
      //             continue;
      //           }
      //         }
      //         matching = e;
      //         matchIndex = i;
      //         break;
      //       }
      //       test.assertTypeAnd(matching, 'object', "No event found matching: " + JSON.stringify(expected));
      //       if(matching) {
      //         receivedEvents.splice(matchIndex, 1);
      //       }
      //     }

      //     env.client.storeObject('test', 'foo/bar/test-obj', { phu: 'quoc' }).
      //       then(function() {
      //         expectEvent({
      //           origin: 'window',
      //           path: 'foo/bar/test-obj',
      //           oldValue: undefined,
      //           newValue: { phu: 'quoc', '@context': 'http://remotestoragejs.com/spec/modules/root/test' }
      //         });
      //         test.assertAnd(receivedEvents, [], "There are still events in the queue: " + JSON.stringify(receivedEvents,null,2));
      //         test.done();
      //       }, function(err) {
      //         console.log('err', err);
      //         _this.result(false);
      //       });
      //   }
      // },

      {
        desc: "change events with outgoing changes with caching enabled",
        run: function(env, test) {
          var receivedEvents = [];
          env.client.cache('', true);
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
              console.log('RECEIVED', receivedEvents);
              expectEvent({
                origin: 'window',
                path: 'foo/bar/test-obj',
                oldValue: undefined,
                newValue: { phu: 'quoc', '@context': 'http://remotestoragejs.com/spec/modules/root/test' }
              });
              test.assertAnd(receivedEvents, [], "There are still events in the queue: " + JSON.stringify(receivedEvents,null,2));
              test.done();
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
          return env.client.storeObject('test', 'locations/hackerbeach/2013', { island: "Phu Quoc" }).
            //syncing to send the file to the server
            then(env.remoteStorage.sync.bind(env.remoteStorage)).
            // disconnect client
            then(env.rsDisconnect).
            then(function() {
              // reconnect client
              env.rsConnect();
              // configure tree-only sync
              env.client.cache('', true);
              // synchronize
              return env.remoteStorage.sync();
            }).
            then(function() {
              return env.client.getListing('locations/hackerbeach/');
            }).
            then(function(listing) {
              // verify listing
              env.serverHelper.assertListing(test, listing, ['2013']);
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
              console.log('err', err, err.stack);
              _this.result(false);
            });
        }
      },

      {
        desc: "getting a file with tree-only sync",
        run: function(env, test) {
          // store the file first
          return env.client.storeFile('text/plain', 'locations/hackerbeach/2013', 'Phu Quoc Island').
               // push file to server
            then(env.remoteStorage.sync.bind(env.remoteStorage) ).
               // disconnect client
            then(env.rsDisconnect).
            then(function() {
              // reconnect client
              env.rsConnect();
              // configure tree-only sync
              //env.client.use('', true);
              // synchronize
              return env.remoteStorage.sync();
            }).
            then(function() {
              return env.client.getListing('locations/hackerbeach/');
            }).
            then(function(listing) {
              // verify listing
              env.serverHelper.assertListing(test, listing, ['2013']);
            }).
            then(function() {
              return env.client.getFile('locations/hackerbeach/2013');
            }).
            then(function(file) {
              // verify file
              test.assertAnd('Phu Quoc Island', file.data, "data was : "+ JSON.stringify(file) );
              test.assertAnd(!!file.mimeType.match(/text\/plain/), true, "mimeType was : "+ JSON.stringify(file.mimeType) ); 
              test.done();
            }, function(err) {
              console.log('err', err);
              _this.result(false);
            });
        }
      },

      {
        desc: "getting a listing with no forced sync at all",
        run: function(env, test) {
          env.client.cache('', false);
          return env.client.storeFile('text/plain', 'locations/hackerbeach/2013', 'Phu Quoc Island').
            then(env.rsDicsonnect).
            then(env.rsConnect).
            then(function() {
              return env.client.getListing('locations/hackerbeach/');
            }).
            then(function(listing) {
              env.serverHelper.assertListing(test, listing, ['2013']);
              test.done();
            }, function(err) {
              console.log('err', err);
              _this.result(false);
            });
        }
      },

      {
        desc: "getting an empty dir with tree-force enabled doesn't cause a request",
        run: function(env, test) {
          return env.remoteStorage.sync().
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
          env.remoteStorage.caching.disable('/');

          console.log('CAPTURED REQUESTS BEFORE DOING ANYHING: ', env.serverHelper.captured);

          return env.client.storeFile('text/plain', 'greetings/default', 'Hello World!', false).
            then(function() {
              // check requests
              env.serverHelper.expectRequest(test, 'PUT', 'me/greetings/default', 'Hello World!');

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
          env.remoteStorage.caching.disable('/');
          
          env.client.storeFile('text/plain', 'greetings/default', 'Hello World!', false).
            then(function() {
              console.log("123");
              env.serverHelper.expectRequest(test, 'PUT', 'me/greetings/default', 'Hello World!');
              env.serverHelper.expectNoMoreRequest(test);
              return env.client.getListing('greetings/');
            }).
            then(function(listing) {
              console.log("123");
              env.serverHelper.expectRequest(test, 'GET', 'me/greetings/');
              env.serverHelper.expectNoMoreRequest(test);
              env.serverHelper.assertListing(test, listing, ['default']);
              return env.client.getFile('greetings/default');
            }).
            then(function(file) {
              console.log("123");
              env.serverHelper.expectRequest(test, 'GET', 'me/greetings/default');
              env.serverHelper.expectNoMoreRequest(test);
              test.assertAnd(!!file.mimeType.match(/text\/plain/), true, "mimeType -> file was "+JSON.stringify(file) );
              test.assertAnd(file.data, 'Hello World!', "data -> file was "+JSON.stringify(file) );
              test.done();
            }, function(err) {
              console.log('err', err, err.stack);
              _this.result(false);
            });
        }
      },

      {
        desc: "enabling, then disabling caching, then getting listing, then getting files",
        run: function(env, test) {
          // setup some files
          return util.asyncEach(['a', 'b', 'c'], function(name) {
            return env.client.storeFile('text/plain', 'test/' + name,
                                        'content-' + name);
          }). /* and sync */ then(
            env.remoteStorage.sync.bind(env.remoteStorage), function( err) {
              console.error("storing failed", err, err.stack);
              test.result(false);
              return;
            }). /* logout & log in again */ then(env.rsDisconnect).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            then(function() {
              // release root
              return env.client.cache('', false);
            }).
            then(function() {
              // use test/ (creates dir node, but doesn't populate it)
              return env.client.cache('test/');
            }).
            then(function() {
              // release test/ again
              return env.client.cache('test/',false);
            }).
            then(function() {
              // get listing
              return env.client.getListing('test/');
            }).
            then(function(listing) {
              // verify listing
              env.serverHelper.assertListing(test, listing, ['a','b','c']);
              // get file
              return env.client.getFile('test/a');
            }).
            then(function(file) {
              console.log('FILE NOW', file);
              // verify file
              test.assertAnd(!!file.mimeType.match(/text\/plain/), true, "mimeType "+file.mimeType);
              test.assertAnd(file.data, 'content-a' , "data "+file.data);
            }, function(err) {
              console.error('err', err, err.stack);
              test.result(false);
            });
        }
      },

      {
        desc: "removing a file without using cache",
        run: function(env, test) {
          env.client.cache('',false);
          env.client.storeFile('text/plain', 'something', 'blue', false).
            then(function() {
              console.log('saved something');
              return env.client.getFile('something');
            }).
            then(function(something) {
              console.log('something contains', something);
            }).
          // * disconnect, then reconnect
            then(env.rsDisconnect).
            then(env.rsConnect).
          // * check that the listing shows the item we saved
            then(env.client.getListing.bind(env.client, '') ).
            then(function(listing) {
              console.log('got listing', listing);
              env.serverHelper.assertListing(test, listing, ['something']);
            }).
            then(function() {
              env.serverHelper.clearCaptured();
            }).
          // * remove the item
            then(env.client.remove.bind(env.client, 'something') ).
          // * check that the right request was sent
            then(function() {
              env.serverHelper.expectRequest(
                test, 'DELETE', 'me/something'
              );
            }).
          // * check that getListing doesn't have the item anymore
            then(env.client.getListing.bind(env.client, '') ).
            then(function(listing) {
              env.serverHelper.assertListing(test, listing, []);
              test.done();
            }).then( undefined,
                     function(err) {
                       console.log("promise failed ", err, err.stack);
                       test.result(false);
                     });
          // * disconnect, then reconnect again
          // * check that getListing still doesn't show the item
        }
      },

      {
        desc: "removing a file with cache enabled",
        run: function(env, test) {
          env.client.storeFile('text/plain', 'something', 'blue').
            then(env.remoteStorage.sync.bind(env.remoteStorage)).
            then(env.rsDisconnect).
            then(env.rsConnect).
            then(env.remoteStorage.sync.bind(env.remoteStorage)).
            then(env.client.getListing.bind(env.client, '') ).
            then(function(listing) {
              env.serverHelper.assertListing(test, listing, ['something']);
            }).
            then(env.serverHelper.clearCaptured).
            then(env.client.remove.bind(env.client, 'something') ).
            then(env.remoteStorage.sync.bind(env.remoteStorage)).
            then(function() {
              console.log('serverHelper', env.serverHelper);
              env.serverHelper.expectRequest(
                test, 'DELETE', 'me/something'
              );
            }).
            then(env.client.getListing.bind(env.client, '') ).
            then(function(listing) {
              env.serverHelper.assertListing(test, listing, []);
              test.done();
            });
        }
      },

      { 
        desc: "deleting something triggers a 'change' event",
        timeout: 750,
        run: function(env, test) {
          var i = 0;
          env.client.storeFile('text/plain', 'hello', 'hello world').
            then(function() {
              env.client.on('change', function(event) {
                if(i == 0) {
                  test.assertAnd(event.origin, 'window' , 
                                 "origin -> event was "+
                                 JSON.stringify(event, null, 2) )
                  test.assertAnd(event.path, '/hello' , 
                                 "path -> event was "+
                                 JSON.stringify(event, null, 2) )
                  test.assertAnd(event.oldValue, 'hello world', 
                                 "oldValue -> event was "+
                                 JSON.stringify(event, null, 2) )
                  test.assertAnd(event.newValue, undefined
                                 , "newValue -> event was "+
                                 JSON.stringify(event, null, 2) )
                  test.done();
                } else {
                  test.result(false, "Saw one more change event than I expected!");
                }
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
            test.assertAnd(event.origin, 'window' , "origin -> event was "+JSON.stringify(event, null, 2) );
            test.assertAnd(event.path, '/hello' , "path -> event was "+JSON.stringify(event, null, 2) );
            test.assertAnd(event.oldValue, undefined , "oldValue -> event was "+JSON.stringify(event, null, 2) );
            test.assertAnd(event.newValue, 'hello world' , "newValue -> event was "+JSON.stringify(event, null, 2) );
          });
          env.client.storeFile('text/plain', 'hello', 'hello world').then(this.done.bind(this));
        }
      }
      
    ]
  });

  return suites;

});
