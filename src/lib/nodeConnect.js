
define(['./wireClient', './webfinger'], function(wireClient, webfinger) {

  return {

    setUserAddress: function(userAddress, callback) {
      webfinger.getStorageInfo(userAddress, { timeout: 3000 }, function(err, data) {
        if(err) {
          console.error("Failed to look up storage info for user " + userAddress + ": ", err);
        } else {
          wireClient.setStorageInfo(data.type, data.href);
        }

        callback(err);
      });
    },

    setStorageInfo: wireClient.setStorageInfo,
    setBearerToken: wireClient.setBearerToken

  }

});