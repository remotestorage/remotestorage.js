import RemoteStorage from "./remotestorage";
import EventHandling from "./eventhandling";
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
   * e.g. after a refresh. Optional; refreshAccessToken falls back to
   * configure() when absent. WireClient implements this with only the first
   * two arguments; the optional tokenType is ignored there.
   * @internal
   */
  _storeTokens? (token: string, refreshToken?: string | null, tokenType?: string): void;

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
