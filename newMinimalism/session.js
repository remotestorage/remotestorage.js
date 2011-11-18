exports.session = (function() {
  function setUserAddress(userAddress) {
    sessionStorage.setItem('_remoteStorageUserAddress', userAddress);
  }
  function setToken(token) {
    sessionStorage.setItem('_remoteStorageToken', token);
  }
  return {
    setUserAddress: setUserAddress,
    setToken: setToken
  };
})();
