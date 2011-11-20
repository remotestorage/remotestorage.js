exports.controller = (function() {
  var intervalTimer;
  var options = {};
  function onError(str) {
    alert(str);
  }
  function connect(userAddress) {
    exports.webfinger.getAttributes(userAddress, onError, function(attributes) {
      exports.oauth.go(attributes.auth, location.host, userAddress);
    });
  }
  function disconnect() {
    exports.session.disconnect();
    var isConnected = exports.session.isConnected();
    var userAddress = exports.session.getUserAddress();
    exports.button.show(isConnected, userAddress);
  }
  function configure(setOptions) {
    console.log(setOptions);
    options = setOptions;
  }
  function linkButtonToSession () {
    var isConnected = exports.session.isConnected();
    var userAddress = exports.session.getUserAddress();
    exports.button.on('connect', connect);
    exports.button.on('disconnect', disconnect);
    exports.button.show(isConnected, userAddress);
    exports.oauth.harvestToken(function(token) {
      exports.session.setToken(token);
    });
  }
  function initTimer() {
    intervalTimer = setInterval("exports.controller.trigger('timer');", 10000);
  }
  function onLoad(setOptions) {
    configure(setOptions); 
    linkButtonToSession();
    initTimer();
  }
  function trigger(event) {
    console.log(event);
    if(exports.versioning.takeLocalSnapshot()) {
      console.log('changes detected');
      if(exports.session.isConnected()) {
        console.log('pushing');
      } else {
        console.log('not connected');
      }
    }
  }
  return {
    configure: configure,
    onLoad: onLoad,
    trigger: trigger
  };
})();
