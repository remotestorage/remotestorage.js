(function() {



  var config = {
    jsFileName: 'remoteStorage.js',
    modulesFilePath: 'http://unhosted.nodejitsu.com/'
  };




  var modules = [
    'ajax',

    'webfinger',
    'oauth',
    'session',

    'couch',

    'sync',
    'versioning',

    'controller',
    'button'
  ];
  function require(script) {
    var s = document.createElement('script');
    s.setAttribute('src', script);
    document.head.appendChild(s);
  }
  window.exports = {};
  //require('http://browserid.org/include.js');
  for(var i = 0; i < modules.length; i++) { 
    require(config.modulesFilePath + modules[i]+'.js');
  }

  function whenReady() {
    var scripts = document.getElementsByTagName('script');
    for(var i=0; i < scripts.length; i++) {
      if((new RegExp(config.jsFileName+'$')).test(scripts[i].src)) {
        var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
        exports.controller.onLoad(options);
      }
    }
  }
  window.exports.checkReady = function() {
    for(var i = 0; i < modules.length; i++) {
      if(typeof(exports[modules[i]]) == 'undefined') {
        setTimeout("window.exports.checkReady();", 1000);
        console.log(modules[i]+': not ready');
        console.log('all systems: not go');
        return;
      } else {
        console.log(modules[i]+': ready');
      }
    }
    console.log('all systems: go');
    whenReady();
  }

  window.remoteStorage = {
    syncNow: function() {
      return window.exports.controller.trigger('syncNow');
    },
    configure: function(obj) {
      return window.exports.controller.configure(obj);
    }
  }
  //FIXME: not use a timer here to wait for the scripts to load :)
  setTimeout("window.exports.checkReady();", 0);
})();
