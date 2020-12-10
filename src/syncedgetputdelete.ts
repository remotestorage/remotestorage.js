import log from './log';

function shareFirst(path: string): boolean {
  return ( this.backend === 'dropbox' &&
           !!path.match(/^\/public\/.*[^\/]$/) );
}

function defaultMaxAge(context): false | number {
  if ((typeof context.remote === 'object') &&
      context.remote.connected && context.remote.online) {
    return 2 * context.getSyncInterval();
  } else {
    log('Not setting default maxAge, because remote is offline or not connected');
    return false;
  }
}

const SyncedGetPutDelete = {
  get: function (path: string, maxAge: undefined | false | number): Promise<unknown> {
    if (!this.local) {
      return this.remote.get(path);
    } else {
      if (typeof maxAge === 'undefined') {
        maxAge = defaultMaxAge(this);
      } else if (typeof maxAge !== 'number' && maxAge !== false) {
        return Promise.reject(`Argument 'maxAge' must be 'false' or a number`);
      }
      return this.local.get(path, maxAge, this.sync.queueGetRequest.bind(this.sync));
    }
  },

  put: function (path: string, body: unknown, contentType: string): Promise<unknown> {
    if (shareFirst.bind(this)(path)) {
      return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
    }
    else if (this.local) {
      return this.local.put(path, body, contentType);
    } else {
      return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
    }
  },

  'delete': function (path: string): Promise<unknown> {
    if (this.local) {
      return this.local.delete(path);
    } else {
      return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path));
    }
  },

  _wrapBusyDone: async function (result: Promise<unknown>): Promise<unknown> {
    this._emit('wire-busy');
    return result.then((r) => {
      this._emit('wire-done', { success: true });
      return Promise.resolve(r);
    }, (err: Error) => {
      this._emit('wire-done', { success: false });
      return Promise.reject(err);
    });
  }
};

export = SyncedGetPutDelete;
