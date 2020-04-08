/**
 * @class Caching
 *
 * Holds/manages caching configuration.
 **/

import {containingFolder, isFolder} from './util';
const log = require('./log');

type CachingStrategy = 'ALL' | 'SEEN' | 'FLUSH';

export default class Caching {
  pendingActivations: string[] = [];
  // TODO add correct type
  activateHandler: Function;

  // TODO add correct type for remoteStorage
  private _remoteStorage: any;
  private _rootPaths: object;


  /**
   * Setup function that is called on initialization.
   *
   * @private
   **/
  // TODO this is not really private, isn't it?
  private _rs_init(remoteStorage) {
    this._remoteStorage = remoteStorage;
  };


  constructor() {
    this.reset();
  }

  /**
   * Configure caching for a given path explicitly.
   *
   * Not needed when using ``enable``/``disable``.
   *
   * @param {string} path - Path to cache
   * @param {string} strategy - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
   *
   */
  set(path: string, strategy: CachingStrategy) {
    if(typeof path !== 'string') {
      throw new Error('path should be a string');
    }
    if(!isFolder(path)) {
      throw new Error('path should be a folder');
    }
    if(this._remoteStorage && this._remoteStorage.access &&
      !this._remoteStorage.access.checkPathPermission(path, 'r')) {
      throw new Error('No access to path "' + path + '". You have to claim access to it first.');
    }
    if(!strategy.match(/^(FLUSH|SEEN|ALL)$/)) {
      throw new Error("strategy should be 'FLUSH', 'SEEN', or 'ALL'");
    }

    this._rootPaths[path] = strategy;

    if(strategy === 'ALL') {
      if(this.activateHandler) {
        this.activateHandler(path);
      } else {
        this.pendingActivations.push(path);
      }
    }
  }


  /**
   * Enable caching for a given path.
   *
   * Uses caching strategy ``ALL``.
   *
   * @param {string} path - Path to enable caching for
   */
  enable(path: string) {
    this.set(path, 'ALL');
  }


  /**
   * Disable caching for a given path.
   *
   * Uses caching strategy ``FLUSH`` (meaning items are only cached until
   * successfully pushed to the remote).
   *
   * @param {string} path - Path to disable caching for
   */
  disable(path: string) {
    this.set(path, 'FLUSH');
  }


  /**
   * Set a callback for when caching is activated for a path.
   *
   * @param {function} cb - Callback function
   */
  onActivate(cb: (firstPending: string) => void) {
    log('[Caching] Setting activate handler', cb, this.pendingActivations);
    this.activateHandler = cb;
    for (let i = 0; i < this.pendingActivations.length; i++) {
      cb(this.pendingActivations[i]);
    }
    delete this.pendingActivations;
  }


  /**
   * Retrieve caching setting for a given path, or its next parent
   * with a caching strategy set.
   *
   * @param {string} path - Path to retrieve setting for
   * @returns {string} caching strategy for the path
   **/
  checkPath(path: string): string {
    if(this._rootPaths[path] !== undefined) {
      return this._rootPaths[path];
    } else if(path === '/') {
      return 'SEEN';
    } else {
      return this.checkPath(containingFolder(path));
    }
  }


  /**
   * Reset the state of caching by deleting all caching information.
   **/
  reset() {
    this._rootPaths = {};
    this._remoteStorage = null;
  }
}

module.exports = Caching;
