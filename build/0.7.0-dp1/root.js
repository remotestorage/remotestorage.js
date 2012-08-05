remoteStorage.defineModule('root', function(client) {
  return {
    exports: {
      getListing: client.getListing
    }
  }
});
