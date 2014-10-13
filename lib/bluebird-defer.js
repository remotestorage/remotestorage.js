// wrapper to implement defer() functionality
(function () {
  function __defer() {
    var resolve, reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
      resolve: resolve,
      reject: reject,
      promise: promise
    };
  }

  if (typeof global !== 'undefined') {
    global.Promise.defer = __defer;
  } else if (typeof Promise !== 'undefined') {
    Promise.defer = __defer;
  } else {
    throw new Error("Unable to attach defer method to Promise object.");
  }
}());

