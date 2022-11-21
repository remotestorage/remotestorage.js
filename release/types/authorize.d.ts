import RemoteStorage from './remotestorage';
import { AuthorizeOptions } from "./interfaces/authorize_options";
import { Remote } from "./remote";
interface AuthResult {
    access_token?: string;
    refresh_token?: string;
    code?: string;
    rsDiscovery?: object;
    error?: string;
    remotestorage?: string;
    state?: string;
}
declare class Authorize {
    static IMPLIED_FAKE_TOKEN: boolean;
    /**
     * Navigates browser to provider's OAuth page. When user grants access,
     * browser will navigate back to redirectUri and OAuth will continue
     * with onFeaturesLoaded.
     */
    static authorize(remoteStorage: RemoteStorage, options: AuthorizeOptions): void;
    /** On success, calls remote.configure() with new access token */
    static refreshAccessToken(rs: RemoteStorage, remote: Remote, refreshToken: string): Promise<void>;
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