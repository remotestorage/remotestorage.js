(function() {
  function loadTable(table, storage, paths) {
    table.setAttribute('border', '1');
    table.style.margin = '8px';
    table.style.color = 'white';
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
      if (storage.connected === false) { return; }
      function processRow(status, body, contentType, revision) {
        if (status === 200) {
          var tr = document.createElement('tr');
          tbody.appendChild(tr);
          renderRow(tr, path, contentType, revision);
          if (path[path.length - 1] === '/') {
            for (var key in body) {
              loadRow(path + key);
            }
          }
        }
      }
      storage.get(path).then(processRow);
    }

    paths.forEach(loadRow);
  }

  function renderWrapper(title, table, storage, paths) {
    var wrapper = document.createElement('div');
    //wrapper.style.display = 'inline-block';
    var heading = document.createElement('h2');
    heading.textContent = title;
    wrapper.appendChild(heading);
    var updateButton = document.createElement('button');
    updateButton.textContent = "Refresh";
    updateButton.onclick = function() { loadTable(table, storage, paths); };
    wrapper.appendChild(updateButton);
    if (storage.reset) {
      var resetButton = document.createElement('button');
      resetButton.textContent = "Reset";
      resetButton.onclick = function() {
        storage.reset(function(newStorage) {
          storage = newStorage;
          loadTable(table, storage, paths);
        });
      };
      wrapper.appendChild(resetButton);
    }
    wrapper.appendChild(table);
    loadTable(table, storage, paths);
    return wrapper;
  }

  function renderLocalChanges(local) {
    var wrapper = document.createElement('div');
    //wrapper.style.display = 'inline-block';
    var heading = document.createElement('h2');
    heading.textContent = "Outgoing changes";
    wrapper.appendChild(heading);
    var updateButton = document.createElement('button');
    updateButton.textContent = "Refresh";
    wrapper.appendChild(updateButton);
    var list = document.createElement('ul');
    list.style.fontFamily = 'courier';
    wrapper.appendChild(list);

    function updateList() {
      list.innerHTML = '';
      local.forAllNodes(function(node) {
        if (node.local && node.local.body) {
          var el = document.createElement('li');
          el.textContent = JSON.stringify(node.local);
          list.appendChild(el);
        }
      });
    }

    updateButton.onclick = updateList;
    updateList();
    return wrapper;
  }

  RemoteStorage.prototype.inspect = function() {

    var widget = document.createElement('div');
    widget.id = 'remotestorage-inspect';
    widget.style.position = 'absolute';
    widget.style.top = 0;
    widget.style.left = 0;
    widget.style.background = 'black';
    widget.style.color = 'white';
    widget.style.border = 'groove 5px #ccc';

    var controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.top = 0;
    controls.style.left = 0;

    var heading = document.createElement('strong');
    heading.textContent = " remotestorage.js inspector ";

    controls.appendChild(heading);

    var syncButton;

    if (this.local) {
      syncButton = document.createElement('button');
      syncButton.textContent = "Synchronize";
      controls.appendChild(syncButton);
    }

    var closeButton = document.createElement('button');
    closeButton.textContent = "Close";
    closeButton.onclick = function() {
      document.body.removeChild(widget);
    };
    controls.appendChild(closeButton);

    widget.appendChild(controls);

    var remoteRootPaths = [];
    for (var path in this.caching._rootPaths) {
      if (this.caching._rootPaths.hasOwnProperty(path)) {
        remoteRootPaths.push(path);
      }
    }

    var remoteTable = document.createElement('table');
    var localTable = document.createElement('table');
    widget.appendChild(renderWrapper("Remote", remoteTable, this.remote, remoteRootPaths));
    if (this.local) {
      widget.appendChild(renderWrapper("Local", localTable, this.local, ['/']));
      widget.appendChild(renderLocalChanges(this.local));

      syncButton.onclick = function() {
        this.log('sync clicked');
        this.sync.sync().then(function() {
          this.log('SYNC FINISHED');
          loadTable(localTable, this.local, ['/']);
        }.bind(this), function(err) {
          console.error("SYNC FAILED", err, err.stack);
        });
      }.bind(this);
    }

    document.body.appendChild(widget);
  };
})();
