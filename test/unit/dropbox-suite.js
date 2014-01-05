if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
if(typeof global === 'undefined') global = window
global.RemoteStorage = function() {};

define(['../../lib/promising','../../src/eventhandling','../../src/wireclient', '../../src/dropbox'], function() {
  var suites = [];

  suites.push({
    name: "DropboxClient",
    desc: "Low-level Dropbox client based on XMLHttpRequest",
    setup: function(env, test) {
      RemoteStorage.log = function() {};
      RemoteStorage.prototype = {
        setBackend: function(b){
          this.backend = b;
        },
        localStorageAvailable: function() {
          return false;
        }
      };
      global.RemoteStorage.Unauthorized = function() {};


      if (global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }


      if (global.rs_wireclient) {
        RemoteStorage.WireClient = global.rs_wireclient;
      } else {
        global.rs_wireclient = RemoteStorage.WireClient;
      }

      test.done();
    },

    beforeEach: function(env, test) {
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
      
      env.rs.apiKeys= { dropbox: {api_key: 'testkey'} };
      env.client = new RemoteStorage.Dropbox(env.rs);
      env.connectedClient = new RemoteStorage.Dropbox(env.rs);
      env.baseURI = 'https://example.com/storage/test';
      env.token = 'foobarbaz';
      env.connectedClient.configure(
        'dboxuser', env.baseURI, undefined, env.token
      );
      global.Blob = function(input, options) {
        this.input = input;
        this.options = options;
        env.blob = this;
      };
      global.FileReader = function() {};
      FileReader.prototype = {
        _events: {
          loadend: []
        },
        addEventListener: function(eventName, handler) {
          this._events[eventName].push(handler);
        },
        readAsArrayBuffer: function(blob) {
          setTimeout(function() {
            this.result = env.fileReaderResult = Math.random();
            this._events.loadend[0]();
          }.bind(this), 0);
        }
      };

      test.done();
    },

    afterEach: function(env, test) {
      delete global.XMLHttpRequest;
      delete global.Blob;
      delete global.FileReader;
      delete env.client;
      delete env.blob;
      delete env.fileReaderResult;
      test.done();
    },

    tests: [
      {
        desc: "it's initially not connected",
        run: function(env, test) {
          test.assert(env.client.connected, false);
        }
      },

      {
        desc: "#get / #put / #delete throw an exception if not connected",
        run: function(env, test) {
          try {
            env.client.get('/foo');
            test.result(false);
            return;
          } catch(e) {}

          try {
            env.client.put('/foo', 'bla');
            test.result(false);
            return;
          } catch(e) {}

          try {
            env.client.delete('/foo');
            test.result(false);
            return;
          } catch(e) {}
          test.done();
        }
      },

      {
        desc: "#configure sets the userAddress",
        run: function(env, test) {
          env.client.configure('test@example.com');
          test.assertAnd(env.client.userAddress, 'test@example.com');

          test.done();
        }
      },

      {
        desc: "#configure doesn't overwrite parameters if they are given as 'undefined'",
        run: function(env, test) {
          env.client.configure('test@example.com');
          test.assertAnd(env.client.userAddress, 'test@example.com');
          env.client.configure(undefined, undefined, undefined, 'abcd');
          test.assertAnd(env.client.userAddress, 'test@example.com');
          test.assertAnd(env.client.token, 'abcd');
          env.client.configure(null, undefined, undefined, null);
          test.assertAnd(env.client.token, null);
          test.assertAnd(env.client.userAddress, null);
          test.done();
        }
      },

      {
        desc: "#configure sets 'connected' to true, once token is given",
        run: function(env, test) {
          env.client.configure(undefined, undefined, undefined, 'foobarbaz');
          test.assert(env.client.connected, true);
        }
      },

      {
        desc: "#get opens a CORS request",
        run: function(env, test) {
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
          test.assert(request._open[1], 'https://api-content.dropbox.com/1/files/auto/foo/baz');
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
            then(function(status, body, contentType) {
              test.assertAnd(status, 200);
              test.assertAnd(body, 'response-body');
              test.assert(contentType, 'text/plain; charset=UTF-8');
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
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(status, body, contentType) {
              test.assertAnd(status, 200);
              test.assertAnd(body, { response: 'body' });
              test.assert(contentType, 'application/json; charset=UTF-8');
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
        desc: "WireClient destroys the bearer token after Unauthorized Error",
        run: function(env, test){
          env.rs._emit('error', new RemoteStorage.Unauthorized());
          setTimeout(function() {
            test.assert(env.connectedClient.token, null);
          }, 100);
        }
      },

      {
        desc: "requests are aborted if they aren't responded after REQUEST_TIMEOUT milliseconds",
        timeout: 2000,
        run: function(env, test) {
          RemoteStorage.WireClient.REQUEST_TIMEOUT = 1000;
          env.connectedClient.get('/foo').then(function() {
            test.result(false);
          }, function(error) {
            test.assert('timeout', error);
          });
        }
      },

      {
        desc: "responses with the charset set to 'binary' are read using a FileReader, after constructing a Blob",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(status, body, contentType) {
              // check Blob
              test.assertTypeAnd(env.blob, 'object');
              test.assertAnd(env.blob.input, ['response-body']);
              test.assertAnd(env.blob.options, {
                type: 'application/octet-stream; charset=binary'
              });

              test.assertAnd(status, 200);
              test.assertAnd(body, env.fileReaderResult);
              test.assert(contentType, 'application/octet-stream; charset=binary');
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
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(status, body, contentType) {
              test.assertAnd(status, 200);
              test.assertAnd(body, env.fileReaderResult);
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
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(status, body, contentType) {
              test.assertAnd(status, 404);
              test.assertTypeAnd(body, 'undefined');
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
        run: function(env, test) {
          env.connectedClient.get('/public/foo').then(function(status, body, contentType, rev){
            console.log('get fulfilled promise')
            test.assertAnd(status, 200, 'status = '+status);
            test.assertAnd(rev,'rev',rev)
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
          setTimeout(function(){
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
        run: function(env, test){
          var rs = new RemoteStorage();
          RemoteStorage.eventHandling(rs, 'error');
          function allHandlers() {
            var handlers = rs._handlers;
            var l = 0;
            for (var k in handlers) {
              l += handlers[k].length;
            }
            return l;
          }

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

