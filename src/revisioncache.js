/**
 * A cache which can propagate changes up to parent folders and generate new
 * revision ids for them. The generated revision id is consistent across
 * different sessions.  The keys for the cache are case-insensitive.
 *
 * @param defaultValue {string} the value that is returned for all keys that
 *                              don't exist in the cache
 *
 * @class
 */
function RevisionCache (defaultValue) {
  this.defaultValue = defaultValue;
  this._canPropagate = false;
  this._storage = { };
  this._itemsRev = {};
  this.activatePropagation();
}

RevisionCache.prototype = {
  /**
   * Get a value from the cache or defaultValue, if the key is not in the
   * cache
   */
  get (key) {
    key = key.toLowerCase();
    let stored = this._storage[key];
    if (typeof stored === 'undefined') {
      stored = this.defaultValue;
      this._storage[key] = stored;
    }
    return stored;
  },

  /**
   * Set a value
   */
  set (key, value) {
    key = key.toLowerCase();
    if (this._storage[key] === value) {
      return value;
    }
    this._storage[key] = value;
    if (!value) {
      delete this._itemsRev[key];
    }
    this._updateParentFolderItemRev(key, value);
    if (this._canPropagate) {
      this._propagate(key);
    }
    return value;
  },

  /**
   * Delete a value
   */
  delete: function (key) {
    return this.set(key, null);
  },

  /**
   * Disables automatic update of folder revisions when a key value is updated
   */
  deactivatePropagation () {
    this._canPropagate = false;
    return true;
  },

  /**
   * Enables automatic update of folder revisions when a key value is updated
   * and refreshes the folder revision ids for entire tree.
   */
  activatePropagation () {
    if (this._canPropagate) {
      return true;
    }
    this._generateFolderRev("/");
    this._canPropagate = true;
    return true;
  },

  /**
   * Returns a hash code for a string.
   */
  _hashCode (str) {
    let hash = 0, i, chr;
    if (str.length === 0) {
      return hash;
    }
    for (i = 0; i < str.length; i++) {
      chr   = str.charCodeAt(i);
      // eslint-disable-next-line no-bitwise
      hash  = ((hash << 5) - hash) + chr;
      // eslint-disable-next-line no-bitwise
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  },

  /**
   * Takes an array of strings and returns a hash of the items
   */
  _generateHash (items) {
    // We sort the items before joining them to ensure correct hash generation
    // every time
    const files = items.sort().join('|');
    const hash = ""+this._hashCode(files);
    return hash;
  },

  /**
   * Update the revision of a key in it's parent folder data
   */
  _updateParentFolderItemRev (key, rev) {
    if (key !== '/') {
      const parentFolder = this._getParentFolder(key);
      if (!this._itemsRev[parentFolder]) {
        this._itemsRev[parentFolder] = {};
      }
      const parentFolderItemsRev = this._itemsRev[parentFolder];
      if (!rev) {
        delete parentFolderItemsRev[key];
      } else {
        parentFolderItemsRev[key] = rev;
      }
      //reset revision until root
      this._updateParentFolderItemRev(parentFolder, this.defaultValue);
    }
  },

  _getParentFolder (key) {
    return key.substr(0, key.lastIndexOf("/",key.length - 2) + 1);
  },

  /**
   * Propagate the changes to the parent folders and generate new revision ids
   * for them
   */
  _propagate (key) {
    if (key !== '/') {
      const parentFolder = this._getParentFolder(key);
      const parentFolderItemsRev = this._itemsRev[parentFolder];
      const hashItems = [];
      for (let path in parentFolderItemsRev) {
        hashItems.push(parentFolderItemsRev[path]);
      }
      const newRev = this._generateHash(hashItems);
      this.set(parentFolder, newRev);
    }
  },

  /**
   * Generate revision id for a folder and it's subfolders, by hashing it's
   * listing
   */
  _generateFolderRev (folder) {
    const itemsRev = this._itemsRev[folder];
    let hash = this.defaultValue;
    if (itemsRev) {
      const hashItems = [];
      for (let path in itemsRev) {
        const isDir = path.substr(-1) === '/';
        let hashItem;
        if (isDir) {
          hashItem = this._generateFolderRev(path);
        } else {
          hashItem = itemsRev[path];
        }
        hashItems.push(hashItem);
      }
      if (hashItems.length > 0) {
        hash = this._generateHash(hashItems);
      }
    }
    this.set(folder, hash);
    return hash;
  }
};

module.exports = RevisionCache;
