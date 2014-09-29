(function (global) {
  /**
   * Class: RemoteStorage.InMemoryStorage
   *
   * In-memory caching adapter. Used when no IndexedDB or localStorage
   * available.
   **/

  RemoteStorage.InMemoryStorage = function () {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.log('[InMemoryStorage] Registering events');
    RemoteStorage.eventHandling(this, 'change', 'local-events-done');

    this._storage = {};
  };

  RemoteStorage.InMemoryStorage.prototype = {

    getNodes: function (paths) {
      var nodes = {};

      for(var i = 0, len = paths.length; i < len; i++) {
        nodes[paths[i]] = this._storage[paths[i]];
      }

      return Promise.resolve(nodes);
    },

    setNodes: function (nodes) {
      for (var path in nodes) {
        if (nodes[path] === undefined) {
          delete this._storage[path];
        } else {
          this._storage[path] = nodes[path];
        }
      }

      return Promise.resolve();
    },

    forAllNodes: function (cb) {
      for (var path in this._storage) {
        cb(this.migrate(this._storage[path]));
      }
      return Promise.resolve();
    }

  };

  RemoteStorage.InMemoryStorage._rs_init = function () {};

  RemoteStorage.InMemoryStorage._rs_supported = function () {
    // In-memory storage is always supported
    return true;
  };

  RemoteStorage.InMemoryStorage._rs_cleanup = function () {};
})(typeof(window) !== 'undefined' ? window : global);