
(function() {

  RemoteStorage.BaseClient = function(storage, root) {
    this.storage = storage;
    this.root = root;
  };

  RemoteStorage.BaseClient.prototype = {

    // folder operations

    getListing: function(path) {
      if(path[path.length - 1] != '/') {
        throw "Not a directory: " + path;
      }
      return this.storage.get(path).then(function(status, body) {
        return typeof(body) === 'object' ? Object.keys(body) : undefined;
      });
    },

    getAll: function(path) {
      if(path[path.length - 1] != '/') {
        throw "Not a directory: " + path;
      }
      return this.storage.get(this.makePath(path)).then(function(status, body) {
        if(typeof(body) === 'object') {
          var promise = promising();
          var count = Object.keys(body).length, i = 0;
          for(var key in body) {
            return this.get(this.makePath(path + key)).then(function(status, body) {
              body[this.key] = body;
              i++;
              if(i == count) promise.fulfill(body);
            }.bind({ key: key }));
          }
          return promise;
        }
      }.bind(this));
    },

    // file operations

    getFile: function(path) {
      return this.storage.get(this.makePath(path)).then(function(status, body, mimeType, revision) {
        return {
          data: body,
          mimeType: mimeType,
          revision: revision // (this is new)
        };
      });
    },

    storeFile: function(mimeType, path, body) {
      return this.storage.put(this.makePath(path), body, mimeType).then(function(status, _body, _mimeType, revision) {
        if(status == 200 || status == 201) {
          return revision;
        } else {
          throw "Request (PUT " + this.makePath(path) + ") failed with status: " + status;
        }
      });
    },

    // object operations

    getObject: function(path) {
      return this.storage.get(this.makePath(path)).then(function(status, body, mimeType, revision) {
        if(typeof(body) == 'object') {
          return body;
        } else if(typeof(body) !== 'undefined' && status == 200) {
          throw "Not an object: " + this.makePath(path);
        }
      });
    },

    storeObject: function(type, path, object) {
      return this.storage.put(this.makePath(path), object, mimeType).then(function(status, _body, _mimeType, revision) {
        if(status == 200 || status == 201) {
          return revision;
        } else {
          throw "Request (PUT " + this.makePath(path) + ") failed with status: " + status; 
        }
      });
    },

    // generic operations

    remove: function(path) {
      return this.storage.remove(this.makePath(path));
    }

  };

})();
