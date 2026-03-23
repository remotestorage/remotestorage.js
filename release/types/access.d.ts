export type AccessMode = 'r' | 'rw';
export type AccessScope = string;
interface ScopeEntry {
    name: string;
    mode: AccessMode;
}
interface ScopeModeMap {
    [key: string]: AccessMode;
}
/**
 * @class
 *
 * This class is for requesting and managing access to modules/folders on the
 * remote. It gets initialized as `remoteStorage.access`.
 */
export declare class Access {
    scopeModeMap: ScopeModeMap;
    rootPaths: string[];
    storageType: string;
    constructor();
    /**
     * Holds an array of claimed scopes:
     *
     * ```javascript
     * [{ name: "<scope-name>", mode: "<mode>" }]
     * ```
     *
     * @ignore
     */
    get scopes(): ScopeEntry[];
    get scopeParameter(): string;
    /**
     * Claim access on a given scope with given mode.
     *
     * @param scope - An access scope, such as `contacts` or `calendar`
     * @param mode - Access mode. Either `r` for read-only or `rw` for read/write
     *
     * @example
     * ```javascript
     * remoteStorage.access.claim('contacts', 'r');
     * remoteStorage.access.claim('pictures', 'rw');
     * ```
     *
     * Claiming root access, meaning complete access to all files and folders of a storage, can be done using an asterisk for the scope:
     *
     * ```javascript
     * remoteStorage.access.claim('*', 'rw');
     * ```
     */
    claim(scope: AccessScope, mode: AccessMode): void;
    /**
     * Get the access mode for a given scope.
     *
     * @param scope - Access scope
     * @returns Access mode
     * @ignore
     */
    get(scope: AccessScope): AccessMode;
    /**
     * Remove access for the given scope.
     *
     * @param scope - Access scope
     * @ignore
     */
    remove(scope: AccessScope): void;
    /**
     * Verify permission for a given scope.
     *
     * @param scope - Access scope
     * @param mode - Access mode
     * @returns `true` if the requested access mode is active, `false` otherwise
     * @ignore
     */
    checkPermission(scope: AccessScope, mode: AccessMode): boolean;
    /**
     * Verify permission for a given path.
     *
     * @param path - Path
     * @param mode - Access mode
     * @returns true if the requested access mode is active, false otherwise
     * @ignore
     */
    checkPathPermission(path: string, mode: AccessMode): boolean;
    /**
     * Reset all access permissions.
     *
     * @ignore
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
     * @param type - Storage type
     * @internal
     */
    setStorageType(type: string): void;
    static _rs_init(): void;
}
export default Access;
//# sourceMappingURL=access.d.ts.map