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
    onStatus: function(oldStatus, newStatus) {
      console.log('remoteStorage status changed from '+oldStatus+' to '+newStatus);
    },
    category: (location.protocol+'__'+location.host).replace(/\./g, '_').replace(/:/g, '_')
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
  function getBrowseridAccess(url, assertion, audience, cb) {
    ajax.ajax({
      url: url,
      method: 'POST',
      data: 'assertion='+encodeURIComponent(assertion)+'&audience='+audience,
      success: function(data) {
        try {
          var responseObj = JSON.parse(data);
          cb(responseObj.token);
        } catch(e) {
          console.log('something wrong with the browserid2couch token');
        }
      },
      error: function() {
        console.log('error in getBrowseridAccess call');
      }
    });
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
      if(options.requestBrowseridAccess && options.assertion && options.audience && attributes.browseridAccess) {
        console.log('going with browserid access');
        //set backend
        var backendName = localStorage.getItem('_shadowBackendModuleName')
        if(backendName) {
          require(['./' + backendName], function(backendObj) {
            afterLoadingBackend(backendObj);
            getBrowseridAccess(attributes.browseridAccess, options.assertion, options.audience, withToken);
          });
        } else {
          console.log('we got no backend');
        }
      } else {
        oauth.go(attributes.auth, options.category, userAddress);
      }
    });
  }
  function disconnect() {
    session.disconnect();
    options.onStatus({name: 'online'}, {name: 'disconnected'});
    var isConnected = session.isConnected();
    var userAddress = session.get('userAddress');
    button.show(isConnected, userAddress);
  }
  function configure(setOptions, onToken) {
    console.log(setOptions);
    if(setOptions) {
      for(var i in setOptions) {
        options[i] = setOptions[i];
      }
      if(setOptions.userAddress) {
        connectTo(setOptions.userAddress);
        if(onToken) {//oauth token would come here by StorageEvent from the oauth modal
          window.addEventListener('storage', function(e) {
            console.log('detected a change in key '+e.key);
            if(e.key == '_shadowBackendToken') {
              onToken();//will scope get here?
            }
          }, false);
        }
      } else if(onToken) {
        onToken();
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
  function withToken(token) {
    session.set('token', token);
    var backendName = localStorage.getItem('_shadowBackendModuleName')
    if(backendName) {
      require(['./' + backendName], function(backendObj) {
        backendObj.init(session.get('backendAddress'), token);
        console.log('set backendObj');
      });
    } else {
      console.log('got no backend in withToken');
    }
    options.onStatus({name: 'disconnected'}, {name: 'online'});
    sync.start();
  }
  function afterLoadingBackend(backendObj) {
    if(sessionStorage.getItem('onlineEventPending')) {
      sessionStorage.removeItem('onlineEventPending');
      options.onStatus({name: 'disconnected'}, {name: 'online'});
    }
    oauth.harvestToken(withToken);
    sync.setBackend(backendObj);
    if(options.suppressAutoSave) {
      //console.log('suppressing autosave');
    } else {
      trigger('timer');
      var autoSaveMilliseconds = 5000;//FIXME: move this to some sort of config
      setInterval(function() {
        trigger('timer');
      }, autoSaveMilliseconds);
    }
    //document.getElementById('remoteStorageSpinner').style.display='none';
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
  function getStatus() {
    if(session.isConnected()) {
      return {
        name: 'online'
      };
    } else {
      return {
        name: 'disconnected'
      };
    }
  }
  function share(key, cb) {
    var backendName = localStorage.getItem('_shadowBackendModuleName')
    if(backendName) {
      require(['./' + backendName, 'sha1'], function(backend, sha1) {
        var hash=sha1.hash(localStorage.getItem(key));
        backend.set(hash, localStorage.getItem(key), function() {
          cb('something went wrong');
        }, function() {
           cb(hash);
        }, NaN);
      });
    } else {
      console.log('no backend for sync');
      afterLoadingBackend(null);
    }
  }
  function getPublicBackend(userAddress, err, cb) {
    webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true
    }, err, function(attributes) {
      if(attributes.api == 'CouchDB') {
        var publicCategoryUrl = webfinger.resolveTemplate(attributes.template, 'public');
        cb({
          get: function(key, err, cb) {
            ajax.ajax({
              url: publicCategoryUrl+key,
              error: err,
              success: function(data) {
                try {
                  var obj = JSON.parse(data);
                  cb(obj.value);
                } catch(e) {
                  err(e);
                }
              }
            });
          }
        });
      } else {
        err('dont know api '+attributes.api);
      }
    });
  }
  function receive (senderAddress, hash, cb) {
    getPublicBackend(senderAddress, function() { cb('no good backend'); }, function(backend) {
      backend.get(hash, function() {
        cb('something went wrong');
      }, function(value) {
        cb(value);
      }, NaN);
    });
  }
  return {
    configure: configure,
    onLoad: onLoad,
    trigger: trigger,
    getStatus: getStatus,
    share: share,
    receive: receive
  };
});
