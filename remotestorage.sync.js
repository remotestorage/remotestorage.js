(function() {

  function isDir(path) {
    return path[path.length - 1] == '/';
  }

  function synchronize(source, target, path, options) {
    var promise = promising();
    console.log('synchronize', path, options);
    if(!options) options = {};
    if(typeof(options.data) === 'undefined') options.data = true;
    function syncRev(localRevision) {
      source.get(path).then(function(status, body, contentType, remoteRevision) {
        if(status == 412) {
          // up to date.
          promise.fulfill();
        } else {
          target.setRevision(path, remoteRevision || options.remRev).then(function() {
            console.log('have set rev of ' + path + ' to ' + (remoteRevision||options.remRev), 'no descending?', body);
            if(isDir(path)) {
              var keys = Object.keys(body);
              function syncChild() {
                var key = keys.shift();
                if(key) {
                  var childPath = path + key;
                  target.getRevision(childPath).then(function(childRev) {
                    console.log('got revision', childPath, childRev, 'changed?', childRev != body[key]);
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

  RemoteStorage.sync = function(source, target, path) {
    return synchronize(source, target, path);
  };

  RemoteStorage.syncTree = function(source, target, path) {
    return synchronize(source, target, path, {
      data: false
    });
  };

})();
