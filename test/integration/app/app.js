define(['remotestorage/remoteStorage-modules'], function(remoteStorage) {

  // make remoteStorage global, so injected scripts can access it.
  window.remoteStorage = remoteStorage;

  window.onload = function() {

    remoteStorage.claimAccess('root', 'rw');

    remoteStorage.root.sync('/');

    remoteStorage.displayWidget('remotestorage-connect');

  }

});