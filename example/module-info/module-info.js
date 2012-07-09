
(function() {

  var ul = document.createElement('ul');
  var moduleNames = Object.keys(remoteStorage.modules), moduleName, module, li;

  for(var m in moduleNames) {
    moduleName = moduleNames[m];
    module = remoteStorage.modules[moduleName];

    li = document.createElement('li');
    ul.appendChild(li);
    li.innerHTML  = '<h2>' + moduleName + '</h2>';

    if(module.dataHints) {
      li.innerHTML += '<dl>';
      var hintKeys = Object.keys(module.dataHints);
      for(var h in hintKeys) {
        li.innerHTML += '<dt>' + hintKeys[h] + '</dt>';
        li.innerHTML += '<dd>' + module.dataHints[ hintKeys[h] ] + '</dd>';
      }
      li.innerHTML += '</dl>';
    }
  }

  window.onload = function() {

    document.body.appendChild(ul);

  }

})();