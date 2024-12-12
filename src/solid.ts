import {
  InMemoryStorage,
  Session
} from "@inrupt/solid-client-authn-browser";
import {
  getFile, overwriteFile, getContentType,
  getPodUrlAll, deleteFile, getContainedResourceUrlAll, getSolidDataset,
  FetchError, UrlString,
  getThing, getInteger, getDatetime
} from "@inrupt/solid-client";
import BaseClient from './baseclient';
import EventHandling from './eventhandling';
import {
  cleanPath,
  applyMixins,
  getJSONFromLocalStorage,
  localStorageAvailable
} from './util';
import {Remote, RemoteBase, RemoteResponse, RemoteSettings} from "./remote";
import { ConfigObserver } from "./interfaces/configObserver";
import ConfigStorage from "./solidStorage";
import Blob from "blob";

const SETTINGS_KEY = 'remotestorage:solid';

let hasLocalStorage;

/**
 * Overwrite BaseClient's getItemURL with our own implementation
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function hookGetItemURL (rs): void {
  if (rs._origBaseClientGetItemURL) { return; }
  rs._origBaseClientGetItemURL = BaseClient.prototype.getItemURL;
  BaseClient.prototype.getItemURL = function (path: string): string {
    console.log('getItemURL from', path);
    if (typeof path !== 'string') {
      throw 'Argument \'path\' of baseClient.getItemURL must be a string';
    }
    if (this.storage.connected) {
      if (path.startsWith('/')) {
        path = path.substring(1);
      }
      console.log('getItemURL to', this.selectedPodURL + cleanPath(path));
      return this.selectedPodURL + cleanPath(path);
    } else {
      return undefined;
    }
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
 * @private
 */
function requestBodyToBlob(body: XMLHttpRequestBodyInit): Blob {
  if (typeof(body) === 'object') {
    if (body instanceof Blob) {
      return body;
    }
    if (body instanceof DataView) {
      return new Blob([ body ], { type : "application/octet-stream" });
    }
    if (body instanceof ArrayBuffer) {
      return new Blob([ new DataView(body) ]);
    }
    if (ArrayBuffer.isView(body)) {
      return new Blob([ body ], { type : "application/octet-stream" });
    }
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
 * To use this backend, you need to specify the authURL before calling connect like so:
 * 
 * @example
 * solid.setAuthURL('https://login.example.com');
 * solid.connect();
 * 
 * If connect is successful a list of available pods for the Solid account is retrieved and
 * a `pod-not-selected` event is fired. After receiving this event you have to call getPodURLs
 * to get the list of available pods and set one of them to be used by calling setPodURL. After
 * setting the pod URL the `connected` event is fired.
 * 
 * You can find a list of running solid servers on the solid project website here:
 * https://solidproject.org/for-developers#hosted-pod-services
**/
class Solid extends RemoteBase implements Remote, ConfigObserver {
  authURL: string;
  podURLs: string[] = null;
  selectedPodURL: string;
  sessionProperties: object;
  configStorage: ConfigStorage;
  session: Session;

  constructor(remoteStorage) {
    super(remoteStorage);
    console.log('Solid constructor');
    this.online = true;
    this.addEvents(['connected', 'not-connected', 'pod-not-selected']);
    
    // We use a custom ConfigStore to store the solid session in a rs friendly manner to
    // make configuration and disconnect work.
    this.configStorage = new ConfigStorage(this);
    this.session = new Session({
      secureStorage: new InMemoryStorage(), // Inrupt prefers InMemoryStorage for tokens. We respect that.
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

  /**
   * Solid Session storage state changed.
   * 
   * This function is called by the ConfigStore that we provided to Session as an insecure storage.
   * 
   * @param {string} config - The entire Session configuration object serialized into a string
   * 
   * @private
   */
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

    this.podURLs = null;
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
  configure (settings: RemoteSettings) {
    // We only update this.userAddress if settings.userAddress is set to a string or to null
    if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
    // We only update this.authURL if settings.href is set to a string or to null
    if (typeof settings.href !== 'undefined') { this.authURL = settings.href; }
    // Read session properties and pod URL from the properties if it exists
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
      this.podURLs = null;
      if (hasLocalStorage) {
        localStorage.removeItem(SETTINGS_KEY);
      }
    };

    if (this.sessionProperties) {
      this.configStorage.setConfig(JSON.stringify(this.sessionProperties));
      this.connected = this.session.info && this.session.info.isLoggedIn;
      writeSettingsToCache.apply(this);
    } else {
      handleError.apply(this);
    }
  }

  /**
   * Set the auth URL
   * 
   * @param {string} authURL - Auth URL
   * 
   * @public
   */
  setAuthURL(authURL: string): void {
    this.authURL = authURL;
  }

  /**
   * Get a list of pod URLs for this Solid account.
   * 
   * If the Solid Session is not connected, this function returns null.
   * 
   * @returns Get the list of pod URLs
   * 
   * @public
   */
  getPodURLs(): string[] {
    return this.podURLs;
  }

  /**
   * Set the pod URL to use as the storage.
   * 
   * Pod URL must be one of the URLs provided by the getPodURLs function. This function does
   * not validate this constraint.
   * 
   * If the Solid Session is connected and the pod URL is updated to be null, a
   * `pod-not-selected` event will be fired. If Session is connected and the pod URL is set,
   * a `connected` event will be fired.
   * 
   * @param {string} podURL - URL of the pod to be used as storage
   * 
   * @public
   */
  setPodURL(podURL: string): void {
    if (this.selectedPodURL === podURL) {
      return;
    }

    this.selectedPodURL = podURL;

    if (this.session.info && this.session.info.isLoggedIn) {
      if (this.selectedPodURL) {
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
  
        this.connected = true;
        this._emit('connected');
      }
      else {
        this.connected = false;
        this.rs._emit('pod-not-selected');
      }
    }
  }

  /**
   * Get the pod URL that is being used as the storage.
   * 
   * @returns {string} The in-use pod URL or null
   * 
   * @public
   */
  getPodURL(): string {
    return this.selectedPodURL;
  }

  /**
   * Initiate the authorization flow's OAuth dance.
   * 
   * @public
   */
  connect (): void {
    this.rs.setBackend('solid');
    
    if (!this.authURL) {
      this.rs._emit('error', new Error(`No authURL is configured.`));
      return;
    }

    this.session.login({
      oidcIssuer: this.authURL,
      redirectUrl: new URL("/", window.location.href).toString(),
      clientName: "Remote Storage"
    });
  }

  /**
   * Get the connected Solid session
   * 
   * @returns {Session} that is being used by this instance or null if Session is not connected
   * 
   * @public
   */
  getSession(): Session {
    return (this.session.info && this.session.info.isLoggedIn)?this.session:null;
  }

  /**
   * Convert path to file URL
   *
   * @param {string} path - Path of the resource
   * @returns {string} Full URL of the resource on the pod
   * 
   * @private
   */
  getFileURL(path: string): string {
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    if (path.length === 0) {
      path = '/';
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
    console.log('Solid get', path, options);
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
            const fileDataset = getThing(containerDataset, item);

            map[itemName] = {
              'Content-Length': getInteger(fileDataset, 'http://www.w3.org/ns/posix/stat#size'),
              'Last-Modified': getDatetime(fileDataset, 'http://purl.org/dc/terms/modified').toUTCString(), // date.toUTCString()
            };
          }

          return map;
        }, { });
        
        return Promise.resolve({
          statusCode: 200,
          body: listing,
          contentType: 'application/json; charset=UTF-8',
          // revision: ? Skipping ETag
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
    console.log('Solid put', path, contentType);

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
    };

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
    console.log('Solid delete', path);
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
   * Inform about the availability of the Solid backend.
   *
   * @returns {Boolean}
   *
   * @protected
   */
  static _rs_supported (): boolean {
    return true;
  }

  /**
   * Remove Solid as a backend.
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

applyMixins(Solid, [EventHandling]);

export = Solid;
