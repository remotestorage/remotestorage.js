(function() {
  var modules = [
    'config',
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
  for(var i in modules) { 
    require('http://unhost.it/'+modules[i]+'.js');
  }

  function whenReady() {
    var scripts = document.getElementsByTagName('script');
    for(i in scripts) {
      if((new RegExp(exports.config.jsFileName+'$')).test(scripts[i].src)) {
        var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
        exports.controller.onLoad(options);
      }
    }
  }
  window.exports.checkReady = function() {
    for(var i in modules) {
      if(typeof(modules[i]) == "string") {//necessary for compatibility with UNG?/dojo?/jquery? contamination of the array prototype
        if(typeof(exports[modules[i]]) == 'undefined') {
          setTimeout("window.exports.checkReady();", 1000);
          console.log(modules[i]+': not ready');
          console.log('all systems: not go');
          return;
        } else {
          console.log(modules[i]+': ready');
        }
      }
    }
    console.log('all systems: go');
    whenReady();
  }

  window.remoteStorage = {
    syncNow: function() {
      exports.controller.trigger('syncNow');
    }
  }
  //FIXME: not use a timer here to wait for the scripts to load :)
  setTimeout("window.exports.checkReady();", 0);
})();
