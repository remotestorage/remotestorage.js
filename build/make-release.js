
var fs = require('fs');

function catchErr(hint, callback) {
  return function(err) {
    if(err) {
      console.log(hint + " failed: ", err);
    } else {
      callback.apply(this, Array.prototype.slice.call(arguments, 1));
    }
  };
}

var releaseFiles = {
  'remoteStorage-debug.js': 'remoteStorage.js',
  'remoteStorage.min.js': 'remoteStorage.min.js',
  'remoteStorage-node-debug.js': 'remoteStorage-node.js',
  'remoteStorage-node.min.js': 'remoteStorage-node.min.js'
};

fs.readFile('VERSION', 'UTF-8', catchErr('readFile', function(err, version) {
  fs.mkdir("release/" + version, catchErr('mkdir', function() {
    for(var source in releaseFiles) {
      fs.cpSync('build/latest/' + source,
                'release/' + version + '/' + releaseFiles[source]);
      
    }
  }));
}));