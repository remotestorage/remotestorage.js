(function() {

  remoteStorage.claimAccess('bookmarks', 'rw');

  window.onload = function() {
    remoteStorage.displayWidget('remotestorage-widget');

    var rowCache = {};

    var list = document.getElementById('bookmark-list');

    function addBookmarkRow(path, bookmark) {
      var item = document.createElement('li');
      item.innerText = bookmark.url;
      list.appendChild(item);
    }

    var addForm = document.getElementById('add-form');

    addForm.onsubmit = function(event) {
      event.preventDefault();

      remoteStorage.bookmarks.addUrl(document.getElementById('url-input').value);

      return false;
    };

    var bookmarks = remoteStorage.bookmarks.listBookmarks();
    bookmarks.forEach(function(bookmark) {
      addBookmarkRow(null, bookmark);
    });

    remoteStorage.bookmarks.on('change', function(event) {

      console.log('EVENT', event);
      if(event.newValue && event.oldValue) {
        updateBookmarkRow(event.path, event.newValue);
      } else if(event.newValue) {
        addBookmarkRow(event.path, event.newValue);
      } else {
        deleteBookmarkRow(event.path);
      }
    });
  };

})();
