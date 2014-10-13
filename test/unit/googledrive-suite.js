if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs', 'test/behavior/backend', 'test/helpers/mocks'], function (Promise, requirejs, backend, mocks, undefined) {

  global.Promise = Promise;

  var suites = [];

  function setup (env, test) {
    global.localStorage = {};
    global.RemoteStorage = function () {
      RemoteStorage.eventHandling(this, 'error');
    };
    RemoteStorage.log = function () {};
    RemoteStorage.prototype = {
      setBackend: function (b){
        this.backend = b;
      }
    };
    global.RemoteStorage.Unauthorized = function () {};

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

    require('./src/googledrive');
    if (global.rs_googledrive) {
      RemoteStorage.GoogleDrive = global.rs_googledrive;
    } else {
      global.rs_googledrive = RemoteStorage.GoogleDrive;
    }

    test.done();
  }

  function beforeEach(env, test) {
    global.XMLHttpRequest = function () {
      XMLHttpRequest.instances.push(this);
      this._headers = {};
      this._responseHeaders = {};
    };
    XMLHttpRequest.instances = [];
    XMLHttpRequest.prototype = {
      open: function () {
        this._open = Array.prototype.slice.call(arguments);
      },
      send: function () {
        this._send = Array.prototype.slice.call(arguments);
      },
      setRequestHeader: function (key, value) {
        this._headers[key] = value;
      },
      getResponseHeader: function (key) {
        return this._responseHeaders[key];
      }
    };
    ['load', 'abort', 'error'].forEach(function (cb) {
      Object.defineProperty(XMLHttpRequest.prototype, 'on' + cb, {
        configurable: true,
        set: function(f) {
          this['_on' + cb] = f;
        }
      });
    });
    env.rs = new RemoteStorage();
    env.rs.apiKeys= { googledrive: {api_key: 'testkey'} };
    env.client = new RemoteStorage.GoogleDrive(env.rs);
    env.connectedClient = new RemoteStorage.GoogleDrive(env.rs);
    env.baseURI = 'https://example.com/storage/test';
    env.token = 'foobarbaz';
    env.connectedClient.configure({
      userAddress: 'gduser',
      href: env.baseURI,
      token: env.token
    });

    mocks.defineMocks(env);

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
    name: "GoogleDrive Client",
    desc: "backend behavior",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: backend.behavior
  });

  suites.push({
    name: "GoogleDrive Client",
    desc: "tests for the GoogleDrive backend",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: [
      {
        desc: "#configure sets 'connected' to true, once token is given",
        run: function (env, test) {
          env.client.configure({
            token: 'foobarbaz'
          });
          test.assert(env.client.connected, true);
        }
      },

      {
        desc: "#get returns a promise",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar').then(function () {
            test.result(false, 'get call should not return successful');
          }, function (err) {
            test.assert(err, 'request failed or something: undefined');
          });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get sends the request",
        run: function (env, test) {
          var req;
          env.connectedClient.get('/foo/bar').then(function () {
            test.result(false, 'get call should not return successful');
          }, function (err) {
            test.assertAnd(err, 'request failed or something: undefined');
          }).finally(function () {
            test.assertType(req._send, 'object');
          });
          setTimeout(function () {
            req = XMLHttpRequest.instances.shift();
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get sets the 'Authorization' header correctly",
        run: function (env, test) {
          var req;
          env.connectedClient.get('/foo/bar').then(function () {
            test.result(false, 'get call should not return successful');
          }, function (err) {
            test.assertAnd(err, 'request failed or something: undefined');
          }).finally(function () {
            test.assert(req._headers['Authorization'], 'Bearer ' + env.token);
          });
          setTimeout(function () {
            req = XMLHttpRequest.instances.shift();
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get installs onload and onerror handlers on the request",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar').then(function () {
            test.result(false, 'get call should not return successful');
          }, function (err) {
            test.assertAnd(err, 'request failed or something: undefined');
          }).finally(function () {
            test.done();
          });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            test.assertTypeAnd(req._onload, 'function');
            test.assertTypeAnd(req._onerror, 'function');
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get to folder result calls the files.list API function",
        run: function (env, test) {
          env.connectedClient._fileIdCache.set('/foo/', 'abcd');
          env.connectedClient.get('/foo/')
          .then(function (r) {
            test.assertAnd(r.statusCode, 200);
            test.assertAnd(r.body, {
              'bar/': {
                ETag: '1234'
              },
              'baz.png': {
                ETag: '1234',
                'Content-Type': 'image/png',
                'Content-Length': 25003
              }
            });
            test.assert(r.contentType, 'application/json; charset=UTF-8');
          }, function (err) {
            test.result(false, errr);
          });

          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({ items: [
              {
                etag: '"1234"',
                mimeType: 'application/vnd.google-apps.folder',
                title: 'bar'
              },
              {
                etag: '"1234"',
                mimeType: 'image/png',
                fileSize: 25003,
                title: 'baz.png'
              }
            ] });
            req._onload();
            test.assertAnd(req._open, [
              'GET',
              'https://www.googleapis.com/drive/v2/files?'
                + 'q=' + encodeURIComponent('\'abcd\' in parents')
                + '&fields=' + encodeURIComponent('items(downloadUrl,etag,fileSize,id,mimeType,title)')
                + '&maxResults=1000',
              true
            ]);
          }, 10);
        }
      },

      {
        desc: "#get responds with 304 if the file has not changed",
        run: function (env, test) {
          env.connectedClient._fileIdCache.set('/foo', 'foo_id');
          env.connectedClient.get('/foo', { ifNoneMatch: 'foo' }).
            then(function (r) {
              test.assert (r.statusCode, 304);
            });

          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              etag: '"foo"'
            });
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get to 404 document results in error",
        run: function (env, test) {
          env.connectedClient.get('/foo').then(function (r) {
            test.result(false, 'document get should have been a 404');
          }, function (err) {
            test.assert(err, 'request failed or something: 404');
          });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 404;
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get to 404 folder results in error",
        run: function (env, test) {
          env.connectedClient.get('/foo/').then(function (r) {
            test.result(false, 'file get should have been a 404');
          }, function (err) {
            test.assert(err, 'request failed or something: 404');
          });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 404;
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#put responds with 412 if ifNoneMatch condition fails",
        run: function (env, test) {
          env.connectedClient._fileIdCache.set('/foo', 'foo_id');
          env.connectedClient.put('/foo', 'data', 'text/plain', { ifNoneMatch: '*' }).
            then(function (r) {
              test.assert(r.statusCode, 412);
            });
        }
      },

      {
        desc: "#delete responds with 412 if ifMatch condition fails",
        run: function (env, test) {
          env.connectedClient._fileIdCache.set('/foo', 'foo_id');
          env.connectedClient.delete('/foo', { ifMatch: 'foo_id' }).
            then(function (r) {
              test.assert(r.statusCode, 412);
            });

          setTimeout(function () {
            var reqMeta = XMLHttpRequest.instances.shift();
            reqMeta.status = 200;
            reqMeta.responseText = JSON.stringify({
              etag: '"foo"'
            });
            reqMeta._onload();
          }, 10);
        }
      }

    ]
  });

  return suites;
});

