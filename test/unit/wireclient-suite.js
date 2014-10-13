if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs', 'test/behavior/backend', 'test/helpers/mocks'], function(Promise, requirejs, backend, mocks, undefined) {
  global.Promise = Promise;
  var suites = [];

  function setup(env, test) {
    global.RemoteStorage = function() {};
    RemoteStorage.log = function() {};
    global.RemoteStorage.Unauthorized = function() {};
    global.RemoteStorage.SyncError = function() {};
    global.RemoteStorage.prototype.localStorageAvailable = function() { return false; };

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

    RemoteStorage.Authorize = {
      IMPLIED_FAKE_TOKEN: false
    };
    test.done();
  }

  function beforeEach(env, test) {
    global.ArrayBufferMock = function(str) {
      return {
        iAmA: 'ArrayBufferMock',
        content: str
      };
    };
    global.XMLHttpRequest = function() {
      XMLHttpRequest.instances.push(this);
      this._headers = {};
      this._responseHeaders = {};
    };
    XMLHttpRequest.instances = [];
    XMLHttpRequest.prototype = {
      open: function() {
        this._open = Array.prototype.slice.call(arguments);
      },
      send: function() {
        this._send = Array.prototype.slice.call(arguments);
      },
      setRequestHeader: function(key, value) {
        this._headers[key] = value;
      },
      getResponseHeader: function(key) {
        return this._responseHeaders[key];
      }
    };
    ['load', 'abort', 'error'].forEach(function(cb) {
      Object.defineProperty(XMLHttpRequest.prototype, 'on' + cb, {
        configurable: true,
        set: function(f) {
          this['_on' + cb] = f;
        }
      });
    });
    env.rs = new RemoteStorage();
    RemoteStorage.eventHandling(env.rs, 'error');
    env.client = new RemoteStorage.WireClient(env.rs);
    env.connectedClient = new RemoteStorage.WireClient(env.rs);
    env.baseURI = 'https://example.com/storage/test';
    env.token = 'foobarbaz';
    env.connectedClient.configure({
      href: env.baseURI,
      token: env.token
    });

    mocks.defineMocks(env);

    env.busy = new test.Stub(function(){});
    env.done = new test.Stub(function(){});
    env.connectedClient.on('wire-busy', env.busy);
    env.connectedClient.on('wire-done', env.done);

    test.done();
  }

  function afterEach(env, test) {
    delete global.XMLHttpRequest;
    delete global.Blob;
    delete global.FileReader;
    delete env.client;
    delete env.blob;
    delete env.fileReaderResult;
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
    name: "WireClient",
    desc: "Low-level remotestorage client based on XMLHttpRequest",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: [
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
            var req = XMLHttpRequest.instances.shift();
            req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
            req.status = 200;
            req.response = new ArrayBufferMock('response-body');
            req._onload();
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
            var req = XMLHttpRequest.instances.shift();
            req._onerror('something went wrong at the XHR level');
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
          req.status = 200;
          req.response = new ArrayBufferMock(JSON.stringify({'@context':'http://remotestorage.io/spec/folder-description', items: {}}));
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._onerror('something went wrong at the XHR level');
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
          req.status = 200;
          req.response = new ArrayBufferMock('response-body');
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._onerror('something went wrong at the XHR level');
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
          req.status = 200;
          req.response = new ArrayBufferMock('response-body');
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._onerror('something went wrong at the XHR level');
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
          var request = XMLHttpRequest.instances.shift();
          test.assertTypeAnd(request, 'object');
          test.assert(request._open,
                      ['GET', 'https://example.com/storage/test/foo/bar', true]);
        }
      },

      {
        desc: "#get sends the request",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar');
          var req = XMLHttpRequest.instances.shift();
          test.assertType(req._send, 'object');
        }
      },

      {
        desc: "#get strips duplicate slashes from the path",
        run: function(env, test) {
          env.connectedClient.get('/foo//baz');
          var request = XMLHttpRequest.instances.shift();
          test.assert(request._open[1], 'https://example.com/storage/test/foo/baz');
        }
      },

      {
        desc: "#get doesn't set the 'If-None-Match' when revisions are supported and no rev given",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.get('/foo/bar');
          var request = XMLHttpRequest.instances.shift();
          var hasIfNoneMatchHeader = request._headers.hasOwnProperty('If-None-Match');
          test.assert(hasIfNoneMatchHeader, false);
        }
      },

      {
        desc: "#get sets the 'If-None-Match' to the given value, when revisions are supported and the ifNoneMatch option is provided",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.get('/foo/bar', { ifNoneMatch: 'something' });
          var request = XMLHttpRequest.instances.shift();
          test.assert(request._headers['If-None-Match'], '"something"');
        }
      },

      {
        desc: "#get doesn't set the 'If-None-Match' header, when revisions are not supported",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple'
          });
          env.connectedClient.get('/foo/bar');
          var request = XMLHttpRequest.instances.shift();
          test.assertType(request._headers['If-None-Match'], 'undefined');
        }
      },

      {
        desc: "#get doesn't set the 'If-None-Match' header even though the option is given, when revisions are not supported",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple'
          });
          env.connectedClient.get('/foo/bar', { ifNoneMatch: 'something' });
          var request = XMLHttpRequest.instances.shift();
          test.assertType(request._headers['If-None-Match'], 'undefined');
        }
      },

      {
        desc: "#get sets the 'Authorization' header correctly",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar');
          var request = XMLHttpRequest.instances.shift();
          test.assert(request._headers['Authorization'], 'Bearer ' + env.token);
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
        desc: "#get installs onload and onerror handlers on the request",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar/');
          var req = XMLHttpRequest.instances.shift();
          test.assertTypeAnd(req._onload, 'function');
          test.assertTypeAnd(req._onerror, 'function');
          test.done();
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
          XMLHttpRequest.instances.shift()._onerror('my-error');
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
            var req = XMLHttpRequest.instances.shift();
            req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
            req.status = 200;
            req.response = new ArrayBufferMock('response-body');
            req._onload();
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

          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'application/json; charset=UTF-8';
          req.status = 200;
          req.response = new ArrayBufferMock('{"response":"body"}');
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'application/json; charset=UTF-8';
          req.status = 200;
          req.response = new ArrayBufferMock('{"a":"qwer","b/":"asdf"}');
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'application/json; charset=UTF-8';
          req.status = 200;
          req.response = new ArrayBufferMock(JSON.stringify({
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
          }));
          req._onload();
        }
      },

      {
        desc: "#put encodes special characters in the path",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          var request = RemoteStorage.WireClient.request;

          RemoteStorage.WireClient.request = function(method, url, options) {
            RemoteStorage.WireClient.request = request;
            test.assert(url, 'https://example.com/storage/test/foo/A%252FB/bar', url);
          };

          env.connectedClient.put('/foo/A%2FB/bar', 'baz' , 'text/plain');

          RemoteStorage.WireClient.request = request;
        }
      },

      {
        desc: "#put encodes spaces in the path",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          var request = RemoteStorage.WireClient.request;

          RemoteStorage.WireClient.request = function(method, url, options) {
            RemoteStorage.WireClient.request = request;
            test.assert(url, 'https://example.com/storage/test/foo/A%20B/bar', url);
          };

          env.connectedClient.put('/foo/A B/bar', 'baz' , 'text/plain');

          RemoteStorage.WireClient.request = request;
        }
      },

      {
        desc: "#put leaves slash characters in the path",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          var request = RemoteStorage.WireClient.request;

          RemoteStorage.WireClient.request = function(method, url, options) {
            RemoteStorage.WireClient.request = request;
            test.assert(url, 'https://example.com/storage/test/foo/A/B/C/D/E', url);
          };

          env.connectedClient.put('/foo/A/B/C/D/E', 'baz' , 'text/plain');

          RemoteStorage.WireClient.request = request;
        }
      },

      {
        desc: "#put removes redundant slash characters in the path",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          var request = RemoteStorage.WireClient.request;

          RemoteStorage.WireClient.request = function(method, url, options) {
            RemoteStorage.WireClient.request = request;
            test.assert(url, 'https://example.com/storage/test/foo/A/B/C/D/E', url);
          };

          env.connectedClient.put('/foo/A//B/C///D/E', 'baz' , 'text/plain');

          RemoteStorage.WireClient.request = request;
        }
      },

      {
        desc: "#put doesn't set the 'If-None-Match' when revisions are supported and no rev given",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.put('/foo/bar', 'baz', 'text/plain');
          var request = XMLHttpRequest.instances.shift();
          var hasIfNoneMatchHeader = request._headers.hasOwnProperty('If-None-Match');
          test.assert(hasIfNoneMatchHeader, false);
        }
      },

      {
        desc: "#put doesn't set the 'If-Match' when revisions are supported and no rev given",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.put('/foo/bar', 'baz', 'text/plain');
          var request = XMLHttpRequest.instances.shift();
          var hasIfMatchHeader = request._headers.hasOwnProperty('If-Match');
          test.assert(hasIfMatchHeader, false);
        }
      },

      {
        desc: "#delete doesn't set the 'If-Match' when revisions are supported and no rev given",
        run: function(env, test) {
          env.connectedClient.configure({
            storageApi: 'draft-dejong-remotestorage-01'
          });
          env.connectedClient.delete('/foo/bar');
          var request = XMLHttpRequest.instances.shift();
          var hasIfMatchHeader = request._headers.hasOwnProperty('If-Match');
          test.assert(hasIfMatchHeader, false);
        }
      },

      {
        desc: "WireClient destroys the bearer token after Unauthorized Error",
        run: function(env, test){
          env.rs._emit('error', new RemoteStorage.Unauthorized());
          setTimeout(function() {
            test.assert(env.connectedClient.token, null);
          }, 100);
        }
      },

      {
        desc: "WireClient is not marked offline after SyncError",
        run: function(env, test){
          env.connectedClient.online = true;
          env.rs._emit('error', new RemoteStorage.SyncError());
          setTimeout(function() {
            test.assert(env.connectedClient.online, true);
          }, 100);
        }
      },

      {
        desc: "requests are aborted if they aren't responded after REQUEST_TIMEOUT milliseconds",
        timeout: 3000,
        run: function(env, test) {
          RemoteStorage.WireClient.REQUEST_TIMEOUT = 1000;
          env.connectedClient.get('/foo').then(function() {
            test.result(false);
          }, function (error) {
            console.log('test got errror: ', error);
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'application/octet-stream; charset=binary';
          req.status = 200;
          req.response = new ArrayBufferMock('response-body');
          req._onload();
        }
      },

      {
        desc: "PUTs of ArrayBuffers get a binary charset added",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', new ArrayBuffer('bla', 'UTF-8'), 'image/jpeg', {});
          var request = XMLHttpRequest.instances.shift();
          var contentTypeHeader = request._headers['Content-Type'];
          test.assert(contentTypeHeader, 'image/jpeg; charset=binary');
        }
      },

      {
        desc: "PUTs of ArrayBuffers get no second binary charset added",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', new ArrayBuffer('bla', 'UTF-8'), 'image/jpeg; charset=custom', {});
          var request = XMLHttpRequest.instances.shift();
          var contentTypeHeader = request._headers['Content-Type'];
          test.assert(contentTypeHeader, 'image/jpeg; charset=custom');
        }
      },

      {
        desc: "PUTs of strings get no charset added",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', 'bla', 'text/html', {});
          var request = XMLHttpRequest.instances.shift();
          var contentTypeHeader = request._headers['Content-Type'];
          test.assert(contentTypeHeader, 'text/html');
        }
      },

      {
        desc: "PUTs of strings have UTF-8 charset preserved",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', 'bla', 'text/html; charset=UTF-8', {});
          var request = XMLHttpRequest.instances.shift();
          var contentTypeHeader = request._headers['Content-Type'];
          test.assert(contentTypeHeader, 'text/html; charset=UTF-8');
        }
      },

      {
        desc: "PUTs of strings have custom charset preserved",
        run: function(env, test) {
          env.connectedClient.put('/foo/bar', 'bla', 'text/html; charset=myown', {});
          var request = XMLHttpRequest.instances.shift();
          var contentTypeHeader = request._headers['Content-Type'];
          test.assert(contentTypeHeader, 'text/html; charset=myown');
        }
      },

      {
        desc: "responses without a Content-Type header are left as the raw response",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, {
                iAmA: 'ArrayBufferMock',
                content: 'response-body'
              });
              test.done();
            });
          var req = XMLHttpRequest.instances.shift();
          req.status = 200;
          req.response = new ArrayBufferMock('response-body');
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req.status = 404;
          req.response = '';
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req.status = 404;
          req.response = '';
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req.status = 412;
          req.response = '';
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['ETag'] = '"foo"';
          req.status = 304;
          req.response = '';
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['ETag'] = '"foo"';
          req.status = 204;
          req.response = '';
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['ETag'] = '"foo"';
          req.status = 200;
          req.response = '';
          req._onload();
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
              test.assertTypeAnd(r.revision, 'undefined');
              test.done();
            });
          var req = XMLHttpRequest.instances.shift();
          req.status = 200;
          req.response = '';
          req._onload();
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
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['ETag'] = '"foo"';
          req.status = 200;
          req.response = '';
          req._onload();
        }
      },

      {
        desc: "WireClient sets and removes eventlisteners",
        run: function(env, test) {
          function allHandlers() {
            var handlers = rs._handlers;
            var l = 0;
            for (var k in handlers) {
              l += handlers[k].length;
            }
            return l;
          }
          var rs = new RemoteStorage();
          RemoteStorage.eventHandling(rs, 'error');
          test.assertAnd(allHandlers(), 0, "before init found "+allHandlers()+" handlers") ;

          RemoteStorage.WireClient._rs_init(rs);
          test.assertAnd(allHandlers(), 1, "after init found "+allHandlers()+" handlers") ;

          RemoteStorage.WireClient._rs_cleanup(rs);
          test.assertAnd(allHandlers(), 0, "after cleanup found "+allHandlers()+" handlers") ;

          test.done();
        }
      }
    ]
  });

  return suites;
});

