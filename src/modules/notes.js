remoteStorage.defineModule('notes', function(privateClient, publicClient) {
  var changeCb = function(e) { console.log('Please set a change handler', e); };
  privateClient.on('change', function(e) {
    changeCb(e);
  });
  return {
    exports: {
      setNote: function (text) {
        return privateClient.storeFile('text/plain', 'note.txt', text);
      },
      getNote: function () {
        return privateClient.getFile('note.txt').then(function(obj) {
          return obj.data;
        });
      },
      onChange: function (cb) {
        changeCb = cb;
      }
    }
  };
});
