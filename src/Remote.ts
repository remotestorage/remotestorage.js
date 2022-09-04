import RemoteStorage from "./remotestorage";
import EventHandling from "./eventhandling";
import {isFolder} from "./util";

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
  href?: string;              // remoteStorage server's base URL
  storageApi?: string;        // spec version
  token?: string | false;   // OAuth2 access token
  refreshToken?: string;      // OAuth2 refresh token
  tokenType?: string;         // type of access token; usually 'bearer'
  properties?: object;
}

export interface RemoteResponse {
  statusCode: number;
  revision?: string;
  contentType?: string;
  body?: any;
}

/**
 * The public interface for WireClient, GoogleDrive & Dropbox
 */
export interface Remote {
  connected: boolean;
  online: boolean;
  userAddress: string;

  /**
   * Holds the spec version the server claims to be compatible with
   *
   * Example:
   *   (start code)
   *
   *   remoteStorage.remote.storageApi
   *   // -> 'draft-dejong-remotestorage-01'
   */
  storageApi: string;

  /**
   * Holds the server's base URL, as obtained in the Webfinger discovery
   *
   * Example:
   *   (start code)
   *
   *   remoteStorage.remote.href
   *   // -> 'https://storage.example.com/users/jblogg/'
   */
  href?: string;

  /** the JSON-parsed properties object from the user's WebFinger record */
  properties?: object;

  clientId?: string;   // OAuth2
  TOKEN_URL?: string;   // OAuth2 PKCE

  configure (settings): void   // TODO: harmonize settings & use type

  configure (settings: RemoteSettings): void;

  /**
   * Initiate the authorization flow's OAuth dance.
   */
  connect? (): void;

  stopWaitingForToken (): void;

  get (path: string, options: { ifMatch?: string; ifNoneMatch?: string }): Promise<RemoteResponse>;

  put (path: string, body: XMLHttpRequestBodyInit, contentType: string, options: { ifMatch?: string; ifNoneMatch?: string }): Promise<RemoteResponse>

  delete (path: string, options: { ifMatch?: string }): Promise<RemoteResponse>;
}
