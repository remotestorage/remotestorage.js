(function(global) {

  RemoteStorage.InMemoryStorage = function(rs) {
    this.rs = rs;
    RemoteStorage.cachingLayer(this);
    RemoteStorage.eventHandling(this, 'change', 'conflict');
    this._storage = {};
  };

  RemoteStorage.InMemoryStorage.prototype = {
    getNodes: function(paths) {
      var i, ret = {}, promise = promising();
      for(i=0; i<paths.length; i++) {
        ret[paths[i]] = this._storage[paths[i]];
      }
      promise.fulfill(ret);
      return promise;
    },

    setNodes: function(objs) {
      var i, promise = promising();
      for(i in objs) {
        this._storage[i] = objs[i];
      }
      promise.fulfill();
      return promise;
    },

    forAllNodes: function(cb) {
      var i;
      for(i in this._storage) {
        cb(this._storage(i));
      }
    }
  };

  RemoteStorage.InMemoryStorage._rs_init = function() {};

  RemoteStorage.InMemoryStorage._rs_supported = function() {
    return true;
  };

  RemoteStorage.InMemoryStorage._rs_cleanup = function() {};
})(typeof(window) !== 'undefined' ? window : global);
