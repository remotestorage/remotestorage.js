if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {

  var suites = [];

  var util;
  var LocalStore, StubStore, Transactions;

  suites.push({
    name: 'RemoteStore',
    desc: 'A node store backed by a remote server',

    setup: function(env, test) {
      requirejs([
        './src/lib/util',
        './src/lib/store/local',
        './src/lib/store/stub',
        './src/lib/store/transactions'
      ], function(_util, _LocalStore, _StubStore, _Transactions) {
        util = _util;
        LocalStore = _LocalStore;
        StubStore = _StubStore;
        Transactions = _Transactions;
        test.result(true);
      });
    },

    beforeEach: function(env, test) {
      env.backend = new StubStore();
      env.store = new LocalStore(env.backend);
      test.result(true);
    },

    tests: [

      {
        desc: "#get() is forwarded to the backend",
        run: function(env, test) {
          env.store.get('/foo');
          env.backend.expect(test, 'get', '/foo');
          test.result(true);
        }
      },

      {
        desc: "#set() starts a transaction",
        run: function(env, test) {
          var testNode = {
            mimeType: 'text/plain',
            data: 'Hello World!',
            version: '123'
          };
          env.store.set('/hello', testNode);
          var call = env.backend.expect(test, 'transaction');
          test.assertTypeAnd(call.args[0], 'function');
          env.backend.expectNoMore(test);
          test.result(true);
        }
      },

      {
        desc: "#set() forwards the node to the backend",
        run: function(env, test) {
          var testNode = {
            mimeType: 'text/plain',
            data: 'Hello World!',
            version: '123'
          };
          env.store.set('/hello', testNode);
          var call = env.backend.expect(test, 'transaction');
          // call transaction block
          var transaction = new StubStore();
          call.args[0](transaction);
          transaction.expect(test, 'set', '/hello', testNode);
          test.result(true);
        }
      },

      {
        desc: "#set() updates the parent nodes",
        run: function(env, test) {
          var testNode = {
            mimeType: 'text/plain',
            data: 'Hello World!',
            version: '123'
          };
          env.store.set('/a/b/hello', testNode);
          var call = env.backend.expect(test, 'transaction');
          // call transaction block
          var transaction = new StubStore();
          call.args[0](transaction);
          var call = transaction.expect(test, 'set', '/a/b/hello', testNode);
          call.promise.fulfill();
          util.nextTick(function() {
            // check first parent
            var getCall = transaction.expect(test, 'get', '/a/b/');
            getCall.promise.fulfill();
            util.nextTick(function() {
              var setCall = transaction.expect(test, 'set', '/a/b/', {
                mimeType: 'application/json',
                data: {
                  'hello': '123'
                },
                version: '123'
              });
              setCall.promise.fulfill();
              util.nextTick(function() {
                // check second parent
                var getCall = transaction.expect(test, 'get', '/a/');
                // simulate existing listing
                getCall.promise.fulfill({
                  mimeType: 'application/json',
                  data: {
                    'c/': 'old-version'
                  },
                  version: 'old-version'
                });
                util.nextTick(function() {
                  var setCall = transaction.expect(test, 'set', '/a/', {
                    mimeType: 'application/json',
                    data: {
                      'c/': 'old-version',
                      'b/': '123'
                    },
                    version: '123'
                  });
                  setCall.promise.fulfill();
                  // check third parent
                  util.nextTick(function() {
                    var getCall = transaction.expect(test, 'get', '/');
                    getCall.promise.fulfill({
                      mimeType: 'application/json',
                      data: {
                        'a/': 'old-version'
                      },
                      version: 'old-version'
                    });
                    util.nextTick(function() {
                      var setCall = transaction.expect(test, 'set', '/', {
                        mimeType: 'application/json',
                        data: {
                          'a/': '123'
                        },
                        version: '123'
                      });
                      setCall.promise.fulfill();
                      // check that the transaction is committed
                      setTimeout(function() {
                        transaction.expect(test, 'commit');
                        test.done(); 
                      }, 30);
                    });
                  });
                });
              });
            });
          });
        }
      },

      {
        desc: "#remove() starts a transaction",
        run: function(env, test) {
          env.store.remove('/hello');
          var call = env.backend.expect(test, 'transaction');
          test.assertTypeAnd(call.args[0], 'function');
          test.done();
        }
      },

      {
        desc: "#remove() forwards to the backend",
        run: function(env, test) {
          env.store.remove('/hello');
          var call = env.backend.expect(test, 'transaction');
          var transaction = new StubStore();
          call.args[0](transaction);
          transaction.expect(test, 'remove', '/hello');
          test.done();
        }
      },

      {
        desc: "#remove() removes parents, when they are empty",
        run: function(env, test) {
          env.store.remove('/a/hello');
          var call = env.backend.expect(test, 'transaction');
          var transaction = new StubStore();
          call.args[0](transaction);
          transaction.expect(test, 'remove').promise.fulfill();
          util.nextTick(function() {
            transaction.expect(test, 'get', '/a/').promise.fulfill({
              mimeType: 'application/json',
              data: {
                'hello': '123'
              }
            });
            util.nextTick(function() {
              console.log('transaction calls', JSON.stringify(transaction.calls));
              transaction.expect(test, 'remove', '/a/').promise.fulfill();
              util.nextTick(function() {
                transaction.expect(test, 'get', '/').promise.fulfill({
                  mimeType: 'application/json',
                  data: {
                    'a/': '123',
                    'b/': '234'
                  },
                  version: '234'
                });
                util.nextTick(function() {
                  transaction.expect(test, 'set', '/', {
                    mimeType: 'application/json',
                    data: {
                      'b/': '234'
                    },
                    version: '234'
                  }).promise.fulfill();
                  setTimeout(function() {
                    transaction.expect(test, 'commit');
                    test.done();
                  }, 30);
                });
              });
            });
          });
        }
      }

    ]

  });

  return suites;

});
