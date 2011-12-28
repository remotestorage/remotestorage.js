define(function(require) {

  //before doing anything else, display a spinner:
  (function() {
    var spinner = document.createElement('img');
    spinner.setAttribute('id', 'remoteStorageSpinner');
    spinner.setAttribute('src', require.toUrl('./spinner.gif'));
    spinner.setAttribute('style', 'position:fixed;right:3em;top:1em;z-index:99999;');
    document.body.insertBefore(spinner, document.body.firstChild);
  })();
  require(['./controller'], function(controller) {
    var config = {
      jsFileName: 'remoteStorage.js'
    };

    //require('http://browserid.org/include.js');

    var scripts = document.getElementsByTagName('script');
    for(var i=0; i < scripts.length; i++) {
      if((new RegExp(config.jsFileName+'$')).test(scripts[i].src)) {
        var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
        break;
      }
    }
    controller.onLoad(options);

    window.remoteStorage = {
      syncNow: function() {
        return controller.trigger('syncNow');
      },
      configure: function(obj, onToken) {
        return controller.configure(obj, onToken);
      },
      getStatus: function() {
        return controller.getStatus();
      },
      share: function(key, cb) {
        return controller.share(key, cb);
      },
      receive: function(senderAddress, hash, cb) {
        return controller.receive(senderAddress, hash, cb);
      }
    };
  });
});
