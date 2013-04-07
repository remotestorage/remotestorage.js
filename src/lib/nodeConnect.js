/*global console */

define(['./webfinger'], function(webfinger) {

  "use strict";

  // Namespace: nodeConnect
  //
  // Exposes some internals of remoteStorage.js to allow using it from nodejs.
  //
  // Example:
  //   (start code)
  //
  //   remoteStorage.nodeConnect.setUserAddress('bob@example.com', function(err) {
  //     if(! err) {
  //       remoteStorage.nodeConnect.setBearerToken("my-crazy-token");
  //
  //       console.log("Connected!");
  //
  //       // it's your responsibility to make sure the token given above
  //       // actually allows gives you that access. this line is just to
  //       // inform remoteStorage.js about it:
  //       remoteStorage.claimAccess('contacts', 'r');
  //
  //       console.log("My Contacts: ",
  //         remoteStorage.contacts.list().map(function(c) {
  //           return c.fn }));
  //     }
  //   });
  //
  //   (end code)

  function deprecate(thing, replacement) {
    console.log("WARNING: " + thing + " is deprecated, " + (replacement ? "use " + replacement + " instead." : "without replacement."));
  }

  return function(remoteStorage) {

    return {

    // Method: setUserAddress
      //
      // Set user address and discover storage info.
      //
      // Parameters:
      //   userAddress - the user address as a string
      //   callback    - callback to call once finished
      //
      // As soon as the callback is called, the storage info has been discovered or an error has happened.
      // It receives a single argument, the error. If it's null or undefined, everything is ok.
      setUserAddress: function(userAddress, callback) {
        webfinger.getStorageInfo(userAddress, { timeout: 3000 }, function(err, data) {
          if(err) {
            console.error("Failed to look up storage info for user " + userAddress + ": ", err);
          } else {
            remoteStorage.setStorageInfo(data.type, data.href);
          }

          callback(err);
        });
      },

      // Method: setStorageInfo
      //
      // Set storage info directly.
      //
      // This can be used, if your storage provider doesn't support Webfinger or you
      // simply don't want the extra overhead of discovery.
      //
      // Parameters:
      //   type - type of storage. If your storage supports remotestorage 2012.04, this is "https://www.w3.org/community/rww/wiki/read-write-web-00#simple"
      //   href - base URL of your storage
      //   
      setStorageInfo: function(storageInfo) {
        deprecate('remoteStorage.nodeConnect.setStorageInfo', 'remoteStorage.setStorageInfo');
        return remoteStorage.setStorageInfo(storageInfo);
      },

      // Method: setBearerToken
      //
      // Set bearer token directly.
      //
      setBearerToken: function(bearerToken) {
        deprecate('remoteStorage.nodeConnect.setBearerToken', 'remoteStorage.setBearerToken');
        return remoteStorage.setBearerToken(bearerToken);
      }

    };

  };

});