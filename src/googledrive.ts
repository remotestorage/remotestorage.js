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

const BASE_URL = 'https://www.googleapis.com';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';
const SETTINGS_KEY = 'remotestorage:googledrive';
const PATH_PREFIX = '/remotestorage';

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
 * Prepend the path with the remoteStorage base directory.
 *
 * @param {string} path - Path
 * @returns {string} Actual path on Google Drive
 *
 * @private
 */
function googleDrivePath (path: string): string {
  return cleanPath(`${PATH_PREFIX}/${path}`);
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
 * @class GoogleDrive
 *
 * To use this backend, you need to specify the app's client ID like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   googledrive: 'your-client-id'
 * });
 *
 * A client ID can be obtained by registering your app in the Google
 * Developers Console: https://console.developers.google.com/flows/enableapi?apiid=drive
 *
 * Docs: https://developers.google.com/drive/v3/web/quickstart/js
**/
class GoogleDrive extends RemoteBase implements Remote {
  clientId: string;
  token: string;

  _fileIdCache: FileIdCache;

  constructor(remoteStorage, clientId) {
    super(remoteStorage);
    this.online = true;
    this.storageApi = 'draft-dejong-remotestorage-19';
    this.addEvents(['connected', 'not-connected']);

    this.clientId = clientId;

    this._fileIdCache = new FileIdCache(60 * 5); // IDs expire after 5 minutes (is this a good idea?)

    hasLocalStorage = localStorageAvailable();

    if (hasLocalStorage){
      const settings = getJSONFromLocalStorage(SETTINGS_KEY);
      if (settings) {
        this.configure(settings);
      }
    }
  }

  /**
   * Configure the Google Drive backend.
   *
   * Fetches the user info from Google when no ``userAddress`` is given.
   *
   * @param {Object} settings
   * @param {string} [settings.userAddress] - The user's email address
   * @param {string} [settings.token] - Authorization token
   *
   * @protected
   */
  configure (settings: RemoteSettings) { // Settings parameter compatible with WireClient
    // We only update this.userAddress if settings.userAddress is set to a string or to null
    if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
    // Same for this.token. If only one of these two is set, we leave the other one at its existing value
    if (typeof settings.token !== 'undefined') { this.token = settings.token as string; }

    const writeSettingsToCache = function() {
      if (hasLocalStorage) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          userAddress: this.userAddress,
          token: this.token
        }));
      }
    };

    const handleError = function() {
      this.connected = false;
      delete this.token;
      if (hasLocalStorage) {
        localStorage.removeItem(SETTINGS_KEY);
      }
    };

    if (this.token) {
      this.connected = true;

      if (this.userAddress) {
        this._emit('connected');
        writeSettingsToCache.apply(this);
      } else {
        this.info().then((info) => {
          this.userAddress = info.user.emailAddress;
          this._emit('connected');
          writeSettingsToCache.apply(this);
        }).catch(() => {
          handleError.apply(this);
          this.rs._emit('error', new Error('Could not fetch user info.'));
        });
      }
    } else {
      handleError.apply(this);
    }
  }

  /**
   * Initiate the authorization flow's OAuth dance.
   */
  connect (): void {
    this.rs.setBackend('googledrive');
    this.rs.authorize({ authURL: AUTH_URL, scope: AUTH_SCOPE, clientId: this.clientId });
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
    if (isFolder(path)) {
      return this._getFolder(googleDrivePath(path));
    } else {
      return this._getFile(googleDrivePath(path), options);
    }
  }

  /**
   * Create or update a file.
   *
   * @param {string} path - File path
   * @param body - File content
   * @param {string} contentType - File content-type
   * @param {Object} options
   * @param {string} options.ifNoneMatch - Only create of update the file if the
   *                                       current ETag doesn't match this string
   * @returns {Promise} Resolves with an object containing the status code,
   *                    content-type and revision
   *
   * @protected
   */
  put (path: string, body: XMLHttpRequestBodyInit, contentType: string, options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    const fullPath = googleDrivePath(path);

    function putDone(response) {
      if (response.status >= 200 && response.status < 300) {
        const meta = JSON.parse(response.responseText);
        const etagWithoutQuotes: string = this.stripQuotes(meta.etag);
        return Promise.resolve({statusCode: 200, contentType: meta.mimeType, revision: etagWithoutQuotes});
      } else if (response.status === 412) {
        return Promise.resolve({statusCode: 412, revision: 'conflict'});
      } else {
        return Promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
      }
    }

    return this._getFileId(fullPath).then((id) => {
      if (id) {
        if (options && (options.ifNoneMatch === '*')) {
          return putDone({ status: 412 });
        }
        return this._updateFile(id, fullPath, body, contentType, options).then(putDone);
      } else {
        return this._createFile(fullPath, body, contentType).then(putDone);
      }
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
    const fullPath = googleDrivePath(path);

    return this._getFileId(fullPath).then((id) => {
      if (!id) {
        // File doesn't exist. Ignore.
        return Promise.resolve({statusCode: 200});
      }

      return this._getMeta(id).then((meta) => {
        let etagWithoutQuotes;
        if ((typeof meta === 'object') && (typeof meta.etag === 'string')) {
          etagWithoutQuotes = this.stripQuotes(meta.etag);
        }
        if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
          return {statusCode: 412, revision: etagWithoutQuotes};
        }

        return this._request('DELETE', BASE_URL + '/drive/v2/files/' + id, {}).then((response) => {
          if (response.status === 200 || response.status === 204) {
            return {statusCode: 200};
          } else {
            return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
          }
        });
      });
    });
  }

  /**
   * Fetch the user's info from Google.
   *
   * @returns {Promise} resolves with the user's info.
   *
   * @protected
   */
  info () {
    const url = BASE_URL + '/drive/v2/about?fields=user';
    // requesting user info(mainly for userAdress)
    return this._request('GET', url, {}).then(function (resp){
      try {
        const info = JSON.parse(resp.responseText);
        return Promise.resolve(info);
      } catch (e) {
        return Promise.reject(e);
      }
    });
  }

  /**
   * Update an existing file.
   *
   * @param {string} id - File ID
   * @param {string} path - File path
   * @param body - File content
   * @param {string} contentType - File content-type
   * @param {Object} options
   * @param {string} options.ifMatch - Only update the file if its ETag
   *                                   matches this string
   * @returns {Promise} Resolves with the response of the network request
   *
   * @private
   */
  _updateFile (id, path, body, contentType, options) {
    const metadata = {
      mimeType: contentType
    };
    const headers = {
      'Content-Type': 'application/json; charset=UTF-8'
    };

    if (options && options.ifMatch) {
      headers['If-Match'] = this.addQuotes(options.ifMatch);
    }

    return this._request('PUT', BASE_URL + '/upload/drive/v2/files/' + id + '?uploadType=resumable', {
      body: JSON.stringify(metadata),
      headers: headers
    }).then((response) => {
      if (response.status === 412) {
        return (response);
      } else {
        return this._request('PUT', response.getResponseHeader('Location'), {
          body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
        });
      }
    });
  }

  /**
   * Create a new file.
   *
   * @param {string} path - File path
   * @param body - File content
   * @param {string} contentType - File content-type
   * @returns {Promise} Resolves with the response of the network request
   *
   * @private
   */
  _createFile (path, body, contentType) {
    return this._getParentId(path).then((parentId) => {
      const fileName = baseName(path);
      const metadata = {
        title: metaTitleFromFileName(fileName),
        mimeType: contentType,
        parents: [{
          kind: "drive#fileLink",
          id: parentId
        }]
      };
      return this._request('POST', BASE_URL + '/upload/drive/v2/files?uploadType=resumable', {
        body: JSON.stringify(metadata),
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        }
      }).then((response) => {
        return this._request('POST', response.getResponseHeader('Location'), {
          body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
        });
      });
    });
  }

  /**
   * Request a file.
   *
   * @param {string} path - File path
   * @param {Object} options
   * @param {string} [options.ifNoneMath] - Only return the file if its ETag
   *                                        doesn't match the given string
   * @returns {Promise} Resolves with an object containing the status code,
   *                    body, content-type and revision
   *
   * @private
   */
  _getFile (path, options) {
    return this._getFileId(path).then((id) => {
      return this._getMeta(id).then((meta) => {
        let etagWithoutQuotes;
        if (typeof(meta) === 'object' && typeof(meta.etag) === 'string') {
          etagWithoutQuotes = this.stripQuotes(meta.etag);
        }

        if (options && options.ifNoneMatch && (etagWithoutQuotes === options.ifNoneMatch)) {
          return Promise.resolve({statusCode: 304});
        }

        if (!meta.downloadUrl) {
          if (meta.exportLinks && meta.exportLinks['text/html']) {
            // Documents that were generated inside GoogleDocs have no
            // downloadUrl, but you can export them to text/html instead:
            meta.mimeType += ';export=text/html';
            meta.downloadUrl = meta.exportLinks['text/html'];
          } else {
            // empty file
            return Promise.resolve({statusCode: 200, body: '', contentType: meta.mimeType, revision: etagWithoutQuotes});
          }
        }

        const params: RequestOptions = {
          responseType: 'arraybuffer'
        };
        return this._request('GET', meta.downloadUrl, params).then((response) => {
          //first encode the response as text, and later check if
          //text appears to actually be binary data
          return getTextFromArrayBuffer(response.response, 'UTF-8').then(function (responseText) {
            let body = responseText;
            if (meta.mimeType.match(/^application\/json/)) {
              try {
                body = JSON.parse(body as string);
              } catch(e) {
                // body couldn't be parsed as JSON, so we'll just return it as is
              }
            } else if (shouldBeTreatedAsBinary(responseText, meta.mimeType)) {
              //return unprocessed response
              body = response.response;
            }

            return {
              statusCode: 200,
              body: body,
              contentType: meta.mimeType,
              revision: etagWithoutQuotes
            };
          });
        });
      });
    });
  }

  /**
   * Request a directory.
   *
   * @param {string} path - Directory path
   * @returns {Promise} Resolves with an object containing the status code,
   *                    body and content-type
   *
   * @private
   */
  _getFolder (path: string) {
    return this._getFileId(path).then((id) => {
      let data, etagWithoutQuotes, itemsMap;
      if (! id) {
        return Promise.resolve({statusCode: 404});
      }

      const query = '\'' + id + '\' in parents';
      const fields = 'items(downloadUrl,etag,fileSize,id,mimeType,title,labels)';
      return this._request('GET', BASE_URL + '/drive/v2/files?'
          + 'q=' + encodeURIComponent(query)
          + '&fields=' + encodeURIComponent(fields)
          + '&maxResults=1000'
          + '&trashed=false',
          {})
      .then((response) => {
        if (response.status !== 200) {
          return Promise.reject('request failed or something: ' + response.status);
        }

        try {
          data = JSON.parse(response.responseText);
        } catch(e) {
          return Promise.reject('non-JSON response from GoogleDrive');
        }

        itemsMap = {};
        for (const item of data.items) {
          if (item.labels?.trashed) { continue; } // ignore deleted files

          etagWithoutQuotes = this.stripQuotes(item.etag);
          if (item.mimeType === GD_DIR_MIME_TYPE) {
            this._fileIdCache.set(path + cleanPath(item.title) + '/', item.id);
            itemsMap[item.title + '/'] = {
              ETag: etagWithoutQuotes
            };
          } else {
            this._fileIdCache.set(path + cleanPath(item.title), item.id);
            itemsMap[item.title] = {
              ETag: etagWithoutQuotes,
              'Content-Type': item.mimeType,
              'Content-Length': item.fileSize
            };
          }
        }

        // FIXME: add revision of folder!
        return Promise.resolve({statusCode: 200, body: itemsMap, contentType: RS_DIR_MIME_TYPE, revision: undefined});
      });
    });
  }

  /**
   * Get the ID of a parent path.
   *
   * Creates the directory if it doesn't exist yet.
   *
   * @param {string} path - Full path of a directory or file
   * @returns {Promise} Resolves with ID of the parent directory.
   *
   * @private
   */
  _getParentId (path) {
    const foldername = parentPath(path);

    return this._getFileId(foldername).then((parentId) => {
      if (parentId) {
        return Promise.resolve(parentId);
      } else {
        return this._createFolder(foldername);
      }
    });
  }

  /**
   * Create a directory.
   *
   * Creates all parent directories as well if any of them didn't exist yet.
   *
   * @param {string} path - Directory path
   * @returns {Promise} Resolves with the ID of the new directory
   *
   * @private
   */
  _createFolder (path) {
    return this._getParentId(path).then((parentId) => {
      return this._request('POST', BASE_URL + '/drive/v2/files', {
        body: JSON.stringify({
          title: metaTitleFromFileName(baseName(path)),
          mimeType: GD_DIR_MIME_TYPE,
          parents: [{
            id: parentId
          }]
        }),
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        }
      }).then((response) => {
        const meta = JSON.parse(response.responseText);
        return Promise.resolve(meta.id);
      });
    });
  }

  /**
   * Get the ID of a file.
   *
   * @param {string} path - File path
   * @returns {Promise} Resolves with the ID
   *
   * @private
   */
  _getFileId (path) {
    let id;

    if (path === '/') {
      // "root" is a special alias for the fileId of the root folder
      return Promise.resolve('root');
    } else if ((id = this._fileIdCache.get(path))) {
      // id is cached.
      return Promise.resolve(id);
    }
    // id is not cached (or file doesn't exist).
    // load parent folder listing to propagate / update id cache.
    return this._getFolder(parentPath(path)).then(() => {
      id = this._fileIdCache.get(path);
      if (!id) {
        if (path.substr(-1) === '/') {
          return this._createFolder(path).then(() => {
            return this._getFileId(path);
          });
        } else {
          return Promise.resolve();
        }
      }
      return Promise.resolve(id);
    });
  }

  /**
   * Get the metadata for a given file ID.
   *
   * @param {string} id - File ID
   * @returns {Promise} Resolves with an object containing the metadata
   *
   * @private
   */
  _getMeta (id) {
    return this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
      if (response.status === 200) {
        return Promise.resolve(JSON.parse(response.responseText));
      } else {
        return Promise.reject("request (getting metadata for " + id + ") failed with status: " + response.status);
      }
    });
  }

  /**
   * Make a network request.
   *
   * @param {string} method - Request method
   * @param {string} url - Target URL
   * @param {Object} options - Request options
   * @returns {Promise} Resolves with the response of the network request
   *
   * @private
   */
  _request (method: string, url: string, options: RequestOptions) {
    if (this.isForbiddenRequestMethod(method, url)) {
      return Promise.reject(`Don't use ${method} on directories!`);
    }

    if (! options.headers) { options.headers = {}; }
    options.headers['Authorization'] = 'Bearer ' + this.token;

    this.rs._emit('wire-busy', {
      method: method,
      isFolder: isFolder(url)
    });

    return requestWithTimeout(method, url, options).then((xhr) => {
      // Google tokens expire from time to time...
      if (xhr && xhr.status === 401) {
        this.connect();
        return;
      } else {
        if (!this.online) {
          this.online = true;
          this.rs._emit('network-online');
        }
        this.rs._emit('wire-done', {
          method: method,
          isFolder: isFolder(url),
          success: true
        });

        return Promise.resolve(xhr);
      }
    }, (error) => {
      if (this.online) {
        this.online = false;
        this.rs._emit('network-offline');
      }
      this.rs._emit('wire-done', {
        method: method,
        isFolder: isFolder(url),
        success: false
      });

      return Promise.reject(error);
    });
  }

  /**
   * Initialize the Google Drive backend.
   *
   * @param {Object} remoteStorage - RemoteStorage instance
   *
   * @protected
   */
  static _rs_init (remoteStorage): void {
    const config = remoteStorage.apiKeys.googledrive;
    if (config) {
      remoteStorage.googledrive = new GoogleDrive(remoteStorage, config.clientId);
      if (remoteStorage.backend === 'googledrive') {
        remoteStorage._origRemote = remoteStorage.remote;
        remoteStorage.remote = remoteStorage.googledrive;

        hookGetItemURL(remoteStorage);
      }
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
applyMixins(GoogleDrive, [EventHandling]);

export = GoogleDrive;
