export default class SyncError extends Error {
    originalError: Error;
    constructor(originalError: string | Error);
}
