/**
 */
export type EventHandler = (event?: unknown) => void;
export declare class EventHandling {
    /**
     * @internal
     */
    _handlers: {
        [key: string]: EventHandler[];
    };
    /**
     * Register event names
     *
     * TODO see if necessary, or can be done on the fly in addEventListener
     *
     * @internal
     */
    addEvents(additionalEvents: string[]): void;
    /**
     * Install an event handler for the given event name
     *
     * Usually called via [`on()`](#on)
     */
    addEventListener(eventName: string, handler: EventHandler): void;
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
    on(eventName: string, handler: EventHandler): void;
    /**
     * Remove a previously installed event handler
     */
    removeEventListener(eventName: string, handler: EventHandler): void;
    /**
     * @internal
     */
    _emit(eventName: string, ...args: unknown[]): void;
    /**
     * @internal
     */
    _validateEvent(eventName: string): void;
    /**
     * @internal
     */
    _delegateEvent(eventName: string, target: any): void;
    /**
     * @internal
     */
    _addEvent(eventName: string): void;
}
export default EventHandling;
//# sourceMappingURL=eventhandling.d.ts.map