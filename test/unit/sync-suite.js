if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];

  function FakeCaching(){
    this.rootPaths = [];
  }

  function FakeRemote(){
    function GPD(target, path, body, contentType, options) {
      var args = Array.prototype.slice.call(arguments);
      console.log('GPD called with : ', args);
      this['_'+target+'s'].push([path, body, contentType, options]);
      var p = promising();
      var resp = this._responses[args] || [200];
      return p.fulfill.apply(p, resp);
    }
    this.connected = true;
    this._puts = [];
    this.put = GPD.bind(this, 'put');
    this._deletes = [];
    this.delete = GPD.bind(this, 'delete');
    this._gets = [];
    this.get = GPD.bind(this, 'get');
    this._responses = {};
  }

  function flatten(array){
    var flat = [];
    for (var i = 0, l = array.length; i < l; i++){
      var type = Object.prototype.toString.call(array[i]).split(' ').pop().split(']').shift().toLowerCase();
      if (type) { flat = flat.concat(/^(array|collection|arguments|object)$/.test(type) ? flatten(array[i]) : array[i]); }
    }
    return flat;
  }

  suites.push({
    name: "Sync Suite",
    desc: "testing the sync adapter instance",

    setup: function(env, test){
      require('./lib/promising');
      global.RemoteStorage = function(){
        RemoteStorage.eventHandling(this, 'sync-busy', 'sync-done', 'ready');
      };
      global.RemoteStorage.log = function() {};

      require('./src/eventhandling');
      if (global.rs_eventhandling){
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

      require('./src/inmemorystorage.js');
      if (global.rs_ims) {
        RemoteStorage.InMemoryCaching = global.rs_ims;
      } else {
        global.rs_ims = RemoteStorage.InMemoryStorage;
      }

      require('src/sync.js');
      test.done();
    },

    beforeEach: function(env, test){
      env.rs = new RemoteStorage();
      env.rs.local = env.local = new RemoteStorage.InMemoryStorage();
      env.rs.caching = new FakeCaching();
      env.rs.remote = env.remote = new FakeRemote();
      test.done();
    },

    tests: [
      {
        desc: "RemoteStorage.sync() returns immediately if not connected",
        run: function(env,test){
          var failed = false;
          env.rs.remote.connected = false;
          env.rs.on('sync-busy', function(){
            failed = true;
          });

          env.rs.sync().then(function(){
            test.assert(failed, false);
          });
        }
      },

      {
        desc: "RemoteStorage.sync() sets cached path ready",
        run: function(env,test){
          env.local.put('/foo/bar/baz', 'body', 'text/plain');
          env.remote._responses[['get', '/foo/',
                                 { ifNoneMatch: undefined } ]] =
            [200, {'bar/': 123}, 'application/json', 123];
          env.remote._responses[['get', '/foo/bar/',
                                 { ifNoneMatch: undefined } ]] =
            [200, {'baz': 123}, 'application/json', 123];

          env.remote._responses[['get', '/foo/bar/baz',
                                 { ifNoneMatch: undefined } ]] =
            [200, "body", 'text/plain', 123];
          env.rs.caching.rootPaths = ['/foo/'];
          env.rs.caching.get = function(path) {
            return { data: true };
          };
          env.rs.caching.set = function(path, obj) {
            test.assertAnd(path, '/foo/');
            test.assertType(obj, 'object');
            test.assert(obj.ready, true);
          };
          env.rs.sync();
        }
      },

      {
        desc : "Sync adapter sets and removes all event listeners",
        run : function(env, test) {
          function allHandlers() {
            var handlers = env.rs._handlers;
            var l = 0;
            for (var k in handlers) {
              l += handlers[k].length;
            }
            return l;
          }

          test.assertAnd(allHandlers(), 0, "before init found "+allHandlers()+" handlers");

          RemoteStorage.Sync._rs_init(env.rs);
          test.assertAnd(allHandlers(), 1, "after init found "+allHandlers()+" handlers");

          RemoteStorage.Sync._rs_cleanup(env.rs);
          test.assertAnd(allHandlers(), 0, "after cleanup found "+allHandlers()+" handlers");

          test.done();
        }
      },

      {
        desc: "Default sync interval",
        run: function(env, test) {
          test.assert(env.rs.getSyncInterval(), 10000);
        }
      },

      {
        desc: "Update sync interval",
        run: function(env, test) {
          env.rs.setSyncInterval(60000);
          test.assert(env.rs.getSyncInterval(), 60000);
        }
      },

      {
        desc: "Setting a wrong sync interval throws an error",
        run: function(env, test) {
          try {
            env.rs.setSyncInterval('60000');
            test.result(false, "setSyncInterval() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      }

    ]
  });

  return suites;
});
