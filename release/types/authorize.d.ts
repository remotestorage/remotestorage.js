interface AuthOptions {
    authURL: string;
    scope?: string;
    clientId?: string;
    redirectUri?: string;
}
declare class Authorize {
    static IMPLIED_FAKE_TOKEN: boolean;
    static authorize(remoteStorage: any, { authURL, scope, redirectUri, clientId }: AuthOptions): void;
    /**
     * Get current document location
     *
     * Override this method if access to document.location is forbidden
     */
    static getLocation: () => Location;
    /**
     * Open new InAppBrowser window for OAuth in Cordova
     */
    static openWindow: (url: any, redirectUri: any, options: any) => Promise<any>;
    /**
     * Set current document location
     *
     * Override this method if access to document.location is forbidden
     */
    static setLocation(location: string | Location): void;
    static _rs_supported(): boolean;
    static _rs_init: (remoteStorage: any) => void;
    static _rs_cleanup(remoteStorage: any): void;
}
export = Authorize;
//# sourceMappingURL=authorize.d.ts.map