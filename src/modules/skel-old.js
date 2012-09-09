remoteStorage.defineModule('changeMe', function(myPrivateBaseClient, myPublicBaseClient) {
  return {
    name: 'changeMe',
    dataHints: {
    },
    exports: {
      example: function() {
        //this would be a method an app could call as remoteStorage.changeMe.example()
      }
    }
  };
});
