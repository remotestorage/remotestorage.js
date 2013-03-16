define(['../util'], function(util) {

  var StubStore = function() {
    this.calls = [];
  };

  StubStore.prototype = {

    // store methods

    get: function(path) {
      var promise = util.getPromise();
      this.calls.push({
        method: 'get',
        promise: promise,
        args: util.toArray(arguments)
      });
      return promise;
    },

    set: function(path, node) {
      var promise = util.getPromise();
      this.calls.push({
        method: 'set',
        promise: promise,
        args: util.toArray(arguments)
      });
      return promise;
    },

    remove: function(path) {
      var promise = util.getPromise();
      this.calls.push({
        method: 'remove',
        promise: promise,
        args: util.toArray(arguments)
      });
      return promise;
    },

    // transaction methods

    commit: function() {
      this.calls.push({
        method: 'commit'
      });
    },

    // transactions methods

    transaction: function(block) {
      var promise = util.getPromise();
      this.calls.push({
        method: 'transaction',
        promise: promise,
        args: util.toArray(arguments)
      });
      return promise;
    },

    // test methods

    expect: function(test, method) {
      if(typeof(test) !== 'object' ||
         typeof(test.result) !== 'function') {
        throw new Error("StubStore#expect needs to be passed a 'test' object");
      }
      var args = Array.prototype.slice.call(arguments, 2);
      var cl = this.calls.length;
      for(var i=0;i<cl;i++) {
        var call = this.calls[i];
        if(call.method === method) {
          if(args.length > 0) {
            test.assertAnd(
              args, call.args,
              "arguments don't match! (" +
                JSON.stringify(args) + ' vs.' + JSON.stringify(call.args) + ')'
            );
          }
          this.calls.splice(i, 1);
          return call;
        }
      }
      var msg = 'expected to find call ' + method + '(' + args.join(', ') + ')' + ', have: ' + JSON.stringify(this.calls);
      console.log(msg);
      test.result(false, msg);
    },

    expectNoMore: function(test) {
      test.assert(this.calls.length, 0);
    }
  };

  return StubStore;

});