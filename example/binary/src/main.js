
require.config({
  paths: {
    remotestorage: "../../../src/"
  }
});

define(['remotestorage/remoteStorage'], function(remoteStorage) {

  remoteStorage.util.setLogLevel('debug');

  remoteStorage.defineModule('images', function(privClient, pubClient) {
    return {
      exports: {
        addPublic: function(name, blob, mimeType, callback) {
          pubClient.storeDocument(mimeType, name, blob, function() {
            callback(pubClient.getItemURL(name));
          });
        }
      }
    }
  });

  window.addEventListener('load', function() {
    if(remoteStorage.getWidgetState() == 'anonymous') {
      document.getElementById('disconnected').style.display = 'block';
    }

    remoteStorage.onWidget('ready', function() {
      console.log("READY");
      document.getElementById('disconnected').style.display = 'none';
      document.getElementById('connected').style.display = 'block';

      var input = document.getElementById('file-input');
      var action = document.getElementById('action');

      action.addEventListener('click', function() {
        var file = input.files[0];
        if(! file.type.match(/^image\//)) {
          alert("No image mime-type (" + file.type + "). Won't store.");
        } else {
          remoteStorage.images.addPublic(file.name, file, file.type, function(url) {
            document.getElementById('target').setAttribute('src', url);
          });
        }
      });
    });

    remoteStorage.claimAccess('images', 'rw');
    remoteStorage.displayWidget('remotestorage-connect');

  });


});