import { getGlobalContext } from './util';

import type { StorageInfo } from './interfaces/storage_info';

const PROVIDER_KEYS = [
  'remoteStorageExtension',
  'RemoteStorageExtension',
  '__remoteStorageExtension'
];
const SUPPORTED_VERSION = 1;

type ExtensionBridgeErrorCode = 'denied' | 'not_available' | 'not_authenticated' | 'unsupported' | 'invalid_response' | 'request_failed';

export interface ExtensionBridgePingResult {
  accounts?: ExtensionBridgeAccount[];
  activeAccountId?: string | null;
  version?: number | string;
}

export interface ExtensionBridgeAccount {
  accountId: string;
  active?: boolean;
  authURL?: string;
  href: string;
  storageApi: string;
  userAddress: string;
}

export interface ExtensionBridgeConnectRequest extends StorageInfo {
  backend: 'remotestorage';
  clientId?: string;
  origin: string;
  redirectUri?: string;
  requestedScopes: string;
  userAddress?: string;
}

export interface ExtensionBridgeConnectResponse {
  sessionId: string;
  grantedScopes?: string;
  href: string;
  storageApi: string;
  userAddress: string;
}

export interface ExtensionBridgeRequestOptions {
  body?: XMLHttpRequestBodyInit;
  contentType?: string;
  headers?: HeadersInit;
  ifMatch?: string;
  ifNoneMatch?: string;
  method: 'GET' | 'PUT' | 'DELETE';
  path: string;
  sessionId: string;
}

export interface ExtensionBridgeRequestResponse {
  body?: string | { [key: string]: any; } | ArrayBuffer;
  contentType?: string;
  revision?: string;
  statusCode: number;
}

interface ExtensionProvider {
  connect?(request: ExtensionBridgeConnectRequest): Promise<ExtensionBridgeConnectResponse>;
  disconnect?(sessionId: string): Promise<void> | void;
  ping?(): Promise<ExtensionBridgePingResult> | ExtensionBridgePingResult;
  request?(request: ExtensionBridgeRequestOptions): Promise<ExtensionBridgeRequestResponse>;
  version?: number | string;
}

function parseVersion (version: number | string | undefined): number {
  if (typeof version === 'number') {
    return version;
  }
  if (typeof version === 'string') {
    const major = parseInt(version.split('.')[0], 10);
    if (!Number.isNaN(major)) {
      return major;
    }
  }
  return 0;
}

function normalizeError (error: unknown, fallback = false): ExtensionBridgeError {
  if (error instanceof ExtensionBridgeError) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const code = typeof error['code'] === 'string' ? error['code'] : undefined;
    const message = typeof error['message'] === 'string' ? error['message'] : undefined;
    const errorName = typeof error['error'] === 'string' ? error['error'] : undefined;
    const normalizedCode = code || errorName;

    if (normalizedCode && ['denied', 'access_denied', 'extension_denied'].includes(normalizedCode)) {
      return new ExtensionBridgeError(message || 'Extension access denied.', 'denied', false);
    }

    if (normalizedCode && ['not_authenticated', 'no_account'].includes(normalizedCode)) {
      return new ExtensionBridgeError(message || 'No matching extension account is authenticated.', 'not_authenticated', false);
    }

    if (message) {
      return new ExtensionBridgeError(message, 'request_failed', fallback);
    }
  }

  if (typeof error === 'string') {
    if (['denied', 'access_denied', 'extension_denied'].includes(error)) {
      return new ExtensionBridgeError('Extension access denied.', 'denied', false);
    }
    if (['not_authenticated', 'no_account'].includes(error)) {
      return new ExtensionBridgeError('No matching extension account is authenticated.', 'not_authenticated', false);
    }
    return new ExtensionBridgeError(error, 'request_failed', fallback);
  }

  return new ExtensionBridgeError('Extension bridge request failed.', 'request_failed', fallback);
}

export class ExtensionBridgeError extends Error {
  code: ExtensionBridgeErrorCode;
  fallback: boolean;

  constructor (message: string, code: ExtensionBridgeErrorCode, fallback: boolean) {
    super(message);
    this.name = 'ExtensionBridgeError';
    this.code = code;
    this.fallback = fallback;
  }
}

export class ExtensionBridge {
  static getProvider (): ExtensionProvider | undefined {
    const context = getGlobalContext();

    for (const key of PROVIDER_KEYS) {
      const provider = context[key] as ExtensionProvider | undefined;
      if (provider) {
        return provider;
      }
    }
  }

  static async isAvailable (): Promise<boolean> {
    try {
      await this.getAvailableProvider();
      return true;
    } catch (error) {
      if (error instanceof ExtensionBridgeError) {
        return false;
      }
      throw error;
    }
  }

  static async connect (request: ExtensionBridgeConnectRequest): Promise<ExtensionBridgeConnectResponse> {
    const provider = await this.getAvailableProvider();

    if (typeof provider.connect !== 'function') {
      throw new ExtensionBridgeError('Extension provider does not support connect().', 'unsupported', true);
    }

    let response: ExtensionBridgeConnectResponse;
    try {
      response = await provider.connect(request);
    } catch (error) {
      throw normalizeError(error, true);
    }

    if (!response || typeof response.sessionId !== 'string' || typeof response.href !== 'string' ||
        typeof response.storageApi !== 'string' || typeof response.userAddress !== 'string') {
      throw new ExtensionBridgeError('Extension provider returned an invalid connect response.', 'invalid_response', true);
    }

    return response;
  }

  static async ping (): Promise<ExtensionBridgePingResult> {
    const provider = await this.getAvailableProvider();

    if (typeof provider.ping === 'function') {
      try {
        return await provider.ping();
      } catch (error) {
        throw normalizeError(error, true);
      }
    }

    return {
      version: provider.version
    };
  }

  static async request (request: ExtensionBridgeRequestOptions): Promise<ExtensionBridgeRequestResponse> {
    const provider = await this.getAvailableProvider();

    if (typeof provider.request !== 'function') {
      throw new ExtensionBridgeError('Extension provider does not support request().', 'unsupported', true);
    }

    try {
      const response = await provider.request(request);
      if (!response || typeof response.statusCode !== 'number') {
        throw new ExtensionBridgeError('Extension provider returned an invalid response.', 'invalid_response', true);
      }
      return response;
    } catch (error) {
      throw normalizeError(error, true);
    }
  }

  static async disconnect (sessionId: string): Promise<void> {
    const provider = this.getProvider();

    if (!provider || typeof provider.disconnect !== 'function') {
      return;
    }

    try {
      await provider.disconnect(sessionId);
    } catch (_error) {
      return;
    }
  }

  private static async getAvailableProvider (): Promise<ExtensionProvider> {
    const provider = this.getProvider();
    if (!provider) {
      throw new ExtensionBridgeError('No remoteStorage extension bridge detected.', 'not_available', true);
    }

    const pingResult = typeof provider.ping === 'function' ? await provider.ping() : { version: provider.version };
    const version = parseVersion(pingResult?.version ?? provider.version);

    if (version !== SUPPORTED_VERSION) {
      throw new ExtensionBridgeError('Unsupported remoteStorage extension bridge version.', 'unsupported', true);
    }

    return provider;
  }
}

export default ExtensionBridge;
