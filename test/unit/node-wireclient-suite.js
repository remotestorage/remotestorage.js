if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {
  var suites = [];
	var oldReadBinaryData;

  suites.push({
    name: "WireClient NodeJS",
    desc: "Low-level remotestorage client used in NodeJS",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      RemoteStorage.log = function() {};
      global.RemoteStorage.Unauthorized = function() {};
      require('./lib/promising');
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
      oldReadBinaryData = RemoteStorage.WireClient.readBinaryData;
      require('./src/nodejs_ext');

      RemoteStorage.Authorize = {
        IMPLIED_FAKE_TOKEN: false
      };

      test.done();
    },

    takedown: function(env, test) {
      RemoteStorage.WireClient.readBinaryData = oldReadBinaryData;
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
      env.client = new RemoteStorage.WireClient(env.rs);
      env.connectedClient = new RemoteStorage.WireClient(env.rs);
      env.baseURI = 'https://example.com/storage/test';
      env.token = 'foobarbaz';
      env.connectedClient.configure(
        undefined, env.baseURI, undefined, env.token
      );
      test.done();
    },

    afterEach: function(env, test) {
      delete global.XMLHttpRequest;
      delete env.client;
      test.done();
    },

    tests: [
      {
        desc: "GET requests for binary data respond with the proper content",
        run: function(env, test) {
          env.connectedClient.get('/foo/bar').
            then(function(status, content, contentType) {
              test.assertAnd(status, 200);
              test.assertAnd(content, 'response content');
              test.assert(contentType, 'image/png; charset=binary');
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
            then(function(status, content, contentType) {
              test.assertAnd(status, 200);
              test.assertAnd(content, 'response content');
              test.assert(contentType, 'text/plain');
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
