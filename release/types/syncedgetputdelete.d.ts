declare const SyncedGetPutDelete: {
    get: (path: string, maxAge: number | false) => Promise<unknown>;
    put: (path: string, body: unknown, contentType: string) => Promise<unknown>;
    delete: (path: string) => Promise<unknown>;
    _wrapBusyDone: (result: Promise<unknown>) => Promise<unknown>;
};
export default SyncedGetPutDelete;
//# sourceMappingURL=syncedgetputdelete.d.ts.map