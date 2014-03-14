if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];

  function FakeCaching(){
    this.FLUSH = 0;
    this.SEEN = 1;
    this.FOLDERS = 2;
    this.DOCUMENTS = 4;
    this.ALL = 7;
    
    this._responses = {};
    this.checkPath = function(path) {
      if (typeof(this._responses[path]) === 'undefined') {
        throw new Error('no FakeCaching response for path ' + path + ' have: ' + JSON.stringify(this._responses));
      }
      return this._responses[path];
    };
    this.onActivate = function() {};
  }

  function FakeAccess(){
    this._data = {};
    this.set = function(moduleName, value) {
      this._data[moduleName] = value;
    };
    this.get = function(moduleName) {
      return this._data[moduleName];
    };
    this.checkPathPermission = function(path, mode) {
      if (path.substring(0, '/foo/'.length) === '/foo/') {
        return true;
      }
      if (path.substring(0, '/read/access/'.length) === '/read/access/' && mode === 'r') {
        return true;
      }
      if (path.substring(0, '/write/access/'.length) === '/write/access/') {
        return true;
      }
      return false;
    };
  }

  function FakeRemote(){
    function GPD(target, path, body, contentType, options) {
      var args = Array.prototype.slice.call(arguments);
      this['_'+target+'s'].push([path, body, contentType, options]);
      var p = promising();
      if (typeof(this._responses[args]) === 'undefined') {
        throw new Error('no FakeRemote response for args ' + JSON.stringify(args));
      }
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
    name: "Versioning Suite",
    desc: "testing how sync deals with revisions and conflicts",

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
        RemoteStorage.InMemoryStorage = global.rs_ims;
      } else {
        global.rs_ims = RemoteStorage.InMemoryStorage;
      }

      require('src/sync.js');
      if (global.rs_sync) {
        RemoteStorage.Sync = global.rs_sync;
      } else {
        global.rs_sync = RemoteStorage.Sync;
      }
      test.done();
    },

    beforeEach: function(env, test){
      env.rs = new RemoteStorage();
      env.rs.local = new RemoteStorage.InMemoryStorage();
      env.rs.remote = new FakeRemote();
      env.rs.access = new FakeAccess();
      env.rs.caching = new FakeCaching();
      env.rs.sync = new RemoteStorage.Sync(env.rs.local, env.rs.remote, env.rs.access, env.rs.caching);
      test.done();
    },

    tests: [
      {
        desc: "checkRefresh requests the parent rather than the stale node itself, if it is not a read-access root",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/read/access/f/o/o/': {
              path: '/read/access/f/o/o/',
              common: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            }
          }).then(function() {
            return env.rs.sync.checkRefresh();
          }).then(function() {
            test.assertAnd(env.rs.sync._tasks, {
              '/read/access/f/o/': []
            });
            //env.rs.sync._tasks = {};
            //env.rs.sync._running = {};
            test.done();
          });
        }
      },
      {
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a env.rs.caching.ALL root",
        run: function(env, test) {
          test.assertAnd(env.rs.sync._tasks, {});
          test.assertAnd(env.rs.sync._running, {});
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.FLUSH,
            '/foo/baz/': env.rs.caching.ALL,
            '/foo/baf': env.rs.caching.ALL
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: {}
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              common: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              path: '/foo/baf',
              common: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459', 'Content-Type': 'image/jpeg', 'Content-Length': 12345678 }}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': []};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].common.revision, '123');
                test.assertAnd(objs['/foo/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/baf'].common.revision, '456');
                test.assertAnd(objs['/foo/baf'].remote.revision, '459');
                test.assertAnd(objs['/foo/baf'].remote.contentType, 'image/jpeg');
                test.assertAnd(objs['/foo/baf'].remote.contentLength, 12345678);
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a env.rs.caching.SEEN root",
        run: function(env, test) {
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.ALL,
            '/foo/baz/': env.rs.caching.SEEN,
            '/foo/baf': env.rs.caching.SEEN
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: {}
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              common: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              path: '/foo/baf',
              common: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459', 'Content-Type': 'image/jpeg', 'Content-Length': 12345678 }}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': []};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].common.revision, '123');
                test.assertAnd(objs['/foo/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/baf'].common.revision, '456');
                test.assertAnd(objs['/foo/baf'].remote.revision, '459');
                test.assertAnd(objs['/foo/baf'].remote.contentType, 'image/jpeg');
                test.assertAnd(objs['/foo/baf'].remote.contentLength, 12345678);
                test.done();
              });
            }, 100);
          });
        }
      },
      {
        desc: "a success response to a folder GET moves remote to common if no local exists",
        run: function(env, test) {
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.SEEN,
            '/foo/a': env.rs.caching.SEEN
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              remote: { revision: 'fff' },
              common: { itemsMap: {}, timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {a: {ETag: '3'}}, 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/': []};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/'].common, { itemsMap: {}, timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/'].local, undefined);
            test.assertAnd(objs['/foo/'].push, undefined);
            test.assertAnd(objs['/foo/'].remote, { revision: 'fff' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'].common.revision, '123');
                test.assertAnd(objs['/foo/'].common.itemsMap, {a: true});
                test.assertAnd(objs['/foo/'].local, undefined);
                test.assertAnd(objs['/foo/'].push, undefined);
                test.assertAnd(objs['/foo/'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      }
    ]
  });

  return suites;
});
