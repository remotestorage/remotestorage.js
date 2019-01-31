if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['./src/wireclient', './src/remotestorage'], function (WireClient, RemoteStorage) {
  var suites = [];

  function setup(env, test) {
    test.assertType(RemoteStorage, 'function');
  }

  function takedown(env, test) {
    test.done();
  }

  function beforeEach(env, test) {
    env.rs = new RemoteStorage();
    env.connectedClient = new WireClient(env.rs);
    env.baseURI = 'https://example.com/storage/test';
    env.token = 'foobarbaz';
    env.connectedClient.configure({
      href: env.baseURI,
      token: env.token
    });
    test.done();
  }

  function beforeEachXHR(env, test) {
    beforeEach(env, test);

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
        return this._responseHeaders[key] || null;
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

    global.mockRequestSuccess = function (param) {
      var req = XMLHttpRequest.instances.shift();
      req._responseHeaders = param.responseHeaders || {};
      req.status = param.status;
      req.response = param.arrayBuffer;
      req._onload();
    };

    global.mockRequestFail = function (errMsg) {
      var req = XMLHttpRequest.instances.shift();
      req._onerror(errMsg);
    };
  }

  function beforeEachFetch(env, test) {
    beforeEach(env, test);

    var fetchesData = [];

    global.fetch = function (url, init) {
      init = init || {};
      return new Promise(function (resolve, reject) {
        fetchesData.push({
          url: url,
          method: init.method || 'GET',
          requestHeaders: init.headers || {},
          resolve: resolve,
          reject: reject});
      });
    };

    global.mockRequestSuccess = function (param) {
      var fetchData = fetchesData.shift();

      var responseHeaders = {   // mock Headers obj
        _headers: param.responseHeaders || {},   // POJSO
        forEach: function (callback, thisArg) {
          var thisObj = thisArg || responseHeaders;
          for (headerName in responseHeaders._headers) {
            callback.call(thisObj, responseHeaders._headers[headerName], headerName, responseHeaders);
          }
        }
      };
      var response = {   // mock Response obj
        headers: responseHeaders,
        ok: param.status >= 200 && param.status < 300,
        redirected: false,
        status: param.status,
        statusText: param.statusText || '',
        type: param.corsResponseType || 'basic',
        url: fetchData.url,
        useFinalURL: true,
        body: function () {   // getter for ReadableStream
          throw new Error("not implemented in mock");
        },
        bodyUsed: false,
        arrayBuffer: function () {
          return Promise.resolve(param.arrayBuffer);
        },
        blob: function () {
          throw new Error("not implemented in mock");
        },
        text: function () {
          throw new Error("not implemented in mock");
        },
        json: function () {
          throw new Error("not implemented in mock");
        }
      };

      fetchData.resolve(response);
    };

    global.mockRequestFail = function (errMsg) {
      var fetchData = fetchesData.shift();
      fetchData.reject(errMsg);
    };
  }

  function afterEach(env, test) {
    delete global.XMLHttpRequest;
    delete global.fetch;
    delete global.getMockRequestMethod;
    delete global.getMockRequestUrl;
    delete global.getMockRequestHeader;
    delete global.mockRequestSuccess;
    delete global.mockRequestFail;
    delete env.connectedClient;
    test.done();
  }

  var tests = [
    {
      desc: "GET requests for binary data respond with the proper content",
      run: function(env, test) {
        function ArrayBufferMock(str) {
          return {
            iAmA: 'ArrayBufferMock',
            content: str
          };
        }

        env.connectedClient.get('/foo/bar').
        then(function (r) {
          test.assertAnd(r.statusCode, 200);
          test.assertAnd(r.body, {
            iAmA: 'ArrayBufferMock',
            content: 'response content'
          });
          test.assert(r.contentType, 'image/png; charset=binary');
        }, function (err) {
          test.result(false, err);
        });
        mockRequestSuccess({
          responseHeaders: {'Content-Type': 'image/png; charset=binary'},
          status: 200,
          arrayBuffer: new ArrayBufferMock('response content')
        });
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

        mockRequestSuccess({
          responseHeaders: {'Content-Type': 'text/plain'},
          status: 200,
          arrayBuffer: string2ArrayBuffer('response content')
        });
      }
    },

    {
      desc: "GET requests for HTML data respond with the proper content (and don't throw an error)",
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
          test.assertAnd(r.body, '<html><head></head><body><h1>Hello, World!</h1></body></html>');
          test.assert(r.contentType, 'text/html');
        }, function (err) {
          test.result(false, err);
        });

        mockRequestSuccess({
          responseHeaders: {'Content-Type': 'text/html'},
          status: 200,
          arrayBuffer: string2ArrayBuffer('<html><head></head><body><h1>Hello, World!</h1></body></html>')
        });
      }
    },
  ];

  suites.push({
    name: "WireClient NodeJS (using fetch())",
    desc: "Low-level remotestorage client used in NodeJS",
    setup: setup,
    beforeEach: beforeEachFetch,
    takedown: takedown,

    afterEach: afterEach,

    tests: tests
  });

  suites.push({
    name: "WireClient NodeJS (using XHR)",
    desc: "Low-level remotestorage client used in NodeJS",
    setup: setup,
    beforeEach: beforeEachXHR,
    takedown: takedown,

    afterEach: afterEach,

    tests: tests
  });

  return suites;
});
