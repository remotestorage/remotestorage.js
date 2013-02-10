define(['../util'], function(util) {

  var logger = util.getLogger('store::pending');

  return function() {
    var requestQueue = [];

    function queueRequest(name, args, dontPromise) {
      logger.debug(name, args[0]);
      if(! dontPromise) {
        return util.getPromise(function(promise) {
          requestQueue.push({
            method: name,
            args: args,
            promise: promise
          });
        });
      } else {
        requestQueue.push({
          method: name,
          args: args
        });
      }
    }

    var pendingAdapter = {
      transaction: function(write, body) {
        return queueRequest('transaction', [write, body]);
      },
      on: function(eventName, handler) {
        return queueRequest('on', [eventName, handler], true);
      },
      get: function(key) {
        return queueRequest('get', [key]);
      },
      put: function(key, value) {
        return queueRequest('put', [key, value]);
      },
      remove: function(key) {
        return queueRequest('remove', [key]);
      },
      forgetAll: function(key) {
        return queueRequest('forgetAll', []);
      },
      flush: function(adapter) {
        requestQueue.forEach(function(request) {
          logger.debug('QUEUE FLUSH', request.method, request.args[0]);
          if(request.promise) {
            adapter[request.method].apply(adapter, request.args).
              then(request.promise.fulfill,
                   request.promise.reject);
          } else {
            adapter[request.method].apply(adapter, request.args);
          }
        });
        requestQueue = [];
      },
      replaceWith: function(adapter) {
        pendingAdapter.flush(adapter);
        util.extend(pendingAdapter, adapter);
        delete pendingAdapter.flush;
        delete pendingAdapter.replaceWith;
      }
    };

    return pendingAdapter;
  };

});
