if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];
	var oldReadBinaryData;

  suites.push({
    name: "WireClient NodeJS",
    desc: "Low-level remotestorage client used in NodeJS",
    setup: function(env, test) {
      env.RemoteStorage = require('./../../node-main');

      RemoteStorage.Authorize = {
        IMPLIED_FAKE_TOKEN: false
      };

      test.assertType(global.RemoteStorage, 'function');
    },

    takedown: function(env, test) {
      if (typeof RemoteStorage.WireClient !== 'undefined') {
         RemoteStorage.WireClient.readBinaryData = oldReadBinaryData;
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
      env.connectedClient = new RemoteStorage.WireClient(env.rs);
      env.baseURI = 'https://example.com/storage/test';
      env.token = 'foobarbaz';
      env.connectedClient.configure({
        href: env.baseURI,
        token: env.token
      });
      test.done();
    },

    afterEach: function(env, test) {
      delete global.XMLHttpRequest;
      delete env.connectedClient;
      test.done();
    },

    tests: [
      {
        desc: "GET requests for binary data respond with the proper content",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, 'response content');
              test.assert(r.contentType, 'image/png; charset=binary');
            }, function (err) {
              test.result(false, err);
            });
          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'image/png; charset=binary';
          req.status = 200;
          req.response = 'response content';
          req._onload();
        }
      },

      {
        desc: "GET requests for text data respond with the proper content",
        run: function(env, test) {
          function string2ArrayBuffer(str) {
            var buf = new ArrayBuffer(str.length); // assuming str only contains 1-byte UTF characters
            var bufView = new Uint8Array(buf);
            for (var i=0, strLen=str.length; i<strLen; i++) {
              bufView[i] = str.charCodeAt(i);
            }
            return buf;
          }

          env.connectedClient.get('/foo/bar').
            then(function (r) {
              test.assertAnd(r.statusCode, 200);
              test.assertAnd(r.body, 'response content');
              test.assert(r.contentType, 'text/plain');
            }, function (err) {
              test.result(false, err);
            });

          var req = XMLHttpRequest.instances.shift();
          req._responseHeaders['Content-Type'] = 'text/plain';
          req.status = 200;
          req.response = string2ArrayBuffer('response content');
          req._onload();
        }
      }
    ]
  });

  return suites;
});
