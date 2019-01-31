if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['./src/sync', './src/wireclient', './src/authorize', './src/eventhandling', './src/config', 'test/behavior/backend', 'test/helpers/mocks'],
       function(Sync, WireClient, Authorize, eventHandling, config, backend, mocks, undefined) {

  var suites = [];

  function setup(env, test) {
    global.RemoteStorage = function() {};

    global.RemoteStorage.log = function() {};
    global.RemoteStorage.prototype.localStorageAvailable = function() { return false; };

    test.done();
  }

  function beforeEach(env, test) {
    env.rs = new RemoteStorage();
    eventHandling(env.rs, 'error', 'wire-busy', 'wire-done', 'network-offline',
                  'network-online');
    env.client = new WireClient(env.rs);
    env.connectedClient = new WireClient(env.rs);
    env.baseURI = 'https://example.com/storage/test';
    env.token = 'foobarbaz';
    env.connectedClient.configure({
      href: env.baseURI,
      token: env.token
    });

    mocks.defineMocks(env);

    env.busy = new test.Stub(function(){});
    env.done = new test.Stub(function(){});
    env.networkOffline = new test.Stub(function(){});
    env.networkOnline = new test.Stub(function(){});
    env.rs.on('wire-busy', env.busy);
    env.rs.on('wire-done', env.done);
    env.rs.on('network-offline', env.networkOffline);
    env.rs.on('network-online', env.networkOnline);

    test.done();
  }

  function beforeEachXHR(env, test) {
    beforeEach(env, test);
    mocks.defineXMLHttpRequestMock(env);
  }

  function beforeEachFetch(env, test) {
    beforeEach(env, test);
    mocks.defineFetchMock(env);
  }

  function afterEach(env, test) {
    mocks.undefineMocks(env);
    delete env.client;
    test.done();
  }

  suites.push({
    name: "WireClient",
    desc: "behaves like a backend",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: backend.behavior
  });

  suites.push({
    name: "WireClient without fetch() or XMLHttpRequest",
    desc: "determines whether it is supported, without throwing an exception",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: [
      {
        desc: "reports it is not supported here",
        run: function(env,test){
          test.assert(WireClient._rs_supported(), false);
        }
      }
    ]
  });

  var tests = [
      {
        desc: "reports that it is supported by this HTTP request API",
        run: function(env,test){
          test.assert(WireClient._rs_supported(), true);
        }
      },
      {
        desc: "#get fails if not connected",
        willFail: true,
        run: function(env, test) {
          return env.client.get('/foo');
        }
      },
      {
        desc: "#put fails if not connected",
        willFail: true,
        run: function(env, test) {
          return env.client.put('/foo', 'bla');
        }
      },

      {
        desc: "#delete fails if not connected",
        willFail: true,
        run: function(env, test) {
          return env.client.delete('/foo');
        }
      },

      {
        desc: "client.get() of a document emits wire-busy and wire-done on success",
        run: function(env,test){
          env.connectedClient.get('/foo').then(function (){
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          setTimeout(function () {
            mockRequestSuccess({
                responseHeaders: {'Content-Type': 'text/plain; charset=UTF-8'},
                status: 200,
                arrayBuffer: new ArrayBufferMock('response-body')
            });
          }, 10);
        }
      },

      {
        desc: "client.get() of a document emits wire-busy and wire-done on failure",
        run: function(env,test){
          env.connectedClient.get('/foo').then(function(){
          }, function (err) {
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          setTimeout(function () {
            mockRequestFail('something went wrong at the HTTP request level');
          }, 10);

        }
      },

      {
        desc: "client.get() with request failure emits network-offline if remote.online was true",
        run: function(env,test){
          env.connectedClient.online = true;
          env.connectedClient.get('/foo').then(function(){
          }, function (err) {
            test.assertAnd(env.networkOffline.numCalled, 1);
            test.done();
          });
          setTimeout(function () {
            mockRequestFail('something went wrong at the HTTP request level');
          }, 10);
        }
      },

      {
        desc: "client.get() with request failure does not emit network-offline if remote.online was false",
        run: function(env,test){
          env.connectedClient.online = false;
          env.connectedClient.get('/foo').then(function(){
          }, function (err) {
            test.assertAnd(env.networkOffline.numCalled, 0);
            test.done();
          });
          setTimeout(function () {
            mockRequestFail('something went wrong at the HTTP request level');
          }, 10);
        }
      },

      {
        desc: "client.get() with success emits network-online if remote.online was false",
        run: function(env,test){
          env.connectedClient.online = false;
          env.connectedClient.get('/foo').then(function(){
            test.assertAnd(env.networkOnline.numCalled, 1);
            test.done();
          });
          setTimeout(function () {
            mockRequestSuccess({
              responseHeaders: {'Content-Type': 'text/plain; charset=UTF-8'},
              status: 200,
              arrayBuffer: new ArrayBufferMock('response-body')
            });
          }, 10);
        }
      },

      {
        desc: "client.get() with success does not emit network-online if remote.online was true",
        run: function(env,test){
          env.connectedClient.online = true;
          env.connectedClient.get('/foo').then(function(){
            test.assertAnd(env.networkOnline.numCalled, 0);
            test.done();
          });
          setTimeout(function () {
            mockRequestSuccess({
              responseHeaders: {'Content-Type': 'text/plain; charset=UTF-8'},
              status: 200,
              arrayBuffer: new ArrayBufferMock('response-body')
            });
          }, 10);
        }
      },


      {
        desc: "client.get() of a folder emits wire-busy and wire-done on success, and sets remote.online to true",
        run: function(env,test){
          env.connectedClient.online = false;
          env.connectedClient.get('/foo/').then(function(){
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.assertAnd(env.connectedClient.online, true);
            test.done();
          });
          mockRequestSuccess({
            responseHeaders: {'Content-Type': 'text/plain; charset=UTF-8'},
            status: 200,
            arrayBuffer: new ArrayBufferMock(JSON.stringify({'@context':'http://remotestorage.io/spec/folder-description', items: {}}))
          });
        }
      },

      {
        desc: "client.get() of a folder emits wire-busy and wire-done on failure",
        run: function(env,test){
          env.connectedClient.online = true;
          env.connectedClient.get('/foo/').then(function(){
          }, function(err) {
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          mockRequestFail('something went wrong at the HTTP request level');
        }
      },

      {
        desc: "client.put() emits wire-busy and wire-done on success",
        run: function(env,test){
          env.connectedClient.put('/foo', 'body', 'content-type', {}).then(function(){
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          mockRequestSuccess({
            responseHeaders: {'Content-Type': 'text/plain; charset=UTF-8'},
            status: 200,
            arrayBuffer: new ArrayBufferMock('response-body')
          });
        }
      },

      {
        desc: "client.put() emits wire-busy and wire-done on failure",
        run: function(env,test){
          env.connectedClient.put('/foo', 'body', 'content-type', {}).then(function(){
          }, function(err) {
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          mockRequestFail('something went wrong at the HTTP request level');
        }
      },

      {
        desc: "client.delete() emits wire-busy and wire-done on success",
        run: function(env,test){
          env.connectedClient.delete('/foo').then(function(){
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          mockRequestSuccess({
            responseHeaders: {'Content-Type': 'text/plain; charset=UTF-8'},
            status: 200,
            arrayBuffer: new ArrayBufferMock('response-body')
          });
        }
      },

      {
        desc: "client.delete() emits wire-busy and wire-done on failure",
        run: function(env,test){
          env.connectedClient.delete('/foo', 'body', 'content-type', {}).then(function(){
          }, function(err) {
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          mockRequestFail('something went wrong at the HTTP request level');
        }
      },

      {
        desc: "#configure sets the given parameters",
        run: function(env, test) {
          env.client.configure({
            userAddress: 'test@example.com',
            storageApi: 'draft-dejong-remotestorage-00'
          });
          test.assertAnd(env.client.userAddress, 'test@example.com');
          test.assertAnd(env.client.storageApi, 'draft-dejong-remotestorage-00');
          test.done();
        }
      },

      {
        desc: "#configure doesn't overwrite parameters if they are given as 'undefined'",
        run: function(env, test) {
          env.client.configure({
            userAddress: 'test@example.com'
          });
          test.assertAnd(env.client.userAddress, 'test@example.com');
          env.client.configure({ href: 'http://foo/bar' });
          test.assertAnd(env.client.userAddress, 'test@example.com');
          test.assertAnd(env.client.href, 'http://foo/bar');
          test.done();
        }
      },

      {
        desc: "#configure determines if revisions are supported, based on the storageApi",
        run: function(env, test) {
          env.client.configure({
            storageApi: 'draft-dejong-remotestorage-00'
          });
          test.assertAnd(env.client.supportsRevs, true);
          env.client.configure({
            storageApi: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple'
          });
          test.assertAnd(env.client.supportsRevs, false);
          env.client.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          test.assertAnd(env.client.supportsRevs, true);
          test.done();
        }
      },

      {
        desc: "#configure sets 'connected' to true, once href and token are given",
        run: function(env, test) {
          env.client.configure({
            href: 'https://example.com/storage/test',
            token: 'foobarbaz'
          });
          test.assert(env.client.connected, true);
        }
      },

      {
        desc: "#storageType returns a simplified identifier for the current storage API",
        run: function(env, test) {
          env.client.storageApi = undefined;
          test.assertTypeAnd(env.client.storageType, 'undefined');

          env.client.storageApi = 'draft-dejong-remotestorage-00';
          test.assertAnd(env.client.storageType, 'remotestorage-00');

          env.client.storageApi = 'draft-dejong-remotestorage-01';
          test.assertAnd(env.client.storageType, 'remotestorage-01');

          env.client.storageApi = 'draft-dejong-remotestorage-02';
          test.assertAnd(env.client.storageType, 'remotestorage-02');

          env.client.storageApi = 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple';
          test.assertAnd(env.client.storageType, '2012.04');

          test.done();
        }
      },

      {
        desc: "#get opens a CORS request",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar');
          test.assertAnd(getMockRequestMethod(), 'GET');
          test.assertAnd(getMockRequestUrl(), 'https://example.com/storage/test/foo/bar');
          test.done();
        }
      },

      {
        desc: "#get strips duplicate slashes from the path",
        run: function(env, test) {
          env.connectedClient.get('/foo//baz');
          test.assert(getMockRequestUrl(), 'https://example.com/storage/test/foo/baz');
        }
      },

      {
        desc: "#get doesn't set the 'If-None-Match' when revisions are supported and no rev given",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.get('/foo/bar');
          test.assert(getMockRequestHeader('If-None-Match'), undefined);
        }
      },

      {
        desc: "#get sets the 'If-None-Match' to the given value, when revisions are supported and the ifNoneMatch option is provided",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.get('/foo/bar', { ifNoneMatch: 'something' });
          test.assert(getMockRequestHeader('If-None-Match'), '"something"');
        }
      },

      {
        desc: "#get doesn't set the 'If-None-Match' header, when revisions are not supported",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple'
          });
          env.connectedClient.get('/foo/bar');
          test.assert(getMockRequestHeader('If-None-Match'), undefined);
        }
      },

      {
        desc: "#get doesn't set the 'If-None-Match' header even though the option is given, when revisions are not supported",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple'
          });
          env.connectedClient.get('/foo/bar', { ifNoneMatch: 'something' });
          test.assert(getMockRequestHeader('If-None-Match'), undefined);
        }
      },

      {
        desc: "#get sets the 'Authorization' header correctly",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar');
          test.assert(getMockRequestHeader('Authorization'), 'Bearer ' + env.token);
        }
      },

      {
        desc: "#get returns a promise",
        run: function(env, test) {
          var result = env.connectedClient.get('/foo/bar');
          test.assertTypeAnd(result, 'object');
          test.assertType(result.then, 'function');
        }
      },

      {
        desc: "#get rejects the promise, if onerror is called",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar/').
            then(function() {
              test.result(false);
            }, function(error) {
              test.assert('my-error', error);
            });
          mockRequestFail('my-error');
        }
      },

      {
        desc: "#get emits an Unauthorized error on 401 responses",
        run: function(env, test) {
          env.rs.on('error', function(error) {
            test.assert(error.name, 'Unauthorized');
          });

          env.connectedClient.get('/foo/bar');

          mockRequestSuccess({
            status: 401,
          });
        }
      },

      {
        desc: "#get extracts the Content-Type header, status and responseText and fulfills its promise with those, once onload is called",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, 'response-body');
              test.assert(r.contentType, 'text/plain; charset=UTF-8');
            });

          setTimeout(function () {
            mockRequestSuccess({
              responseHeaders: {'Content-Type': 'text/plain; charset=UTF-8'},
              status: 200,
              arrayBuffer: new ArrayBufferMock('response-body')
            });
          }, 10);
        }
      },

      {
        desc: "#get does not unpack JSON responses",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, JSON.stringify({ response: 'body' }));
              test.assert(r.contentType, 'application/json; charset=UTF-8');
            });

          mockRequestSuccess({
            responseHeaders: {'Content-Type': 'application/json; charset=UTF-8'},
            status: 200,
            arrayBuffer: new ArrayBufferMock('{"response":"body"}')
          });
        }
      },

      {
        desc: "#get unpacks pre-02 folder listings",
        run: function(env, test) {
          env.connectedClient.get('/foo/01/').
            then(function(r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, {'a': {'ETag': 'qwer'}, 'b/': {'ETag': 'asdf'}});
              test.assert(r.contentType, 'application/json; charset=UTF-8');
            });
          mockRequestSuccess({
            responseHeaders: {'Content-Type': 'application/json; charset=UTF-8'},
            status: 200,
            arrayBuffer: new ArrayBufferMock('{"a":"qwer","b/":"asdf"}')
          });
        }
      },


      {
        desc: "#get unpacks -02 folder listings",
        run: function(env, test) {
          env.connectedClient.get('/foo/01/').
            then(function(r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, {
                a: { "ETag": "qwer", "Content-Length": 5, "Content-Type": "text/html" },
                "b/": { "ETag": "asdf", "Content-Type":"application/json", "Content-Length": 137 }
              });
              test.assert(r.contentType, 'application/json; charset=UTF-8');
            });
          mockRequestSuccess({
            responseHeaders: {'Content-Type': 'application/json; charset=UTF-8'},
            status: 200,
            arrayBuffer: new ArrayBufferMock(JSON.stringify({
              "@context": "http://remotestorage.io/spec/folder-description",
              items: {
                a: {
                  "ETag": "qwer",
                  "Content-Length": 5,
                  "Content-Type": "text/html"
                },
                "b/": {
                  "ETag": "asdf",
                  "Content-Type":"application/json",
                  "Content-Length": 137
                }
              }
            }))
          });
        }
      },

      {
        desc: "#put encodes special characters in the path",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          var request = WireClient.request;

          WireClient.request = function(method, url, options) {
            WireClient.request = request;
            test.assert(url, 'https://example.com/storage/test/foo/A%252FB/bar', url);
          };

          env.connectedClient.put('/foo/A%2FB/bar', 'baz' , 'text/plain');

          WireClient.request = request;
        }
      },

      {
        desc: "#put encodes spaces in the path",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          var request = WireClient.request;

          WireClient.request = function(method, url, options) {
            WireClient.request = request;
            test.assert(url, 'https://example.com/storage/test/foo/A%20B/bar', url);
          };

          env.connectedClient.put('/foo/A B/bar', 'baz' , 'text/plain');

          WireClient.request = request;
        }
      },

      {
        desc: "#put leaves slash characters in the path",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          var request = WireClient.request;

          WireClient.request = function(method, url, options) {
            WireClient.request = request;
            test.assert(url, 'https://example.com/storage/test/foo/A/B/C/D/E', url);
          };

          env.connectedClient.put('/foo/A/B/C/D/E', 'baz' , 'text/plain');

          WireClient.request = request;
        }
      },

      {
        desc: "#put removes redundant slash characters in the path",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          var request = WireClient.request;

          WireClient.request = function(method, url, options) {
            WireClient.request = request;
            test.assert(url, 'https://example.com/storage/test/foo/A/B/C/D/E', url);
          };

          env.connectedClient.put('/foo/A//B/C///D/E', 'baz' , 'text/plain');

          WireClient.request = request;
        }
      },

      {
        desc: "#put uses the PUT method and sends the request body",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', 'bla', 'text/plain');
          test.assertAnd(getMockRequestMethod(), 'PUT');
          test.assertAnd(getMockRequestUrl(), 'https://example.com/storage/test/foo/bar');
          test.assertAnd(getMockRequestHeader('Content-Type'), 'text/plain');
          test.assert(getMockRequestBody(), 'bla');
        }
      },

      {
        desc: "#put doesn't set the 'If-None-Match' when revisions are supported and no rev given",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.put('/foo/bar', 'baz', 'text/plain');
          test.assert(getMockRequestHeader('If-None-Match'), undefined);
        }
      },

      {
        desc: "#put doesn't set the 'If-Match' when revisions are supported and no rev given",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.put('/foo/bar', 'baz', 'text/plain');
          test.assert(getMockRequestHeader('If-Match'), undefined);
        }
      },

      {
        desc: "#delete doesn't set the 'If-Match' when revisions are supported and no rev given",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.delete('/foo/bar');
          test.assertAnd(getMockRequestMethod(), 'DELETE');
          test.assert(getMockRequestHeader('If-Match'), undefined);
        }
      },

      {
        desc: "WireClient is not marked offline after SyncError",
        run: function(env, test){
          env.connectedClient.online = true;
          env.rs._emit('error', new Sync.SyncError());
          setTimeout(function() {
            test.assert(env.connectedClient.online, true);
          }, 100);
        }
      },

      {
        desc: "requests are aborted if they aren't responded after the configured timeout",
        timeout: 3000,
        run: function(env, test) {
          const originalTimeout = config.requestTimeout;
          config.requestTimeout = 1000;

          env.connectedClient.get('/foo').then(function() {
            config.requestTimeout = originalTimeout;
            test.result(false);
          }, function (error) {
            config.requestTimeout = originalTimeout;
            test.assert('timeout', error);
          });
        }
      },

      {
        desc: "responses with the charset set to 'binary' are left as the raw response",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, {
                iAmA: 'ArrayBufferMock',
                content: 'response-body'
              });
              test.assert(r.contentType, 'application/octet-stream; charset=binary');
            });
          mockRequestSuccess({
            responseHeaders: {'Content-Type': 'application/octet-stream; charset=binary'},
            status: 200,
            arrayBuffer: new ArrayBufferMock('response-body')
          });
        }
      },

      {
        desc: "PUTs of ArrayBuffers get a binary charset added",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', new ArrayBuffer('bla', 'UTF-8'), 'image/jpeg', {});
          test.assert(getMockRequestHeader('Content-Type'), 'image/jpeg; charset=binary');
        }
      },

      {
        desc: "PUTs of ArrayBuffers get no second binary charset added",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', new ArrayBuffer('bla', 'UTF-8'), 'image/jpeg; charset=custom', {});
          test.assert(getMockRequestHeader('Content-Type'), 'image/jpeg; charset=custom');
        }
      },

      {
        desc: "PUTs of strings get no charset added",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', 'bla', 'text/html', {});
          test.assert(getMockRequestHeader('Content-Type'), 'text/html');
        }
      },

      {
        desc: "PUTs of strings have UTF-8 charset preserved",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', 'bla', 'text/html; charset=UTF-8', {});
          test.assert(getMockRequestHeader('Content-Type'), 'text/html; charset=UTF-8');
        }
      },

      {
        desc: "PUTs of strings have custom charset preserved",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', 'bla', 'text/html; charset=myown', {});
          test.assert(getMockRequestHeader('Content-Type'), 'text/html; charset=myown');
        }
      },

      {
        desc: "responses without a Content-Type header are converted to text when it only contains printable characters",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, 'response-body');
              test.done();
            });
          mockRequestSuccess({
            status: 200,
            arrayBuffer: new ArrayBufferMock('response-body')
          });
        }
      },

      {
        desc: "404 responses for documents discard the body altogether",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(r) {
              test.assertAnd(r.statusCode, 404);
              test.assertTypeAnd(r.body, 'undefined');
              test.assertTypeAnd(r.contentType, 'undefined');
              test.done();
            });
          mockRequestSuccess({
            status: 404,
            arrayBuffer: new ArrayBufferMock('')
          });
        }
      },

      {
        desc: "404 responses for folders discard the body altogether",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar/').
            then(function(r) {
              test.assertAnd(r.statusCode, 404);
              test.assertTypeAnd(r.body, 'undefined');
              test.assertTypeAnd(r.contentType, 'undefined');
              test.done();
            });
          mockRequestSuccess({
            status: 404,
            arrayBuffer: new ArrayBufferMock('')
          });
        }
      },

      {
        desc: "412 responses discard the body altogether",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(r) {
              test.assertAnd(r.statusCode, 412);
              test.assertTypeAnd(r.body, 'undefined');
              test.assertTypeAnd(r.contentType, 'undefined');
              test.done();
            });
          mockRequestSuccess({
            status: 412,
            arrayBuffer: new ArrayBufferMock('')
          });
        }
      },

      {
        desc: "304 responses discard body and content-type, but return the revision",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar', { ifNoneMatch: 'foo' }).
            then(function(r) {
              test.assertAnd(r.statusCode, 304);
              test.assertTypeAnd(r.body, 'undefined');
              test.assertTypeAnd(r.contentType, 'undefined');
              test.assertAnd(r.revision, 'foo');
              test.done();
            });
          mockRequestSuccess({
            responseHeaders: {'ETag': '"foo"'},
            status: 304,
            arrayBuffer: new ArrayBufferMock('')
          });
        }
      },

      {
        desc: "204 responses on delete discard body and content-type, but return the revision",
        run: function(env, test) {
          env.connectedClient.delete('/foo/bar', { ifMatch: 'foo' }).
            then(function(r) {
              test.assertAnd(r.statusCode, 204);
              test.assertTypeAnd(r.body, 'undefined');
              test.assertTypeAnd(r.contentType, 'undefined');
              test.assertAnd(r.revision, 'foo');
              test.done();
            });
          mockRequestSuccess({
            responseHeaders: {'ETag': '"foo"'},
            status: 204,
            arrayBuffer: new ArrayBufferMock('')
          });
        }
      },

      {
        desc: "200 responses on delete discard body and content-type, but return the revision",
        run: function(env, test) {
          env.connectedClient.delete('/foo/bar', { ifMatch: 'foo' }).
            then(function(r) {
              test.assertAnd(r.statusCode, 200);
              test.assertTypeAnd(r.body, 'undefined');
              test.assertTypeAnd(r.contentType, 'undefined');
              test.assertAnd(r.revision, 'foo');
              test.done();
            });
          mockRequestSuccess({
            responseHeaders: {'ETag': '"foo"'},
            status: 200,
            arrayBuffer: new ArrayBufferMock('')
          });
        }
      },

      {
        desc: "200 responses on delete discard revision when no ETag is sent",
        run: function(env, test) {
          env.connectedClient.delete('/foo/bar', { ifMatch: 'foo' }).
            then(function(r) {
              test.assertAnd(r.statusCode, 200);
              test.assertTypeAnd(r.body, 'undefined');
              test.assertTypeAnd(r.contentType, 'undefined');
              test.assertAnd(r.revision, null);
              test.done();
            });
          mockRequestSuccess({
            status: 200,
            arrayBuffer: new ArrayBufferMock('')
          });
        }
      },

      {
        desc: "200 responses on put discard body and content-type, but return the revision",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', { ifMatch: 'foo' }, 'content body').
            then(function(r) {
              test.assertAnd(r.statusCode, 200);
              test.assertTypeAnd(r.body, 'undefined');
              test.assertTypeAnd(r.contentType, 'undefined');
              test.assertAnd(r.revision, 'foo');
              test.done();
            });
          mockRequestSuccess({
            responseHeaders: {'ETag': '"foo"'},
            status: 200,
            arrayBuffer: new ArrayBufferMock('')
          });
        }
      },

      {
        desc: "#Wireclient.request with success fulfills its promise with text response if responseType is not set",
        run: function(env, test) {
          WireClient.request('GET','/foo/bar', {}).
            then(function (r) {
              test.assertAnd(r.status, 200);
              test.assertAnd(r.responseText, 'response-body');
              test.done();
            });

          setTimeout(function () {
            mockRequestSuccess({
              status: 200,
              responseText: 'response-body'
            });
          }, 10);
        }
      },    
    ];

    var xhrTests = tests.concat([
      {
        desc: "#get sends the request",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar');
          var req = XMLHttpRequest.instances.shift();
          test.assertType(req._send, 'object');
        }
      },

      {
        desc: "#get installs onload and onerror handlers on the request",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar/');
          var req = XMLHttpRequest.instances.shift();
          test.assertTypeAnd(req._onload, 'function');
          test.assertTypeAnd(req._onerror, 'function');
          test.done();
        }
      },
    ]);
    suites.push({
       name: "WireClient (using XMLHttpRequest)",
       desc: "Low-level remotestorage client",
       setup: setup,
       beforeEach: beforeEachXHR,
       afterEach: afterEach,
       tests: xhrTests
    });

    var fetchTests = tests.concat([

    ]);
    suites.push({
       name: "WireClient (using fetch)",
       desc: "Low-level remotestorage client",
       setup: setup,
       beforeEach: beforeEachFetch,
       afterEach: afterEach,
       tests: fetchTests
    });

  return suites;
});

