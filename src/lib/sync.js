/*global localStorage */

define([
  './util',
  './store/local',
  './store/remote',
  './store/fallback'
], function(util, LocalStore, RemoteStore, FallbackStore) {

  "use strict";

  var Sync = function(controller) {
    this._remote = new RemoteStore(controller.platform.http);
    this.local = new LocalStore(controller.platform.localStore);
    this.caching = controller.caching;
    this.access = controller.access;
    this.remote = new FallbackStore(this._remote, this.local, this.caching);
  };

  Sync.prototype = {

    get: function(path) {
      return (
        this.caching.cachePath(path) ? this.local : this.remote
      ).get(path);
    },

    set: function(path, node) {
      if(this.caching.cachePath(path)) {
        return util.asyncGroup(
          util.curry(this.local.set, path, node),
          util.curry(this.remote.set, path, node)
        );
      } else {
        return this.remote.set(path, node);
      }
    },

    remove: function(path) {
      if(this.caching.cachePath(path)) {
        return util.asyncGroup(
          util.curry(this.local.remove, path),
          util.curry(this.remote.remove, path)
        );
      } else {
        return this.remote.remove(path);
      }
    },

    sync: function() {
      return util.asyncEach(this.computeSyncSettings(), function(settings) {
        return this.syncPath(settings.path, settings.access, settings.caching);
      }.bind(this));
    },

    syncPath: function(path, accessMode, cachingMode) {
      return this.remote.get(path).then(function(node) {
        if(util.isDir(path)) {
          return util.asyncEach(Object.keys(node.data), function(key) {
            if(cachingMode.data || util.isDir(key)) {
              return this.syncPath(path + key);
            } else {
              return this.local.set(path + key, { version: node.data[key] });
            }
          }.bind(this));
        } else {
          return this.local.set(path, node);
        }
      }.bind(this));
    },

    computeSyncSettings: function() {
      var paths = [];
      this.caching.rootPaths.forEach(function(cachingRoot) {
        var s;
        var mode = this.access.check(s=util.extractScope(cachingRoot));
        if(mode) {
          paths.push({
            path: cachingRoot,
            access: mode,
            caching: this.caching.get(cachingRoot)
          });
        }
      }.bind(this));
      return paths;
    },

    reset: function() {
      this.remote.reset();
      // deprecated!
      return util.getPromise().fulfill();
    }

  };

  return Sync;

});
