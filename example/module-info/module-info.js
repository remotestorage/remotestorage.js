
(function() {

  var h = {
    div: function(className, content) {
      var div = this.tag('div', content);
      div.setAttribute('class', className);
      return div;
    },

    tag: function(tagName, content) {
      var tag = document.createElement(tagName);
      if(content) {
        tag.innerHTML = content;
      }
      return tag;
    }
  }

  function renderDataHints(module) {
    var hints = h.div('hints');

    if(module.dataHints) {
      var hint, key, value;
      var hintKeys = Object.keys(module.dataHints);
      var heading = document.createElement('h3');
      heading.innerHTML = 'info';
      hints.appendChild(heading);
      for(var k in hintKeys) {
        var hint = h.div('hint');
        hint.appendChild(h.div('key', hintKeys[k]));
        hint.appendChild(h.div('value', module.dataHints[ hintKeys[k] ]));
        hints.appendChild(hint);
      }
    } else {
      hints.appendChild(h.div(
        'info',
        "(No information provided)"
      ));
    }

    return hints;
  }

  function renderMethods(moduleInstance) {
    var methods = h.div('hints');

    methods.appendChild(h.tag('h2', 'methods'));

    var methodKeys = Object.keys(moduleInstance);
    for(var m=0;m<methodKeys.length;m++) {
      var method = h.div('hint');
      method.appendChild(h.div('key', methodKeys[m]));
      methods.appendChild(method);
    }

    return methods;
  }

  var ul = document.createElement('ul'), li;
  var moduleNames = remoteStorage.getModuleList(), moduleName, module;

  for(var m in moduleNames) {
    moduleName = moduleNames[m];

    li = document.createElement('li');
    li.innerHTML  = '<h2>Module: ' + moduleName + '</h2>';

    module = remoteStorage.getModuleInfo(moduleName);

    li.appendChild(renderDataHints(module));

    remoteStorage.loadModule(moduleName)
    moduleInstance = remoteStorage[moduleName];

    li.appendChild(renderMethods(moduleInstance));

    ul.appendChild(li);
  }

  window.onload = function() {

    document.body.appendChild(ul);

  }

})();

