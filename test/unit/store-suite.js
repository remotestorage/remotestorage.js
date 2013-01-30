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
              _this.assertAnd(node.startAccess, null);
              _this.assertAnd(node.startForce, null);
              _this.assertAnd(node.startForceTree, null);
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
            get('data', 'diff').
            then(function(data, diff) {
              _this.assertAnd(data, {});
              _this.assert(diff, {});
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
              return node;
            }).
            get('timestamp', 'lastUpdatedAt', 'mimeType', 'data').
            then(function(timestamp, lastUpdatedAt, mimeType, data) {
              _this.assertAnd(timestamp, 12345);
              _this.assertAnd(lastUpdatedAt, 12345);
              _this.assertAnd(mimeType, 'text/plain');
              _this.assertAnd(data, 'some-data');
            }).
            // check parent
            then(curry(env.storageAdapter.get, '/foo/')).
            get('diff', 'data').
            then(function(diff, data) {
              _this.assertAnd(diff, {});
              _this.assertAnd(data, { 'bar' : 12345 });
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
            get('data').
            then(function(data) {
              _this.assertAnd(data, 'test-data');
            }).
            then(curry(
              env.store.setNodeData,
              '/a/b/c', undefined, true, 23456, 'text/plain'
            )).
            then(curry(env.store.getNode, '/a/b/c')).
            get('data').
            then(function(data) {
              _this.assertType(data, 'undefined');
            }, catchError(this));
        }
      },

      {
        desc: "store.setNodeData clears the node error",
        run: function(env) {
          var _this = this;
          env.store.setNodeError('/a/b/c', "ERROR!!!").
            then(curry(env.store.getNode, '/a/b/c')).
            get('error').
            then(function(error) {
              // check that error is set
              _this.assertAnd("ERROR!!!", error);
            }).
            then(curry(
              env.store.setNodeData, '/a/b/c', 'test-adata', false, 12345, 'text/plain'
            )).
            then(curry(env.store.getNode, '/a/b/c')).
            get('error').
            then(function(error) {
              _this.assertType(error, 'undefined');
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
        desc: "store.setNodeAccess",
        run: function(env) {
          env.store.setNodeAccess('/foo/', 'rw').
            then(curry(env.store.getNode, '/foo/')).
            get('startAccess').
            then(assertP(this, 'rw')).
            then(finalResult(this), catchError(this));
        }
      },

      {
        desc: "store.setNodeForce",
        run: function(env) {
          var _this = this;
          env.store.setNodeForce('/foo/', false, true).
            then(curry(env.store.getNode, '/foo/')).
            then(function(node) {
              _this.assertAnd(node.startForce, false);
              _this.assertAnd(node.startForceTree, true);
            }).
            then(curry(env.store.setNodeForce, '/bar/', true, true)).
            then(curry(env.store.getNode, '/bar/')).
            then(function(node) {
              _this.assertAnd(node.startForce, true);
              _this.assertAnd(node.startForceTree, true);
            }).
            then(curry(env.store.setNodeForce, '/baz/', false, false)).
            then(curry(env.store.getNode, '/baz/')).
            then(function(node) {
              _this.assertAnd(node.startForce, false);
              _this.assertAnd(node.startForceTree, false);
            }).
            then(finalResult(this), catchError(this));
        }
      },

      {
        desc: "store.forgetAll delegates to store",
        setup: function(env) {
          env.origForgetAll = env.storageAdapter.forgetAll;
          env.storageAdapter.forgetAll = function() {
            env.allForgotten = true;
            return util.getPromise().fulfillLater();
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
            then(curry(env.store.getNode, '/foo')).get('error').
            then(function(error) {
              _this.assert(error, 'bar')
            });
        }
      },

      {
        desc: "store.touchNode adds non-existent node to parent",
        run: function(env) {
          var _this = this;
          env.store.touchNode('/something').
            then(curry(env.store.getNode, '/')).
            then(function(parentNode) {
              _this.assert(parentNode.data.something, 0);
            });
        }
      },

      {
        desc: "store.touchNode creates a node with a 'pending' flag",
        run: function(env) {
          var _this = this;
          env.store.touchNode('/something-else').
            then(curry(env.store.getNode, '/something-else')).
            then(function(node) {
              _this.assert(node.pending, true, 'pending-flag not found');
            });
        }
      },

      {
        desc: "store.touchNode doesn't set the 'pending' flag on existing nodes",
        run: function(env) {
          var _this = this;
          env.store.setNodeData(
            '/existing-node', 'foo', false, 12345, 'text/plain'
          ).then(curry(env.store.touchNode, '/existing-node')).
            then(curry(env.store.getNode, '/existing-node')).
            then(function(node) {
              _this.assertType(node.pending, 'undefined', "pending-flag is set, but it shouldn't be");
            });
        }
      },

      {
        desc: "store.setNodeData clears the 'pending' flag",
        run: function(env) {
          var _this = this;
          env.store.touchNode('/pending-node').
            then(curry(env.store.setNodeData, '/pending-node',
                       'foo', false, 23456, 'text/plain')).
            then(curry(env.store.getNode, '/pending-node')).
            then(function(node) {
              _this.assertType(node.pending, 'undefined');
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
        desc: "store.setNodePending sets the 'pending' flag",
        run: function(env, test) {
          env.store.setNodePending('/foo/bar', 12345).
            then(curry(env.store.getNode, '/foo/bar')).
            then(function(node) {
              test.assert(node.pending, true);
            });
        }
      },

      {
        desc: "store.setNodePending removes the 'data' attribute",
        run: function(env, test) {
          env.store.setNodeData('/foo/bar', 'baz', false, 12345, 'text/plain').
            then(curry(env.store.setNodePending, '/foo/bar', 23456)).
            then(curry(env.store.getNode, '/foo/bar')).
            then(function(node) {
              test.assertType(node.data, 'undefined');
            });
        }
      }

    ]
  });

  return suites;
});
