/**
 * This file exposes a get/put/delete interface on top of fetch() or XMLHttpRequest.
 * It requires to be configured with parameters about the remotestorage server to
 * connect to.
 * Each instance of WireClient is always associated with a single remotestorage
 * server and access token.
 *
 * Usually the WireClient instance can be accessed via `remoteStorage.remote`.
 *
 * This is the get/put/delete interface:
 *
 *   - #get() takes a path and optionally a ifNoneMatch option carrying a version
 *     string to check. It returns a promise that will be fulfilled with the HTTP
 *     response status, the response body, the MIME type as returned in the
 *     'Content-Type' header and the current revision, as returned in the 'ETag'
 *     header.
 *   - #put() takes a path, the request body and a content type string. It also
 *     accepts the ifMatch and ifNoneMatch options, that map to the If-Match and
 *     If-None-Match headers respectively. See the remotestorage-01 specification
 *     for details on handling these headers. It returns a promise, fulfilled with
 *     the same values as the one for #get().
 *   - #delete() takes a path and the ifMatch option as well. It returns a promise
 *     fulfilled with the same values as the one for #get().
 *
 * In addition to this, the WireClient has some compatibility features to work with
 * remotestorage 2012.04 compatible storages. For example it will cache revisions
 * from folder listings in-memory and return them accordingly as the "revision"
 * parameter in response to #get() requests. Similarly it will return 404 when it
 * receives an empty folder listing, to mimic remotestorage-01 behavior. Note
 * that it is not always possible to know the revision beforehand, hence it may
 * be undefined at times (especially for caching-roots).
 */
import RemoteStorage from './remotestorage';
import EventHandling from './eventhandling';
interface WireClientSettings {
    userAddress: string;
    href: string;
    storageApi: string;
    token: string;
    properties: unknown;
}
interface WireRequestResponse {
    statusCode: number;
    revision: string | undefined;
    body?: any;
}
declare class WireClient {
    rs: RemoteStorage;
    connected: boolean;
    online: boolean;
    userAddress: string;
    /**
     * Holds the bearer token of this WireClient, as obtained in the OAuth dance
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.token
     *   // -> 'DEADBEEF01=='
     */
    token: string;
    /**
     * Holds the server's base URL, as obtained in the Webfinger discovery
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.href
     *   // -> 'https://storage.example.com/users/jblogg/'
     */
    href: string;
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
    supportsRevs: boolean;
    _revisionCache: {
        [key: string]: any;
    };
    properties: any;
    constructor(rs: RemoteStorage);
    get storageType(): string;
    _request(method: string, uri: string, token: string | false, headers: object, body: unknown, getEtag: boolean, fakeRevision?: string): Promise<WireRequestResponse>;
    /**
     * Sets the userAddress, href, storageApi, token, and properties of a
     * remote store. Also sets connected and online to true and emits the
     * 'connected' event, if both token and href are present.
     *
     * Parameters:
     *   settings - An object that may contain userAddress (string or null),
     *              href (string or null), storageApi (string or null), token (string
     *              or null), and/or properties (the JSON-parsed properties object
     *              from the user's WebFinger record, see section 10 of
     *              http://tools.ietf.org/html/draft-dejong-remotestorage-03
     *              or null).
     *              Fields that are not included (i.e. `undefined`), stay at
     *              their current value. To set a field, include that field
     *              with a `string` value. To reset a field, for instance when
     *              the user disconnected their storage, or you found that the
     *              token you have has expired, simply set that field to `null`.
     */
    configure(settings: WireClientSettings): void;
    stopWaitingForToken(): void;
    get(path: string, options?: {
        ifNoneMatch?: string;
    }): Promise<unknown>;
    put(path: string, body: unknown, contentType: string, options?: {
        ifMatch?: string;
        ifNoneMatch?: string;
    }): Promise<WireRequestResponse>;
    delete(path: string, options?: {
        ifMatch?: string;
    }): Promise<WireRequestResponse>;
    static isArrayBufferView: any;
    static request(method: string, url: string, options: unknown): Promise<XMLHttpRequest | Response>;
    /** options includes body, headers and responseType */
    static _fetchRequest(method: string, url: string, options: any): Promise<Response>;
    static _xhrRequest(method: any, url: any, options: any): Promise<XMLHttpRequest>;
    static _rs_init(remoteStorage: any): void;
    static _rs_supported(): boolean;
    static _rs_cleanup(): void;
}
interface WireClient extends EventHandling {
}
export default WireClient;
//# sourceMappingURL=wireclient.d.ts.map