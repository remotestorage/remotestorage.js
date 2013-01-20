remoteStorage.defineModule('code', function(privateClient, publicClient) {
  var currCb = function() {},
    dirCb = function() {},
    currDir, currFile;
  function goToDir(path) {
    privateClient.getListing(path).then(function(arr) {
      currDir = path;
      var dirParts = path.split('/'),
        obj = { items: arr, dir: [] };
      for(var i=0; i<dirParts.length-1; i++) {
        obj.dir.push(dirParts[i]+'/');
      }
      dirCb(obj);
    }); 
  }
  function goToFile(path) {
    currFile=path;
    privateClient.getFile(path).then(function(obj) {
      obj.path = path;
      currCb(obj);
    });
  }
  privateClient.on('change', function(event) {
    goToDir(currDir);
    if(event.relativePath == currFile) {
      goToFile(currFile);
    }
  });
  return {
    exports: {
      up: function(path, type, content) {
        console.log('privateClient.storeFile', type, path, content);
        return privateClient.storeFile(type, path, content);
      },
      down: function(path) {
        privateClient.getFile(path).then(function(obj) {
          obj.path = path;
          currCb(obj);
        });
      },
      goToDir: goToDir,
      goToFile: goToFile,
      onDir: function(cb) {
        dirCb = cb;
      },
      onCurr: function(cb) {
        currCb = cb;
      }
    }
  };
});
