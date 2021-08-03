// TODO maybe move to common interfaces & types file
// also worth considering enums
type AccessMode = 'r' | 'rw';
type AccessScope = string;

interface ScopeEntry {
  name: string;
  mode: AccessMode;
}

interface ScopeModeMap {
  // NOTE: key is actually AccessScope
  [key: string]: AccessMode;
}

/**
 * @class Access
 *
 * Keeps track of claimed access and scopes.
 */
class Access {
  scopeModeMap: ScopeModeMap;
  rootPaths: string[];
  storageType: string;

  // TODO create custom type for init function
  static _rs_init(): void {
    return;
  }

  constructor() {
    this.reset();
  }

  /**
   * Property: scopes
   *
   * Holds an array of claimed scopes in the form
   * > { name: "<scope-name>", mode: "<mode>" }
   */
  get scopes(): ScopeEntry[] {
    return Object.keys(this.scopeModeMap).map((key) => {
      return { name: key, mode: this.scopeModeMap[key] };
    });
  }

  get scopeParameter(): string {
    return this.scopes.map((scope) => {
      return `${this._scopeNameForParameter(scope)}:${scope.mode}`;
    }).join(' ');
  }

  /**
   * Claim access on a given scope with given mode.
   *
   * @param {string} scope - An access scope, such as "contacts" or "calendar"
   * @param {string} mode - Access mode. Either "r" for read-only or "rw" for read/write
   */
  claim (scope: AccessScope, mode: AccessMode): void {
    if (typeof (scope) !== 'string' || scope.indexOf('/') !== -1 || scope.length === 0) {
      throw new Error('Scope should be a non-empty string without forward slashes');
    }
    if (!mode.match(/^rw?$/)) {
      throw new Error('Mode should be either \'r\' or \'rw\'');
    }
    this._adjustRootPaths(scope);
    this.scopeModeMap[scope] = mode;
  }

  /**
   * Get the access mode for a given scope.
   *
   * @param {string} scope - Access scope
   * @returns {string} Access mode
   */
  get (scope: AccessScope): AccessMode {
    return this.scopeModeMap[scope];
  }


  /**
   * Remove access for the given scope.
   *
   * @param {string} scope - Access scope
   */
  remove (scope: AccessScope): void {
    const savedMap: ScopeModeMap = {};
    for (const name in this.scopeModeMap) {
      savedMap[name] = this.scopeModeMap[name];
    }
    this.reset();
    delete savedMap[scope];
    for (const name in savedMap) {
      this.claim(name as AccessScope, savedMap[name]);
    }
  }

  /**
   * Verify permission for a given scope.
   *
   * @param {string} scope - Access scope
   * @param {string} mode - Access mode
   * @returns {boolean} true if the requested access mode is active, false otherwise
   */
  checkPermission (scope: AccessScope, mode: AccessMode): boolean {
    const actualMode = this.get(scope);
    return actualMode && (mode === 'r' || actualMode === 'rw');
  }

  /**
   * Verify permission for a given path.
   *
   * @param {string} path - Path
   * @param {string} mode - Access mode
   * @returns {boolean} true if the requested access mode is active, false otherwise
   */
  checkPathPermission (path: string, mode: AccessMode): boolean {
    if (this.checkPermission('*', mode)) {
      return true;
    }
    // TODO check if this is reliable
    const scope = this._getModuleName(path) as AccessScope;
    return !!this.checkPermission(scope, mode);
  }

  /**
   * Reset all access permissions.
   */
  reset(): void {
    this.rootPaths = [];
    this.scopeModeMap = {};
  }

  /**
   * Return the module name for a given path.
   */
  private _getModuleName (path): string {
    if (path[0] !== '/') {
      throw new Error('Path should start with a slash');
    }
    const moduleMatch = path.replace(/^\/public/, '').match(/^\/([^/]*)\//);
    return moduleMatch ? moduleMatch[1] : '*';
  }

  /**
   * TODO: document
   */
  private _adjustRootPaths (newScope: AccessScope): void {
    if ('*' in this.scopeModeMap || newScope === '*') {
      this.rootPaths = ['/'];
    } else if (!(newScope in this.scopeModeMap)) {
      this.rootPaths.push('/' + newScope + '/');
      this.rootPaths.push('/public/' + newScope + '/');
    }
  }

  /**
   * TODO: document
   */
  private _scopeNameForParameter (scope: ScopeEntry): string {
    if (scope.name === '*' && this.storageType) {
      if (this.storageType === '2012.04') {
        return '';
      } else if (this.storageType.match(/remotestorage-0[01]/)) {
        return 'root';
      }
    }
    return scope.name;
  }

  /**
   * Set the storage type of the remote.
   *
   * @param {string} type - Storage type
   */
  setStorageType (type: string): void {
    this.storageType = type;
  }
}

export = Access;
