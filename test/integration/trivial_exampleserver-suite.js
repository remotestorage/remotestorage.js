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
        './src/lib/store',
        './src/lib/sync',
        './src/modules/root',
        './server/nodejs-example',
        './test/helper/server'
      ], function(_util, remoteStorage, store, sync, root, nodejsExampleServer, serverHelper) {
        util = _util;
        curry = util.curry;
        env.remoteStorage = remoteStorage;
        env.store = store;
        env.sync = sync;
        env.client = root;
        env.serverHelper = serverHelper;

        util.extend(env.serverHelper, nodejsExampleServer.server);

        env.serverHelper.start(curry(_this.result.bind(_this), true));
      });
    },
    takedown: function(env) {
      var _this = this;
      env.serverHelper.stop(function() {
        _this.result(true);
      });
    },
    beforeEach: function (env) {
      // BEFORE EACH TEST
      var _this = this;

      env.serverHelper.resetState();
      env.serverHelper.setScope([':rw']);

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
              var state = env.serverHelper.getState();
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
        desc: "write a file, list it",
        run: function(env) {
          var _this = this;
          env.client.use('').
            then(curry(env.client.storeObject, 'test', 'test-dir/y', {phu: 'quoc'})).
            then(function(){
              env.client.getListing('test-dir/').then(function(r){
                _this.assert(r, ['y']);
              });
            });
        }
      },

      {
        desc: "write a file, sync, list it",
        run: function(env) {
          var _this = this;
          env.client.storeObject('test', 'test-dir/z', {phu: 'quoc'}).then(function(){
            return env.remoteStorage.fullSync();
          }).then(function() {
            return env.client.getListing('test-dir/');
          }).then(function(r) {
            _this.assert(r, ['z']);
          });
        }
      },

      {
        desc: "write a file, sync, list it",
        willFail: true,
        run: function(env) {
          var _this = this;
          env.client.storeObject('test', 'test-dir/z', {phu: 'quoc'}).then(function(){
            return env.remoteStorage.fullSync();
          }).then(function() {
            return env.client.getListing('test-dir/');
          }).then(function(r) {
            _this.assert(r, ['superdong']);
          });
        }
      },

      {
        desc: "write 3 files, sync, list them",
        run: function(env) {
          var _this = this;
          env.client.storeObject('test', 'test-dir/z', {phu: 'quoc'}).then(function(){
            return env.client.storeObject('test', 'test-dir/z', {phu: 'quoc'});
          }).then(function(){
            return env.client.storeObject('test', 'test-dir/z', {phu: 'quoc'});
          }).then(function(){
            return env.remoteStorage.fullSync();
          }).then(function() {
            return env.client.getListing('test-dir/');
          }).then(function(r) {
            _this.assert(r, ['z']);
          });
        }
      },

      {
        desc: "write 3 files, sync, list them",
        run: function(env) {
          var _this = this;
          env.client.storeObject('test', 'test-dir/z', {phu: 'quoc'}).then(function(){
            return env.client.storeObject('test', 'test-dir/z', {phu: 'quoc'});
          }).then(function(){
            return env.client.storeObject('test', 'test-dir/z', {phu: 'quoc'});
          }).then(function(){
            return env.remoteStorage.fullSync();
          }).then(function() {
            return env.client.getListing('test-dir/');
          }).then(function(r) {
            _this.assert(r, ['z']);
          });
        }
      },

      {
        desc: "writing some objects, then syncing just the tree w/o data",
        run: function(env) {
          var _this = this;
          util.asyncGroup(
            curry(env.client.storeObject, 'test', 'test-dir/duong-dong/a', { n: 'a' })
          ).
            then(env.remoteStorage.fullSync).
            then(env.remoteStorage.flushLocal).
            then(env.rsConnect).
            then(curry(env.remoteStorage.root.release, '')).
            then(curry(env.remoteStorage.root.use, 'test-dir/', true)).
            then(env.remoteStorage.fullSync).
            then(curry(env.client.getListing, 'test-dir/')).
            then(function(listing) {
              _this.assertAnd(listing, ['duong-dong/']);
            }).
            then(curry(env.client.getListing, 'test-dir/duong-dong/')).
            then(function(listing) {
              _this.assert(listing, ['a']);
            });
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
            then(curry(env.remoteStorage.root.release, '')).
            then(curry(env.remoteStorage.root.use, '', true)).
            then(env.remoteStorage.fullSync).
            then(curry(env.client.getListing, '')).
            then(function(rootListing) {
              _this.assertAnd(rootListing, ['test-dir/']);
              //console.log("KEYS", Object.keys(env.store.getAdapter()._nodes));
              //return env.store.getNode('/test-dir/');
            }).
            then(curry(env.client.getListing, 'test-dir/')).
            then(function(listing) {
              listing = listing.sort();
              _this.assertAnd(listing, ['a', 'b', 'c'], "Listing doesn't match (expected [a, b, c], got: " + JSON.stringify(listing) + ")");
            }).
            then(curry(env.store.getNode, '/test-dir/a')).
            then(function(node) {
              _this.assert(node.pending, true);
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
              _this.assertAnd(listing, ['a', 'b', 'c', 'd']);
            }).
            then(curry(env.store.getNode, '/test-dir/a')).
            then(function(node) {
              _this.assertAnd(node.pending, true);
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
            then(curry(env.remoteStorage.root.use, 'test-dir/')).
            then(env.remoteStorage.fullSync).
            then(curry(env.remoteStorage.root.getListing, 'test-dir/')).
            then(function(listing) {
              listing = listing.sort();
              _this.assertAnd(listing, ['a', 'b', 'c', 'd'], 'listing abc: '+JSON.stringify(listing));
            }).
            then(curry(env.client.getObject, 'test-dir/a')).
            then(function(obj) {
              _this.assertAnd(obj, { n: 'a', '@type': 'https://remotestoragejs.com/spec/modules/root/test' }, 'object a');
            }).
            then(curry(env.remoteStorage.root.getListing, 'other-dir/')).
            then(function(listing) {
              _this.assertAnd(listing, [], 'listing other-dir');
            }).
            then(curry(env.client.getObject, 'other-dir/a')).
            then(function(obj) {
              _this.assertType(obj, 'undefined', 'object other-dir/a');
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
