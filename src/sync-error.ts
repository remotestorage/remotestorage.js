class SyncError extends Error {
  originalError: Error;

  constructor (originalError: string | Error) {
    super();
    this.name = 'SyncError';
    this.message = 'Sync failed: ';
    if (typeof originalError === 'string') {
      this.message += originalError;
    } else {
      this.message += originalError.message;
      this.stack = originalError.stack;
      this.originalError = originalError;
    }
  }
}

export = SyncError;
