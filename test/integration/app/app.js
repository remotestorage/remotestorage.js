define(['remotestorage/remoteStorage-modules'], function(remoteStorage) {

  window.onload = function() {

    remoteStorage.claimAccess('root', 'rw');

    remoteStorage.displayWidget('remotestorage-connect');
  }

});