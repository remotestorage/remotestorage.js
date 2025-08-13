import type { QueuedRequestResponse } from './interfaces/queued_request_response';
import type { RemoteResponse } from './remote';
declare const SyncedGetPutDelete: {
    get: (path: string, maxAge: undefined | false | number) => Promise<QueuedRequestResponse | RemoteResponse>;
    put: (path: string, body: unknown, contentType: string) => Promise<QueuedRequestResponse | RemoteResponse>;
    delete: (path: string, remoteConnected: boolean) => Promise<QueuedRequestResponse | RemoteResponse>;
    _wrapBusyDone: (result: Promise<QueuedRequestResponse | RemoteResponse>) => Promise<QueuedRequestResponse | RemoteResponse>;
};
export = SyncedGetPutDelete;
//# sourceMappingURL=syncedgetputdelete.d.ts.map