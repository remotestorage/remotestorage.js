if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [];

  function FakeCaching(){
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
      global.RemoteStorage.config = {
        changeEvents: { local: true, window: false, remote: true, conflict: true }
      };

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
      env.responses1 = {
        '/foo/': 'ALL',
        '/foo/f-common/': 'ALL',
        '/foo/f-created/': 'ALL',
        '/foo/f-changed/': 'ALL',
        '/foo/f-deleted/': 'ALL',
        '/foo/f-common-fetching/': 'ALL',
        '/foo/f-created-fetching/': 'ALL',
        '/foo/f-changed-fetching/': 'ALL',
        '/foo/f-deleted-fetching/': 'ALL',
        '/foo/f-common/a': 'ALL',
        '/foo/f-created/a': 'ALL',
        '/foo/f-changed/a': 'ALL',
        '/foo/f-deleted/a': 'ALL',
        '/foo/f-common-fetching/a': 'ALL',
        '/foo/f-created-fetching/a': 'ALL',
        '/foo/f-changed-fetching/a': 'ALL',
        '/foo/f-deleted-fetching/a': 'ALL',
        '/foo/d-common': 'ALL',
        '/foo/d-created': 'ALL',
        '/foo/d-changed': 'ALL',
        '/foo/d-deleted': 'ALL',
        '/foo/d-common-fetching': 'ALL',
        '/foo/d-created-fetching': 'ALL',
        '/foo/d-changed-fetching': 'ALL',
        '/foo/d-deleted-fetching': 'ALL'
      };
      env.fixture1 = {
        '/foo/': {
          path: '/foo/',
          common: {
            itemsMap: {
              'f-common/': true,
              'f-changed/': true,
              'f-deleted/': true,
              'f-common-fetching/': true,
              'f-changed-fetching/': true,
              'f-deleted-fetching/': true,
              'd-common': true,
              'd-changed': true,
              'd-deleted': true,
              'd-common-fetching': true,
              'd-changed-fetching': true,
              'd-deleted-fetching': true
            }
          },
          local: {
            itemsMap: {
              'f-created/': true,
              'f-changed/': true,
              'f-deleted/': false,
              'f-created-fetching/': true,
              'f-changed-fetching/': true,
              'f-deleted-fetching/': false,
              'd-created': true,
              'd-changed': true,
              'd-deleted': false,
              'd-created-fetching': true,
              'd-changed-fetching': true,
              'd-deleted-fetching': false
            }
          },
          remote: {
            itemsMap: {
              'f-common-fetching/': true,
              'f-created-fetching/': true,
              'f-changed-fetching/': true,
              'f-deleted-fetching/': true,
              'd-common-fetching': true,
              'd-created-fetching': true,
              'd-changed-fetching': true,
              'd-deleted-fetching': true
            }
          }
        },
        '/foo/f-common/': {
          path: '/foo/f-common/',
          common: {
            itemsMap: {
              'a' : true
            }
          }
        },
        '/foo/f-common/a': {
          path: '/foo/f-common/a',
          common: {
            body: 'bloo'
          }
        },
        '/foo/f-created/': {
          path: '/foo/f-created/',
          common: {
          },
          local: {
            itemsMap: {
              'a' : true
            }
          }
        },
        '/foo/f-created/a': {
          path: '/foo/f-created/a',
          common: {
          },
          local: {
            body: 'bloo'
          }
        },
        '/foo/f-changed/': {
          path: '/foo/f-changed/',
          common: {
            itemsMap: {
              'a' : true
            }
          }
        },
        '/foo/f-changed/a': {
          path: '/foo/f-changed/a',
          common: {
            body: 'bloo'
          },
          local: {
            body: 'blooz'
          }
        },
        '/foo/f-deleted/': {
          path: '/foo/f-deleted/',
          common: {
            itemsMap: {
              'a' : true
            }
          },
          local: {
            itemsMap: {
              'a' : false
            }
          }
        },
        '/foo/f-deleted/a': {
          path: '/foo/f-deleted/a',
          common: {
            body: 'bloo'
          },
          local: {
            body: false
          }
        },
        '/foo/d-common': {
          path: '/foo/d-common',
          common: {
            body: 'bloo'
          }
        },
        '/foo/d-created': {
          path: '/foo/d-created',
          common: {
          },
          local: {
            body: 'bloo'
          }
        },
        '/foo/d-changed': {
          path: '/foo/d-changed',
          common: {
            body: 'bloo',
            contentType: 'text/plain',
            revision: '123'
          },
          local: {
            body: 'blooz'
          }
        },
        '/foo/d-deleted': {
          path: '/foo/d-deleted',
          common: {
            body: 'bloo'
          },
          local: {
            body: false
          }
        },
        '/foo/f-common-fetching/': {
          path: '/foo/f-common-fetching/',
          common: {
            itemsMap: {
              'a' : true
            }
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/f-common-fetching/a': {
          path: '/foo/f-common-fetching/a',
          common: {
            body: 'bloo'
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/f-created-fetching/': {
          path: '/foo/f-created-fetching/',
          common: {
          },
          local: {
            itemsMap: {
              'a' : true
            }
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/f-created-fetching/a': {
          path: '/foo/f-created-fetching/a',
          common: {
          },
          local: {
            body: 'bloo'
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/f-changed-fetching/': {
          path: '/foo/f-changed-fetching/',
          common: {
            itemsMap: {
              'a' : true
            }
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/f-changed-fetching/a': {
          path: '/foo/f-changed-fetching/a',
          common: {
            body: 'bloo'
          },
          local: {
            body: 'blooz'
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/f-deleted-fetching/': {
          path: '/foo/f-deleted-fetching/',
          common: {
            itemsMap: {
              'a' : true
            }
          },
          local: {
            itemsMap: {
              'a' : false
            }
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/f-deleted-fetching/a': {
          path: '/foo/f-deleted-fetching/a',
          common: {
            body: 'bloo'
          },
          local: {
            body: false
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/d-common-fetching': {
          path: '/foo/d-common-fetching',
          common: {
            body: 'bloo'
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/d-created-fetching': {
          path: '/foo/d-created-fetching',
          common: {
          },
          local: {
            body: 'bloo'
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/d-changed-fetching': {
          path: '/foo/d-changed-fetching',
          common: {
            body: 'bloo'
          },
          local: {
            body: 'blooz'
          },
          remote: {
            revision: 'unfetched'
          }
        },
        '/foo/d-deleted-fetching': {
          path: '/foo/d-deleted-fetching',
          common: {
            body: 'bloo'
          },
          local: {
            body: false
          },
          remote: {
            revision: 'unfetched'
          }
        }
      };
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
        desc: "collectRefreshTasks requests the parent rather than the stale node itself, if it is not a read-access root",
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
            return env.rs.sync.collectRefreshTasks();
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
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a 'ALL' root",
        run: function(env, test) {
          test.assertAnd(env.rs.sync._tasks, {});
          test.assertAnd(env.rs.sync._running, {});
          env.rs.caching._responses = {
            '/foo/': 'FLUSH',
            '/foo/baz/': 'ALL',
            '/foo/baf': 'ALL'
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
            env.rs.remote._responses[['get', '/foo/baz/' ]] =
              [500, '', '', ''];
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
        desc: "an incoming folder listing stores new revisions to existing child nodes if under a 'SEEN' root",
        run: function(env, test) {
          env.rs.caching._responses = {
            '/foo/': 'ALL',
            '/foo/baz/': 'SEEN',
            '/foo/baf': 'SEEN'
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
            env.rs.remote._responses[['get', '/foo/baz/' ]] =
              [500, '', '', ''];
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
        desc: "an incoming folder listing removes items from common and remote but not from local",
        run: function(env, test) {
          env.rs.caching._responses = env.responses1;
          env.rs.local.setNodes(env.fixture1).then(function() {
            env.rs.remote._responses[['get', '/foo/' ]] =
              [200, {}, 'application/json', '123'];
            env.rs.remote._responses[['get', '/foo/', {ifNoneMatch: '123'} ]] =
              [200, {}, 'application/json', '123'];
            env.rs.remote._responses[['get', '/foo/f-created/' ]] =
              [500, {}, 'application/json', '123'];
            env.rs.remote._responses[["put","/foo/f-created/a","bloo",null,{"ifNoneMatch":"*"}]] =
              [500, '', '', ''];
            env.rs.sync._tasks = {'/foo/': []};
            env.rs.sync.doTasks();
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/f-common/', '/foo/f-created/', '/foo/f-changed/', '/foo/f-deleted/',
                  '/foo/f-common/a', '/foo/f-created/a', '/foo/f-changed/a', '/foo/f-deleted/a',
                  '/foo/d-common', '/foo/d-created', '/foo/d-changed', '/foo/d-deleted',
                  '/foo/f-common-fetching/', '/foo/f-created-fetching/', '/foo/f-changed-fetching/', '/foo/f-deleted-fetching/',
                  '/foo/f-common-fetching/a', '/foo/f-created-fetching/a', '/foo/f-changed-fetching/a', '/foo/f-deleted-fetching/a',
                  '/foo/d-common-fetching', '/foo/d-created-fetching', '/foo/d-changed-fetching', '/foo/d-deleted-fetching']).then(function(objs) {

                test.assertAnd(objs['/foo/f-common/'], undefined);
                test.assertAnd(objs['/foo/f-created/'].local.itemsMap.a, true);
                test.assertAnd(objs['/foo/f-changed/'], undefined);
                test.assertAnd(objs['/foo/f-deleted/'], undefined);
                test.assertAnd(objs['/foo/f-common-fetching/'], undefined);

                //the created-fetching case is discussable, because on the one hand,
                //data was created locally so you may want to preserve that,
                //but on the other hand, there is a remote deletion, which should also not be
                //ignored. choosing to let the client win in this case:
                test.assertAnd(objs['/foo/f-created-fetching/'].local.itemsMap.a, true);
                test.assertAnd(objs['/foo/f-changed-fetching/'], undefined);
                test.assertAnd(objs['/foo/f-deleted-fetching/'], undefined);

                test.assertAnd(objs['/foo/f-common/a'], undefined);
                test.assertAnd(objs['/foo/f-created/a'].local.body, 'bloo');
                test.assertAnd(objs['/foo/f-changed/a'].common, {});
                test.assertAnd(objs['/foo/f-deleted/a'].common, {});
                test.assertAnd(objs['/foo/f-common-fetching/a'], undefined);
                test.assertAnd(objs['/foo/f-created-fetching/a'].local.body, 'bloo');
                test.assertAnd(objs['/foo/f-changed-fetching/a'].common, {});
                test.assertAnd(objs['/foo/f-deleted-fetching/a'].common, {});

                //i'm also not sure why no tombstones are created on the first tree depth:
                test.assertAnd(objs['/foo/d-common'], undefined);
                test.assertAnd(objs['/foo/d-created'].local.body, 'bloo');
                test.assertAnd(objs['/foo/d-changed'], undefined);
                test.assertAnd(objs['/foo/d-deleted'], undefined);
                test.assertAnd(objs['/foo/d-common-fetching'], undefined);
                test.assertAnd(objs['/foo/d-created-fetching'].local.body, 'bloo');
                test.assertAnd(objs['/foo/d-changed-fetching'], undefined);
                test.assertAnd(objs['/foo/d-deleted-fetching'], undefined);

                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "an incoming deletion triggers a change event",
        run: function(env, test) {
          var fixture = {
            '/foo/': {
              path: '/foo/',
              common: {
                itemsMap: {
                  'item1': 'rev1-1',
                  'item2': 'rev2-1'
                },
                revision: 'dir-rev1',
                timestamp: 1396524337906
              }
            },
            '/foo/item1': { path: '/foo/item1',
              common: { body: 'body1', contentType: 'text/plain', revision: 'rev1-1', timestamp: 1396524337906 }
            },
            '/foo/item2': { path: '/foo/item2',
              common: { body: 'body2', contentType: 'text/plain', revision: 'rev2-1', timestamp: 1396524337906 }
            }
          };

          var response = {
            'item1': {ETag: 'rev1-1', 'Content-Type': 'text/plain', 'Content-Length': 12345678 }
          };

          env.rs.caching._responses = env.responses1;

          env.rs.local.setNodes(fixture).then(function() {
            var expectedBody = {
              '/foo/item2': 'body2'
            };
            env.rs.remote._responses[['get', '/foo/', {ifNoneMatch: 'dir-rev1'} ]] =
              [200, response, 'application/json', 'changedrevision'];

            env.rs.sync._tasks = {'/foo/': []};

            env.rs.local.on('change', function(event) {
              test.assertAnd(event.path, '/foo/item2');
              test.assertAnd(event.oldValue, 'body2');
              test.assertAnd(event.newValue, undefined);
              test.done();

              if (event.path !== '/foo/item2') {
                test.result(false, 'unexpected change event: '+JSON.stringify(event));
              }
            });

            env.rs.sync.doTasks();
          });
        }
      },


      {
        desc: "a success response to a folder GET moves remote to common if no local exists",
        run: function(env, test) {
          env.rs.caching._responses = {
            '/foo/': 'SEEN',
            '/foo/a': 'SEEN'
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
      },

      {
        desc: "an unchanged incoming document does not delete local changes",
        run: function(env, test) {
          env.rs.caching._responses = env.responses1;
          env.rs.local.setNodes(env.fixture1).then(function() {
            env.rs.sync.handleResponse('/foo/d-created', 'get', 404);
            env.rs.sync.handleResponse('/foo/d-changed', 'get', 200, 'bloo', 'text/plain', '123');
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/d-created', '/foo/d-changed']).then(function(objs) {

                test.assertAnd(objs['/foo/d-created'].local.body, 'bloo');
                test.assertAnd(objs['/foo/d-changed'].local.body, 'blooz');

                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a changed incoming document deletes local changes",
        run: function(env, test) {
          env.rs.caching._responses = env.responses1;
          env.rs.local.setNodes(env.fixture1).then(function() {
            env.rs.sync.handleResponse('/foo/d-created', 'get', 200, 'something else', 'text/plain', '123');
            env.rs.sync.handleResponse('/foo/d-changed', 'get', 200, 'something else', 'text/plain', '123');
            setTimeout(function() {
              env.rs.local.getNodes(['/foo/d-created', '/foo/d-changed']).then(function(objs) {

                test.assertAnd(objs['/foo/d-created'].local, undefined);
                test.assertAnd(objs['/foo/d-changed'].local, undefined);
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a 304 response to a folder GET updates the common timestamp if the ETags match",
        run: function(env, test) {
          env.rs.sync.now = function() { return 2234567890123; };
          env.rs.caching._responses = {
            '/foo/': 'SEEN',
            '/foo/a': 'SEEN'
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: { itemsMap: {}, revision: 'fff', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/', { ifNoneMatch: 'fff' } ]] =
              [304, undefined, undefined, 'fff'];
            env.rs.sync._tasks = {'/foo/': []};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 0);
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'].common, { itemsMap: {}, timestamp: 2234567890123, revision: 'fff' });
                test.assertAnd(objs['/foo/'].local, undefined);
                test.assertAnd(objs['/foo/'].push, undefined);
                test.assertAnd(objs['/foo/'].remote, undefined);
                test.done();
              });
            }, 100);
          });
        }
      },

      {
        desc: "a 304 response to a folder GET does not update the common timestamp if the ETags don't match",
        run: function(env, test) {
          env.rs.sync.now = function() { return 2234567890123; };
          env.rs.caching._responses = {
            '/foo/': 'SEEN',
            '/foo/a': 'SEEN'
          };
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: { itemsMap: {}, revision: 'fff', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.remote._responses[['get', '/foo/', { ifNoneMatch: 'fff' } ]] =
              [304, undefined, undefined, 'something else'];
            env.rs.sync._tasks = {'/foo/': []};
            env.rs.sync.doTasks();
            return env.rs.local.getNodes(['/foo/']);
          }).then(function(objs) {
            test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 1);
            setTimeout(function() {
              test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).length, 0);
              env.rs.local.getNodes(['/foo/']).then(function(objs) {
                test.assertAnd(objs['/foo/'].common, { itemsMap: {}, timestamp: 1234567891000, revision: 'fff' });
                test.assertAnd(objs['/foo/'].local, undefined);
                test.assertAnd(objs['/foo/'].push, undefined);
                //test.assertAnd(objs['/foo/'].remote, { revision: 'something else', timestamp: 2234567890123 });
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
