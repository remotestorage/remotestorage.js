declare type AccessMode = 'r' | 'rw';
declare type AccessScope = string;
interface ScopeEntry {
    name: string;
    mode: AccessMode;
}
interface ScopeModeMap {
    [key: string]: AccessMode;
}
/**
 * @class Access
 *
 * Keeps track of claimed access and scopes.
 */
declare class Access {
    scopeModeMap: ScopeModeMap;
    rootPaths: string[];
    storageType: string;
    static _rs_init(): void;
    constructor();
    /**
     * Property: scopes
     *
     * Holds an array of claimed scopes in the form
     * > { name: "<scope-name>", mode: "<mode>" }
     */
    get scopes(): ScopeEntry[];
    get scopeParameter(): string;
    /**
     * Claim access on a given scope with given mode.
     *
     * @param {string} scope - An access scope, such as "contacts" or "calendar"
     * @param {string} mode - Access mode. Either "r" for read-only or "rw" for read/write
     */
    claim(scope: AccessScope, mode: AccessMode): void;
    /**
     * Get the access mode for a given scope.
     *
     * @param {string} scope - Access scope
     * @returns {string} Access mode
     */
    get(scope: AccessScope): AccessMode;
    /**
     * Remove access for the given scope.
     *
     * @param {string} scope - Access scope
     */
    remove(scope: AccessScope): void;
    /**
     * Verify permission for a given scope.
     *
     * @param {string} scope - Access scope
     * @param {string} mode - Access mode
     * @returns {boolean} true if the requested access mode is active, false otherwise
     */
    checkPermission(scope: AccessScope, mode: AccessMode): boolean;
    /**
     * Verify permission for a given path.
     *
     * @param {string} path - Path
     * @param {string} mode - Access mode
     * @returns {boolean} true if the requested access mode is active, false otherwise
     */
    checkPathPermission(path: string, mode: AccessMode): boolean;
    /**
     * Reset all access permissions.
     */
    reset(): void;
    /**
     * Return the module name for a given path.
     */
    private _getModuleName;
    /**
     * TODO: document
     */
    private _adjustRootPaths;
    /**
     * TODO: document
     */
    private _scopeNameForParameter;
    /**
     * Set the storage type of the remote.
     *
     * @param {string} type - Storage type
     */
    setStorageType(type: string): void;
}
export = Access;
//# sourceMappingURL=access.d.ts.map