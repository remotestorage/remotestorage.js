define([
  'require',
  './ajax',
  './oauth',
  './session',
  './sync',
  './versioning',
  './webfinger',
  './button'
], function(require, ajax, oauth, session, sync, versioning, webfinger, button) {
  var deadLine;
  var working=false;
  var intervalTimer;
  var options = {
    onChange: function(key, oldValue, newValue) {
      console.log('item "'+key+'" changed from "'+oldValue+'" to "'+newValue+'"');
      console.log('WARNING: Please configure an onChange function! Forcing full page refresh instead');
      window.location = '';
    },
    category: location.host.replace(/\./g, '_')
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
        ajax.ajax({
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
    webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true
    }, onError, function(attributes) {
      var backendAddress = webfinger.resolveTemplate(attributes.template, options.category);
      if(attributes.api == 'CouchDB') {
        localStorage.setItem('_shadowBackendModuleName', 'couch');
      } else if(attributes.api == 'WebDAV') {
        localStorage.setItem('_shadowBackendModuleName', 'dav');
      } else if(attributes.api == 'simple') {
        localStorage.setItem('_shadowBackendModuleName', 'dav');
      } else {
        console.log('API "'+attributes.api+'" not supported! please try setting api="CouchDB" or "WebDAV" or "simple" in webfinger');
      }
      session.set('backendAddress', backendAddress);
      oauth.go(attributes.auth, options.category, userAddress);
    });
  }
  function disconnect() {
    session.disconnect();
    var isConnected = session.isConnected();
    var userAddress = session.get('userAddress');
    button.show(isConnected, userAddress);
  }
  function configure(setOptions) {
    console.log(setOptions);
    if(setOptions) {
      for(var i in setOptions) {
        options[i] = setOptions[i];
      }
      if(setOptions.userAddress) {
        connectTo(setOptions.userAddress);
      }
    }
  }
  function needLoginBox() {
    if(options.suppressDialog) {
      console.log('suppressing dialog');
      return false;
    } else {
      return true;
    }
  }
  function linkButtonToSession() {
    var isConnected = session.isConnected();
    var userAddress = session.get('userAddress');
    if(needLoginBox()) {
      button.on('connect', connect);
      button.on('disconnect', disconnect);
      button.show(isConnected, userAddress);
    }
  }
  function afterLoadingBackend(backendObj) {
    oauth.harvestToken(function(token) {
      session.set('token', token);
      if(backendObj) {
        backendObj.init(session.get('backendAddress'), token);
        console.log('set backendObj');
      }
      sync.start();
    });
    sync.setBackend(backendObj);
    if(options.suppressAutoSave) {
      console.log('suppressing autosave');
    } else {
      trigger('timer');
      var autoSaveMilliseconds = 5000;//FIXME: move this to some sort of config
      setInterval(function() {
        trigger('timer');
      }, autoSaveMilliseconds);
    }
    document.getElementById('remoteStorageSpinner').style.display='none';
  }
  
  function onLoad(setOptions) {
    configure(setOptions); 
    if(needLoginBox()) {
      linkButtonToSession();
    }
    var backendName = localStorage.getItem('_shadowBackendModuleName')
    if(backendName) {
      require(['./' + backendName], afterLoadingBackend);
    } else {
      console.log('no backend for sync');
      afterLoadingBackend(null);
    }
  }
  function trigger(event, cb) {
    document.getElementById('remoteStorageSpinner').style.display='inline';
    console.log(event);
    if(!working) {
      var newTimestamp = versioning.takeLocalSnapshot()
      if(newTimestamp) {
        console.log('changes detected');
        if(session.isConnected()) {
          console.log('pushing');
          sync.push(newTimestamp);
        } else {
          console.log('not connected');
        }
      }
      if(session.isConnected()) {
        working = true;
        sync.work(deadLine, function(incomingKey, incomingValue) {
          console.log('incoming value "'+incomingValue+'" for key "'+incomingKey+'".');
          var oldValue = localStorage.getItem(incomingKey);
          versioning.incomingChange(incomingKey, incomingValue);
          options.onChange(incomingKey, oldValue, incomingValue);
        }, function() {
          working = false;
          if(cb) {
            cb();
            }
        });
      } else {
        document.getElementById('remoteStorageSpinner').style.display='none';
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

});
