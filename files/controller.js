exports.controller = (function() {
  var deadLine;
  var working=false;
  var intervalTimer;
  var options = {
    onChange: function(key, oldValue, newValue) {
      console.log('item "'+key+'" changed from "'+oldValue+'" to "'+newValue+'"');
      console.log('WARNING: Please configure an onChange function! Forcing full page refresh instead');
      window.location = '';
    },
    category: location.host.replace('.', '_')
  };
  function onError(str) {
    alert(str);
  }
  function connect(userAddress) {
    //if(false) {
    if(true) {
      connectTo(userAddress);
    } else {
      navigator.id.getVerifiedEmail(function(assertion) {
        console.log(assertion);
        exports.ajax({
          //url: 'https://browserid.org/verify',
          //url: 'http://unhosted.org/browserid-verifier',
          //url: 'http://unhosted.nodejitsu.com/browserid-verifier',
          url: 'http://myfavouritesandwich.org/browserid-verifier',
          method: 'POST',
          data: 'assertion='+assertion+'&audience='+window.location,
          success: function(data) {
            console.log(data);
            connectTo(JSON.parse(data).email);
          },
          error: function(status) {
            console.log('error status '+status);
          }
        });
      });
    }
  }
  function connectTo(userAddress) {
    exports.webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true
    }, onError, function(attributes) {
      var backendAddress = exports.webfinger.resolveTemplate(attributes.template, options.category);
      if(attributes.api == 'CouchDB') {
        localStorage.setItem('_shadowBackendModuleName', 'couch');
      } else {
        console.log('API "'+attributes.api+'" not supported! please try setting api="CouchDB" in webfinger');
      }
      exports.session.set('backendAddress', backendAddress);
      exports.oauth.go(attributes.auth, options.category, userAddress);
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
    if(setOptions) {
      for(var i in setOptions) {
        options[i] = setOptions[i];
      }
    }
  }
  function needLoginBox() {
    if(options.suppressDialog) {
      return false;
    } else {
      return true;
    }
  }
  function linkButtonToSession () {
    var isConnected = exports.session.isConnected();
    var userAddress = exports.session.get('userAddress');
    if(needLoginBox()) {
      exports.button.on('connect', connect);
      exports.button.on('disconnect', disconnect);
      exports.button.show(isConnected, userAddress);
    }
  }
  function onLoad(setOptions) {
    configure(setOptions); 
    if(needLoginBox()) {
      linkButtonToSession();
    }
    exports.oauth.harvestToken(function(token) {
      exports.session.set('token', token);
      exports[localStorage.getItem('_shadowBackendModuleName')].init(
        exports.session.get('backendAddress'),
        token);
      exports.sync.start();
    });
    exports.sync.setBackend(exports[localStorage.getItem('_shadowBackendModuleName')]);
    trigger('timer');
  }
  function trigger(event) {
    console.log(event);
    if(event == 'timer') {
      //if timer-triggered, update deadLine and immediately schedule next time
      var now = (new Date()).getTime();
      var autoSaveMilliseconds = 5000;//FIXME: move this to some sort of config
      deadLine = now + autoSaveMilliseconds;
      setTimeout("exports.controller.trigger('timer');", autoSaveMilliseconds);
    }
    if(!working) {
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
        working = true;
        exports.sync.work(deadLine, function(incomingKey, incomingValue) {
          console.log('incoming value "'+incomingValue+'" for key "'+incomingKey+'".');
          var oldValue = localStorage.getItem(incomingKey);
          exports.versioning.incomingChange(incomingKey, incomingValue);
          options.onChange(incomingKey, oldValue, incomingValue);
        }, function() {
          working = false;
        });
      }
    } else {
      console.log('still working?');
    }
  }
  return {
    configure: configure,
    onLoad: onLoad,
    trigger: trigger
  };
})();
