import type RemoteStorage from './remotestorage';
import type { RSItem, RSNode, RSNodes } from './interfaces/rs_node';
import type { QueuedRequestResponse } from './interfaces/queued_request_response';
import type { RemoteResponse } from './remote';
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
    action: "get" | "put" | "delete";
    path: string;
    promise: Promise<RemoteResponse>;
}
/**
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
 */
export declare class Sync {
    rs: RemoteStorage;
    /**
     * Maximum number of parallel requests to execute
     */
    numThreads: number;
    /**
     * Sync done? `false` when periodic sync is currently running
     */
    done: boolean;
    /**
     * Sync stopped entirely
     */
    stopped: boolean;
    /**
     * Paths queued for sync, sometimes with callbacks
     */
    _tasks: {
        [key: string]: Array<() => void>;
    };
    /**
     * Promises of currently running sync tasks per path
     */
    _running: {
        [key: string]: Promise<SyncTask>;
    };
    /**
     * Start times of current sync per path
     */
    _timeStarted: {
        [key: string]: number;
    };
    /**
     * Holds finished tasks for orderly processing
     */
    _finishedTasks: SyncTask[];
    constructor(remoteStorage: RemoteStorage);
    /**
     * Return current time
     */
    now(): number;
    /**
     * When getting a path from the caching layer, this function might be handed
     * in to first check if it was updated on the remote, in order to fulfill a
     * maxAge requirement
     */
    queueGetRequest(path: string): Promise<QueuedRequestResponse>;
    corruptServerItemsMap(itemsMap: any): boolean;
    corruptItemsMap(itemsMap: any): boolean;
    corruptRevision(rev: any): boolean;
    isCorrupt(node: RSNode): boolean;
    hasTasks(): boolean;
    /**
     * Collect sync tasks for changed nodes
     */
    collectDiffTasks(): Promise<number>;
    inConflict(node: RSNode): boolean;
    needsRefresh(node: RSNode): boolean;
    needsFetch(node: RSNode): boolean;
    needsPush(node: RSNode): boolean;
    needsRemotePut(node: RSNode): boolean;
    needsRemoteDelete(node: RSNode): boolean;
    getParentPath(path: string): string;
    deleteChildPathsFromTasks(): void;
    /**
     * Collect tasks to refresh highest outdated folder in tree
     */
    collectRefreshTasks(): Promise<void>;
    /**
     * Flush nodes from cache after sync to remote
     */
    flush(nodes: RSNodes): RSNodes;
    /**
     * Sync one path
     */
    doTask(path: string): Promise<SyncTask>;
    /**
     * Merge/process folder node items after updates from remote
     */
    autoMergeFolder(node: RSNode): RSNode;
    /**
     * Merge/process document node items after updates from remote
     */
    autoMergeDocument(node: RSNode): RSNode;
    /**
     * Merge/process node items after various updates from remote
     */
    autoMerge(node: RSNode): RSNode;
    updateCommonTimestamp(path: string, revision: string): Promise<void>;
    /**
     * After successful GET of a folder, mark its children/items for
     * changes and further processing
     */
    markChildren(path: string, itemsMap: RSItem["itemsMap"], changedNodes: RSNodes, missingChildren: {
        [key: string]: boolean;
    }): Promise<void>;
    /**
     * Recursively process paths to mark documents as remotely deleted
     * where applicable
     */
    markRemoteDeletions(paths: string[], changedNodes: RSNodes): Promise<RSNodes | void>;
    /**
     * Complete a successful GET request
     */
    completeFetch(path: string, bodyOrItemsMap: RSItem["body"], contentType: string, revision: string): Promise<any>;
    /**
     * Handle successful PUT or DELETE request
     */
    completePush(path: string, action: "put" | "delete", conflict: boolean, revision: string): Promise<void>;
    /**
     * Remove push item from cached nodes that failed to sync
     */
    dealWithFailure(path: string): Promise<void>;
    interpretStatus(statusCode: string | number): ResponseStatus;
    /**
     * Handle successful GET request
     */
    handleGetResponse(path: string, status: ResponseStatus, bodyOrItemsMap: RSItem["body"], contentType: string, revision: string): Promise<boolean>;
    /**
     * Handle response of executed request
     */
    handleResponse(path: string, action: SyncTask["action"], r: RemoteResponse): Promise<boolean>;
    /**
     * Execute/finish running tasks, one at a time
     */
    finishTask(task: SyncTask, queueTask?: boolean): Promise<void>;
    finishSuccessfulTask(task: SyncTask, completed: boolean): Promise<void>;
    finishUnsuccessfulTask(task: SyncTask, err: Error): Promise<void>;
    /**
     * Determine how many tasks we want to have
     */
    tasksWanted(): number;
    /**
     * Check if more tasks can be queued, and start running
     * tasks
     *
     * @returns {Boolean} `true` when all tasks have been started or
     *                    there's nothing to do, `false` if we could
     *                    or want to run more
     */
    doTasks(): boolean;
    /**
     * Collect any potential sync tasks if none are queued
     */
    collectTasks(alsoCheckRefresh?: boolean): Promise<void>;
    /**
     * Add a sync task for the given path
     */
    addTask(path: string, cb?: () => void): void;
    /**
     * Start a sync procedure
     */
    sync(): Promise<void>;
    static _rs_init(remoteStorage: RemoteStorage): void;
    static _rs_cleanup(remoteStorage: RemoteStorage): void;
}
export interface Sync extends EventHandling {
}
export default Sync;
//# sourceMappingURL=sync.d.ts.map