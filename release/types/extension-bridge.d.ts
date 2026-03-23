import type { StorageInfo } from './interfaces/storage_info';
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
    body?: string | {
        [key: string]: any;
    } | ArrayBuffer;
    contentType?: string;
    revision?: string;
    statusCode: number;
}
export declare class ExtensionBridgeError extends Error {
    code: ExtensionBridgeErrorCode;
    fallback: boolean;
    constructor(message: string, code: ExtensionBridgeErrorCode, fallback: boolean);
}
export declare class ExtensionBridge {
    private static _verified;
    /**
     * Perform a version handshake with the extension via the message-based
     * channel. Returns true only if a trusted extension responds with a
     * supported version.
     */
    static isAvailable(): Promise<boolean>;
    static connect(request: ExtensionBridgeConnectRequest): Promise<ExtensionBridgeConnectResponse>;
    static ping(): Promise<ExtensionBridgePingResult>;
    static request(request: ExtensionBridgeRequestOptions): Promise<ExtensionBridgeRequestResponse>;
    static disconnect(sessionId: string): Promise<void>;
    /**
     * Verify the extension is present and running a supported version via
     * the message-based channel.
     */
    private static _verifyExtension;
    /**
     * Reset verification state. Useful for testing or when the extension
     * may have been unloaded.
     *
     * @internal
     */
    static _resetVerification(): void;
    /**
     * Set the handshake timeout in milliseconds.
     *
     * @internal
     */
    static _setHandshakeTimeout(ms: number): void;
}
export default ExtensionBridge;
//# sourceMappingURL=extension-bridge.d.ts.map