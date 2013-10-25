if(typeof(define) !== 'function'){
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs){
  var suites = [];
  suites.push({
    name: 'InMemoryStorage',
    desc: 'inmemory caching as a fallback for indexdb and localstorge',
    setup: function(env, test) {
      require('./lib/promising');
      global.RemoteStorage = function(){};
      require('./src/eventhandling');
      if( global.rs_eventhandling ){
        RemoteStorage.eventHandling = global.rs_eventhandling
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
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
          })
        }
      },
      
      {
        desc: "#get yields 404 when it doesn't find a node",
        run: function(env, test){
          env.ims.get('/bar').then(function(status){
            test.assert(status,404);
          })
        }
      },
      
      {
        desc: "#put yields 200",
        run: function(env, test) {
          env.ims.put('/foo', 'bar', 'text/plain').then(function(status) {
            test.assert(status, 200);
          });
        }
      },

    ]
  
  })
  return suites;
});
