
remoteStorage.defineModule('notes', function(privateClient, publicClient) {
  return {
    exports: {
      setNote: function (text) {
        return privateClient.storeFile('text/plain', 'note.txt', text);
      },
      onChange: function (cb) {
        privateClient.on('change', cb);
      }
    }
  };
});
