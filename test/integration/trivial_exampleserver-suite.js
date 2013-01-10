if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(['requirejs', 'localStorage'], function(requirejs, localStorage, undefined) {
  var suites = [];
  global.localStorage = localStorage;
  var curry, util;

  function catchError(test) {
    return function(error) {
      console.error("Caught error: ", error, error && error.stack);
      test.result(false);
    };
  }

  var http = require('http');
  var nodejsServer = require('./server/nodejs-example');

  suites.push({
    name: "trivial exampleserver",
    desc: "trivial tests using example server",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/remoteStorage',
        './src/modules/root'
      ], function(_util, remoteStorage, root) {
        util = _util;
        curry = util.curry;
        env.port = '10999';
        env.url = 'http://localhost:'+env.port+'/storage/me';
        env.token = 'testing123';
        env.remoteStorage = remoteStorage;
        env.client = root;

        env.remoteStorage.util.setLogLevel('debug');

        http.createServer(nodejsServer.server.serve).listen(env.port, function() {
          env.server = nodejsServer.server;
          _this.result(true);
        });
      });
    },
    takedown: function(env) {
      env = '';
      this.result(true);
    },
    beforeEach: function (env) {
      // BEFORE EACH TEST
      var _this = this;

      env.server.resetState();
      env.server.addToken(env.token, [':rw']); // gives read-write access on the root path

      env.remoteStorage.nodeConnect.setStorageInfo({
        type: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple',
        href: env.url
      });
      env.remoteStorage.nodeConnect.setBearerToken(env.token);
      env.remoteStorage.claimAccess('root', 'rw').then(function() {
        _this.result(true);
      });
    },
    afterEach: function (env) {
      env.remoteStorage.flushLocal().then(curry(this.result.bind(this), true));
    },
    tests: [
      {
        desc: "write a file",
        run: function(env) {
          var _this = this;
          var file = {
            hello: "world"
          };
          try {
            env.client.storeObject('test', 'testobject', file).then(function() {
              _this.result(true);
            });
          } catch(e) {
            _this.result(false);
          }
        }
      },
      {
        desc: "claiming access",
        run: function(env) {
          var _this = this;
          env.remoteStorage.store.getNode('/').
          then(function(rootNode) {
            _this.assert(rootNode.startAccess, 'rw');
          });
        }
      },
      {
        desc: "write a file and check it's there",
        run: function(env) {
          var _this = this;
          var file = {
            hello: "world"
          };
          try {
            env.client.storeObject('test', 'testobject', file).
            then(function() {
              env.remoteStorage.store.getNode('/');
            }).
            then(curry(console.log, 'ROOT NODE')).
            then(env.remoteStorage.fullSync).
            then(function() {
              var state = env.server.getState();
              console.log("**************** STATE:",state);
              _this.assertTypeAnd(state.content['me/testobject'], 'string');
              var rfile = JSON.parse(state.content['me/testobject']);
              _this.assertAnd(file, rfile);

              _this.assertTypeAnd(state.contentType['me/testobject'], 'string');
              _this.assert(state.contentType['me/testobject'], 'application/json');

            }, curry(_this.result.bind(_this), false));
          } catch(e) {
            _this.result(false, e);
          }
        }
      }
    ]
  });
  return suites;
});
