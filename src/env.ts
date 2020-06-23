const eventHandling = require('./eventhandling');

const mode = typeof(window) !== 'undefined' ? 'browser' : 'node';

// TODO check if engine prefix is still necessary
interface Env {
  hiddenProperty?: "hidden" | "mozHidden" | "msHidden" | "webkitHidden";
  visibilityChangeEvent?: "visibilitychange" | "mozvisibilitychange" | "msvisibilitychange" | "webkitvisibilitychange";
}

const env: Env = {};

const Env = function (): Env {
  return env;
};

function setBrowserPrefixedNames (obj: Env): void {
  if (mode !== 'browser') { return; }

  if (typeof document.hidden !== "undefined") {
    obj.hiddenProperty = "hidden";
    obj.visibilityChangeEvent = "visibilitychange";
  } else if (typeof document["mozHidden"] !== "undefined") {
    obj.hiddenProperty = "mozHidden";
    obj.visibilityChangeEvent = "mozvisibilitychange";
  } else if (typeof document["msHidden"] !== "undefined") {
    obj.hiddenProperty = "msHidden";
    obj.visibilityChangeEvent = "msvisibilitychange";
  } else if (typeof document["webkitHidden"] !== "undefined") {
    obj.hiddenProperty = "webkitHidden";
    obj.visibilityChangeEvent = "webkitvisibilitychange";
  }
}

function setVisibility (): void {
  if (document[env.hiddenProperty]) {
    Env.goBackground();
  } else {
    Env.goForeground();
  }
}

// TODO Only fixes the TS compiler not knowing about mixed in functions.
// Remove when eventhandling is refactored with TypeScript
Env._emit = null;
Env.on = null;

Env.isBrowser = function (): boolean {
  return mode === "browser";
};

Env.isNode = function (): boolean {
  return mode === "node";
};

Env.goBackground = function (): void {
  Env._emit("background");
};

Env.goForeground = function (): void {
  Env._emit("foreground");
};

Env._rs_init = function (/* remoteStorage */): void {
  eventHandling(Env, "background", "foreground");

  if (mode === 'browser') {
    setBrowserPrefixedNames(env);
    document.addEventListener(env.visibilityChangeEvent, setVisibility, false);
    setVisibility();
  }
};

Env._rs_cleanup = function (/* remoteStorage */): void {
  return;
};

export default Env;
module.exports = Env;
