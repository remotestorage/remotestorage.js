/**
 * This file exposes a get/put/delete interface on top of fetch() or XMLHttpRequest.
 * It requires to be configured with parameters about the remotestorage server to
 * connect to.
 * Each instance of WireClient is always associated with a single remotestorage
 * server and access token.
 *
 * Usually the WireClient instance can be accessed via `remoteStorage.remote`.
 *
 * This is the get/put/delete interface:
 *
 *   - #get() takes a path and optionally a ifNoneMatch option carrying a version
 *     string to check. It returns a promise that will be fulfilled with the HTTP
 *     response status, the response body, the MIME type as returned in the
 *     'Content-Type' header and the current revision, as returned in the 'ETag'
 *     header.
 *   - #put() takes a path, the request body and a content type string. It also
 *     accepts the ifMatch and ifNoneMatch options, that map to the If-Match and
 *     If-None-Match headers respectively. See the remotestorage-01 specification
 *     for details on handling these headers. It returns a promise, fulfilled with
 *     the same values as the one for #get().
 *   - #delete() takes a path and the ifMatch option as well. It returns a promise
 *     fulfilled with the same values as the one for #get().
 *
 * In addition to this, the WireClient has some compatibility features to work with
 * remotestorage 2012.04 compatible storages. For example it will cache revisions
 * from folder listings in-memory and return them accordingly as the "revision"
 * parameter in response to #get() requests. Similarly it will return 404 when it
 * receives an empty folder listing, to mimic remotestorage-01 behavior. Note
 * that it is not always possible to know the revision beforehand, hence it may
 * be undefined at times (especially for caching-roots).
 */
import RemoteStorage from './remotestorage';
import Authorize from './authorize';
import EventHandling from './eventhandling';
import UnauthorizedError from './unauthorized-error';
import log from './log';
import {
  applyMixins,
  cleanPath,
  getJSONFromLocalStorage,
  getTextFromArrayBuffer,
  isFolder,
  localStorageAvailable,
  shouldBeTreatedAsBinary
} from './util';
import {requestWithTimeout, isArrayBufferView} from "./requests";
import {Remote, RemoteBase, RemoteResponse, RemoteSettings} from "./remote";

let hasLocalStorage;
const SETTINGS_KEY = 'remotestorage:wireclient';

const API_2012 = 1;
const API_00 = 2;
const API_01 = 3;
const API_02 = 4;
const API_HEAD = 5;

const STORAGE_APIS = {
  'draft-dejong-remotestorage-00': API_00,
  'draft-dejong-remotestorage-01': API_01,
  'draft-dejong-remotestorage-02': API_02,
  'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
};

function readSettings () {
  const settings = getJSONFromLocalStorage(SETTINGS_KEY) || {};
  const { userAddress, href, storageApi, token, properties } = settings;

  return { userAddress, href, storageApi, token, properties };
}

function determineCharset (mimeType: string): string {
  let charset = 'utf-8';
  let charsetMatch;

  if (mimeType) {
    charsetMatch = mimeType.match(/charset=(.+)$/);
    if (charsetMatch) {
      charset = charsetMatch[1];
    }
  }
  return charset;
}

function isFolderDescription (body: object): boolean {
  return ((body['@context'] === 'http://remotestorage.io/spec/folder-description')
    && (typeof (body['items']) === 'object'));
}

function isSuccessStatus (status: number): boolean {
  return [201, 204, 304].indexOf(status) >= 0;
}

function isErrorStatus (status: number): boolean {
  return [401, 403, 404, 412].indexOf(status) >= 0;
}

class WireClient extends RemoteBase implements Remote {
  /**
   * Holds the bearer token of this WireClient, as obtained in the OAuth dance
   *
   * Example:
   *   (start code)
   *
   *   remoteStorage.remote.token
   *   // -> 'DEADBEEF01=='
   */
  token: string | false;

  /**
   * Holds the server's base URL, as obtained in the Webfinger discovery
   *
   * Example:
   *   (start code)
   *
   *   remoteStorage.remote.href
   *   // -> 'https://storage.example.com/users/jblogg/'
   */
  href: string;

  supportsRevs: boolean;

  _revisionCache: { [key: string]: any } = {};

  properties: object;

  constructor (rs: RemoteStorage) {
    super(rs);
    hasLocalStorage = localStorageAvailable();

    /**
     * Event: connected
     *   Fired when the wireclient connect method realizes that it is in
     *   possession of a token and href
     **/
    this.addEvents(['connected', 'not-connected']);

    if (hasLocalStorage) {
      const settings = readSettings();
      if (settings) {
        setTimeout(() => {
          this.configure(settings);
        }, 0);
      }
    }

    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  }

  get storageType () {
    if (this.storageApi) {
      const spec = this.storageApi.match(/draft-dejong-(remotestorage-\d\d)/);
      return spec ? spec[1] : '2012.04';
    } else {
      return undefined;
    }
  }

  async _request (method: string, uri: string, token: string | false, headers: HeadersInit, body: XMLHttpRequestBodyInit, getEtag: boolean, fakeRevision?: string): Promise<RemoteResponse> {
    if (this.isForbiddenRequestMethod(method, uri)) {
      return Promise.reject(`Don't use ${method} on directories!`);
    }

    let revision: string | undefined;

    if (token !== Authorize.IMPLIED_FAKE_TOKEN) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    this.rs._emit('wire-busy', {
      method: method,
      isFolder: isFolder(uri)
    });

    return requestWithTimeout(method, uri, {
      body: body,
      headers: headers,
      responseType: 'arraybuffer'
    }).then((response: XMLHttpRequest): Promise<RemoteResponse> => {
      if (!this.online) {
        this.online = true;
        this.rs._emit('network-online');
      }
      this.rs._emit('wire-done', {
        method: method,
        isFolder: isFolder(uri),
        success: true
      });

      if (isErrorStatus(response.status)) {
        log('[WireClient] Error response status', response.status);
        if (getEtag) {
          revision = this.stripQuotes(response.getResponseHeader('ETag'));
        } else {
          revision = undefined;
        }

        if (response.status === 401) {
          this.rs._emit('error', new UnauthorizedError());
        }

        return Promise.resolve({statusCode: response.status, revision: revision});
      } else if (isSuccessStatus(response.status) ||
        (response.status === 200 && method !== 'GET')) {
        revision = this.stripQuotes(response.getResponseHeader('ETag'));
        log('[WireClient] Successful request', revision);
        return Promise.resolve({statusCode: response.status, revision: revision});
      } else {
        const mimeType = response.getResponseHeader('Content-Type');
        if (getEtag) {
          revision = this.stripQuotes(response.getResponseHeader('ETag'));
        } else {
          revision = (response.status === 200) ? fakeRevision : undefined;
        }

        const charset = determineCharset(mimeType);

        if (shouldBeTreatedAsBinary(response.response, mimeType)) {
          log('[WireClient] Successful request with unknown or binary mime-type', revision);
          return Promise.resolve({
            statusCode: response.status,
            body: response.response,
            contentType: mimeType,
            revision: revision
          });
        } else {
          return getTextFromArrayBuffer(response.response, charset)
            .then((textContent) => {
              log('[WireClient] Successful request', revision);
              return Promise.resolve({
                statusCode: response.status,
                body: textContent,
                contentType: mimeType,
                revision: revision
              });
            });
        }
      }
    }, error => {
      if (this.online) {
        this.online = false;
        this.rs._emit('network-offline');
      }
      this.rs._emit('wire-done', {
        method: method,
        isFolder: isFolder(uri),
        success: false
      });

      return Promise.reject(error);
    });
  }

  /**
   * Sets the userAddress, href, storageApi, token, and properties of a
   * remote store. Also sets connected and online to true and emits the
   * 'connected' event, if both token and href are present.
   *
   * Parameters:
   *   settings - An object that may contain userAddress (string or null),
   *              href (string or null), storageApi (string or null), token (string
   *              or null), and/or properties (the JSON-parsed properties object
   *              from the user's WebFinger record, see section 10 of
   *              http://tools.ietf.org/html/draft-dejong-remotestorage-03
   *              or null).
   *              Fields that are not included (i.e. `undefined`), stay at
   *              their current value. To set a field, include that field
   *              with a `string` value. To reset a field, for instance when
   *              the user disconnected their storage, or you found that the
   *              token you have has expired, simply set that field to `null`.
   */
  configure (settings: RemoteSettings): void {
    if (typeof settings !== 'object') {
      throw new Error('WireClient configure settings parameter should be an object');
    }
    if (typeof settings.userAddress !== 'undefined') {
      this.userAddress = settings.userAddress;
    }
    if (typeof settings.href !== 'undefined') {
      this.href = settings.href;
    }
    if (typeof settings.storageApi !== 'undefined') {
      this.storageApi = settings.storageApi;
    }
    if (typeof settings.token !== 'undefined') {
      this.token = settings.token;
    }
    if (typeof settings.properties !== 'undefined') {
      this.properties = settings.properties;
    }

    if (typeof this.storageApi === 'string') {
      const _storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
      this.supportsRevs = _storageApi >= API_00;
    }
    if (this.href && this.token) {
      this.connected = true;
      this.online = true;
      this._emit('connected');
    } else {
      this.connected = false;
    }
    if (hasLocalStorage) {
      localStorage[SETTINGS_KEY] = JSON.stringify({
        userAddress: this.userAddress,
        href: this.href,
        storageApi: this.storageApi,
        token: this.token,
        properties: this.properties
      });
    }
  }

  get (path: string, options: { ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    if (!this.connected) {
      return Promise.reject('not connected (path: ' + path + ')');
    }

    const headers = {};
    if (this.supportsRevs) {
      if (options.ifNoneMatch) {
        headers['If-None-Match'] = this.addQuotes(options.ifNoneMatch);
      }
    }
    // commenting it out as this is doing nothing and jshint is complaining -les
    // else if (options.ifNoneMatch) {
    //   let oldRev = this._revisionCache[path];
    // }

    return this._request('GET', this.href + cleanPath(path), this.token, headers,
      undefined, this.supportsRevs, this._revisionCache[path])
      .then((r) => {
        if (!isFolder(path)) {
          return Promise.resolve(r);
        }
        let itemsMap = {};
        if (typeof (r.body) !== 'undefined') {
          try {
            r.body = JSON.parse(r.body);
          } catch (e) {
            return Promise.reject('Folder description at ' + this.href + cleanPath(path) + ' is not JSON');
          }
        }

        if (r.statusCode === 200 && typeof (r.body) === 'object') {
          // New folder listing received
          if (Object.keys(r.body).length === 0) {
            // Empty folder listing of any spec
            r.statusCode = 404;
          } else if (isFolderDescription(r.body)) {
            // >= 02 spec
            for (const item in r.body.items) {
              this._revisionCache[path + item] = r.body.items[item].ETag;
            }
            itemsMap = r.body.items;
          } else {
            // < 02 spec
            Object.keys(r.body).forEach((key) => {
              this._revisionCache[path + key] = r.body[key];
              itemsMap[key] = {'ETag': r.body[key]};
            });
          }
          r.body = itemsMap;
          return Promise.resolve(r);
        } else {
          return Promise.resolve(r);
        }
      });
  }

  put (path: string, body: XMLHttpRequestBodyInit, contentType: string, options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    if (!this.connected) {
      return Promise.reject('not connected (path: ' + path + ')');
    }
    if ((!contentType.match(/charset=/)) && (body instanceof ArrayBuffer || isArrayBufferView(body))) {
      contentType += '; charset=binary';
    }
    const headers = {'Content-Type': contentType};
    if (this.supportsRevs) {
      if (options.ifMatch) {
        headers['If-Match'] = this.addQuotes(options.ifMatch);
      }
      if (options.ifNoneMatch) {
        headers['If-None-Match'] = this.addQuotes(options.ifNoneMatch);
      }
    }
    return this._request('PUT', this.href + cleanPath(path), this.token,
      headers, body, this.supportsRevs);
  }

  delete (path: string, options: { ifMatch?: string } = {}): Promise<RemoteResponse> {
    if (!this.connected) {
      throw new Error('not connected (path: ' + path + ')');
    }
    if (!options) {
      options = {};
    }
    const headers = {};
    if (this.supportsRevs) {
      if (options.ifMatch) {
        headers['If-Match'] = this.addQuotes(options.ifMatch);
      }
    }
    return this._request('DELETE', this.href + cleanPath(path), this.token,
      headers,
      undefined, this.supportsRevs);
  }

  static _rs_init (remoteStorage): void {
    remoteStorage.remote = new WireClient(remoteStorage);
    remoteStorage.remote.online = true;
  }

  static _rs_supported (): boolean {
    return typeof fetch === 'function' || typeof XMLHttpRequest === 'function';
  }

  static _rs_cleanup (): void {
    if (hasLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  }
}

interface WireClient extends EventHandling {}
applyMixins(WireClient, [EventHandling]);

export = WireClient;
