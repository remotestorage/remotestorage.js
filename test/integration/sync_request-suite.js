if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs', 'localStorage'], function(requirejs, localStorage) {

  var suites = [];

  global.localStorage = localStorage;

  var util, curry;

  suites.push({
    name: "sync requests",
    desc: "verify requests that sync performs in various situations",

    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/remoteStorage',
        './test/helper/server',
        './src/modules/root'
      ], function(_util, remoteStorage, serverHelper, root) {
        util = _util;
        curry = util.curry;
        env.remoteStorage = remoteStorage;
        env.serverHelper = serverHelper;

        env.client = root;

        env.serverHelper.start(function() {
          _this.result(true);
        });
      });
    },

    takedown: function(env) {
      var _this = this;
      env.serverHelper.stop(function() {
        _this.result(true);
      });
    },

    beforeEach: function(env) {
      var _this = this;

      env.serverHelper.resetState();
      env.serverHelper.setScope([':rw']);
      env.serverHelper.captureRequests();

      env.rsConnect = function() {
        env.remoteStorage.nodeConnect.setStorageInfo(
          env.serverHelper.getStorageInfo()
        );
        env.remoteStorage.nodeConnect.setBearerToken(
          env.serverHelper.getBearerToken()
        );

        return env.remoteStorage.claimAccess('root', 'rw');
      };

      env.rsConnect().
        then(function() {
          _this.result(true);
        });
    },
    
    afterEach: function(env) {
      env.remoteStorage.flushLocal().then(curry(this.result.bind(this), true));
    },
    
    tests: [

      {
        desc: "Simple outgoing requests",
        run: function(env) {
          var _this = this;
          env.client.storeObject('test', 'testobj', { hello: 'world' }).
            then(function() {
              // check current version (we haven't done initial sync)
              env.serverHelper.expectRequest(
                _this, 'GET', 'me/'
              );
              env.serverHelper.expectRequest(
                _this, 'GET', 'me/testobj'
              );
              // update remote data
              env.serverHelper.expectRequest(
                _this, 'PUT', 'me/testobj',
                JSON.stringify({ 
                  'hello': 'world',
                  '@type': 'https://remotestoragejs.com/spec/modules/root/test'
                })
              );
              // fetch timestamp from parent
              env.serverHelper.expectRequest(
                _this, 'GET', 'me/'
              );

              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            });
        }
      },

      {
        desc: "Incoming data",
        run: function(env) {
          var _this = this;
          // push initial data to the server:
          util.asyncEach([1,2,3,4,5], function(i) {
            return env.client.storeObject('test', 'obj-' + i, { i: i })
          }).
            then(env.remoteStorage.flushLocal).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            then(env.remoteStorage.fullSync).
            then(function() {
              // initial root request
              env.serverHelper.expectRequest(_this, 'GET', 'me/');
              // requests for each object
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-1');
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-2');
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-3');
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-4');
              env.serverHelper.expectRequest(_this, 'GET', 'me/obj-5');

              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            });
        }
      },

      {
        desc: "Syncing trees w/ data",
        run: function(env) {
          util.silenceAllLoggers();
          util.unsilenceLogger('sync');
          var _this = this;
          // push initial tree ( a/{1,2,3} and b/{1,2,3} ):
          util.asyncEach(['a', 'b'], function(d) {
            return util.asyncEach([1,2,3], function(i) {
              return env.client.storeObject('test', d + '/obj-' + i, { d: d, i: i });
            })
          }).
            then(env.remoteStorage.fullSync).
            // dis- and reconnect
            then(env.remoteStorage.flushLocal).
            then(env.serverHelper.clearCaptured.bind(env.serverHelper)).
            then(env.rsConnect).
            // release root (which was set up by claimAccess):
            then(curry(env.client.release, '')).
            // use /a/, but not /b/
            then(curry(env.client.use, 'a/')).
            // do a full sync
            then(curry(env.remoteStorage.fullSync)).
            then(function() {
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-1');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-2');
              env.serverHelper.expectRequest(_this, 'GET', 'me/a/obj-3');
              env.serverHelper.expectNoMoreRequest(_this);

              _this.assert(true, true);
            });
        }
      },

      {
        desc: "store file, then store it again, then retrieve it",
        run: function(env) {
          var _this = this;
          env.client.storeFile('text/plain', 'note.txt', 'foo').
            then(curry(env.client.storeFile, 'text/plain', 'note.txt', 'bar')).
            then(curry(env.client.getFile, 'note.txt')).
            then(function(file) {
              _this.assertAnd(file.mimeType, 'text/plain');
              _this.assert(file.data, 'bar');
            });
        }
      },

      {
        desc: "store object, then check requests",
        run: function(env) {
          var _this = this;
          env.client.storeObject('test', 'test-dir/obj', { phu: 'quoc' }).
            then(function() {
              env.serverHelper.expectRequest(_this, 'GET', 'me/test-dir/');
              env.serverHelper.expectRequest(_this, 'GET', 'me/test-dir/obj');
              env.serverHelper.expectRequest(_this, 'PUT', 'me/test-dir/obj', '{"phu":"quoc","@type":"https://remotestoragejs.com/spec/modules/root/test"}');
              env.serverHelper.expectRequest(_this, 'GET', 'me/test-dir/');
              env.serverHelper.expectNoMoreRequest(_this);
              _this.assert(true, true);
            });
        }
      },

      {
        desc: "store file with plain text",
        run: function(env, test) {
          env.client.storeFile('text/plain', 'text-file', 'some text').
            then(function() {
              env.serverHelper.expectRequest(test, 'GET', 'me/');
              env.serverHelper.expectRequest(test, 'GET', 'me/text-file');
              env.serverHelper.expectRequest(test, 'PUT', 'me/text-file', 'some text');
              env.serverHelper.expectRequest(test, 'GET', 'me/');
              env.serverHelper.expectNoMoreRequest(test);
              test.assert(true, true);
            });
        }
      },

      {
        desc: "store empty file",
        run: function(env) {
          var _this = this;
          env.client.storeFile('text/plain', 'empty-file', '').
            then(function() {
              env.serverHelper.expectRequest(_this, 'GET', 'me/');
              env.serverHelper.expectRequest(_this, 'GET', 'me/empty-file');
              env.serverHelper.expectRequest(_this, 'PUT', 'me/empty-file', '');
              env.serverHelper.expectRequest(_this, 'GET', 'me/');
              env.serverHelper.expectNoMoreRequest(_this);
              _this.assert(true, true);
            });
        }
      }
 
    ]
  });

  return suites;

});
