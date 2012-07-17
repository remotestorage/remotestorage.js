

// FIXME: global for now, to work with modules.
window.util = {

  bindContext: function bindContext(callback, context) {
    if(context) {
      return function() { return callback.apply(context, arguments); };
    } else {
      return callback;
    }
  }

}


define('util', function() {
  return window.util;
});

