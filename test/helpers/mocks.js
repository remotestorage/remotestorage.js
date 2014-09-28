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

    }
  };
});
