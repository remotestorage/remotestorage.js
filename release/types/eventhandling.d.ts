import { EventHandler } from './interfaces/event_handling';
declare class EventHandling {
    _handlers: {
        [key: string]: EventHandler[];
    };
    /**
     * Register event names
     *
     * TODO see if necessary, or can be done on the fly in addEventListener
     */
    addEvents(additionalEvents: string[]): void;
    /**
     * Install an event handler for the given event name
     */
    addEventListener(eventName: string, handler: EventHandler): void;
    on(eventName: string, handler: EventHandler): void;
    /**
     * Remove a previously installed event handler
     */
    removeEventListener(eventName: string, handler: EventHandler): void;
    _emit(eventName: string, ...args: unknown[]): void;
    _validateEvent(eventName: string): void;
    _delegateEvent(eventName: string, target: any): void;
    _addEvent(eventName: string): void;
}
export = EventHandling;
//# sourceMappingURL=eventhandling.d.ts.map