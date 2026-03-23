import type RemoteStorage from './remotestorage';
import { Remote, RemoteBase, RemoteResponse, RemoteSettings } from './remote';
declare class ExtensionRemote extends RemoteBase implements Remote {
    grantedScopes: string;
    href: string;
    properties: object;
    sessionId: string;
    supportsRevs: boolean;
    token: undefined;
    _revisionCache: {
        [key: string]: any;
    };
    constructor(rs: RemoteStorage);
    disconnect(): Promise<void>;
    private _request;
    private _normalizeResponse;
    configure(settings: RemoteSettings & {
        grantedScopes?: string;
        sessionId?: string;
    }): void;
    get(path: string, options?: {
        ifMatch?: string;
        ifNoneMatch?: string;
    }): Promise<RemoteResponse>;
    put(path: string, body: XMLHttpRequestBodyInit, contentType: string, options?: {
        ifMatch?: string;
        ifNoneMatch?: string;
    }): Promise<RemoteResponse>;
    delete(path: string, options?: {
        ifMatch?: string;
    }): Promise<RemoteResponse>;
    static _rs_supported(): Promise<boolean>;
}
export default ExtensionRemote;
//# sourceMappingURL=extension-remote.d.ts.map