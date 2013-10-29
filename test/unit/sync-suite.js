if(typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];
  
  function FakeCaching(){}
  function FakeRemote(){
    this.connected = false;
  }
  suites.push({
    name: "Sync Suite",
    desc: "testing the sync adapter instance",
    setup: function(env, test){
      require('./lib/promising');
      global.RemoteStorage = function(){
        RemoteStorage.eventHandling(this, 'sync-busy', 'sync-done')
      };
      require('./src/eventhandling');
      if( global.rs_eventhandling ){
        RemoteStorage.eventHandling = global.rs_eventhandling
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      require('./src/inmemorystorage.js')
      if(global.rs_ims) {
        RemoteStorage.InMemoryCaching = global.rs_ims;
      } else {
        global.rs_ims = RemoteStorage.InMemoryStorage;
      }

      require('src/sync.js');
      test.done();
    },
    beforeEach: function(env, test){
      env.rs = new RemoteStorage();
      env.rs.local = new RemoteStorage.InMemoryStorage();
      env.rs.caching = new FakeCaching();
      env.rs.remote = new FakeRemote();
      test.done();
    },
    tests: [
      {
        desc: "RemoteStorage.sync() returns imediatly if not connected",
        run: function(env,test){
          var failed = false;
          env.rs.on('sync-busy', function(){
            failed = true;
          })
          
          env.rs.sync().then(function(){
            test.assert(failed, false);
          })
          
        }
      }
    ]
    
  })
  return suites;
});
