if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs', 'test/helpers/mocks', 'tv4'], function (Promise, requirejs, mocks, tv4) {

  global.Promise = Promise;
  global.tv4 = tv4;

  var suites = [];

  suites.push({
    name: "BaseClient",
    desc: "High-level client, scoped to a path",
    setup: function(env, test) {
      mocks.defineMocks(env);

      global.RemoteStorage = function() {};
      RemoteStorage.log = function() {};
      RemoteStorage.prototype = {
        onChange: function(basePath, handler) {
          this.onChange = handler;
        },
        caching: {
          _rootPaths: {},
          set: function(path, value) {
            this._rootPaths[path] = value;
          }
        }
      };
      RemoteStorage.config = {
        changeEvents: {
          remote: true
        }
      };

      require('./src/util');
      if (global.rs_util) {
        RemoteStorage.util = global.rs_util;
      } else {
        global.rs_util = RemoteStorage.util;
      }

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
      if (global.rs_baseclient_with_types) {
        RemoteStorage.BaseClient = global.rs_baseclient_with_types;
      } else {
        global.rs_baseclient_with_types = RemoteStorage.BaseClient;
      }
      test.done();
    },
    beforeEach: function(env, test) {
      env.storage = new RemoteStorage();
      env.storage.access = new FakeAccess();
      env.client = new RemoteStorage.BaseClient(env.storage, '/foo/');
      test.done();
    },
    tests: [
      {
        desc: "it takes a storage object and base path",
        run: function(env, test) {
          test.assertAnd(env.client.storage instanceof RemoteStorage, true);
          test.assertAnd(env.client.base, '/foo/');
          test.done();
        }
      },

      {
        desc: "it doesn't accept non-folder paths",
        run: function(env, test) {
          try {
            new RemoteStorage.BaseClient(env.storage, '/foo');
            test.result(false);
          } catch(e) {
            test.done();
          }
        }
      },

      {
        desc: "it detects the module name correctly",
        run: function(env, test) {
          var rootClient = new RemoteStorage.BaseClient(env.storage, '/');
          var moduleClient = new RemoteStorage.BaseClient(env.storage, '/contacts/');
          var nestedClient = new RemoteStorage.BaseClient(env.storage, '/email/credentials/');
          test.assertAnd(rootClient.moduleName, 'root');
          test.assertAnd(moduleClient.moduleName, 'contacts');
          test.assertAnd(nestedClient.moduleName, 'email');
          test.done();
        }
      },

      {
        desc: "it installs a change handler for its base",
        run: function(env, test) {
          env.storage.onChange = function(path, handler) {
            test.assertTypeAnd(handler, 'function');
            test.assertAnd(path, '/foo/');
            test.done();
          };
          var client = new RemoteStorage.BaseClient(env.storage, '/foo/');
        }
      },

      {
        desc: "it understands the 'change' events",
        run: function(env, test) {
          env.client.on('change', function() {});
          test.done();
        }
      },
      {
        desc: "#BaseClient.uuid()",
        run: function(env, test) {
          test.assertType(env.client.uuid, 'function');
          var string = env.client.uuid();
          test.assertType(string, 'string');
        }
      },
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
      env.storage.access = new FakeAccess();
      env.client = new RemoteStorage.BaseClient(env.storage, '/foo/');
      test.done();
    },

    tests: [
      {
        desc: "#getListing performs a 'get' request",
        run: function(env, test) {
          env.storage.get = function (path) {
            test.assert(path, '/foo/bar/');
            return Promise.resolve({statusCode: 404});
          };
          env.client.getListing('bar/');
        }
      },

      {
        desc: "#getListing results in an empty object when it sees '404'",
        run: function (env, test) {
          env.storage.get = function (path) {
            return Promise.resolve({statusCode: 404});
          };
          env.client.getListing('bar/').then(function (result) {
            test.assert(result, {});
          });
        }
      },

      {
        desc: "#getListing fails when it gets a document path",
        willFail: true,
        run: function(env, test) {
          return env.client.getListing('bar');
        }
      },

      {
        desc: "#getListing accepts an empty path",
        run: function(env, test) {
          env.storage.get = function(path) {
            return Promise.resolve({statusCode: 404});
          };
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
        run: function (env, test) {
          env.storage.get = function (path) {
            return Promise.resolve({statusCode: 200, body: { 'foo': {"ETag":'bar'}, 'baz/': {"ETag":'bla'} }});
          };
          env.client.getListing('').then(function (result) {
            test.assert(result, { 'foo': {"ETag":'bar'}, 'baz/': {"ETag":'bla'} });
          });
        }
      },

      {
        desc: "#getListing rejects the promise on error",
        run: function (env, test) {
          env.storage.get = function (path) {
            return Promise.reject('Broken');
          };
          env.client.getListing('').then(function () {
            test.result(false);
          }, function (error) {
            test.assert(error, 'Broken');
            test.done();
          });
        }
      },

      {
        desc: "#getListing treats undefined paths as ''",
        run: function (env, test) {
          env.storage.get = function (path) {
            test.assert(path, '/foo/');
            return Promise.resolve({statusCode: 404});
          };
          env.client.getListing();
        }
      },

      {
        desc: "#getAll returns an empty object when it sees a 404",
        run: function (env, test) {
          env.storage.get = function (path) {
            return Promise.resolve({statusCode: 404});
          };
          env.client.getAll('').then(function (result) {
            test.assert(result, {});
          });
        }
      },

      {
        desc: "#getAll returns an empty object when there are no objects",
        run: function (env, test) {
          env.storage.get = function (path) {
            return Promise.resolve({statusCode: 200, body: {}});
          };
          env.client.getAll('').then(function(result) {
            test.assert(result, {});
          });
        }
      },

      {
        desc: "#getAll retrieves the listing and then all children",
        run: function (env, test) {
          var expected = { '/foo/': true, '/foo/bar': true, '/foo/baz': true };
          env.storage.get = function (path) {
            delete expected[path];
            if (path === '/foo/') {
              return Promise.resolve({statusCode: 200, body: { bar: true, baz: true }});
            } else {
              return Promise.resolve({statusCode: 200, body: "content of " + path});
            }
          };
          env.client.getAll('').then(function () {
            if (Object.keys(expected).length === 0) {
              test.result(true);
            } else {
              test.result(false);
            }
          });
        }
      },

      {
        desc: "#getAll results in an object with all children's content",
        run: function(env, test) {
          env.storage.get = function(path) {
            if (path === '/foo/') {
              return Promise.resolve({statusCode: 200, body: { bar: true, baz: true }});
            } else {
              return Promise.resolve({statusCode: 200, body: JSON.stringify({ "content of ": path })});
            }
          };
          env.client.getAll('').then(function(result) {
            test.assert(result, {
              bar: { "content of ": "/foo/bar" },
              baz: { "content of ": "/foo/baz" }
            });
          });
        }
      },

      {
        desc: "#getAll treats undefined paths as ''",
        run: function(env, test) {
          env.storage.get = function(path) {
            test.assert(path, '/foo/');
            return Promise.resolve({statusCode: 404});
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
          test.assert(env.storage.caching._rootPaths, {'/foo/bar/': 'ALL'});
        }
      },

      {
        desc: "#cache calls can be chained",
        run: function(env, test) {
          env.client.cache('bar/').cache('baz/');
          test.assert(env.storage.caching._rootPaths, {'/foo/bar/': 'ALL', '/foo/baz/': 'ALL'});
        }
      },

      {
        desc: "#cache with 'false' flag disables caching for a given path",
        run: function(env, test) {
          env.client.cache('bar/');
          env.client.cache('bar/', false);
          test.assert(env.storage.caching._rootPaths['/foo/bar/'], 'FLUSH');
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
            return Promise.resolve({statusCode: 200});
          };
          env.client.storeFile('def', 'foo/bar', 'abc');
        }
      },

      {
        desc: "storeObject rejects promise with tv4 validation result when object invalid",
        run: function(env, test) {
          env.client.declareType('todo-item', 'http://to.do/spec/item', {
            type: 'object',
            properties: {
              locale: { type: 'string'}
            },
            required: ['locale']
          });
          env.client.storeObject('todo-item', 'foo/bar', {test: 1}).then(function() {
            test.result(false, 'should have rejected');
          }, function(err) {
            test.assertAnd(err.error.message, "Missing required property: locale");
            test.assert(err.valid, false);
          });
        }
      },

      {
        desc: "storeObject adds @context and sets application/json Content-Type",
        run: function(env, test) {
          env.client.declareType('test', {});
          env.storage.put = function(path, body, contentType, incoming) {
            test.assertAnd(path, '/foo/foo/bar');
            test.assertAnd(body, JSON.stringify({
              test: 1,
              '@context': 'http://remotestorage.io/spec/modules/foo/test'
            }));
            test.assertAnd(contentType, 'application/json; charset=UTF-8');
            test.result(true);
            return Promise.resolve({statusCode: 200});
          };
          env.client.storeObject('test', 'foo/bar', {test: 1});
        }
      },

      {
        desc: "storeObject adds correct @context for types with custom context",
        run: function(env, test) {
          env.storage.put = function(path, body, contentType, incoming) {
            test.assertAnd(path, '/foo/foo/bar');
            test.assertAnd(body, JSON.stringify({
              test: 1,
              '@context': 'http://to.do/spec/item'
            }));
            test.result(true);
            return Promise.resolve({statusCode: 200});
          };
          env.client.declareType('todo-item', 'http://to.do/spec/item', {});
          env.client.storeObject('todo-item', 'foo/bar', {test: 1});
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
            return Promise.resolve({statusCode: 200});
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
      },

      {
        desc: "#getItemURL encodes quote characters",
        run: function(env, test) {
          env.storage.connected = true;
          env.storage.remote = {href: 'http://example.com/test'};

          test.assert(env.client.getItemURL("Capture d'écran"),
                      'http://example.com/test/foo/Capture%20d%27%C3%A9cran');

          test.assert(env.client.getItemURL('So they said "hey"'),
                      'http://example.com/test/foo/So%20they%20said%20%22hey%22');
        }
      },

      {
        desc: "values in change events are JSON-parsed when possible",
        run: function(env, test) {
          var storage = new RemoteStorage();
          var client = new RemoteStorage.BaseClient(storage, '/foo/');
          var expected = [{
            path: '/foo/a',
            origin: 'remote',
            relativePath: 'a',
            newValue: { as: 'df' },
            oldValue: 'qwer',
            newContentType: 'application/ld+json',
            oldContentType: 'text/plain'
          },
          {
            path: '/foo/a',
            origin: 'remote',
            relativePath: 'a',
            newValue: 'asdf',
            oldValue: 'qwer'
          }];
          client.on('change', function(e) {
            test.assertAnd(expected.pop(), e);
            if (expected.length === 0) {
              test.done();
             }
          });
          storage.onChange({
            path: '/foo/a',
            origin: 'remote',
            relativePath: 'a',
            newValue: 'asdf',
            oldValue: 'qwer'
          });
          storage.onChange({
            path: '/foo/a',
            origin: 'remote',
            relativePath: 'a',
            newValue: JSON.stringify({ as: 'df'}),
            oldValue: 'qwer',
            newContentType: 'application/ld+json',
            oldContentType: 'text/plain'
          });
        }
      }
    ]
  });

  return suites;
});
