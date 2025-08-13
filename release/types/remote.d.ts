import RemoteStorage from "./remotestorage";
import EventHandling from "./eventhandling";
/**
 * The ancestor for WireClient, GoogleDrive & Dropbox
 */
export declare class RemoteBase extends EventHandling {
    rs: RemoteStorage;
    connected: boolean;
    online: boolean;
    userAddress: string;
    storageApi: string;
    constructor(rs: RemoteStorage);
    stopWaitingForToken(): void;
    addQuotes(str: string): string;
    stripQuotes(str: string): string;
    isForbiddenRequestMethod(method: string, uri: string): boolean;
}
export interface RemoteSettings {
    userAddress?: string;
    href?: string;
    storageApi?: string;
    token?: string | false;
    refreshToken?: string;
    tokenType?: string;
    properties?: object;
}
export interface RemoteResponse {
    statusCode: number;
    body?: string | {
        [key: string]: any;
    };
    contentType?: string;
    revision?: string;
}
/**
 * The public interface for WireClient, GoogleDrive & Dropbox
 */
export interface Remote {
    /**
     * Whether or not a remote store is connected
     */
    connected: boolean;
    /**
     * Whether last sync action was successful or not
     */
    online: boolean;
    /**
     * The user address of the connected user
     */
    userAddress: string;
    /**
     * Holds the spec version the server claims to be compatible with
     *
     * @example
     * ```js
     * remoteStorage.remote.storageApi
     * // 'draft-dejong-remotestorage-12'
     * ```
     *
     * @internal
     */
    storageApi: string;
    /**
     * Holds the server's base URL, as obtained in the Webfinger discovery
     *
     * @example
     * ```js
     * remoteStorage.remote.href
     * // 'https://storage.example.com/users/jblogg/'
     * ```
     *
     * @internal
     */
    href?: string;
    /**
     * The JSON-parsed properties object from the user's WebFinger record
     */
    properties?: object;
    /**
     * OAuth2 client ID
     *
     * @internal
     */
    clientId?: string;
    /**
     * OAuth2 access token
     *
     * @internal
     */
    token?: string | false;
    /**
     * OAuth2 PKCE
     *
     * @internal
     */
    TOKEN_URL?: string;
    configure(settings: any): void;
    configure(settings: RemoteSettings): void;
    /**
     * Initiate the authorization flow's OAuth dance.
     *
     * @internal
     */
    connect?(): void;
    stopWaitingForToken(): void;
    get(path: string, options?: {
        ifMatch?: string;
        ifNoneMatch?: string;
    }): Promise<RemoteResponse>;
    put(path: string, body: XMLHttpRequestBodyInit, contentType: string, options: {
        ifMatch?: string;
        ifNoneMatch?: string;
    }): Promise<RemoteResponse>;
    delete(path: string, options: {
        ifMatch?: string;
    }): Promise<RemoteResponse>;
}
//# sourceMappingURL=remote.d.ts.map