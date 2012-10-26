
define([
  'require',
  'remotestorage/remoteStorage',
  'remotestorage/modules/root',
  './common'
], function(require, remoteStorage, root, common) {

  var util = remoteStorage.util;

  function jumpTo() {
    if(! common) {
      common = require('./common');
    }
    common.jumpTo.apply(common, arguments);
  }

  function pathParts(path) {
    var parts = path.split('/');
    return util.isDir(path) ? parts.slice(1, -1) : parts.slice(1);
  }

  function setTitle(title) {
    $('title').text(title);
  }

  function openPath(path, extra) {
    var baseName = util.baseName(path);
    if(util.isDir(path)) {
      setTitle("Browse: " + baseName);
      openDirectory(path, extra);
    } else {
      setTitle("File: " + baseName);
      openFile(path, extra);
    }
  }

  function makeBreadcrumbs(path) {
    var ul = $('<ul class="breadcrumb">');
    var divider = '<span class="divider">/</span>';
    var parts = pathParts(path);
    if(parts[0] == 'public') {
      parts.shift();
      ul.append('<a href="#!/public/" class="nav-header">public</a>&nbsp;');
    } else {
      ul.append('<a href="#!/" class="nav-header">private</a>&nbsp;');
    }
    ul.append(divider);
    parts.slice(0, -1).forEach(function(part, i) {
      var li = $('<li>'), p = '/' + parts.slice(0, i + 1).join('/') + '/';
      li.append($('<a>').attr('href', '#!' + p).text(part))
      li.append(divider);
      ul.append(li);
    });
    ul.append($('<li class="active">').text(parts.slice(-1)[0]));
    if(util.isDir(path) && parts.length > 0) {
      ul.append(divider);
    }
    return ul;
  }

  function sortKeys(keys) {
    return keys.sort(function(a, b) {
      var aDir = util.isDir(a);
      var bDir = util.isDir(b);
      if(aDir && !bDir) {
        return -1;
      } else if(bDir && !aDir) {
        return 1;
      } else {
        return a > b ? 1 : (b > a ? -1 : 0);
      }
    });
  }

  function loadTable(path) {

    $('#content').html('');

    var btnGroup = $('<div class="btn-group"></div>');
    if(path != '/') {
      btnGroup.append(makeButton("back", "Back", "icon-arrow-left"));
    }
    btnGroup.append(makeButton("new", "New File", "icon-plus"));

    $('#content').append(makeBreadcrumbs(path));

    $('#content').append(btnGroup);

    var loading = $('<em>Loading...</em>');
    $('#content').append(loading);

    remoteStorage.root.syncOnce(path, function() {

      loading.remove();

      var table = $('<table class="table table-striped dir-listing">');
      table.attr('data-path', path);
      var titleRow = $('<tr>');
      titleRow.append('<th></th>');
      titleRow.append('<th>Name</th>');
      titleRow.append('<th>MIME type</th>');
      titleRow.append('<th>JSON-LD type</th>');
      titleRow.append('<th>Last updated</th>');
      table.append(titleRow);
      $('#content').append(table);

      var tbody = $('<tbody>');
      table.append(tbody);

      var items = root.getObject(path);

      if(! items) {
        if(path != '/') {
          common.jumpTo(util.containingDir(path));
        } else {
          alert("BUG: root node doesn't exist.");
        }
        return;
      }
      var keys = sortKeys(Object.keys(items));
      for(var i in keys) {
        var key = keys[i];

        if(path == '/' && key == 'public/') { continue; }

        var row = $('<tr>');
        var node = remoteStorage.root.getDocument(path + key);
        var jsonType = '';
        if((! util.isDir(key)) && node.mimeType == 'application/json' && node.data['@type']) {
          jsonType = node.data['@type'];
        }
        row.attr('data-path', path + key);
        row.append($('<td>').append($('<span>').addClass(util.isDir(path + key) ? 'icon-folder-open' : 'icon-file')));
        row.append($('<td class="name">').text(key));
        row.append($('<td>').text(node.mimeType));
        row.append($('<td title="' + jsonType + '">').text(jsonType.split('/').slice(-2).join('/')));
        row.append($('<td>').text(new Date(items[key])));
        
        if(root.hasDiff(path + key)) {
          row.addClass('has-diff');
        }
        
        tbody.append(row);
      }
    });
  }

  function openDirectory(path) {
    loadTable(path);
  }

  function makeButton(action, label, icon) {
    var btn = $('<button>');
    btn.attr('data-action', action);
    btn.addClass('btn');
    btn.html('&nbsp;'+label);
    btn.prepend($('<span>').addClass(icon));
    return btn;
  }

  function inputRow(label, name, value, type) {
    var row = $('<div>').addClass('input');
    row.append($('<label>').text(label + ':'));
    row.append($('<input>').attr('name', name).attr('type', type).val(value));
    return row;
  }

  function dummyRow(key) {
    var row = $('<div>').addClass('input');
    row.append($('<label>').text(key + ':'));
    row.append($('<input>').attr('type', 'text').attr('disabled', 'disabled').val("not editable"));
    return row;
  }

  function displayForm(path, data, mimeType, mode) {
    var text = (typeof(data) == 'string') ? data : JSON.stringify(data);
    var form = $('<form>').attr('data-path', path);
    var filename = util.isDir(path) ? '' : util.baseName(path);
    
    form.append(inputRow('Filename', 'filename', filename, 'text'));
    form.append(inputRow('MIME type', 'mimeType', mimeType, 'text'));

    if(! mode) {
      mode = 'generic';
    }

    var tabs = $('<ul>').addClass('nav').addClass('nav-tabs');
    tabs.append(makeTab("Generic", path, 'generic', mode));
    if(mimeType == 'application/json') {
      tabs.append(makeTab("JSON", path, 'json', mode));
    }

    form.append(tabs);

    if(mode == 'generic') {
      form.append($('<label>Data</label>'));
      form.append($('<textarea name="data">').attr('value', text));
    } else if(mode == 'json') {
      if(typeof(data) == 'object') {
        form.append($('<strong>').text("THIS DATA WONT BE SAVED, FEATURE NOT FULLY IMPLEMENTED! USE THE GENERIC EDITOR INSTEAD"));
        for(var key in data) {
          if(typeof(data[key]) == 'object') {
            form.append(dummyRow(key));
          } else {
            form.append(inputRow(key, key, data[key], 'text'));
          }
        }
      } else {
        form.append("INVALID JSON!!!!");
      }
    }

    $('#content').append(form);
    adjustButtons();
  }

  function makeTab(label, path, name, activeMode) {
    return $('<li>')
      .addClass(activeMode == name ? 'active' : '')
      .append(
        $("<a>")
          .text(label)
          .attr('href', '#!' + path + '!' + name)
      );
  }

  function openFile(path, mode) {
    $('#content').html('');

    $('#content').append(makeBreadcrumbs(path));

    var item = util.isDir(path) ? {} : root.getDocument(path);

    var btnGroup = $('<div class="btn-group"></div>');
    btnGroup.append(makeButton("back", "Back", "icon-arrow-left"));
    btnGroup.append(makeButton("save", "Save", "icon-ok"));
    if(item.data) {
      btnGroup.append(makeButton("reset", "Reset", "icon-remove"));
      btnGroup.append(makeButton("destroy", "Destroy", "icon-trash"));
    }

    $('#content').append(btnGroup);
    $('#content').append($('<div id="notice-container">'));

    displayForm(path, item.data, item.mimeType, mode);
  }

  $('#content table tbody td').live('click', function(event) {
    var path = $(event.target).closest('tr').attr('data-path');
    jumpTo(path);
  });

  function adjustButtons() {
    $('#content button[data-action="save"]').attr(
      'disabled',
      $('#content input[name="filename"]').val().length == 0
    );
  }

  // MOVE UP THE TREE
  $('#content button[data-action="back"]').live('click', function() {
    var container = $('#content form');
    if(container.length == 0) {
      container = $('#content table');
    }
    path = container.attr('data-path');

    jumpTo(util.containingDir(path) || '/');
  });

  function showNotice(message, actions) {
    var notice = $('<div>').addClass('notice');
    notice.append(message);
    var actionsDiv = $('<div>');
    for(var key in actions) {
      var link = $('<a href="#">');
      var handler = actions[key];
      link.text(key);
      link.bind('click', function(event) {
        event.preventDefault();
        handler();
        return false;
      });
      actionsDiv.append(link);
    }
    notice.append(actionsDiv);
    $('#content #notice-container').append(notice);
  }

  function closeNotice() {
    $('#notice-container').html('');
  }

  // WATCH FILENAME CHANGES
  $('#content input[name="filename"]').live('blur', function() {
    adjustButtons();
  });

  // NEW FILE
  $('#content button[data-action="new"]').live('click', function() {
    openFile($('#content table').attr('data-path'));
  });

  // RESET FORM
  $('#content button[data-action="reset"]').live('click', function() {
    var form = $('#content form')[0];
    
    var currentMime = $(form.mimeType).val();
    var currentData = $(form.data).val();
    $(form.mimeType).val(form.mimeType.getAttribute('value'));
    $(form.data).val(form.data.getAttribute('value'));
    showNotice("Form reset to inital values.", {
      undo: function() {
        $(form.mimeType).val(currentMime);
        $(form.data).val(currentData);
        closeNotice();
      },
      close: closeNotice
    });
  });

  // SAVE FILE
  $('#content button[data-action="save"]').live('click', function() {
    var form = $('#content form');
    var path = form.attr('data-path');
    var baseName = util.baseName(path);

    var fileName = $(form[0].filename).val();
    var mimeType = $(form[0].mimeType).val();
    var data = $(form[0].data).val();

    if(fileName != baseName) {
      var newPath = (util.isDir(path) ? path : util.containingDir(path)) + fileName;
      root.setDocument(mimeType, newPath, data);
      root.removeObject(path);
      path = newPath;
    } else {
      root.setDocument(mimeType, path, data);
    }


    jumpTo(util.containingDir(path));
  });

  // DESTROY FILE
  $('#content button[data-action="destroy"]').live('click', function() {
    var path = $('#content form').attr('data-path');

    root.removeObject(path);
    jumpTo(util.containingDir(path));
  });

  return {
    openPath: openPath
  }

});

