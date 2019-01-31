define([], function() {
  return {
    defineMocks: function(env) {
      global.Blob = function(input, options) {
        this.input = input;
        this.options = options;
        env.blob = this;
      };

      global.FileReader = function() {};
      global.FileReader.prototype = {
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
        },
        readAsText: function(buffer, encoding) {
          setTimeout(function() {
            this.result = env.fileReaderResult = buffer.input[0].content;
            this._events.loadend[0]({target: {result: this.result}});
          }.bind(this), 0);
        }
      };
      global.FakeCaching = function(){
        this._responses = {};
        this.checkPath = function(path) {
          if (typeof(this._responses[path]) === 'undefined') {
            throw new Error('no FakeCaching response for path ' + path + ' have: ' + JSON.stringify(this._responses));
          }
          return this._responses[path];
        };
        this.onActivate = function() {};
      };

      global.FakeAccess = function(){
        this._data = {};
        this.set = function(moduleName, value) {
          this._data[moduleName] = value;
        };
        this.get = function(moduleName) {
          return this._data[moduleName];
        };
        this.checkPathPermission = function(path, mode) {
          if (path.substring(0, '/foo/'.length) === '/foo/') {
            return true;
          }
          if (path.substring(0, '/read/access/'.length) === '/read/access/' && mode === 'r') {
            return true;
          }
          if (path.substring(0, '/write/access/'.length) === '/write/access/') {
            return true;
          }
          if (path.substring(0, '/readings/'.length) === '/readings/' && mode === 'r') {
            return true;
          }
          if (path.substring(0, '/public/readings/'.length) === '/public/readings/' && mode === 'r') {
            return true;
          }
          if (path.substring(0, '/writings/'.length) === '/writings/') {
            return true;
          }
          if (path.substring(0, '/public/writings/'.length) === '/public/writings/') {
            return true;
          }
          return false;
        };
      };

      global.FakeRemote = function(){
        function GPD(target, path, body, contentType, options) {
          var args = Array.prototype.slice.call(arguments);
          this['_'+target+'s'].push([path, body, contentType, options]);
          if (typeof(this._responses[args]) === 'undefined') {
            throw new Error('no FakeRemote response for args ' + JSON.stringify(args));
          }
          var resp = this._responses[args] || [200];
          if(resp === 'timeout') {
            return Promise.reject(resp);
          } else {
            return Promise.resolve(resp);
          }
        }
        this.connected = true;
        this._puts = [];
        this.put = GPD.bind(this, 'put');
        this._deletes = [];
        this.delete = GPD.bind(this, 'delete');
        this._gets = [];
        this.get = GPD.bind(this, 'get');
        this._responses = {};
      };

      global.ArrayBufferMock = function(str) {
        return {
          iAmA: 'ArrayBufferMock',
          content: str
        };
      };  

    },

    undefineMocks(env) {
      delete global.Blob;
      delete global.FileReader;
      delete global.XMLHttpRequest;
      delete global.fetch;
      delete global.getMockRequestMethod;
      delete global.getMockRequestUrl;
      delete global.getMockRequestHeader;
      delete global.getMockRequestBody;
      delete global.mockRequestSuccess;
      delete global.mockRequestFail;
      delete global.addMockRequestCallback;
      delete env.blob;
      delete env.fileReaderResult;
    },

    defineXMLHttpRequestMock(env) {

      var requestCallbacks = [];
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

          if (requestCallbacks.length)
            requestCallbacks.shift()(this);
        },
        setRequestHeader: function (key, value) {
         this._headers[key] = value;
        },
        getResponseHeader: function (key) {
         return this._responseHeaders[key] || null;
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

      global.addMockRequestCallback = function(callback) {
        requestCallbacks.push(callback);
      };

  
      global.getMockRequestMethod = function() {
        var request = XMLHttpRequest.instances[0];
        return request._open[0];
      };
  
      global.getMockRequestUrl = function() {
        var request = XMLHttpRequest.instances[0];
        return request._open[1];
      };
  
      global.getMockRequestHeader = function (headerName) {
        var req = XMLHttpRequest.instances[0];
        return req._headers[headerName];
      };
  
      global.getMockRequestBody = function () {
        var request = XMLHttpRequest.instances[0];
        return request._send[0];
      };
  
      global.mockRequestSuccess = function (param) {
        var req = XMLHttpRequest.instances.shift();
        req._responseHeaders = param.responseHeaders || {};
        req.status = param.status;
        req.response = param.arrayBuffer || param.responseText;
        req.responseText = param.responseText;
        req._onload();
      };
  
      global.mockRequestFail = function (errMsg) {
        var req = XMLHttpRequest.instances.shift();
        req._onerror(errMsg);
      };      
    },

    defineFetchMock(env) {

      var fetchesData = [];
      var requestCallbacks = [];

      global.fetch = function (url, init) {
        init = init || {};
        promise = new Promise(function (resolve, reject) {
          fetchesData.push({
            url: url,
            method: init.method || 'GET',
            requestHeaders: init.headers || {},
            requestBody: init.body,
            resolve: resolve,
            reject: reject});
        });

        if (requestCallbacks.length)
          requestCallbacks.shift()(this);
        return promise;

      };

      global.addMockRequestCallback = function(callback) {
        requestCallbacks.push(callback);
      };
  
      global.getMockRequestMethod = function() {
        var fetchData = fetchesData[0];
        return fetchData.method;
      };
  
      global.getMockRequestUrl = function() {
        var fetchData = fetchesData[0];
        return fetchData.url;
      };
  
      global.getMockRequestHeader = function (headerName) {
        var fetchData = fetchesData[0];
        return fetchData.requestHeaders[headerName];
      };
  
      global.getMockRequestBody = function () {
        var fetchData = fetchesData[0];
        return fetchData.requestBody;
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
            return Promise.resolve(param.responseText);
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
  };
});
