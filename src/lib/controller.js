define([
  './util',
  './access',
  './caching',
  './sync'
], function(util, Access, Caching, Sync) {

  "use strict";

  var Controller = function(platform) {
    this.platform = platform;
    this.access = new Access();
    this.caching = new Caching();
    this.sync = new Sync(this);
  };

  util.declareError(Controller, 'StorageInfoNotSet', function() {
    return "storageInfo not set!";
  });

  Controller.prototype = {

    setStorageInfo: function(storageInfo) {
      this.storageInfo = storageInfo;
      this.sync.remote.configure({
        storageInfo: this.storageInfo
      });
    },

    setBearerToken: function(bearerToken) {
      if(typeof(this.storageInfo) !== 'object') {
        throw new Controller.StorageInfoNotSet();
      }
      this.bearerToken = bearerToken;
      this.sync.remote.configure({
        storageInfo: this.storageInfo,
        bearerToken: this.bearerToken
      });
    },

    reset: function() {
      this.caching.reset();
      return this.sync.reset();
    }

  };

  return Controller;

});
