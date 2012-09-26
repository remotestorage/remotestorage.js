
defineModule('dontdothis', function(privateClient, publicClient) {

  return {
    exports: {
      privateClient: privateClient,
      publicClient: publicClient
    }
  }

});