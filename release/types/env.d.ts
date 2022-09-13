import EventHandling from './eventhandling';
declare class Env {
    hiddenProperty: "hidden" | "mozHidden" | "msHidden" | "webkitHidden";
    visibilityChangeEvent: "visibilitychange" | "mozvisibilitychange" | "msvisibilitychange" | "webkitvisibilitychange";
    mode: "browser" | "node";
    constructor();
    setBrowserPrefixedNames(): void;
    setVisibility(): void;
    isBrowser(): boolean;
    isNode(): boolean;
    goBackground(): void;
    goForeground(): void;
    static _rs_init(): void;
    static _rs_cleanup(): void;
}
interface Env extends EventHandling {
}
export = Env;
//# sourceMappingURL=env.d.ts.map