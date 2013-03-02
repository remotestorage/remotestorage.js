if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs', 'fs', 'localStorage'], function(requirejs, fs, localStorage) {
  var suites = [];

  global.localStorage = localStorage;

  // set from util in setup
  var curry = null, util = null;

  function catchError(test) {
    return function(error) {
      console.error("Caught error: ", error, error && error.stack);
      test.result(false);
    };
  }

  function finalResult(test, value) {
    return function() {
      test.result(typeof(value) === 'undefined' ? true : value);
    }
  }

  function assertP(test, expected) {
    return function(actual) {
      test.assertAnd(actual, expected);
      return actual;
    };
  }

  suites.push({
    name: "store.js tests",
    desc: "collection of tests for store.js",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/lib/store',
        './src/lib/store/memory'
      ], function(_util, store, memoryAdapter) {
        util = _util;
        env.util = util;
        curry = util.curry;
        util.silenceAllLoggers();
        env.store = store;
        env.storageAdapter = memoryAdapter();
        env.store.setAdapter(env.storageAdapter);
        _this.result(true);
      });
    },
    takedown: function(env) {
      this.result(true);
    },
    beforeEach: function(env) {
      var _this = this;
      env.storageAdapter.forgetAll().
        then(function() {
          _this.result(true);
        });
    },
    tests: [

      {
        desc: "store.getNode returns a promise",
        run: function(env) {
          this.assertType(env.store.getNode('/foo').then, 'function');
        }
      },
      {
        desc: "store.getNode builds a new node",
        run: function(env) {
          var _this = this;
          env.store.getNode('/foo/bar').
            then(function(node) {
              _this.assertAnd(node.timestamp, 0);
              _this.assertAnd(node.lastUpdatedAt, 0);
              _this.assert(node.mimeType, "application/json");
            });
        }
      },
      {
        desc: "store.getNode initializes directory data and diff",
        run: function(env) {
          var _this = this;
          env.store.getNode('/foo/').
            then(function(node) {
              _this.assertAnd(node.data, {});
              _this.assert(node.diff, {});
            });
        }
      },
      {
        desc: "store.getNode forwards the node received from storage",
        run: function(env) {
          var _this = this;
          var t = new Date().getTime();
          env.storageAdapter.set("/foo/bar", {
            timestamp: t,
            mimeType: "text/plain",
            data: 'some text'
          });

          env.store.getNode('/foo/bar').
            then(function(node) {
              _this.assertAnd(node.timestamp, t);
              _this.assertAnd(node.mimeType, 'text/plain');
              _this.assert(node.data, 'some text');
            });
        }
      },

      {
        desc: "store.setNodeData stores incoming data correctly",
        run: function(env) {
          var _this = this;
          env.store.setNodeData(
            '/foo/bar', // path
            'some-data', // data
            false, // outgoing
            12345, // timestamp
            'text/plain' // mimeType
          ).
            // check node
            then(curry(env.storageAdapter.get, '/foo/bar')).
            then(function(node) {
              _this.assertTypeAnd(node, 'object');
              _this.assertAnd(node.timestamp, 12345);
              _this.assertAnd(node.lastUpdatedAt, 12345);
              _this.assertAnd(node.mimeType, 'text/plain');
              _this.assertAnd(node.data, 'some-data');
            }).
            // check parent
            then(curry(env.storageAdapter.get, '/foo/')).
            then(function(node) {
              _this.assertAnd(node.diff, {});
              _this.assertAnd(node.data, { 'bar' : 12345 });
              _this.result(true);
            }, catchError(this));
        }
      },

      {
        desc: "store.setNodeData sets outgoing data correctly",
        run: function(env) {
          var _this = this;
          env.store.setNodeData(
            '/a/b',
            { json: 'object' },
            true,
            23456,
            'application/json'
          ).
            then(curry(env.storageAdapter.get, '/a/b')).
            then(function(node) {
              _this.assertTypeAnd(node, 'object');
              _this.assertAnd(node.timestamp, 23456); 
              _this.assertAnd(node.lastUpdatedAt, 0);
              _this.assertAnd(node.mimeType, 'application/json'); 
              _this.assertAnd(node.data, { json: 'object' });
            }).
            then(curry(env.storageAdapter.get, '/a/')).
            then(function(node) {
              _this.assertAnd(node.data, { "b": 23456 });
              _this.assertAnd(node.diff, { "b": 23456 });
              _this.assertAnd(node.timestamp, 23456);
              _this.assertAnd(node.lastUpdatedAt, 0);
            }).
            then(curry(env.storageAdapter.get, '/')).
            then(function(node) {
              _this.assertAnd(node.data, { "a/": 23456 });
              _this.assert(node.diff, { "a/": 23456 });
            }, catchError(this));
        }
      },

      {
        desc: "store.setNodeData store incoming, then remove outgoing",
        run: function(env) {
          var _this = this;
          env.store.setNodeData(
            '/a/b/c', 'test-data', false, 12345, 'text/plain'
          ).
            then(curry(env.store.getNode, '/a/b/c')).
            then(function(node) {
              _this.assertAnd(node.data, 'test-data');
            }).
            then(curry(
              env.store.setNodeData,
              '/a/b/c', undefined, true, 23456, 'text/plain'
            )).
            then(curry(env.store.getNode, '/a/b/c')).
            then(function(node) {
              _this.assertType(node.data, 'undefined');
            }, catchError(this));
        }
      },

      {
        desc: "store.setNodeData clears the node error",
        run: function(env) {
          var _this = this;
          env.store.setNodeError('/a/b/c', "ERROR!!!").
            then(curry(env.store.getNode, '/a/b/c')).
            then(function(node) {
              // check that error is set
              _this.assertAnd("ERROR!!!", node.error);
            }).
            then(curry(
              env.store.setNodeData, '/a/b/c', 'test-adata', false, 12345, 'text/plain'
            )).
            then(curry(env.store.getNode, '/a/b/c')).
            then(function(node) {
              _this.assertType(node.error, 'undefined');
            });
        }
      },

      {
        desc: "store.clearDiff bubbles up the tree and updates all timestamps",
        run: function(env) {
          var _this = this;

          var t = 1234567;
          
          function assertDiff(key) {
            return function(node) {
              var diff = {};
              diff[key] = t;
              _this.assertAnd(node.diff, diff);
              return node;
            }
          }

          function assertNoDiff(node) {
            _this.assertAnd(node.diff, {});
            return node;
          }

          function assertTimestampUpdate(node) {
            _this.assertAnd(node.timestamp, t * 2);
            _this.assertAnd(node.lastUpdatedAt, node.timestamp);
            return node;
          }

          function get(path) {
            return curry(env.store.getNode, path);
          }

          // setup node
          env.store.setNodeData(
            '/a/b/c/d/e', 'plain-data', true, t, 'text/plain'
          ).
            // check that diff is really set everywhere
            then(get('/a/b/c/d/')).
            then(assertDiff('e')).
            then(get('/a/b/c/')).
            then(assertDiff('d/')).
            then(get('/a/b/')).
            then(assertDiff('c/')).
            then(get('/a/')).
            then(assertDiff('b/')).
            then(get('/')).
            then(assertDiff('a/')).
            // now clear the diff
            then(curry(env.store.clearDiff, '/a/b/c/d/e', t * 2)).
            // check that all diffs are cleared and timestamps are updated
            then(get('/a/b/c/d/e')).
            then(assertTimestampUpdate).
            then(get('/a/b/c/d/')).
            then(assertTimestampUpdate).
            then(assertNoDiff).
            then(get('/a/b/c/')).
            then(assertTimestampUpdate).
            then(assertNoDiff).
            then(get('/a/b/')).
            then(assertTimestampUpdate).
            then(assertNoDiff).
            then(get('/a/')).
            then(assertTimestampUpdate).
            then(assertNoDiff).
            then(get('/')).
            then(assertTimestampUpdate).
            then(assertNoDiff).
            then(function() {
              _this.result(true);
            }, catchError(this));
        }
      },

      {
        desc: "store.forgetAll delegates to store",
        setup: function(env) {
          env.origForgetAll = env.storageAdapter.forgetAll;
          env.storageAdapter.forgetAll = function() {
            env.allForgotten = true;
            return util.getPromise().fulfill();
          };
          this.result(true);
        },
        teardown: function(env) {
          env.storageAdapter.forgetAll = env.origForgetAll;
          delete env.origForgetAll;
          delete env.allForgotten;
          this.result(true);
        },
        run: function(env) {
          var _this = this;
          env.store.forgetAll().
            then(function() {
              _this.assert(env.allForgotten, true);
            }, catchError(this));
        }
      },

      {
        desc: "store.setNodeError sets the node error",
        run: function(env) {
          var _this = this;
          env.store.setNodeError('/foo', 'bar').
            then(curry(env.store.getNode, '/foo')).
            then(function(node) {
              _this.assert(node.error, 'bar')
            });
        }
      },

      {
        desc: "store.setLastSynced updates lastUpdatedAt flag",
        run: function(env) {
          var _this = this;
          env.store.setLastSynced('/some-path', 23456).
            then(curry(env.store.getNode, '/some-path')).
            then(function(node) {
              _this.assert(node.lastUpdatedAt, 23456);
            });
        }
      },

      {
        desc: "store.touchNode creates a directory entry in the parent",
        run: function(env, test) {
          env.store.touchNode('/foo/bar').
            then(curry(env.store.getNode, '/foo/')).
            then(function(parentNode) {
              test.assert(Object.keys(parentNode.data), ['bar']);
            });
        }
      }

    ]
  });

  return suites;
});
