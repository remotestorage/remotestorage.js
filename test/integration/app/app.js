define(['remotestorage/remoteStorage-modules'], function(remoteStorage) {

  // make remoteStorage global, so injected scripts can access it.
  window.remoteStorage = remoteStorage;

  (window.clearStateChanges = function() {
    window.stateChanges = [];
  })();

  window.onload = function() {

    remoteStorage.claimAccess('root', 'rw');

    remoteStorage.root.use('/');

    remoteStorage.onWidget('state', function(state) {
      stateChanges.push(state);
    });

    remoteStorage.displayWidget('remotestorage-connect');

  }

});
