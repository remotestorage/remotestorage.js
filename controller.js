exports.controller = (function() {
  var intervalTimer;
  var options = {};
  function onError(str) {
    alert(str);
  }
  function connect(userAddress) {
    var dataCategory = location.host.replace('.', '_');
    exports.webfinger.getAttributes(userAddress, onError, function(attributes) {
      var backendAddress = exports.webfinger.resolveTemplate(attributes.template, dataCategory);
      if(attributes.api == 'CouchDB') {
        localStorage.setItem('_shadowBackendModuleName', 'couch');
      } else {
        console.log('API "'+attributes.api+'" not supported! please try setting api="CouchDB" in webfinger');
      }
      exports.session.set('backendAddress', backendAddress);
      exports.oauth.go(attributes.auth, dataCategory, userAddress);
    });
  }
  function disconnect() {
    exports.session.disconnect();
    var isConnected = exports.session.isConnected();
    var userAddress = exports.session.get('userAddress');
    exports.button.show(isConnected, userAddress);
  }
  function configure(setOptions) {
    console.log(setOptions);
    options = setOptions;
  }
  function linkButtonToSession () {
    var isConnected = exports.session.isConnected();
    var userAddress = exports.session.get('userAddress');
    exports.button.on('connect', connect);
    exports.button.on('disconnect', disconnect);
    exports.button.show(isConnected, userAddress);
  }
  function initTimer() {
    intervalTimer = setInterval("exports.controller.trigger('timer');", exports.config.autoSaveMilliseconds);
  }
  function onLoad(setOptions) {
    configure(setOptions); 
    linkButtonToSession();
    exports.oauth.harvestToken(function(token) {
      exports.session.set('token', token);
      exports[localStorage.getItem('_shadowBackendModuleName')].init(
        exports.session.get('backendAddress'),
        token);
      exports.sync.start();
    });
    exports.sync.setBackend(exports[localStorage.getItem('_shadowBackendModuleName')]);
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
    if(exports.session.isConnected()) {
      exports.sync.work((exports.config.autoSaveMilliseconds * 9)/10, function() {
        console.log('back in controller after work.');
      });
    }
  }
  return {
    configure: configure,
    onLoad: onLoad,
    trigger: trigger
  };
})();
