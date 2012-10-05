
(function() {

  var userAddress;

  function connect() {
    remoteStorage.getStorageInfo(userAddress, function(err, storageInfo) {
      var token = remoteStorage.receiveToken();
      if(token) {
        console.log("Received token: ", token);
        //we can access the 'notes' category on the remoteStorage of user@example.com:
        var client = remoteStorage.createClient(storageInfo, 'notes', token);
        client.put('key', 'value', function(err) {
          client.get('key', function(err, data) {
            client.delete('key', function(err) {
              console.log(data);
            });
          });
        });
      } else {
        //get an access token for 'notes' by dancing OAuth with the remoteStorage of user@example.com:
        window.location = remoteStorage.createOAuthAddress(storageInfo, ['notes'], window.location.href);
      }
    });  
  }

  window.onload = function() {
    if(userAddress = localStorage.getItem('userAddress')){
      connect();
    } else {
      document.getElementsByTagName('form')[0].onsubmit = function() {
        userAddress = document.getElementById('user-address').value;
        localStorage.setItem('userAddress', userAddress);
        connect();
        return false;
      }
    }
  }

})();