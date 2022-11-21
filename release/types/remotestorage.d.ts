import Authorize from './authorize';
import BaseClient from './baseclient';
import Caching from './caching';
import IndexedDB from './indexeddb';
import InMemoryStorage from './inmemorystorage';
import LocalStorage from './localstorage';
import EventHandling from './eventhandling';
import GoogleDrive from './googledrive';
import Dropbox from './dropbox';
import SyncError from './sync-error';
import UnauthorizedError from './unauthorized-error';
import { Remote } from "./remote";
import * as util from './util';
import { AuthorizeOptions } from "./interfaces/authorize_options";
interface RSModule {
    name: string;
    builder: any;
}
/**
 * Constructor for the remoteStorage object/instance
 *
 * This class primarily contains feature detection code and convenience API.
 *
 * Depending on which features are built in, it contains different attributes
 * and functions. See the individual features for more information.
 *
 * @param {object} config - an optional configuration object
 * @class
 */
declare class RemoteStorage {
    /**
     * Pending get/put/delete calls
     * @private
     */
    _pending: {
        [key: string]: any;
    }[];
    /**
     * TODO: document
     */
    _cleanups: [];
    /**
     * TODO: document
     */
    _pathHandlers: {
        [key: string]: any;
    };
    /**
     * Holds OAuth app keys for Dropbox, Google Drive
     */
    apiKeys: {
        googledrive?: {
            clientId: string;
        };
        dropbox?: {
            appKey: string;
        };
    };
    /**
     * Holds the feature class instance, added by feature initialization
     * TODO use type Access
     */
    access: any;
    /**
     * Holds the feature class instance, added by feature initialization
     * TODO use type Sync
     */
    sync: any;
    /**
     * Holds the feature class instance, added by feature initialization
     */
    caching: Caching;
    _syncTimer: any;
    syncStopped: any;
    get: any;
    put: any;
    delete: any;
    backend: 'remotestorage' | 'dropbox' | 'googledrive';
    /**
     * Holds a WireClient, GoogleDrive or Dropbox instance, added by feature initialization
     */
    remote: Remote;
    local: IndexedDB | LocalStorage | InMemoryStorage;
    dropbox: Dropbox;
    googledrive: GoogleDrive;
    fireInitial: any;
    on: any;
    constructor(cfg?: object);
    /**
     * Indicating if remoteStorage is currently connected.
     */
    get connected(): boolean;
    static Authorize: typeof Authorize;
    static SyncError: typeof SyncError;
    static Unauthorized: typeof UnauthorizedError;
    static DiscoveryError: (message: any) => void;
    static util: typeof util;
    /**
     * Load all modules passed as arguments
     * @private
     */
    loadModules(): void;
    /**
     * Initiate the OAuth authorization flow.
     *
     * This function is called by custom storage backend implementations
     * (e.g. Dropbox or Google Drive).
     *
     * @param {object} options
     * @param {string} options.authURL - URL of the authorization endpoint
     * @param {string} [options.scope] - access scope
     * @param {string} [options.clientId] - client identifier (defaults to the
     *                                      origin of the redirectUri)
     * @private
     */
    authorize(options: AuthorizeOptions): void;
    /**
     * TODO: document
     * @private
     */
    impliedauth(storageApi?: string, redirectUri?: string): void;
    /**
     * @property {object} remote
     *
     * Depending on the chosen backend, this is either an instance of ``WireClient``,
     * ``Dropbox`` or ``GoogleDrive``.
     *
     * @property {boolean} remote.connected - Whether or not a remote store is connected
     * @property {boolean} remote.online - Whether last sync action was successful or not
     * @property {string} remote.userAddress - The user address of the connected user
     * @property {string} remote.properties - The properties of the WebFinger link
     */
    /**
     * Connect to a remoteStorage server.
     *
     * Discovers the WebFinger profile of the given user address and initiates
     * the OAuth dance.
     *
     * This method must be called *after* all required access has been claimed.
     * When using the connect widget, it will call this method itself.
     *
     * Special cases:
     *
     * 1. If a bearer token is supplied as second argument, the OAuth dance
     *    will be skipped and the supplied token be used instead. This is
     *    useful outside of browser environments, where the token has been
     *    acquired in a different way.
     *
     * 2. If the Webfinger profile for the given user address doesn't contain
     *    an auth URL, the library will assume that client and server have
     *    established authorization among themselves, which will omit bearer
     *    tokens in all requests later on. This is useful for example when using
     *    Kerberos and similar protocols.
     *
     * @param {string} userAddress - The user address (user@host) or URL to connect to.
     * @param {string} token       - (optional) A bearer token acquired beforehand
     */
    connect(userAddress: string, token?: string): void;
    /**
     * Reconnect the remote server to get a new authorization.
     */
    reconnect(): void;
    /**
     * "Disconnect" from remote server to terminate current session.
     *
     * This method clears all stored settings and deletes the entire local
     * cache.
     */
    disconnect(): void;
    /**
     * TODO: document
     * @private
     */
    setBackend(what: any): void;
    /**
     * Add a "change" event handler to the given path. Whenever a "change"
     * happens (as determined by the backend, such as e.g.
     * <RemoteStorage.IndexedDB>) and the affected path is equal to or below the
     * given 'path', the given handler is called.
     *
     * You should usually not use this method directly, but instead use the
     * "change" events provided by :doc:`BaseClient </js-api/base-client>`
     *
     * @param {string} path - Absolute path to attach handler to
     * @param {function} handler - Handler function
     */
    onChange(path: string, handler: any): void;
    /**
     * TODO: do we still need this, now that we always instantiate the prototype?
     *
     * Enable remoteStorage logging.
     */
    enableLog(): void;
    /**
     * TODO: do we still need this, now that we always instantiate the prototype?
     *
     * Disable remoteStorage logging
     */
    disableLog(): void;
    /**
     * log
     *
     * The same as <RemoteStorage.log>.
     */
    log(...args: any[]): void;
    /**
     * Set the OAuth key/ID for either GoogleDrive or Dropbox backend support.
     *
     * @param {Object} apiKeys - A config object with these properties:
     * @param {string} [apiKeys.type] - Backend type: 'googledrive' or 'dropbox'
     * @param {string} [apiKeys.key] - Client ID for GoogleDrive, or app key for Dropbox
     */
    setApiKeys(apiKeys: {
        [key in ApiKeyType]?: string;
    }): void | boolean;
    /**
     * Set redirect URI to be used for the OAuth redirect within the
     * in-app-browser window in Cordova apps.
     *
     * @param uri - A valid HTTP(S) URI
     */
    setCordovaRedirectUri(uri: string): void;
    _init: () => void;
    features: any[];
    loadFeature: (featureName: any) => void;
    featureSupported: (featureName: any, success: any) => void;
    featureDone: () => void;
    featuresDone: number;
    featuresLoaded: () => void;
    featureInitialized: (featureName: any) => void;
    featureFailed: (featureName: any, err: any) => void;
    hasFeature: (feature: any) => any;
    _setCachingModule: () => void;
    _collectCleanupFunctions: () => void;
    _fireReady: () => void;
    initFeature: (featureName: any) => void;
    /**
     * TODO: document
     * @private
     */
    _setGPD(impl: any, context?: any): void;
    /**
     * TODO: document
     * @private
     */
    _pendingGPD(methodName: any): () => Promise<unknown>;
    /**
     * TODO: document
     * @private
     */
    _processPending(): void;
    /**
     * TODO: document
     * @private
     */
    _bindChange(object: {
        on: any;
    }): void;
    /**
     * TODO: document
     * @private
     */
    _dispatchEvent(eventName: string, event: any): void;
    /**
     * This method enables you to quickly instantiate a BaseClient, which you can
     * use to directly read and manipulate data in the connected storage account.
     *
     * Please use this method only for debugging and development, and choose or
     * create a :doc:`data module </data-modules>` for your app to use.
     *
     * @param path - The base directory of the BaseClient that will be returned
     *               (with a leading and a trailing slash)
     *
     * @returns A client with the specified scope (category/base directory)
     */
    scope(path: string): BaseClient;
    /**
     * Get the value of the sync interval when application is in the foreground
     *
     * @returns {number} A number of milliseconds
     */
    getSyncInterval(): number;
    /**
     * Set the value of the sync interval when application is in the foreground
     *
     * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
     */
    setSyncInterval(interval: number): void;
    /**
     * Get the value of the sync interval when application is in the background
     *
     * @returns A number of milliseconds
     */
    getBackgroundSyncInterval(): number;
    /**
     * Set the value of the sync interval when the application is in the
     * background
     *
     * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
     */
    setBackgroundSyncInterval(interval: number): void;
    /**
     * Get the value of the current sync interval. Can be background or
     * foreground, custom or default.
     *
     * @returns {number} A number of milliseconds
     */
    getCurrentSyncInterval(): number;
    /**
     * Get the value of the current network request timeout
     *
     * @returns {number} A number of milliseconds
     */
    getRequestTimeout(): number;
    /**
     * Set the timeout for network requests.
     *
     * @param timeout - Timeout in milliseconds
     */
    setRequestTimeout(timeout: number): void;
    /**
     * TODO: document
     * @private
     */
    syncCycle(): void;
    /**
     * Start synchronization with remote storage, downloading and uploading any
     * changes within the cached paths.
     *
     * Please consider: local changes will attempt sync immediately, and remote
     * changes should also be synced timely when using library defaults. So
     * this is mostly useful for letting users sync manually, when pressing a
     * sync button for example. This might feel safer to them sometimes, esp.
     * when shifting between offline and online a lot.
     *
     * @returns {Promise} A Promise which resolves when the sync has finished
     */
    startSync(): Promise<void>;
    /**
     * Stop the periodic synchronization.
     */
    stopSync(): void;
    addModule(module: RSModule): void;
    /**
     * Load module
     * @private
     */
    _loadModule(moduleName: string, moduleBuilder: any): {
        [key: string]: unknown;
    };
}
interface RemoteStorage extends EventHandling {
}
declare enum ApiKeyType {
    GOOGLE = "googledrive",
    DROPBOX = "dropbox"
}
export = RemoteStorage;
//# sourceMappingURL=remotestorage.d.ts.map