import type RemoteStorage from './remotestorage';
import UnauthorizedError from './unauthorized-error';
import log from './log';
import {
  cleanPath,
  getJSONFromLocalStorage,
  isFolder,
  localStorageAvailable,
  shouldBeTreatedAsBinary
} from './util';

import {
  ExtensionBridge,
  ExtensionBridgeRequestResponse
} from './extension-bridge';
import { Remote, RemoteBase, RemoteResponse, RemoteSettings } from './remote';

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

class ExtensionRemote extends RemoteBase implements Remote {
  grantedScopes: string;
  href: string;
  properties: object;
  sessionId: string;
  supportsRevs: boolean;
  token: undefined;
  _revisionCache: { [key: string]: any } = {};

  constructor (rs: RemoteStorage) {
    super(rs);
    hasLocalStorage = localStorageAvailable();
    this.addEvents(['connected', 'not-connected']);
  }

  async disconnect (): Promise<void> {
    if (this.sessionId) {
      await ExtensionBridge.disconnect(this.sessionId);
    }
  }

  private async _request (
    method: 'GET' | 'PUT' | 'DELETE',
    path: string,
    headers: HeadersInit,
    body?: XMLHttpRequestBodyInit
  ): Promise<RemoteResponse> {
    if (this.isForbiddenRequestMethod(method, path)) {
      return Promise.reject(`Don't use ${method} on directories!`);
    }

    this.rs._emit('wire-busy', {
      method: method,
      isFolder: isFolder(path)
    });

    try {
      const response = await ExtensionBridge.request({
        method: method,
        path: cleanPath(path),
        sessionId: this.sessionId,
        headers: headers,
        body: body
      });
      const normalized = await this._normalizeResponse(method, path, response);

      if (!this.online) {
        this.online = true;
        this.rs._emit('network-online');
      }
      this.rs._emit('wire-done', {
        method: method,
        isFolder: isFolder(path),
        success: true
      });

      if (normalized.statusCode === 401) {
        this.rs._emit('error', new UnauthorizedError());
      }

      return normalized;
    } catch (error) {
      if (this.online) {
        this.online = false;
        this.rs._emit('network-offline');
      }
      this.rs._emit('wire-done', {
        method: method,
        isFolder: isFolder(path),
        success: false
      });

      throw error;
    }
  }

  private async _normalizeResponse (
    method: 'GET' | 'PUT' | 'DELETE',
    path: string,
    response: ExtensionBridgeRequestResponse
  ): Promise<RemoteResponse> {
    if (isErrorStatus(response.statusCode)) {
      return {
        statusCode: response.statusCode,
        revision: response.revision
      };
    } else if (isSuccessStatus(response.statusCode) ||
      (response.statusCode === 200 && method !== 'GET')) {
      return {
        statusCode: response.statusCode,
        revision: response.revision
      };
    }

    const mimeType = response.contentType;
    const revision = response.statusCode === 200 ? response.revision : undefined;

    if (response.body instanceof ArrayBuffer ||
        (typeof response.body === 'string' && shouldBeTreatedAsBinary(response.body, mimeType))) {
      return {
        statusCode: response.statusCode,
        body: response.body,
        contentType: mimeType,
        revision: revision
      };
    }

    if (typeof response.body === 'string' || typeof response.body === 'object' || typeof response.body === 'undefined') {
      return {
        statusCode: response.statusCode,
        body: response.body,
        contentType: mimeType,
        revision: revision
      };
    }

    throw new Error('Unsupported extension response body.');
  }

  configure (settings: RemoteSettings & { grantedScopes?: string; sessionId?: string; }): void {
    if (typeof settings !== 'object') {
      throw new Error('ExtensionRemote configure settings parameter should be an object');
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
    if (typeof settings.properties !== 'undefined') {
      this.properties = settings.properties;
    }
    if (typeof settings.sessionId !== 'undefined') {
      this.sessionId = settings.sessionId;
    }
    if (typeof settings.grantedScopes !== 'undefined') {
      this.grantedScopes = settings.grantedScopes;
    }

    if (typeof this.storageApi === 'string') {
      const storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
      this.supportsRevs = storageApi >= API_00;
    }

    if (this.href && this.sessionId) {
      this.connected = true;
      this.online = true;
      this._emit('connected');
    } else {
      this.connected = false;
    }

    if (hasLocalStorage) {
      const storedSettings = getJSONFromLocalStorage(SETTINGS_KEY);
      if (storedSettings && typeof storedSettings === 'object') {
        delete storedSettings.token;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(storedSettings));
      }
    }
  }

  async get (path: string, options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    if (!this.connected) {
      return Promise.reject('not connected (path: ' + path + ')');
    }

    const headers = {};
    if (this.supportsRevs && options.ifNoneMatch) {
      headers['If-None-Match'] = this.addQuotes(options.ifNoneMatch);
    }

    const response = await this._request('GET', path, headers);
    if (!isFolder(path)) {
      return response;
    }

    let itemsMap = {};
    if (typeof (response.body) !== 'undefined') {
      try {
        response.body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      } catch (error) {
        return Promise.reject('Folder description at ' + this.href + cleanPath(path) + ' is not JSON');
      }
    }

    if (response.statusCode === 200 && typeof (response.body) === 'object') {
      if (Object.keys(response.body).length === 0) {
        response.statusCode = 404;
      } else if (isFolderDescription(response.body)) {
        for (const item in response.body.items) {
          this._revisionCache[path + item] = response.body.items[item].ETag;
        }
        itemsMap = response.body.items;
      } else {
        Object.keys(response.body).forEach((key) => {
          this._revisionCache[path + key] = response.body[key];
          itemsMap[key] = {'ETag': response.body[key]};
        });
      }
      response.body = itemsMap;
    }

    return response;
  }

  put (path: string, body: XMLHttpRequestBodyInit, contentType: string, options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    if (!this.connected) {
      return Promise.reject('not connected (path: ' + path + ')');
    }

    const headers = {
      'Content-Type': contentType
    };
    if (this.supportsRevs) {
      if (options.ifMatch) {
        headers['If-Match'] = this.addQuotes(options.ifMatch);
      }
      if (options.ifNoneMatch) {
        headers['If-None-Match'] = this.addQuotes(options.ifNoneMatch);
      }
    }

    return this._request('PUT', path, headers, body);
  }

  delete (path: string, options: { ifMatch?: string } = {}): Promise<RemoteResponse> {
    if (!this.connected) {
      return Promise.reject('not connected (path: ' + path + ')');
    }

    const headers = {};
    if (this.supportsRevs && options.ifMatch) {
      headers['If-Match'] = this.addQuotes(options.ifMatch);
    }

    return this._request('DELETE', path, headers);
  }

  static async _rs_supported (): Promise<boolean> {
    try {
      return await ExtensionBridge.isAvailable();
    } catch (error) {
      log('[ExtensionRemote] support check failed', error);
      return false;
    }
  }
}

export default ExtensionRemote;
