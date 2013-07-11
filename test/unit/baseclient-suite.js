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
      RemoteStorage.prototype = {
        onChange: function() {}
      };
      require('./src/eventhandling');
      if(global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      require('./src/baseclient');
      test.done();
    },
    tests: [
      {
        desc: "it takes a storage object and base path",
        run: function(env, test) {
          var storage = new RemoteStorage;
          var client = new RemoteStorage.BaseClient(storage, '/foo/');
          test.assertAnd(client.storage, storage);
          test.assertAnd(client.base, '/foo/');
          test.done();
        }
      },

      {
        desc: "it doesn't accept non-directory paths",
        run: function(env, test) {
          try {
            new RemoteStorage.BaseClient(new RemoteStorage, '/foo');
            test.result(false);
          } catch(e) {
            test.done();
          }
        }
      },

      {
        desc: "it detects the module name correctly",
        run: function(env, test) {
          var storage = new RemoteStorage;
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
        desc: "it installs a change handler for it's base",
        run: function(env, test) {
          var storage = new RemoteStorage;
          storage.onChange = function(path, handler) {
            test.assertTypeAnd(handler, 'function');
            test.assertAnd(path, '/foo/');
            test.done();
          };
          new RemoteStorage.BaseClient(storage, '/foo/');
        }
      },

      {
        desc: "it understands the 'change' and 'conflict' events",
        run: function(env, test) {
          var client = new RemoteStorage.BaseClient(new RemoteStorage, '/foo/');
          client.on('change', function() {});
          client.on('conflict', function() {});
          test.done();
        }
      }
    ]
  });

  suites.push({
    desc: "BaseClient directory handling",
    setup: function(env, test) {
      if(typeof(RemoteStorage) != 'function') {
        global.RemoteStorage = function() {};
        RemoteStorage.prototype = {
          onChange: function() {}
        };
      }
      if(typeof(RemoteStorage.BaseClient) != 'function') {
        require('./src/eventhandling');
        require('./src/baseclient');
      }
      test.done();
    },

    beforeEach: function(env, test) {
      env.storage = new RemoteStorage;
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
          }
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
        desc: "#getListing results in an array of keys, when it receives an object",
        run: function(env, test) {
          env.storage.get = function(path) {
            return promising().fulfill(200, { foo: 'bar', 'baz/': 'bla' });
          }
          env.client.getListing('').then(function(result) {
            test.assert(result, ['foo', 'baz/']);
          });
        }
      },

      {
        desc: "#getAll results in 'undefined' when it sees a 404",
        run: function(env, test) {
          env.storage.get = function(path) {
            return promising().fulfill(404);
          }
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
            if(path == '/foo/') {
              promise.fulfill(200, { bar: true, baz: true });
            } else {
              promise.fulfill(200, "content of " + path);
            }
            delete expected[path];
            if(Object.keys(expected).length == 0) {
              test.done();
            }
            return promise;
          }
          env.client.getAll('');
        }
      },

      {
        desc: "#getAll results in an object with all children's content",
        run: function(env, test) {
          env.storage.get = function(path) {
            var promise = promising();
            if(path == '/foo/') {
              promise.fulfill(200, { bar: true, baz: true });
            } else {
              promise.fulfill(200, "content of " + path);
            }
            return promise;
          }
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
          }
          env.client.getListing();
        }
      },

      {
        desc: "#getAll treats undefined paths as ''",
        run: function(env, test) {
          env.storage.get = function(path) {
            test.assert(path, '/foo/');
            return promising().fulfill(404);
          }
          env.client.getAll();
        }
      }

    ]
  });

  return suites;
});
