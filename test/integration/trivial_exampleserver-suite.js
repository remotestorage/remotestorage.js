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

        // env.remoteStorage.util.setLogLevel('debug');

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

      env.rsConnect = function() {
          env.remoteStorage.nodeConnect.setStorageInfo({
          type: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple',
          href: env.url
        });
        env.remoteStorage.nodeConnect.setBearerToken(env.token);
        return env.remoteStorage.claimAccess('root', 'rw');
      };
      env.rsConnect().then(function() {
        _this.result(true);
      });
    },
    afterEach: function (env) {
      env.remoteStorage.flushLocal().then(curry(this.result.bind(this), true));
    },
    tests: [
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
        desc: "write an object and check it's there",
        run: function(env) {
          var _this = this;
          var obj = {
            hello: "world"
          };
          try {
            env.client.storeObject('test', 'testobject', obj).
            then(env.remoteStorage.fullSync).
            then(function() {
              var state = env.server.getState();
              _this.assertTypeAnd(state.content['me/testobject'], 'string');
              var robj = JSON.parse(state.content['me/testobject']);
              _this.assertAnd(obj, robj);

              _this.assertTypeAnd(state.contentType['me/testobject'], 'string');
              _this.assert(state.contentType['me/testobject'], 'application/json');

            }, curry(_this.result.bind(_this), false));
          } catch(e) {
            _this.result(false, e);
          }
        }
      },
      {
        desc: "write an object, reconnect, sync, verify",
        run: function(env) {
          var _this = this;
          var obj = {
            hello: "world"
          };
          try {
            env.client.storeObject('test', 'testobject', obj).
            then(env.remoteStorage.fullSync).
            then(env.remoteStorage.flushLocal).
            then(env.rsConnect).
            then(env.remoteStorage.fullSync).
            then(curry(env.remoteStorage.root.getObject, 'testobject')).
            then(function(robj) {
              _this.assert(obj, robj);
            }, curry(_this.result.bind(_this), false));
          } catch(e) {
            _this.result(false, e);
          }
        }
      },
      {
        desc: "writing some objects, then syncing just the tree",
        run: function(env) {
          var _this = this;
          util.asyncGroup(
            curry(env.client.storeObject, 'test', 'test-dir/a', { n: 'a' }),
            curry(env.client.storeObject, 'test', 'test-dir/b', { n: 'b' }),
            curry(env.client.storeObject, 'test', 'test-dir/c', { n: 'c' })
          ).
          then(env.remoteStorage.fullSync).
          then(env.rsConnect).
          then(curry(env.remoteStorage.root.use, '', true)).
          then(env.remoteStorage.fullSync).
          then(curry(env.remoteStorage.root.getListing, 'test-dir/')).
          then(function(listing) {
            _this.assertAnd(listing, ['a', 'b', 'c']);
          }).
          then(curry(env.client.getObject, 'test-dir/a')).
          then(function(obj) {
            _this.assertType(obj, 'undefined');
          });
        }
      }
    ]
  });
  return suites;
});
