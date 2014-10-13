if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs', 'test/behavior/backend', 'test/helpers/mocks'], function (Promise, requirejs, backend, mocks, undefined) {

  global.Promise = Promise;

  var suites = [];

  function setup(env, test) {
    global.RemoteStorage = function () {
      RemoteStorage.eventHandling(this, 'error');
    };
    RemoteStorage.log = function () {};
    RemoteStorage.prototype = {
      setBackend: function (b){
        this.backend = b;
      },
      localStorageAvailable: function () {
        return false;
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

    require('./src/dropbox');
    if (global.rs_dropbox) {
      RemoteStorage.Dropbox = global.rs_dropbox;
    } else {
      global.rs_dropbox = RemoteStorage.Dropbox;
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
        set: function (f) {
          this['_on' + cb] = f;
        }
      });
    });
    env.rs = new RemoteStorage();
    env.rs.apiKeys = { dropbox: {api_key: 'testkey'} };
    env.client = new RemoteStorage.Dropbox(env.rs);
    env.connectedClient = new RemoteStorage.Dropbox(env.rs);
    env.baseURI = 'https://example.com/storage/test';
    env.token = 'foobarbaz';
    env.connectedClient.configure({
      userAddress: 'dboxuser',
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
        desc: "#configure sets the userAddress",
        run: function (env, test) {
          env.client.configure({ userAddress: 'test@example.com' });
          test.assertAnd(env.client.userAddress, 'test@example.com');

          test.done();
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
        desc: "#get opens a CORS request",
        run: function (env, test) {
          env.connectedClient.get('/foo/bar');
          var request = XMLHttpRequest.instances.shift();
          test.assertTypeAnd(request, 'object');
          console.log("REQUEST OPEN",request._open);
          test.assert(request._open,
                      ['GET', 'https://api-content.dropbox.com/1/files/auto/foo/bar', true]);
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
        desc: "#get strips duplicate slashes from the path",
        run: function (env, test) {
          env.connectedClient.get('/foo//baz');
          var request = XMLHttpRequest.instances.shift();
          test.assert(request._open[1], 'https://api-content.dropbox.com/1/files/auto/foo/baz');
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
          req._responseHeaders['x-dropbox-metadata'] = JSON.stringify({
            mime_type: 'text/plain; charset=UTF-8',
            rev: 'rev'
          });
          req.status = 200;
          req.responseText = '{"foo":"response-body"}';
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
          req._responseHeaders['x-dropbox-metadata'] = JSON.stringify({
            mime_type: 'text/plain; charset=UTF-8',
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
          req._responseHeaders['x-dropbox-metadata'] = JSON.stringify({
            mime_type: 'text/plain; charset=UTF-8',
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
              path: '/foo/bar',
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
              path: '/foo/bar'
            });
            req._onload();
          }, 100);
        }
      },

      {
        desc: "#put correctly handles a conflict after metadata check",
        run: function (env, test) {
          var waitlist = [];

          // PUT
          waitlist.push(function (req) {
            req.status = 200;
            req.responseText = JSON.stringify({
              path: '/foo/bar_2'
            });
            setTimeout(function () {
              req._onload();
            }, 10);
          });

          // delete
          waitlist.push(function (req) {
            test.assertAnd(req._open, ['POST', 'https://api.dropbox.com/1/fileops/delete?root=auto&path=%2Ffoo%2Fbar_2', true]);
          });

          // metadata
          waitlist.push(function (req) {
            req.status = 200;
            req.responseText = JSON.stringify({
              rev: 'foo'
            });
            setTimeout(function () {
              req._onload();
            }, 10);
          });

          env.connectedClient.put('/foo/bazz', 'data', 'text/plain').
            then(function (r) {
              test.assertAnd(r.statusCode, 412);
              test.assert(r.revision, 'foo');
            });

          (function handleWaitlist () {
            if (waitlist.length > 0) {
              if (XMLHttpRequest.instances.length > 0) {
                waitlist.shift()(XMLHttpRequest.instances.shift());
              }
              setTimeout(handleWaitlist, 5);
            }
          })();
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
            test.assertAnd(req._open, ['POST', 'https://api.dropbox.com/1/fileops/delete?root=auto&path=%2Ffoo%2Fbar', true]);
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
        desc: "WireClient destroys the bearer token after Unauthorized Error",
        run: function (env, test){
          env.rs._emit('error', new RemoteStorage.Unauthorized());
          setTimeout(function () {
            test.assert(env.connectedClient.token, null);
          }, 100);
        }
      },

      {
        desc: "requests are aborted if they aren't responded after REQUEST_TIMEOUT milliseconds",
        timeout: 2000,
        run: function (env, test) {
          RemoteStorage.WireClient.REQUEST_TIMEOUT = 1000;
          env.connectedClient.get('/foo').then(function () {
            test.result(false);
          }, function (error) {
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
          req._responseHeaders['x-dropbox-metadata'] = JSON.stringify({
            mime_type: 'application/octet-stream; charset=binary',
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
          req._responseHeaders['x-dropbox-metadata'] = JSON.stringify({
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
        desc: "dropbox Adapter sets and removes EventHandlers",
        run: function (env, test){
          function allHandlers() {
            var handlers = rs._handlers;
            var l = 0;
            for (var k in handlers) {
              l += handlers[k].length;
            }
            return l;
          }
          var rs = new RemoteStorage();
          rs.apiKeys= { dropbox: {api_key: 'testkey'} };

          test.assertAnd(allHandlers(), 0, "before init found "+allHandlers()+" handlers") ;

          RemoteStorage.Dropbox._rs_init(rs);
          test.assertAnd(allHandlers(), 1, "after init found "+allHandlers()+" handlers") ;

          RemoteStorage.Dropbox._rs_cleanup(rs);
          test.assertAnd(allHandlers(), 0, "after cleanup found "+allHandlers()+" handlers") ;

          test.done();
        }
      }
    ]
  });

  return suites;
});

