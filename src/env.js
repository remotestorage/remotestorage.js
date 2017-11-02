var eventHandling = require('./eventhandling');

var mode = typeof(window) !== 'undefined' ? 'browser' : 'node',
    env = {},
    isBackground = false;


var Env = function () {
  return env;
};

Env.isBrowser = function () {
  return mode === "browser";
};

Env.isNode = function () {
  return mode === "node";
};

Env.goBackground = function () {
  isBackground = true;
  Env._emit("background");
};

Env.goForeground = function () {
  isBackground = false;
  Env._emit("foreground");
};

Env._rs_init = function (remoteStorage) {
  eventHandling(Env, "background", "foreground");

  function visibility() {
    if (document[env.hiddenProperty]) {
      Env.goBackground();
    } else {
      Env.goForeground();
    }
  }

  if ( mode === 'browser') {
    if ( typeof(document.hidden) !== "undefined" ) {
      env.hiddenProperty = "hidden";
      env.visibilityChangeEvent = "visibilitychange";
    } else if ( typeof(document.mozHidden) !== "undefined" ) {
      env.hiddenProperty = "mozHidden";
      env.visibilityChangeEvent = "mozvisibilitychange";
    } else if ( typeof(document.msHidden) !== "undefined" ) {
      env.hiddenProperty = "msHidden";
      env.visibilityChangeEvent = "msvisibilitychange";
    } else if ( typeof(document.webkitHidden) !== "undefined" ) {
      env.hiddenProperty = "webkitHidden";
      env.visibilityChangeEvent = "webkitvisibilitychange";
    }
    document.addEventListener(env.visibilityChangeEvent, visibility, false);
    visibility();
  }
};

Env._rs_cleanup = function (remoteStorage) {
};


module.exports = Env;
