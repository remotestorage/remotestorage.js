/**
 * @interface ConfigObserver
 * 
 * This interface is used by the ConfingStorage inside the Solid backend. The
 * purpose is to be notified when the Solid session information need to be
 * stored.
 */
export interface ConfigObserver {
    onConfigChanged(config: string): void;
}