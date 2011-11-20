exports.session = (function() {
  function setUserAddress(userAddress) {
    sessionStorage.setItem('_remoteStorageUserAddress', userAddress);
  }
  function setToken(token) {
    sessionStorage.setItem('_remoteStorageToken', token);
  }
  function getUserAddress() {
    return sessionStorage.getItem('_remoteStorageUserAddress');
  }
  function isConnected() {
    return (sessionStorage.getItem('_remoteStorageToken') != null);
  }
  function disconnect() {
    sessionStorage.clear();
  }
  return {
    setUserAddress: setUserAddress,
    setToken: setToken,
    getUserAddress: getUserAddress,
    getApi: getApi,
    isConnected: isConnected,
    disconnect: disconnect
  };
})();
