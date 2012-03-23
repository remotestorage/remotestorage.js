require(['../src/remoteStorage'], function(remoteStorage) {
  remoteStorage.getStorageInfo('michiel@owncube.com', function(err, storageInfo){console.log(storageInfo);});
});
