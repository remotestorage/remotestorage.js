
define([
  'requirejs', 'http', 'url'
], function(requirejs, http, url) {

  var port = 10999;
  var token = 'test-token';
  var user = 'me';
  var httpServer;

  function extend() {
    var result = arguments[0];
    var objs = Array.prototype.slice.call(arguments, 1);
    objs.forEach(function(obj) {
        if(obj) {
          for(var key in obj) {
            result[key] = obj[key];
          }
        }
      });
    return result;
  }

  var tokenStore = { 
    _data: {}, 
    get: function(user, key, cb) { cb(undefined, this._data[user +':'+ key]); }, 
    set: function(user, key, value, cb) { this._data[user+ ':'+ key] = value; cb(); },
    clear: function() { this._data = {}; }
  };

  var dataStore = { 
    _data: {}, 
    get: function(user, key, cb) { cb(undefined, this._data[key]); }, 
    set: function(user, key, value, cb) { this._data[key] = value; cb(); },
    clear: function() { this._data = {}; }
  }


  var serverHelper = {

    captured: [],

    init: function(rsServer) {
      var server = new rsServer(this.getStorageInfo().type, tokenStore, dataStore);
      extend(this, server);
    },

    serve: function(req, resp) {
      console.log("SERVE")
      var body = "";
      // FIXME this part causes problems
      req.on('data', function(t) {
        body+=t;
      });
      req.on('end', function() {
        console.log('Server: ', req.method, ' : ', req.url)
        serverHelper.captured.push({
          method: req.method,
          path: url.parse(req.url, true).pathname.substring('/storage/'.length),
          body: body
        });
        console.log("SERVE : req.on('end') : ", serverHelper.captured)
      });
      serverHelper.storage(req, resp);
    },

    start: function(callback) {
      if(! this.storage ) {
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
      delete this.storage;
      httpServer.close(function() {
        httpServer = undefined;
        console.log("Test server stopped");
        callback();
      });
    },

    setScope: function(scope) {
      tokenStore._data[user +':'+ token] = this.makeScopePaths( scope, '*');
    },

    getBearerToken: function() {
      return token;
    },

    getStorageInfo: function() {
      return {
        type: 'draft-dejong-remotestorage-02',
        href: 'http://localhost:' + port + '/storage/me',
        token: token
      };
    },

    resetState: function() {
      tokenStore.clear();
      dataStore.clear();
      console.log("STATE CLEARED")
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
      var r = serverHelper.captured.shift();
      if( !this.matchRequest(r, method, path, body)) {
        console.log('(found request: ', r, ')');
        test.result(false, "expected Result "+method+"  "+path+" but found "+ (r ? r.method+"  "+r.path : 'nothing') );
      }
    },
    
    assertListing: function(test, ls, ls2) { // called with ls array and can handle old rs listings with arrays and new ones with objects
      if(!(ls instanceof Array)) {
        ls1 = Object.keys(ls);
      } else {
        ls1 = ls;
      }
      test.assertAnd(ls1.sort(), ls2.sort(), "\nexpected LISTING : "+JSON.stringify(ls2, null, 2)+"\nbut found : "+JSON.stringify(ls, null, 2));
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
      while(serverHelper.captured.length > 0) {
        serverHelper.captured.shift();
      }
    },

  };

  return serverHelper;
});
