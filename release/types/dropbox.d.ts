import EventHandling from './eventhandling';
import RevisionCache from './revisioncache';
import { Remote, RemoteBase, RemoteResponse, RemoteSettings } from "./remote";
import RemoteStorage from "./remotestorage";
interface Metadata {
    ".tag": "folder" | "file";
    id: string;
    name: string;
    path_display: string;
    path_lower: string;
    property_groups: any[];
    sharing_info: {
        no_access?: boolean;
        parent_shared_folder_id: string;
        read_only: boolean;
        traverse_only?: boolean;
        modified_by?: string;
    };
    client_modified?: string;
    content_hash?: string;
    file_lock_info?: {
        created: string;
        is_lockholder: boolean;
        lockholder_name: string;
    };
    has_explicit_shared_members?: boolean;
    is_downloadable?: boolean;
    rev?: string;
    server_modified?: string;
    size?: number;
    preview_url?: string;
}
/**
 * @class
 */
declare class Dropbox extends RemoteBase implements Remote {
    clientId: string;
    TOKEN_URL: string;
    token: string;
    refreshToken: string;
    tokenType: string;
    userAddress: string;
    _initialFetchDone: boolean;
    _revCache: RevisionCache;
    _fetchDeltaCursor: string;
    _fetchDeltaPromise: Promise<undefined[]>;
    _itemRefs: {
        [key: string]: string;
    };
    _emit: any;
    constructor(rs: any);
    /**
     * Set the backed to 'dropbox' and start the authentication flow in order
     * to obtain an API token from Dropbox.
     */
    connect(): Promise<void>;
    /**
     * Sets the connected flag
     * Accepts its parameters according to the <WireClient>.
     * @param {Object} settings
     * @param {string} [settings.userAddress] - The user's email address
     * @param {string} [settings.token] - Authorization token
     * @param {string} [settings.refreshToken] - OAuth2 PKCE refresh token
     * @param {string} [settings.tokenType] - usually 'bearer' - no support for 'mac' tokens yet
     *
     * @protected
     **/
    configure(settings: RemoteSettings): Promise<void>;
    /**
     * Get all items in a folder.
     *
     * @param path {string} - path of the folder to get, with leading slash
     * @return {Object}
     *         statusCode - HTTP status code
     *         body - array of the items found
     *         contentType - 'application/json; charset=UTF-8'
     *         revision - revision of the folder
     *
     * @private
     */
    _getFolder(path: string): Promise<{
        statusCode: number;
        body: any;
        contentType: string;
        revision: string;
    }>;
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed. Calls ``_getFolder`` is the path points to a folder.
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * Compatible with ``WireClient.get``
     *
     * @param path {string} - path of the folder to get, with leading slash
     * @param options {Object}
     *
     * @protected
     */
    get(path: string, options?: {
        ifNoneMatch?: string;
    }): Promise<RemoteResponse>;
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed.
     *
     * Compatible with ``WireClient``
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * @param {string} path - path of the folder to put, with leading slash
     * @param {XMLHttpRequestBodyInit} body - Blob | BufferSource | FormData | URLSearchParams | string
     * @param {string} contentType - MIME type of body
     * @param {Object} options
     * @param {string} options.ifNoneMatch - When *, only create or update the file if it doesn't yet exist
     * @param {string} options.ifMatch - Only saves if this matches current revision
     * @returns {Promise} Resolves with an object containing the status code,
     *                    content-type and revision
     * @protected
     */
    put(path: string, body: any, contentType: string, options?: {
        ifMatch?: string;
        ifNoneMatch?: string;
    }): Promise<RemoteResponse>;
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed.
     *
     * Compatible with ``WireClient.delete``
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * @param {string} path - path of the folder to delete, with leading slash
     * @param {Object} options
     *
     * @protected
     */
    'delete'(path: string, options?: {
        ifMatch?: string;
    }): Promise<RemoteResponse>;
    /**
     * Calls share, if the provided path resides in a public folder.
     * @private
     */
    _shareIfNeeded(path: string): Promise<any>;
    /**
     * Gets a publicly-accessible URL for the path from Dropbox and stores it
     * in ``_itemRefs``.
     *
     * @return {Promise} a promise for the URL
     *
     * @private
     */
    share(path: string): Promise<string>;
    /**
     * Fetches the user's info from dropbox and returns a promise for it.
     *
     * @return {Promise} a promise for user info object (email - the user's email address)
     *
     * @protected
     */
    info(): Promise<{
        email: string;
    }>;
    /**
     * Makes a network request.
     *
     * @param {string} method - Request method
     * @param {string} url - Target URL
     * @param {object} options - Request options
     * @param {number} numAttempts - # of times same request repeated
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _request(method: string, url: string, options: any, numAttempts?: number): Promise<any>;
    /**
     * Fetches the revision of all the files from dropbox API and puts them
     * into ``_revCache``. These values can then be used to determine if
     * something has changed.
     *
     * @private
     */
    fetchDelta(...args: undefined[]): Promise<undefined[]>;
    /**
     * Gets metadata for a path (can point to either a file or a folder).
     *
     * @param {string} path - the path to get metadata for
     *
     * @returns {Promise} A promise for the metadata
     *
     * @private
     */
    _getMetadata(path: string): Promise<Metadata>;
    /**
     * Upload a simple file (the size is no more than 150MB).
     *
     * @param {Object} params
     * @param {string} params.ifMatch - Only update the file if its ETag
     *                                   matches this string
     * @param {string} params.path - path of the file
     * @param {string} params.body - contents of the file to upload
     * @param {string} params.contentType - mime type of the file   *
     * @return {Promise} A promise for an object with the following structure:
     *         statusCode - HTTP status code
     *         revision - revision of the newly-created file, if any
     *
     * @private
     */
    _uploadSimple(params: {
        body: XMLHttpRequestBodyInit;
        contentType?: string;
        path: string;
        ifMatch?: string;
    }): Promise<RemoteResponse>;
    /**
     * Deletes a file or a folder.
     *
     * @param {string} path - the path to delete
     *
     * @returns {Promise} A promise for an object with the following structure:
     *          statusCode - HTTP status code
     *
     * @private
     */
    _deleteSimple(path: string): Promise<RemoteResponse>;
    /**
     * Requests the link for an already-shared file or folder.
     *
     * @param {string} path - path to the file or folder
     *
     * @returns {Promise} A promise for the shared link
     *
     * @private
     */
    _getSharedLink(path: string): Promise<string>;
    /**
     * Initialize the Dropbox backend.
     *
     * @param {object} rs - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(rs: RemoteStorage): void;
    /**
     * Inform about the availability of the Dropbox backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported(): boolean;
    /**
     * Remove Dropbox as a backend.
     *
     * @param {object} rs - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(rs: RemoteStorage): void;
}
interface Dropbox extends EventHandling {
}
export = Dropbox;
//# sourceMappingURL=dropbox.d.ts.map