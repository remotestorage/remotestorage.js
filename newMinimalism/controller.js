exports.controller = (function() {
  function configure(setOptions) {
    console.log(setOptions);
  }
  return {
    configure: configure
  };
})();


var scripts = document.getElementsByTagName('script');
for(i in scripts) {
  if((new RegExp(exports.config.jsFileName+'$')).test(scripts[i].src)) {
    var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
    exports.controller.configure(options);
  }
}
