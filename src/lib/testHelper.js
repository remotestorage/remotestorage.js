/*
  Usage:

  require.config({
    paths: {
      remotestorage: 'path/to/remoteStorage.js/src'
    }
  });

  define([
    'remotestorage/remoteStorage',
    'remotestorage/lib/testHelper'
  ], function(remoteStorage, testHelper) {
    var accessClaim = { 'a' : 'rw' };

    // you don't really need to call this.
    // the important thing is that whatever your app passes to claimAccess
    // gets passed to testHelper.stubData below as well.
    remoteStorage.claimAccess(accessClaim)

    testHelper.stubData({
      'a' : {
        'b' : '{"foo":"bar"}',
      },
      'c' : {
        'd' : {
          'e' : "bla",
          'f' : "blubb",
        }
      }
    }, accessClaim);

    // Now you can use
    remoteStorage.root.getObject('/a/b') //-> { foo: "bar" }
  });
*/
define(['./util', './store', './wireClient'], function(util, store, wireClient) {
  var initialTime      = 1234567890;
  var localUpdateTime  = 2345678901;
  var remoteUpdateTime = 3456789012;

  function makeDummyStore(allData, isLocal) {
    var changes = {};
    return {
      getData: function(path) {
        var parts = path.split('/');
        var data = allData;
        var isDir = path.match(/\/$/);
        if(changes[path] && (! isDir)) {
          data = changes[path];
        } else {
          for(var i=0;i<parts.length;i++) {
            if(parts[i] == '') {
              continue;
            } else if(data) {
              data = data[parts[i]];
            } else {
              return isDir ? {} : undefined;
            }
          }
        }
        if(data && isDir) {
          data = util.extend({}, data);
          for(var key in data) {
            var val = data[key];
            delete data[key];
            var t = (
              changes[path + key] ?
                (isLocal ? localUpdateTime : remoteUpdateTime) :
              initialTime
            );
            if(typeof(val) == 'object') {
              data[key + '/'] = t;
            } else {
              data[key] = t;
            }
          }
        } else if(isDir) {
          data = {};
        } else if(data && typeof(data) == 'string') {
          data = JSON.parse(data);
        }
        return data;
      },

      setData: function(path, data) {
        this.addChange(path, data);
      },

      addChange: function(path, data) {
        changes[path] = data;
      },

      reset: function() {
        this.changes = {};
      },
      _data: allData
    }
  }

  var localStore;

  function setupLocalStore(config) {
    localStore = makeDummyStore(config.data, true);
    
    store.getNode = function(path) {
      var node = {};
      var data = localStore.getData(path);
      var isDir = path.match(/\/$/);
      var parentPath = path.replace(/[^\/]*\/?$/, '');
      var baseName = path.match(/([^\/]*\/?)$/)[1];
      var plisting = localStore.getData(parentPath);
      node.timestamp = (plisting && plisting[baseName]) || 0;
      node.mimeType = 'application/json';
      node.lastUpdatedAt = config.noPreviousUpdate ? 0 : initialTime;
      if(isDir) {
        node.diff = {};
      }
      for(var key in config.access) {
        if(path.substr(0, key.length) == key) {
          node.startAccess = config.access[key];
          break;
        }
      }
      for(var key in config.force) {
        if(path.substr(0, key.length) == key) {
          if(config.force[key] == 'tree') {
            node.startForceTree = true;
          } else {
            node.startForce = true;
          }
        }
      }
      console.log('getNode stub', path, node);
      return node;
    }

    store.getNodeData = localStore.getData;

    store.setNodeData = function(path, data, outgoing, timestamp, mimeType) {
      localStore.setData(path, data);
    }
  }

  var wireClientStore;
  var wireClientTimeout;

  function setupWireClient(config) {
    wireClientStore = makeDummyStore(config.data, false);
    wireClientTimeout = false;

    wireClient.get = function(path, callback) {
      if(wireClientTimeout) {
        callback('timeout');
      } else {
        var data = wireClientStore.getData(path);
        callback(null, data, 'application/json');
      }
    }

    wireClient.set = function(path, data, mimeType, callback) {
      if(wireClientTimeout) {
        callback('timeout');
      } else {
        callback(null);
      }
    }

    wireClient.getState = function() { return 'connected' }
  }

  function setupStore(local, remote) {
    if(! remote) {
      remote = local;
    }
    setupLocalStore(local);
    setupWireClient(remote);
  }

  return {
    stubData: function(data, claimedAccess) {
      var config = {
        data: data,
        access: {}
      };
      for(var key in claimedAccess) {
        access['/' + key + '/'] = claimedAccess[key];
      }
      setupStore(config, config);
    }
  };
});
