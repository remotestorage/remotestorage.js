require(['../src/remoteStorage'], function(remoteStorage) {
  remoteStorage.getStorageInfo('michiel@5apps.com', function(err, lrdd){console.log(lrdd);});
});
