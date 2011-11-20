exports.controller = (function() {
  var intervalTimer;
  var options = {};
  function onError(str) {
    alert(str);
  }
  function connect(userAddress) {
    var dataCategory = location.host;
    exports.webfinger.getAttributes(userAddress, onError, function(attributes) {
      var backendAddress = exports.webfinger.resolveTemplate(attributes.template, dataCategory);
      exports.backend.init(attributes.api, backendAddress);
      exports.oauth.go(attributes.auth, dataCategory, userAddress);
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
  }
  function initTimer() {
    intervalTimer = setInterval("exports.controller.trigger('timer');", 10000);
  }
  function onLoad(setOptions) {
    configure(setOptions); 
    linkButtonToSession();
    exports.oauth.harvestToken(function(token) {
      exports.session.setToken(token);
      sync.start();
    });
    exports.sync.setBackend(exports.backend);
    initTimer();
  }
  function trigger(event) {
    console.log(event);
    var newTimestamp = exports.versioning.takeLocalSnapshot()
    if(newTimestamp) {
      console.log('changes detected');
      if(exports.session.isConnected()) {
        console.log('pushing');
        exports.sync.push(newTimestamp);
      } else {
        console.log('not connected');
      }
    }
    exports.sync.work(9000);
  }
  return {
    configure: configure,
    onLoad: onLoad,
    trigger: trigger
  };
})();
