if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['util', 'require', './src/eventhandling', './src/googledrive', './src/config', 'test/behavior/backend', 'test/helpers/mocks'],
       function (util, require, eventHandling, GoogleDrive, config, backend, mocks) {

  var suites = [];

  function setup (env, test) {
    global.localStorage = {
      setItem: function() {},
      removeItem: function() {}
    };
    global.RemoteStorage = function () {
      eventHandling(this, 'error', 'wire-busy', 'wire-done', 'network-offline',
                    'network-online');
    };
    RemoteStorage.prototype = {
      setBackend: function (b) {
        this.backend = b;
      }
    };

    global.Authorize = require('./src/authorize');

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
    env.rs.apiKeys= { googledrive: {clientId: 'testkey'} };
    var oldLocalStorageAvailable = util.localStorageAvailable;
    util.localStorageAvailable = function() { return true; };
    env.client = new GoogleDrive(env.rs);
    env.connectedClient = new GoogleDrive(env.rs);
    util.localStorageAvailable = oldLocalStorageAvailable;
    env.baseURI = 'https://example.com/storage/test';
    env.token = 'foobarbaz';
    env.connectedClient.configure({
      userAddress: 'gduser',
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
        desc: "#configure sets token and userAddress when given",
        run: function (env, test) {
          env.client.configure({
            token: 'thetoken',
            userAddress: 'john.doe@gmail.com'
          });
          test.assertAnd(env.client.token, 'thetoken');
          test.assert(env.client.userAddress, 'john.doe@gmail.com');
        }
      },

      {
        desc: "#configure fetches the user info when no userAddress is given",
        run: function (env, test) {
          env.client.on('connected', function() {
            test.assert(env.client.userAddress, 'john.doe@gmail.com');
          });

          env.client.configure({
            token: 'thetoken'
          });

          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              "user": {
                "displayName": "John Doe",
                "emailAddress": "john.doe@gmail.com",
                "isAuthenticatedUser": true,
                "kind": "drive#user",
                "permissionId": "02787362847200372917",
                "picture": {
                  "url": "https://lh6.googleusercontent.com/-vOkeOMO0HKQ/AAAAAAAAAAI/AAAAAAAAAQ4/KeL71nrpGVs/s64/photo.jpg"
                }
              }
            });
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#configure emits error when the user info can't be fetched",
        run: function (env, test) {
          var oldRemoveItem = global.localStorage.removeItem;
          global.localStorage.removeItem = function(key) {
            test.assertAnd(key, 'remotestorage:googledrive');
            global.localStorage.removeItem = oldRemoveItem;
          };

          env.rs.on('error', function(error) {
            test.assert(error.message, 'Could not fetch user info.');
          });

          env.client.on('connected', function() {
            test.result(false);
          });

          env.client.configure({
            token: 'thetoken'
          });

          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req._onerror('something went wrong at the XHR level');
          }, 10);
        }
      },

      {
        desc: "#configure caches token and userAddress in localStorage",
        run: function (env, test) {
          var oldSetItem = global.localStorage.setItem;
          global.localStorage.setItem = function(key, value) {
            test.assertAnd(key, 'remotestorage:googledrive');
            test.assert(value, JSON.stringify({
              userAddress: 'john.doe@gmail.com',
              token: 'thetoken'
            }));
            global.localStorage.setItem = oldSetItem;
          };

          env.client.configure({
            token: 'thetoken'
          });

          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              "user": {
                "displayName": "John Doe",
                "emailAddress": "john.doe@gmail.com",
                "isAuthenticatedUser": true,
                "kind": "drive#user",
                "permissionId": "02787362847200372917",
                "picture": {
                  "url": "https://lh6.googleusercontent.com/-vOkeOMO0HKQ/AAAAAAAAAAI/AAAAAAAAAQ4/KeL71nrpGVs/s64/photo.jpg"
                }
              }
            });
            req._onload();
          }, 10);
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
          }).catch(function (err) {
            test.assertAnd(err, 'request failed or something: undefined');
          }).then(function () {
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
          }).catch(function (err) {
            test.assertAnd(err, 'request failed or something: undefined');
          }).then(function () {
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
          }).catch(function (err) {
            test.assertAnd(err, 'request failed or something: undefined');
          }).then(function () {
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
          env.connectedClient._fileIdCache.set('/remotestorage/foo/', 'abcd');
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
          env.connectedClient._fileIdCache.set('/remotestorage/foo', 'foo_id');
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
        desc: "#get with request failure emits network-offline if remote.online was true",
        run: function(env, test) {
          env.connectedClient.online = true;
          env.connectedClient.get('/foo').then(function() {
          }, function(err) {
            test.assertAnd(env.networkOffline.numCalled, 1);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req._onerror('something went wrong at the XHR level');
          }, 10);
        }
      },

      {
        desc: "#get with request failure does not emit network-offline if remote.online was false",
        run: function(env, test) {
          env.connectedClient.online = false;
          env.connectedClient.get('/foo').then(function() {
          }, function(err) {
            test.assertAnd(env.networkOffline.numCalled, 0);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req._onerror('something went wrong at the XHR level');
          }, 10);
        }
      },

      {
        desc: "#get with success emits network-online if remote.online was false",
        run: function(env, test) {
          env.connectedClient.online = false;
          env.connectedClient._fileIdCache.set('/remotestorage/foo', 'foo_id');
          env.connectedClient.get('/foo').then(function() {
            test.assertAnd(env.networkOnline.numCalled, 1);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({ items: [
              { etag: '"1234"' }
            ] });
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get with success does not emit network-online if remote.online was true",
        run: function(env, test) {
          env.connectedClient.online = true;
          env.connectedClient._fileIdCache.set('/remotestorage/foo', 'foo_id');
          env.connectedClient.get('/foo').then(function() {
            test.assertAnd(env.networkOnline.numCalled, 0);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({ items: [
              { etag: '"1234"' }
            ] });
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get emits wire-busy and wire-done on success",
        run: function(env, test) {
          env.connectedClient._fileIdCache.set('/remotestorage/foo/', 'abcd');
          env.connectedClient.get('/foo/').then(function() {
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({ items: [
              { etag: '"1234"' }
            ] });
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get emits wire-busy and wire-done on failure",
        run: function(env, test) {
          env.connectedClient.get('/foo/').then(function() {
          }, function (err) {
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req._onerror('something went wrong at the XHR level');
          }, 10);
        }
      },

      {
        desc: "#put responds with 412 if ifNoneMatch condition fails",
        run: function (env, test) {
          env.connectedClient._fileIdCache.set('/remotestorage/foo', 'foo_id');
          env.connectedClient.put('/foo', 'data', 'text/plain', { ifNoneMatch: '*' }).
            then(function (r) {
              test.assert(r.statusCode, 412);
            });
        }
      },

      {
        desc: "#delete responds with 412 if ifMatch condition fails",
        run: function (env, test) {
          env.connectedClient._fileIdCache.set('/remotestorage/foo', 'foo_id');
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
      },

      {
        desc: "requests are aborted if they aren't responded after the configured timeout",
        timeout: 2000,
        run: function (env, test) {
          const originalTimeout = config.requestTimeout;
          config.requestTimeout = 1000;

          env.connectedClient.get('/foo/bar').then(function () {
            config.requestTimeout = originalTimeout;
            test.result(false);
          }, function (error) {
            config.requestTimeout = originalTimeout;
            test.assert('timeout', error);
          });
        }
      }

    ]
  });

  return suites;
});

