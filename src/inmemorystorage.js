(function(global) {

  RemoteStorage.InMemoryStorage = function(rs) {
    this.rs = rs;
    RemoteStorage.cachingLayer(this);
    RemoteStorage.log('registering events');
    RemoteStorage.eventHandling(this, 'change');
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
        if(objs[i] === undefined) {
          delete this._storage[i];
        } else {
          this._storage[i] = objs[i];
        }
      }
      promise.fulfill();
      return promise;
    },

    forAllNodes: function(cb) {
      var i;
      for(i in this._storage) {
        cb(this.migrate(this._storage[i]));
      }
      return promising().fulfill();
    }
  };

  RemoteStorage.InMemoryStorage._rs_init = function() {};

  RemoteStorage.InMemoryStorage._rs_supported = function() {
    return true;
  };

  RemoteStorage.InMemoryStorage._rs_cleanup = function() {};
})(typeof(window) !== 'undefined' ? window : global);
