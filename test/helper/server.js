
define([
  'requirejs', 'http'
], function(requirejs, http) {

  var port = 10999;
  var token = 'test-token';
  var httpServer;

  var serverHelper = {
    
    start: function(callback) {

      if(! this.serve) {
        throw "You need to extend the serverHelper with the nodejs example server!";
      }

      if(typeof(httpServer) !== 'undefined') {
        throw "Server already started. Stop it first.";
      }
      httpServer = http.createServer(this.serve);
      httpServer.listen(port, function() {
        console.log("Test server started");
        callback();
      });
    },

    stop: function(callback) {
      httpServer.close(function() {
        httpServer = undefined;
        console.log("Test server stopped");
        callback();
      });
    },

    setScope: function(scope) {
      this.addToken(token, scope);
    },

    getBearerToken: function() {
      return token;
    },

    getStorageInfo: function() {
      return {
        type: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple',
        href: 'http://localhost:' + port + '/storage/me'
      };
    },

    expectRequest: function(test, method, path, body) {
      var req, r;
      var cl = this.captured.length;
      for(var i=0;i<cl;i++) {
        r = this.captured[i];
        if(r.method === method && r.path === path) {
          // remove, in case we expect a request twice.
          this.captured.splice(i, 1);
          req = r;
          break;
        }
      }
      test.assertTypeAnd(req, 'object', "Expected request " + method + " " + path + ", but no such request was received (" + this.captured.map(function(r) { return r.method + ' ' + r.path; }).join(', ') + ')');
      
      if(body && req) {
        test.assertAnd(body, req.body);
      }
    },

    expectNoMoreRequest: function(test) {
      test.assertAnd(this.captured.length, 0, "Expected captured request list to be empty, but still has " + this.captured.length + " elements (" + this.captured.map(function(r) { return r.method + ' ' + r.path; }).join(', ') + ")!");
    },

    clearCaptured: function() {
      while(this.captured.length > 0) {
        this.captured.shift();
      }
    }

  };

  // requirejs([
  //   './src/lib/util', './server/nodejs-example'
  // ], function(util, nodejsServer) {
  //   util.extend(serverHelper, nodejsServer.server);
  // });

  return serverHelper;
});
