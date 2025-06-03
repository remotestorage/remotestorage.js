export type AccessMode = 'r' | 'rw';
export type AccessScope = string;

interface ScopeEntry {
  name: string;
  mode: AccessMode;
}

interface ScopeModeMap {
  // NOTE: key is actually AccessScope
  [key: string]: AccessMode;
}

/**
 * @class
 *
 * This class is for requesting and managing access to modules/folders on the
 * remote. It gets initialized as `remoteStorage.access`.
 */
export class Access {
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
   * Holds an array of claimed scopes:
   *
   * ```javascript
   * [{ name: "<scope-name>", mode: "<mode>" }]
   * ```
   *
   * @ignore
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
  claim (scope: AccessScope, mode: AccessMode): void {
    if (typeof scope !== 'string' || scope.indexOf('/') !== -1 || scope.length === 0) {
      throw new Error('Scope should be a non-empty string without forward slashes');
    }
    if (typeof mode !== 'string' || !mode.match(/^rw?$/)) {
      throw new Error('Mode should be either \'r\' or \'rw\'');
    }
    this._adjustRootPaths(scope);
    this.scopeModeMap[scope] = mode;
  }

  /**
   * Get the access mode for a given scope.
   *
   * @param scope - Access scope
   * @returns Access mode
   * @ignore
   */
  get (scope: AccessScope): AccessMode {
    return this.scopeModeMap[scope];
  }


  /**
   * Remove access for the given scope.
   *
   * @param scope - Access scope
   * @ignore
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
   * @param scope - Access scope
   * @param mode - Access mode
   * @returns `true` if the requested access mode is active, `false` otherwise
   * @ignore
   */
  checkPermission (scope: AccessScope, mode: AccessMode): boolean {
    const actualMode = this.get(scope);
    return actualMode && (mode === 'r' || actualMode === 'rw');
  }

  /**
   * Verify permission for a given path.
   *
   * @param path - Path
   * @param mode - Access mode
   * @returns true if the requested access mode is active, false otherwise
   * @ignore
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
   *
   * @ignore
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
   * @param type - Storage type
   * @internal
   */
  setStorageType (type: string): void {
    this.storageType = type;
  }
}

export default Access;
