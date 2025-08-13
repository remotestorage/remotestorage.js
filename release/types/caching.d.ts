import type RemoteStorage from './remotestorage';
/**
 * @class
 *
 * The caching class gets initialized as `remoteStorage.caching`, unless the
 * {@link remotestorage!RemoteStorage RemoteStorage} instance is created with
 * the option `cache: false`, disabling caching entirely.
 *
 * In case your app hasn't explictly configured caching, the default setting is to
 * cache any documents that have been either created or requested since your app
 * loaded. For offline-capable apps, it usually makes sense to enable full,
 * automatic caching of all documents, which is what {@link enable} will do.
 *
 * Enabling full caching has several benefits:
 *
 * * Speed of access: locally cached data is available to the app a lot faster.
 * * Offline mode: when all data is cached, it can also be read when your app
 *   starts while being offline.
 * * Initial synchronization time: the amount of data your app caches can
 *   have a significant impact on its startup time.
 *
 * Caching can be configured on a per-path basis. When caching is enabled for a
 * folder, it causes all subdirectories to be cached as well.
 *
 * ## Caching strategies
 *
 * For each subtree, you can set the caching strategy to ``ALL``, ``SEEN``
 * (default), and ``FLUSH``.
 *
 * * `ALL` means that once all outgoing changes have been pushed, sync will
 *   start retrieving nodes to cache pro-actively. If a local copy exists
 *   of everything, it will check on each sync whether the ETag of the root
 *   folder changed, and retrieve remote changes if they exist.
 * * `SEEN` does this only for documents and folders that have been either
 *   read from or written to at least once since connecting to the current
 *   remote backend, plus their parent/ancestor folders up to the root (to
 *   make tree-based sync possible).
 * * `FLUSH` will only cache outgoing changes, and forget them as soon as
 *   they have been saved to remote successfully.
 **/
export declare class Caching {
    pendingActivations: string[];
    activateHandler: (firstPending: string) => void;
    private _access;
    private _rootPaths;
    constructor(remoteStorage: RemoteStorage);
    /**
     * Configure caching for a given path explicitly.
     *
     * Not needed when using ``enable``/``disable``.
     *
     * @param path - Path to cache
     * @param strategy - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
     *
     * @example
     * ```js
     * remoteStorage.caching.set('/bookmarks/archive/', 'SEEN');
     * ```
     */
    set(path: string, strategy: 'ALL' | 'SEEN' | 'FLUSH'): void;
    /**
     * Enable caching for a given path.
     *
     * Uses caching strategy ``ALL``.
     *
     * @param path - Path to enable caching for
     * @returns
     *
     * @example
     * ```js
     * remoteStorage.caching.enable('/bookmarks/');
     * ```
     */
    enable(path: string): void;
    /**
     * Disable caching for a given path.
     *
     * Uses caching strategy ``FLUSH`` (meaning items are only cached until
     * successfully pushed to the remote).
     *
     * @param path - Path to disable caching for
     *
     * @example
     * ```js
     * remoteStorage.caching.disable('/bookmarks/');
     * ```
     */
    disable(path: string): void;
    /**
     * Set a callback for when caching is activated for a path.
     *
     * @param cb - Callback function
     */
    onActivate(cb: (firstPending: string) => void): void;
    /**
     * Retrieve caching setting for a given path, or its next parent
     * with a caching strategy set.
     *
     * @param path - Path to retrieve setting for
     * @returns caching strategy for the path
     *
     * @example
     * ```js
     * remoteStorage.caching.checkPath('documents/').then(strategy => {
     *   console.log(`caching strategy for 'documents/': ${strategy}`);
     *   // "caching strategy for 'documents/': SEEN"
     * });
     * ```
     **/
    checkPath(path: string): string;
    /**
     * Reset the state of caching by deleting all caching information.
     *
     * @example
     * ```js
     * remoteStorage.caching.reset();
     * ```
     **/
    reset(): void;
    /**
     * Setup function that is called on initialization.
     *
     * @internal
     **/
    static _rs_init(): void;
}
export default Caching;
//# sourceMappingURL=caching.d.ts.map