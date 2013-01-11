
define([
  'requirejs', 'http'
], function(requirejs, http) {

  var port = 10999;
  var token = 'test-token';
  var httpServer;

  var serverHelper = {
    
    start: function(callback) {
      // timeout (and the 'requirejs' line below) is here to work around weird
      // AMD vs commonjs-module problems with requireJS...
      // (better don't ask)
      setTimeout(function() {
        if(typeof(httpServer) !== 'undefined') {
          throw "Server already started. Stop it first.";
        }
        this.resetState();
        this.addToken(token, [':rw']);
        httpServer = http.createServer(this.serve);
        httpServer.listen(port, function() {
          console.log("Test server started");
          callback();
        });
      }.bind(this), 100);
    },

    stop: function(callback) {
      httpServer.close(function() {
        httpServer = undefined;
        console.log("Test server stopped");
        callback();
      });
    },

    getBearerToken: function() {
      return token;
    },

    getStorageInfo: function() {
      return {
        type: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple',
        href: 'http://localhost:' + port + '/storage/me'
      };
    }

  };

  requirejs([
    './src/lib/util', './server/nodejs-example'
  ], function(util, nodejsServer) {
    util.extend(serverHelper, nodejsServer.server);
  });

  return serverHelper;
});
