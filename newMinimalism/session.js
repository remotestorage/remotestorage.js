exports.session = (function() {
  function setUserAddress(userAddress) {
    sessionStorage.setItem('_remoteStorageUserAddress', userAddress);
  }
  function setToken(token) {
    sessionStorage.setItem('_remoteStorageToken', token);
  }
  function isConnected() {
    return (sessionStorage.getItem('_remoteStorageToken') != null);
  }
  return {
    setUserAddress: setUserAddress,
    setToken: setToken,
    isConnected: isConnected
  };
})();
