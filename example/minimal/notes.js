
remoteStorage.defineModule('notes', function(privateClient, publicClient) {
  return {
    exports: {
      setNote: function (text) {
        return privateClient.storeFile('text/plain', 'note.txt', text);
      },
      getNote: function (cb) {
        privateClient.getFile('note.txt').then(function(obj) {
          cb(obj.data);
        });            
      }
    }
  };
});
