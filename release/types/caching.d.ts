/**
 * @class Caching
 *
 * Holds/manages caching configuration.
 **/
declare class Caching {
    pendingActivations: string[];
    activateHandler: (firstPending: string) => void;
    private _rootPaths;
    constructor();
    /**
     * Configure caching for a given path explicitly.
     *
     * Not needed when using ``enable``/``disable``.
     *
     * @param {string} path - Path to cache
     * @param {string} strategy - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
     */
    set(path: string, strategy: 'ALL' | 'SEEN' | 'FLUSH'): void;
    /**
     * Enable caching for a given path.
     *
     * Uses caching strategy ``ALL``.
     *
     * @param {string} path - Path to enable caching for
     */
    enable(path: string): void;
    /**
     * Disable caching for a given path.
     *
     * Uses caching strategy ``FLUSH`` (meaning items are only cached until
     * successfully pushed to the remote).
     *
     * @param {string} path - Path to disable caching for
     */
    disable(path: string): void;
    /**
     * Set a callback for when caching is activated for a path.
     *
     * @param {function} cb - Callback function
     */
    onActivate(cb: (firstPending: string) => void): void;
    /**
     * Retrieve caching setting for a given path, or its next parent
     * with a caching strategy set.
     *
     * @param {string} path - Path to retrieve setting for
     * @returns {string} caching strategy for the path
     **/
    checkPath(path: string): string;
    /**
     * Reset the state of caching by deleting all caching information.
     **/
    reset(): void;
    /**
     * Setup function that is called on initialization.
     *
     * @private
     **/
    static _rs_init(): void;
}
export = Caching;
//# sourceMappingURL=caching.d.ts.map