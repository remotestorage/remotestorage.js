define(function(require, exports, module) {
  exports.controller = (function() {
    var modules = {
      versioning: require('versioning').versioning,
      session: require('session').session,
      sync: require('sync').sync,
      ajax: require('ajax').ajax,
      webfinger: require('webfinger').webfinger,
      oauth: require('oauth').oauth,
      couch: require('couch').couch,
      button: require('button').button
    };
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
      if(true) {
      //if(false) {
        connectTo(userAddress);
      } else {
        navigator.id.getVerifiedEmail(function(assertion) {
          console.log(assertion);
          modules.ajax({
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
      modules.webfinger.getAttributes(userAddress, {
        allowHttpWebfinger: true,
        allowSingleOriginWebfinger: false,
        allowFakefinger: true
      }, onError, function(attributes) {
        var backendAddress = modules.webfinger.resolveTemplate(attributes.template, options.category);
        if(attributes.api == 'CouchDB') {
          localStorage.setItem('_shadowBackendModuleName', 'couch');
        } else {
          console.log('API "'+attributes.api+'" not supported! please try setting api="CouchDB" in webfinger');
        }
        modules.session.set('backendAddress', backendAddress);
        modules.oauth.go(attributes.auth, options.category, userAddress);
      });
    }
    function disconnect() {
      modules.session.disconnect();
      var isConnected = modules.session.isConnected();
      var userAddress = modules.session.get('userAddress');
      modules.button.show(isConnected, userAddress);
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
      var isConnected = modules.session.isConnected();
      var userAddress = modules.session.get('userAddress');
      if(needLoginBox()) {
        modules.button.on('connect', connect);
        modules.button.on('disconnect', disconnect);
        modules.button.show(isConnected, userAddress);
      }
    }
    function onLoad(setOptions) {
      configure(setOptions); 
      if(needLoginBox()) {
        linkButtonToSession();
      }
      modules.oauth.harvestToken(function(token) {
        exports.session.set('token', token);
        modules[localStorage.getItem('_shadowBackendModuleName')].init(
          modules.session.get('backendAddress'),
          token);
        modules.sync.start();
      });
      modules.sync.setBackend(modules[localStorage.getItem('_shadowBackendModuleName')]);
      trigger('timer');
    }
    function trigger(event) {
      console.log(event);
      if(event == 'timer') {
        //if timer-triggered, update deadLine and immediately schedule next time
        var now = (new Date()).getTime();
        var autoSaveMilliseconds = 5000;//FIXME: move this to some sort of config
        deadLine = now + autoSaveMilliseconds;
        setTimeout(function() {
          require(['controller'], function(controller) {
            controller.controller.trigger('timer');
          })
        }, autoSaveMilliseconds);
      }
      if(!working) {
        var newTimestamp = modules.versioning.takeLocalSnapshot()
        if(newTimestamp) {
          console.log('changes detected');
          if(modules.session.isConnected()) {
            console.log('pushing');
            modules.sync.push(newTimestamp);
          } else {
            console.log('not connected');
          }
        }
        if(modules.session.isConnected()) {
          working = true;
          modules.sync.work(deadLine, function(incomingKey, incomingValue) {
            console.log('incoming value "'+incomingValue+'" for key "'+incomingKey+'".');
            var oldValue = localStorage.getItem(incomingKey);
            modules.versioning.incomingChange(incomingKey, incomingValue);
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
});
