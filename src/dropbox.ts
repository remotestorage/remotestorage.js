import EventHandling from './eventhandling';
import BaseClient from './baseclient';
import RevisionCache from './revisioncache';
import SyncError from './sync-error';
import UnauthorizedError from './unauthorized-error';
import {
  applyMixins,
  isFolder,
  shouldBeTreatedAsBinary,
  getJSONFromLocalStorage,
  getTextFromArrayBuffer,
  localStorageAvailable,
  generateCodeVerifier,
} from './util';
import {requestWithTimeout, isArrayBufferView, retryAfterMs} from "./requests";
import {Remote, RemoteBase, RemoteResponse, RemoteSettings} from "./remote";
import RemoteStorage from "./remotestorage";
import Authorize from "./authorize";

/**
 * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
 *
 * Dropbox backend for RemoteStorage.js
 * This file exposes a get/put/delete interface which is compatible with
 * <WireClient>.
 *
 * When remoteStorage.backend is set to 'dropbox', this backend will
 * initialize and replace remoteStorage.remote with remoteStorage.dropbox.
 *
 * In order to ensure compatibility with the public folder, <BaseClient.getItemURL>
 * gets hijacked to return the Dropbox public share URL.
 *
 * To use this backend, you need to specify the Dropbox app key like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   dropbox: 'your-app-key'
 * });
 *
 * An app key can be obtained by registering your app at https://www.dropbox.com/developers/apps
 *
 * Known issues:
 *
 *   - Storing files larger than 150MB is not yet supported
 *   - Listing and deleting folders with more than 10'000 files will cause problems
 *   - Content-Type is not supported; TODO: use file_properties
 *   - Dropbox preserves cases but is not case-sensitive
 *   - getItemURL is asynchronous which means it returns useful values
 *     after the syncCycle
 */

let hasLocalStorage;
const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const OAUTH_SCOPE = 'account_info.read files.content.read files.content.write files.metadata.read files.metadata.write';
const SETTINGS_KEY = 'remotestorage:dropbox';
const FOLDER_URL = 'https://api.dropboxapi.com/2/files/list_folder';
const CONTINUE_URL = 'https://api.dropboxapi.com/2/files/list_folder/continue';
const DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';
const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DELETE_URL = 'https://api.dropboxapi.com/2/files/delete';
const METADATA_URL = 'https://api.dropboxapi.com/2/files/get_metadata';
const CREATE_SHARED_URL = 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings';
const LIST_SHARED_URL = 'https://api.dropbox.com/2/sharing/list_shared_links';
const PATH_PREFIX = '/remotestorage';
const NUM_RETRIES = 3;

interface Metadata {
  ".tag": "folder" | "file";
  id: string;
  name: string;
  path_display: string;
  path_lower: string;
  property_groups: any[];
  sharing_info: {
    no_access?: boolean;
    parent_shared_folder_id: string;
    read_only: boolean;
    traverse_only?: boolean;
    modified_by?: string;
  };

  client_modified?: string;   // date
  content_hash?: string;
  file_lock_info?: {
    created: string;   // date
    is_lockholder: boolean;
    lockholder_name: string;
  };
  has_explicit_shared_members?: boolean;
  is_downloadable?: boolean;
  rev?: string;
  server_modified?: string;   // date
  size?: number;

  preview_url?: string;
}

/**
 * Maps a remoteStorage path to a path in Dropbox.
 *
 * @param {string} path - Path
 * @returns {string} Actual path in Dropbox
 *
 * @private
 */
function getDropboxPath (path: string): string {
  return (PATH_PREFIX + '/' + path).replace(/\/+$/, '').replace(/\/+/g, '/');
}

// This function is simple and has OK performance compared to more
// complicated ones: https://jsperf.com/json-escape-unicode/4
const charsToEncode = /[\u007f-\uffff]/g;
function httpHeaderSafeJson(obj) {
  return JSON.stringify(obj).replace(charsToEncode,
    function(c) {
      return '\\u'+('000'+c.charCodeAt(0).toString(16)).slice(-4);
    }
  );
}

function compareApiError (response: {error_summary: string}, expect: string[]): boolean {
  return new RegExp('^' + expect.join('\\/') + '(\\/|$)').test(response.error_summary);
}

function isBinaryData (data): boolean {
  return data instanceof ArrayBuffer || isArrayBufferView(data);
}

/**
 * @class
 */
class Dropbox extends RemoteBase implements Remote {
  clientId: string;
  TOKEN_URL: string;   // OAuth2 PKCE
  token: string;
  refreshToken: string;   // OAuth2 PKCE
  tokenType: string;   // OAuth2 PKCE
  userAddress: string;

  _initialFetchDone: boolean;
  _revCache: RevisionCache;
  _fetchDeltaCursor: string;
  _fetchDeltaPromise: Promise<undefined[]>;
  _itemRefs: { [key: string]: string };

  // TODO remove when refactoring eventhandling
  _emit: any;

  constructor (rs) {
    super(rs);
    this.online = true; // TODO implement offline detection on failed request
    this.storageApi = 'draft-dejong-remotestorage-19';
    this._initialFetchDone = false;

    this.addEvents(['connected', 'not-connected']);

    this.clientId = rs.apiKeys.dropbox.appKey;
    this.TOKEN_URL = TOKEN_URL;
    this._revCache = new RevisionCache('rev');
    this._fetchDeltaCursor = null;
    this._fetchDeltaPromise = null;
    this._itemRefs = {};

    hasLocalStorage = localStorageAvailable();

    if (hasLocalStorage){
      const settings = getJSONFromLocalStorage(SETTINGS_KEY);
      if (settings) {
        this.configure(settings);   // can't await in constructor
      }
      this._itemRefs = getJSONFromLocalStorage(`${SETTINGS_KEY}:shares`) || {};
    }
    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  }

  /**
   * Set the backed to 'dropbox' and start the authentication flow in order
   * to obtain an API token from Dropbox.
   */
  async connect () {
    // TODO handling when token is already present
    try {
      this.rs.setBackend('dropbox');
      if (this.token) {
        hookIt(this.rs);
      } else {   // OAuth2 PKCE
        const {codeVerifier, codeChallenge, state} = await generateCodeVerifier();
        sessionStorage.setItem('remotestorage:codeVerifier', codeVerifier);
        sessionStorage.setItem('remotestorage:state', state);
        this.rs.authorize({
          authURL: AUTH_URL,
          scope: OAUTH_SCOPE,
          clientId: this.clientId,
          response_type: 'code',
          state: state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          token_access_type: 'offline'
        });
      }
    } catch (err) {
      this.rs._emit('error', err);
      this.rs.setBackend(undefined);
      throw err;
    }
  }

  /**
   * Sets the connected flag
   * Accepts its parameters according to the <WireClient>.
   * @param {Object} settings
   * @param {string} [settings.userAddress] - The user's email address
   * @param {string} [settings.token] - Authorization token
   * @param {string} [settings.refreshToken] - OAuth2 PKCE refresh token
   * @param {string} [settings.tokenType] - usually 'bearer' - no support for 'mac' tokens yet
   *
   * @protected
   **/
  async configure (settings: RemoteSettings): Promise<void> {
    // We only update this.userAddress if settings.userAddress is set to a string or to null:
    if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
    // Same for this.token. If only one of these two is set, we leave the other one at its existing value:
    if (typeof settings.token !== 'undefined') { this.token = settings.token as string; }
    if (typeof settings.refreshToken !== 'undefined') { this.refreshToken = settings.refreshToken; }
    if (typeof settings.tokenType !== 'undefined') { this.tokenType = settings.tokenType; }

    const writeSettingsToCache = () => {
      if (hasLocalStorage) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          userAddress: this.userAddress,
          token: this.token,
          refreshToken: this.refreshToken,
          tokenType: this.tokenType,
        }));
      }
    };

    const handleError = () => {
      this.connected = false;
      if (hasLocalStorage) {
        localStorage.removeItem(SETTINGS_KEY);
      }
      this.rs.setBackend(undefined);
    };

    if (this.refreshToken || this.token) {
      this.connected = true;
      if (this.userAddress) {
        this._emit('connected');
        writeSettingsToCache();
      } else {
        try {
          const info = await this.info();
          this.userAddress = info.email;
          this._emit('connected');
          writeSettingsToCache();
        } catch (err) {
          this.connected = false;
          this.rs._emit('error', new Error('Could not fetch user info.'));
          writeSettingsToCache.apply(this);
        }
      }
    } else {
      handleError();
    }
  }

  /**
   * Get all items in a folder.
   *
   * @param path {string} - path of the folder to get, with leading slash
   * @return {Object}
   *         statusCode - HTTP status code
   *         body - array of the items found
   *         contentType - 'application/json; charset=UTF-8'
   *         revision - revision of the folder
   *
   * @private
   */
  _getFolder (path: string) {
    const revCache = this._revCache;

    const processResponse = (resp) => {
      let body;

      if (resp.status !== 200 && resp.status !== 409) {
        return Promise.reject('Unexpected response status: ' + resp.status);
      }

      try {
        body = JSON.parse(resp.responseText);
      } catch (e) {
        return Promise.reject(e);
      }

      if (resp.status === 409) {
        if (compareApiError(body, ['path', 'not_found'])) {
          // if the folder is not found, handle it as an empty folder
          return Promise.resolve({});
        }

        return Promise.reject(new Error('API returned an error: ' + body.error_summary));
      }

      const listing = body.entries.reduce((map, item) => {
        try {
          const isDir = item['.tag'] === 'folder';
          const itemName = item.path_display.split('/').slice(-1)[0] + (isDir ? '/' : '');
          if (isDir) {
            map[itemName] = {ETag: revCache.get(path + itemName)};
          } else {
            const date = new Date(item.server_modified);
            map[itemName] = {ETag: item.rev, 'Content-Length': item.size, 'Last-Modified': date.toUTCString()};
            this._revCache.set(path + itemName, item.rev);
          }
        } catch (err) {
          console.error(`[Dropbox] folder “${path}” has entry ${JSON.stringify(item)}:`, err);
        }
        return map;
      }, {});

      if (body.has_more) {
        return loadNext(body.cursor).then(function (nextListing) {
          return Object.assign(listing, nextListing);
        });
      }

      return Promise.resolve(listing);
    };

    const loadNext = (cursor) => {
      const params = {
        body: { cursor: cursor }
      };

      return this._request('POST', CONTINUE_URL, params).then(processResponse);
    };

    return this._request('POST', FOLDER_URL, {
      body: {
        path: getDropboxPath(path)
      }
    }).then(processResponse).then(function (listing) {
      return Promise.resolve({
        statusCode: 200,
        body: listing,
        contentType: 'application/json; charset=UTF-8',
        revision: revCache.get(path)
      });
    });
  }

  /**
   * Checks for the path in ``_revCache`` and decides based on that if file
   * has changed. Calls ``_getFolder`` is the path points to a folder.
   *
   * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
   *
   * Compatible with ``WireClient.get``
   *
   * @param path {string} - path of the folder to get, with leading slash
   * @param options {Object}
   *
   * @protected
   */
  get (path: string, options: { ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    if (! this.connected) { return Promise.reject("not connected (path: " + path + ")"); }
    const savedRev = this._revCache.get(path);
    if (savedRev === null) {
      // file was deleted server side
      return Promise.resolve({statusCode: 404});
    }
    if (options && options.ifNoneMatch) {
      // We must wait for local revision cache to be initialized before
      // checking if local revision is outdated
      if (! this._initialFetchDone) {
        return this.fetchDelta().then(() => {
          return this.get(path, options);
        });
      }

      if (savedRev && (savedRev === options.ifNoneMatch)) {
        // nothing changed.
        return Promise.resolve({statusCode: 304});
      }
    }

    // use _getFolder for folders
    if (path.slice(-1) === '/') {
      return this._getFolder(path);
    }

    const params = {
      headers: {
        'Dropbox-API-Arg': httpHeaderSafeJson({path: getDropboxPath(path)}),
      },
      responseType: 'arraybuffer'
    };
    if (options && options.ifNoneMatch) {
      params.headers['If-None-Match'] = options.ifNoneMatch;
    }

    return this._request('GET', DOWNLOAD_URL, params).then(resp => {
      const status = resp.status;
      let meta, body, mime, rev;
      if (status !== 200 && status !== 409) {
        return Promise.resolve({statusCode: status});
      }
      meta = resp.getResponseHeader('Dropbox-API-Result');
      //first encode the response as text, and later check if
      //text appears to actually be binary data
      return getTextFromArrayBuffer(resp.response, 'UTF-8').then(responseText => {
        body = responseText;
        if (status === 409) {
          meta = body;
        }

        try {
          meta = JSON.parse(meta);
        } catch(e) {
          return Promise.reject(e);
        }

        if (status === 409) {
          if (compareApiError(meta, ['path', 'not_found'])) {
            return {statusCode: 404};
          }
          return Promise.reject(new Error('API error while downloading file ("' + path + '"): ' + meta.error_summary));
        }

        mime = resp.getResponseHeader('Content-Type');
        rev = meta.rev;
        this._revCache.set(path, rev);
        this._shareIfNeeded(path);   // There doesn't appear to be a need to await this.

        if (shouldBeTreatedAsBinary(responseText, mime)) {
          // return unprocessed response
          body = resp.response;
        } else {
          // handling json (always try)
          try {
            body = JSON.parse(body);
            mime = 'application/json; charset=UTF-8';
          } catch(e) {
            //Failed parsing Json, assume it is something else then
          }
        }

        return {
          statusCode: status,
          body: body,
          contentType: mime,
          revision: rev
        };
      });
    });
  }

  /**
   * Checks for the path in ``_revCache`` and decides based on that if file
   * has changed.
   *
   * Compatible with ``WireClient``
   *
   * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
   *
   * @param {string} path - path of the folder to put, with leading slash
   * @param {XMLHttpRequestBodyInit} body - Blob | BufferSource | FormData | URLSearchParams | string
   * @param {string} contentType - MIME type of body
   * @param {Object} options
   * @param {string} options.ifNoneMatch - When *, only create or update the file if it doesn't yet exist
   * @param {string} options.ifMatch - Only saves if this matches current revision
   * @returns {Promise} Resolves with an object containing the status code,
   *                    content-type and revision
   * @protected
   */
  async put (path: string, body, contentType: string, options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    if (!this.connected) {
      throw new Error("not connected (path: " + path + ")");
    }

    // check if file has changed and return 412
    const savedRev = this._revCache.get(path);
    if (options && options.ifMatch &&
        savedRev && (savedRev !== options.ifMatch)) {
      return {statusCode: 412, revision: savedRev};
    }
    if (options && (options.ifNoneMatch === '*') &&
        savedRev && (savedRev !== 'rev')) {
      return {statusCode: 412, revision: savedRev};
    }

    if ((!contentType.match(/charset=/)) && isBinaryData(body)) {
      contentType += '; charset=binary';
    }

    if (body.length > 150 * 1024 * 1024) {
      //https://www.dropbox.com/developers/core/docs#chunked-upload
      throw new Error("Cannot upload file larger than 150MB");
    }

    const needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
    const uploadParams = {
      body: body,
      contentType: contentType,
      path: path
    };

    if (needsMetadata) {
      const metadata = await this._getMetadata(path);
      if (options && (options.ifNoneMatch === '*') && metadata) {
        // if !!metadata === true, the file exists
        return {
          statusCode: 412,
          revision: metadata.rev
        };
      }

      if (options && options.ifMatch && metadata && (metadata.rev !== options.ifMatch)) {
        return {
          statusCode: 412,
          revision: metadata.rev
        };
      }
    }
    const result = await this._uploadSimple(uploadParams);
    this._shareIfNeeded(path);   // There doesn't appear to be a need to await this.
    return result;
  }

  /**
   * Checks for the path in ``_revCache`` and decides based on that if file
   * has changed.
   *
   * Compatible with ``WireClient.delete``
   *
   * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
   *
   * @param {string} path - path of the folder to delete, with leading slash
   * @param {Object} options
   *
   * @protected
   */
  async 'delete' (path: string, options: { ifMatch?: string } = {}): Promise<RemoteResponse> {
    if (!this.connected) {
      throw new Error("not connected (path: " + path + ")");
    }

    // check if file has changed and return 412
    const savedRev = this._revCache.get(path);
    if (options?.ifMatch && savedRev && (options.ifMatch !== savedRev)) {
      return { statusCode: 412, revision: savedRev };
    }

    if (options?.ifMatch) {
      const metadata = await this._getMetadata(path);
      if (options?.ifMatch && metadata && (metadata.rev !== options.ifMatch)) {
        return {
          statusCode: 412,
          revision: metadata.rev
        };
      }
    }

    return this._deleteSimple(path);
  }

  /**
   * Calls share, if the provided path resides in a public folder.
   * @private
   */
  _shareIfNeeded (path: string): Promise<any> {
    if (path.match(/^\/public\/.*[^/]$/) && this._itemRefs[path] === undefined) {
      return this.share(path);
    }
  }

  /**
   * Gets a publicly-accessible URL for the path from Dropbox and stores it
   * in ``_itemRefs``.
   *
   * @return {Promise} a promise for the URL
   *
   * @private
   */
  share (path: string): Promise<string> {
    const options = {
      body: {path: getDropboxPath(path)}
    };

    return this._request('POST', CREATE_SHARED_URL, options).then((response) => {
      if (response.status !== 200 && response.status !== 409) {
        return Promise.reject(new Error('Invalid response status:' + response.status));
      }

      let body;

      try {
        body = JSON.parse(response.responseText);
      } catch (e) {
        return Promise.reject(new Error('Invalid response body: ' + response.responseText));
      }

      if (response.status === 409) {
        if (compareApiError(body, ['shared_link_already_exists'])) {
          return this._getSharedLink(path);
        }

        return Promise.reject(new Error('API error: ' + body.error_summary));
      }

      return Promise.resolve(body.url);
    }).then((link) => {
      this._itemRefs[path] = link;

      if (hasLocalStorage) {
        localStorage.setItem(SETTINGS_KEY+':shares', JSON.stringify(this._itemRefs));
      }

      return Promise.resolve(link);
    }, (error) => {
      error.message = 'Sharing Dropbox file or folder ("' + path + '") failed: ' + error.message;
      return Promise.reject(error);
    });
  }

  /**
   * Fetches the user's info from dropbox and returns a promise for it.
   *
   * @return {Promise} a promise for user info object (email - the user's email address)
   *
   * @protected
   */
  info (): Promise<{email: string}> {
    return this._request('POST', ACCOUNT_URL, {}).then(function (response) {
      let email;

      try {
        const info = JSON.parse(response.responseText);
        email = info?.email;
      } catch (e) {
        return Promise.reject(new Error('Could not query current account info: Invalid API response: ' + response.responseText));
      }

      return Promise.resolve({
        email: email
      });
    });
  }

  /**
   * Makes a network request.
   *
   * @param {string} method - Request method
   * @param {string} url - Target URL
   * @param {object} options - Request options
   * @param {number} numAttempts - # of times same request repeated
   * @returns {Promise} Resolves with the response of the network request
   *
   * @private
   */
  async _request (method: string, url: string, options, numAttempts = 1): Promise<any> {
    if (this.isForbiddenRequestMethod(method, url)) {
      throw `Don't use ${method} on directories!`;
    }

    if (! this.token) { throw new UnauthorizedError("No access token"); }

    if (!options.headers) { options.headers = {}; }
    options.headers['Authorization'] = 'Bearer ' + this.token;

    if (typeof options.body === 'object' && !isBinaryData(options.body)) {
      options.body = JSON.stringify(options.body);
      options.headers['Content-Type'] = 'application/json; charset=UTF-8';
    }

    this.rs._emit('wire-busy', {
      method: method,
      isFolder: isFolder(url)
    });

    try {
      const xhr = await requestWithTimeout(method, url, options);
      if (!this.online) {
        this.online = true;
        this.rs._emit('network-online');
      }
      this.rs._emit('wire-done', {
        method: method,
        isFolder: isFolder(url),
        success: true
      });
      if (xhr?.status === 401 && this.refreshToken) {
        if (numAttempts >= NUM_RETRIES) {
          console.error(`Abandoned after ${numAttempts} attempts: ${method} ${url}`);
          return xhr;
        } else {
          this.rs._emit('wire-busy', {
            method: method,
            isFolder: isFolder(url)
          });
          await Authorize.refreshAccessToken(this.rs, this, this.refreshToken);
          this.rs._emit('wire-done', {
            method: method,
            isFolder: isFolder(url),
            success: true
          });
          // re-runs original request
          return this._request(method, url, options, numAttempts + 1);
        }
      } else if ([503, 429].includes(xhr?.status)) {
        // 503 Service Unavailable; 429 Too Many Requests
        if (this.online) {
          this.online = false;
          this.rs._emit('network-offline');
        }

        if (numAttempts >= NUM_RETRIES) {
          console.warn(`Abandoned after ${numAttempts} attempts: ${method} ${url}`);
          return xhr;
        } else {
          await new Promise(resolve => setTimeout(resolve, retryAfterMs(xhr)));
          // re-runs original request
          return this._request(method, url, options, numAttempts+1);
        }
      } else {

        return xhr;
      }
    } catch (error) {
      if (this.online) {
        this.online = false;
        this.rs._emit('network-offline');
      }
      this.rs._emit('wire-done', {
        method: method,
        isFolder: isFolder(url),
        success: false
      });
      throw error;
    }
  }

  /**
   * Fetches the revision of all the files from dropbox API and puts them
   * into ``_revCache``. These values can then be used to determine if
   * something has changed.
   *
   * @private
   */
  fetchDelta (...args: undefined[]): Promise<undefined[]> {
    // If fetchDelta was already called, and didn't finish, return the existing
    // promise instead of calling Dropbox API again
    if (this._fetchDeltaPromise) {
      return this._fetchDeltaPromise;
    }

    /** This should resolve (with no value) on success, and reject on error. */
    const fetch = async (cursor: string) => {
      let url;
      let requestBody;

      if (typeof cursor === 'string') {
        url = CONTINUE_URL;
        requestBody = { cursor };
      } else {
        url = FOLDER_URL;
        requestBody = {
          path: PATH_PREFIX,
          recursive: true,
          include_deleted: true
        };
      }

      try {
        const response = await this._request('POST', url, {body: requestBody});
        if (response.status === 401) {
          throw new UnauthorizedError();
        }

        if (response.status !== 200 && response.status !== 409) {
          throw new Error('Invalid response status: ' + response.status);
        }

        let responseBody;

        try {
          responseBody = JSON.parse(response.responseText);
        } catch (e) {
          throw new Error('Invalid response body: ' + response.responseText);
        }

        if (response.status === 409) {
          if (compareApiError(responseBody, ['path', 'not_found'])) {
            responseBody = {
              cursor: null,
              entries: [],
              has_more: false
            };
          } else {
            throw new Error('API returned an error: ' + responseBody.error_summary);
          }
        }

        if (!cursor) {
          //we are doing a complete fetch, so propagation would introduce unnecessary overhead
          this._revCache.deactivatePropagation();
        }

        responseBody.entries.forEach(entry => {
          const path = entry.path_display.slice(PATH_PREFIX.length);

          if (entry['.tag'] === 'deleted') {
            // there's no way to know whether the entry was a file or a folder
            this._revCache.delete(path);
            this._revCache.delete(path + '/');
          } else if (entry['.tag'] === 'file') {
            this._revCache.set(path, entry.rev);
          }
        });

        this._fetchDeltaCursor = responseBody.cursor;
        if (responseBody.has_more) {
          return fetch(responseBody.cursor);
        } else {
          this._revCache.activatePropagation();
          this._initialFetchDone = true;
        }
      } catch (error) {
        if (error === 'timeout') {
          // Offline is handled elsewhere already, just ignore it here
          return;
        } else {
          throw error;
        }
      }
    };

    this._fetchDeltaPromise = fetch(this._fetchDeltaCursor).catch(error => {
      if (typeof(error) === 'object' && 'message' in error) {
        error.message = 'Dropbox: fetchDelta: ' + error.message;
      } else {
        error = `Dropbox: fetchDelta: ${error}`;
      }
      this.rs._emit('error', error);
      this._fetchDeltaPromise = null;
      return Promise.reject(error);
    }).then(() => {
      this._fetchDeltaPromise = null;
      return Promise.resolve(args);
    });

    return this._fetchDeltaPromise;
  }

  /**
   * Gets metadata for a path (can point to either a file or a folder).
   *
   * @param {string} path - the path to get metadata for
   *
   * @returns {Promise} A promise for the metadata
   *
   * @private
   */
  _getMetadata (path: string): Promise<Metadata> {
    const requestBody = {
      path: getDropboxPath(path)
    };

    return this._request('POST', METADATA_URL, { body: requestBody }).then((response) => {
      if (response.status !== 200 && response.status !== 409) {
        return Promise.reject(new Error('Invalid response status:' + response.status));
      }

      let responseBody;

      try {
        responseBody = JSON.parse(response.responseText);
      } catch (e) {
        return Promise.reject(new Error('Invalid response body: ' + response.responseText));
      }

      if (response.status === 409) {
        if (compareApiError(responseBody, ['path', 'not_found'])) {
          return Promise.resolve();
        }

        return Promise.reject(new Error('API error: ' + responseBody.error_summary));
      }

      return Promise.resolve(responseBody);
    }).then(undefined, (error) => {
      error.message = 'Could not load metadata for file or folder ("' + path + '"): ' + error.message;
      return Promise.reject(error);
    });
  }

  /**
   * Upload a simple file (the size is no more than 150MB).
   *
   * @param {Object} params
   * @param {string} params.ifMatch - Only update the file if its ETag
   *                                   matches this string
   * @param {string} params.path - path of the file
   * @param {string} params.body - contents of the file to upload
   * @param {string} params.contentType - mime type of the file   *
   * @return {Promise} A promise for an object with the following structure:
   *         statusCode - HTTP status code
   *         revision - revision of the newly-created file, if any
   *
   * @private
   */
  _uploadSimple (params: { body: XMLHttpRequestBodyInit; contentType?: string; path: string; ifMatch?: string; }): Promise<RemoteResponse> {
    const args = {
      path: getDropboxPath(params.path),
      mode: { '.tag': 'overwrite', update: undefined },
      mute: true
    };

    if (params.ifMatch) {
      args.mode = { '.tag': 'update', update: params.ifMatch };
    }

    return this._request('POST', UPLOAD_URL, {
      body: params.body,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': httpHeaderSafeJson(args)
      }
    }).then(response => {
      if (response.status !== 200 && response.status !== 409) {
        return Promise.resolve({statusCode: response.status});
      }

      let body;

      try {
        body = JSON.parse(response.responseText);
      } catch (e) {
        return Promise.reject(new Error('Invalid API result: ' + response.responseText));
      }

      if (response.status === 409) {
        if (compareApiError(body, ['path', 'conflict'])) {
          return this._getMetadata(params.path).then(function (metadata) {
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          });
        }
        this.rs._emit('error', new Error(body.error_summary));
        return Promise.resolve({statusCode: response.status});
      }

      this._revCache.set(params.path, body.rev);

      return Promise.resolve({ statusCode: response.status, revision: body.rev });
    });
  }

  /**
   * Deletes a file or a folder.
   *
   * @param {string} path - the path to delete
   *
   * @returns {Promise} A promise for an object with the following structure:
   *          statusCode - HTTP status code
   *
   * @private
   */
  _deleteSimple (path: string): Promise<RemoteResponse> {
    const requestBody = { path: getDropboxPath(path) };

    return this._request('POST', DELETE_URL, { body: requestBody }).then((response) => {
      if (response.status !== 200 && response.status !== 409) {
        return Promise.resolve({statusCode: response.status});
      }

      let responseBody;

      try {
        responseBody = JSON.parse(response.responseText);
      } catch (e) {
        return Promise.reject(new Error('Invalid response body: ' + response.responseText));
      }

      if (response.status === 409) {
        if (compareApiError(responseBody, ['path_lookup', 'not_found'])) {
          return Promise.resolve({statusCode: 404});
        }
        this.rs._emit('error', new Error(responseBody.error_summary));
      }

      return Promise.resolve({statusCode: response.status});
    }).then(result => {
      if (result.statusCode === 200 || result.statusCode === 404) {
        this._revCache.delete(path);
        delete this._itemRefs[path];
      }
      return Promise.resolve(result);
    }, (error) => {
      error.message = 'Could not delete Dropbox file or folder ("' + path + '"): ' + error.message;
      return Promise.reject(error);
    });
  }

  /**
   * Requests the link for an already-shared file or folder.
   *
   * @param {string} path - path to the file or folder
   *
   * @returns {Promise} A promise for the shared link
   *
   * @private
   */
  async _getSharedLink (path: string): Promise<string> {
    const options = {
      body: {
        path: getDropboxPath(path),
        direct_only: true
      }
    };

    return this._request('POST', LIST_SHARED_URL, options).then((response) => {
      if (response.status !== 200 && response.status !== 409) {
        return Promise.reject(new Error('Invalid response status: ' + response.status));
      }

      let body;

      try {
        body = JSON.parse(response.responseText);
      } catch (e) {
        return Promise.reject(new Error('Invalid response body: ' + response.responseText));
      }

      if (response.status === 409) {
        return Promise.reject(new Error('API error: ' + body?.error_summary || response.responseText));
      }

      if (!body.links.length) {
        return Promise.reject(new Error('No links returned'));
      }

      return Promise.resolve(body.links[0].url);
    }, error => {
      error.message = 'Could not get link to a shared file or folder ("' + path + '"): ' + error.message;
      return Promise.reject(error);
    });
  }

  /**
   * Initialize the Dropbox backend.
   *
   * @param {object} rs - RemoteStorage instance
   *
   * @protected
   */
  static _rs_init (rs: RemoteStorage): void {
    hasLocalStorage = localStorageAvailable();
    if ( rs.apiKeys.dropbox ) {
      rs.dropbox = new Dropbox(rs);
    }
    if (rs.backend === 'dropbox') {
      hookIt(rs);
    }
  }

  /**
   * Inform about the availability of the Dropbox backend.
   *
   * @returns {Boolean}
   *
   * @protected
   */
  static _rs_supported (): boolean {
    return true;
  }

  /**
   * Remove Dropbox as a backend.
   *
   * @param {object} rs - RemoteStorage instance
   *
   * @protected
   */
  static _rs_cleanup (rs: RemoteStorage): void {
    unHookIt(rs);
    if (hasLocalStorage){
      localStorage.removeItem(SETTINGS_KEY);
    }
    rs.setBackend(undefined);
  }
}

/**
 * Hooking the sync
 *
 * TODO: document
 */
function hookSync(rs, ...args): void {
  if (rs._dropboxOrigSync) { return; } // already hooked
  rs._dropboxOrigSync = rs.sync.sync.bind(rs.sync);
  rs.sync.sync = function () {
    return this.dropbox.fetchDelta(rs, ...args).
      then(rs._dropboxOrigSync, function (err) {
        rs._emit('error', new SyncError(err));
        rs._emit('sync-done');
      });
  }.bind(rs);
}

/**
 * Unhooking the sync
 *
 * TODO: document
 */
function unHookSync(rs): void {
  if (! rs._dropboxOrigSync) { return; } // not hooked
  rs.sync.sync = rs._dropboxOrigSync;
  delete rs._dropboxOrigSync;
}

/**
 * Hook RemoteStorage.syncCycle as it's the first function called
 * after RemoteStorage.sync is initialized, so we can then hook
 * the sync function
 * @param {object} rs RemoteStorage instance
 * @param {array} args remaining arguments
 */
function hookSyncCycle(rs, ...args): void  {
  if (rs._dropboxOrigSyncCycle) { return; } // already hooked
  rs._dropboxOrigSyncCycle = rs.syncCycle;
  rs.syncCycle = () => {
    if (rs.sync) {
      hookSync(rs);
      rs._dropboxOrigSyncCycle(rs, ...args);
      unHookSyncCycle(rs);
    } else {
      throw new Error('expected sync to be initialized by now');
    }
  };
}

/**
 * Restore RemoteStorage's syncCycle original implementation
 * @param {object} rs RemoteStorage instance
 */
function unHookSyncCycle(rs): void  {
  if (!rs._dropboxOrigSyncCycle) { return; } // not hooked
  rs.syncCycle = rs._dropboxOrigSyncCycle;
  delete rs._dropboxOrigSyncCycle;
}

/**
 * Overwrite BaseClient's getItemURL with our own implementation
 *
 * TODO: getItemURL still needs to be implemented
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function hookGetItemURL (rs): void {
  if (rs._origBaseClientGetItemURL) { return; }
  rs._origBaseClientGetItemURL = BaseClient.prototype.getItemURL;
  BaseClient.prototype.getItemURL = function (/*path*/) {
    throw new Error('getItemURL is not implemented for Dropbox yet');
  };
}

/**
 * Restore BaseClient's getItemURL original implementation
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function unHookGetItemURL(rs): void {
  if (! rs._origBaseClientGetItemURL) { return; }
  BaseClient.prototype.getItemURL = rs._origBaseClientGetItemURL;
  delete rs._origBaseClientGetItemURL;
}

/**
 * TODO: document
 */
function hookRemote(rs): void {
  if (rs._origRemote) { return; }
  rs._origRemote = rs.remote;
  rs.remote = rs.dropbox;
}

/**
 * TODO: document
 */
function unHookRemote(rs): void {
  if (rs._origRemote) {
    rs.remote = rs._origRemote;
    delete rs._origRemote;
  }
}

/**
 * TODO: document
 */
function hookIt(rs: RemoteStorage): void {
  hookRemote(rs);
  if (rs.sync) {
    hookSync(rs);
  } else {
    // when sync is not available yet, we hook the syncCycle function which is called
    // right after sync is initialized
    hookSyncCycle(rs);
  }
  hookGetItemURL(rs);
}

/**
 * TODO: document
 */
function unHookIt(rs: RemoteStorage): void {
  unHookRemote(rs);
  unHookSync(rs);
  unHookGetItemURL(rs);
  unHookSyncCycle(rs);
}

interface Dropbox extends EventHandling {}
applyMixins(Dropbox, [EventHandling]);

export = Dropbox;
