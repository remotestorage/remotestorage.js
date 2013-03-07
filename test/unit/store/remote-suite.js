if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {

  var suites = [];

  var RemoteStore;
  var util;

  function makeFakeHTTP() {
    var calls = [];
    var http = function(method, uri, headers, body) {
      var promise = util.getPromise();
      calls.push({
        method: method,
        uri: uri,
        headers: headers,
        body: body,
        promise: promise
      });
      return promise;
    };
    http.expect = function(test, method, uri) {
      var call;
      for(var i=0;i<calls.length;i++) {
        if(calls[i].method === method && calls[i].uri === uri) {
          call = calls[i];
          break;
        }
      }
      test.assertTypeAnd(call, 'object', 'no request found! (have: ' + JSON.stringify(calls) + ')');
      return call;
    };
    return http;
  }

  var fixtures = {
    storageInfo00: {
      type: 'draft-dejong-remotestorage-00',
      href: 'https://local.dev/storage/me'
    },
    bearerToken: 'asdf'
  };

  function expectThrow(test, error, block) {
    try {
      block();
      test.result(false, 'nothing was thrown');
    } catch(exc) {
      test.assertAnd(exc instanceof error, true, 'Wrong exception was thrown: ' + exc.toString());
    }
  }

  suites.push({
    name: 'RemoteStore',
    desc: 'A node store backed by a remote server',

    setup: function(env, test) {
      requirejs([
        './src/lib/util',
        './src/lib/store/remote'
      ], function(_util, _RemoteStore) {
        util = _util;
        RemoteStore = _RemoteStore;
        test.result(true);
      });
    },

    beforeEach: function(env, test) {
      env.http = makeFakeHTTP();
      env.store = new RemoteStore(env.http);

      env.gotoState = function(state) {
        var cfg = {};
        if(state === 'connecting' || state === 'connected') {
          cfg.storageInfo = fixtures.storageInfo00;
        }
        if(state === 'connected') {
          cfg.bearerToken = fixtures.bearerToken;
        }
        env.store.configure(cfg);
      }

      test.result(true);
    },

    tests: [

      {
        desc: "the initial state is 'anonymous'",
        run: function(env, test) {
          test.assert(env.store.state, 'anonymous');
        }
      },

      {
        desc: "configuring storageInfo transitions to 'connecting' state",
        run: function(env, test) {
          env.store.configure({ storageInfo: fixtures.storageInfo00 });
          test.assert(env.store.state, 'connecting');
        }
      },

      {
        desc: "transitioning states causes a 'state' event",
        run: function(env, test) {
          env.store.on('state', function(state) {
            test.assert(state, 'connecting');
          });
          env.store.configure({ storageInfo: fixtures.storageInfo00 });
        }
      },

      {
        desc: "setting storageInfo and bearerToken transitions to 'connected' state",
        run: function(env, test) {
          env.store.configure({
            storageInfo: fixtures.storageInfo00,
            bearerToken: fixtures.bearerToken
          });
          test.assert(env.store.state, 'connected');
        }
      },

      {
        desc: "#get() throws NotConnected, when state isn't 'connected'",
        run: function(env, test) {
          env.gotoState('anonymous');
          expectThrow(test, RemoteStore.NotConnected, function() {
            env.store.get('/');
          });
          env.gotoState('connecting');
          expectThrow(test, RemoteStore.NotConnected, function() {
            env.store.get('/');
          });
          test.result(true);
        }
      },

      {
        desc: "#get() performs an HTTP request",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/foo');
          env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/foo');
          test.result(true);
        }
      },

      {
        desc: "#get() returns a promise",
        run: function(env, test) {
          env.gotoState('connected');
          var result = env.store.get('/foo');
          test.assertTypeAnd(result, 'object');
          test.assertType(result.then, 'function');
        }
      },

      {
        desc: "#get() sends the right Authorization header",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/');
          var call = env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/');
          test.assert(call.headers['Authorization'], 'Bearer asdf');
        }
      },

      {
        desc: "#get() loads plain text nodes correctly",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/hello.txt').then(function(node) {
            test.assertAnd(node.mimeType, 'text/plain');
            test.assertAnd(node.data, 'Hello World!');
            test.assert(node.version, 'version-123');
          });
          var call = env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/hello.txt');
          call.promise.fulfill({
            status: 200,
            body: 'Hello World!',
            headers: {
              'etag': 'version-123',
              'content-type': 'text/plain; charset=utf-8'
            }
          });
        }
      },

      {
        desc: "#get() loads JSON nodes correctly",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/hello.json').then(function(node) {
            test.assertAnd(node.mimeType, 'application/json');
            test.assertAnd(node.data, { hello: 'world' });
            test.assert(node.version, 'version-234');
          });
          var call = env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/hello.json');
          call.promise.fulfill({
            status: 200,
            body: '{"hello":"world"}',
            headers: {
              'etag': 'version-234',
              'content-type': 'application/json; charset=utf-8'
            }
          });
        }
      },

      {
        desc: "#get() throws InvalidJSON when it receives invalid JSON data",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/hello.json').then(function(node) {
            test.result(false, 'Nothing was thrown');
          }, function(error) {
            test.assert(error instanceof RemoteStore.InvalidJSON, true);
          });
          var call = env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/hello.json');
          call.promise.fulfill({
            status: 200,
            body: 'something else',
            headers: {
              'etag': 'version-234',
              'content-type': 'application/json; charset=utf-8'
            }
          });
        }
      },

      {
        desc: "#get() loads binary data correctly",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/hello.bin').then(function(node) {
            test.assertAnd(node.mimeType, 'application/octet-stream');
            test.assertTypeAnd(node, 'object', 'expected arraybuffer object, got: ' + typeof(node.data));
            test.assertAnd(node.data instanceof ArrayBuffer, true);
            test.assertAnd(node.version, 'version-345');

            test.assertAnd(node.data.byteLength, 3);
            var view = new Uint8Array(node.data);
            test.assertAnd(view[0], 0);
            test.assertAnd(view[1], 1);
            test.assertAnd(view[2], 2);
            test.result(true);
          });
          var call = env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/hello.bin');
          var data = (String.fromCharCode(0) +
                      String.fromCharCode(1) +
                      String.fromCharCode(2));
          call.promise.fulfill({
            status: 200,
            body: data,
            headers: {
              'etag': 'version-345',
              'content-type': 'application/octet-stream; charset=binary'
            }
          });
        }
      },

      {
        desc: "#get() yields an empty node when it receives status 404",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/hello').then(function(node) {
            test.assert(node, RemoteStore.EMPTY_NODE);
          });
          var call = env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/hello');
          call.promise.fulfill({
            status: 404,
            body: 'Not Found'
          });
        }
      },

      {
        desc: "#get() throws Unauthorized when it receives status 401",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/hello').then(function(node) {
            test.result(false, 'nothing thrown');
          }, function(error) {
            test.assert(error instanceof RemoteStore.Unauthorized, true);
          });
          var call = env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/hello');
          call.promise.fulfill({
            status: 401,
            body: 'Unauthorized'
          });
        }
      },

      {
        desc: "#get() throws UnexpectedResponse when it receives status 500",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.get('/hello').then(function(node) {
            test.result(false, 'nothing thrown');
          }, function(error) {
            test.assert(error instanceof RemoteStore.UnexpectedResponse, true);
          });
          var call = env.http.expect(test, 'GET', fixtures.storageInfo00.href + '/hello');
          call.promise.fulfill({
            status: 500,
            body: 'Internal Server Error'
          });
        }
      },

      {
        desc: "#set() throws NotConnected when the state isn't 'connected'",
        run: function(env, test) {
          expectThrow(test, RemoteStore.NotConnected, function() {
            env.store.set('/foo', {});
          });
          test.result(true);
        }
      },

      {
        desc: "#set() throws an error when given no path",
        run: function(env, test) {
          env.gotoState('connected');
          expectThrow(test, Error, function() {
            env.store.set(undefined, {});
          });
          test.result(true);
        }
      },

      {
        desc: "#set() throws an error when given no node",
        run: function(env, test) {
          env.gotoState('connected');
          expectThrow(test, Error, function() {
            env.store.set('/foo', undefined);
          });
          test.result(true);
        }
      },

      {
        desc: "#set() causes a PUT request",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.set('/hello.txt', {
            mimeType: 'text/plain',
            data: 'Hello World!'
          });
          env.http.expect(test, 'PUT', fixtures.storageInfo00.href + '/hello.txt');
          test.result(true);
        }
      },

      {
        desc: "#set() sets the correct Content-Type header",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.set('/hello.txt', {
            mimeType: 'text/plain',
            data: 'Hello World!'
          });
          var call = env.http.expect(test, 'PUT', fixtures.storageInfo00.href + '/hello.txt');
          test.assert(call.headers['Content-Type'], 'text/plain; charset=utf-8');
        }
      },

      {
        desc: "#set() sends no ETag header, when the node has no version",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.set('/hello.txt', {
            mimeType: 'text/plain',
            data: 'Hello World!'
          });
          var call = env.http.expect(test, 'PUT', fixtures.storageInfo00.href + '/hello.txt');
          test.assert(call.headers['ETag'], undefined);
        }
      },

      {
        desc: "#set() sends a correct ETag header, when the node has a version",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.set('/hello.txt', {
            mimeType: 'text/plain',
            data: 'Hello World!',
            version: '123'
          });
          var call = env.http.expect(test, 'PUT', fixtures.storageInfo00.href + '/hello.txt');
          test.assert(call.headers['ETag'], '123');
        }
      },

      {
        desc: "#set() sets the 'charset' for binary data correctly",
        run: function(env, test) {
          var buffer = util.rawToBuffer('Hello World!');
          env.gotoState('connected');
          env.store.set('/hello.bin', {
            mimeType: 'application/octet-stream',
            data: buffer,
            binary: true
          });
          var call = env.http.expect(test, 'PUT', fixtures.storageInfo00.href + '/hello.bin');
          test.assertAnd(call.headers['Content-Type'], 'application/octet-stream; charset=binary');
          test.assert(call.body, buffer);
        }
      },

      {
        desc: "#set() encodes JSON data correctly",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.set('/hello.json', {
            mimeType: 'application/json',
            data: {
              hello: 'world'
            }
          });
          var call = env.http.expect(test, 'PUT', fixtures.storageInfo00.href + '/hello.json');
          test.assertAnd(call.headers['Content-Type'], 'application/json; charset=utf-8');
          test.assert(call.body, '{"hello":"world"}');
        }
      },

      {
        desc: "#remove() throws NotConnected, when state isn't 'connected'",
        run: function(env, test) {
          expectThrow(test, RemoteStore.NotConnected, function() {
            env.store.remove('/foo');
          });
          test.result(true);
        }
      },

      {
        desc: "#remove() throws an Error, when path is not given",
        run: function(env, test) {
          expectThrow(test, Error, function() {
            env.store.remove();
          });
          test.result(true);
        }
      },

      {
        desc: "#remove() causes a DELETE request with the correct Authorization header",
        run: function(env, test) {
          env.gotoState('connected');
          env.store.remove('/foo');
          var call = env.http.expect(test, 'DELETE', fixtures.storageInfo00.href + '/foo');
          test.assert(call.headers['Authorization'], 'Bearer ' + fixtures.bearerToken);
        }
      }

    ]

  });

  return suites;

});
