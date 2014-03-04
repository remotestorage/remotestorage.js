define([], function (undefined) {
  var queue = [];
  var util = {
    changeHandler: undefined,
    puts: function(s) {
      util.print(s + "\n");
    },
    print: function(s) {
      if(! s) return;
      if(! util.outputTarget) {
        queue.push(s);
      } else {
        util.outputTarget.innerHTML += s.replace(/[<>&]/g, function(x) {
          return x === '>' ? '&gt;' : x === '<' ? '&lt;' : '&amp;';
        }).replace(/\{\{[^\}]+\}\}/g, function(m) {
          if(m === '{{/}}') return '</span>';
          return '<span style="' + m.slice(2, -2) + '">';
        }).replace(/\n/g, '<br/>');
      }
      if(util.changeHandler) {
        setTimeout(util.changeHandler,0);
      }
      return s;
    }
  };
  var outputTarget = document.getElementById('test-output');
  Object.defineProperty(util, 'outputTarget', {
    set: function (v) {
      outputTarget = v;
      while(util.print(queue.shift()));
    },
    get: function() { return outputTarget; }
  });
  return util;
});
