/**
 * A cache which can propagate changes up to parent folders and generate new
 * revision ids for them. The generated revision id is consistent across
 * different sessions.  The keys for the cache are case-insensitive.
 *
 * @param defaultValue {string} the value that is returned for all keys that
 *                              don't exist in the cache
 * @class
 */
declare class RevisionCache {
    defaultValue: string;
    private _itemsRev;
    private _storage;
    private _canPropagate;
    constructor(defaultValue: string);
    /**
     * Get a value from the cache or defaultValue, if the key is not in the
     * cache
     */
    get(key: string): string;
    /**
     * Set a value
     */
    set(key: string, value: any): unknown;
    /**
     * Delete a value
     */
    delete(key: string): unknown;
    /**
     * Disables automatic update of folder revisions when a key value is updated
     */
    deactivatePropagation(): true;
    /**
     * Enables automatic update of folder revisions when a key value is updated
     * and refreshes the folder revision ids for entire tree.
     */
    activatePropagation(): true;
    /**
     * Returns a hash code for a string.
     */
    private _hashCode;
    /**
     * Takes an array of strings and returns a hash of the items
     */
    private _generateHash;
    /**
     * Update the revision of a key in it's parent folder data
     */
    private _updateParentFolderItemRev;
    private _getParentFolder;
    /**
     * Propagate the changes to the parent folders and generate new revision ids
     * for them
     */
    private _propagate;
    /**
     * Generate revision id for a folder and it's subfolders, by hashing it's
     * listing
     */
    private _generateFolderRev;
}
export = RevisionCache;
//# sourceMappingURL=revisioncache.d.ts.map