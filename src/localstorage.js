  var cachingLayer = require('./cachinglayer')
  var log = require('./log');
  var eventHandling = require('./eventhandling');
  var util = require('./util');

  /**
   * Class: RemoteStorage.LocalStorage
   *
   * localStorage caching adapter. Used when no IndexedDB available.
   **/

  var NODES_PREFIX = "remotestorage:cache:nodes:";
  var CHANGES_PREFIX = "remotestorage:cache:changes:";

  var LocalStorage = function () {
    cachingLayer(this);
    log('[LocalStorage] Registering events');
    eventHandling(this, 'change', 'local-events-done');
  };

  function isRemoteStorageKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX ||
           key.substr(0, CHANGES_PREFIX.length) === CHANGES_PREFIX;
  }

  function isNodeKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX;
  }

  LocalStorage.prototype = {

    getNodes: function (paths) {
      var nodes = {};

      for(var i = 0, len = paths.length; i < len; i++) {
        try {
          nodes[paths[i]] = JSON.parse(localStorage[NODES_PREFIX+paths[i]]);
        } catch(e) {
          nodes[paths[i]] = undefined;
        }
      }

      return Promise.resolve(nodes);
    },

    setNodes: function (nodes) {
      for (var path in nodes) {
        // TODO shouldn't we use getItem/setItem?
        localStorage[NODES_PREFIX+path] = JSON.stringify(nodes[path]);
      }

      return Promise.resolve();
    },

    forAllNodes: function (cb) {
      var node;

      for(var i = 0, len = localStorage.length; i < len; i++) {
        if (isNodeKey(localStorage.key(i))) {
          try {
            node = this.migrate(JSON.parse(localStorage[localStorage.key(i)]));
          } catch(e) {
            node = undefined;
          }
          if (node) {
            cb(node);
          }
        }
      }
      return Promise.resolve();
    }

  };

  LocalStorage._rs_init = function () {};

  LocalStorage._rs_supported = function () {
    return util.localStorageAvailable();
  };

  // TODO tests missing!
  LocalStorage._rs_cleanup = function () {
    var keys = [];

    for (var i = 0, len = localStorage.length; i < len; i++) {
      var key = localStorage.key(i);
      if (isRemoteStorageKey(key)) {
        keys.push(key);
      }
    }

    keys.forEach(function (key) {
      log('[LocalStorage] Removing', key);
      delete localStorage[key];
    });
  };

  module.exports = LocalStorage;
