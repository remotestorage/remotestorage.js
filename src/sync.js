(function(global) {

  //
  // The synchronization algorithm is as follows:
  //
  // (for each path in caching.rootPaths)
  //
  // (1) Fetch all pending changes from 'local'
  // (2) Try to push pending changes to 'remote', if that fails mark a
  //     conflict, otherwise clear the change.
  // (3) Folder items: GET a listing
  //     File items: GET the file
  // (4) Compare versions. If they match the locally cached one, return.
  //     Otherwise continue.
  // (5) Folder items: For each child item, run this algorithm starting at (3).
  //     File items: Fetch remote data and replace locally cached copy.
  //
  // Depending on the API version the server supports, the version comparison
  // can either happen on the server (through ETag, If-Match, If-None-Match
  // headers), or on the client (through versions specified in the parent listing).
  //

  var syncInterval = 10000;

  function isDir(path) {
    return path[path.length - 1] === '/';
  }

  function descendInto(remote, local, path, keys, promise) {
    var n = keys.length, i = 0;
    if (n === 0) { promise.fulfill(); }
    function oneDone() {
      i++;
      if (i === n) { promise.fulfill(); }
    }
    keys.forEach(function(key) {
      synchronize(remote, local, path + key).then(oneDone);
    });
  }

  function updateLocal(remote, local, path, body, contentType, revision, promise) {
    if (isDir(path)) {
      descendInto(remote, local, path, Object.keys(body), promise);
    } else {
      local.put(path, body, contentType, true, revision).then(function() {
        return local.setRevision(path, revision);
      }).then(function() {
        promise.fulfill();
      });
    }
  }

  function allDifferentKeys(a, b) {
    var keyObject = {};
    for (var ak in a) {
      if (a[ak] !== b[ak]) {
        keyObject[ak] = true;
      }
    }
    for (var bk in b) {
      if (a[bk] !== b[bk]) {
        keyObject[bk] = true;
      }
    }
    return Object.keys(keyObject);
  }

  function promiseDeleteLocal(local, path) {
    var promise = promising();
    deleteLocal(local, path, promise);
    return promise;
  }

  function deleteLocal(local, path, promise) {
    if (isDir(path)) {
      local.get(path).then(function(localStatus, localBody, localContentType, localRevision) {
        var keys = [], failed = false;
        for (var item in localBody) {
          keys.push(item);
        }
        var n = keys.length, i = 0;
        if (n === 0) { promise.fulfill(); }

        function oneDone() {
          i++;
          if (i === n && !failed) { promise.fulfill(); }
        }

        function oneFailed(error) {
          if (!failed) {
            failed = true;
            promise.reject(error);
          }
        }

        keys.forEach(function(key) {
          promiseDeleteLocal(local, path + key).then(oneDone, oneFailed);
        });
      });
    } else {
      //console.log('deleting local item', path);
      local.delete(path, true).then(promise.fulfill, promise.reject);
    }
  }

  function synchronize(remote, local, path, options) {
    var promise = promising();
    local.get(path).then(function(localStatus, localBody, localContentType, localRevision) {
      remote.get(path, {
        ifNoneMatch: localRevision
      }).then(function(remoteStatus, remoteBody, remoteContentType, remoteRevision) {
        if (remoteStatus === 401 || remoteStatus === 403) {
          throw new RemoteStorage.Unauthorized();
        } else if (remoteStatus === 412 || remoteStatus === 304) {
          // up to date.
          promise.fulfill();
        } else if (localStatus === 404 && remoteStatus === 200) {
          // local doesn't exist, remote does.
          updateLocal(remote, local, path, remoteBody, remoteContentType, remoteRevision, promise);
        } else if (localStatus === 200 && remoteStatus === 404) {
          // remote doesn't exist, local does.
          deleteLocal(local, path, promise);
        } else if (localStatus === 200 && remoteStatus === 200) {
          if (isDir(path)) {
            if (remoteRevision && remoteRevision === localRevision) {
              promise.fulfill();
            } else {
              local.setRevision(path, remoteRevision).then(function() {
                descendInto(remote, local, path, allDifferentKeys(localBody, remoteBody), promise);
              });
            }
          } else {
            updateLocal(remote, local, path, remoteBody, remoteContentType, remoteRevision, promise);
          }
        } else {
          // do nothing.
          promise.fulfill();
        }
      }).then(undefined, promise.reject);
    }).then(undefined, promise.reject);
    return promise;
  }

  function fireConflict(local, path, attributes) {
    local.setConflict(path, attributes);
  }

  function pushChanges(remote, local, path) {
    return local.changesBelow(path).then(function(changes) {
      var n = changes.length, i = 0;
      var promise = promising();
      function oneDone(path) {
        function done() {
          i++;
          if (i === n) { promise.fulfill(); }
        }
        if (path) {
          // change was propagated -> clear.
          local.clearChange(path).then(done);
        } else {
          // change wasn't propagated (conflict?) -> handle it later.
          done();
        }
      }
      if (n > 0) {
        var errored = function(err) {
          console.error("pushChanges aborted due to error: ", err, err.stack);
          promise.reject(err);
        };
        changes.forEach(function(change) {
          if (change.conflict) {
            var res = change.conflict.resolution;
            if (res) {
              RemoteStorage.log('about to resolve', res);
              // ready to be resolved.
              change.action = (res === 'remote' ? change.conflict.remoteAction : change.conflict.localAction);
              change.force = true;
            } else {
              RemoteStorage.log('conflict pending for ', change.path);
              // pending conflict, won't do anything.
              return oneDone();
            }
          }
          switch(change.action) {
          case 'PUT':
            var options = {};
            if (! change.force) {
              if (change.revision) {
                options.ifMatch = change.revision;
              } else {
                options.ifNoneMatch = '*';
              }
            }
            local.get(change.path).then(function(status, body, contentType) {
              if (status === 200) {
                return remote.put(change.path, body, contentType, options);
              } else {
                return 200; // fake 200 so the change is cleared.
              }
            }).then(function(status) {
              if (status === 412) {
                fireConflict(local, change.path, {
                  localAction: 'PUT',
                  remoteAction: 'PUT'
                });
                oneDone();
              } else {
                oneDone(change.path);
              }
            }).then(undefined, errored);
            break;
          case 'DELETE':
            remote.delete(change.path, {
              ifMatch: change.force ? undefined : change.revision
            }).then(function(status) {
              if (status === 412) {
                fireConflict(local, change.path, {
                  remoteAction: 'PUT',
                  localAction: 'DELETE'
                });
                oneDone();
              } else {
                oneDone(change.path);
              }
            }).then(undefined, errored);
            break;
          }
        });
        return promise;
      }
    });
  }

  /**
   * Class: RemoteStorage.Sync
   **/
  RemoteStorage.Sync = {
    /**
     * Method: sync
     **/
    sync: function(remote, local, path) {
      return pushChanges(remote, local, path).
        then(function() {
          return synchronize(remote, local, path);
        });
    },
    /**
     * Method: syncTree
     **/
    syncTree: function(remote, local, path) {
      return synchronize(remote, local, path, {
        data: false
      });
    }
  };

  /**
   * Method: getSyncInterval
   *
   * Get the value of the sync interval when application is in the foreground
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getSyncInterval = function() {
    return syncInterval;
  };
  /**
   * Method: setSyncInterval
   *
   * Set the value of the sync interval when application is in the foreground
   *
   * Parameters:
   *   interval - sync interval in milliseconds
   *
   */
  RemoteStorage.prototype.setSyncInterval = function(interval) {
    if(typeof(interval) !== 'number') {
      throw interval + " is not a valid sync interval";
    }
    syncInterval = parseInt(interval, 10);
    if (this._syncTimer) {
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), interval);
    }
  };

  var SyncError = function(originalError) {
    var msg = 'Sync failed: ';
    if (typeof(originalError) === 'object' && 'message' in originalError) {
      msg += originalError.message;
    } else {
      msg += originalError;
    }
    this.originalError = originalError;
    Error.apply(this, [msg]);
  };

  SyncError.prototype = Object.create(Error.prototype);

  RemoteStorage.prototype.sync = function() {
    if (! (this.local && this.caching)) {
      throw "Sync requires 'local' and 'caching'!";
    }
    if (! this.remote.connected) {
      return promising().fulfill();
    }
    var roots = this.caching.rootPaths.slice(0);
    var n = roots.length, i = 0;
    var aborted = false;
    var rs = this;

    return promising(function(promise) {
      if (n === 0) {
        rs._emit('sync-busy');
        rs._emit('sync-done');
        return promise.fulfill();
      }
      rs._emit('sync-busy');
      var path;
      while((path = roots.shift())) {
        (function (path) {
          var cachingState = rs.caching.get(path);
          RemoteStorage.Sync.sync(rs.remote, rs.local, path, cachingState).
            then(function() {
              if(!cachingState.ready) {
                cachingState.ready = true;
                rs.caching.set(path, cachingState);
              }
              if (aborted) { return; }
              i++;
              if (n === i) {
                rs._emit('sync-done');
                promise.fulfill();
              }
            }, function(error) {
              rs.caching.set(path, {data: true, ready: true});
              console.error('syncing', path, 'failed:', error);
              if (aborted) { return; }
              aborted = true;
              rs._emit('sync-done');
              if (error instanceof RemoteStorage.Unauthorized) {
                rs._emit('error', error);
              } else {
                rs._emit('error', new SyncError(error));
              }
              promise.reject(error);
            });
        })(path);
      }
    });
  };

  RemoteStorage.SyncError = SyncError;

  RemoteStorage.prototype.syncCycle = function() {
    this.sync().then(function() {
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), this.getSyncInterval());
    }.bind(this),
    function(e) {
      console.log('sync error, retrying');
      this.stopSync();
      this._syncTimer = setTimeout(this.syncCycle.bind(this), this.getSyncInterval());
    }.bind(this));
  };

  RemoteStorage.prototype.stopSync = function() {
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      delete this._syncTimer;
    }
  };

  var syncCycleCb;
  RemoteStorage.Sync._rs_init = function(remoteStorage) {
    syncCycleCb = function() {
      remoteStorage.syncCycle();
    };
    remoteStorage.on('ready', syncCycleCb);
  };

  RemoteStorage.Sync._rs_cleanup = function(remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
  };

})(typeof(window) !== 'undefined' ? window : global);
