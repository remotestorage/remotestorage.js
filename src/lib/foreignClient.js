define(
  ['./util', './webfinger', './store', './getputdelete'],
  function(util, webfinger, store, getputdelete) {

    var logger = util.getLogger('foreign client');
    var clients = {};
    var defaultSyncInterval = 300000;

    // Namespace: foreignClient
    //
    // Foreign clients represent connections to other people's storage.
    //
    //
    // Working with foreign clients:
    //
    // (start code)
    // foreignClient.getClient('alice@wonderland.lit', function(err, client) {
    //   if(err) {
    //     alert("Sorry dude, who the fuck is alice?");
    //   } else {
    //     client.setInterest('/location/current');
    //   }
    // });
    //
    // (end code)

    // Method: getClient
    //
    // Create a ForeignClient instance.
    //
    // Parameters:
    //   userAddress - webfinger user address to discover the storage info
    //   callback    - callback to call, once the client is ready to go
    //
    // Callback parameters:
    //   err    - errors, if any
    //   client - the created ForeignClient instance
    //
    //
    // You can safely call this multiple times, it will give you the same
    // client for the same user address every time.
    //
    function getClient(userAddress, callback) {
      if(userAddress in clients) {
        callback(null, clients[userAddress]);
      }
      webfinger.getStorageInfo(
        userAddress, { timeout: 3000 },
        function(err, storageInfo) {
          if(err) {
            callback(err);
          } else {
            var client = new ForeignClient(userAddress, storageInfo);
            clients.push(client)
            callback(null, client);
          }
        }
      );
    }


    // Class: ForeignClient
    //
    var ForeignClient = function(userAddress, storageInfo) {
      // Property: userAddress
      this.userAddress = userAddress,
      // Property: storageInfo
      this.storageInfo = storageInfo;

      this.store = store.getForeign(userAddress);

      util.bindAll(this);
    }

    ForeignClient.prototype = {

      // Property: interestingNodes
      // Object, mapping paths to interesting nodes to callbacks to call, when
      // those nodes get updated.
      // You don't need to mess with this. Use <addInterest>/<loseInterest> instead.
      interestingNodes: {},
      // Property: syncInterval
      // Interval for syncing. Whether a node that the app is interested it will
      // actually be synced depends on the likelyhood that this node will have
      // updates, based on past experience.
      // Defaults to 5 minutes.
      syncInterval: defaultSyncInterval,
      _intervalRef: null,

      // Method: addInterest
      //
      // Signal interest in a node. The given callback will be called once the
      // node is updated.
      //
      // Parameters:
      //   path              - path to the node in question.
      //   callback          - callback to call when the node changes.
      //
      addInterest: function(path, callback) {
        this.interestingNodes[path] = callback;
        this.queueSync();
      },

      // Method: loseInterest
      //
      // Remove a node from interesting nodes.
      loseInterest: function(path) {
        delete this.interestingNodes[path];
      },
      
      get: function(path, callback) {
        if(! path)     { throw "path is required"; }
        var cachedNode = this.store.getNode(path).data;
        if(callback) {
          this.updateNodeNow(path, cachedNode, function(err, node) {
            callback(err, node && node.data);
          });
        } else {
          return cachedNode.data;
        }
      },

      updateNodeNow: function(path, cachedNode, callback) {
        if(! cachedNode) {
          cachedNode = this.store.getNode(path);
        }
        function setFailed() {
          cachedNode.lastFailed = now;
          cachedNode.failureCount += 1;
        }
        getputdelete.get(this.buildUrl(path), null, function(err, data, mimeType) {
          if(err) {
            setFailed();
          } else {
            cachedNode.mimeType = mimeType;
            if(mimeType === 'application/json') {
              try {
                cachedNode.data
              } catch(exc) {
                logger.error('Foreign remote gave invalid JSON: ' + exc.message
              }
            }
            cachedNode.data = data;
          }
          this.calcNextSync(cachedNode);
          
        })
      }

      queueSync: function() {
        if(! this._intervalRef) {
          this.setupInterval();
        }
      },

      setupInterval: function() {
        this._intervalRef = setInterval(this.syncIteration, this.syncInterval);
      },

      syncIteration: function() {
        var now = (new Date()).getTime();
        for(var path in this.interestingNodes) {
          var cachedNode = this.store.getNode(path);
          if(cachedNode.nextSyncAt > 0 && cachedNode.nextSyncAt < now) {
            this.updateNodeNow(path, cachedNode, function(err, node) {
              if(! err) {
                this.interestingNodes[path](node.data);
              }
            });
          }
        }
      }

    };

    return {
      getClient: getClient
    };

  }
);
