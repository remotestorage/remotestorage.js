if(typeof(define) !== 'function') {
  var define = require('amdefine');
}
define([], function() {
  
  var suites = [];

  var consoleLog, fakeLogs;

  function FakeRemote(){
    this.connected = true;
    this.configure = function(){}
    RemoteStorage.eventHandling(this, 'connected', 'disconnected');
  }

  function fakeRequest(path){
    var promise = promising();
    console.log('GET CALLED')
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
  }

  function FakeLocal(){
    
  }
  FakeLocal.prototype = {
    fireInitial: function(){/*ignore*/}
  }

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
      require('./src/eventhandling');
      require('./lib/promising')
      if(global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }

      RemoteStorage.prototype.remote = new FakeRemote();
      //RemoteStorage.prototype.local = new FakeLocal();
      test.done();
    },
    beforeEach: function(env, test) {
      remoteStorage = new RemoteStorage();
      //remoteStorage._emit('ready');
      env.rs = remoteStorage;
      test.done()
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
          })
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
          })
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
            c+=1
            if(c==3)
              test.done();
          }
          env.rs.on('error', function(e) {
            success = false
          })
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
            test_done()
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
          })
          env.rs.disconnect()
        }
      }
    ]
  });
  // suites.push({
  //   name: "Feature Discovery",
  //   desc: "feature discoverey and their integration into the RemoteStorage instance"
  //   setup: function(env, test) {
  //     require('./src/remotestorage');
  //     require('./src/eventhandling');
  //     require('./lib/promising')
  //     if(global.rs_eventhandling) {
  //       RemoteStorage.eventHandling = global.rs_eventhandling;
  //     } else {
  //       global.rs_eventhandling = RemoteStorage.eventHandling;
  //     }
  //     RemoteStorage.prototype.remote = new FakeRemote();
  //     test.done();
  //   }
  //   beforeEach: function(env, test){
  //     test.done();
  //   }
  //   tests: [
  //     // {
  //     //   desc: "disconnect calls all rs_cleanups",
  //     //   run: function(env, test){
  //     //     var cleaned = 0;
  //     //     fakeFeature = function(){} 
  //     //     fakeFeature._rs_init =  function(){
  //     //       console.log('init feature')
  //     //     }
  //     //     fakeFeature._rs_supported =  function(){
  //     //       console.log('feature supported?')
  //     //       return true;
  //     //     }
  //     //     fakeFeature._rs_cleanup = function(){
  //     //       console.log('rs_cleanup called')
  //     //       cleaned+=1;
  //     //       testDone();
  //     //     }
        
  //     //     function testDone(){
  //     //       if(cleaned == 12)
  //     //         test.done();
  //     //     }
  //     //     [
  //     //     //  'WireClient',
  //     //       'Dropbox',
  //     //       'GoogleDrive',
  //     //       'Access',
  //     //       'Caching',
  //     //       'Discover',
  //     //       'Authorize',
  //     //       'Widget',
  //     //     //  'IndexedDB',
  //     //    //   'LocalStorage',
  //     //       'Sync',
  //     //       'BaseClient'
  //     //     ].forEach(function(feature) {
  //     //       RemoteStorage[feature] = fakeFeature;
  //     //     })
  //     //     var rs = new RemoteStorage();
  //     //     rs.on('ready', function(){
  //     //       console.log('cleanups are ',rs._cleanups);
  //     //       rs.disconnect();
  //     //     })
  //     //   }
  //     // },
  //   ]
  // });
  suites.push({
    name: "RemoteStorage",
    desc: "The global RemoteStorage namespace",
    setup: function(env, test) {
      require('./src/remotestorage');
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
