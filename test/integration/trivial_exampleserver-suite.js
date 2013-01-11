if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define([
  'requirejs', 'localStorage'
], function(requirejs, localStorage) {
  var suites = [];
  global.localStorage = localStorage;
  var curry, util;

  var normalSuite = {
    name: "trivial exampleserver",
    desc: "trivial tests using example server",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/remoteStorage',
        './src/modules/root',
        './test/helper/server'
      ], function(_util, remoteStorage, root, serverHelper) {
        util = _util;
        curry = util.curry;
        env.remoteStorage = remoteStorage;
        env.client = root;
        env.serverHelper = serverHelper;

        env.remoteStorage.util.silenceAllLoggers();
        env.remoteStorage.util.unsilenceLogger('getputdelete');

        env.serverHelper.start(curry(_this.result.bind(_this), true));
      });
    },
    takedown: function(env) {
      var _this = this;
      env.serverHelper.stop(function() {
        env = '';
        _this.result(true);
      });
    },
    beforeEach: function (env) {
      // BEFORE EACH TEST
      var _this = this;

      env.rsConnect = function() {
        env.remoteStorage.nodeConnect.setStorageInfo(
          env.serverHelper.getStorageInfo()
        );
        env.remoteStorage.nodeConnect.setBearerToken(
          env.serverHelper.getBearerToken()
        );
        return env.remoteStorage.claimAccess('root', 'rw');
      };
      env.rsConnect().then(function() {
        _this.result(true);
      });
    },
    afterEach: function (env) {
      var _this = this;
      env.remoteStorage.sync.needsSync('/').then(function(unsynced) {
        // if unsynced is true, somethings wrong
        if (unsynced) {
          _this.result(false, 'client needsSync = true, thats not good');
        }
        env.remoteStorage.flushLocal().then(curry(_this.result.bind(_this), true));
      });
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
              console.log('FULL SYNC DONE *************************************');
              var state = env.serverHelper.getState();
              console.log('SERVER STATE NOW', state);
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
        desc: "writing some objects, then syncing just the tree w/o data",
        run: function(env) {
          var _this = this;
          util.asyncGroup(
            curry(env.client.storeObject, 'test', 'test-dir/a', { n: 'a' }),
            curry(env.client.storeObject, 'test', 'test-dir/b', { n: 'b' }),
            curry(env.client.storeObject, 'test', 'test-dir/c', { n: 'c' })
          ).
            then(env.remoteStorage.fullSync).
            then(env.remoteStorage.flushLocal).
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
      },

      {
        desc: "writing some objects, then sync just a subtree w/o data",
        run: function(env) {
          var _this = this;
          util.asyncGroup(
            curry(env.client.storeObject, 'test', 'test-dir/a', { n: 'a' }),
            curry(env.client.storeObject, 'test', 'test-dir/b', { n: 'b' }),
            curry(env.client.storeObject, 'test', 'test-dir/c', { n: 'c' }),
            curry(env.client.storeObject, 'test', 'test-dir/d', { n: 'd' }),
            curry(env.client.storeObject, 'test', 'other-dir/a', { n: 'a' }),
            curry(env.client.storeObject, 'test', 'other-dir/b', { n: 'b' }),
            curry(env.client.storeObject, 'test', 'other-dir/c', { n: 'c' }),
            curry(env.client.storeObject, 'test', 'other-dir/d', { n: 'd' }),
            curry(env.client.storeObject, 'test', 'other-dir/e', { n: 'e' })
          ).
            then(env.remoteStorage.fullSync).
            then(env.remoteStorage.flushLocal).
            then(env.rsConnect).
            then(curry(env.remoteStorage.root.release, '')).
            then(curry(env.remoteStorage.root.use, 'test-dir/', true)).
            then(env.remoteStorage.fullSync).
            then(curry(env.remoteStorage.root.getListing, 'test-dir/')).
            then(function(listing) {
              _this.assertAnd(listing, ['a', 'b', 'c']);
            }).
            then(curry(env.remoteStorage.root.getObject, 'test-dir/a')).
            then(function(obj) {
              _this.assertTypeAnd(obj, 'undefined');
            }).
            then(curry(env.remoteStorage.root.getListing, 'other-dir/')).
            then(function(listing) {
              _this.assert(listing, []);
            });
        }
      },

      {
        desc: "writing some objects, then sync just a subtree w/ data",
        run: function(env) {
          var _this = this;
          util.asyncGroup(
            curry(env.client.storeObject, 'test', 'test-dir/a', { n: 'a' }),
            curry(env.client.storeObject, 'test', 'test-dir/b', { n: 'b' }),
            curry(env.client.storeObject, 'test', 'test-dir/c', { n: 'c' }),
            curry(env.client.storeObject, 'test', 'test-dir/d', { n: 'd' }),
            curry(env.client.storeObject, 'test', 'other-dir/a', { n: 'a' }),
            curry(env.client.storeObject, 'test', 'other-dir/b', { n: 'b' }),
            curry(env.client.storeObject, 'test', 'other-dir/c', { n: 'c' }),
            curry(env.client.storeObject, 'test', 'other-dir/d', { n: 'd' }),
            curry(env.client.storeObject, 'test', 'other-dir/e', { n: 'e' })
          ).
            then(env.remoteStorage.fullSync).
            then(env.remoteStorage.flushLocal).
            then(env.rsConnect).
            then(curry(env.remoteStorage.root.release, '')).
            then(curry(env.remoteStorage.root.use, 'test-dir/', true)).
            then(env.remoteStorage.fullSync).
            then(curry(env.remoteStorage.root.getListing, 'test-dir/')).
            then(function(listing) {
              _this.assertAnd(listing, ['a', 'b', 'c']);
            }).
            then(curry(env.client.getObject, 'test-dir/a')).
            then(function(obj) {
              _this.assertAnd(obj, { n: 'c' });
            }).
            then(curry(env.remoteStorage.root.getListing, 'other-dir/')).
            then(function(listing) {
              _this.assertAnd(listing, []);
            }).
            then(curry(env.client.getObject, 'other-dir/a')).
            then(function(obj) {
              _this.assertType(obj, 'undefined');
            });
        }
      }

    ]
  };

  var slowSuite = {};
  for(var key in normalSuite) {
    slowSuite[key] = normalSuite[key];
  }
  slowSuite.name = normalSuite.name.replace(/trivial/, 'slow');
  slowSuite.desc = normalSuite.desc.replace(/trivial/, 'slow');
  slowSuite.tests.forEach(function(test) {
    test.timeout = 20000;
  });
  slowSuite.beforeEach = function(env) {
    var _this = this;
    normalSuite.beforeEach.apply(
      {
        result: function(res) {
          if(res) {
            env.serverHelper.delayResponse(750);
            _this.result(true);
          } else {
            _this.result.apply(_this, arguments);
          }
        }
      },
      [env]
    );
  };

  suites.push(normalSuite);
  // suites.push(slowSuite);


  return suites;
});
