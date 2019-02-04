
/**
 * A cache which can propagate changes up to parent folders and generate new revision 
 * ids for them. The generated revision id is consistent across different sessions.
 * The keys for the cache are case-insensitive.
 *
 * @param defaultValue {string} the value that is returned for all keys that don't exist
 *                              in the cache
 *
 * 
 * @class
 */
function RevisionCache(defaultValue){
  this.defaultValue = defaultValue;
  this._canPropagate = false;
  this._storage = { };
  this._itemsRev = {};
  this.activatePropagation();
}

RevisionCache.prototype = {
  /**
   * Get a value from the cache or defaultValue, if the key is not in the
   * cache. 
   */
  get: function (key) {
    key = key.toLowerCase();
    var stored = this._storage[key];
    if (typeof stored === 'undefined'){
      stored = this.defaultValue;
      this._storage[key] = stored;
    }
    return stored;
  },

  /**
   * Set a value 
   */
  set: function (key, value) {
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
  deactivatePropagation: function () {
    this._canPropagate = false;
    return true;
  },

  /**
   * Enables automatic update of folder revisions when a key value is updated
   * and refreshes the folder revision ids for entire tree.
   */
  activatePropagation: function (){
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
  _hashCode: function(str) {
    var hash = 0, i, chr;
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
  _generateHash(items) {
    //we sort the items before joining them to ensure correct hash generation every time
    var files = items.sort().join('|');
    var hash = ""+this._hashCode(files);
    return hash;
  },
  
  /**
   * Update the revision of a key in it's parent folder data
   */
  _updateParentFolderItemRev(key, rev) {
    if (key !== '/') { 
      var parentFolder = this._getParentFolder(key);
      if (!this._itemsRev[parentFolder]) {
        this._itemsRev[parentFolder] = {};
      }
      var parentFolderItemsRev = this._itemsRev[parentFolder];
      if (!rev) {
        delete parentFolderItemsRev[key];
      } else {
        parentFolderItemsRev[key] = rev;
      }
      //reset revision until root
      this._updateParentFolderItemRev(parentFolder, this.defaultValue);
    }
  },

  _getParentFolder(key) {
    return key.substr(0, key.lastIndexOf("/",key.length - 2) + 1);
  },

  /**
   * Propagate the changes to the parent folders and generate new
   * revision ids for them
   */
  _propagate: function (key){
    if (key !== '/') {            
      var parentFolder = this._getParentFolder(key);
      var parentFolderItemsRev = this._itemsRev[parentFolder];
      var hashItems = [];
      for (var path in parentFolderItemsRev) {
        hashItems.push(parentFolderItemsRev[path]);        
      }
      var newRev = this._generateHash(hashItems);
      this.set(parentFolder, newRev);
    }
  },

  /**
   * Generate revision id for a folder and it's subfolders, by hashing it's listing
   */
  _generateFolderRev(folder) {
    var itemsRev = this._itemsRev[folder];
    var hash = this.defaultValue;
    if (itemsRev) {
      var hashItems = [];
      for (var path in itemsRev) {
        var isDir = path.substr(-1) === '/';
        var hashItem;
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