import Access from './access';
import BaseClient from './baseclient';
import Caching from './caching';
import IndexedDB from './indexeddb';
import InMemoryStorage from './inmemorystorage';
import LocalStorage from './localstorage';
import { EventHandling, EventHandler } from './eventhandling';
import GoogleDrive from './googledrive';
import Dropbox from './dropbox';
import SyncError from './sync-error';
import UnauthorizedError from './unauthorized-error';
import { Remote } from "./remote";
import type { AuthorizeOptions } from './authorize';
import type { Sync } from './sync';
import * as util from './util';
/**
 * Represents a data module
 *
 * @example
 * ```js
 * {
 *   name: 'examples',
 *   builder: function(privateClient, publicClient) {
 *     return {
 *       exports: {
 *         addItem(item): function() {
 *           // Generate a random ID/path
 *           const path = [...Array(10)].map(() => String.fromCharCode(Math.floor(Math.random() * 95) + 32)).join('');
 *           // Store the object, and ensure it conforms to the JSON Schema
 *           // type `example-item`
 *           privateClient.storeObject('example-item', path, item);
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */
export interface RSModule {
    /**
     * The module's name, which is also the category (i.e. base folder) for document URLs on the remote storage
     */
    name: string;
    /**
     * A module builder function, which defines the actual module
     */
    builder: (privateClient: BaseClient, publicClient: BaseClient) => {
        exports: {
            [key: string]: any;
        };
    };
}
declare enum ApiKeyType {
    GOOGLE = "googledrive",
    DROPBOX = "dropbox"
}
/**
 * Create a `remoteStorage` class instance so:
 *
 * ```js
 * const remoteStorage = new RemoteStorage();
 * ```
 *
 * The constructor can optionally be called with a configuration object. This
 * example shows all default values:
 *
 * ```js
 * const remoteStorage = new RemoteStorage({
 *   cache: true,
 *   changeEvents: {
 *     local:    true,
 *     window:   false,
 *     remote:   true,
 *     conflict: true
 *   },
 *   cordovaRedirectUri: undefined,
 *   logging: false,
 *   modules: []
 * });
 * ```
 *
 * > [!NOTE]
 * > In the current version, it is only possible to use a single `remoteStorage`
 * > instance. You cannot connect to two different remotes in parallel yet.
 * > We intend to support this eventually.
 *
 * > [!TIP]
 * > For the change events configuration, you have to set all events
 * > explicitly.  Otherwise it disables the unspecified ones.
 *
 * ## Events
 *
 * You can add event handlers to your `remoteStorage` instance by using the
 * {@link on} function. For example:
 *
 * ```js
 * remoteStorage.on('connected', function() {
 *   // Storage account has been connected, let’s roll!
 * });
 * ```
 *
 * ### `ready`
 *
 * Emitted when all features are loaded and the RS instance is ready to be used
 * in your app
 *
 * ### `not-connected`
 *
 * Emitted when ready, but no storage connected ("anonymous mode")
 *
 * > [!NOTE]
 * > In non-browser environments, this will always be emitted (before any
 * > potential `connected` events after)
 *
 * ### `connected`
 *
 * Emitted when a remote storage has been connected
 *
 * ### `disconnected`
 *
 * Emitted after disconnect
 *
 * ### `error`
 *
 * Emitted when an error occurs; receives an error object as argument
 *
 * There are a handful of known errors, which are identified by the `name`
 * property of the error object:
 *
 * * `Unauthorized`
 *
 *   Emitted when a network request resulted in a 401 or 403 response. You can
 *   use this event to handle invalid OAuth tokens in custom UI (i.e. when a
 *   stored token has been revoked or expired by the RS server).
 *
 * * `DiscoveryError`
 *
 *   A variety of storage discovery errors, e.g. from user address input
 *   validation, or user address lookup issues
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('error', err => console.log(err));
 *
 * // {
 * //   name: "Unauthorized",
 * //   message: "App authorization expired or revoked.",
 * //   stack: "Error↵  at new a.Unauthorized (vendor.js:65710:41870)"
 * // }
 * ```
 *
 * ### `connecting`
 *
 * Emitted before webfinger lookup
 *
 * ### `authing`
 *
 * Emitted before redirecting to the OAuth server
 *
 * ### `wire-busy`
 *
 * Emitted when a network request starts
 *
 * ### `wire-done`
 *
 * Emitted when a network request completes
 *
 * ### `sync-started`
 *
 * Emitted when a sync procedure has started.
 *
 * ### `sync-req-done`
 *
 * Emitted when a single sync request has finished. Callback functions
 * receive an object as argument, informing the client of remaining items
 * in the current sync task queue.
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('sync-req-done', result => console.log(result));
 * // { tasksRemaining: 21 }
 * ```
 *
 * > [!NOTE]
 * > The internal task queue holds at most 100 items at the same time,
 * > regardless of the overall amount of items to sync. Therefore, this number
 * > is only an indicator of sync status, not a precise amount of items left
 * > to sync. It can be useful to determine if your app should display any
 * > kind of sync status/progress information for the cycle or not.
 *
 * ### `sync-done`
 *
 * Emitted when a sync cycle has been completed and a new sync is scheduled.
 *
 * The callback function receives an object as argument, informing the client
 * if the sync process has completed successfully or not.
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('sync-done', result => console.log(result));
 * // { completed: true }
 * ```
 *
 * If `completed` is `false`, it means that some of the sync requests have
 * failed and will be retried in the next sync cycle (usually a few seconds
 * later in this case). This is not an unusual scenario on mobile networks or
 * when doing a large initial sync for example.
 *
 * For an app's user interface, you may want to consider the sync process as
 * ongoing in this case, and wait until your app sees a positive `completed`
 * status before updating the UI.
 *
 * ### `network-offline`
 *
 * Emitted once when a wire request fails for the first time, and
 * `remote.online` is set to false
 *
 * ### `network-online`
 *
 * Emitted once when a wire request succeeds for the first time after a failed
 * one, and `remote.online` is set back to true
 *
 * ### `sync-interval-change`
 *
 * Emitted when the sync interval changes
 */
export declare class RemoteStorage {
    /**
     * Pending get/put/delete calls
     * @internal
     */
    _pending: {
        [key: string]: any;
    }[];
    /**
     * TODO: document
     * @internal
     */
    _cleanups: [];
    /**
     * TODO: document
     * @internal
     */
    _pathHandlers: {
        [key: string]: any;
    };
    /**
     * Holds OAuth app keys for Dropbox, Google Drive
     * @internal
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
     * Managing claimed access scopes
     */
    access: Access;
    /**
     * Managing cache settings
     */
    caching: Caching;
    /**
     * @internal
     */
    sync: Sync;
    /**
     * @internal
     */
    _syncTimer: any;
    /**
     * @internal
     */
    syncStopped: boolean;
    /**
     * @internal
     */
    get: Function;
    /**
     * @internal
     */
    put: Function;
    /**
     * @internal
     */
    delete: Function;
    /**
     */
    backend: 'remotestorage' | 'dropbox' | 'googledrive';
    /**
     * Depending on the chosen backend, this is either an instance of `WireClient`,
     * `Dropbox` or `GoogleDrive`.
     *
     * See {@link Remote} for public API
     *
     * @example
     * remoteStorage.remote.connected
     * // false
     */
    remote: Remote;
    /**
     * Access to the local caching backend used. Usually either a
     * `RemoteStorage.IndexedDB` or `RemoteStorage.LocalStorage` instance.
     *
     * Not available when caching is turned off.
     *
     * @internal
     */
    local: IndexedDB | LocalStorage | InMemoryStorage;
    /**
     * @internal
     */
    dropbox: Dropbox;
    /**
     * @internal
     */
    googledrive: GoogleDrive;
    /**
     * @internal
     */
    fireInitial: Function;
    constructor(cfg?: object);
    /**
     * Indicating if remoteStorage is currently connected.
     */
    get connected(): boolean;
    static SyncError: typeof SyncError;
    static Unauthorized: typeof UnauthorizedError;
    static DiscoveryError: (message: any) => void;
    static util: typeof util;
    /**
     * Load all modules passed as arguments
     *
     * @internal
     */
    loadModules(): void;
    /**
     * Initiate the OAuth authorization flow.
     *
     * @internal
     */
    authorize(options: AuthorizeOptions): void;
    /**
     * TODO: document
     * @internal
     */
    impliedauth(storageApi?: string, redirectUri?: string): void;
    /**
     * Connect to a remoteStorage server.
     *
     * Discovers the WebFinger profile of the given user address and initiates
     * the OAuth dance.
     *
     * This method must be called *after* all required access has been claimed.
     * When using the connect widget, it will call this method when the user
     * clicks/taps the "connect" button.
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
     * @param userAddress - The user address (user@host) or URL to connect to.
     * @param token       - (optional) A bearer token acquired beforehand
     *
     * @example
     * remoteStorage.connect('user@example.com');
     */
    connect(userAddress: string, token?: string): void;
    /**
     * Reconnect the remote server to get a new authorization.
     *
     * Useful when not using the connect widget and encountering an
     * `Unauthorized` event.
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
     * @internal
     */
    setBackend(backendType: 'remotestorage' | 'dropbox' | 'googledrive'): void;
    /**
     * Add a `change` event handler for the given path. Whenever a change
     * happens (as determined by the local backend, such as e.g.
     * `RemoteStorage.IndexedDB`), and the affected path is equal to or below the
     * given 'path', the given handler is called.
     *
     * > [!TIP]
     * > You should usually not use this method, but instead use the
     * > `change` events provided by {@link BaseClient}.
     *
     * @param path - Absolute path to attach handler to
     * @param handler - A function to handle the change
     *
     * @example
     * remoteStorage.onChange('/bookmarks/', function() {
     *   // your code here
     * })
     */
    onChange(path: string, handler: EventHandler): void;
    /**
     * Enable remoteStorage debug logging.
     *
     * Usually done when instantiating remoteStorage:
     *
     * ```js
     * const remoteStorage = new RemoteStorage({ logging: true });
     * ```
     */
    enableLog(): void;
    /**
     * Disable remoteStorage debug logging
     */
    disableLog(): void;
    /**
     * Log something to the debug log
     *
     * @internal
     */
    log(...args: any[]): void;
    /**
     * Set the OAuth key/ID for GoogleDrive and/or Dropbox backend support.
     *
     * @param apiKeys - A config object
     *
     * @example
     * remoteStorage.setApiKeys({
     *   dropbox: 'your-app-key',
     *   googledrive: 'your-client-id'
     * });
     */
    setApiKeys(apiKeys: {
        [key in ApiKeyType]?: string;
    }): void | boolean;
    /**
     * Set redirect URI to be used for the OAuth redirect within the
     * in-app-browser window in Cordova apps. See
     * [Usage in Cordova apps](../../../cordova) for details.
     *
     * @param uri - A valid HTTP(S) URI
     *
     * @example
     * remoteStorage.setCordovaRedirectUri('https://app.example.com');
     */
    setCordovaRedirectUri(uri: string): void;
    /**
     * @internal
     */
    _init: () => void;
    /**
     * @internal
     */
    features: any[];
    /**
     * @internal
     */
    loadFeature: (featureName: any) => void;
    /**
     * @internal
     */
    featureSupported: (featureName: any, success: any) => void;
    /**
     * @internal
     */
    featureDone: () => void;
    /**
     * @internal
     */
    featuresDone: number;
    /**
     * @internal
     */
    featuresLoaded: () => void;
    /**
     * @internal
     */
    featureInitialized: (featureName: any) => void;
    /**
     * @internal
     */
    featureFailed: (featureName: any, err: any) => void;
    /**
     * @internal
     */
    hasFeature: (feature: any) => any;
    /**
     * @internal
     */
    _setCachingModule: () => void;
    /**
     * @internal
     */
    _collectCleanupFunctions: () => void;
    /**
     * @internal
     */
    _fireReady: () => void;
    /**
     * @internal
     */
    initFeature: (featureName: any) => void;
    /**
     * TODO: document
     * @internal
     */
    _setGPD(impl: any, context?: any): void;
    /**
     * TODO: document
     * @internal
     */
    _pendingGPD(methodName: any): () => Promise<unknown>;
    /**
     * TODO: document
     * @internal
     */
    _processPending(): void;
    /**
     * TODO: document
     * @internal
     */
    _bindChange(object: {
        on: any;
    }): void;
    /**
     * TODO: document
     * @internal
     */
    _dispatchEvent(eventName: string, event: any): void;
    /**
     * This method allows you to quickly instantiate a BaseClient, which you can
     * use to directly read and manipulate data in the connected storage account.
     *
     * Please use this method only for debugging and development, and choose or
     * create a [data module](../../../data-modules/) for your app to use.
     *
     * @param path - The base directory of the BaseClient that will be returned
     *               (with a leading and a trailing slash)
     *
     * @returns A client with the specified scope (category/base directory)
     *
     * @example
     * remoteStorage.scope('/pictures/').getListing('');
     * remoteStorage.scope('/public/pictures/').getListing('');
     */
    scope(path: string): BaseClient;
    /**
     * Get the value of the sync interval when application is in the foreground
     *
     * @returns A number of milliseconds
     *
     * @example
     * remoteStorage.getSyncInterval();
     * // 10000
     */
    getSyncInterval(): number;
    /**
     * Set the value of the sync interval when application is in the foreground
     *
     * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
     *
     * @example
       remoteStorage.setSyncInterval(20000);
     */
    setSyncInterval(interval: number): void;
    /**
     * Get the value of the sync interval when application is in the background
     *
     * @returns A number of milliseconds
     *
     * @example
     * remoteStorage.getBackgroundSyncInterval();
     * // 60000
     */
    getBackgroundSyncInterval(): number;
    /**
     * Set the value of the sync interval when the application is in the
     * background
     *
     * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
     *
     * @example
     * remoteStorage.setBackgroundSyncInterval(90000);
     */
    setBackgroundSyncInterval(interval: number): void;
    /**
     * Get the value of the current sync interval. Can be background or
     * foreground, custom or default.
     *
     * @returns number of milliseconds
     *
     * @example
     * remoteStorage.getCurrentSyncInterval();
     * // 15000
     */
    getCurrentSyncInterval(): number;
    /**
     * Get the value of the current network request timeout
     *
     * @returns A number of milliseconds
     *
     * @example
     * remoteStorage.getRequestTimeout();
     * // 30000
     */
    getRequestTimeout(): number;
    /**
     * Set the timeout for network requests.
     *
     * @param timeout - Timeout in milliseconds
     *
     * @example
     * remoteStorage.setRequestTimeout(30000);
     */
    setRequestTimeout(timeout: number): void;
    /**
     * Add a handler to schedule periodic sync if sync enabled
     *
     * @internal
     */
    setupSyncCycle(): void;
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
     * @returns A Promise which resolves when the sync has finished
     */
    startSync(): Promise<void>;
    /**
     * Stop the periodic synchronization.
     */
    stopSync(): void;
    /**
     * Add remoteStorage data module
     *
     * @param module - A data module object
     *
     * @example
     *
     * Usually, you will import your data module from either a package or a local path.
     * Let's say you want to use the
     * [bookmarks module](https://github.com/raucao/remotestorage-module-bookmarks)
     * in order to load data stored from [Webmarks](https://webmarks.5apps.com) for
     * example:
     *
     * ```js
     * import Bookmarks from 'remotestorage-module-bookmarks';
     *
     * remoteStorage.addModule(Bookmarks);
     * ```
     *
     * You can also forgo this function entirely and add modules when creating your
     * remoteStorage instance:
     *
     * ```js
     * const remoteStorage = new RemoteStorage({ modules: [ Bookmarks ] });
     * ```
     *
     * After the module has been added, it can be used like so:
     *
     * ```js
     * remoteStorage.bookmarks.archive.getAll(false)
     *   .then(bookmarks => console.log(bookmarks));
     * ```
     */
    addModule(module: RSModule): void;
    /**
     * Load module
     *
     * @private
     */
    _loadModule(moduleName: string, moduleBuilder: any): {
        [key: string]: unknown;
    };
}
export interface RemoteStorage extends EventHandling {
}
export default RemoteStorage;
//# sourceMappingURL=remotestorage.d.ts.map