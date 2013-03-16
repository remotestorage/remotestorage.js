if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {
  
  var suites = [];

  var util;
  var BrowserHTTP;

  suites.push({
    name: 'BrowserHTTP',
    desc: "HTTP implementation backed by XMLHttpRequest with CORS support",
    setup: function(env, test) {

      global.XMLHttpRequest = function() {
        env.xhr.push(this);
        this._handlers = {};
        this._headers = {};
        this._responseHeaders = {};
      };
      global.XMLHttpRequest.prototype = {
        open: function(method, uri, cors) {
          this._open = [method, uri, cors];
        },
        addEventListener: function(eventName, handler) {
          this._handlers[eventName] = handler;
        },
        send: function(body) {
          this._send = body;
        },
        setRequestHeader: function(key, value) {
          this._headers[key] = value;
        },
        getAllResponseHeaders: function() {
          return this._rawResponseHeaders || '';
        },
        getResponseHeader: function(key) {
          return this._responseHeaders[key];
        }
      };

      requirejs([
        './src/lib/util',
        './src/lib/http/browser'
      ], function(_util, _BrowserHTTP) {
        util = _util;
        BrowserHTTP = _BrowserHTTP;
        test.result(true);
      });
    },

    beforeEach: function(env, test) {
      env.xhr = [];
      test.result(true);
    },

    tests: [

      {
        desc: "returns a promise",
        run: function(env, test) {
          var result = BrowserHTTP();
          util.nextTick(function() {
            test.assertTypeAnd(result, 'object')
            test.assertType(result.then, 'function');
          });
        }
      },

      {
        desc: "opens an XMLHttpRequest",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/');
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            test.assert(env.xhr[0]._open, [
              'GET', 'http://local.dev/', true
            ]);
          });
        }
      },

      {
        desc: "sets the request headers",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/', {
            Foo: 'bar'
          });
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            test.assert(env.xhr[0]._headers, {
              Foo: 'bar'
            });
          });
        }
      },

      {
        desc: "sends the given body",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/', {
            Foo: 'bar'
          }, 'baz');
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            test.assert(env.xhr[0]._send, 'baz');
          });
        }
      },

      {
        desc: "sets up a 'load' callback",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/');
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            test.assertType(
              env.xhr[0]._handlers.load, 'function'
            );
          });
        }
      },

      {
        desc: "sets up an 'error' callback",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/');
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            test.assertType(
              env.xhr[0]._handlers.error, 'function'
            );
          });
        }
      },

      {
        desc: "rejects it's promise, when the 'error' event is fired and no status is set",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/').
            then(function() {
              test.result(false, 'promise was fulfilled');
            }, function(error) {
              test.assert(error, 'ERROR');
            });
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            var xhr = env.xhr[0];
            xhr._handlers.error('ERROR');
          });
        }
      },

      {
        desc: "fulfills it's promise, when the 'error' event is fired but a status is set",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/').
            then(function(response) {
              test.assert(response.status, 500);
            }, function(error) {
              test.result(false, 'promise was rejected');
            });
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            var xhr = env.xhr[0];
            xhr.status = 500;
            xhr._handlers.error('ERROR');
          });
        }
      },

      {
        desc: "fulfills it's promise, when the 'load' event is fired",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/').
            then(function(response) {
              test.assert(response.status, 200);
            }, function(error) {
              test.result(false, 'promise was rejected');
            });
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            var xhr = env.xhr[0];
            xhr.status = 200;
            xhr._handlers.load();
          });
        }
      },

      {
        desc: "passes on the responseText",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/').
            then(function(response) {
              test.assertAnd(response.status, 200);
              test.assert(response.body, 'Hello!');
            }, function(error) {
              test.result(false, 'promise was rejected');
            });
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            var xhr = env.xhr[0];
            xhr.status = 200;
            xhr.responseText = 'Hello!';
            xhr._handlers.load();
          });
        }
      },

      {
        desc: "extracts the correct headers",
        run: function(env, test) {
          BrowserHTTP('GET', 'http://local.dev/').
            then(function(response) {
              test.assertAnd(response.status, 200);
              test.assert(response.headers, {
                'content-type': 'application/json; charset=utf-8',
                'etag': 'version-123'
              }, 'headers: ' + JSON.stringify(response.headers));
            }, function(error) {
              test.result(false, 'promise was rejected');
            });
          util.nextTick(function() {
            test.assertAnd(env.xhr.length, 1);
            var xhr = env.xhr[0];
            xhr.status = 200;
            xhr._rawResponseHeaders = '';
            xhr._responseHeaders = {
              'Content-Type': 'application/json; charset=utf-8',
              'ETag': 'version-123'
            };
            xhr._handlers.load();
          });
        }
      }


    ]
  });

  return suites;
  
});
