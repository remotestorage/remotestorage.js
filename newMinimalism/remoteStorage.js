(function() {
  function require(script) {
    var s = document.createElement('script');
    s.setAttribute('src', script);
    document.head.appendChild(s);
  }
  window.exports = {};
  //require('http://browserid.org/include.js');
  require('http://unhost.it/config.js');
  require('http://unhost.it/button.js');
  require('http://unhost.it/ajax.js');
  require('http://unhost.it/webfinger.js');
  require('http://unhost.it/oauth.js');
  require('http://unhost.it/session.js');
  require('http://unhost.it/controller.js');

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
    if(exports.config
      && exports.button
      && exports.ajax
      && exports.webfinger
      && exports.oauth
      && exports.session
      && exports.controller) {
      whenReady();
    } else {
      setTimeout("window.exports.checkReady();", 1000);
    }
  }
  //FIXME: not use a timer here to wait for the scripts to load :)
  setTimeout("window.exports.checkReady();", 0);
})();
