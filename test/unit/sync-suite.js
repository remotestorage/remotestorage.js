if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define(['./build/util', 'require', 'test/helpers/mocks'], function(util, require, mocks) {
  var suites = [];

  suites.push({
    name: "Sync Suite",
    desc: "testing the sync adapter instance",

    setup: function(env, test){
      mocks.defineMocks(env);

      global.Authorize = require('./build/authorize');
      global.UnauthorizedError = require('./build/unauthorized-error');
      global.config = require('./build/config');
      global.EventHandling = require('./build/eventhandling').EventHandling;
      global.Sync = require('./build/sync').Sync;
      global.InMemoryStorage = require('./build/inmemorystorage');

      class RemoteStorage { static log () {} }
      util.applyMixins(RemoteStorage, [EventHandling]);
      global.RemoteStorage = RemoteStorage;

      var RS = require('./build/remotestorage').RemoteStorage;
      RemoteStorage.prototype.stopSync = RS.prototype.stopSync;
      RemoteStorage.prototype.startSync = RS.prototype.startSync;
      RemoteStorage.prototype.getSyncInterval = RS.prototype.getSyncInterval;
      RemoteStorage.prototype.setSyncInterval = RS.prototype.setSyncInterval;
      RemoteStorage.prototype.isValidInterval = RS.prototype.isValidInterval;

      test.done();
    },

    beforeEach: function(env, test) {
      env.rs = new RemoteStorage();
      env.rs.addEvents(['sync-req-done', 'sync-done', 'ready', 'connected', 'sync-interval-change', 'error']);
      env.rs.local = new InMemoryStorage();
      env.rs.remote = new FakeRemote();
      env.rs.access = new FakeAccess();
      env.rs.caching = new FakeCaching();
      env.rs.sync = new Sync(env.rs);
      global.remoteStorage = env.rs;

      env.rs.sync.numThreads = 5;
      env.rs.remote.connected = true;
      env.rs.remote.online = true;
      env.rs.sync._tasks = {};
      env.rs.sync._running = {};

      test.done();
    },

    tests: [
      {
        desc: "sync will stop the current task cycle on timeout",
        run: function(env, test) {
          test.assertAnd(env.rs.sync._tasks, {});
          test.assertAnd(env.rs.sync._running, {});

          env.rs.caching._responses['/foo1/'] = 'ALL';
          env.rs.caching._responses['/foo2/'] = 'ALL';
          env.rs.remote._responses[['get', '/foo1/' ]] = {statusCode: 'timeout'};
          env.rs.remote._responses[['get', '/foo2/' ]] = {statusCode: 200};

          env.rs.sync.numThreads = 1;
          env.rs.remote.connected = true;
          env.rs.sync._tasks = {
            '/foo1/': true,
            '/foo2/': true
          };
          env.rs.sync._running = {};

          env.rs.on('sync-done', function() {
            test.assertAnd(env.rs.sync._running, {});
            test.assertAnd(env.rs.sync._tasks, {
              '/foo1/': true,
              '/foo2/': true
            });
            test.done();
          });

          env.rs.sync.doTasks();
        }
      },

      {
        desc: "collectDiffTasks will not enqueue requests outside the access scope",
        run: function(env, test) {
          env.rs.sync.numThreads = 5;
          env.rs.remote.connected = true;
          env.rs.remote.online = true;
          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              common: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              local: { body: false, timestamp: 1234567891000 }
            },
            '/public/nothings/bar': {
              path: '/public/nothings/bar',
              common: { revision: '987', timestamp: 1234567890123 },
              local: { body: 'asdf', contentType: 'qwer', timestamp: 1234567891000 }
            }
          }).then(function() {
            env.rs.sync.collectDiffTasks();
            test.assertAnd(env.rs.sync._tasks, {'/foo/bar': []});
            //env.rs.sync.on('done', function() {
            test.done();
            //});
          });
        }
      },

      {
        desc: "collectDiffTasks retrieves body and Content-Type when a new remote revision is set inside rw access scope",
        run: function(env, test) {
          env.rs.local.setNodes({
            '/nothings/bar': {
              path: '/nothings/bar',
              common: { body: 'asdf', contentType: 'qwer', revision: '987', timestamp: 1234567890123 },
              remote: { revision: '900' }
            },
            '/public/writings/bar': {
              path: '/public/writings/bar',
              common: { revision: '987', timestamp: 1234567890123 },
              remote: { revision: 'a' }
            }
          }).then(function() {
            return env.rs.sync.collectDiffTasks();
          }).then(function() {
            test.assertAnd(env.rs.sync._tasks, {
              '/public/writings/bar': []
            });
            //env.rs.sync.on('done', function() {
            test.done();
            //});
          });
        }
      },

      {
        desc: "sync will discard corrupt cache nodes but try to retrieve them if node.path is readable",
        run: function(env, test) {
          env.rs.access.set('writings', 'r');
          env.rs.access.set('writings', 'rw');
          env.rs.local.setNodes({
            '/writings/bar': {
              path: '/writings/bar',
              common: { body: function() {}, contentType: 3, revision: '987', timestamp: 1234567890123 },
              remote: { revision: 'yes' },
              push: 'no'
            },
            '/writings/baz': {
              common: { body: function() {}, contentType: 3, revision: '987', timestamp: 1234567890123 },
              remote: { revision: 'yes' },
              push: 'no'
            },
            '/writings/baf': {
              path: '/writings/baf',
              remote: { revision: 'yes' }
            }
          }).then(function() {
            return env.rs.sync.collectDiffTasks();
          }).then(function(num) {
            test.assertAnd(num, 2);
            test.assertAnd(env.rs.sync._tasks, {
              '/writings/bar': [],
              '/writings/baf': []
            });
            test.done();
          });
        }
      },

      {
        desc: "sync will reject its promise if the cache is not available",
        run: function(env, test) {
          var tmp = env.rs.forAllNodes;
          env.rs.local.forAllNodes = function(cb) {
            return Promise.reject('i am broken, deal with it!');
          };
          env.rs.sync.sync().then(function() {
            test.result(false, 'sync was supposed to reject its promise');
          }, function(err) {
            test.assertAnd(err, new Error('local cache unavailable'));
            test.done();
          });
          env.rs.forAllNodes = tmp;
        }
      },

      {
        desc: "sync will fulfill its promise as long as the cache is available",
        run: function(env, test) {
          env.rs.sync.sync().then(function() {
            test.done();
          }, function(err) {
            test.result(false, 'sync was supposed to fulfill its promise');
          });
        }
      },

      {
        desc: "get with maxAge requirement is rejected if remote is not connected",
        run: function(env, test) {
          env.rs.remote.connected = false;
          return env.rs.local.get('asdf', 2, env.rs.sync.queueGetRequest.bind(env.rs.sync)).then(function() {
            test.result(false, 'should have been rejected');
          }, function(err) {
            test.done();
          });
        }
      },

      {
        desc: "get with maxAge requirement is rejected if remote is not online",
        willFail: true,
        run: function (env, test) {
          env.rs.remote.online = false;
          return env.rs.local.get('asdf', 2, env.rs.sync.queueGetRequest.bind(env.rs.sync));
        }
      },

      {
        desc: "get with maxAge fetches from remote when no local data exists",
        run: function (env, test) {
          env.rs.caching._responses['/'] = 'ALL';
          env.rs.caching._responses['/foo'] = 'ALL';
          env.rs.remote._responses[['get', '/foo' ]] = {statusCode: 200, body: 'body', contentType: 'text/plain', revision: 'revision'};
          env.rs.remote.connected = true;

          return env.rs.local.get('/foo', 5, env.rs.sync.queueGetRequest.bind(env.rs.sync)).then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, 'body');
            test.assertAnd(r.contentType, 'text/plain');
            test.done();
          });
        }
      },

      {
        desc: "get with maxAge fetches from remote when local data is too old",
        run: function (env, test) {
          env.rs.caching._responses['/'] = 'ALL';
          env.rs.caching._responses['/foo'] = 'ALL';
          env.rs.remote._responses[['get', '/foo' ]] = {statusCode: 200, body: 'body', contentType: 'text/plain', revision: 'revision'};
          env.rs.remote.connected = true;

          return env.rs.local.setNodes({
            '/foo': {
              path: '/foo',
              common: {
                body: 'old data',
                contentType: 'text/html',
                timestamp: new Date().getTime() - 60000
              }
            }
          }).then(function () {
            env.rs.local.get('/foo', 5, env.rs.sync.queueGetRequest.bind(env.rs.sync)).then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, 'body');
              test.assertAnd(r.contentType, 'text/plain');
              test.done();
            });
          });
        }
      },

      {
        desc: "get with maxAge returns local data when it's not outdated",
        run: function (env, test) {
          return env.rs.local.setNodes({
            '/foo': {
              path: '/foo',
              common: {
                body: 'old data',
                contentType: 'text/html',
                timestamp: new Date().getTime() - 60000
              }
            }
          }).then(function () {
            env.rs.local.get('/foo', 120000, env.rs.sync.queueGetRequest.bind(env.rs.sync)).then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, 'old data');
              test.assertAnd(r.contentType, 'text/html');
              test.done();
            });
          });
        }
      },

      {
        desc: "completePush for put without conflict updates 'common', removes 'local' and 'push' from node",
        run: function(env, test) {
          env.rs.caching._responses['/foo/bar'] = 'ALL';

          env.rs.local.setNodes({
            '/foo/bar': {
              path: '/foo/bar',
              local: {
                body: {foo: 'bar'},
                contentType: 'application/json',
                timestamp: 1234567891000
              },
              push: {
                body: {foo: 'bar'},
                contentType: 'application/json',
                timestamp: 1234567891234
              }
            }
          }).then(function() {
            return env.rs.sync.completePush('/foo/bar', 'put', false, '12345');
          }).then(function() {
            env.rs.local.getNodes(['/foo/bar']).then(function(nodes) {
              var node = nodes['/foo/bar'];
              test.assertAnd(node.common.body, {foo: 'bar'});
              test.assertAnd(node.common.contentType, 'application/json');
              test.assertTypeAnd(node.local, 'undefined');
              test.assertType(node.remote, 'undefined');
            });
          });
        }
      },

      {
        desc: "fetching a new document deletes the local itemsMap from parent folder when there are no other pending changes",
        run: function(env, test) {
          env.rs.caching._responses['/foo/'] = 'ALL';
          env.rs.caching._responses['/foo/new'] = 'ALL';
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: {
                itemsMap: {
                  'bar': true,
                  'new': true
                },
                revision: 'remotefolderrevision',
                timestamp: 1397210425598,
              },
              local: {
                itemsMap: {
                  'bar': true,
                  'new': false
                },
                revision: 'localfolderrevision',
                timestamp: 1397210425612
              }
            },
            '/foo/bar': {
              path: '/foo/bar',
              common: {
                body: { foo: 'bar' },
                contentType: 'application/json',
                revision: 'docrevision',
                timestamp: 1234567891000
              }
            }
          }).then(function() {
            return env.rs.sync.handleResponse('/foo/new', 'get', {statusCode: 200, body: { foo: 'new' }, contentType: 'application/json', revision: 'newrevision'});
          }).then(function() {
            env.rs.local.getNodes(['/foo/']).then(function(nodes) {
              var parentNode = nodes['/foo/'];
              test.assertAnd(parentNode.common.itemsMap, { 'bar': true, 'new': true });
              test.assertTypeAnd(parentNode.local, 'undefined');
              test.assertType(parentNode.remote, 'undefined');
            });
          }, test.fail).catch(test.fail);
        }
      },

      {
        desc: "fetching a new document keeps the local itemsMap from parent folder when there are other pending changes",
        run: function(env, test) {
          env.rs.caching._responses['/foo/'] = 'ALL';
          env.rs.caching._responses['/foo/new'] = 'ALL';

          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: {
                itemsMap: {
                  'bar':      true,
                  'new':      true,
                  'othernew': true
                },
                revision: 'remotefolderrevision',
                timestamp: 1397210425598,
              },
              local: {
                itemsMap: {
                  'bar':      true,
                  'new':      false,
                  'othernew': false
                },
                revision: 'localfolderrevision',
                timestamp: 1397210425612
              }
            },
            '/foo/bar': {
              path: '/foo/bar',
              common: {
                body: { foo: 'bar' },
                contentType: 'application/json',
                revision: 'docrevision',
                timestamp: 1234567891000
              }
            }
          }).then(function() {
            return env.rs.sync.handleResponse('/foo/new', 'get', {statusCode: 200, body: { foo: 'new' }, contentType: 'application/json', revision: 'newrevision'});
          }).then(function() {
            env.rs.local.getNodes(['/foo/']).then(function(nodes) {
              var parentNode = nodes['/foo/'];
              test.assertAnd(parentNode.common.itemsMap, { 'bar': true, 'new': true, 'othernew': true });
              test.assertAnd(parentNode.local.itemsMap, { 'bar': true, 'new': true, 'othernew': false });
              test.assertType(parentNode.remote, 'undefined');
            });
          }, test.fail).catch(test.fail);
        }
      },

      {
        desc: "when a document has been deleted remotely, it's removed from local itemsMap",
        run: function(env, test) {
          env.rs.caching._responses['/foo/'] = 'ALL';
          env.rs.caching._responses['/foo/new'] = 'ALL';
          env.rs.caching._responses['/foo/old'] = 'ALL';

          var newItemsMap = {
            'bar': { 'ETag': 'bardocrevision' },
            'new': { 'ETag': 'newdocrevision' }
          };

          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: {
                itemsMap: {
                  'bar': true,
                  'old': true,
                },
                revision: 'remotefolderrevision',
                timestamp: 1397210425598,
              },
              local: {
                itemsMap: {
                  'bar': true,
                  'old': true,
                  'new': true
                },
                revision: 'localfolderrevision',
                timestamp: 1397210425612
              }
            },
            '/foo/bar': {
              path: '/foo/bar',
              common: {
                body: { foo: 'bar' },
                contentType: 'application/json',
                revision: 'bardocrevision',
                timestamp: 1234567891000
              }
            },
            '/foo/old': {
              path: '/foo/old',
              common: {
                body: { foo: 'old' },
                contentType: 'application/json',
                revision: 'olddocrevision',
                timestamp: 1234567891000
              }
            },
            '/foo/new': {
              path: '/foo/new',
              local: {
                body: { foo: 'new' },
                contentType: 'application/json',
                timestamp: 1234567891000
              }
            }
          }).then(function() {
            return env.rs.sync.handleResponse('/foo/', 'get', {statusCode: 200, body: newItemsMap, contentType: 'application/json', revision: 'newfolderrevision'});
          }).then(function() {
            env.rs.local.getNodes(['/foo/', '/foo/old']).then(function(nodes) {
              var parentNode = nodes['/foo/'];

              test.assertAnd(parentNode.common.itemsMap, { 'bar': true, 'new': true });
              test.assertTypeAnd(parentNode.local, 'undefined');
              test.assertTypeAnd(parentNode.remote, 'undefined');
              test.assertType(nodes['/foo/old'], 'undefined');
            });
          }, test.fail).catch(test.fail);
        }
      },

      {
        desc: "Setting a wrong (string) sync interval throws an error",
        run: function(env, test) {
          try {
            env.rs.setSyncInterval('60000');
            test.result(false, "setSyncInterval() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "Setting a wrong (small) sync interval throws an error",
        run: function(env, test) {
          try {
            env.rs.setSyncInterval(10);
            test.result(false, "setSyncInterval() didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      },

      {
        desc: "handleResponse emits Unauthorized error for status 401",
        run: function(env, test) {
          env.rs.on('error', function(err) {
            if (err instanceof UnauthorizedError) {
              test.result(true, "handleResponse() emitted Unauthorized error");
            } else {
              test.result(false);
            }
          });
          return env.rs.sync.handleResponse(undefined, undefined, {statusCode: 401}).catch(function(){});
        }
      },

      {
        desc: "handleResponse emits an error for unhandled status codes",
        run: function(env, test) {
          var errorEmitted, errorThrown;

          env.rs.on('error', function(err) {
            if (err instanceof Error) {
              test.assertAnd(err.message, 'HTTP response code 418 received.');
              errorEmitted = true;
              if (errorThrown) {
                test.done();
              }
            } else {
              test.result(false);
            }
          });

          return env.rs.sync.handleResponse(undefined, undefined, {statusCode: 418}).then(function() {
            test.result(false);
          }, function(error) {
            test.assertAnd(error.message, 'HTTP response code 418 received.');
            errorThrown = true;
            if (errorEmitted) {
              test.done();
            }
          });
        }
      },

      {
        desc: "deleteRemoteTrees returns a promise",
        run: function(env, test) {
          env.rs.sync.deleteRemoteTrees([], {changed: 'nodes'}).then(function(ret1) {
            test.assertAnd(ret1, {changed: 'nodes'});
            env.rs.sync.deleteRemoteTrees(['foo'], {}).then(function(ret2) {
              test.assertAnd(ret2, undefined);
              test.done();
            });
          });
        }
      },

      {
        desc: "autoMergeDocument leaves a remote version in place even if it has only a revision",
        run: function(env, test) {
          var node = {
            path: 'foo',
            common: { body: 'foo', contentType: 'bloo', revision: 'common' },
            local: { body: 'floo', contentType: 'blaloo' },
            remote: { revision: 'conflict' }
          };
          var result = env.rs.sync.autoMergeDocument(node);
          test.assertAnd(result, node);
          test.done();
        }
      },

      {
        desc: "autoMergeDocument on an empty node removes a remote version if it has a null revision",
        run: function(env, test) {
          var node = {
            path: 'foo',
            common: {},
            remote: { revision: null }
          };
          var remoteRemoved = {
            path: 'foo',
            common: {}
          };
          var result = env.rs.sync.autoMergeDocument(node);
          test.assertAnd(result, remoteRemoved);
          test.done();
        }
      },

      {
        desc: "autoMergeDocument merges mutual deletions (#737)",
        run: function(env, test) {
          var node = {
            "path": "/myfavoritedrinks/b",
            "common": {
              "timestamp": 1405488508303
            },
            "local": {
              "body": false,
              "timestamp": 1405488515881
            },
            "remote": {
              "body": false,
              "timestamp": 1405488740722
            }
          };
          var localAndRemoteRemoved = {
            "path": "/myfavoritedrinks/b",
            "common": {
              "timestamp": 1405488508303
            }
          };
          var result = env.rs.sync.autoMergeDocument(node);
          test.assertAnd(result, localAndRemoteRemoved);
          test.done();
        }
      },

      {
        desc: "autoMerge auto-merges and sends out a change event if a node changed",
        run: function(env, test) {
          var node = {
            path: 'foo',
            common: { body: 'old value', contentType: 'old content-type', revision: 'common' },
            remote: { body: 'new value', contentType: 'new content-type', revision: 'remote' }
          };
          var merged = {
            path: 'foo',
            common: { body: 'new value', contentType: 'new content-type', revision: 'remote' }
          };
          var otherDone = false;

          env.rs.sync.rs.local.emitChange = function(changeEvent) {
            test.assertAnd(changeEvent, {
              origin: 'remote',
              path: 'foo',
              newValue: 'new value',
              oldValue: 'old value',
              newContentType: 'new content-type',
              oldContentType: 'old content-type'
            });
            if (otherDone) {
              test.done();
            } else {
              otherDone = true;
            }
          };
          var result = env.rs.sync.autoMerge(node);
          test.assertAnd(result, merged);
          if (otherDone) {
            test.done();
          } else {
            otherDone = true;
          }
        }
      },

      {
        desc: "autoMerge removes the whole node on 404 and sends out a change event if a node existed before",
        run: function(env, test) {
          var node = {
            path: 'foo',
            common: { body: 'foo', contentType: 'bloo', revision: 'common' },
            remote: { body: false, revision: 'null' }
          };
          var otherDone = false;
          env.rs.sync.rs.local.emitChange = function(obj) {
            test.assertAnd(obj, {
              origin: 'remote',
              path: 'foo',
              oldValue: 'foo',
              newValue: undefined,
              oldContentType: 'bloo',
              newContentType: undefined
            });
            if (otherDone) {
              test.done();
            } else {
              otherDone = true;
            }
          };
          var result = env.rs.sync.autoMerge(node);
          test.assertAnd(result, undefined);
          if (otherDone) {
            test.done();
          } else {
            otherDone = true;
          }
        }
      },

      {
        desc: "autoMerge doesn't send out a change event on 404 if a node didn't exist before",
        run: function(env, test) {
          var node = {
            path: 'foo',
            common: {},
            remote: { body: false, revision: 'null' }
          };
          env.rs.sync.rs.local.emitChange = function(obj) {
            test.result(false, 'should not have emitted '+JSON.stringify(obj));
          };
          var result = env.rs.sync.autoMerge(node);
          test.assertAnd(result, undefined);
          setTimeout(function() {
            test.done();
          }, 100);
        }
      },

      {
        desc: "completePush of a conflict sets revision to the incoming revision, or to 'conflict' if null",
        run: function(env, test) {
          var getNodes = env.rs.sync.rs.local.getNodes,
              setNodes = env.rs.sync.rs.local.setNodes;
          env.rs.caching._responses['foo'] = 'ALL';
          env.rs.sync.rs.local.getNodes = function(paths) {
            test.assertAnd(paths, ['foo']);
            return Promise.resolve({
              foo: {
                path: 'foo',
                common: { body: 'foo', contentType: 'bloo', revision: 'common' },
                local: { body: 'floo', contentType: 'blaloo' },
                push: { body: 'floo', contentType: 'blaloo' }
              }
            });
          };
          env.rs.sync.rs.local.setNodes = function(nodes) {
            test.assert(nodes, {
              foo: {
                path: 'foo',
                common: { body: 'foo', contentType: 'bloo', revision: 'common' },
                local: { body: 'floo', contentType: 'blaloo' },
                remote: { revision: '123', timestamp: 1234567890123 }
              }
            });
            setTimeout(function() {
              env.rs.sync.getNodes = getNodes;
              env.rs.sync.setNodes = setNodes;
              test.done();
            }, 0);
          };
          env.rs.sync.now = function() { return 1234567890123; };
          env.rs.sync.completePush('foo', 'put', true, '123');
        }
      },

      {
        desc: "sync multiple new documents under the same folder while there are local changes should merge folder without missing any document",
        run: function(env, test) {
          test.assertAnd(env.rs.sync._tasks, {});
          test.assertAnd(env.rs.sync._running, {});
          var tmpDoTask = env.rs.sync.doTask;

          env.rs.sync.doTask = function(path) {
            return Promise.resolve({
              action: 'get',
              path,
              promise: Promise.resolve({
                statusCode: 200,
                body: path,
                contentType: 'text/plain',
                revision: path
              })
            });
          };

          env.rs.sync.rs.remote.connected = true;
          env.rs.remote.online = true;
          env.rs.sync._tasks = {
            '/foo/2': true,
            '/foo/3': true,
            '/foo/4': true,
            '/foo/5': true,
            '/foo/6': true,
            '/foo/7': true,
            '/foo/8': true,
            '/foo/9': true,
            '/foo/10': true,
            '/foo/11': true,
          };
          env.rs.sync._running = {};
          env.rs.sync.doTasks();
          test.assertAnd(env.rs.sync._tasks, {
            '/foo/2': true,
            '/foo/3': true,
            '/foo/4': true,
            '/foo/5': true,
            '/foo/6': true,
            '/foo/7': true,
            '/foo/8': true,
            '/foo/9': true,
            '/foo/10': true,
            '/foo/11': true,
          });
          test.assertAnd(Object.getOwnPropertyNames(env.rs.sync._running).sort(), [
            '/foo/2',
            '/foo/3',
            '/foo/4',
            '/foo/5',
            '/foo/6',
          ].sort());
          env.rs.caching._responses['/'] = 'ALL';
          env.rs.caching._responses['/foo/'] = 'ALL';
          env.rs.caching._responses['/foo/1'] = 'ALL';
          for (const t of Object.keys(env.rs.sync._tasks)) {
            env.rs.caching._responses[t] = 'ALL';
          }
          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: {
                itemsMap: {
                  '1': true,
                },
                revision: 'remotefolderrevision',
                timestamp: 1397210425598,
              },
              local: {
                itemsMap: {
                  '1': true
                },
                revision: 'localfolderrevision',
                timestamp: 1397210425612
              }
            },
            '/foo/1': {
              path: '/foo/1',
              local: { body: '/foo/1', contentType: 'test/plain', timestamp: 1234567891000 }
            }
          }).then(() => {
            setTimeout(function () {
              env.rs.local.getNodes(['/foo/']).then(function(nodes) {
                var node = nodes['/foo/'];
                test.assertAnd(node.local.itemsMap, {
                  '1': true,
                  '2': true,
                  '3': true,
                  '4': true,
                  '5': true,
                  '6': true,
                  '7': true,
                  '8': true,
                  '9': true,
                  '10': true,
                  '11': true,
                });
                env.rs.sync.doTask = tmpDoTask;
                test.done()
              });
            }, 100)
          });
        }
      },

      {
        desc: "calling handleResponse multiple times without waiting for it to return should only update index for latest change",
        run: function(env, test) {
          env.rs.caching._responses['/'] = 'ALL';
          env.rs.caching._responses['/foo/'] = 'ALL';
          env.rs.caching._responses['/foo/2'] = 'ALL';
          env.rs.caching._responses['/foo/3'] = 'ALL';

          const nodesFetched = [
            {
              path: '/foo/2',
              action: 'get',
              response: {statusCode: 200, body: { foo: 'new' }, contentType: 'application/json', revision: 'newrevision'},
            },
            {
              path: '/foo/3',
              action: 'get',
              response: {statusCode: 200, body: { foo: 'new' }, contentType: 'application/json', revision: 'newrevision'},
            }
          ]

          env.rs.local.setNodes({
            '/foo/': {
              path: '/foo/',
              common: {
                itemsMap: {
                  '1': false,
                },
                revision: 'remotefolderrevision',
                timestamp: 1397210425598,
              },
              local: {
                itemsMap: {
                  '1': true
                },
                revision: 'localfolderrevision',
                timestamp: 1397210425612
              }
            },
            '/foo/1': {
              path: '/foo/1',
              local: { body: {asdf: 'asdf'}, contentType: 'application/json', timestamp: 1234567891000 }
            }
          }).then(function() {
            const promises = []
            for (const node of nodesFetched){
              promises.push(env.rs.sync.handleResponse(node.path, node.action, node.response))
            }
            return Promise.all(promises)
          }).then(function(){
            return env.rs.local.getNodes(['/foo/', '/foo/1', '/foo/2', '/foo/3'])
          }).then(function(nodes) {
            var parentNode = nodes['/foo/'];
            test.assertAnd(parentNode.local.itemsMap, {
              '1': true,
              '3': true
            });
            test.assertType(nodes['/foo/2'], 'object');
            test.assertType(nodes['/foo/3'], 'object');
            test.done()
          });
        }
      },
    ]
  });

  return suites;
});
