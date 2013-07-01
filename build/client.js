window.onload = function() {
  var fileLinkBase = document.body.getAttribute('data-file-link-base');
  var buildServer = document.body.getAttribute('data-build-server');
  var form = document.createElement('form');
  form.method = 'POST';
  form.action = buildServer;
  document.getElementById('wrapper').appendChild(form);

  var groupTemplate = document.querySelector('script[data-template-name="group"]').
    innerHTML;

  var xhr = new XMLHttpRequest();
  xhr.open('GET', buildServer, true);
  var i = 0;
  xhr.onload = function() {
    var components = JSON.parse(xhr.responseText);
    var defaults = [];
    for(var key in components.groups) {
      var group = components.groups[key];
      if(group.hidden) continue;

      group.name = key;

      if(group.required || group.default) defaults.push(group.name);

      i++;

      group.class = i % 2 == 1 ? 'odd' : '';

      group.files = group.files.map(function(fileName) {
        return {
          name: fileName,
          desc: components.files[fileName] || '-',
          href: fileLinkBase + fileName
        };
      });

      if(group.depends) {
        group.depends = group.depends.map(function(dependName) {
          var dependency = components.groups[dependName];
          if(! dependency.reverseDepends) {
            dependency.reverseDepends = [];
          }
          dependency.reverseDepends.push(group.name);
          return {
            name: dependName,
            label: dependency.label,
            desc: dependency.desc
          };
        });
        console.log('group', group.name, 'depends', group.depends);
      } else {
        group.noDepends = true;
      }

      form.innerHTML += Mustache.render(groupTemplate, group);
    }
    var submit = document.createElement('input');
    submit.type = 'submit';
    submit.value = 'Download';
    form.appendChild(submit);

    function setGroupState(groupName, state) {
      console.log('set state', groupName, state);
      var checkbox = document.getElementById('group-' + groupName)
      if(checkbox) {
        checkbox.checked = state;
        updateGroupState({ target: checkbox });
      }
    }

    function processDepends(groupName, value) {
      var group = components.groups[groupName];
      if(value && group.depends) {
        group.depends.forEach(function(group) {
          setGroupState(group.name, true);
        });
      } else if( !value && group.reverseDepends) {
        group.reverseDepends.forEach(function(groupName) {
          setGroupState(groupName, false);
        });
      }
    }

    function updateGroupState(event) {
      var checkbox = event.target, classList = checkbox.parentElement.classList;
      if(checkbox.checked) {
        classList.remove('disabled');
      } else {
        classList.add('disabled');
      }
      processDepends(checkbox.getAttribute('value'), checkbox.checked);
    }
    
    Array.prototype.forEach.call(
      document.getElementsByClassName('group-control'), function(checkbox) {
        checkbox.addEventListener('change', updateGroupState);
      }
    );

    setTimeout(function() {

    defaults.forEach(function(groupName) {
      setGroupState(groupName, true);
    });

    }, 0);
  };
  xhr.send();
}
