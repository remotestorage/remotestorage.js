if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs, undefined) {
  var suites = [];

  suites.push({
    name: "WireClient",
    desc: "Low-level remotestorage client based on XMLHttpRequest",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      require('./lib/promising');
      require('./src/eventhandling');
      if(global.rs_eventhandling) {
        RemoteStorage.eventHandling = global.rs_eventhandling;
      } else {
        global.rs_eventhandling = RemoteStorage.eventHandling;
      }
      require('./src/wireclient');

      test.done();
    },

    beforeEach: function(env, test) {
      global.XMLHttpRequest = function() {
        XMLHttpRequest.instances.push(this);
        this._headers = {};
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

      env.client = new RemoteStorage.WireClient();
      env.connectedClient = new RemoteStorage.WireClient();
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
        desc: "#configure sets the given parameters",
        run: function(env, test) {
          env.client.configure('test@example.com', undefined, 'draft-dejong-remotestorage-00');
          test.assertAnd(env.client.userAddress, 'test@example.com');
          test.assertAnd(env.client.storageApi, 'draft-dejong-remotestorage-00');
          test.done();
        }
      },

      {
        desc: "#configure doesn't overwrite parameters if they are given as 'undefined'",
        run: function(env, test) {
          env.client.configure('test@example.com');
          test.assertAnd(env.client.userAddress, 'test@example.com');
          env.client.configure(undefined, 'http://foo/bar');
          test.assertAnd(env.client.userAddress, 'test@example.com');
          test.assertAnd(env.client.href, 'http://foo/bar');
          test.done();
        }
      },

      {
        desc: "#configure determines if revisions are supported, based on the storageApi",
        run: function(env, test) {
          env.client.configure(undefined, undefined, 'draft-dejong-remotestorage-00');
          test.assertAnd(env.client.supportsRevs, true);
          env.client.configure(undefined, undefined, 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple');
          test.assertAnd(env.client.supportsRevs, false);
          env.client.configure(undefined, undefined, 'draft-dejong-remotestorage-01');
          test.assertAnd(env.client.supportsRevs, true);
          test.done();
        }
      },

      {
        desc: "#configure sets 'connected' to true, once href and token are given",
        run: function(env, test) {
          env.client.configure(undefined, 'https://example.com/storage/test', undefined, 'foobarbaz');
          test.assert(env.client.connected, true);
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
        desc: "#get strips duplicate slashes from the path",
        run: function(env, test) {
          env.connectedClient.get('/foo//baz');
          var request = XMLHttpRequest.instances.shift();
          test.assert(request._open[1], 'https://example.com/storage/test/foo/baz');
        }
      }

    ]
  });

  return suites;
});

