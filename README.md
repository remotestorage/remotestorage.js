remoteStorage.js
================

This is a library for adding remoteStorage support to your client-side app. See http://unhosted-tutorial.galfert.5apps.com/ for example usage.

Version and license
=======
This is version 0.4.5 of the library, and you can use it under AGPL or MIT license - whatever floats your boat. Pull requests are very welcome (if you're not on github you can email them to michiel at unhosted.org).

Code example
=========

    require(['./js/remoteStorage'], function(remoteStorage) {
      var bearerToken = remoteStorage.receiveToken();
      if(bearerToken) {
        var client = remoteStorage.createClient(JSON.parse(localStorage.storageInfo), 'sandwiches', bearerToken);
        client.put('foo', 'bar', function(err) {
          client.get('foo', function(err, data) {
            alert(data);
          });
        });
      } else {
        remoteStorage.getStorageInfo('user@example.com', function(err, storageInfo) {
          localStorage.storageInfo=JSON.stringify(storageInfo);
          window.location = remoteStorage.createOAuthAddress(storageInfo, ['sandwiches'], window.location.href);
        });
      }
    });


Function reference
=======

remoteStorage.getStorageInfo(userAddress, callback) {}
-------


remoteStorage.createOAuthAddress(storageInfo, categories, redirectUri) {}
-------


remoteStorage.receiveToken() {}
-------


remoteStorage.createClient(storageInfo, category, bearerToken) {}
-------


client.get(key, callback) {}
-------


client.put(key, value, callback) {}
-------


client.delete(key, callback) {}
-------

