define(['../remoteStorage'], function(remoteStorage) {
  remoteStorage.defineModule('music', function(privateClient, publicClient) {
    return {
      exports: {

        clear: function() {
          return publicClient.getListing('').then(function(listing) {
            return remoteStorage.util.asyncEach(listing, function(item) {
              return publicClient.remove(item);
            });
          });
        },

        storeSong: function(path, arrayBuffer) {
          if(false) {
            var url = localStorage['remotestorage_wire:storageHref']+'/public/music/'+path;
            var authHeader = 'Bearer '+localStorage['remotestorage_wire:bearerToken'];
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', url, true);
            xhr.setRequestHeader('Authorization', authHeader);
            xhr.setRequestHeader('Content-Type', 'audio/ogg; charset=binary');
            xhr.onreadystatechange = function() {
            };
            xhr.send(arrayBuffer);
          } else {
            console.log('publicClient.storeFile(audio/ogg', path, arrayBuffer);
            publicClient.storeFile('audio/ogg', path, arrayBuffer);
          }
        },

        listSongs: function() {
          return publicClient.getListing('');
        },

        getSongURL: function(path) {
          return publicClient.getItemURL(path);
        }

      }
    }
  });

  return remoteStorage.music;
});