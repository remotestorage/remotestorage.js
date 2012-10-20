
var resetDependencies = function() {};
var interceptDependencies = function(counter) {
  var intercepted = null;
  var originalDefine = window.define;
  if(! originalDefine) {
    throw "window.define not found; requirejs not included yet?";
  }
  resetDependencies = function() {
    resetDependencies = function() {};
    var _intercepted = intercepted;
    intercepted = null;
    return _intercepted;
  }
  window.define = function() {
    if(counter == 0) {
      var args = Array.prototype.slice.call(arguments);
      var module = args.pop();
      args.push(function() {
        intercepted = [];
        for(var i=0;i<arguments.length;i++) {
          intercepted.push(arguments[i]);
        }
        return module.apply(this, arguments);
      });
      originalDefine.apply(window, args);
      window.define = originalDefine;
    } else {
      counter--;
      originalDefine.apply(window, arguments);
    }
  }
}
