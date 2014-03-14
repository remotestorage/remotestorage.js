if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs, undefined) {
  var suites = [];

  require('./lib/promising');

  suites.push({
    name: "BaseClient",
    desc: "High-level client, scoped to a path",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      RemoteStorage.log = function() {};
      RemoteStorage.prototype = {
        onChange: function() {},
        caching: {
          SEEN: false,
          ALL: { data: true },
          _rootPaths: {},
          set: function(path, value) {
            this._rootPaths[path] = value;
          }
        }
      };

      require('./src/eventhandling');
      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      require('./src/wireclient');
      if (global.rs_wireclient) {
        RemoteStorage.WireClient = global.rs_wireclient;
      } else {
        global.rs_wireclient = RemoteStorage.WireClient;
      }

      require('./lib/Math.uuid');
      require('./src/baseclient');
      require('./src/baseclient/types');
      if (global.rs_types) {
        RemoteStorage.BaseClient.Types = global.rs_types;
      } else {
        global.rs_types = RemoteStorage.BaseClient.Types;
      }
      test.done();
    },

    tests: [
      {
        desc: "it takes a storage object and base path",
        run: function(env, test) {
          var storage = new RemoteStorage();
          var client = new RemoteStorage.BaseClient(storage, '/foo/');
          test.assertAnd(client.storage, storage);
          test.assertAnd(client.base, '/foo/');
          test.done();
        }
      },

      {
        desc: "it doesn't accept non-folder paths",
        run: function(env, test) {
          try {
            var storage = new RemoteStorage();
            var client = new RemoteStorage.BaseClient(storage, '/foo');
            test.result(false);
          } catch(e) {
            test.done();
          }
        }
      },

      {
        desc: "it detects the module name correctly",
        run: function(env, test) {
          var storage = new RemoteStorage();
          var rootClient = new RemoteStorage.BaseClient(storage, '/');
          var moduleClient = new RemoteStorage.BaseClient(storage, '/contacts/');
          var nestedClient = new RemoteStorage.BaseClient(storage, '/email/credentials/');
          test.assertAnd(rootClient.moduleName, 'root');
          test.assertAnd(moduleClient.moduleName, 'contacts');
          test.assertAnd(nestedClient.moduleName, 'email');
          test.done();
        }
      },

      {
        desc: "it installs a change handler for its base",
        run: function(env, test) {
          var storage = new RemoteStorage();
          storage.onChange = function(path, handler) {
            test.assertTypeAnd(handler, 'function');
            test.assertAnd(path, '/foo/');
            test.done();
          };
          var client = new RemoteStorage.BaseClient(storage, '/foo/');
        }
      },

      {
        desc: "it understands the 'change' events",
        run: function(env, test) {
          var client = new RemoteStorage.BaseClient(new RemoteStorage(), '/foo/');
          client.on('change', function() {});
          test.done();
        }
      }
    ]
  });

  suites.push({
    desc: "BaseClient folder handling",
    setup: function(env, test) {
      if (typeof(RemoteStorage) !== 'function') {
        global.RemoteStorage = function() {};
        RemoteStorage.prototype = {
          onChange: function() {}
        };
      }
      if (typeof(RemoteStorage.BaseClient) !== 'function') {
        require('./src/eventhandling');
        require('./src/baseclient');
      }
      test.done();
    },

    beforeEach: function(env, test) {
      env.storage = new RemoteStorage();
      env.client = new RemoteStorage.BaseClient(env.storage, '/foo/');
      test.done();
    },

    tests: [
      {
        desc: "#getListing performs a 'get' request",
        run: function(env, test) {
          env.storage.get = function(path) {
            test.assert(path, '/foo/bar/');
            return promising().fulfill(404);
          };
          env.client.getListing('bar/');
        }
      },

      {
        desc: "#getListing results in 'undefined' when it sees '404'",
        run: function(env, test) {
          env.storage.get = function(path) { return promising().fulfill(404); };
          env.client.getListing('bar/').then(function(result) {
            test.assertType(result, 'undefined');
          });
        }
      },

      {
        desc: "#getListing fails when it gets a document path",
        run: function(env, test) {
          try {
            env.client.getListing('bar');
            test.result(false);
          } catch(e) {
            test.done();
          }
        }
      },

      {
        desc: "#getListing accepts an empty path",
        run: function(env, test) {
          env.storage.get = function(path) { return promising().fulfill(404); };
          try {
            env.client.getListing('');
            test.done();
          } catch(e) {
            test.result(false);
          }
        }
      },

      {
        desc: "#getListing forwards folder listing object",
        run: function(env, test) {
          env.storage.get = function(path) {
            return promising().fulfill(200, { 'foo': {"ETag":'bar'}, 'baz/': {"ETag":'bla'} });
          };
          env.client.getListing('').then(function(result) {
            test.assert(result, { 'foo': {"ETag":'bar'}, 'baz/': {"ETag":'bla'} });
          });
        }
      },

      {
        desc: "#getListing rejects the promise on error",
        run: function(env, test) {
          env.storage.get = function(path) {
            return promising().reject('Broken');
          };
          env.client.getListing('').then(function() {
            test.result(false);
          }, function(error) {
            test.assert(error, 'Broken');
            test.done();
          });
        }
      },

      {
        desc: "#getListing results in 'undefined' when it sees a 404",
        run: function(env, test) {
          env.storage.get = function(path) {
            return promising().fulfill(404);
          };
          env.client.getListing('').then(function(result) {
            test.assertType(result, 'undefined');
          });
        }
      },

      {
        desc: "#getAll results in 'undefined' when it sees a 404",
        run: function(env, test) {
          env.storage.get = function(path) {
            return promising().fulfill(404);
          };
          env.client.getAll('').then(function(result) {
            test.assertType(result, 'undefined');
          });
        }
      },

      {
        desc: "#getAll retrieves the listing and then all children",
        run: function(env, test) {
          var expected = { '/foo/': true, '/foo/bar': true, '/foo/baz': true };
          env.storage.get = function(path) {
            var promise = promising();
            if (path === '/foo/') {
              promise.fulfill(200, { bar: true, baz: true });
            } else {
              promise.fulfill(200, "content of " + path);
            }
            delete expected[path];
            if (Object.keys(expected).length === 0) {
              test.done();
            }
            return promise;
          };
          env.client.getAll('');
        }
      },

      {
        desc: "#getAll results in an object with all children's content",
        run: function(env, test) {
          env.storage.get = function(path) {
            var promise = promising();
            if (path === '/foo/') {
              promise.fulfill(200, { bar: true, baz: true });
            } else {
              promise.fulfill(200, "content of " + path);
            }
            return promise;
          };
          env.client.getAll('').then(function(result) {
            test.assert(result, {
              bar: "content of /foo/bar",
              baz: "content of /foo/baz"
            });
          });
        }
      },

      {
        desc: "#getListing treats undefined paths as ''",
        run: function(env, test) {
          env.storage.get = function(path) {
            test.assert(path, '/foo/');
            return promising().fulfill(404);
          };
          env.client.getListing();
        }
      },

      {
        desc: "#getAll treats undefined paths as ''",
        run: function(env, test) {
          env.storage.get = function(path) {
            test.assert(path, '/foo/');
            return promising().fulfill(404);
          };
          env.client.getAll();
        }
      },

      {
        desc: "#scope returns a new BaseClient, scoped to the given sub-path",
        run: function(env, test) {
          var scope = env.client.scope('bar/');
          test.assertTypeAnd(scope, 'object');
          test.assertAnd(scope.base, '/foo/bar/');
          test.done();
        }
      },

      {
        desc: "#uuid returns a different string each time",
        run: function(env, test) {
          var n = 10000;
          var uuids = {};
          for (var i=0;i<n;i++) {
            uuids[env.client.uuid()] = true;
          }
          test.assert(Object.keys(uuids).length, n);
        }
      },

      {
        desc: "#cache enables caching for a given path",
        run: function(env, test) {
          env.client.cache('bar/');
          test.assert(env.storage.caching._rootPaths, {'/foo/bar/': {data: true}});
        }
      },

      {
        desc: "#cache with 'false' flag disables caching for a given path",
        run: function(env, test) {
          env.client.cache('bar/');
          env.client.cache('bar/', false);
          test.assert(env.storage.caching._rootPaths['/foo/bar/'], false);
        }
      },

      {
        desc: "#storeFile",
        run: function(env, test) {
          env.storage.put = function(path, body, contentType, incoming) {
            test.assertAnd(path, '/foo/foo/bar', 'path is '+path+' not /foo/foo/bar');
            test.assertAnd(body, 'abc');
            test.assertType(incoming, 'undefined');
            test.result(true);
            return promising().fulfill(200);
          };
          env.client.storeFile('def', 'foo/bar', 'abc');
        }
      },

      {
        desc: "test storeObject",
        run: function(env, test) {
          env.storage.put = function(path, body, contentType, incoming) {
            test.assertAnd(path, '/foo/foo/bar');
            test.assertAnd(body.test, 1);
            test.assertAnd(contentType, 'application/json; charset=UTF-8');
            test.assertType(incoming, 'undefined');
            test.result(true);
            return promising().fulfill(200);
          };
          env.client.storeObject('test', 'foo/bar', {test: 1});
        }
      },

      {
        desc: "#storeFile doesn't encode the filename",
        run: function(env, test) {
          env.storage.put = function(path, body, contentType, incoming) {
            test.assertAnd(path, '/foo/A%2FB /C/%bla//');
            test.assertAnd(body, 'abc');
            test.assertAnd(contentType, 'def');
            test.assertType(incoming, 'undefined');
            test.result(true);
            return promising().fulfill(200);
          };
          env.client.storeFile('def', 'A%2FB /C/%bla//', 'abc');
        }
      },

      {
        desc: "#getItemURL returns the full item URL",
        run: function(env, test) {
          env.storage.connected = true;
          env.storage.remote = {href: 'http://example.com/test'};

          var itemURL = env.client.getItemURL('A%2FB /C/%bla//D');
          test.assert(itemURL, 'http://example.com/test/foo/A%252FB%20/C/%25bla/D');
        }
      }
    ]
  });

  return suites;
});
