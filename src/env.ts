import EventHandling from './eventhandling';
import { applyMixins } from './util';

class Env {
  hiddenProperty: "hidden" | "mozHidden" | "msHidden" | "webkitHidden";
  visibilityChangeEvent: "visibilitychange" | "mozvisibilitychange" | "msvisibilitychange" | "webkitvisibilitychange";
  mode: "browser" | "node";

  constructor() {
    this.addEvents(["background", "foreground"]);

    this.mode = typeof(window) !== 'undefined' ? 'browser' : 'node';

    if (this.mode === 'browser') {
      this.setBrowserPrefixedNames();
      document.addEventListener(this.visibilityChangeEvent, this.setVisibility.bind(this), false);
      this.setVisibility();
    }
  }

  setBrowserPrefixedNames (): void {
    if (this.mode !== 'browser') { return; }

    if (typeof document.hidden !== "undefined") {
      this.hiddenProperty = "hidden";
      this.visibilityChangeEvent = "visibilitychange";
    } else if (typeof document["mozHidden"] !== "undefined") {
      this.hiddenProperty = "mozHidden";
      this.visibilityChangeEvent = "mozvisibilitychange";
    } else if (typeof document["msHidden"] !== "undefined") {
      this.hiddenProperty = "msHidden";
      this.visibilityChangeEvent = "msvisibilitychange";
    } else if (typeof document["webkitHidden"] !== "undefined") {
      this.hiddenProperty = "webkitHidden";
      this.visibilityChangeEvent = "webkitvisibilitychange";
    }
  }

  setVisibility (): void {
    if (document[this.hiddenProperty]) {
      this.goBackground();
    } else {
      this.goForeground();
    }
  }

  isBrowser (): boolean {
    return this.mode === "browser";
  }

  isNode (): boolean {
    return this.mode === "node";
  }

  goBackground (): void {
    this._emit("background");
  }

  goForeground (): void {
    this._emit("foreground");
  }

  static _rs_init (/* remoteStorage */): void {
    return;
  }

  static _rs_cleanup (/* remoteStorage */): void {
    return;
  }
}

interface Env extends EventHandling {}
applyMixins(Env, [EventHandling]);

export = Env;
