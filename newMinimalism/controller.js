exports.controller = (function() {
  function onError(str) {
    alert(str);
  }
  function connect(userAddress) {
    exports.webfinger.getAttributes(userAddress, onError, function(attributes) {
      exports.oauth.go(attributes.auth, location.host, userAddress);
    });
/*
    var category = location.host;
    if(window.remoteStorage.isConnected()) {
      window.remoteStorage.disconnect();
      DisplayConnectionState();
    } else {
      if(document.getElementById('userAddressInput').value!='') {
        window.remoteStorage._tryConnect();
        window.remoteStorage.configure({
          userAddress: document.getElementById('userAddressInput').value,
          category: category
        });
        DisplayConnectionState();
      }
    }
*/

  }
  function disconnect() {
  }
  function configure(setOptions) {
    console.log(setOptions);
    exports.button.on('connect', connect);
    exports.button.on('disconnect', disconnect);
    exports.button.show();
  }
  function harvestToken() {
    exports.oauth.harvestToken(function(token) {
      exports.session.setToken(token);
    });
  }
  return {
    configure: configure,
    harvestToken: harvestToken
  };
})();
