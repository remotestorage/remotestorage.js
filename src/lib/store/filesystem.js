define(['../util', './transactions', 'fs', 'xattr'], function(util, Transactions, fs, xattr) {

  var FilesystemStore = function(rootPath) {
    this.root = rootPath;

    this.transactions = new Transactions();
  };

  util.declareError(FilesystemStore, 'InvalidPath', function(path) {
    this.path = path;
    return "Invalid path: " + path;
  });

  FilesystemStore.prototype = {
    get: function(path) {
      return util.getPromise(util.bind(function(promise) {
        var systemPath = this._buildPath(path);
        fs.readFile(systemPath, function(data) {
          var attrs = xattr.list(systemPath);
          if('mimeType' in attrs) {}
          promise.fulfill({
            data: data
          });
        });
      }, this));
    },

    _buildPath: function(path) {
      if(path.match(/(?:^|\/)\.\.?(?:\/|$)/)) {
        throw new FilesystemStore.InvalidPath(path);
      }
    }
  };

  return FilesystemStore;

});
