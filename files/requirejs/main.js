define(function(require, exports, module) {
  exports.go = function() {
    var config = {
      jsFileName: 'remoteStorage.js',
      modulesFilePath: 'http://unhosted.nodejitsu.com/'
    };

    //require('http://browserid.org/include.js');

    var scripts = document.getElementsByTagName('script');
    for(var i=0; i < scripts.length; i++) {
      if((new RegExp(config.jsFileName+'$')).test(scripts[i].src)) {
        var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
        require('controller').controller.onLoad(options);
      }
    }

    window.remoteStorage = {
      syncNow: function() {
        return require('controller').controller.trigger('syncNow');
      },
      configure: function(obj) {
        return require('controller').controller.configure(obj);
      }
    }
  };
});
