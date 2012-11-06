
require.config({
  paths: {
    remotestorage: "../../../src/"
  }
});

define([
  'remotestorage/remoteStorage', 'remotestorage/lib/schedule'
], function(remoteStorage, schedule) {

  remoteStorage.util.setLogLevel('debug');

  remoteStorage.defineModule('images', function(privClient, pubClient) {
    pubClient.use('');

    return {
      exports: {
        addPublic: function(file, callback) {
          var reader = new FileReader();
          reader.onload = function() {
            pubClient.storeDocument(file.type, file.name, reader.result, function() {
              callback(pubClient.getItemURL(file.name));
            });
          };      
          reader.readAsArrayBuffer(file);
        },

        removePublic: function(name) {
          pubClient.remove(name);
        },

        getPublicUrl: function(name) {
          return pubClient.getItemURL(name);
        },

        on: pubClient.on
      }
    }
  });


  var imageList;

  remoteStorage.images.on('change', function(event) {
    var fileName = event.relativePath;
    if(event.newValue && ! event.oldValue) {
      // created
      var itemElement = document.createElement('li');
      itemElement.setAttribute('data-filename', fileName);
      itemElement.innerHTML = fileName;
      var deleteLink = document.createElement('span');
      deleteLink.setAttribute('class', 'delete');
      deleteLink.innerHTML = '&times;';
      itemElement.appendChild(deleteLink);
      imageList.appendChild(itemElement);
    } else if(event.newValue) {
      // updated
    } else {
      // deleted
      var nChildren = imageList.children.length;
      for(var i=0;i<nChildren;i++) {
        if(imageList.children[i].getAttribute('data-filename') == fileName) {
          imageList.removeChild(imageList.children[i]);
          return;
        }
      }
      console.log("WARNING: deleted image not found in list: ", fileName);
    }
  });

  window.addEventListener('load', function() {
    console.log("STATE", remoteStorage.getWidgetState());
    if(remoteStorage.getWidgetState() == 'anonymous') {
      document.getElementById('disconnected').style.display = 'block';
    }

    var target = document.getElementById('target');

    function displayImage(url) {
      target.innerHTML = '';
      var img = document.createElement('img');
      img.setAttribute('src', url);
      target.appendChild(img);
      var urlInfo = document.createElement('input');
      urlInfo.setAttribute('value', url);
      target.appendChild(urlInfo);
      urlInfo.addEventListener('click', function() {
        urlInfo.setSelectionRange(0, url.length);
      });
    }

    imageList = document.getElementById('list')

    imageList.addEventListener('click', function(event) {
      if(event.target.tagName == 'LI') {
        displayImage(remoteStorage.images.getPublicUrl(event.target.getAttribute('data-filename')));
      } else if(event.target.getAttribute('class') == 'delete') {
        remoteStorage.images.removePublic(event.target.parentNode.getAttribute('data-filename'));
      }
    });

    remoteStorage.onWidget('ready', function() {
      schedule.disable();
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
          remoteStorage.images.addPublic(file, function(url) {
            console.log("SAVED IMAGE", url);
            displayImage(url);
          });
        }
      });
    });

    remoteStorage.claimAccess('images', 'rw');
    remoteStorage.displayWidget('remotestorage-connect');

  });


});
