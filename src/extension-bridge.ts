import log from './log';

import type { StorageInfo } from './interfaces/storage_info';

const BRIDGE_EVENT = 'remotestorage-bridge';
let handshakeTimeoutMs = 2000;
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

/**
 * Internal message envelope sent via CustomEvent to the extension's content
 * script, and returned via a responding CustomEvent.
 */
interface BridgeMessage {
  id: string;
  method: string;
  payload?: unknown;
}

interface BridgeResponse {
  id: string;
  payload?: unknown;
  error?: unknown;
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

function validateResponseFields (response: unknown): ExtensionBridgeRequestResponse {
  if (!response || typeof response !== 'object') {
    throw new ExtensionBridgeError('Extension provider returned an invalid response.', 'invalid_response', true);
  }
  const r = response as Record<string, unknown>;
  if (typeof r.statusCode !== 'number') {
    throw new ExtensionBridgeError('Extension provider returned an invalid response: missing statusCode.', 'invalid_response', true);
  }
  if (r.contentType !== undefined && typeof r.contentType !== 'string') {
    throw new ExtensionBridgeError('Extension provider returned an invalid response: contentType must be a string.', 'invalid_response', true);
  }
  if (r.revision !== undefined && typeof r.revision !== 'string') {
    throw new ExtensionBridgeError('Extension provider returned an invalid response: revision must be a string.', 'invalid_response', true);
  }
  if (r.body !== undefined &&
      typeof r.body !== 'string' &&
      typeof r.body !== 'object' &&
      !(r.body instanceof ArrayBuffer)) {
    throw new ExtensionBridgeError('Extension provider returned an invalid response: unsupported body type.', 'invalid_response', true);
  }
  return response as ExtensionBridgeRequestResponse;
}

function generateMessageId (): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
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

/**
 * Sends a message to the extension via CustomEvent and waits for a
 * response CustomEvent with a matching `id`. This avoids trusting any
 * global object that page scripts could spoof.
 *
 * The extension's content script listens for `remotestorage-bridge`
 * events on `document` and replies with the same event name, including
 * the original `id` in the response detail.
 */
function sendBridgeMessage (method: string, payload?: unknown, timeoutMs = handshakeTimeoutMs): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = generateMessageId();
    let settled = false;

    function onResponse (event: CustomEvent<BridgeResponse & { direction?: string }>): void {
      const detail = event.detail;
      if (!detail || detail.id !== id || detail.direction === 'page-to-extension') {
        return;
      }
      if (settled) { return; }
      settled = true;
      document.removeEventListener(BRIDGE_EVENT, onResponse as EventListener);

      if (detail.error) {
        reject(detail.error);
      } else {
        resolve(detail.payload);
      }
    }

    document.addEventListener(BRIDGE_EVENT, onResponse as EventListener);

    const request: BridgeMessage = { id, method, payload };
    document.dispatchEvent(new CustomEvent(BRIDGE_EVENT, {
      detail: { ...request, direction: 'page-to-extension' }
    }));

    setTimeout(() => {
      if (settled) { return; }
      settled = true;
      document.removeEventListener(BRIDGE_EVENT, onResponse as EventListener);
      reject(new ExtensionBridgeError('Extension bridge handshake timed out.', 'not_available', true));
    }, timeoutMs);
  });
}

export class ExtensionBridge {
  private static _verified = false;

  /**
   * Perform a version handshake with the extension via the message-based
   * channel. Returns true only if a trusted extension responds with a
   * supported version.
   */
  static async isAvailable (): Promise<boolean> {
    try {
      await this._verifyExtension();
      return true;
    } catch (error) {
      if (error instanceof ExtensionBridgeError) {
        return false;
      }
      throw error;
    }
  }

  static async connect (request: ExtensionBridgeConnectRequest): Promise<ExtensionBridgeConnectResponse> {
    await this._verifyExtension();

    let response: ExtensionBridgeConnectResponse;
    try {
      response = await sendBridgeMessage('connect', request) as ExtensionBridgeConnectResponse;
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
    try {
      const result = await sendBridgeMessage('ping') as ExtensionBridgePingResult;
      return result || {};
    } catch (error) {
      throw normalizeError(error, true);
    }
  }

  static async request (request: ExtensionBridgeRequestOptions): Promise<ExtensionBridgeRequestResponse> {
    await this._verifyExtension();

    try {
      const response = await sendBridgeMessage('request', request);
      return validateResponseFields(response);
    } catch (error) {
      throw normalizeError(error, true);
    }
  }

  static async disconnect (sessionId: string): Promise<void> {
    try {
      await sendBridgeMessage('disconnect', sessionId);
    } catch (error) {
      log('[ExtensionBridge] disconnect failed:', error);
    }
  }

  /**
   * Verify the extension is present and running a supported version via
   * the message-based channel.
   */
  private static async _verifyExtension (): Promise<void> {
    if (this._verified) {
      return;
    }

    let pingResult: ExtensionBridgePingResult;
    try {
      pingResult = await sendBridgeMessage('ping') as ExtensionBridgePingResult;
    } catch (error) {
      if (error instanceof ExtensionBridgeError) {
        throw error;
      }
      throw new ExtensionBridgeError('No remoteStorage extension bridge detected.', 'not_available', true);
    }

    if (!pingResult) {
      throw new ExtensionBridgeError('No remoteStorage extension bridge detected.', 'not_available', true);
    }

    const version = parseVersion(pingResult.version);
    if (version !== SUPPORTED_VERSION) {
      throw new ExtensionBridgeError('Unsupported remoteStorage extension bridge version.', 'unsupported', true);
    }

    this._verified = true;
  }

  /**
   * Reset verification state. Useful for testing or when the extension
   * may have been unloaded.
   *
   * @internal
   */
  static _resetVerification (): void {
    this._verified = false;
  }

  /**
   * Set the handshake timeout in milliseconds.
   *
   * @internal
   */
  static _setHandshakeTimeout (ms: number): void {
    handshakeTimeoutMs = ms;
  }
}

export default ExtensionBridge;
