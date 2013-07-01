(function() {
  function loadTable(table, storage) {
    table.setAttribute('border', '1');
    table.style.margin = '8px';
    table.innerHTML = '';
    var thead = document.createElement('thead');
    table.appendChild(thead);
    var titleRow = document.createElement('tr');
    thead.appendChild(titleRow);
    ['Path', 'Content-Type', 'Revision'].forEach(function(label) {
      var th = document.createElement('th');
      th.textContent = label;
      thead.appendChild(th);
    });

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    function renderRow(tr, path, contentType, revision) {
      [path, contentType, revision].forEach(function(value) {
        var td = document.createElement('td');
        td.textContent = value || '';
        tr.appendChild(td);
      });      
    }

    function loadRow(path) {
      function processRow(status, body, contentType, revision) {
        if(status == 200) {
          var tr = document.createElement('tr');
          tbody.appendChild(tr);
          renderRow(tr, path, contentType, revision);
          if(path[path.length - 1] == '/') {
            for(var key in body) {
              loadRow(path + key);
            }
          }
        }
      }
      if(storage.getCached) {
        storage.getCached(path).then(processRow);
      } else {
        storage.get(path).then(processRow);
      }
    }

    table.on

    loadRow('/');
  }


  function renderWrapper(title, table, storage) {
    var wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    var heading = document.createElement('h2');
    heading.textContent = title;
    wrapper.appendChild(heading);
    var updateButton = document.createElement('button');
    updateButton.textContent = "Update";
    updateButton.onclick = function() { loadTable(table, storage); };
    wrapper.appendChild(updateButton);
    if(storage.reset) {
      var resetButton = document.createElement('button');
      resetButton.textContent = "Reset";
      resetButton.onclick = function() {
        storage.reset(function(newStorage) {
          storage = newStorage;
          loadTable(table, storage);
        });
      };
      wrapper.appendChild(resetButton);
    }
    wrapper.appendChild(table);
    loadTable(table, storage);
    return wrapper;
  }

  RemoteStorage.prototype.inspect = function() {

    var widget = document.createElement('div');
    widget.id = 'remotestorage-inspect';

    if(this.local) {
      var syncButton = document.createElement('button');
      syncButton.textContent = "Synchronize";
      widget.appendChild(syncButton);
    }

    var remoteTable = document.createElement('table');
    var localTable = document.createElement('table');
    widget.appendChild(renderWrapper("Remote", remoteTable, this.remote));
    if(this.local) {
      widget.appendChild(renderWrapper("Local", localTable, this.local));

      syncButton.onclick = function() {
        this.sync().then(function() {
          loadTable(localTable, this.local)
        }.bind(this));
      }.bind(this);
    }

    document.body.appendChild(widget);
  };

})();
