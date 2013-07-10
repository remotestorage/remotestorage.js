
(function() {
  RemoteStorage.prototype.util = {
    getEventEmitter: function() {
      console.log('util.getEventEmitter is deprecated.');
      var object = {};
      var args = Array.prototype.slice.call(arguments);
      args.unshift(object);
      RemoteStorage.eventHandling.apply(RemoteStorage, args);
      object.emit = object._emit;
      return object;
    },

    extend: function(target) {
      console.log('util.extend is deprecated.');
      var sources = Array.prototype.slice.call(arguments, 1);
      sources.forEach(function(source) {
        for(var key in source) {
          target[key] = source[key];
        }
      });
      return target;
    },

    asyncMap: function(array, callback) {
      console.log('util.extend is deprecated.');
      var promise = promising();
      var n = array.length, i = 0;
      var results = [], errors = [];
      function oneDone() {
        i++;
        if(i == n) {
          promise.fulfill(results, errors);
        }
      }
      array.forEach(function(item, index) {
        try {
          var result = callback(item);
        } catch(exc) {
          oneDone();
          errors[index] = exc;
        }
        if(typeof(result) == 'object' && typeof(result.then) == 'function') {
          result.then(function(res) { results[index] = res; oneDone(); },
                      function(error) { errors[index] = res; oneDone(); });
        } else {
          oneDone();
          results[index] = result;
        }
      });
      return promise;
    }
  };
})();
