import type { QueuedRequestResponse } from './interfaces/queued_request_response';
import type { RemoteResponse } from './remote';
import log from './log';

function shareFirst(path: string): boolean {
  return ( ['dropbox', 'googledrive', 'solid'].includes(this.backend) &&
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
  get: function (path: string, maxAge: undefined | false | number): Promise<QueuedRequestResponse | RemoteResponse> {
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

  put: function (path: string, body: unknown, contentType: string): Promise<QueuedRequestResponse | RemoteResponse> {
    if (shareFirst.bind(this)(path)) {
      return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
    }
    else if (this.local) {
      return this.local.put(path, body, contentType);
    } else {
      return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
    }
  },

  'delete': async function (path: string, remoteConnected: boolean): Promise<QueuedRequestResponse | RemoteResponse> {
    // Public uploads bypass the cache, so deletion must reach the provider too.
    if (shareFirst.bind(this)(path)) {
      const response = await SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path, remoteConnected));
      if (this.local && ((response.statusCode >= 200 && response.statusCode < 300) || response.statusCode === 404)) {
        await this.local.flush(path);
      }
      return response;
    }
    if (this.local) {
      return this.local.delete(path, remoteConnected);
    } else {
      return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path, remoteConnected));
    }
  },

  _wrapBusyDone: async function (result: Promise<QueuedRequestResponse | RemoteResponse>): Promise<QueuedRequestResponse | RemoteResponse> {
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
