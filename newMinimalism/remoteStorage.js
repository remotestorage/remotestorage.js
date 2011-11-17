(function() {
  function require(script) {
    var s = document.createElement('script');
    s.setAttribute('src', script);
    document.head.appendChild(s);
  }
  window.exports = {};
  require('http://browserid.org/include.js');
  require('http://unhost.it/config.js');
  require('http://unhost.it/webfinger.js');
  require('http://unhost.it/oauth.js');
  require('http://unhost.it/controller.js');
})();
