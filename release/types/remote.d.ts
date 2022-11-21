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
    revision?: string;
    contentType?: string;
    body?: any;
}
/**
 * The public interface for WireClient, GoogleDrive & Dropbox
 */
export interface Remote {
    connected: boolean;
    online: boolean;
    userAddress: string;
    /**
     * Holds the spec version the server claims to be compatible with
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.storageApi
     *   // -> 'draft-dejong-remotestorage-01'
     */
    storageApi: string;
    /**
     * Holds the server's base URL, as obtained in the Webfinger discovery
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.href
     *   // -> 'https://storage.example.com/users/jblogg/'
     */
    href?: string;
    /** the JSON-parsed properties object from the user's WebFinger record */
    properties?: object;
    clientId?: string;
    TOKEN_URL?: string;
    configure(settings: any): void;
    configure(settings: RemoteSettings): void;
    /**
     * Initiate the authorization flow's OAuth dance.
     */
    connect?(): void;
    stopWaitingForToken(): void;
    get(path: string, options: {
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