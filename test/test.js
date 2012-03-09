remoteStorage.getStorageInfo('user@example.com', function(err, storageInfo) {
  var token = remoteStorage.receiveToken();
  if(token) {
    //we can access the 'notes' category on the remoteStorage of user@example.com:
    var client = remoteStorage.createClient(storageInfo, 'notes', bearerToken);
    client.put('foo', 'bar', function(err) {
      client.get('foo', function(err, data) {
        client.delete('foo', function(err) {
        });
      });
    });
  } else {
    //get an access token for 'notes' by dancing OAuth with the remoteStorage of user@example.com:
    window.location = remoteStorage.createOAuthAddress(storageInfo, ['notes'], window.location.href);
  }
});
