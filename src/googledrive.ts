import BaseClient from './baseclient';
import EventHandling from './eventhandling';
import {
  applyMixins,
  isFolder,
  cleanPath,
  shouldBeTreatedAsBinary,
  stripLegacyCharsetBinary,
  getJSONFromLocalStorage,
  getTextFromArrayBuffer,
  localStorageAvailable
} from './util';
import {requestWithTimeout, RequestOptions} from "./requests";
import {Remote, RemoteBase, RemoteResponse, RemoteSettings} from "./remote";
import { GoogleDriveChanges } from './googledrive-changes';
import UnauthorizedError from './unauthorized-error';

const BASE_URL = 'https://www.googleapis.com';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';
const SETTINGS_KEY = 'remotestorage:googledrive';
const PATH_PREFIX = '/remotestorage';

const GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
const RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

class ListingChangedError extends Error {}

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
  _items = new Map<string, { v: string; t: number }>();

  constructor(maxAge?: number) {
    this.maxAge = maxAge;
  }

  get (key: string): string | undefined {
    const item = this._items.get(key);
    const now = new Date().getTime();
    return (item && item.t >= (now - this.maxAge * 1000)) ? item.v : undefined;
  }

  set (key, value): void {
    this._items.set(key, {
      v: value,
      t: new Date().getTime()
    });
  }

  clear (): void { this._items.clear(); }

  removeChildren (path: string): void {
    for (const key of this._items.keys()) {
      if (key.startsWith(path) && key !== path) { this._items.delete(key); }
    }
  }

  delete (path: string): void {
    this._items.delete(path);
  }
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
  private changes: GoogleDriveChanges;
  private sessionVersion = 0;

  constructor(remoteStorage, clientId) {
    super(remoteStorage);
    this.online = true;
    this.storageApi = 'draft-dejong-remotestorage-19';
    this.addEvents(['connected', 'not-connected']);

    this.clientId = clientId;

    this._fileIdCache = new FileIdCache(60 * 5);
    this.changes = new GoogleDriveChanges(url => this._request('GET', url, {}), () => this._fileIdCache.clear());

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
    if ((settings.token !== undefined && settings.token !== this.token) ||
        (settings.userAddress !== undefined && settings.userAddress !== this.userAddress)) {
      this.resetSession();
    }
    const sessionVersion = this.sessionVersion;
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
          if (sessionVersion !== this.sessionVersion) { return; }
          this.userAddress = info.user.emailAddress;
          this._emit('connected');
          writeSettingsToCache.apply(this);
        }).catch(() => {
          if (sessionVersion !== this.sessionVersion) { return; }
          handleError.apply(this);
          this.rs._emit('error', new Error('Could not fetch user info.'));
        });
      }
    } else {
      handleError.apply(this);
    }
  }

  private resetSession (): void {
    this.sessionVersion++;
    this._fileIdCache.clear();
    this.changes.reset();
  }

  private assertSession (version: number): void {
    if (version !== this.sessionVersion) { throw new Error('Google Drive session changed during operation.'); }
  }

  /** Refresh the change feed before considering synthetic folder validators. @internal */
  prepareSync (): Promise<void> {
    return this.changes.prepare();
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
  async get (path: string, options: { ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    const sessionVersion = this.sessionVersion;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.getOnce(path, options);
      } catch (error) {
        // Initial change tracking can finish while the app's first read is in
        // flight. Discard that listing and read it again instead of reporting
        // a network outage. Never retry into a replacement login session.
        this.assertSession(sessionVersion);
        if (!(error instanceof ListingChangedError) || attempt >= 1) { throw error; }
        await this.changes.prepare();
        this.assertSession(sessionVersion);
      }
    }
  }

  private async getOnce (path: string, options: { ifNoneMatch?: string }): Promise<RemoteResponse> {
    const sessionVersion = this.sessionVersion;
    if (isFolder(path)) {
      // Explicit conditional reads can run outside the periodic sync hook.
      // Check the feed here too rather than trusting a previously read cursor.
      if (options.ifNoneMatch) { await this.changes.prepare(); }
      this.assertSession(sessionVersion);
      const fullPath = googleDrivePath(path);
      const revision = this.changes.getRevision(fullPath);
      if (revision && options.ifNoneMatch === revision) {
        return Promise.resolve({ statusCode: 304, revision });
      }
      return this._getFolder(fullPath);
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
    const sessionVersion = this.sessionVersion;
    const fullPath = googleDrivePath(path);
    this.changes.invalidate();

    const putDone = (response) => {
      this.assertSession(sessionVersion);
      if (response.status >= 200 && response.status < 300) {
        const meta = JSON.parse(response.responseText);
        if (!meta || typeof meta.etag !== 'string' || !meta.etag || typeof meta.mimeType !== 'string') {
          throw new Error('Invalid Google Drive upload result.');
        }
        const etagWithoutQuotes: string = this.stripQuotes(meta.etag);
        return Promise.resolve({statusCode: 200, contentType: meta.mimeType, revision: etagWithoutQuotes});
      } else if (response.status === 412) {
        return Promise.resolve({statusCode: 412, revision: 'conflict'});
      } else {
        return Promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
      }
    };

    return this._getFileId(fullPath).then((id) => {
      this.assertSession(sessionVersion);
      if (id) {
        if (options && (options.ifNoneMatch === '*')) {
          return putDone({ status: 412 });
        }
        return this._updateFile(id, fullPath, body, contentType, options).then(putDone);
      } else {
        if (options.ifMatch) { return putDone({ status: 412 }); }
        return this._createFile(fullPath, body, contentType).then(putDone);
      }
    }).finally(() => {
      if (sessionVersion === this.sessionVersion) {
        this.changes.invalidate();
        this._fileIdCache.delete(fullPath);
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
    const sessionVersion = this.sessionVersion;
    const fullPath = googleDrivePath(path);
    this.changes.invalidate();

    return this._getFileId(fullPath).then((id) => {
      this.assertSession(sessionVersion);
      if (!id) {
        // File doesn't exist. Ignore.
        return Promise.resolve({statusCode: options.ifMatch ? 412 : 200});
      }

      return this._getMeta(id).then((meta) => {
        this.assertSession(sessionVersion);
        if (!meta) { return { statusCode: options.ifMatch ? 412 : 200 }; }
        let etagWithoutQuotes;
        if ((typeof meta === 'object') && (typeof meta.etag === 'string')) {
          etagWithoutQuotes = this.stripQuotes(meta.etag);
        }
        if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
          return {statusCode: 412, revision: etagWithoutQuotes};
        }

        const headers = options.ifMatch ? { 'If-Match': this.addQuotes(options.ifMatch) } : {};
        return this._request('DELETE', BASE_URL + '/drive/v2/files/' + encodeURIComponent(id), { headers }).then((response) => {
          this.assertSession(sessionVersion);
          if (response.status === 200 || response.status === 204) {
            this._fileIdCache.delete(fullPath);
            return {statusCode: 200};
          } else if (response.status === 412) {
            return {statusCode: 412};
          } else {
            return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
          }
        });
      });
    }).finally(() => {
      if (sessionVersion === this.sessionVersion) {
        this.changes.invalidate();
        this._fileIdCache.delete(fullPath);
        if (isFolder(fullPath)) { this._fileIdCache.removeChildren(fullPath); }
      }
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
    const sessionVersion = this.sessionVersion;
    const metadata = {
      mimeType: contentType
    };
    const headers = {
      'Content-Type': 'application/json; charset=UTF-8'
    };

    if (options && options.ifMatch) {
      headers['If-Match'] = this.addQuotes(options.ifMatch);
    }

    return this._request('PUT', BASE_URL + '/upload/drive/v2/files/' + encodeURIComponent(id) + '?uploadType=resumable', {
      body: JSON.stringify(metadata),
      headers: headers
    }).then((response) => {
      this.assertSession(sessionVersion);
      if (response.status === 412) {
        return (response);
      }
      return this.uploadContent(response, body, contentType, options?.ifMatch);
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
    const sessionVersion = this.sessionVersion;
    return this._getParentId(path).then((parentId) => {
      this.assertSession(sessionVersion);
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
        this.assertSession(sessionVersion);
        return this.uploadContent(response, body, contentType);
      });
    });
  }

  private uploadContent (response, body, contentType, ifMatch?: string): Promise<XMLHttpRequest> {
    if (response.status < 200 || response.status >= 300) {
      return Promise.reject(new Error('Google Drive upload session failed: ' + response.status));
    }
    const location = response.getResponseHeader('Location');
    const url = new URL(location);
    if (url.protocol !== 'https:' || url.username || url.password ||
        !(url.hostname === 'googleapis.com' || url.hostname.endsWith('.googleapis.com'))) {
      return Promise.reject(new Error('Invalid Google Drive upload session URL.'));
    }
    return this._request('PUT', location, {
      body: contentType.match(/^application\/json/) && typeof body !== 'string' &&
        !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body) &&
        !(typeof Blob !== 'undefined' && body instanceof Blob) ? JSON.stringify(body) : body,
      headers: ifMatch ? { 'If-Match': this.addQuotes(ifMatch) } : {}
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
    const sessionVersion = this.sessionVersion;
    return this._getFileId(path).then((id) => {
      this.assertSession(sessionVersion);
      if (!id) { return { statusCode: 404 }; }
      return this._getMeta(id).then((meta) => {
        this.assertSession(sessionVersion);
        if (!meta) { return { statusCode: 404 }; }
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
            if (String(meta.fileSize) !== '0') {
              throw new Error('Google Drive did not provide a download URL for this file.');
            }
            // Only explicit zero-byte files can safely be returned as empty.
            return Promise.resolve({statusCode: 200, body: '', contentType: meta.mimeType, revision: etagWithoutQuotes});
          }
        }

        const params: RequestOptions = {
          responseType: 'arraybuffer'
        };
        return this._request('GET', meta.downloadUrl, params).then((response) => {
          this.assertSession(sessionVersion);
          if (response.status !== 200) { return { statusCode: response.status }; }
          //first encode the response as text, and later check if
          //text appears to actually be binary data
          return getTextFromArrayBuffer(response.response, 'UTF-8').then((responseText) => {
            this.assertSession(sessionVersion);
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
              contentType: stripLegacyCharsetBinary(meta.mimeType),
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
  async _getFolder (path: string): Promise<RemoteResponse> {
    const sessionVersion = this.sessionVersion;
    const revision = this.changes.revision;
    const generation = this.changes.generation;
    const id = await this._getFileId(path);
    this.assertSession(sessionVersion);
    if (!id) { return { statusCode: 404 }; }
    const query = '\'' + id + '\' in parents';
    const fields = 'nextPageToken,incompleteSearch,items(downloadUrl,etag,fileSize,id,mimeType,title,labels)';
    const url = BASE_URL + '/drive/v2/files?q=' + encodeURIComponent(query) +
      '&fields=' + encodeURIComponent(fields) + '&maxResults=1000&trashed=false';
    const itemsMap = Object.create(null);
    const ids = new Map<string, string>();
    const seen = new Set<string>();
    let pageToken: string;
    do {
      const response = await this._request('GET', url + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''), {});
      if (sessionVersion !== this.sessionVersion) { throw new Error('Google Drive session changed during listing.'); }
      if (response.status !== 200) { throw 'request failed or something: ' + response.status; }
      let data;
      try { data = JSON.parse(response.responseText); }
      catch { throw 'non-JSON response from GoogleDrive'; }
      if (!data || typeof data !== 'object' || Array.isArray(data) ||
          (data.items !== undefined && !Array.isArray(data.items)) || data.incompleteSearch) {
        throw new Error('Incomplete Google Drive folder listing.');
      }
      for (const item of data.items || []) {
        if (item.labels?.trashed) { continue; }
        // The Drive root is only traversed to find our application directory.
        // Personal files outside it need not have remoteStorage-compatible names.
        if (path === '/' && (item.title !== PATH_PREFIX.slice(1) || item.mimeType !== GD_DIR_MIME_TYPE)) { continue; }
        if (typeof item.title !== 'string' || !item.title || typeof item.etag !== 'string' ||
            typeof item.id !== 'string' || !item.id || typeof item.mimeType !== 'string') {
          throw new Error('Invalid Google Drive listing item.');
        }
        if (item.title.includes('/')) { throw new Error('Google Drive filenames containing / cannot be represented as remoteStorage paths.'); }
        const folder = item.mimeType === GD_DIR_MIME_TYPE;
        const name = item.title + (folder ? '/' : '');
        if (Object.prototype.hasOwnProperty.call(itemsMap, name)) {
          if (!folder) { throw new Error('Ambiguous duplicate Google Drive filename: ' + item.title); }
          // Older clients could create duplicate directories and used the final
          // matching entry. Preserve that hierarchy so upgrades retain access to
          // existing data. Ambiguous documents still fail rather than overwrite.
          console.warn('Duplicate Google Drive directory; retaining the legacy folder selection.');
        }
        ids.set(path + cleanPath(name), item.id);
        itemsMap[name] = folder ? { ETag: revision || this.stripQuotes(item.etag) } : {
          ETag: this.stripQuotes(item.etag),
          'Content-Type': item.mimeType,
          'Content-Length': item.fileSize
        };
      }
      pageToken = data.nextPageToken;
      if (pageToken !== undefined && (typeof pageToken !== 'string' || !pageToken || seen.has(pageToken))) {
        throw new Error('Invalid Google Drive listing page token.');
      }
      if (pageToken) { seen.add(pageToken); }
    } while (pageToken);
    // Publish only complete listings, and never restore IDs invalidated by a
    // concurrent change feed response or a replacement login session.
    if (generation !== this.changes.generation) {
      throw new ListingChangedError('Google Drive changed during listing. Retry the operation.');
    }
    this._fileIdCache.removeChildren(path);
    for (const [itemPath, itemId] of ids) { this._fileIdCache.set(itemPath, itemId); }
    this.changes.markListed(path, revision);
    return { statusCode: 200, body: Object.fromEntries(Object.entries(itemsMap)), contentType: RS_DIR_MIME_TYPE, revision };
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
    const sessionVersion = this.sessionVersion;
    const foldername = parentPath(path);

    return this._getFileId(foldername).then((parentId) => {
      this.assertSession(sessionVersion);
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
    const sessionVersion = this.sessionVersion;
    this.changes.invalidate();
    return this._getParentId(path).then((parentId) => {
      this.assertSession(sessionVersion);
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
        this.assertSession(sessionVersion);
        if (response.status < 200 || response.status >= 300) { throw new Error('Google Drive folder creation failed: ' + response.status); }
        const meta = JSON.parse(response.responseText);
        if (typeof meta.id !== 'string' || !meta.id) { throw new Error('Missing Google Drive folder ID.'); }
        this.changes.invalidate();
        this._fileIdCache.set(path, meta.id);
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
    const generation = this.changes.generation;

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
      if (generation !== this.changes.generation) {
        throw new ListingChangedError('Google Drive changed during lookup. Retry the operation.');
      }
      id = this._fileIdCache.get(path);
      if (!id) {
        return Promise.resolve();
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
    return this._request('GET', BASE_URL + '/drive/v2/files/' + encodeURIComponent(id), {}).then(function (response) {
      if (response.status === 200) {
        return Promise.resolve(JSON.parse(response.responseText));
      } else if (response.status === 404) {
        return undefined;
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
    const sessionVersion = this.sessionVersion;
    if (this.isForbiddenRequestMethod(method, url)) {
      return Promise.reject(`Don't use ${method} on directories!`);
    }
    if (!this.connected || !this.token) { return Promise.reject(new UnauthorizedError('No Google Drive access token.')); }
    options = { ...options, headers: { ...options.headers, Authorization: 'Bearer ' + this.token } };

    this.rs._emit('wire-busy', {
      method: method,
      isFolder: isFolder(url)
    });

    return requestWithTimeout(method, url, options).then((xhr) => {
      this.rs._emit('wire-done', { method, isFolder: isFolder(url), success: sessionVersion === this.sessionVersion && xhr?.status !== 401 });
      if (sessionVersion !== this.sessionVersion) { throw new Error('Google Drive session changed during request.'); }
      // Google tokens expire from time to time...
      if (xhr && xhr.status === 401) {
        throw new UnauthorizedError();
      } else {
        if (!this.online) {
          this.online = true;
          this.rs._emit('network-online');
        }
        return Promise.resolve(xhr);
      }
    }, (error) => {
      this.rs._emit('wire-done', { method, isFolder: isFolder(url), success: false });
      if (sessionVersion !== this.sessionVersion) { throw new Error('Google Drive session changed during request.'); }
      if (this.online) {
        this.online = false;
        this.rs._emit('network-offline');
      }
      return Promise.reject(error);
    });
  }

  async getItemURL(_path: string): Promise<never> {
    throw new Error('getItemURL is not implemented for Google Drive yet');
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
    if (remoteStorage.googledrive) { remoteStorage.googledrive.connected = false; }
    remoteStorage.googledrive?.resetSession();
    remoteStorage.setBackend(undefined);
    if (remoteStorage._origRemote) {
      remoteStorage.remote = remoteStorage._origRemote;
      delete remoteStorage._origRemote;
    }
  }
}

interface GoogleDrive extends EventHandling {}
applyMixins(GoogleDrive, [EventHandling]);

export = GoogleDrive;
