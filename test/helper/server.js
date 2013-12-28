
define([
  'requirejs', 'http', 'url'
], function(requirejs, http, url) {

  var port = 10999;
  var token = 'test-token';
  var httpServer;

  var serverHelper = {
    captured: [],

    serve: function(req, resp) {
      var body = "";
      req.on('data', function(t) {
        body+=t;
      });
      req.on('end', function() {
        serverHelper.captured.push({
          method: req.method,
          path: url.parse(req.url, true).pathname.substring('/storage/'.length),
          body: body
        });
        
      });
      serverHelper.storage(req, resp);
    },

    start: function(callback) {
      if(! this.createHandler ) {
        throw "You need to extend the serverHelper with the nodejs example server!";
      }
      this.storage = this.createHandler(this.tokenStore, this.dataStore);

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
      delete this.storage;
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
        type: 'draft-dejong-remotestorage-01',
        href: 'http://localhost:' + port + '/storage/me',
        token: token
      };
    },

    resetState: function() {
      this.captured = [];
      this.tokenStore.clear();
      this.dataStore.clear();
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
      if(typeof req !== 'object') {
        console.log("Expected request "+ method +" "+ path +", but no such request was received ("+ this.captured.map(function(r) {
          return r.method +' '+ r.path;
        }).join(', ') +')');
      }
      test.assertTypeAnd(req, 'object', "Expected request " + method + " " + path + ", but no such request was received (" + this.captured.map(function(r) { return r.method + ' ' + r.path; }).join(', ') + ')');
      
      if(body && req) {
        test.assertAnd(body, req.body);
      }
    },

    matchRequest: function(request, method, path, body) {
      return (
        typeof(request) !== 'undefined'
          && request.method === method && request.path === path
          && ( typeof(body) === 'undefined' || request.body === body )
      );
    },

    expectThisRequest: function(test, method, path, body) {
      var r = this.captured.shift();
      if( !this.matchRequest(r, method, path, body)) {
        console.log('(found request: ', r, ')');
        test.result(false, "expected Result "+method+"  "+path+" but found "+ (r ? r.method+"  "+r.path : 'nothing') );
      }
    },
    
    assertListing: function(test, ls, ls2) {
      if(!ls instanceof Array) {
        ls1 = Object.keys(ls2);
      } else {
        ls1 = ls;
      }
      test.assertAnd(ls1, ls2, "expected "+JSON.stringify(ls2, null, 2)+"but found "+JSON.stringify(ls1, null, 2));
    },

    expectTheseRequests: function(test, expectations) {
      var requests = this.captured.splice(0, expectations.length);
      for(var e=0;e<expectations.length;e++) {
        var expectation = expectations[e];
        if(! expectation) continue;
        var method = expectation[0], path = expectation[1], body = expectation[2];
        for(var r=0;r<requests.length;r++) {
          if(requests[r] && this.matchRequest(requests[r], method, path, body)) {
            expectations[e] = undefined;
            requests[r] = undefined;
          }
        }
      }
      if(expectations.filter(function(expectation) { return !! expectation; }).length !== 0) {
        test.result(false, "Expected " + expectations.length + " requests, got" + requests.length + " requests" + ", not all of them matched. \n\nHave left expectations: " + JSON.stringify(expectations, null, 2) + "\nHave left requests: " + JSON.stringify(requests, null, 2));
      }
    },

    expectNoMoreRequest: function(test) {
      test.assertAnd(this.captured.length, 0, "Expected captured request list to be empty, but still has " + this.captured.length + " elements (" + this.captured.map(function(r) { return r.method + ' ' + r.path; }).join(', ') + ")!");
    },

    clearCaptured: function() {
      while(this.captured.length > 0) {
        this.captured.shift();
      }
    },

  };

  // requirejs([
  //   './src/lib/util', './server/nodejs-example'
  // ], function(util, nodejsServer) {
  //   util.extend(serverHelper, nodejsServer.server);
  // });

  return serverHelper;
});
