define(function(require, exports, module) {
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
    document.getElementById('remoteStorageSpinner').style.display='inline';
    if(true) {
    //if(false) {
      connectTo(userAddress);
    } else {
      navigator.id.getVerifiedEmail(function(assertion) {
        console.log(assertion);
        require('ajax').ajax({
          url: 'http://myfavouritesandwich.org/browserid-verifier',
          method: 'POST',
          data: 'assertion='+assertion+'&audience='+window.location,
          success: function(data) {
            console.log(data);
            connectTo(JSON.parse(data).email);
          },
          error: function(status) {
            console.log('error status '+status);
            document.getElementById('remoteStorageSpinner').style.display='none';
          }
        });
      });
    }
  }
  function connectTo(userAddress) {
    require('webfinger').getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true
    }, onError, function(attributes) {
      var backendAddress = require('webfinger').resolveTemplate(attributes.template, options.category);
      if(attributes.api == 'CouchDB') {
        localStorage.setItem('_shadowBackendModuleName', 'couch');
      } else {
        console.log('API "'+attributes.api+'" not supported! please try setting api="CouchDB" in webfinger');
      }
      require('session').set('backendAddress', backendAddress);
      require('oauth').go(attributes.auth, options.category, userAddress);
    });
  }
  function disconnect() {
    require('session').disconnect();
    var isConnected = require('session').isConnected();
    var userAddress = require('session').get('userAddress');
    require('button').show(isConnected, userAddress);
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
  function linkButtonToSession() {
    var isConnected = require('session').isConnected();
    var userAddress = require('session').get('userAddress');
    if(needLoginBox()) {
      require('button').on('connect', connect);
      require('button').on('disconnect', disconnect);
      require('button').show(isConnected, userAddress);
    }
  }
  function onLoad(setOptions) {
    configure(setOptions); 
    if(needLoginBox()) {
      linkButtonToSession();
    }
    require('oauth').harvestToken(function(token) {
      require('session').set('token', token);
      require(localStorage.getItem('_shadowBackendModuleName')).init(
        require('session').get('backendAddress'),
        token);
      require('sync').start();
    });
    require('sync').setBackend(require(localStorage.getItem('_shadowBackendModuleName')));
    var autoSaveMilliseconds = 5000;//FIXME: move this to some sort of config
    trigger('timer');
    setInterval(function() {
      require(['controller'], function(controller) {
        controller.controller.trigger('timer');
      });
    }, autoSaveMilliseconds);
    document.getElementById('remoteStorageSpinner').style.display='none';
  }
  function trigger(event) {
    document.getElementById('remoteStorageSpinner').style.display='inline';
    console.log(event);
    if(!working) {
      var newTimestamp = require('versioning').takeLocalSnapshot()
      if(newTimestamp) {
        console.log('changes detected');
        if(require('session').isConnected()) {
          console.log('pushing');
          require('sync').push(newTimestamp);
        } else {
          console.log('not connected');
        }
      }
      if(require('session').isConnected()) {
        working = true;
        require('sync').work(deadLine, function(incomingKey, incomingValue) {
          console.log('incoming value "'+incomingValue+'" for key "'+incomingKey+'".');
          var oldValue = localStorage.getItem(incomingKey);
          require('versioning').incomingChange(incomingKey, incomingValue);
          options.onChange(incomingKey, oldValue, incomingValue);
        }, function() {
          working = false;
        });
      } else {
        document.getElementById('remoteStorageSpinner').style.display='none';
      }
    } else {
      console.log('still working?');
    }
  }
  exports.configure = configure;
  exports.onLoad = onLoad;
  exports.trigger = trigger;
});
