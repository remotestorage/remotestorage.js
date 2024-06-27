import {
  InMemoryStorage,
  Session
} from "@inrupt/solid-client-authn-browser";
import {
  getFile, overwriteFile, isRawData, getContentType, getSourceUrl,
  getPodUrlAll, deleteFile, getContainedResourceUrlAll, getSolidDataset,
  FetchError, UrlString
} from "@inrupt/solid-client";
import BaseClient from './baseclient';
import EventHandling from './eventhandling';
import {
  applyMixins,
  isFolder,
  cleanPath,
  shouldBeTreatedAsBinary,
  getJSONFromLocalStorage,
  getTextFromArrayBuffer,
  localStorageAvailable
} from './util';
import {requestWithTimeout, RequestOptions} from "./requests";
import {Remote, RemoteBase, RemoteResponse, RemoteSettings} from "./remote";
import ConfigObserver from "./solid/configObserver";
import ConfigStorage from "./solid/solidStorage";
import Blob from "blob";

const BASE_URL = 'https://www.googleapis.com';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';
const SETTINGS_KEY = 'remotestorage:googledrive';

const GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
const RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

let hasLocalStorage;

/**
 * Produce a title from a filename for metadata.
 *
 * @param {string} filename
 * @returns {string} title
 *
 * @private
 */
function metaTitleFromFileName (filename: string): string {
  if (filename.substr(-1) === '/') {
    filename = filename.substr(0, filename.length - 1);
  }

  return decodeURIComponent(filename);
}

/**
 * Get the parent directory for the given path.
 *
 * @param {string} path
 * @returns {string} parent directory
 *
 * @private
 */
function parentPath (path: string): string {
  return path.replace(/[^\/]+\/?$/, '');
}

/**
 * Get only the filename from a full path.
 *
 * @param {string} path
 * @returns {string} filename
 *
 * @private
 */
function baseName (path: string): string {
  const parts = path.split('/');
  if (path.substr(-1) === '/') {
    return parts[parts.length-2]+'/';
  } else {
    return parts[parts.length-1];
  }
}

/**
 * Internal cache object for storing Google file IDs.
 *
 * @param {number} maxAge - Maximum age (in seconds) the content should be cached for
 */
class FileIdCache {
  maxAge: number;
  _items = {};

  constructor(maxAge?: number) {
    this.maxAge = maxAge;
    this._items = {};
  }

  get (key): number | undefined {
    const item = this._items[key];
    const now = new Date().getTime();
    return (item && item.t >= (now - this.maxAge)) ? item.v : undefined;
  }

  set (key, value): void {
    this._items[key] = {
      v: value,
      t: new Date().getTime()
    };
  }
}

/**
 * Overwrite BaseClient's getItemURL with our own implementation
 *
 * TODO: Still needs to be implemented. At the moment it just throws
 * and error saying that it's not implemented yet.
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function hookGetItemURL (rs): void {
  if (rs._origBaseClientGetItemURL) { return; }
  rs._origBaseClientGetItemURL = BaseClient.prototype.getItemURL;
  BaseClient.prototype.getItemURL = function (/* path */): never {
    throw new Error('getItemURL is not implemented for Google Drive yet');
  };
}

/**
 * Restore BaseClient's getItemURL original implementation
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function unHookGetItemURL (rs): void {
  if (!rs._origBaseClientGetItemURL) { return; }
  BaseClient.prototype.getItemURL = rs._origBaseClientGetItemURL;
  delete rs._origBaseClientGetItemURL;
}

/**
 * Convert XMLHttpRequestBodyInit to Blob
 *
 * @param {XMLHttpRequestBodyInit} body - Request body
 * @returns {Blob} Blob equivalent of the body
 * 
 * 
 * @private
 */
function requestBodyToBlob(body: XMLHttpRequestBodyInit): Blob {
  if (typeof(body) === 'object') {
    if (body instanceof Blob) return body;
    if (body instanceof DataView) return new Blob([ body ], { type : "application/octet-stream" });
    if (body instanceof ArrayBuffer) return new Blob([ new DataView(body) ]);
    if (ArrayBuffer.isView(body)) return new Blob([ body ], { type : "application/octet-stream" });
    if (body instanceof FormData) {
      return new Blob([ new URLSearchParams([JSON.parse(JSON.stringify(body.entries()))]).toString() ],
          { type : 'application/x-www-form-urlencoded' });
    }
    if (body instanceof URLSearchParams) {
      return new Blob([ body.toString() ], { type : 'application/x-www-form-urlencoded' });
    }
  }
  if (typeof(body) === "string") {
    return new Blob([ body ], { type : 'plain/text' });
  }
  
  return new Blob([ JSON.stringify(body) ], { type : 'application/json' });
}

/**
 * @class Solid
 *
 * To use this backend, you need to specify the authURL like so:
 * 
 * @example
 * remoteStorage.setAuthURL('https://login.example.com');
 * 
 * In order to set the Solid options for the widget you have to specify the valid options like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   solid: {
 *     providers: [
 *       {
 *         name: "provider name",
 *         authURL: "auth URL"
 *       }
 *     ],
 *     allowAnyProvider: true|false
 *   }
 * });
**/
class Solid extends RemoteBase implements Remote, ConfigObserver {
  authURL: string;
  podURLs: string[] = [];
  selectedPodURL: string;
  sessionProperties: object;
  configStorage: ConfigStorage;
  session: Session;

  _fileIdCache: FileIdCache;

  constructor(remoteStorage) {
    super(remoteStorage);
    this.online = true;
    this.storageApi = 'draft-dejong-remotestorage-19';
    this.addEvents(['connected', 'not-connected', 'pod-not-selected']);

    this._fileIdCache = new FileIdCache(60 * 5); // IDs expire after 5 minutes (is this a good idea?)
    
    this.configStorage = new ConfigStorage(this);
    this.session = new Session({
      secureStorage: new InMemoryStorage(),
      insecureStorage: this.configStorage
    }, 'any');

    hasLocalStorage = localStorageAvailable();

    if (hasLocalStorage){
      const settings = getJSONFromLocalStorage(SETTINGS_KEY);
      if (settings) {
        this.configure(settings);
      }
    }
  }

  onConfigChanged(config: string): void {
    if (config) {
      const sessionConfig = JSON.parse(config);

      if (typeof sessionConfig.clientSecret !== 'undefined') {
        let settings = getJSONFromLocalStorage(SETTINGS_KEY);

        if (!settings) {
          settings = { };
        }

        settings.href = this.authURL;
        settings.properties = {
          sessionProperties: sessionConfig,
          podURL: this.selectedPodURL
        };

        this.sessionProperties = sessionConfig;

        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return;
      }
    }

    localStorage.removeItem(SETTINGS_KEY);
  }

  /**
   * Configure the Solid backend.
   *
   * @param {Object} settings
   * @param {string} [settings.userAddress] - The user's identity prodiver URL
   * @param {string} [settings.href] - The authURL
   * @param {object} [settings.properties] - All storage for Inrupt session is saved into properties plus the pod URL
   *
   * @protected
   */
  configure (settings: RemoteSettings) { // Settings parameter compatible with WireClient
    // TODO fix comments
    // We only update this.userAddress if settings.userAddress is set to a string or to null
    if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
    // We only update this.userAddress if settings.userAddress is set to a string or to null
    if (typeof settings.href !== 'undefined') { this.authURL = settings.href; }
    // Same for this.token. If only one of these two is set, we leave the other one at its existing value
    if (typeof settings.properties !== 'undefined') {
      const properties = settings.properties as {sessionProperties: object, podURL: string};

      if (properties) {
        if (typeof properties.sessionProperties !== 'undefined') {
          this.sessionProperties = properties.sessionProperties;
        }
        else {
          this.sessionProperties = null;
        }
        if (typeof properties.podURL !== 'undefined') {
          this.selectedPodURL = properties.podURL;
        }
        else {
          this.selectedPodURL = null;
        }
      }
      else {
        this.sessionProperties = null;
        this.selectedPodURL = null;
      }
    }

    const writeSettingsToCache = function() {
      if (hasLocalStorage) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          userAddress: this.userAddress,
          href: this.authURL,
          properties: {
            sessionProperties: this.sessionProperties,
            podURL: this.selectedPodURL
          }
        }));
      }
    };

    const handleError = function() {
      this.connected = false;
      this.sessionProperties = null;
      if (hasLocalStorage) {
        localStorage.removeItem(SETTINGS_KEY);
      }
    };

    if (this.sessionProperties) {
      this.configStorage.setConfig(JSON.stringify(this.sessionProperties));
      this.connected = false;

      // TODO this.connect();
      writeSettingsToCache.apply(this);
    } else {
      handleError.apply(this);
    }
  }

  /**
   * Set the auth URL
   * @param {string} authURL - Auth URL
   */
  setAuthURL(authURL: string): void {
    this.authURL = authURL;
  }

  /**
   * 
   * @returns Get the list of pod URLs
   */
  getPodURLs(): string[] {
    return this.podURLs;
  }

  setPodURL(podURL: string): void {
    this.selectedPodURL = podURL;

    if (this.session.info && this.session.info.isLoggedIn) {
      let settings = getJSONFromLocalStorage(SETTINGS_KEY);
      if (!settings) {
        settings = { };
      }

      settings.userAddress = this.session.info.webId;
      settings.href = this.authURL;
      settings.properties = {
        sessionProperties: this.sessionProperties,
        podURL: this.selectedPodURL
      };

      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    this._emit('connected');
  }

  getPodURL(): string|null {
    return this.selectedPodURL;
  }

  /**
   * Initiate the authorization flow's OAuth dance.
   */
  connect (): void {
    this.rs.setBackend('solid');
    
    this.session.login({
      oidcIssuer: this.authURL,
      redirectUrl: new URL("/", window.location.href).toString(),
      clientName: "Remote Storage"
    });
  }

  /**
   * Convert path to file URL
   *
   * @param {string} path - Path of the resource
   * @returns {string} Full URL of the resource on the pod
   * 
   * 
   * @private
   */
  getFileURL(path: string): string {
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    return this.selectedPodURL + path;
  }

  /**
   * Request a resource (file or directory).
   *
   * @param {string} path - Path of the resource
   * @param {Object} options - Request options
   * @returns {Promise} Resolves with an object containing the status code,
   *                    body, content-type and revision
   *
   * @protected
   */
  get (path: string, options: { ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    const fileURL = this.getFileURL(path);

    if (path.slice(-1) === '/') {
      return getSolidDataset(fileURL, { fetch: this.session.fetch }).then(containerDataset => {
        const URLs: UrlString[] = getContainedResourceUrlAll(containerDataset);
        const listing = URLs.reduce((map, item) => {
          const itemName = item.substring(fileURL.length);
          const isFolder = itemName.slice(-1) === '/';

          if (isFolder) {
            map[itemName] = { }; // We are skipping ETag
          }
          else {
            map[itemName] = {
              'Content-Length': 1, // TODO FIX THESE
              'Last-Modified': 1, // date.toUTCString()
            }
          }

          return map;
        }, { });
        
        return Promise.resolve({
          statusCode: 200,
          body: listing,
          contentType: 'application/json; charset=UTF-8',
          // revision: ?
        } as RemoteResponse);
      }).catch(error => {
        if (error instanceof FetchError) {
          if (error.statusCode === 404) {
            return Promise.resolve({
              statusCode: 200,
              body: { },
              contentType: 'application/json; charset=UTF-8',
              // revision: ?
            } as RemoteResponse);
          }
        }

        return Promise.reject('Failed to get container: ' + error.message);
      });
    }

    return getFile(fileURL, { fetch: this.session.fetch}).then(file => {
      return {
        statusCode: 200,
        body: file,
        contentType: getContentType(file)
      } as RemoteResponse;
    }).catch(error => {
      const statusCode = error.statusCode;

      if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
        return {
          statusCode: statusCode
        } as RemoteResponse;
      }

      return Promise.reject('Failed to get the file: ' + error.message);
    });
  }

  /**
   * Create or update a file.
   *
   * @param {string} path - File path
   * @param body - File content
   * @param {string} contentType - File content-type
   * @param {Object} options
   * @param {string} options.ifNoneMatch - Only create or update the file if the
   *                                       current ETag doesn't match this string
   * @returns {Promise} Resolves with an object containing the status code,
   *                    content-type and revision
   *
   * @protected
   */
  put (path: string, body: XMLHttpRequestBodyInit, contentType: string, options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    const fileURL = this.getFileURL(path);
    const fetch = this.session.fetch;

    const overwrite = function(): Promise<RemoteResponse> {
      const blob = requestBodyToBlob(body);
      return overwriteFile(fileURL, blob, {
        contentType: contentType,
        fetch: fetch
      }).then(savedFile => {
        return {
          statusCode: 201
        } as RemoteResponse;
      }).catch(error => {
        return Promise.reject("PUT failed with status " + error.statusCode + " (" + error.message + ")");
      });
    }

    return getFile(fileURL, { fetch: fetch}).then(file => {
      if (options && (options.ifNoneMatch === '*')) {
        return {statusCode: 412, revision: 'conflict'} as RemoteResponse;
      }

      return overwrite();
    }).catch(error => {
      const statusCode = error.statusCode;

      if (statusCode === 404) {
        return overwrite();
      }

      return Promise.reject("PUT failed with status " + statusCode + " (" + error.message + ")");
    });
  }

  /**
   * Delete a file.
   *
   * @param {string} path - File path
   * @param {Object} options
   * @param {string} options.ifMatch - only delete the file if it's ETag
   *                                   matches this string
   * @returns {Promise} Resolves with an object containing the status code
   *
   * @protected
   */
  delete (path: string, options: { ifMatch?: string } = {}): Promise<RemoteResponse> {
    const fileURL = this.getFileURL(path);

    return deleteFile(fileURL, { fetch: this.session.fetch }).then(() => {
      return {statusCode: 200} as RemoteResponse;
    }).catch(error => {
      const statusCode = error.statusCode;

      if (statusCode === 404) {
        return {statusCode: 200} as RemoteResponse;
      }

      return Promise.reject("DELETE failed with status " + statusCode + " (" + error.message + ")");
    });
  }

  /**
   * Initialize the Solid backend.
   *
   * @param {Object} remoteStorage - RemoteStorage instance
   *
   * @protected
   */
  static _rs_init (remoteStorage): void {
    const solid = new Solid(remoteStorage);
    remoteStorage.solid = solid;
    if (remoteStorage.backend === 'solid') {
      remoteStorage._origRemote = remoteStorage.remote;
      remoteStorage.remote = remoteStorage.solid;

      hookGetItemURL(remoteStorage);

      (async () => {
        const session = solid.session;
        await session.handleIncomingRedirect();
        if (session.info.isLoggedIn) {
          const webId = session.info.webId;
          solid.userAddress = webId;

          if (solid.selectedPodURL) {
            solid._emit('connected');
          }
          else {
            solid.podURLs = await getPodUrlAll(webId, { fetch: fetch });
            remoteStorage._emit('pod-not-selected');
          }
        }
        else if (solid.sessionProperties) {
          solid.connect();
        }
      })();
    }
  }

  /**
   * Inform about the availability of the Google Drive backend.
   *
   * @returns {Boolean}
   *
   * @protected
   */
  static _rs_supported (): boolean {
    return true;
  }

  /**
   * Remove Google Drive as a backend.
   *
   * @param {Object} remoteStorage - RemoteStorage instance
   *
   * @protected
   */
  static _rs_cleanup (remoteStorage): void {
    remoteStorage.setBackend(undefined);
    if (remoteStorage._origRemote) {
      remoteStorage.remote = remoteStorage._origRemote;
      delete remoteStorage._origRemote;
    }
    unHookGetItemURL(remoteStorage);
  }
}

interface GoogleDrive extends EventHandling {}
applyMixins(Solid, [EventHandling]); // TODO what is this?

export = Solid;
