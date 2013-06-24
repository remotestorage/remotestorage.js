window.onload = function() {
  var buildServer = document.body.getAttribute('data-build-server');
  var form = document.createElement('form');
  form.method = 'POST';
  form.action = buildServer;
  document.body.appendChild(form);
  var xhr = new XMLHttpRequest();
  xhr.open('GET', buildServer, true);
  xhr.onload = function() {
    var modules = JSON.parse(xhr.responseText);
    for(var key in modules.groups) {
      var group = modules.groups[key];
      var groupWrapper = document.createElement('div');
      groupWrapper.className = 'group';
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'groups';
      checkbox.value = key;
      checkbox.id = 'group-' + key;
      if(group.required) {
        checkbox.checked = 'checked';
        checkbox.disabled = 'disabled';
      } else if(group.initial) {
        checkbox.checked = 'checked';
      }
      groupWrapper.appendChild(checkbox);
      var label = document.createElement('label');
      label.textContent = group.label;
      label.setAttribute('for', 'group-' + key);
      groupWrapper.appendChild(label);
      var innerWrapper = document.createElement('div');
      innerWrapper.className = 'group-inner';
      var desc = document.createElement('p');
      desc.textContent = group.desc;
      innerWrapper.appendChild(desc);
      var filesHeading = document.createElement('strong');
      filesHeading.textContent = "Files:";
      innerWrapper.appendChild(filesHeading);
      var fileList = document.createElement('ul');
      group.files.forEach(function(f) {
        var li = document.createElement('li');
        var span = document.createElement('span');
        span.className = 'filename';
        span.textContent = f + ': ';
        li.appendChild(span);
        li.appendChild(document.createTextNode(modules.files[f]));
        fileList.appendChild(li);
      });
      innerWrapper.appendChild(fileList);
      groupWrapper.appendChild(innerWrapper);
      form.appendChild(groupWrapper);
    }
    var submit = document.createElement('input');
    submit.type = 'submit';
    submit.value = 'Build';
    form.appendChild(submit);
  };
  xhr.send();
}
