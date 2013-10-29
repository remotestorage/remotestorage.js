if(typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];
  suites.push({
    name: "Sync Suite",
    desc: "testing the sync adapter instance",
    setup: function(env, test){
      require('./lib/promising');
      global.RemoteStorage = function(){};
      require('./src/eventhandling');
      if( global.rs_eventhandling ){
        RemoteStorage.eventHandling = global.rs_eventhandling
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      require('src/sync.js');
      test.done();
    },
    beforeEach: function(env, test){
      test.done();
    },
    tests: [
      {
        desc: "test",
        run: function(env,test){
          test.done();
        }
      }
    ]
    
  })
  return suites;
});
