if(typeof(define) !== 'function') {
  var define = require('amdefine');
}
define([], function() {
  
  var suites = [];

  var consoleLog, fakeLogs;

  function FakeRemote(){
    this.connected = true;
    this.configure = function(){};
    RemoteStorage.eventHandling(this, 'connected', 'disconnected');
  }

  function fakeRequest(path){
    var promise = promising();
//    console.log('GET CALLED');
    if(path == '/testing403')
        promise.fulfill(403);
    else
        promise.fulfill(200);
    return promise;
  }
  FakeRemote.prototype = {
    get: fakeRequest,
    put: fakeRequest,
    delete: fakeRequest
  };

  function FakeLocal(){
    
  }

  FakeLocal.prototype = {
    fireInitial: function(){/*ignore*/}
  };

  function fakeConsoleLog() {
    fakeLogs.push(Array.prototype.slice.call(arguments));
  }

  function replaceConsoleLog() {
    consoleLog = console.log;
    console.log = fakeConsoleLog;
  }

  function restoreConsoleLog() {
    console.log = consoleLog;
    consoleLog = undefined;
  }

  function assertNoConsoleLog(test) {
    test.assert(fakeLogs.length, 0);
  }

  function assertConsoleLog(test) {
    var expected = Array.prototype.slice.call(arguments, 1);
    test.assert(fakeLogs[0], expected);
  }

  suites.push({
    name: "remoteStorage",
    desc: "the RemoteStorage instance",
    setup:  function(env, test) {
      require('./src/remotestorage');
      if (global.rs_remotestorage) {
        global.RemoteStorage = global.rs_remotestorage;
      } else {
        global.rs_remotestorage = global.RemoteStorage;
      }
      require('./src/eventhandling');
      require('./lib/promising');
      if(global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      RemoteStorage.Discover = function( userAddress, cb ) {
        cb();
      }
      RemoteStorage.prototype.remote = new FakeRemote();
      //RemoteStorage.prototype.local = new FakeLocal();
      test.done();
    },
    beforeEach: function(env, test) {
      remoteStorage = new RemoteStorage();
      //remoteStorage._emit('ready');
      env.rs = remoteStorage;
      test.done();
    },   
    tests: [ 
      {
        desc: "#get emiting error RemoteStorage.Unauthorized on 403",
        run: function(env, test) {
          var success = false;
          env.rs.on('error', function(e) {
            if(e instanceof RemoteStorage.Unauthorized)
              success = true;
          });
          env.rs.get('/testing403').then(function(status){
            test.assertAnd(status, 403);
            test.assertAnd(success, true);
            test.done();
          });
        }
      },    
      {
        desc: "#put emiting error RemoteStorage.Unauthorized on 403",
        run: function(env, test) {
          var success = false;
          env.rs.on('error', function(e) {
            if(e instanceof RemoteStorage.Unauthorized)
              success = true;
          });
          env.rs.put('/testing403').then(function(status){
            test.assert(success, true);
          });
        }
      },    
      {
        desc: "#delete emiting error RemoteStorage.Unauthorized on 403",
        run: function(env, test) {
          var success = false;
          env.rs.on('error', function(e) {
            if(e instanceof RemoteStorage.Unauthorized)
              success = true;
          });
          env.rs.delete('/testing403').then(function(status){
            test.assert(success, true);
          });
        }
      },
      {
        desc: "#get #put #delete not emmitting Error when getting 200",
        run: function(env, test) {
          var success = true;
          var c = 0;
          function test_done(){
            c+=1;
            if(c==3)
              test.done();
          }
          env.rs.on('error', function(e) {
            success = false;
          });
          env.rs.get('/testing200').then(function() {
            test.assertAnd(success, true);
            test_done();
          });
          env.rs.put('/testing200').then(function() {
            test.assertAnd(success, true);
            test_done();
          });
          env.rs.delete('/testing200').then(function() {
            test.assertAnd(success, true);
            test_done();
          });
        }
      },

      {
        desc: "connect throws unauthorized when userAddress doesn't contain an @",
        run: function(env, test){
          env.rs.on('error', function(e){
            test.assert(e instanceof RemoteStorage.DiscoveryError, true);
          });
          env.rs.connect('somestring');
        }
      },
      {
        desc: "diconnect fires disconnected ",
        run: function(env, test){
          env.rs.on('disconnected', function(){
            test.done();
          });
          env.rs.disconnect();
        }
      },

      {
        desc: "RemoteStorage.connect throws Discovery Error on empty href",
        run: function(env, test) {
          env.rs.on('error', function(e) {
            test.assertAnd(e instanceof RemoteStorage.DiscoveryError, true);
            test.assertAnd(e.message, "failed to contact storage server");
            test.done();
          })
          env.rs.connect('someone@somewhere');
        }
      }
    ]
  });
      
  suites.push({
    name: "Feature Discovery",
    desc: "feature discoverey and their integration into the RemoteStorage instance",
    setup: function(env, test) {
      require('./src/remotestorage');
      if (global.rs_remotestorage) {
        global.RemoteStorage = global.rs_remotestorage;
      } else {
        global.rs_remotestorage = global.RemoteStorage;
      }
      require('./src/eventhandling');
      require('./lib/promising');
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      env.features = [
        'WireClient',
        'Dropbox',
        'GoogleDrive',
        'Access',
        'Caching',
        'Discover',
        'Authorize',
        'Widget',
        'IndexedDB',
        'LocalStorage',
        'Sync',
        'BaseClient'
      ];
      //    RemoteStorage.prototype.remote = new FakeRemote();
      test.done();
    },
    // beforeEach: function(env, test){
    //   env.rs = new RemoteStorage();
    //   test.done();
    // },
    tests: [
      {
        desc: "#_loadFeatures calls callback when there are no features",
        run: function(env, test) {
          RemoteStorage.prototype._loadFeatures(function(features){
            test.assertAnd(features.length, 0,JSON.stringify(features));
            test.done();
          });
        }
      },
      {
        desc: "#_loadFeatures handles features returning promises",
        run: function(env, test) {
          RemoteStorage.IndexedDB = function(){};
          RemoteStorage.IndexedDB._rs_init = function() {
            var promise = promising();
            return promise.fulfill();
          };
          RemoteStorage.prototype._loadFeatures(function(features) {
            test.assertAnd(features.length, 1, JSON.stringify(features));
            RemoteStorage = global.rs_remotestorage;
            test.done();
          });
        }
      },
      
      {
        desc: "#_loadFeatures calls _rs_supported and _rs_init of features",
        run: function(env, test) {
          var s = env.features.length;
          var i = env.features.length;
          env.features.forEach(function(f){
            RemoteStorage[f] = function(){};
            RemoteStorage[f]._rs_supported = function() {
              s-=1;
              return true;
            };
            RemoteStorage[f]._rs_init = function(){
              i-=1
            };
          });
          
          RemoteStorage.prototype._loadFeatures(function(features) {
            test.assertAnd(s, 0, "not all #_rs_supported called");
            test.assertAnd(i, 0, "not all #_rs_init called");
            test.assertAnd(features.length, env.features.length, "wrong feature length"+JSON.stringify(features));
            test.done();
          });
        }
      },
      
      {
        desc: "#_loadFeatures calls callback when promise fails",
        run: function(env, test) {
          RemoteStorage.IndexedDB._rs_init = function() {
            return promising().reject();
          }
          RemoteStorage.prototype._loadFeatures(function(f){
            test.assertAnd(f.length, env.features.length - 1);
            test.done();
          })
        }
      },
     
      {
        desc: "#_loadFeatures calls callback when init throws error",
        run: function(env, test) {
          RemoteStorage.IndexedDB._rs_init = function() {
            throw new Error("Wuahhahah");
          }
          RemoteStorage.prototype._loadFeatures(function(f){
            test.assertAnd(f.length, env.features.length - 1);
            test.done();
          })
        }
      },
       
      {
        desc: "#_loadFeature chooses indexdb then localstorage then inmemorystorage if one failes",
        run: function(env, test) {
          env.features.forEach(function(f){
            RemoteStorage[f] = function(){};
            RemoteStorage[f]._rs_supported = function() {
              return true;
            };
            RemoteStorage[f]._rs_init = function(){
              
            };
          });
          //RemoteStorage.LocalStorage = 
          
          RemoteStorage.prototype._loadFeatures(function(f){
            test.assertAnd(f.local, RemoteStorage.IndexedDB);
            
            RemoteStorage.IndexedDB._rs_supported = function() { return false; }
            RemoteStorage.prototype._loadFeatures(function(f){
              test.assertAnd(f.local, RemoteStorage.LocalStorage);

              RemoteStorage.LocalStorage._rs_supported = function() { return false; }   
              RemoteStorage.prototype._loadFeatures(function(f){
                test.assertAnd(f.local, RemoteStorage.InMemmoryStorage);
                test.done()
              });
            });
          
          });
          

        }
      },

      {
        desc: "#_loadFeatures calls _rs_init only for supported features",
        run: function(env, test) {
          env.features.forEach(function(f){
            RemoteStorage[f] = function(){};
            if(['Caching',
                'Discover',
                'Authorize',
                'Widget'].indexOf(f) >= 0) {
              RemoteStorage[f]._rs_supported = function() {
                return false;
              };
              RemoteStorage[f]._rs_init = function() {
                test.assertAnd(true, false, f+" initialized");
              };
            } else {
              console.log("+"+f)
              RemoteStorage[f]._rs_supported = function() {
                return true;
              };
              RemoteStorage[f]._rs_init = function() {
                
              };
            }
          });
          RemoteStorage.prototype._loadFeatures(function(features) {
            test.assertAnd(features.length, env.features.length-4, "wrong amount of features"+JSON.stringify(features));
            test.done();
          });
        }
      },
      
      // {
      //   desc: "disconnect calls all rs_cleanups",
      //   run: function(env, test){
      //     var cleaned = 0;
        
      //     function testDone(){
      //       if(cleaned == 12)
      //         test.done();
      //     }
      //     [
      //     //  'WireClient',
      //       'Dropbox',
      //       'GoogleDrive',
      //       'Access',
      //       'Caching',
      //       'Discover',
      //       'Authorize',
      //       'Widget',
      //     //  'IndexedDB',
      //    //   'LocalStorage',
      //       'Sync',
      //       'BaseClient'
      //     ].forEach(function(feature) {
      //       RemoteStorage[feature] = fakeFeature;
      //     })
      //     var rs = new RemoteStorage();
      //     rs.on('ready', function(){
      //       console.log('cleanups are ',rs._cleanups);
      //       rs.disconnect();
      //     })
      //   }
      // },
    ]
  });
  suites.push({
    name: "RemoteStorage",
    desc: "The global RemoteStorage namespace",
    setup: function(env, test) {
      require('./src/remotestorage');
      if (global.rs_remotestorage) {
        global.RemoteStorage = global.rs_remotestorage;
      } else {
        global.rs_remotestorage = global.RemoteStorage;
      }
      test.done();
    },

    beforeEach: function(env, test) {
      fakeLogs = [];
      test.done();
    },

    tests: [

      {
        desc: "exports the global RemoteStorage function",
        run: function(env, test) {
          test.assertType(global.RemoteStorage, 'function');
        }
      },

      {
        desc: "#log doesn't call console.log by default",
        run: function(env, test) {
          replaceConsoleLog();
          try {
            RemoteStorage.log('message');
            assertNoConsoleLog(test);
          } catch(e) {
            restoreConsoleLog();
            throw e;
          }
          restoreConsoleLog();
        }
      },

      {
        desc: "#log calls console.log, when _log is true",
        run: function(env, test) {
          replaceConsoleLog();
          try {
            RemoteStorage._log = true;
            RemoteStorage.log('foo', 'bar', 'baz');
            assertConsoleLog(test, 'foo', 'bar', 'baz');
          } catch(e) {
            restoreConsoleLog();
            RemoteStorage._log = false;
            throw e;
          }
          restoreConsoleLog();
        }
      }
    ]
  });

  return suites;

});
