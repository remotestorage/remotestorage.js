import EventHandling from './eventhandling';
import RevisionCache from './revisioncache';
/**
 * @class
 */
declare class Dropbox {
    rs: any;
    connected: boolean;
    online: boolean;
    clientId: string;
    token: string;
    userAddress: string;
    _initialFetchDone: boolean;
    _revCache: RevisionCache;
    _fetchDeltaCursor: any;
    _fetchDeltaPromise: any;
    _itemRefs: any;
    _emit: any;
    constructor(rs: any);
    /**
     * Set the backed to 'dropbox' and start the authentication flow in order
     * to obtain an API token from Dropbox.
     */
    connect(): void;
    /**
     * Sets the connected flag
     * Accepts its parameters according to the <WireClient>.
     * @param {Object} settings
     * @param {string} [settings.userAddress] - The user's email address
     * @param {string} [settings.token] - Authorization token
     *
     * @protected
     **/
    configure(settings: any): void;
    /**
     * Stop waiting for the token and emit not-connected
     *
     * @protected
     */
    stopWaitingForToken(): void;
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
    _getFolder(path: any): any;
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
    get(path: any, options: any): any;
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed.
     *
     * Compatible with ``WireClient``
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * @param {string} path - path of the folder to put, with leading slash
     * @param {Object} options
     * @param {string} options.ifNoneMatch - Only create of update the file if the
     *                                       current ETag doesn't match this string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    content-type and revision
     * @protected
     */
    put(path: any, body: any, contentType: any, options: any): any;
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
    'delete'(path: any, options: any): any;
    /**
     * Calls share, if the provided path resides in a public folder.
     *
     * @private
     */
    _shareIfNeeded(path: any): void;
    /**
     * Gets a publicly-accessible URL for the path from Dropbox and stores it
     * in ``_itemRefs``.
     *
     * @return {Promise} a promise for the URL
     *
     * @private
     */
    share(path: any): any;
    /**
     * Fetches the user's info from dropbox and returns a promise for it.
     *
     * @return {Promise} a promise for user info object (email - the user's email address)
     *
     * @protected
     */
    info(): any;
    /**
     * Make a network request.
     *
     * @param {string} method - Request method
     * @param {string} url - Target URL
     * @param {object} options - Request options
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _request(method: any, url: any, options: any): any;
    /**
     * Fetches the revision of all the files from dropbox API and puts them
     * into ``_revCache``. These values can then be used to determine if
     * something has changed.
     *
     * @private
     */
    fetchDelta(...args: any[]): any;
    /**
     * Gets metadata for a path (can point to either a file or a folder).
     *
     * @param {string} path - the path to get metadata for
     *
     * @returns {Promise} A promise for the metadata
     *
     * @private
     */
    _getMetadata(path: any): any;
    /**
     * Upload a simple file (the size is no more than 150MB).
     *
     * @param {Object} params
     * @param {string} options.ifMatch - Only update the file if its ETag
     *                                   matches this string
     * @param {string} options.path - path of the file
     * @param {string} options.body - contents of the file to upload
     * @param {string} options.contentType - mime type of the file
     *
     * @return {Promise} A promise for an object with the following structure:
     *         statusCode - HTTP status code
     *         revision - revision of the newly-created file, if any
     *
     * @private
     */
    _uploadSimple(params: any): any;
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
    _deleteSimple(path: any): any;
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
     * @param {object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(rs: any): void;
    /**
     * Inform about the availability of the Dropbox backend.
     *
     * @param {object} rs - RemoteStorage instance
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported(): boolean;
    /**
     * Remove Dropbox as a backend.
     *
     * @param {object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(rs: any): void;
}
interface Dropbox extends EventHandling {
}
export default Dropbox;
