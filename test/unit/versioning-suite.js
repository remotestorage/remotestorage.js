if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];

  function FakeCaching(){
    this.FLUSH = 0;
    this.SEEN = 1;
    this.FOLDERS = 2;
    this.SEEN_AND_FOLDERS = 3;
    this.DOCUMENTS = 4;
    this.ALL = 7;
    
    this._responses = {};
    this.checkPath = function(path) {
      if (typeof(this._responses[path]) === 'undefined') {
        throw new Error('no FakeCaching response for path ' + path + ' have: ' + JSON.stringify(this._responses));
      }
      return this._responses[path];
    };
  }

  function FakeConflicts(){
    this._response;
    this.check = function(obj) {
      return this._response;
    };
  }

  function FakeAccess(){
    this._data = {};
    this.set = function(moduleName, value) {
      this._data[moduleName] = value;
    };
    this.get = function(moduleName) {
      return this._data[moduleName];
    };
    this.checkPath = function(path, mode) {
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
      env.rs.remote = new FakeRemote();
      env.rs.access = new FakeAccess();
      env.rs.caching = new FakeCaching();
      env.conflicts = new FakeConflicts();
      env.rs.sync = new RemoteStorage.Sync(env.rs.local, env.rs.remote, env.rs.access, env.rs.caching, env.conflicts);
      test.done();
    },

    tests: [
      {
        desc: "checkRefresh requests the parent rather than the stale node itself, if it is not an access root",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/read/access/f/o/o/': {
              path: '/read/access/f/o/o/',
              official: {
                body: 'off',
                contentType: 'cT',
                timestamp: 1234567890123
              }
            }
          }).then(function() {
            return env.rs.sync.checkRefresh();
          }).then(function() {
            test.assertAnd(env.rs.sync._tasks, {
              '/read/access/f/o/': true
            });
            test.done();
          });
        }
      },
      {
        desc: "an incoming folder listing creates subfolder nodes if it's under a env.rs.caching.SEEN_AND_FOLDERS root",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar/': { 
              path: '/foo/bar/',
              official: {}
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar/' ]] =
                [200, {'baz/': {ETag: '123'}, 'baf': {ETag: '456', 'Content-Type': 'image/jpeg', 'Content-Length': 12345678 }}, 'application/json', '123'];
            env.rs.caching._responses = {
              '/foo/bar/': env.rs.caching.ALL,
              '/foo/bar/baz/': env.rs.caching.SEEN_AND_FOLDERS,
              '/foo/bar/baf': env.rs.caching.SEEN_AND_FOLDERS
            };
            env.rs.sync._tasks = {'/foo/bar/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar/baz/', '/foo/bar/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baf'], undefined);
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "an incoming folder listing creates subfolder and document nodes if it's under a env.rs.caching.ALL root",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar/': { 
              path: '/foo/bar/',
              official: {} }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar/' ]] =
              [200, {'baz/': {ETag: '123'}, 'baf': {ETag: '456', 'Content-Type': 'image/jpeg', 'Content-Length': 12345678 }}, 'application/json', '123'];
            env.rs.caching._responses = {
              '/foo/bar/': env.rs.caching.FLUSH,
              '/foo/bar/baz/': env.rs.caching.ALL,
              '/foo/bar/baf': env.rs.caching.ALL
            };
            env.rs.sync._tasks = {'/foo/bar/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar/baz/', '/foo/bar/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/bar/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/bar/baf'].official.contentType, 'image/jpeg');
                test.assertAnd(objs['/foo/bar/baf'].official.contentLength, 12345678);
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "an incoming folder listing doesn't store unchanged revisions to its children",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              official: {}
            },
            '/foo/baz/': { 
              path: '/foo/baz/',
              official: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': { 
              path: '/foo/baf',
              official: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '123'}, 'baf': {ETag: '456', 'Content-Type': 'image/jpeg', 'Content-Length': 12345678 }}, 'application/json', '123'];
            env.rs.caching._responses = {
              '/foo/': env.rs.caching.ALL
            };
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/baz/'].remote, undefined);
                test.assertAnd(objs['/foo/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/baf'].remote, undefined);
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a env.rs.caching.ALL root",
        run: function(env, test) {
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.FLUSH,
            '/foo/baz/': env.rs.caching.ALL,
            '/foo/baf': env.rs.caching.ALL
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              official: {}
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              official: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              path: '/foo/baf',
              official: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459', 'Content-Type': 'image/jpeg', 'Content-Length': 12345678 }}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/baf'].official.revision, '456');
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
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a env.rs.caching.SEEN_AND_FOLDERS root",
        run: function(env, test) {
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.FLUSH,
            '/foo/baz/': env.rs.caching.SEEN_AND_FOLDERS,
            '/foo/baf': env.rs.caching.SEEN_AND_FOLDERS
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              official: {}
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              official: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              path: '/foo/baf',
              official: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459', 'Content-Type': 'image/jpeg', 'Content-Length': 12345678 }}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/baf'].official.revision, '456');
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
              official: {}
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              official: { revision: '123', timestamp: 1234567890123 }
            },
            '/foo/baf': {
              path: '/foo/baf',
              official: { revision: '456', timestamp: 1234567890123 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459', 'Content-Type': 'image/jpeg', 'Content-Length': 12345678 }}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].official.revision, '123');
                test.assertAnd(objs['/foo/baz/'].remote.revision, '129');
                test.assertAnd(objs['/foo/baf'].official.revision, '456');
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
        desc: "sub item new revisions stored as official if local exists and onConflict is local",
        run: function(env, test) {
          env.conflicts._response = 'local';
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              official: {}
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              official: { revision: '123', timestamp: 1234567890123 },
              local: { itemsMap: {a: true}, timestamp: 1234567891000 }
            },
            '/foo/baf': {
              path: '/foo/baf',
              official: { revision: '456', timestamp: 1234567890123 },
              local: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459'}}, 'application/json', '123'];
            env.rs.caching._responses = {
              '/foo/': env.rs.caching.ALL
            };
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/', '/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].official.revision, '129');
                test.assertAnd(objs['/foo/baz/'].remote, undefined);
                test.assertAnd(objs['/foo/baz/'].local,
                    { itemsMap: {a: true}, timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/baf'].official.revision, '459');
                test.assertAnd(objs['/foo/baf'].remote, undefined);
                test.assertAnd(objs['/foo/baf'].local,
                    { body: 'a', contentType: 'b', timestamp: 1234567891000 });
                test.done();
              });
            }, 100);
          });
        }
      },
      
      {
        desc: "sub folder new revisions stored as official if local exists and onConflict is remote",
        run: function(env, test) {
          env.conflicts._response = 'remote';
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.ALL,
            '/foo/baz/': env.rs.caching.SEEN,
            '/foo/baf': env.rs.caching.SEEN
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              official: {}
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              official: { revision: '123', timestamp: 1234567890123 },
              local: { itemsMap: {a: true}, timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459'}}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].official.revision, '129');
                test.assertAnd(objs['/foo/baz/'].remote, undefined);
                test.assertAnd(objs['/foo/baz/'].local,
                    { itemsMap: {a: true}, timestamp: 1234567891000 });
                test.done();
              });
            }, 100);
          });
        }
      },
      
      {
        desc: "sub document new revisions stored as remote and local removed if local exists and onConflict is remote",
        run: function(env, test) {
          env.conflicts._response = 'remote';
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.ALL,
            '/foo/baz/': env.rs.caching.SEEN,
            '/foo/baf': env.rs.caching.SEEN
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              official: {}
            },
            '/foo/baf': {
              path: '/foo/baf',
              official: { revision: '456', timestamp: 1234567890123 },
              local: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459'}}, 'application/json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/baf'].remote.revision, '459');
                test.assertAnd(objs['/foo/baf'].local, undefined);
                test.done();
              });
            }, 100);
          });
        }
      },
      
      {
        desc: "sub folder new revisions stored even if local exists and undefined onConflict",
        run: function(env, test) {
          env.conflicts._response = undefined;
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              official: {} 
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              official: { revision: '123', timestamp: 1234567890123 },
              local: { itemsMap: {a: true}, timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459'}}, 'application/json', '123'];
            env.rs.caching._responses = {
              '/foo/': env.rs.caching.ALL,
              '/foo/baz/': env.rs.caching.SEEN,
              '/foo/baf': env.rs.caching.SEEN
            };
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baz/']).then(function(objs) {
                test.assertAnd(objs['/foo/baz/'].official.revision, '129');
                test.assertAnd(objs['/foo/baz/'].remote, undefined);
                test.assertAnd(objs['/foo/baz/'].local,
                    { itemsMap: {a: true}, timestamp: 1234567891000 });
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "sub document new revisions left in conflict if local exists and undefined onConflict",
        run: function(env, test) {
          env.conflicts._response = undefined;
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              official: {} 
            },
            '/foo/baz/': {
              path: '/foo/baz/',
              official: { revision: '123', timestamp: 1234567890123 },
              local: { itemsMap: {a: true}, timestamp: 1234567891000 }
            },
            '/foo/baf': {
              path: '/foo/baf',
              official: { revision: '456', timestamp: 1234567890123 },
              local: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {'baz/': {ETag: '129'}, 'baf': {ETag: '459'}}, 'application/json', '123'];
            env.rs.caching._responses = {
              '/foo/': env.rs.caching.ALL,
              '/foo/baz/': env.rs.caching.SEEN,
              '/foo/baf': env.rs.caching.SEEN
            };
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/baf']).then(function(objs) {
                test.assertAnd(objs['/foo/baf'].official.revision, '456');
                test.assertAnd(objs['/foo/baf'].remote.revision, '459');
                test.assertAnd(objs['/foo/baf'].local,
                    { body: 'a', contentType: 'b', timestamp: 1234567891000 });
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a PUT moves local to official",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar', 'asdf', 'qwer', { ifNoneMatch: '*' } ]] = [200, '', '', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'asdf');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'qwer');
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "when push completes but local changes exist since, the push version (not the local) becomes official",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar', 'asdf', 'qwer', { ifNoneMatch: '*' } ]] = [200, '', '', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            //delete the local version while it's being pushed out:
            objs['/foo/bar'].local = { timestamp: 1234567899999 };
            return env.rs.local.setNodes({
              '/foo/bar': objs['/foo/bar']
            });
          }).then(function() {
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'asdf');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'qwer');
                //check that racing local is preserved:
                test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567899999 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a DELETE moves local to official",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar', { ifMatch: '987' } ]] = [200];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, undefined);
            test.assertAnd(objs['/foo/bar'].push.contentType, undefined);
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, undefined);
                test.assertAnd(objs['/foo/bar'].official.body, undefined);
                test.assertAnd(objs['/foo/bar'].official.contentType, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a folder GET moves remote to official if no local exists",
        run: function(env, test) {
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.SEEN,
            '/foo/a': env.rs.caching.SEEN
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              remote: { revision: 'fff' },
              official: { itemsMap: {}, timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {a: {ETag: '3'}}, 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/'].official, { itemsMap: {}, timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/'].local, undefined);
            test.assertAnd(objs['/foo/'].push, undefined);
            test.assertAnd(objs['/foo/'].remote, { revision: 'fff' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'].official.revision, '123');
                test.assertAnd(objs['/foo/'].official.itemsMap, {a: {'ETag': '3'}});
                test.assertAnd(objs['/foo/'].local, undefined);
                test.assertAnd(objs['/foo/'].push, undefined);
                test.assertAnd(objs['/foo/'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a folder GET fires no conflict even if a local exists",
        run: function(env, test) {
          env.rs.local.on('conflict', function() {
            test.result(false, 'onConflict was fired');
          });
          env.rs.caching._responses = {
            '/foo/': env.rs.caching.SEEN,
            '/foo/a': env.rs.caching.SEEN
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              remote: { revision: 'fff' },
              official: { itemsMap: {}, timestamp: 1234567891000 },
              local: { itemsMap: {a: true, b: {ETag: 'aaa'}}, timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {a: {ETag: '3'}}, 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/'].official, { itemsMap: {}, timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/'].local, { itemsMap: {a: true, b: {ETag: 'aaa'}}, timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/'].push, undefined);
            test.assertAnd(objs['/foo/'].remote, { revision: 'fff' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'].official.revision, '123');
                test.assertAnd(objs['/foo/'].official.itemsMap, {a: {'ETag': '3'}});
                test.assertAnd(objs['/foo/'].local,
                    { itemsMap: {a: true, b: {ETag: 'aaa'}}, timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/'].push, undefined);
                test.assertAnd(objs['/foo/'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a document GET moves remote to official if no local exists",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar' ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: 'fff' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'zz');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'application/ld+json');
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a document GET can resolve conflicts as 'local' if local exists",
        run: function(env, test) {
          env.conflicts._response = 'local';
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar' ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: 'fff' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            //now add a local while the request is running:
            return env.rs.local.setNodes({
              '/foo/bar': {
                path: '/foo/bar',
                remote: { revision: 'fff' },
                official: { body: 'a', contentType: 'b', timestamp: 1234567891000 },
                local: { body: 'ab', contentType: 'bb', timestamp: 1234567891001 }
              }
            });
          }).then(function() {
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'zz');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'application/ld+json');
                test.assertAnd(objs['/foo/bar'].local, { body: 'ab', contentType: 'bb', timestamp: 1234567891001 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a document GET can resolve conflicts as 'remote' if local exists",
        run: function(env, test) {
          env.conflicts._response = 'remote';
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar' ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: 'fff' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            //now add a local while the request is running:
            return env.rs.local.setNodes({
              '/foo/bar': {
                path: '/foo/bar',
                remote: { revision: 'fff' },
                official: { body: 'a', contentType: 'b', timestamp: 1234567891000 },
                local: { body: 'ab', contentType: 'bb', timestamp: 1234567891001 }
              }
            });
          }).then(function() {
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'zz');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'application/ld+json');
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a success response to a document GET becomes a conflict if local exists and onConflict doesn't resolve it",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              remote: { revision: 'fff' },
              official: { body: 'a', contentType: 'b', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/bar' ]] =
              [200, 'zz', 'application/ld+json', '123'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: 'fff' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            //now add a local while the request is running:
            objs['/foo/bar'].local = { body: 'ab', contentType: 'bb', timestamp: 1234567891001 };
            return env.rs.local.setNodes({
              '/foo/bar': objs['/foo/bar']
            });
          }).then(function() {
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, '123');
                test.assertAnd(objs['/foo/bar'].remote.body, 'zz');
                test.assertAnd(objs['/foo/bar'].remote.contentType, 'application/ld+json');
                test.assertAnd(objs['/foo/bar'].local, { body: 'ab', contentType: 'bb', timestamp: 1234567891001 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].official, { body: 'a', contentType: 'b', timestamp: 1234567891000 });
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a failure response to a PUT removes the push version",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar', 'asdf', 'qwer', { ifMatch: '987' } ]] = [573, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local,
                { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official,
                    { revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local,
                    { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a failure response to a DELETE removes the push version",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar', { ifMatch: '987' } ]] =
              [480, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, undefined);
            test.assertAnd(objs['/foo/bar'].push.contentType, undefined);
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a failure response to a document GET leaves things as they are",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              remote: { revision: '988' }
            }
          }).then(function() {
            //ifNoneMatch header doesn't make a difference here:
            env.rs.remote._responses[['get', '/foo/bar' ]] = ['a', '', '', ''];
            env.rs.remote._responses[['get', '/foo/bar', { ifNoneMatch: '987' } ]] = ['a', '', '', ''];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, undefined);
            test.assertAnd(objs['/foo/bar'].push, undefined);
            test.assertAnd(objs['/foo/bar'].remote, { revision: '988' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, { revision: '988' });
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },
      
      {
        desc: "a failure response to a folder GET leaves things as they are",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar/': {
              path: '/foo/bar/',
              official: { itemsMap: {asdf: {ETag: 'qwer'}}, revision: '987', timestamp: 1234567890123 },
              remote: { revision: '988' }
            }
          }).then(function() {
            //ifNoneMatch header doesn't make a difference here:
            env.rs.remote._responses[['get', '/foo/bar/', { ifNoneMatch: '987' } ]] = [685, '', '', ''];
            env.rs.remote._responses[['get', '/foo/bar/' ]] = [685, '', '', ''];
            env.rs.sync._tasks = {'/foo/bar/': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar/']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar/'].official,
                { itemsMap: {asdf: {ETag: 'qwer'}}, revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar/'].local, undefined);
            test.assertAnd(objs['/foo/bar/'].push, undefined);
            test.assertAnd(objs['/foo/bar/'].remote, { revision: '988' });
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar/']).then(function(objs) {
                test.assertAnd(objs['/foo/bar/'].official,
                    { itemsMap: {asdf: {ETag: 'qwer'}}, revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar/'].local, undefined);
                test.assertAnd(objs['/foo/bar/'].push, undefined);
                test.assertAnd(objs['/foo/bar/'].remote, { revision: '988' });
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a PUT obeys a 'local' conflict handler if there is one",
        run: function(env, test) {
          env.conflicts._response = 'local';
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar', 'asdf', 'qwer', { ifMatch: '987' } ]] = [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local,
                { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              //to make local win, the revision should be made official, so that the request goes through next time
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].local,
                    { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a DELETE obeys a 'local' conflict handler if there is one",
        run: function(env, test) {
          env.conflicts._response = 'local';
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar', { ifMatch: '987' } ]] = [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, undefined);
            test.assertAnd(objs['/foo/bar'].push.contentType, undefined);
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              //to make local win, the revision should be made official, so that the request goes through next time
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].official.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a PUT obeys a 'remote' conflict handler if there is one",
        run: function(env, test) {
          env.conflicts._response = 'remote';
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar', 'asdf', 'qwer', { ifMatch: '987' } ]] = [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local,
                { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              //to make remote win, the revision should be made remote, and local should be deleted
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].official,
                    { revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a DELETE obeys a 'remote' conflict handler if there is one",
        run: function(env, test) {
          env.conflicts._response = 'remote';
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar', { ifMatch: '987' } ]] = [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, undefined);
            test.assertAnd(objs['/foo/bar'].push.contentType, undefined);
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              //to make remote win, the revision should be made remote, and local should be deleted
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a PUT obeys 'fetch' if there is no conflict handler",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['put', '/foo/bar', 'asdf', 'qwer', { ifMatch: '987' } ]] = [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local,
                { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, 'asdf');
            test.assertAnd(objs['/foo/bar'].push.contentType, 'qwer');
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].official,
                    { revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 });
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a conflict response to a DELETE obeys 'fetch' if there is no conflict handler",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              official: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['delete', '/foo/bar', { ifMatch: '987' } ]] = [412, '', '', 'fff'];
            env.rs.sync._tasks = {'/foo/bar': true};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/bar']);
          }).then(function(objs) {
            test.assertAnd(objs['/foo/bar'].official,
                { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
            test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
            test.assertAnd(objs['/foo/bar'].push.body, undefined);
            test.assertAnd(objs['/foo/bar'].push.contentType, undefined);
            test.assertAnd(objs['/foo/bar'].remote, undefined);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              //to make remote win, the revision should be made remote, and local should be deleted
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                test.assertAnd(objs['/foo/bar'].remote.revision, 'fff');
                test.assertAnd(objs['/foo/bar'].official,
                    { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 });
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, { timestamp: 1234567891000 });
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "non-existing document GET requests become official if successful",
        run: function(env, test) {
          env.rs.remote._responses [['get', '/foo/bar',]] = [200, 'asdf', 'qwer', '123'];
          env.rs.sync._tasks = {'/foo/bar': []};
          env.rs.sync.doTasks();
          env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
            test.assertAnd(objs['/foo/bar'], undefined);
            console.log(env.rs.sync._running);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running), ['/foo/bar']);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/bar']).then(function(objs) {
                console.log('objs', objs);
                test.assertAnd(objs['/foo/bar'].official.revision, '123');
                test.assertAnd(objs['/foo/bar'].official.body, 'asdf');
                test.assertAnd(objs['/foo/bar'].official.contentType, 'qwer');
                test.assertAnd(objs['/foo/bar'].push, undefined);
                test.assertAnd(objs['/foo/bar'].local, undefined);
                test.assertAnd(objs['/foo/bar'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "non-existing folder refresh GET requests become official if successful",
        run: function(env, test) {
          env.rs.remote._responses [['get', '/foo/',]] = [200, {a: {ETag: 'aaa'}}, 'application/ld+json', 'fff'];
          env.rs.sync._tasks = {'/foo/': []};
          env.rs.sync.doTasks();
          env.rs.local.getNodes(['/foo/']).then(function(objs) {
            test.assertAnd(objs['/foo/'], undefined);
            console.log(env.rs.sync._running);
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running), ['/foo/']);
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                console.log('objs', objs);
                test.assertAnd(objs['/foo/'].official.revision, '123');
                test.assertAnd(objs['/foo/'].official.itemsMap, {a: {ETag: 'aaa'}});
                test.assertAnd(objs['/foo/'].push, undefined);
                test.assertAnd(objs['/foo/'].local, undefined);
                test.assertAnd(objs['/foo/'].remote, undefined);
                test.assertAnd(env.rs.sync._running, {});
                test.done();
              });
            }, 100);
          });
        }
      },

], nothing: [
      {
        desc: "when a document is missing from an incoming folder and it has no local changes, it is removed",
        run: function(env, test) {
          test.result(false, 'TODO 1');
        }
      },

      {
        desc: "when a document is missing from an incoming folder and it has local changes, and resolution is 'local', official is set to empty",
        run: function(env, test) {
          test.result(false, 'TODO 2');
        }
      },

      {
        desc: "when a document is missing from an incoming folder and it has local changes, and resolution is 'remote', official is set to empty and local is removed",
        run: function(env, test) {
          test.result(false, 'TODO 3');
        }
      },

      {
        desc: "when a document is missing from an incoming folder and it has local changes, and resolution is 'wait/fetch', remote is set to empty",
        run: function(env, test) {
          test.result(false, 'TODO 4');
        }
      },

      {
        desc: "when a sub folder is missing from an incoming folder, the parts of its subtree have no local changes, are removed recursively",
        run: function(env, test) {
          test.result(false, 'TODO 5');
        }
      },

      {
        desc: "when a sub folder is missing from an incoming folder, documents in its subtree that have local changes, are resolved as individual remote deletions",
        run: function(env, test) {
          test.result(false, 'TODO 6');
        }
      },

      {
        desc: "when a document comes back 404, and it has no local changes, it is removed",
        run: function(env, test) {
          test.result(false, 'TODO 7');
        }
      },

      {
        desc: "when a document comes back 404, and it has local changes, it is resolved according to its conflict handling",
        run: function(env, test) {
          test.result(false, 'TODO 8');
        }
      },

      {
        desc: "when a folder comes back 404, the parts of its subtree have no local changes, are removed recursively",
        run: function(env, test) {
          test.result(false, 'TODO 9');
        }
      },

      {
        desc: "when a document comes back 404, and it has local changes, documents in its subtree that have local changes, are resolved as individual remote deletions",
        run: function(env, test) {
          test.result(false, 'TODO 10');
        }
      },

      {
        desc: "when a folder listing comes in and adds items to .official that are not in .local, and the child node exists, add it to .local and make child conflict",
        run: function(env, test) {
          var resolveThis = {
            path: '/foo/',
            official: { items: {}},
            local: { items: { 'bar/': true }},
            remote: { items: { 'baz/': {ETag: '1'}}}
          };
          //solution:
          //if a baz/ node exists but it's deleted in local, add a remote to baz/ so it comes in conflict, and add baz/ to the /foo/ local
          test.result(false, 'TODO 11');
        }
      },

      {
        desc: "when a folder listing comes in and adds items to .official that are not in .local, and the child node does not exists, add it to .local + create child",
        run: function(env, test) {
          var resolveThis = {
            path: '/foo/',
            official: { items: {}},
            local: { items: { 'bar/': true }},
            remote: { items: { 'baz/': {ETag: '1'}}}
          };
          //solution:
          //if no baz/ node exists, then it's not a conflict; create it, and add baz/ to local
          test.result(false, 'TODO 12');
        }
      },

      {
        desc: "folder listing items to .official not in .local, and the child node has a .push but an empty .local, add it to .local and make child conflict",
        run: function(env, test) {
          var resolveThis = {
            path: '/foo/',
            official: { items: {}},
            local: { items: { 'bar/': true }},
            remote: { items: { 'baz/': {ETag: '1'}}}
          };
          //solution:
          //if a baz/ node exists and it's still pushing but it's also already deleted in local, add a remote to baz/ so it comes in conflict, and add baz/ to the /foo/ local
          test.result(false, 'TODO 11');
        }
      },
    ]
  });

  return suites;
});
