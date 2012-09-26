
remoteStorage.defineModule('buddyradar', function(privateClient, publicClient) {

  publicClient.sync('');

  return {
    exports: {

      getMyLocation: function(callback) {
        publicClient.getObject('my-location', callback);
      },

      setMyLocation: function(location) {
        publicClient.storeObject('location', 'my-location', location);
      }
    }
  }

});