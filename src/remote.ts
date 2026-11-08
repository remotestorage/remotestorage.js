import RemoteStorage from "./remotestorage";
import EventHandling from "./eventhandling";
import log from "./log";
import { requestRefreshedToken } from "./oauth/token-refresh";
import { isFolder } from "./util";

/**
 * The ancestor for WireClient, GoogleDrive & Dropbox
 */
export class RemoteBase extends EventHandling {
  rs: RemoteStorage;

  connected: boolean;
  online: boolean;
  userAddress: string;
  storageApi: string;

  token?: string | false;
  refreshToken?: string | null;
  tokenType?: string;
  TOKEN_URL?: string | null;
  clientId?: string | null;

  /**
   * The refresh in progress, shared by concurrent 401s, with the tokens it
   * started from: only requests of that same session may wait for it
   */
  _refreshing: { token: string | false; refreshToken: string | null; promise: Promise<string | null> } | null = null;

  /**
   * The last successful refresh: which token and refresh token it replaced,
   * with which. The refresh token is the session's stable identity.
   */
  _lastRefresh: { from: string | false; to: string; refreshToken: string | null } | null = null;

  constructor(rs: RemoteStorage) {
    super();
    this.rs = rs;
    this.connected = false;
    // TODO: Should `online` be set true or false for all, here or in configure?
  }

  stopWaitingForToken (): void {
    if (!this.connected) {
      this._emit('not-connected');
    }
  }

  /**
   * Replace the tokens of the current session, e.g. after a refresh. Unlike
   * configure(), this doesn't emit `connected`, since the session continues.
   * Accepts a `tokenType` for Dropbox; the generic backend ignores it.
   */
  _storeTokens (token: string | false, refreshToken?: string | null, tokenType?: string): void {
    this.token = token;
    if (typeof refreshToken !== 'undefined') { this.refreshToken = refreshToken; }
    if (typeof tokenType !== 'undefined') { this.tokenType = tokenType; }
    this._persistSettings();
  }

  /** Store the settings in localStorage, for the next page load */
  _persistSettings (): void {}

  /**
   * Take over tokens another tab stored for this session, if any. The generic
   * backend overrides this; by default there is no cross-tab storage.
   */
  _adoptTokensFromOtherTab (): string | null { return null; }

  /**
   * Carry on without a refresh token. Returns null: there is no token to
   * retry with.
   */
  _forgetRejectedRefreshToken (): null {
    this._storeTokens(this.token || false, null);
    return null;
  }

  /**
   * Refresh the access token after a request made with `usedToken` got a 401.
   * Concurrent callers share one refresh. Resolves to the token to retry the
   * request with: only ever one refreshed from `usedToken`, so a request is
   * never retried with the token of a session that replaced its own.
   */
  async _refreshAfter401 (usedToken: string | false): Promise<string | null> {
    if (usedToken === false) {
      return null;
    }
    if (this._lastRefresh?.from === usedToken && this._lastRefresh.to === this.token &&
        this._lastRefresh.from !== this._lastRefresh.to) {
      return this.token;   // another request has refreshed it meanwhile
    }
    // Otherwise the token changed for another reason (e.g. connect() or
    // disconnect()), and the request belongs to a session that is gone
    if (!this.refreshToken || !this.TOKEN_URL || this.token !== usedToken) {
      return null;
    }
    if (this._refreshing?.token !== this.token || this._refreshing?.refreshToken !== this.refreshToken) {
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
   * The access token to retry a request with when the session is still the
   * same, or null when the session ended or was replaced. A successful refresh
   * changes the access token without changing the session, so `_lastRefresh`
   * tells those two cases apart.
   */
  _sessionRetryToken (usedToken: string | false, refreshedToken: string | false = usedToken, requestRefreshToken: string | null = this.refreshToken): string | null {
    if (!this.connected || usedToken === false || refreshedToken === false) { return null; }
    if (this._lastRefresh?.from === usedToken && this._lastRefresh.to === this.token &&
        this._lastRefresh.refreshToken === this.refreshToken) {
      return this.token;
    }
    if (refreshedToken !== usedToken &&
        this._lastRefresh?.from === refreshedToken && this._lastRefresh.to === this.token &&
        this._lastRefresh.refreshToken === this.refreshToken) {
      return this.token;
    }
    if (this.token === refreshedToken && this.refreshToken === requestRefreshToken) {
      return refreshedToken;
    }
    return null;
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
      const refreshed = await requestRefreshedToken(this.TOKEN_URL as string, this.clientId as string, refreshToken as string);
      if (!sessionUnchanged()) { return null; }
      this._storeTokens(refreshed.token, refreshed.refreshToken, refreshed.tokenType);
      this._lastRefresh = { from: tokenAtStart, to: refreshed.token, refreshToken: this.refreshToken ?? null };
      if (refreshed.token === tokenAtStart) {
        // The server returned the same token: retrying would only fail again.
        return null;
      }
      return refreshed.token;
    } catch (err) {
      log('[RemoteBase] Could not refresh the access token', err);
      if (err?.name === 'Unauthorized' && sessionUnchanged()) {
        // Rejected, perhaps because another tab rotated it meanwhile; then
        // use its tokens, rather than overwrite them in storage
        return this._adoptTokensFromOtherTab() || this._forgetRejectedRefreshToken();
      }
      // Otherwise (e.g. offline) keep it, so that a later 401 can try again
      return null;
    }
  }

  addQuotes (str: string): string {
    if (typeof (str) !== 'string') {
      return str;
    }
    if (str === '*') {
      return '*';
    }

    return '"' + str + '"';
  }

  stripQuotes (str: string): string {
    if (typeof (str) !== 'string') {
      return str;
    }

    return str.replace(/^["']|["']$/g, '');
  }

  isForbiddenRequestMethod(method: string, uri: string): boolean {
    if (method === 'PUT' || method === 'DELETE') {
      return isFolder(uri);
    } else {
      return false;
    }
  }
}


export interface RemoteSettings {
  userAddress?: string;
  href?: string;          // remoteStorage server's base URL
  storageApi?: string;    // spec version
  token?: string | false; // OAuth2 access token
  // null clears these three
  refreshToken?: string | null; // OAuth2 refresh token
  tokenType?: string;     // type of access token; usually 'bearer'
  tokenURL?: string | null;     // OAuth2 token endpoint, for refreshing
  clientId?: string | null;     // OAuth2 client id, for refreshing
  properties?: object;
}

/**
 * Settings that forget a refresh token and the endpoint it is for, so that
 * a new session or endpoint can't be paired with an earlier one's. Frozen,
 * since every caller shares it.
 */
export const noRefreshSettings: Readonly<RemoteSettings> = Object.freeze({ refreshToken: null, tokenURL: null, clientId: null });

export interface RemoteResponse {
  statusCode: number;
  body?: string | { [key: string]: any; };
  contentType?: string;
  revision?: string;
}

/**
 * The public interface for WireClient, GoogleDrive & Dropbox
 */
export interface Remote {
  /**
   * Whether or not a remote store is connected
   */
  connected: boolean;

  /**
   * Whether last sync action was successful or not
   */
  online: boolean;

  /**
   * The user address of the connected user
   */
  userAddress: string;

  /**
   * Holds the spec version the server claims to be compatible with
   *
   * @example
   * ```js
   * remoteStorage.remote.storageApi
   * // 'draft-dejong-remotestorage-12'
   * ```
   *
   * @internal
   */
  storageApi: string;

  /**
   * Holds the server's base URL, as obtained in the Webfinger discovery
   *
   * @example
   * ```js
   * remoteStorage.remote.href
   * // 'https://storage.example.com/users/jblogg/'
   * ```
   *
   * @internal
   */
  href?: string;

  /**
   * The JSON-parsed properties object from the user's WebFinger record
   */
  properties?: object;

  /**
   * OAuth2 client ID
   *
   * @internal
   */
  clientId?: string;

  /**
   * OAuth2 access token
   *
   * @internal
   */
  token?: string | false;

  /**
   * OAuth2 refresh token, from the PKCE code flow when the server issues one
   * (Dropbox and the generic backend)
   *
   * @internal
   */
  refreshToken?: string | null;

  /**
   * OAuth2 PKCE
   *
   * @internal
   */
  TOKEN_URL?: string;

  configure (settings): void // TODO: harmonize settings & use type

  configure (settings: RemoteSettings): void;

  /**
   * Replace the tokens of the current session without emitting `connected`,
   * e.g. after a refresh. Optional; RemoteBase implements it with
   * _persistSettings().
   * @internal
   */
  _storeTokens? (token: string | false, refreshToken?: string | null, tokenType?: string): void;

  /**
   * Initiate the authorization flow's OAuth dance.
   *
   * @internal
   */
  connect? (): void;

  stopWaitingForToken (): void;

  get (path: string, options?: { ifMatch?: string; ifNoneMatch?: string }): Promise<RemoteResponse>;

  put (path: string, body: XMLHttpRequestBodyInit, contentType: string, options: { ifMatch?: string; ifNoneMatch?: string }): Promise<RemoteResponse>

  delete (path: string, options: { ifMatch?: string }): Promise<RemoteResponse>;

  /**
   * Retrieve full URL of a document. Required for cloud backends (Dropbox,
   * Google Drive) where the URL cannot be derived from the path alone.
   * For standard remoteStorage backends this can be omitted; BaseClient
   * will fall back to concatenating `href + path`.
   *
   * @param path - Absolute storage path (not module-relative)
   */
  getItemURL? (path: string): Promise<string | undefined>;
}
