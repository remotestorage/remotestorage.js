define(function(require, exports, module) {
  exports.go = function(modules) {
    var config = {
      jsFileName: 'remoteStorage.js',
      modulesFilePath: 'http://unhosted.nodejitsu.com/'
    };

    //require('http://browserid.org/include.js');

    var scripts = document.getElementsByTagName('script');
    for(var i=0; i < scripts.length; i++) {
      if((new RegExp(config.jsFileName+'$')).test(scripts[i].src)) {
        var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
        modules.controller.onLoad(options, modules);
      }
    }

    window.remoteStorage = {
      syncNow: function() {
        return modules.controller.trigger('syncNow', modules);
      },
      configure: function(obj) {
        return modules.controller.configure(obj, modules);
      }
    }
  };
});
