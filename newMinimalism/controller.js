exports.controller = (function() {
  function connect(userAddress) {
    exports.webfinger.getAuthAddress(userAddress, exports.oauth.go);
  }
  function disconnect() {
  }
  function configure(setOptions) {
    console.log(setOptions);
    exports.button.on('connect', connect);
    exports.button.on('disconnect', disconnect);
    exports.button.show();
  }
  return {
    configure: configure
  };
})();
