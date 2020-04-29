const log = require('./log');

// wew use the mixin approach as described here:
// https://mariusschulz.com/blog/mixin-classes-in-typescript
type Constructor<T = {}> = new (...args: any[]) => T;

// TODO add real type for event
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (event?: unknown) => void;

export function eventHandling<TBase extends Constructor>(Base: TBase, additionalEvents: string[] = []) {
  return class extends Base {

    _handlers: { [key: string]: EventHandler[] } = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      log(`[${Base.name}] Registering events`);
      additionalEvents.forEach(evName => this._addEvent(evName));
    }

    /**
     * Install an event handler for the given event name
     */
    addEventListener(eventName: string, handler: EventHandler): void {
      if (typeof (eventName) !== 'string') {
        throw new Error('Argument eventName should be a string');
      }
      if (typeof (handler) !== 'function') {
        throw new Error('Argument handler should be a function');
      }
      log('[Eventhandling] Adding event listener', eventName);
      this._validateEvent(eventName);
      this._handlers[eventName].push(handler);
    }

    on(eventName: string, handler: EventHandler): void {
      return this.addEventListener(eventName, handler);
    }

    /**
     * Remove a previously installed event handler
     */
    removeEventListener(eventName: string, handler: EventHandler): void {
      this._validateEvent(eventName);
      const hl = this._handlers[eventName].length;
      for (let i = 0; i < hl; i++) {
        if (this._handlers[eventName][i] === handler) {
          this._handlers[eventName].splice(i, 1);
          return;
        }
      }
    }

    off(eventName: string, handler): void {
      return this.removeEventListener(eventName, handler);
    }

    _emit(eventName: string, ...args): void {
      this._validateEvent(eventName);
      this._handlers[eventName].slice().forEach((handler) => {
        handler.apply(this, args);
      });
    }

    _validateEvent(eventName: string): void {
      if (!(eventName in this._handlers)) {
        throw new Error("Unknown event: " + eventName);
      }
    }

    _delegateEvent(eventName: string, target): void {
      target.on(eventName, (event) => {
        this._emit(eventName, event);
      });
    }

    _addEvent(eventName: string): void {
      this._handlers[eventName] = [];
    }
  };
}
