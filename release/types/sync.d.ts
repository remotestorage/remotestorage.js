import type { RSNode, RSNodes } from './interfaces/rs_node';
import EventHandling from './eventhandling';
interface ResponseStatus {
    statusCode: string | number;
    successful: boolean | undefined;
    conflict: boolean | undefined;
    unAuth: boolean | undefined;
    notFound: boolean | undefined;
    changed: boolean | undefined;
    networkProblems: boolean | undefined;
}
interface SyncTask {
    action: any;
    path: string;
    promise: Promise<any>;
}
/**
 * Class: RemoteStorage.Sync
 *
 * This class basically does six things:
 *
 * - retrieve the remote version of relevant documents and folders
 * - add all local and remote documents together into one tree
 * - push local documents out if they don't exist remotely
 * - push local changes out to remote documents (conditionally, to avoid race
 *   conditions where both have changed)
 * - adopt the local version of a document to its remote version if both exist
 *   and they differ
 * - delete the local version of a document if it was deleted remotely
 * - if any GET requests were waiting for remote data, resolve them once this
 *   data comes in.
 *
 * It does this using requests to documents and folders. Whenever a folder GET
 * comes in, it gives information about all the documents it contains (this is
 * the `markChildren` function).
 **/
declare class Sync {
    rs: {
        [propName: string]: any;
    };
    numThreads: number;
    done: boolean;
    stopped: boolean;
    _tasks: object;
    _running: object;
    _timeStarted: object;
    _finishedTasks: Array<SyncTask>;
    constructor(remoteStorage: object);
    now(): number;
    queueGetRequest(path: string): object;
    corruptServerItemsMap(itemsMap: any, force02?: boolean): boolean;
    corruptItemsMap(itemsMap: any): boolean;
    corruptRevision(rev: any): boolean;
    isCorrupt(node: RSNode): boolean;
    hasTasks(): boolean;
    collectDiffTasks(): Promise<number>;
    inConflict(node: RSNode): boolean;
    needsRefresh(node: RSNode): boolean;
    needsFetch(node: RSNode): boolean;
    needsPush(node: RSNode): boolean;
    needsRemotePut(node: RSNode): boolean;
    needsRemoteDelete(node: RSNode): boolean;
    getParentPath(path: string): string;
    deleteChildPathsFromTasks(): void;
    collectRefreshTasks(): Promise<void>;
    flush(nodes: RSNodes): RSNodes;
    doTask(path: string): object;
    autoMergeFolder(node: RSNode): RSNode;
    autoMergeDocument(node: RSNode): RSNode;
    autoMerge(node: RSNode): RSNode;
    updateCommonTimestamp(path: string, revision: string): Promise<void>;
    markChildren(path: any, itemsMap: any, changedNodes: RSNodes, missingChildren: any): Promise<void>;
    deleteRemoteTrees(paths: Array<string>, changedNodes: RSNodes): Promise<RSNodes>;
    completeFetch(path: string, bodyOrItemsMap: object, contentType: string, revision: string): Promise<any>;
    completePush(path: string, action: any, conflict: any, revision: string): Promise<void>;
    dealWithFailure(path: string): Promise<void>;
    interpretStatus(statusCode: string | number): ResponseStatus;
    handleGetResponse(path: string, status: ResponseStatus, bodyOrItemsMap: any, contentType: string, revision: string): Promise<boolean>;
    handleResponse(path: string, action: any, r: any): Promise<boolean>;
    finishTask(task: SyncTask, queueTask?: boolean): void | Promise<void>;
    doTasks(): boolean;
    collectTasks(alsoCheckRefresh?: boolean): Promise<void>;
    addTask(path: string, cb?: any): void;
    /**
     * Method: sync
     **/
    sync(): Promise<void>;
    static _rs_init(remoteStorage: any): void;
    static _rs_cleanup(remoteStorage: any): void;
}
interface Sync extends EventHandling {
}
export = Sync;
//# sourceMappingURL=sync.d.ts.map