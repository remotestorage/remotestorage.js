(function (global) {
  /**
   * Class: RemoteStorage.LocalStorage
   *
   * localStorage caching adapter. Used when no IndexedDB available.
   **/

  var Node = RemoteStorage.util.Node;

  var NODES_PREFIX = "remotestorage:cache:nodes:";
  var CHANGES_PREFIX = "remotestorage:cache:changes:";

  RemoteStorage.LocalStorage = function () {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.log('[LocalStorage] Registering events');
    RemoteStorage.eventHandling(this, 'change', 'local-events-done');
  };

  function b64ToUint6(nChr) {
    return nChr > 64 && nChr < 91 ?
      nChr - 65
      : nChr > 96 && nChr < 123 ?
      nChr - 71
      : nChr > 47 && nChr < 58 ?
      nChr + 4
      : nChr === 43 ?
      62
      : nChr === 47 ?
      63
      :
      0;
  }

  function isBinary(node) {
    return node.match(/charset=binary/);
  }

  function isRemoteStorageKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX ||
           key.substr(0, CHANGES_PREFIX.length) === CHANGES_PREFIX;
  }

  function isNodeKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX;
  }

  function parseNode(json) {
    try {
      return Node.fromJSON(json);
    } catch(e) {
      return undefined;
    }
  }

  RemoteStorage.LocalStorage.prototype = {

    getNodes: function (paths) {
      var nodes = {};

      for(var i = 0, len = paths.length; i < len; i++) {
        nodes[paths[i]] = parseNode(localStorage[NODES_PREFIX+paths[i]]);
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
          node = this.migrate(parseNode(localStorage[localStorage.key(i)]));
          if (node) {
            cb(node);
          }
        }
      }
      return Promise.resolve();
    }

  };

  RemoteStorage.LocalStorage._rs_init = function () {};

  RemoteStorage.LocalStorage._rs_supported = function () {
    return 'localStorage' in global;
  };

  // TODO tests missing!
  RemoteStorage.LocalStorage._rs_cleanup = function () {
    var keys = [];

    for (var i = 0, len = localStorage.length; i < len; i++) {
      var key = localStorage.key(i);
      if (isRemoteStorageKey(key)) {
        keys.push(key);
      }
    }

    keys.forEach(function (key) {
      RemoteStorage.log('[LocalStorage] Removing', key);
      delete localStorage[key];
    });
  };
})(typeof(window) !== 'undefined' ? window : global);
