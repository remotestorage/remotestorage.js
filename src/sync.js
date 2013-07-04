(function(global) {

  var SYNC_INTERVAL = 10000;

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

  function isDir(path) {
    return path[path.length - 1] == '/';
  }

  function descendInto(remote, local, path, keys, promise) {
    var n = keys.length, i = 0;
    if(n == 0) promise.fulfill();
    function oneDone() {
      i++;
      if(i == n) promise.fulfill();
    }
    keys.forEach(function(key) {
      synchronize(remote, local, path + key).then(oneDone);
    });
  }

  function updateLocal(remote, local, path, body, contentType, revision, promise) {
    if(isDir(path)) {
      descendInto(remote, local, path, Object.keys(body), promise);
    } else {
      local.put(path, body, contentType, true).then(function() {
        return local.setRevision(path, revision)
      }).then(function() {
        promise.fulfill();
      });
    }
  }

  function allKeys(a, b) {
    var keyObject = {};
    for(var ak in a) keyObject[ak] = true;
    for(var bk in b) keyObject[bk] = true;
    return Object.keys(keyObject);
  }

  function deleteLocal(local, path, promise) {
    local.delete(path, true).then(promise.fulfill);
  }

  function synchronize(remote, local, path, options) {
    var promise = promising();
    local.get(path).then(function(localStatus, localBody, localContentType, localRevision) {
      remote.get(path, {
        ifNoneMatch: localRevision
      }).then(function(remoteStatus, remoteBody, remoteContentType, remoteRevision) {
        if(remoteStatus == 412 || remoteStatus == 304) {
          // up to date.
          promise.fulfill();
        } else if(localStatus == 404 && remoteStatus == 200) {
          // local doesn't exist, remote does.
          updateLocal(remote, local, path, remoteBody, remoteContentType, remoteRevision, promise);
        } else if(localStatus == 200 && remoteStatus == 404) {
          // remote doesn't exist, local does.
          deleteLocal(local, path, promise);
        } else if(localStatus == 200 && remoteStatus == 200) {
          if(isDir(path)) {
            local.setRevision(path, remoteRevision).then(function() {
              descendInto(remote, local, path, allKeys(localBody, remoteBody), promise);
            });
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
          if(i == n) promise.fulfill();
        }
        if(path) {
          // change was propagated -> clear.
          local.clearChange(path).then(done);
        } else {
          // change wasn't propagated (conflict?) -> handle it later.
          done();
        }
      }
      if(n > 0) {
        function errored(err) {
          console.error("pushChanges aborted due to error: ", err, err.stack);
        }
        changes.forEach(function(change) {
          if(change.conflict) {
            var res = change.conflict.resolution;
            if(res) {
              console.log('about to resolve', res);
              // ready to be resolved.
              change.action = (res == 'remote' ? change.remoteAction : change.localAction);
              change.force = true;
            } else {
              console.log('conflict pending for ', change.path);
              // pending conflict, won't do anything.
              return oneDone();
            }
          }
          switch(change.action) {
          case 'PUT':
            var options = {};
            if(! change.force) {
              if(change.revision) {
                options.ifMatch = change.revision;
              } else {
                options.ifNoneMatch = '*';
              }
            }
            local.get(change.path).then(function(status, body, contentType) {
              return remote.put(change.path, body, contentType, options);
            }).then(function(status) {
                if(status == 412) {
                fireConflict(local, path, {
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
              if(status == 412) {
                fireConflict(local, path, {
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

  RemoteStorage.Sync = {
    sync: function(remote, local, path) {
      return pushChanges(remote, local, path).
        then(function() {
          return synchronize(remote, local, path);
        });
    },

    syncTree: function(remote, local, path) {
      return synchronize(remote, local, path, {
        data: false
      });
    }
  };

  var SyncError = function(originalError) {
    var msg = 'Sync failed: ';
    if('message' in originalError) {
      msg += originalError.message;
    } else {
      msg += originalError;
    }
    this.originalError = originalError;
    Error.apply(this, [msg]);
  };

  SyncError.prototype = Error.prototype;

  RemoteStorage.prototype.sync = function() {
    if(! (this.local && this.caching)) {
      throw "Sync requires 'local' and 'caching'!";
    }
    var roots = this.caching.rootPaths.slice(0);
    var n = roots.length, i = 0;
    var aborted = false;
    var rs = this;
    return promising(function(promise) {
      if(n == 0) return promise.fulfill();
      rs._emit('sync-busy');
      var path;
      while((path = roots.shift())) {
        RemoteStorage.Sync.sync(rs.remote, rs.local, path, rs.caching.get(path)).
          then(function() {
            if(aborted) return;
            i++;
            if(n == i) {
              rs._emit('sync-done');
              promise.fulfill();
            }
          }, function(error) {
            console.error('syncing', path, 'failed:', error);
            aborted = true;
            rs._emit('error', new SyncError(error));
            rs._emit('sync-done');
            promise.reject(error);
          });
      }
    });
  };

  RemoteStorage.prototype.syncCycle = function() {
    console.log('syncCycle');
    this.sync().then(function() {
      setTimeout(this.syncCycle.bind(this), SYNC_INTERVAL);
    }.bind(this));
  };

  RemoteStorage.Sync._rs_init = function(remoteStorage) {
    remoteStorage.on('ready', function() {
      remoteStorage.syncCycle();
    });
  };

})(this);
