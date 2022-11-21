import EventHandling from './eventhandling';
import { RequestOptions } from "./requests";
import { Remote, RemoteBase, RemoteResponse, RemoteSettings } from "./remote";
/**
 * Internal cache object for storing Google file IDs.
 *
 * @param {number} maxAge - Maximum age (in seconds) the content should be cached for
 */
declare class FileIdCache {
    maxAge: number;
    _items: {};
    constructor(maxAge?: number);
    get(key: any): number | undefined;
    set(key: any, value: any): void;
}
/**
 * @class GoogleDrive
 *
 * To use this backend, you need to specify the app's client ID like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   googledrive: 'your-client-id'
 * });
 *
 * A client ID can be obtained by registering your app in the Google
 * Developers Console: https://console.developers.google.com/flows/enableapi?apiid=drive
 *
 * Docs: https://developers.google.com/drive/v3/web/quickstart/js
**/
declare class GoogleDrive extends RemoteBase implements Remote {
    clientId: string;
    token: string;
    _fileIdCache: FileIdCache;
    constructor(remoteStorage: any, clientId: any);
    /**
     * Configure the Google Drive backend.
     *
     * Fetches the user info from Google when no ``userAddress`` is given.
     *
     * @param {Object} settings
     * @param {string} [settings.userAddress] - The user's email address
     * @param {string} [settings.token] - Authorization token
     *
     * @protected
     */
    configure(settings: RemoteSettings): void;
    /**
     * Initiate the authorization flow's OAuth dance.
     */
    connect(): void;
    /**
     * Request a resource (file or directory).
     *
     * @param {string} path - Path of the resource
     * @param {Object} options - Request options
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body, content-type and revision
     *
     * @protected
     */
    get(path: string, options?: {
        ifNoneMatch?: string;
    }): Promise<RemoteResponse>;
    /**
     * Create or update a file.
     *
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @param {Object} options
     * @param {string} options.ifNoneMatch - Only create of update the file if the
     *                                       current ETag doesn't match this string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    content-type and revision
     *
     * @protected
     */
    put(path: string, body: XMLHttpRequestBodyInit, contentType: string, options?: {
        ifMatch?: string;
        ifNoneMatch?: string;
    }): Promise<RemoteResponse>;
    /**
     * Delete a file.
     *
     * @param {string} path - File path
     * @param {Object} options
     * @param {string} options.ifMatch - only delete the file if it's ETag
     *                                   matches this string
     * @returns {Promise} Resolves with an object containing the status code
     *
     * @protected
     */
    delete(path: string, options?: {
        ifMatch?: string;
    }): Promise<RemoteResponse>;
    /**
     * Fetch the user's info from Google.
     *
     * @returns {Promise} resolves with the user's info.
     *
     * @protected
     */
    info(): Promise<any>;
    /**
     * Update an existing file.
     *
     * @param {string} id - File ID
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @param {Object} options
     * @param {string} options.ifMatch - Only update the file if its ETag
     *                                   matches this string
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _updateFile(id: any, path: any, body: any, contentType: any, options: any): Promise<XMLHttpRequest>;
    /**
     * Create a new file.
     *
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _createFile(path: any, body: any, contentType: any): any;
    /**
     * Request a file.
     *
     * @param {string} path - File path
     * @param {Object} options
     * @param {string} [options.ifNoneMath] - Only return the file if its ETag
     *                                        doesn't match the given string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body, content-type and revision
     *
     * @private
     */
    _getFile(path: any, options: any): any;
    /**
     * Request a directory.
     *
     * @param {string} path - Directory path
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body and content-type
     *
     * @private
     */
    _getFolder(path: string): any;
    /**
     * Get the ID of a parent path.
     *
     * Creates the directory if it doesn't exist yet.
     *
     * @param {string} path - Full path of a directory or file
     * @returns {Promise} Resolves with ID of the parent directory.
     *
     * @private
     */
    _getParentId(path: any): any;
    /**
     * Create a directory.
     *
     * Creates all parent directories as well if any of them didn't exist yet.
     *
     * @param {string} path - Directory path
     * @returns {Promise} Resolves with the ID of the new directory
     *
     * @private
     */
    _createFolder(path: any): any;
    /**
     * Get the ID of a file.
     *
     * @param {string} path - File path
     * @returns {Promise} Resolves with the ID
     *
     * @private
     */
    _getFileId(path: any): any;
    /**
     * Get the metadata for a given file ID.
     *
     * @param {string} id - File ID
     * @returns {Promise} Resolves with an object containing the metadata
     *
     * @private
     */
    _getMeta(id: any): Promise<any>;
    /**
     * Make a network request.
     *
     * @param {string} method - Request method
     * @param {string} url - Target URL
     * @param {Object} options - Request options
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _request(method: string, url: string, options: RequestOptions): Promise<XMLHttpRequest>;
    /**
     * Initialize the Google Drive backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(remoteStorage: any): void;
    /**
     * Inform about the availability of the Google Drive backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported(): boolean;
    /**
     * Remove Google Drive as a backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(remoteStorage: any): void;
}
interface GoogleDrive extends EventHandling {
}
export = GoogleDrive;
//# sourceMappingURL=googledrive.d.ts.map