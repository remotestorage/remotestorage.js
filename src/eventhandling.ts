import log from './log';

/**
 */
export type EventHandler = (event?: unknown) => void;

export class EventHandling {
  /**
   * @internal
   */
  _handlers: { [key: string]: EventHandler[] };

  /**
   * Register event names
   *
   * TODO see if necessary, or can be done on the fly in addEventListener
   *
   * @internal
   */
  addEvents(additionalEvents: string[]): void {
    additionalEvents.forEach(evName => this._addEvent(evName));
  }

  /**
   * Install an event handler for the given event name
   *
   * Usually called via {@link on}
   */
  addEventListener (eventName: string, handler: EventHandler): void {
    // Check type for public consumption of API
    if (typeof (eventName) !== 'string') {
      throw new Error('Argument eventName should be a string');
    }
    if (typeof (handler) !== 'function') {
      throw new Error('Argument handler should be a function');
    }
    log('[EventHandling] Adding event listener', eventName);
    this._validateEvent(eventName);
    this._handlers[eventName].push(handler);
  }

  /**
   * Register an event handler for the given event name
   *
   * Alias for {@link addEventListener}
   *
   * @param eventName - Name of the event
   * @param handler - Function to handle the event
   *
   * @example
   * remoteStorage.on('connected', function() {
   *   console.log('storage account has been connected');
   * });
   */
  on (eventName: string, handler: EventHandler): void {
    return this.addEventListener(eventName, handler);
  }

  /**
   * Remove a previously installed event handler
   */
  removeEventListener (eventName: string, handler: EventHandler): void {
    this._validateEvent(eventName);
    const hl = this._handlers[eventName].length;
    for (let i = 0; i < hl; i++) {
      if (this._handlers[eventName][i] === handler) {
        this._handlers[eventName].splice(i, 1);
        return;
      }
    }
  }

  /**
   * @internal
   */
  _emit (eventName: string, ...args: unknown[]): void {
    this._validateEvent(eventName);
    this._handlers[eventName].slice().forEach((handler) => {
      handler.apply(this, args);
    });
  }

  /**
   * @internal
   */
  _validateEvent (eventName: string): void {
    if (!(eventName in this._handlers)) {
      throw new Error("Unknown event: " + eventName);
    }
  }

  /**
   * @internal
   */
  _delegateEvent (eventName: string, target): void {
    target.on(eventName, (event) => {
      this._emit(eventName, event);
    });
  }

  /**
   * @internal
   */
  _addEvent (eventName: string): void {
    if (typeof this._handlers === 'undefined') {
      this._handlers = {};
    }
    this._handlers[eventName] = [];
  }
}

export default EventHandling;
