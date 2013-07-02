(function(global) {

  function isDir(path) {
    return path[path.length - 1] == '/';
  }

  function synchronize(source, target, path, options) {
    var promise = promising();
    if(!options) options = {};
    if(typeof(options.data) === 'undefined') options.data = true;
    function syncRev(localRevision) {
      source.get(path).then(function(status, body, contentType, remoteRevision) {
        if(status == 412) {
          // up to date.
          promise.fulfill();
        } else {
          target.setRevision(path, remoteRevision || options.remRev).then(function() {
            if(isDir(path)) {
              var keys = Object.keys(body);
              function syncChild() {
                var key = keys.shift();
                if(key) {
                  var childPath = path + key;
                  target.getRevision(childPath).then(function(childRev) {
                    if(childRev != body[key]) {
                      if(isDir(key) || options.data) {
                        synchronize(source, target, childPath, {
                          rev: childRev,
                          remRev: body[key],
                          data: options.data
                        }).then(syncChild);
                      } else {
                        // only set revision for files w/o data sync.
                        target.setRevision(childPath, body[key]).then(syncChild);
                      }
                    }
                  });
                } else {
                  promise.fulfill();
                }
              }
              syncChild();
            } else {
              target.put(path, body, contentType).then(function() {
                promise.fulfill();
              });
            }
          });
        }
      }, {
        ifNoneMatch: localRevision
      });
    }
    options.rev ? syncRev(options.rev) : target.getRevision(path).then(syncRev);
    return promise;
  }

  RemoteStorage.Sync = {
    sync: function(source, target, path) {
      return synchronize(source, target, path);
    },

    syncTree: function(source, target, path) {
      return synchronize(source, target, path, {
        data: false
      });
    }
  };

  RemoteStorage.prototype.sync = function() {
    if(! (this.local && this.caching)) {
      throw "Sync requires 'local' and 'caching'!";
    }
    var roots = this.caching.rootPaths;
    var n = roots.length, i = 0;
    var aborted = false;
    return promising(function(promise) {
      var path;
      while((path = roots.shift())) {
        synchronize(this.remote, this.local, path, this.caching.get(path)).
          then(function() {
            if(aborted) return;
            i++;
            if(n == i) {
              promise.fulfill();
            }
          }, function(error) {
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
