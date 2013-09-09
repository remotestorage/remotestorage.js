(function(global) {
  function getPromise(builder) {
    var promise;

    if(typeof(builder) === 'function') {
      setTimeout(function() {
        try {
          builder(promise);
        } catch(e) {
          promise.reject(e);
        }
      }, 0);
    }

    var consumers = [], success, result;

    function notifyConsumer(consumer) {
      if(success) {
        var nextValue;
        if(consumer.fulfilled) {
          try {
            nextValue = [consumer.fulfilled.apply(null, result)];
          } catch(exc) {
            consumer.promise.reject(exc);
            return;
          }
        } else {
          nextValue = result;
        }
        if(nextValue[0] && typeof(nextValue[0].then) === 'function') {
          nextValue[0].then(consumer.promise.fulfill, consumer.promise.reject);
        } else {
          consumer.promise.fulfill.apply(null, nextValue);
        }
      } else {
        if(consumer.rejected) {
          var ret;
          try {
            ret = consumer.rejected.apply(null, result);
          } catch(exc) {
            consumer.promise.reject(exc);
            return;
          }
          if(ret && typeof(ret.then) === 'function') {
            ret.then(consumer.promise.fulfill, consumer.promise.reject);
          } else {
            consumer.promise.fulfill(ret);
          }
        } else {
          consumer.promise.reject.apply(null, result);
        }
      }
    }

    function resolve(succ, res) {
      if(result) {
        console.error("WARNING: Can't resolve promise, already resolved!");
        return;
      }
      success = succ;
      result = Array.prototype.slice.call(res);
      setTimeout(function() {
        var cl = consumers.length;
        if(cl === 0 && (! success)) {
          console.error("Possibly uncaught error: ", result, result[0] && result[0].stack);
        }
        for(var i=0;i<cl;i++) {
          notifyConsumer(consumers[i]);
        }
        consumers = undefined;
      }, 0);
    }

    promise = {

      then: function(fulfilled, rejected) {
        var consumer = {
          fulfilled: typeof(fulfilled) === 'function' ? fulfilled : undefined,
          rejected: typeof(rejected) === 'function' ? rejected : undefined,
          promise: getPromise()
        };
        if(result) {
          setTimeout(function() {
            notifyConsumer(consumer)
          }, 0);
        } else {
          consumers.push(consumer);
        }
        return consumer.promise;
      },

      fulfill: function() {
        resolve(true, arguments);
        return this;
      },
      
      reject: function() {
        resolve(false, arguments);
        return this;
      }
      
    };

    return promise;
  };

  global.promising = getPromise;

})(typeof(window) != 'undefined' ? window : global);
