require(['../src/remoteStorage'], function(remoteStorage) {
  remoteStorage.getStorageInfo('dejong.michiel@gmail.com', function(err, lrdd){console.log(lrdd);});
});
