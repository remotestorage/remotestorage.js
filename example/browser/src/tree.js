define([
  'require',
  'remotestorage/remoteStorage',
  'remotestorage/modules/root',
  './common'
], function(require, remoteStorage, root, common) {

  var parentPath = remoteStorage.util.containingDir;
  var isDir = remoteStorage.util.isDir;

  function jumpTo() {
    if(! common) {
      common = require('./common');
    }
    common.jumpTo.apply(common, arguments);
  }

  remoteStorage.root.on('conflict', function(conflict) {
    if(conflict.path == '/.open-trees') {
      conflict.resolve('local');
    }
  });

  function pathParts(path) {
    if(! path) {
      console.trace();
    }
    var parts = path.split('/');
    return isDir(path) ? parts.slice(1, -1) : parts.slice(1);
  }

  function findDirLi(path) {
    return $('li.dir[data-path="' + path + '"]');
  }

  function buildDirNode(parentPath, item) {
    var fullPath = parentPath + item;
    var li = $('<li>');
    li.addClass('dir');
    li.attr('data-path', fullPath);
    if(hasChildDirs(fullPath)) {
      li.append($('<span class="expand icon-chevron-right"></span>'));
    } else {
      li.append($('<span class="icon-none"></span>'));
    }
    li.append($('<span class="name"></span>').text(item));
    if(root.hasDiff(fullPath)) {
      li.addClass('has-diff');
    }
    if($('#directory-tree').attr('data-current') == fullPath) {
      li.addClass('current');
    }
    return li;
  }

  function loadTree(path) {
    var parentLi = findDirLi(path);
    clearLoading(path, parentLi);
    var parentElement = parentLi.find('> ul');

    if(! parentElement) {
      console.error("Failed to find parent for: " + path);
      return;
    }

    var items = root.getListing(path).sort();
    items.forEach(function(item) {
      if(path == '/' && item == 'public/') return;
      if(isDir(item)) {
        parentElement.append(buildDirNode(path, item));
      }
    });
  }

  function getOpened(callback) {
    root.getObject('.open-trees', function(opened) {
      callback(opened || {});
    });
  }

  function storeOpened(path, value) {
    getOpened(function(openTrees) {
      if(value) {
        if(openTrees[path]) {
          return;
        }
        openTrees[path] = true;
      } else {
        var re = new RegExp('^' + path);
        for(var key in openTrees) {
          if(re.test(key)) {
            delete openTrees[key];
          }
        }
      }
      root.setObject('setting-open-trees', '.open-trees', openTrees);
    });
  }


  function hasChildDirs(path) {
    var items = root.getListing(path)
    for(var i=0;i<items.length;i++) {
      if(isDir(items[i])) {
        return true;
      }
    }
    return false;
  }

  function openTree(li) {
    var path = li.attr('data-path');
    storeOpened(path, true);
    expandDir(path);
    loadTree(path);
  }

  function closeTree(li) {
    var path = li.attr('data-path')
    storeOpened(path, false);
    collapseDir(path);
  }


  function expandDir(path) {
    var li = findDirLi(path);
    var expander = li.find('> span.expand');
    expander.removeClass('icon-chevron-right');
    expander.addClass('icon-chevron-down');
    li.addClass('expanded');
    li.append($('<ul class="nav">'));
  }

  function collapseDir(path) {
    var li = findDirLi(path);
    var expander = li.find('> span.expand');
    expander.removeClass('icon-chevron-down');
    expander.addClass('icon-chevron-right');
    li.removeClass('expanded');
    li.find('> ul').remove();
  }

  function isDirExpanded(path) {
    var li = findDirLi(path);
    return (li && li.hasClass('expanded'));
  }

  function openDirUpto(path) {
    var parts = pathParts(path);
    var p = '/';
    while(parts.length > 0) {
      p += parts.shift() + '/';
      if(! isDirExpanded(p)) {
        openTree(findDirLi(p));
      }
    }
  }

  function restoreOpened() {
    getOpened(function(openTrees) {
      for(var path in openTrees) {
        if(path[0] == '/') {
          openDirUpto(path);
        }
      }
    });
  }

  function clearLoading(path, li) {
    if(! li) {
      li = findDirLi(path);
    }
    li.find('> ul em.loading').remove();
  }

  function setLoading(path) {
    var li = findDirLi(path);

    li.find('> ul').append('<em class="loading">Loading...</em>');
  }

  function selectDirectory(path) {
    $('#directory-tree li.current').removeClass('current');
    var parent = parentPath(path) || '/';
    if(! isDirExpanded(parent)) {
      openDirUpto(parent);
    }
    var li = findDirLi(path);
    li.addClass('current');
    $('#directory-tree').attr('data-current', path);
  }

  $('#directory-tree li .name').live('click', function(event) {
    var path = $(event.target).closest('li.dir').attr('data-path');
    jumpTo(path);
  });

  $('#directory-tree li .expand').live('click', function(event) {
    var li = $(event.target).closest('li.dir');
    if($(event.target).hasClass('icon-chevron-right')) {
      openTree(li);
    } else {
      closeTree(li);
    }
  });
  
  return {
    setLoading: setLoading,
    open: openTree,
    load: loadTree,
    select: selectDirectory,
    restoreOpened: restoreOpened
  }

});