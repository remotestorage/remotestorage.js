import type { StorageInfo } from './interfaces/storage_info';
declare type ExtensionBridgeErrorCode = 'denied' | 'not_available' | 'not_authenticated' | 'unsupported' | 'invalid_response' | 'request_failed';
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
interface ExtensionProvider {
    connect?(request: ExtensionBridgeConnectRequest): Promise<ExtensionBridgeConnectResponse>;
    disconnect?(sessionId: string): Promise<void> | void;
    ping?(): Promise<ExtensionBridgePingResult> | ExtensionBridgePingResult;
    request?(request: ExtensionBridgeRequestOptions): Promise<ExtensionBridgeRequestResponse>;
    version?: number | string;
}
export declare class ExtensionBridgeError extends Error {
    code: ExtensionBridgeErrorCode;
    fallback: boolean;
    constructor(message: string, code: ExtensionBridgeErrorCode, fallback: boolean);
}
export declare class ExtensionBridge {
    static getProvider(): ExtensionProvider | undefined;
    static isAvailable(): Promise<boolean>;
    static connect(request: ExtensionBridgeConnectRequest): Promise<ExtensionBridgeConnectResponse>;
    static ping(): Promise<ExtensionBridgePingResult>;
    static request(request: ExtensionBridgeRequestOptions): Promise<ExtensionBridgeRequestResponse>;
    static disconnect(sessionId: string): Promise<void>;
    private static getAvailableProvider;
}
export default ExtensionBridge;
//# sourceMappingURL=extension-bridge.d.ts.map