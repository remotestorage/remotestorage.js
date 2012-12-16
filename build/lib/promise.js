var Promise = function() {
  this.result = undefined;
  this.success = undefined;
  this.handlers = {};
  this.__defineSetter__('onsuccess', function(fulfilledHandler) {
    if(typeof(fulfilledHandler) !== 'function') {
      throw "Success callback must be a function!";
    }
    this.handlers.fulfilled = fulfilledHandler;
    if(! this.nextPromise) {
      this.nextPromise = new Promise();
    }
  });
  this.__defineSetter__('onerror', function(failedHandler) {
    if(typeof(failedHandler) !== 'function') {
      throw "Error callback must be a function!";
    }
    this.handlers.failed = failedHandler;
    if(! this.nextPromise) {
      this.nextPromise = new Promise();
    }
  });
};

Promise.prototype = {
  fulfill: function() {
    if(typeof(this.success) !== 'undefined') {
      throw new Error("Can't fail promise, already resolved as: " +
                      (this.success ? 'fulfilled' : 'failed'));
    }
    this.result = util.toArray(arguments);
    this.success = true;
    if(! this.handlers.fulfilled) {
      return;
    }
    var nextResult;
    try {
      nextResult = this.handlers.fulfilled.apply(this, this.result);
    } catch(exc) {
      if(this.nextPromise) {
        this.nextPromise.fail(exc);
      } else {
        console.error("Uncaught exception: ", exc, exc.getStack());
      }
      return;
    }
    var nextPromise = this.nextPromise;
    if(nextPromise) {
      if(nextResult && typeof(nextResult.then) === 'function') {
        // chain our promise after this one.
        nextResult.then(function() {
          nextPromise.fulfill.apply(nextPromise, arguments);
        }, function() {
          nextPromise.fail.apply(nextPromise, arguments);
        });
      } else {
        nextPromise.fulfill(nextResult);
      }
    }
  },

  fail: function() {
    if(typeof(this.success) !== 'undefined') {
      throw new Error("Can't fail promise, already resolved as: " +
                      (this.success ? 'fulfilled' : 'failed'));
    }
    this.result = util.toArray(arguments);
    this.success = false;
    if(this.handlers.failed) {
      this.handlers.failed.apply(this, this.result);
    } else if(this.nextPromise) {
      this.nextPromise.fail.apply(this.nextPromise, this.result);
    } else {
      console.error("Uncaught error: ", this.result, (this.result[0] && this.result[0].stack));
    }
  },

  fulfillLater: function() {
    var args = util.toArray(arguments);
    util.nextTick(function() {
      this.fulfill.apply(this, args);
    }.bind(this));
    return this;
  },

  failLater: function() {
    var args = util.toArray(arguments);
    util.nextTick(function() {
      this.fail.apply(this, args);
    }.bind(this));
    return this;
  },

  then: function(fulfilledHandler, errorHandler) {
    this.handlers.fulfilled = fulfilledHandler;
    this.handlers.failed = errorHandler;
    this.nextPromise = new Promise();
    return this.nextPromise;
  },

  get: function() {
    var propertyNames = util.toArray(arguments);
    return this.then(function(result) {
      var promise = new Promise();
      var values = [];
      if(typeof(result) !== 'object') {
        promise.failLater(new Error(
          "Can't get properties of non-object (properties: " + 
            propertyNames.join(', ') + ')'
        ));
      } else {
        propertyNames.forEach(function(propertyName) {
          values.push(result[propertyName]);
        });
        promise.fulfillLater.apply(promise, values);
      }
      return promise;
    });
  },

  call: function(methodName) {
    var args = Array.prototype.slice.call(arguments, 1);
    return this.then(function(result) {
      return result[methodName].apply(result, args);
    });
  }
};

module.exports = Promise;