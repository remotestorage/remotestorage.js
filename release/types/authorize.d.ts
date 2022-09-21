import RemoteStorage from './remotestorage';
interface AuthOptions {
    authURL: string;
    scope?: string;
    clientId?: string;
    redirectUri?: string;
}
interface AuthResult {
    access_token?: string;
    rsDiscovery?: object;
    error?: string;
    remotestorage?: string;
    state?: string;
}
declare class Authorize {
    static IMPLIED_FAKE_TOKEN: boolean;
    static authorize(remoteStorage: RemoteStorage, { authURL, scope, redirectUri, clientId }: AuthOptions): void;
    /**
     * Get current document location
     *
     * Override this method if access to document.location is forbidden
     */
    static getLocation: () => Location;
    /**
     * Open new InAppBrowser window for OAuth in Cordova
     */
    static openWindow: (url: string, redirectUri: string, options: string) => Promise<AuthResult | string | void>;
    /**
     * Set current document location
     *
     * Override this method if access to document.location is forbidden
     */
    static setLocation(location: string | Location): void;
    static _rs_supported(): boolean;
    static _rs_init: (remoteStorage: RemoteStorage) => void;
    static _rs_cleanup(remoteStorage: RemoteStorage): void;
}
export = Authorize;
//# sourceMappingURL=authorize.d.ts.map