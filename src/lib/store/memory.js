define(['../util', './syncTransaction'], function(util, syncTransactionAdapter) {

  // Namespace: store.memory
  // <StorageAdapter> implementation that keeps data in memory.

  return function(logName) {
    var logger = util.getLogger(logName || 'store::memory');
    var nodes = {};

    var store = {
      get: function(path) {
        logger.info('get', path);
        return util.getPromise().fulfillLater(nodes[path]);
      },

      set: function(path, node) {
        logger.info('set', path, node.data);
        nodes[path] = node;
        return util.getPromise().fulfillLater();
      },

      remove: function(path) {
        logger.info('remove', path);
        delete nodes[path];
        return util.getPromise().fulfillLater();
      }
    };

    return util.extend({

      _nodes: nodes,

      on: function() {},

      forgetAll: function() {
        logger.info('forgetAll');
        this._nodes = nodes = {};
        return util.getPromise().fulfillLater();
      },

      hasKey: function(path) {
        return !! nodes[path];
      },

      // wireClient STUB

      getState: function() {
        return 'connected';
      },

      // TESTS & DEBUGGING

      printTree: function() {
        var printOne = function(path, indent) {
          return this.get(path).
            then(function(node) {
              if(! node) {
                throw "No node for path: " + path;
              }
              if(util.isDir(path)) {
                console.log(indent + '+ ' + util.baseName(path));
                return util.asyncEach(Object.keys(node.data), function(key) {
                  return printOne(path + key, indent + '| ');
                });
              } else {
                console.log(indent + util.baseName(path) + ' ' +
                            node.data.length + ' bytes, ' +
                            node.mimeType);
              }
            });
        }.bind(this);

        return printOne('/', '');
      },

      // FIXME: implement through 'set' and move to common.
      init: function(dataTree, mimeType, timestamp, access) {
        this.forgetAll();
        var initNode = function (path, tree) {
          var node = {
            startAccess: Object.keys(access).reduce(function(a, k) {
              return (k === path) ? access[k] : a;
            }, null),
            startForce: null,
            startForceTree: null,
            timestamp: timestamp,
            lastUpdatedAt: timestamp
          };
          if(typeof(tree) == 'object') {
            node.mimeType = 'application/json';
            node.data = Object.keys(tree).reduce(function(listing, _key) {
              var key = _key;
              if(typeof(tree[_key]) === 'object') {
                key += '/';
              }
              initNode(path + key, tree[_key]);
              listing[key] = timestamp;
              return listing;
            }, {});
            node.diff = {};
          } else {
            node.mimeType = mimeType;
            node.data = tree;
          }
          nodes[path] = node;
        }.bind(this);

        initNode('/', dataTree);
      }

    }, store, syncTransactionAdapter(store, logger));
  };
});
