(function(global) {

  function isDir(path) {
    return path[path.length - 1] == '/';
  }

  function descendInto(remote, local, path, keys, promise) {
    var n = keys.length, i = 0;
    console.log('descendInto', path, 'n', n);
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
    for(var key in a) keyObject[key] = true;
    for(var key in b) keyObject[key] = true;
    return Object.keys(keyObject);
  }

  function deleteLocal(local, path, promise) {
    local.delete(path, true).then(promise.fulfill);
  }

  function synchronize(remote, local, path, options) {
    console.error('SYNC(' + path + ')');
    var promise = promising();
    local.get(path).then(function(localStatus, localBody, localContentType, localRevision) {
      console.log('(' + path + ') sync got local', [localStatus, localBody, localContentType, localRevision]);
      remote.get(path, {
        ifNoneMatch: localRevision
      }).then(function(remoteStatus, remoteBody, remoteContentType, remoteRevision) {
        console.log('(' + path + ') sync got remote', [remoteStatus, remoteBody, remoteContentType, remoteRevision]);
        if(remoteStatus == 412) {
          console.log('DECISION', path, '->', 'up to date');
          // up to date.
          promise.fulfill();
        } else if(localStatus == 404 && remoteStatus == 200) {
          console.log('DECISION', path, '->', 'update local');
          // local doesn't exist, remote does.
          updateLocal(remote, local, path, remoteBody, remoteContentType, remoteRevision, promise);
        } else if(localStatus == 200 && remoteStatus == 404) {
          console.log('DECISION', path, '->', 'update remote');
          // remote doesn't exist, local does.
          deleteLocal(local, path, promise);
        } else if(localStatus == 200 && remoteStatus == 200) {
          console.log('DECISION', path, '->', 'same same (update local)');
          if(isDir(path)) {
            local.setRevision(path, remoteRevision).then(function() {
              descendInto(remote, local, path, allKeys(localBody, remoteBody), promise);
            });
          } else {
            updateLocal(remote, local, path, remoteBody, remoteContentType, remoteRevision, promise);
          }
        } else {
          console.log('DECISION', path, '->', 'nothing to do');
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
      if(n > 0) {
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
        changes.forEach(function(change) {
          console.log('PUSH CHANGE', JSON.stringify(change));
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
              return remote.put(change.path, body, contnetType, options);
            }).then(function(status) {
                if(status == 412) {
                fireConflict(local, path, {
                  localAction: 'PUT',
                  remoteAction: 'PUT'
                });
                oneDone();
              } else {
                oneDone(path);
              }
            });
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
                oneDone(path);
              }
            });
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

  RemoteStorage.prototype.sync = function() {
    if(! (this.local && this.caching)) {
      throw "Sync requires 'local' and 'caching'!";
    }
    var roots = this.caching.rootPaths.slice(0);
    var n = roots.length, i = 0;
    var aborted = false;
    return promising(function(promise) {
      var path;
      while((path = roots.shift())) {
        RemoteStorage.Sync.sync(this.remote, this.local, path, this.caching.get(path)).
          then(function() {
            if(aborted) return;
            i++;
            if(n == i) {
              promise.fulfill();
            }
          }, function(error) {
            console.error('syncing', path, 'failed:', error);
            aborted = true;
            promise.reject(error);
          });
      }
    }.bind(this));
  };

  RemoteStorage.Sync._rs_init = function(remoteStorage) {
    remoteStorage.on('connected', function() {
      remoteStorage.sync();
    });
  };

})(this);
