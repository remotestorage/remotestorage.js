define([], function (undefined) {
  // return { puts: console.log.bind(console),
  //          print: console.log.bind(console)
  //        }
  // var outputTarget = document.createElement('pre');
  // outputTarget.style.background = 'black';
  // outputTarget.style.color = '#eee';
  // outputTarget.style.padding = '1em';
  // outputTarget.style.whiteSpace = 'pre-wrap';
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
          return x == '>' ? '&gt;' : x == '<' ? '&lt;' : '&amp;';
        }).replace(/\{\{[^\}]+\}\}/g, function(m) {
          if(m == '{{/}}') return '</span>';
          return '<span style="' + m.slice(2, -2) + '">';
        }).replace(/\n/g, '<br/>');
      }
      if(util.changeHandler)
        setTimeout(util.changeHandler,0);
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
