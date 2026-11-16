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
  shouldBeTreatedAsBinary,
  stripLegacyCharsetBinary
} from './util';
import {requestWithTimeout} from "./requests";
import {Remote, RemoteBase, RemoteResponse, RemoteSettings, noRefreshSettings} from "./remote";

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
  const { userAddress, href, storageApi, token, refreshToken, tokenURL, clientId, properties } = settings;

  return { userAddress, href, storageApi, token, refreshToken, tokenURL, clientId, properties };
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
   * OAuth2 refresh token, from the PKCE code flow when the server issues one.
   * Used with `TOKEN_URL` and `clientId` to get a new access token on a 401.
   */
  refreshToken?: string | null;

  /** OAuth2 token endpoint advertised by the server, for refreshing */
  TOKEN_URL?: string | null;

  /** OAuth2 client id the token was issued to, for refreshing */
  clientId?: string | null;

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

  /**
   * The refresh in progress, shared by concurrent 401s, with the tokens it
   * started from: only requests of that same session may wait for it
   */
  _refreshing: { token: string | false; refreshToken: string; promise: Promise<string | null> } | null = null;

  /** The last successful refresh: which token it replaced, with which */
  _lastRefresh: { from: string | false; to: string } | null = null;

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
        // The stored settings are applied on a later tick. If the session was
        // configured in the meantime (another account, or the token cleared),
        // restoring the stored one would replace it and persist the wrong
        // access and refresh tokens. Only restore while the session fields are
        // still the untouched ones we started with.
        const session = {
          href: this.href,
          token: this.token,
          refreshToken: this.refreshToken,
          tokenURL: this.TOKEN_URL,
          clientId: this.clientId
        };
        setTimeout(() => {
          // connect() sets the user address synchronously before discovery, so
          // it is not part of the snapshot: the stored session must still
          // resume for the same account. A connect() for another account must
          // not be overwritten by (or paired with) the stored one, though.
          const accountChanged = !!this.userAddress && this.userAddress !== settings.userAddress;
          if (!accountChanged && this.href === session.href && this.token === session.token &&
              this.refreshToken === session.refreshToken &&
              this.TOKEN_URL === session.tokenURL && this.clientId === session.clientId) {
            this.configure(settings);
          }
        }, 0);
      }
    }

    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  }

  /**
   * Make a request; on a 401, refresh the access token when possible and
   * retry once with the new one. Emits `Unauthorized` when the final
   * response is still a 401.
   */
  async _request (method: string, uri: string, token: string | false, headers: HeadersInit, body: XMLHttpRequestBodyInit, getEtag: boolean, fakeRevision?: string): Promise<RemoteResponse> {
    if (this.isForbiddenRequestMethod(method, uri)) {
      return Promise.reject(`Don't use ${method} on directories!`);
    }
    // One wire-busy/wire-done pair per operation, including a refresh and retry
    const wireEvent = { method: method, isFolder: isFolder(uri) };
    this.rs._emit('wire-busy', wireEvent);
    try {
      const response = await this._requestWithRefresh(method, uri, token, headers, body, getEtag, fakeRevision);
      this.rs._emit('wire-done', { ...wireEvent, success: true });
      return response;
    } catch (err) {
      this.rs._emit('wire-done', { ...wireEvent, success: false });
      throw err;
    }
  }

  /** The request, and the retry after a refresh; see `_request` */
  async _requestWithRefresh (method: string, uri: string, token: string | false, headers: HeadersInit, body: XMLHttpRequestBodyInit, getEtag: boolean, fakeRevision?: string): Promise<RemoteResponse> {
    let response = await this._requestOnce(method, uri, token, headers, body, getEtag, fakeRevision);
    if (response.statusCode === 401) {
      const refreshedToken = await this._refreshAfter401(token);
      if (refreshedToken) {
        response = await this._requestOnce(method, uri, refreshedToken, headers, body, getEtag, fakeRevision);
      }
    }
    if (response.statusCode === 401) {
      this.rs._emit('error', new UnauthorizedError());
    }
    return response;
  }

  /**
   * Refresh the access token after a request made with `usedToken` got a 401.
   * Concurrent callers share one refresh. Resolves to the token to retry the
   * request with: only ever one refreshed from `usedToken`, so a request is
   * never retried with the token of a session that replaced its own.
   */
  async _refreshAfter401 (usedToken: string | false): Promise<string | null> {
    if (usedToken === Authorize.IMPLIED_FAKE_TOKEN) {
      return null;
    }
    if (this._lastRefresh?.from === usedToken && this._lastRefresh.to === this.token) {
      return this.token;   // another request has refreshed it meanwhile
    }
    // Otherwise the token changed for another reason (e.g. connect() or
    // disconnect()), and the request belongs to a session that is gone
    if (!this.refreshToken || !this.TOKEN_URL || this.token !== usedToken) {
      return null;
    }
    if (this._refreshing?.token !== this.token || this._refreshing.refreshToken !== this.refreshToken) {
      // None, or one the previous session started, whose result is dropped
      const refreshing = { token: this.token, refreshToken: this.refreshToken, promise: null };
      refreshing.promise = this._refresh().finally(() => {
        if (this._refreshing === refreshing) { this._refreshing = null; }
      });
      this._refreshing = refreshing;
    }
    return this._refreshing.promise;
  }

  /**
   * Get a new access token with the refresh token. The current token stays
   * in place meanwhile, so other requests aren't refused as not connected;
   * they get a 401 and wait for this refresh. The result is dropped when the
   * session changed meanwhile: connect() or disconnect() replace or forget
   * the refresh token, and reconnect() clears the access token. Resolves to
   * the new token, or null when none was stored.
   */
  async _refresh (): Promise<string | null> {
    // Another tab may have refreshed already, rotating the refresh token;
    // sending the old one could make the server revoke the whole session
    return this._adoptTokensFromOtherTab() || this._requestRefresh();
  }

  /** Refresh with this tab's own refresh token; see `_refresh` */
  async _requestRefresh (): Promise<string | null> {
    const refreshToken = this.refreshToken;
    const tokenAtStart = this.token;
    const sessionUnchanged = (): boolean => this.refreshToken === refreshToken && this.token === tokenAtStart;
    try {
      const refreshed = await Authorize.requestRefreshedToken(this.TOKEN_URL, this.clientId, refreshToken);
      if (!sessionUnchanged()) { return null; }
      this._lastRefresh = { from: tokenAtStart, to: refreshed.token };
      this._storeTokens(refreshed.token, refreshed.refreshToken);
      return refreshed.token;
    } catch (err) {
      log('[WireClient] Could not refresh the access token', err);
      if (err?.name === 'Unauthorized' && sessionUnchanged()) {
        // Rejected, perhaps because another tab rotated it meanwhile; then
        // use its tokens, rather than overwrite them in storage
        return this._adoptTokensFromOtherTab() || this._forgetRejectedRefreshToken();
      }
      // Otherwise (e.g. offline) keep it, so that a later 401 can try again
      return null;
    }
  }

  /**
   * Take over the tokens that another tab stored for this session (same
   * account and endpoint) after refreshing them. Resolves to the adopted
   * access token, or null when storage holds nothing newer.
   */
  _adoptTokensFromOtherTab (): string | null {
    if (!hasLocalStorage) { return null; }
    const stored = readSettings();
    if (stored.userAddress !== this.userAddress || stored.href !== this.href ||
        !stored.token || stored.token === this.token ||
        !stored.refreshToken || stored.refreshToken === this.refreshToken) {
      return null;
    }
    this._lastRefresh = { from: this.token, to: stored.token };
    this._storeTokens(stored.token, stored.refreshToken);
    return stored.token;
  }

  /**
   * Carry on as without a refresh token, so that 401s emit Unauthorized
   * until the app reconnects. Returns null: there is no token to retry with.
   */
  _forgetRejectedRefreshToken (): null {
    this.configure(noRefreshSettings);
    return null;
  }

  async _requestOnce (method: string, uri: string, token: string | false, headers: HeadersInit, body: XMLHttpRequestBodyInit, getEtag: boolean, fakeRevision?: string): Promise<RemoteResponse> {
    let revision: string | undefined;

    if (token !== Authorize.IMPLIED_FAKE_TOKEN) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    return requestWithTimeout(method, uri, {
      body: body,
      headers: headers,
      responseType: 'arraybuffer'
    }).then((response: XMLHttpRequest): Promise<RemoteResponse> => {
      if (!this.online) {
        this.online = true;
        this.rs._emit('network-online');
      }

      if (isErrorStatus(response.status)) {
        log('[WireClient] Error response status', response.status);
        if (getEtag) {
          revision = this.stripQuotes(response.getResponseHeader('ETag'));
        } else {
          revision = undefined;
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
            contentType: stripLegacyCharsetBinary(mimeType),
            revision: revision
          });
        } else {
          return getTextFromArrayBuffer(response.response, charset)
            .then((textContent) => {
              log('[WireClient] Successful request', revision);
              return Promise.resolve({
                statusCode: response.status,
                body: textContent,
                contentType: stripLegacyCharsetBinary(mimeType),
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
    if (typeof settings.refreshToken !== 'undefined') {
      this.refreshToken = settings.refreshToken;
    }
    if (typeof settings.tokenURL !== 'undefined') {
      this.TOKEN_URL = settings.tokenURL;
    }
    if (typeof settings.clientId !== 'undefined') {
      this.clientId = settings.clientId;
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
    this._persistSettings();
  }

  /**
   * Replace the tokens of the current session, e.g. after a refresh. Unlike
   * configure(), this doesn't emit `connected`, since the session continues.
   */
  _storeTokens (token: string, refreshToken?: string): void {
    this.token = token;
    if (typeof refreshToken !== 'undefined') {
      this.refreshToken = refreshToken;
    }
    this._persistSettings();
  }

  /** Store the settings in localStorage, for the next page load */
  _persistSettings (): void {
    if (hasLocalStorage) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        userAddress: this.userAddress,
        href: this.href,
        storageApi: this.storageApi,
        token: this.token,
        refreshToken: this.refreshToken,
        tokenURL: this.TOKEN_URL,
        clientId: this.clientId,
        properties: this.properties
      }));
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
            r.body = JSON.parse(r.body as string);
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
