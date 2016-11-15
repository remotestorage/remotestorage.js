  var eventHandling = require('./eventhandling');
  var log = require('./log');
  var cachingLayer = require('./cachinglayer');
  /**
   * Class: RemoteStorage.InMemoryStorage
   *
   * In-memory caching adapter. Used when no IndexedDB or localStorage
   * available.
   **/

  var InMemoryStorage = function () {
    cachingLayer(this);
    log('[InMemoryStorage] Registering events');
    eventHandling(this, 'change', 'local-events-done');

    this._storage = {};
  };

  InMemoryStorage.prototype = {

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

  InMemoryStorage._rs_init = function () {};

  InMemoryStorage._rs_supported = function () {
    // In-memory storage is always supported
    return true;
  };

  InMemoryStorage._rs_cleanup = function () {};

  module.exports = InMemoryStorage;