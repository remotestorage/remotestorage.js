define(['remotestorage/remoteStorage-modules'], function(remoteStorage) {

  window.onload = function() {

    remoteStorage.claimAccess('root', 'rw');

    remoteStorage.root.sync('/');

    remoteStorage.displayWidget('remotestorage-connect');

  }

});