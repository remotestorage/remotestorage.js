if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', './build/util', './build/dropbox', './build/wireclient',
        './build/eventhandling', './build/config', './build/util',
        'test/behavior/backend', 'test/helpers/mocks'],
       function (require, util, Dropbox, WireClient, EventHandling, config,
                 buildUtil, backend, mocks) {

    var suites = [];

    function setup(env, test) {
      class RemoteStorage {
        setBackend (b) { this.backend = b; }
        static log () {}
      }
      buildUtil.applyMixins(RemoteStorage, [EventHandling]);
      global.RemoteStorage = RemoteStorage;

      global.localStorage = {
        setItem: function() {},
        removeItem: function() {}
      };

      global.RemoteStorage.Unauthorized = function () {};

      global.RemoteStorage.prototype.localStorageAvailable = function () {
        return false;
      };

      global.Authorize = require('./build/authorize');

      test.done();
    }

    function beforeEach(env, test) {
      env.rs = new RemoteStorage();
      env.rs.addEvents(['error', 'connected', 'wire-busy', 'wire-done', 'network-offline', 'network-online']);
      env.rs.apiKeys = { dropbox: {appKey: 'testkey'} };

      var oldLocalStorageAvailable = util.localStorageAvailable;
      util.localStorageAvailable = function() { return true; };
      env.client = new Dropbox(env.rs);
      env.connectedClient = new Dropbox(env.rs);
      env.connectedClient._initialFetchDone = true;
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
      name: "Dropbox",
      desc: "backend behavior",
      setup: setup,
      beforeEach: beforeEach,
      afterEach: afterEach,
      tests: backend.behavior
    });

    var tests = [
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
          desc: "#get fails if initial call to fetchDelta is not yet complete",
          willFail: true,
          run: function (env, test) {
            env.connectedClient._initialFetchDone = false;
            return env.client.get('/foo');
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
              mockRequestFail('something went wrong at the HTTP request level');
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
              mockRequestFail('something went wrong at the HTTP request level');
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
              mockRequestSuccess({
                responseHeaders: {
                  'Content-Type': 'text/plain; charset=UTF-8',
                  'Dropbox-API-Result': JSON.stringify({rev: 'rev'})
                },
                status: 200,
                arrayBuffer: new ArrayBufferMock('{"foo":"response-body"}')
              });
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
              mockRequestSuccess({
                responseHeaders: {
                  'Content-Type': 'text/plain; charset=UTF-8',
                  'Dropbox-API-Result': JSON.stringify({rev: 'rev'})
                },
                status: 200,
                arrayBuffer: new ArrayBufferMock('{"foo":"response-body"}')
              });
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
              mockRequestSuccess({
                responseHeaders: {
                  'Content-Type': 'text/plain; charset=UTF-8',
                  'Dropbox-API-Result': JSON.stringify({rev: 'rev'})
                },
                status: 200,
                arrayBuffer: new ArrayBufferMock('{"foo":"response-body"}')
              });
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
              mockRequestFail('something went wrong at the HTTP request level');
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
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
                  "email": "john.doe@example.com"
                })
              });
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
              mockRequestFail('something went wrong at the HTTP request level');
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
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
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
              })
            });
            }, 10);
          }
        },

        {
          desc: "#get opens a CORS request",
          run: function (env, test) {
            env.connectedClient.get('/foo/bar');
            test.assertAnd(getMockRequestMethod(), 'GET');
            test.assertAnd(getMockRequestUrl(), 'https://content.dropboxapi.com/2/files/download');
            test.done();
          }
        },

        {
          desc: "#get sets the 'Authorization' header correctly",
          run: function (env, test) {
            env.connectedClient.get('/foo/bar');
            test.assert(getMockRequestHeader('Authorization'), 'Bearer ' + env.token);
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
          desc: "#get rejects the promise, if onerror is called",
          run: function (env, test) {
            env.connectedClient.get('/foo/bar/').
              then(function () {
                test.result(false);
              }, function (error) {
                test.assert('my-error', error);
              });
            mockRequestFail('my-error');
          }
        },

        {
          desc: "#get behaves when calling /",
          run: function (env, test) {
            env.connectedClient.get('/').then(test.done, test.fail);
            mockRequestSuccess({
              responseHeaders: {'Content-Type': 'text/plain; charset=UTF-8'},
              status: 200,
              responseText: '{"entries":[]}'
            });
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
            setTimeout(function() {
              mockRequestSuccess({
                responseHeaders: {
                  'Content-Type': 'text/plain; charset=UTF-8',
                  'Dropbox-API-Result': JSON.stringify({rev: 'rev'})
                },
                status: 200,
                arrayBuffer: new ArrayBufferMock('response-body')
              });
            }, 10);
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
            setTimeout(function() {
              mockRequestSuccess({
                responseHeaders: {
                  'Content-Type': 'application/json; charset=UTF-8',
                  'Dropbox-API-Result': JSON.stringify({rev: 'rev'})
                },
                status: 200,
                arrayBuffer: new ArrayBufferMock('{"response":"body"}')
              });
            }, 10);
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
            mockRequestSuccess({
              status: 401,
            });
          }
        },

        {
          desc: "#get handles inexistent files",
          run: function (env, test) {
            env.connectedClient.get('/foo').
              then(function (r) {
                test.assert(r.statusCode, 404);
              });
            mockRequestSuccess({
              status: 409,
              arrayBuffer: new ArrayBufferMock(JSON.stringify({
                error_summary: 'path/not_found/...'
              }))
            });
          }
        },

        {
          desc: "#get handles multi-page folders",
          run: function (env, test) {
            var makePayload = function (num, more) {
              return JSON.stringify({
                entries: [
                  {'.tag': 'file', path_display: '/foo/file'+num, rev: 'rev'+num}
                ],
                has_more: more,
                cursor: more ? 'cur'+num : undefined
              });
            }

            addMockRequestCallback(function(req) {
              mockRequestSuccess({
                status: 200,
                responseText: makePayload(1, true)
              });
            });
            addMockRequestCallback(function(req) {
              mockRequestSuccess({
                status: 200,
                responseText: makePayload(2, true)
              });
            });
            addMockRequestCallback(function(req) {
              mockRequestSuccess({
                status: 200,
                responseText: makePayload(3, false)
              });
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
            mockRequestSuccess({
              status: 409,
              responseText: JSON.stringify({
                error_summary: 'path/not_found/..'
              })
            });
          }
        },

        {
          desc: "#get handles inexistent folders properly",
          run: function (env, test) {
            env.connectedClient.get('/bookmarks/').
              then(function (r) {
                test.assertAnd(r.statusCode, 200);
                test.assert(Object.keys(r.body).length, 0);
              });
            mockRequestSuccess({
              status: 409,
              responseText: JSON.stringify({
                error_summary: 'path/not_found/..'
              })
            });
          }
        },

        {
          desc: "changes in subfolders are recognized after sync",
          run: function (env, test) {
            env.connectedClient.get('/').then(function (r) {
              env.connectedClient.fetchDelta().then(function (fetchResponse) {
                env.connectedClient.get('/', { ifNoneMatch: r.revision }).then(function (r) {
                  test.assertFail(r.statusCode, 304);
                  test.assertFail(env.connectedClient._revCache.get('/foo/'), 'rev');
                });
                mockRequestSuccess({
                  status: 200,
                  responseText: JSON.stringify({
                    entries: [{
                      '.tag': 'file',
                      path_display: '/remotestorage/file',
                      rev: '1'
                    },
                    {
                      '.tag': 'folder',
                      path_display: '/remotestorage/foo',
                    }]
                  })
                });
              });
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
                  entries: [{
                      '.tag': 'file',
                      path_display: '/remotestorage/file',
                      rev: '1'
                    },
                    {
                      '.tag': 'folder',
                      path_display: '/remotestorage/foo',
                    },
                    {
                      '.tag': 'file',
                      path_display: '/remotestorage/foo/bar',
                      rev: '1'
                  }]
                })
              });
            });
            mockRequestSuccess({
              status: 200,
              responseText: JSON.stringify({
                entries: [{
                    '.tag': 'file',
                    path_display: '/remotestorage/file',
                    rev: '1'
                  },
                  {
                    '.tag': 'folder',
                    path_display: '/remotestorage/foo',
                  }]
              })
            });
          }
        },

        {
          desc: "#put causes the revision to propagate down in revCache",
          run: function (env, test) {
            env.connectedClient._revCache.set('/', 'foo');
            env.connectedClient._revCache.set('/foo/', 'foo');
            env.connectedClient._revCache.set('/foo/bar', 'foo');
            env.connectedClient.put('/foo/bar', 'data', 'text/plain').
              then(function (r) {
                test.assertFail(env.connectedClient._revCache.get('/foo/'), 'foo');
                test.assertFail(env.connectedClient._revCache.get('/'), 'foo');
                test.assert(env.connectedClient._revCache.get('/foo/bar'), 'bar');
              });
            setTimeout(function () {
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
                  path: '/remotestorage/foo/bar',
                  rev: 'bar'
                })
              });
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
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
                  rev: 'bar'
                })
              });
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
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
                  hash: 'hash123',
                  rev: 'foo'
                })
              });
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
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
                  path: '/remotestorage/foo/bar'
                })
              });
            }, 100);
          }
        },

        {
          desc: "#put responds with the revision of the file when successful",
          run: function (env, test) {
            env.connectedClient.put('/foo/bar', 'data', 'text/plain').
              then(function (r) {
                test.assert(r.revision, 'some-revision');
              });
            setTimeout(function () {
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
                  path: '/remotestorage/foo/bar',
                  rev: 'some-revision'
                })
              });
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
              mockRequestSuccess({
                status: 401,
              });
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
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify({
                  hash: 'hash123',
                  rev: 'bar'
                })
              });
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
                test.assert(env.connectedClient._revCache.get('/foo/bar'), null);
              });
              test.assertAnd(getMockRequestMethod(), 'POST');
              test.assertAnd(getMockRequestUrl(), 'https://api.dropboxapi.com/2/files/delete');
              test.assertAnd(JSON.parse(getMockRequestBody()).path, '/remotestorage/foo/bar');


            setTimeout(function () {
              mockRequestSuccess({
                status: 200,
                responseText: '{}'
              });
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
              mockRequestSuccess({
                status: 401,
              });
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
          desc: "responses with binary data are returned as an ArrayBuffer",
          run: function (env, test) {
            env.connectedClient.get('/foo/bar').
              then(function (r) {
                test.assertAnd(r.statusCode, 200);
                test.assertAnd(r.body, {
                  iAmA: 'ArrayBufferMock',
                  content: "\x00"
                });
                test.done();
              });
              mockRequestSuccess({
                responseHeaders: {
                  'Content-Type': 'application/octet-stream',
                  'Dropbox-API-Result': JSON.stringify({rev: 'rev'})
                },
                status: 200,
                arrayBuffer: new ArrayBufferMock("\x00")
              });
          }
        },

        {
          desc: "responses without a Content-Type header still work",
          run: function (env, test) {
            env.connectedClient.get('/foo/bar').
              then(function (r) {
                test.assertAnd(r.statusCode, 200);
                test.assertAnd(r.body, 'response-body');
                test.done();
              });
            mockRequestSuccess({
              responseHeaders: {
                'Dropbox-API-Result': JSON.stringify({rev: 'rev'})
              },
              status: 200,
              arrayBuffer: new ArrayBufferMock('response-body')
            });
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
            mockRequestSuccess({
              status: 404,
              response: 'response-body'
            });
          }
        },

        {
          desc: "fetchDelta doesn't fail on timeouts",
          run: function (env, test) {
            const originalRequestFunction = env.connectedClient._request;

            env.connectedClient._request = function() {
              return Promise.reject('timeout');
            };

            env.connectedClient.fetchDelta().then(() => {
              env.connectedClient._request = originalRequestFunction;
              test.done();
            }).catch((error) => {
              env.connectedClient._request = originalRequestFunction;
              test.fail(error);
            });
          }
        },

        // The test "fetchDelta doesn't fail when offline" tested a scenario
        // that could never occur: fetchWithTimeout throwing a ProgressEvent

        {
          desc: "share gets called after getting a public path without touching the fullfilments",
          run: function (env, test) {
            const oldShare = env.connectedClient.share;
            env.connectedClient.share = function(path) {
              oldShare.bind(env.connectedClient)(path)
                .then(function (r) {
                  test.assert(env.connectedClient._itemRefs['/public/foo'],'http://dropbox.shareing/url');
                  test.done();
                })
                .catch(function (err) {
                  test.fail(err);
                });
              env.connectedClient.share = oldShare;
            };

            addMockRequestCallback(function (req) {
              mockRequestSuccess({
                status: 200,
                responseHeaders: {
                  'Content-Type': 'text/plain; charset=UTF-8',
                  'Dropbox-API-Result': JSON.stringify({rev: 'rev'})
                },
                arrayBuffer: new ArrayBufferMock('response-body')
              });
            });
            addMockRequestCallback(function (req) {
              mockRequestSuccess({
                status: 200,
                responseText: JSON.stringify( {
                  url: 'http://dropbox.shareing/url'
                })
              });
            });
            env.connectedClient.get('/public/foo').then(function (r){
              test.assertAnd(r.statusCode, 200, 'status = '+r.statusCode);
              test.assertAnd(r.revision, 'rev',r.revision)
              test.assertAnd(r.body, 'response-body', 'body = '+ r.body);
            })
          }
        },


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
    ];

    var xhrTests = tests.concat([
      {
        desc: "#get sends the request",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar');
          var req = XMLHttpRequest.instances.shift();
          test.assertType(req._send, 'object');
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
      }
    ]);

    suites.push({
        name: "Dropbox (XMLHttpRequest)",
        desc: "Low-level Dropbox client based on XMLHttpRequest",
        setup: setup,
        beforeEach: beforeEachXHR,
        afterEach: afterEach,
        tests: xhrTests
    });

    suites.push({
      name: "Dropbox (fetch)",
      desc: "Low-level Dropbox client based on fetch",
      setup: setup,
      beforeEach: beforeEachFetch,
      afterEach: afterEach,
      tests: tests
    });


    return suites;
  }
);

