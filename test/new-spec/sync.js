// replace define() to catch other modules being loaded.
// depth 1 catches dependencies of 'sync', depth 0 would get those of
// this file, depth 2 those of the first module being required by 'sync'.
interceptDependencies(1);

define(['remotestorage/lib/sync'], function(sync) {
  // pull dependencies of 'sync' out of the void, to spy on them.
  var dependencies = resetDependencies();
  var wireClient = dependencies[0];
  var store = dependencies[1];
  var util = dependencies[2];


  function makeCb(origCb) {
    var cb = function() {
      cb.calls.push(Array.prototype.slice.call(arguments));
      if(origCb) { origCb.apply(this, arguments); }
    }
    cb.calls = [];
    return cb;
  }

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
    
    spyOn(store, 'getNode').andCallFake(function(path) {
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
    });

    spyOn(store, 'getNodeData').andCallFake(localStore.getData);

    spyOn(store, 'setNodeData').andCallFake(
      function(path, data, outgoing, timestamp, mimeType) {
        localStore.setData(path, data);
      }
    );
  }

  var wireClientStore;
  var wireClientTimeout;

  function setupWireClient(config) {
    wireClientStore = makeDummyStore(config.data, false);
    wireClientTimeout = false;

    spyOn(wireClient, 'get').andCallFake(function(path, callback) {
      if(wireClientTimeout) {
        callback('timeout');
      } else {
        var data = wireClientStore.getData(path);
        callback(null, data, 'application/json');
      }
    });

    spyOn(wireClient, 'set').andCallFake(
      function(path, data, mimeType, callback) {
        if(wireClientTimeout) {
          callback('timeout');
        } else {
          callback(null);
        }
      }
    );

    spyOn(wireClient, 'getState').andReturn('connected');
  }

  function injectRemoteTimeout() {
    wireClientTimeout = true;
  }

  function injectRemoteChange(path, data) {
    wireClientStore.addChange(path, data);
  }

  function injectLocalChange(path, data) {
    localStore.addChange(path, data);
  }

  function setupStore(local, remote) {
    if(! remote) {
      remote = local;
    }
    setupLocalStore(local);
    setupWireClient(remote);
  }

  var defaultFixtures = {
    data: {
      'a': {
        'b': '{"test":1}', 'c': '{"test":2}', 'd': '{"test":3}'
      },
      'e': {
        'f': {
          'g': { 'h': '{"test":4}' },
          'i': { 'j': '{"test":5}', 'k': '{"test":6}' },
          'l': '{"test":7}'
        }
      }
    },
    access: { '/e/': 'rw' },
    force: { '/e/': 'tree' }
  };


  function expectLocalGET(path) {
    expect(store.getNode).toHaveBeenCalledWith(path);
    expect(store.getNodeData).toHaveBeenCalledWith(path);
  }

  function expectLocalPUT(path, data, t) {
    if(typeof(t) == 'undefined') {
      t = remoteUpdateTime;
    }
    expect(store.setNodeData).toHaveBeenCalledWith(
      path, data, false, t, 'application/json'
    );
  }

  function expectRemoteGET(path) {
    expect(wireClient.get).toHaveBeenCalledWith(
      path, jasmine.any(Function)
    );
  }

  function expectNoRemoteGET(path) {
    expect(wireClient.get).not.toHaveBeenCalledWith(
      path, jasmine.any(Function)
    );
  }

  function expectRemotePUT(path, data) {
    expect(wireClient.set).toHaveBeenCalledWith(
      path, data, 'application/json', jasmine.any(Function)
    );
  }


  describe('sync', function() {
    describe('syncOne', function() {
      var cb, changeCb;

      describe("when disconnected", function() {
        beforeEach(function() {
          cb = makeCb();
          sync.syncOne('/e/f/l', cb);
        });

        it("calls it's callback", function() {
          expect(cb.calls.length).toEqual(1);
        });

        it("passes on a 'not-connected' error", function() {
          expect(cb.calls[0][0]).toEqual('not-connected');
        });
      });

      describe("when connected", function() {

        beforeEach(function() {
          setupStore(defaultFixtures);
          cb = makeCb();
        });

        it("requests the node from local store", function() {
          sync.syncOne('/e/f/l', cb);
          expectLocalGET('/e/f/l');
        });

        it("requests the node's parent from local store", function() {
          sync.syncOne('/e/f/l', cb);
          expectLocalGET('/e/f/');
        });

        it("calls the callback without passing an error", function() {
          sync.syncOne('/e/f/l', cb);
          expect(cb.calls.length).toEqual(1);
          expect(!!cb.calls[0][0]).toEqual(false);
        });

        describe("when remote data has changed", function() {
          beforeEach(function() {
            injectRemoteChange('/e/f/l', '{"new":"data"}');
            sync.syncOne('/e/f/l', cb);
          });

          it("updates the local store", function () {
            expectLocalPUT('/e/f/l', {"new":"data"});
          });
        });

        describe("when a timeout occurs", function() {
          var timeoutCb;
          beforeEach(function() {
            timeoutCb = makeCb();
            injectLocalChange('/e/f/l', '{"new":"local"}');
            injectRemoteTimeout();
            sync.on('timeout', timeoutCb);
            sync.syncOne('/e/f/l', cb);
          });

          it("triggers a 'timeout' event", function() {
            expect(timeoutCb.calls.length).toEqual(1);
          });
        });

        describe("when local data has changed", function() {
          beforeEach(function() {
            injectLocalChange('/e/f/l', '{"new":"local"}');
            sync.syncOne('/e/f/l', cb);
          });

          it("pushes changes to remote", function() {
            expectRemotePUT('/e/f/l', {"new":"local"});
          });
        });

        describe("when both remote and local data have changed", function() {
          var resolver, conflictHandler;

          function setupConflict() {
            injectLocalChange('/e/f/l', '{"new":"local"}');
            injectRemoteChange('/e/f/l', '{"new":"remote"}');

            conflictHandler = makeCb(function(event) {
              resolver = event.resolve;
            });
            sync.on('conflict', conflictHandler);

            sync.syncOne('/e/f/l', cb);
          }

          it("fires a conflict event", function() {
            setupConflict();
            expect(conflictHandler.calls.length).toEqual(1);
          });

          it("attaches a 'resolve' callback to the conflict event", function() {
            setupConflict();
            expect(resolver).not.toBe(undefined);
            expect(typeof(resolver)).toEqual('function');
          });

          describe("when the resolution is 'remote'", function() {
            beforeEach(function() {
              setupConflict();
              resolver('remote');
            });

            it("updates the local store", function() {
              expectLocalPUT('/e/f/l', {"new":"remote"});
            });
          });

          describe("when the resolution is 'local'", function() {
            beforeEach(function() {
              setupConflict();
              resolver('local');
            });

            it("pushes changes to remote", function() {
              expectRemotePUT('/e/f/l', {"new":"local"});
            });
          });

        });

      });

    });


    describe('fullSync', function() {
      var cb;

      describe('when disconnected', function() {
        
        beforeEach(function() {
          sync.disableThrottling();
          cb = makeCb();
          sync.fullSync(cb);
        });

        it("calls it's callback", function() {
          expect(cb.calls.length).toEqual(1);
        });

        it("passes on a 'not-connected' error", function() {
          expect(cb.calls[0][0]).toEqual('not-connected');
        });

      });

      describe("when there are no force flags set", function() {
        beforeEach(function() {
          var data = util.extend({}, defaultFixtures);
          data.force = {};
          data.access = { '/': 'rw' };
          setupStore(data, {});
          cb = makeCb();
          runs(function() { sync.fullSync(cb); });
          waits(200);
        });

        it("syncs the root node", function() {
          runs(function() {
            expectRemoteGET('/');
          });
        });

        it("doesn't sync any other directories", function() {
          runs(function() {
            expectNoRemoteGET('/a/');
            expectNoRemoteGET('/e/');
          });
        });
      });

      describe("when there is no local data", function() {
        beforeEach(function() {
          sync.disableThrottling();
          setupStore({
            data: { 'e': {} },
            access: { '/e/': 'rw' },
            force: { '/e/' : 'tree' }
          }, defaultFixtures);
          cb = makeCb();
        });

        it("requests all the directory listings", function() {
          runs(function() {
            sync.fullSync(cb);
          });
          
          waits(200);
          
          runs(function() {
            expectRemoteGET('/e/');
            expectRemoteGET('/e/f/');
            expectRemoteGET('/e/f/g/');
            expectRemoteGET('/e/f/i/');
          });
        });

        it("requests no actual data", function() {
          runs(function() {
            sync.fullSync(cb);
          });

          waits(200);

          runs(function() {
            expectNoRemoteGET('/e/f/l');
            expectNoRemoteGET('/e/f/g/h');
            expectNoRemoteGET('/e/f/i/j');
            expectNoRemoteGET('/e/f/i/k');
          });
        });

        it("updates local directories", function() {
          runs(function() {
            sync.fullSync(cb);
          });

          waits(200);
          
          runs(function() {
            expectLocalPUT('/e/', {'f/':0}, 0);
            expectLocalPUT('/e/f/', {'g/':0, 'i/':0, 'l':0}, 0);
            expectLocalPUT('/e/f/g/', {'h':0}, 0);
            expectLocalPUT('/e/f/i/', {'j':0,'k':0}, 0);
          });
        });

      });

      describe("when there is no remote data", function() {
        var cb;

        beforeEach(function() {
          sync.disableThrottling();
          var localFixtures = util.extend({}, defaultFixtures);
          localFixtures.force['/e/'] = true;
          localFixtures.noPreviousUpdate = true;
          setupStore(localFixtures, {
            data: {}
          });
          cb = makeCb();
        });

        it("doesn't attempt to get the remote root node", function() {
          runs(function() { sync.fullSync(cb); });
          waits(200);
          runs(function() {
            expectNoRemoteGET('/');
          });
        });

        it("attempts to get a remote listing of the access roots", function() {
          runs(function() { sync.fullSync(cb) });
          waits(200);
          runs(function() {
            expectRemoteGET('/e/');
          });
        });

        it("gets all the local listings below the access roots", function() {
          runs(function() { sync.fullSync(cb) });
          waits(200);
          runs(function() {
            expectLocalGET('/e/');
            expectLocalGET('/e/f/');
            expectLocalGET('/e/f/g/');
            expectLocalGET('/e/f/i/');
          });
        });

        it("gets all local data nodes", function() {
          runs(function() { sync.fullSync(cb) });
          waits(200);
          runs(function() {
            expectLocalGET('/e/f/g/h');
            expectLocalGET('/e/f/i/j');
            expectLocalGET('/e/f/i/k');
            expectLocalGET('/e/f/l');
          });
        });

        it("pushes all data nodes to remote", function() {
          runs(function() { sync.fullSync(cb); });
          waits(200);
          runs(function() {
            expectRemotePUT('/e/f/g/h', {test:4});
            expectRemotePUT('/e/f/i/j', {test:5});
            expectRemotePUT('/e/f/i/k', {test:6});
            expectRemotePUT('/e/f/l', {test:7});
          });
        });
      });

    });

  });

  jasmineEnv.execute();

});
