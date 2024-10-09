import RemoteStorage from './remotestorage';
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
export interface AuthorizeOptions {
    /** URL of the authorization endpoint */
    authURL: string;
    /** access scope */
    scope?: string;
    redirectUri?: string;
    /**
    * client identifier
    * @defaultValue Origin of the redirectUri
    * */
    clientId?: string;
    response_type?: 'token' | 'code';
    state?: string;
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
    token_access_type?: 'online' | 'offline';
}
export declare class Authorize {
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
export default Authorize;
//# sourceMappingURL=authorize.d.ts.map