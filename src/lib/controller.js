define([
  './util',
  './access',
  './caching',
  './sync'
], function(util, Access, Caching, Sync) {

  "use strict";

  /**
   * Class: Controller
   * Holds platform implementations, initializes <Caching> and <Access> settings, initializes <Sync>.
   *
   * Parameters:
   *   platform - A platform object. See <platform> for details.
   */
  var Controller = function(platform) {
    /**
     * Property: platform
     * Platform specific implementations of certain things.
     *
     * Currently expected methods:
     *   http       - A HTTP implementation, such as BrowserHTTP or NodeHTTP.
     *   localStore - A <Store> implementation to use for local caching, such as <LocalStorageStore>.
     */
    this.platform = platform;

    /**
     * Property: access
     * A <Access> instance.
     */
    this.access = new Access();

    /**
     * Property: caching
     * A <Caching> instance.
     */
    this.caching = new Caching();

    /**
     * Property: sync
     * A <Sync> instance.
     */
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
