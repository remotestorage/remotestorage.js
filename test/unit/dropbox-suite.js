if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', './src/util', './src/dropbox', './src/wireclient', './src/eventhandling', './src/config', 'test/behavior/backend', 'test/helpers/mocks'],
       function (require, util, Dropbox, WireClient, eventHandling, config, backend, mocks) {

  var suites = [];

  function setup(env, test) {
    global.RemoteStorage = function () {
      eventHandling(this, 'error', 'connected', 'network-offline', 'network-online');
    };
    RemoteStorage.log = function () {};
    RemoteStorage.prototype.setBackend = function (b) {
      this.backend = b;
    };

    global.localStorage = {
      setItem: function() {},
      removeItem: function() {}
    };

    global.RemoteStorage.Unauthorized = function () {};

    RemoteStorage.prototype.localStorageAvailable = function () {
      return false;
    }

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
    XMLHttpRequest.callbacks = [];
    XMLHttpRequest.prototype = {
      open: function () {
        this._open = Array.prototype.slice.call(arguments);
      },
      send: function () {
        this._send = Array.prototype.slice.call(arguments);

        if (XMLHttpRequest.callbacks.length)
          XMLHttpRequest.callbacks.shift()(this);
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
        set: function (f) {
          this['_on' + cb] = f;
        }
      });
    });
    env.rs = new RemoteStorage();
    env.rs.apiKeys = { dropbox: {appKey: 'testkey'} };

    var oldLocalStorageAvailable = util.localStorageAvailable;
    util.localStorageAvailable = function() { return true; };
    env.client = new Dropbox(env.rs);
    env.connectedClient = new Dropbox(env.rs);
    util.localStorageAvailable = oldLocalStorageAvailable;
    env.baseURI = 'https://example.com/storage/test';
    env.token = 'foobarbaz';
    env.connectedClient.configure({
      userAddress: 'dboxuser',
      href: env.baseURI,
      token: env.token
    });

    mocks.defineMocks(env);

    env.busy = new test.Stub(function(){});
    env.done = new test.Stub(function(){});
    env.networkOffline = new test.Stub(function(){});
    env.networkOnline = new test.Stub(function(){});
    env.connectedClient.on('wire-busy', env.busy);
    env.connectedClient.on('wire-done', env.done);
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
    name: "DropboxClient",
    desc: "backend behavior",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: backend.behavior
  });

  suites.push({
    name: "DropboxClient",
    desc: "Low-level Dropbox client based on XMLHttpRequest",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: [
      {
        desc: "#get fails if not connected",
        willFail: true,
        run: function (env, test) {
          return env.client.get('/foo');
        }
      },
      {
        desc: "#put fails if not connected",
        willFail: true,
        run: function (env, test) {
          return env.client.put('/foo', 'bla');
        }
      },

      {
        desc: "#delete fails if not connected",
        willFail: true,
        run: function (env, test) {
          env.client.delete('/foo');
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
          env.connectedClient.get('/foo').then(function() {
            test.assertAnd(env.networkOnline.numCalled, 1);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
            req._responseHeaders['Dropbox-API-Result'] = JSON.stringify({
              rev: 'rev'
            });
            req.status = 200;
            req.responseText = '{"foo":"response-body"}';
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get with success does not emit network-online if remote.online was true",
        run: function(env, test) {
          env.connectedClient.online = true;
          env.connectedClient.get('/foo').then(function() {
            test.assertAnd(env.networkOnline.numCalled, 0);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
            req._responseHeaders['Dropbox-API-Result'] = JSON.stringify({
              rev: 'rev'
            });
            req.status = 200;
            req.responseText = '{"foo":"response-body"}';
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get emits wire-busy and wire-done on success",
        run: function(env, test) {
          env.connectedClient.get('/foo').then(function() {
            test.assertAnd(env.busy.numCalled, 1);
            test.assertAnd(env.done.numCalled, 1);
            test.done();
          });
          setTimeout(function() {
            var req = XMLHttpRequest.instances.shift();
            req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
            req._responseHeaders['Dropbox-API-Result'] = JSON.stringify({
              rev: 'rev'
            });
            req.status = 200;
            req.responseText = '{"foo":"response-body"}';
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get emits wire-busy and wire-done on failure",
        run: function(env, test) {
          env.connectedClient.get('/foo').then(function() {
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
        desc: "#configure sets the userAddress",
        run: function (env, test) {
          env.client.configure({ userAddress: 'test@example.com' });
          test.assertAnd(env.client.userAddress, 'test@example.com');

          test.done();
        }
      },

      {
        desc: "#configure fetches the user info when no userAddress is given",
        run: function (env, test) {
          env.client.on('connected', function() {
            test.assert(env.client.userAddress, 'john.doe@example.com');
          });

          env.client.configure({
            token: 'thetoken'
          });

          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              "email": "john.doe@example.com"
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
            test.assertAnd(key, 'remotestorage:dropbox');
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
        desc: "#configure doesn't overwrite parameters if they are given as 'undefined'",
        run: function (env, test) {
          env.client.configure({ userAddress: 'test@example.com' });
          test.assertAnd(env.client.userAddress, 'test@example.com');
          env.client.configure({ token: 'abcd' });
          test.assertAnd(env.client.userAddress, 'test@example.com');
          test.assertAnd(env.client.token, 'abcd');
          env.client.configure({
            userAddress: null,
            token: null
          });
          test.assertAnd(env.client.token, null);
          test.assertAnd(env.client.userAddress, null);
          test.done();
        }
      },

      {
        desc: "#configure sets 'connected' to true, once token is given",
        run: function (env, test) {
          env.client.configure({ token: 'foobarbaz' });
          test.assert(env.client.connected, true);
        }
      },

      {
        desc: "#configure caches token and userAddress in localStorage",
        run: function (env, test) {
          var oldSetItem = global.localStorage.setItem;
          global.localStorage.setItem = function(key, value) {
            test.assertAnd(key, 'remotestorage:dropbox');
            test.assert(value, JSON.stringify({
              userAddress: 'john.doe@example.com',
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
              "referral_link": "https://db.tt/QjJhCJr1",
              "display_name": "John Doe",
              "uid": 123456,
              "locale": "en",
              "email_verified": true,
              "team": null,
              "quota_info": {
                "datastores": 0,
                "shared": 1415283650,
                "quota": 6721372160,
                "normal": 860651695
              },
              "is_paired": false,
              "country": "DE",
              "name_details": {
                "familiar_name": "John",
                "surname": "Doe",
                "given_name": "John"
              },
              "email": "john.doe@example.com"
            });
            req._onload();
          }, 10);
        }
      },

      {
        desc: "#get opens a CORS request",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar');
          var req = XMLHttpRequest.instances.shift();
          test.assertTypeAnd(req, 'object');
          test.assert(req._open,
                      ['GET', 'https://content.dropboxapi.com/2/files/download', true]);
        }
      },

      {
        desc: "#get sends the request",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar');
          var req = XMLHttpRequest.instances.shift();
          test.assertType(req._send, 'object');
        }
      },

      {
        desc: "#get sets the 'Authorization' header correctly",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar');
          var request = XMLHttpRequest.instances.shift();
          test.assert(request._headers['Authorization'], 'Bearer ' + env.token);
        }
      },

      {
        desc: "#get returns a promise",
        run: function (env, test) {
          var result = env.connectedClient.get('/foo/bar');
          test.assertTypeAnd(result, 'object');
          test.assertType(result.then, 'function');
        }
      },

      {
        desc: "#get installs onload and onerror handlers on the request",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar/');
          var req = XMLHttpRequest.instances.shift();
          test.assertTypeAnd(req._onload, 'function');
          test.assertTypeAnd(req._onerror, 'function');
          test.done();
        }
      },

      {
        desc: "#get rejects the promise, if onerror is called",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar/').
            then(function () {
              test.result(false);
            }, function (error) {
              test.assert('my-error', error);
            });
          XMLHttpRequest.instances.shift()._onerror('my-error');
        }
      },

      {
        desc: "#get behaves when calling /",
        run: function (env, test) {
          env.connectedClient.get('/').then(test.done, test.fail);
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
          req.status = 200;
          req.responseText = '{"entries":[]}';
          req._onload();
        }
      },

      {
        desc: "#get extracts the Content-Type header, status and responseText and fulfills its promise with those, once onload is called",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, 'response-body');
              test.assert(r.contentType, 'text/plain; charset=UTF-8');
            });
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
          req._responseHeaders['Dropbox-API-Result'] = JSON.stringify({
            rev: 'rev'
          });
          req.status = 200;
          req.responseText = 'response-body';
          req._onload();
        }
      },

      {
        desc: "#get unpacks JSON responses",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, { response: 'body' });
              test.assert(r.contentType, 'application/json; charset=UTF-8');
            });
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'application/json; charset=UTF-8';
          req._responseHeaders['Dropbox-API-Result'] = JSON.stringify({
            rev: 'rev'
          });
          req.status = 200;
          req.responseText = '{"response":"body"}';
          req._onload();
        }
      },

      {
        desc: "#get responds with status 304 if the file has not changed",
        run: function (env, test) {
          env.connectedClient._revCache.set('/foo/bar', 'foo');
          var p = env.connectedClient.get('/foo/bar', { ifNoneMatch: 'foo' });
          p.then(function (r) {
              test.assert(r.statusCode, 304);
            });
        }
      },

      {
        desc: "#get returns the erroneous status it received from DropBox",
        run: function (env, test) {
          env.connectedClient.get('/foo').
            then(function (r) {
              test.assert(r.statusCode, 401);
            });
          var req = XMLHttpRequest.instances.shift();
          req.status = 401;
          req._onload();
        }
      },

      {
        desc: "#get handles inexistent files",
        run: function (env, test) {
          env.connectedClient.get('/foo').
            then(function (r) {
              test.assert(r.statusCode, 404);
            });
          var req = XMLHttpRequest.instances.shift();
          req.status = 409;
          req.responseText = JSON.stringify({
            error_summary: 'path/not_found/...'
          });
          req._onload();
        }
      },

      {
        desc: "#get handles multi-page folders",
        run: function (env, test) {
          var makePayload = function (num, more) {
            return JSON.stringify({
              entries: [
                {'.tag': 'file', path_lower: '/foo/file'+num, rev: 'rev'+num}
              ],
              has_more: more,
              cursor: more ? 'cur'+num : undefined
            });
          }

          XMLHttpRequest.callbacks.push(function (req) {
            req.status = 200;
            req.responseText = makePayload(1, true);
            req._onload();
          });

          XMLHttpRequest.callbacks.push(function (req) {
            req.status = 200;
            req.responseText = makePayload(2, true);
            req._onload();

            test.assertAnd(JSON.parse(req._send).cursor, 'cur1');
          });

          XMLHttpRequest.callbacks.push(function (req) {
            req.status = 200;
            req.responseText = makePayload(3, false);
            req._onload();

            test.assertAnd(JSON.parse(req._send).cursor, 'cur2');
          });

          env.connectedClient.get('/foo/').
            then(function (r) {
              test.assertAnd((r.body.file1 || {}).ETag, 'rev1');
              test.assertAnd((r.body.file2 || {}).ETag, 'rev2');
              test.assert((r.body.file3 || {}).ETag, 'rev3');
            });
        }
      },

      {
        desc: "#get handles an inexistent root folder properly",
        run: function (env, test) {
          env.connectedClient.get('/').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assert(Object.keys(r.body).length, 0);
            });

          var req = XMLHttpRequest.instances.shift();
          req.status = 409;
          req.responseText = JSON.stringify({
            error_summary: 'path/not_found/..'
          });
          req._onload();
        }
      },

      {
        desc: "#put causes the revision to propagate down in revCache",
        run: function (env, test) {
          env.connectedClient._revCache.set('/foo/', 'foo');
          env.connectedClient._revCache.set('/foo/bar', 'foo');
          env.connectedClient.put('/foo/bar', 'data', 'text/plain').
            then(function (r) {
              test.assertAnd(env.connectedClient._revCache.get('/foo/'), 'bar');
              test.assert(env.connectedClient._revCache.get('/foo/bar'), 'bar');
            });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              path: '/remotestorage/foo/bar',
              rev: 'bar'
            });
            req._onload();
          }, 100);
        }
      },

      {
        desc: "#put responds with status 412 if ifMatch condition fails",
        run: function (env, test) {
          env.connectedClient._revCache.set('/foo/bar', 'bar');
          env.connectedClient.put('/foo/bar', 'data', 'text/plain', { ifMatch: 'foo' }).
            then(function (r) {
              test.assertAnd(r.statusCode, 412);
              test.assertAnd(r.revision, 'bar');
            });

          env.connectedClient._revCache.set('/foo/baz', 'foo');
          env.connectedClient.put('/foo/baz', 'data', 'text/plain', { ifMatch: 'foo' }).
            then(function (r) {
              test.assertAnd(r.statusCode, 412);
              test.assert(r.revision, 'bar');
            });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              rev: 'bar'
            });
            req._onload();
          }, 100);
        }
      },

      {
        desc: "#put responds with status 412 if ifNoneMatch condition fails",
        run: function (env, test) {
          env.connectedClient._revCache.set('/foo/bar', 'foo');
          env.connectedClient.put('/foo/bar', 'data', 'text/plain', { ifNoneMatch: '*' }).
            then(function (r) {
              test.assertAnd(r.statusCode, 412);
              test.assertAnd(r.revision, 'foo');
            });

          env.connectedClient.put('/foo/baz', 'data', 'text/plain', { ifNoneMatch: '*' }).
            then(function (r) {
              test.assertAnd(r.statusCode, 412);
              test.assert(r.revision, 'foo');
            });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              hash: 'hash123',
              rev: 'foo'
            });
            req._onload();
          }, 100);
        }
      },

      {
        desc: "#put responds with status 200 on successful put",
        run: function (env, test) {
          env.connectedClient.put('/foo/bar', 'data', 'text/plain').
            then(function (r) {
              test.assert(r.statusCode, 200);
            });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              path: '/remotestorage/foo/bar'
            });
            req._onload();
          }, 100);
        }
      },

      {
        desc: "#put returns the erroneous status it received from DropBox",
        run: function (env, test) {
          env.connectedClient.put('/foo', 'data', 'text/plain').
            then(function (r) {
              test.assert(r.statusCode, 401);
            });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 401;
            req._onload();
          }, 100);
        }
      },

      {
        desc: "#delete returns status 412 if ifMatch condition fails",
        run: function (env, test) {
          env.connectedClient._revCache.set('/foo/bar', 'bar');
          env.connectedClient.delete('/foo/bar', { ifMatch: 'foo' }).
            then(function (r) {
              test.assertAnd(r.statusCode, 412);
              test.assertAnd(r.revision, 'bar');
            });

          env.connectedClient._revCache.set('/foo/baz', 'foo');
          env.connectedClient.delete('/foo/baz', { ifMatch: 'foo' }).
            then(function (r) {
              test.assertAnd(r.statusCode, 412);
              test.assert(r.revision, 'bar');
            });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = JSON.stringify({
              hash: 'hash123',
              rev: 'bar'
            });
            req._onload();
          }, 100);
        }
      },

      {
        desc: "#delete properly deletes file, removes it from revCache and responds with 200",
        run: function (env, test) {
          env.connectedClient._revCache.set('/foo/bar', 'foo');
          env.connectedClient.delete('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assert(env.connectedClient._revCache.get('/foo/bar'), 'rev');
            });

          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 200;
            req.responseText = '{}';
            test.assertAnd(req._open, ['POST', 'https://api.dropboxapi.com/2/files/delete', true]);
            test.assertAnd(JSON.parse(req._send).path, '/remotestorage/foo/bar');
            req._onload();
          }, 100);
        }
      },

      {
        desc: "#delete returns the erroneous status it received from DropBox",
        run: function (env, test) {
          env.connectedClient.delete('/foo').
            then(function (r) {
              test.assert(r.statusCode, 401);
            });
          setTimeout(function () {
            var req = XMLHttpRequest.instances.shift();
            req.status = 401;
            req._onload();
          }, 100);
        }
      },

      {
        desc: "requests are aborted if they aren't responded after the configured timeout",
        timeout: 2000,
        run: function (env, test) {
          const originalTimeout = config.requestTimeout;
          config.requestTimeout = 1000;

          env.connectedClient.get('/foo').then(function () {
            config.requestTimeout = originalTimeout;
            test.result(false);
          }, function (error) {
            config.requestTimeout = originalTimeout;
            test.assert('timeout', error);
          });
        }
      },

      {
        desc: "responses with the charset set to 'binary' are read using a FileReader, after constructing a Blob",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar').
            then(function (r) {
              // check Blob
              test.assertTypeAnd(env.blob, 'object');
              test.assertAnd(env.blob.input, ['response-body']);
              test.assertAnd(env.blob.options, {
                type: 'application/octet-stream; charset=binary'
              });

              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, env.fileReaderResult);
              test.assert(r.contentType, 'application/octet-stream; charset=binary');
            });
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'application/octet-stream; charset=binary';
          req._responseHeaders['Dropbox-API-Result'] = JSON.stringify({
            rev: 'rev'
          });
          req.status = 200;
          req.response = 'response-body';
          req._onload();
        }
      },

      {
        desc: "responses without a Content-Type header still work",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, env.fileReaderResult);
              test.done();
            });
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Dropbox-API-Result'] = JSON.stringify({
            rev: 'rev'
          });
          req.status = 200;
          req.response = 'response-body';
          req._onload();
        }
      },

      {
        desc: "404 responses discard the body altogether",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 404);
              test.assertTypeAnd(r.body, 'undefined');
              test.done();
            });
          var req = XMLHttpRequest.instances.shift();
          req.status = 404;
          req.response = 'response-body';
          req._onload();
        }
      },

//FIXME: fix this test
/*
      {
        desc: "share gets called after geting a public path without touching the fullfilments",
        run: function (env, test) {
          env.connectedClient.get('/public/foo').then(function (status, body, contentType, rev){
            console.log('get fulfilled promise')
            test.assertAnd(r.statusCode, 200, 'status = '+status);
            test.assertAnd(r.revision, 'rev',rev)
            test.assertAnd(body, 'response-body', 'body = '+ body);

            //test.assert(env.connectedClient._itemRefs['/public/foo'],'http://dropbox.shareing/url');
          })
          var getReq = XMLHttpRequest.instances.shift();
          getReq._responseHeaders['x-dropbox-metadata'] = JSON.stringify({
            rev: 'rev'
          })
          getReq.status = 200;
          getReq.responseText = 'response-body';
          getReq._responseHeaders['Content-Type'] = 'text/plain; charset=UTF-8';
          getReq._onload();
          setTimeout(function (){
            var shareReq =  XMLHttpRequest.instances.shift();
            shareReq.responseText = JSON.stringify( {
              url: 'http://dropbox.shareing/url'
            } );
            shareReq._onload();
          }, 100);
        }
      },
*/

      {
        desc: "Dropbox adapter hooks itself into sync cycle when activated",
        run: function (env, test){
          var fetchDeltaCalled = false;

          env.rs.apiKeys= { dropbox: {appKey: 'testkey'} };
          env.rs.backend = 'dropbox';

          env.rs.sync = {
            sync: function() {
              test.assert(fetchDeltaCalled, true);
            }
          };

          Dropbox._rs_init(env.rs);

          env.rs.dropbox.fetchDelta = function() {
            fetchDeltaCalled = true;
            return Promise.resolve();
          };

          env.rs._emit('connected');

          env.rs.sync.sync();
        }
      }
    ]
  });

  return suites;
});

