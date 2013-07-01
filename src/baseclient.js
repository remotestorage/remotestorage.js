
(function() {

  RemoteStorage.BaseClient = function(storage, base) {
    if(base[base.length - 1] != '/') {
      throw "Not a directory: " + base;
    }
    this.storage = storage;
    this.base = base;

    var parts = this.base.split('/');
    if(parts.length > 2) {
      this.moduleName = parts[1];
    } else {
      this.moduleName = 'root';
    }
  };

  /**
   * Class: RemoteStorage.BaseClient
   *
   * Provides a high-level interface to access data below a given root path.
   *
   * A BaseClient deals with three types of data: folders, objects and files.
   *
   * <getListing> returns a list of all items within a folder. Items that end
   * with a forward slash ("/") are child folders.
   *
   * <getObject> / <storeObject> operate on JSON objects. Each object has a type.
   *
   * <getFile> / <storeFile> operates on files. Each file has a MIME type.
   *
   * <remove> operates on either objects or files (but not folders, folders are
   * created and removed implictly).
   */
  RemoteStorage.BaseClient.prototype = {
    
    extend: function(object) {
      for(var key in object) {
        this[key] = object[key];
      }
      return this;
    },

    scope: function(path) {
      return new RemoteStorage.BaseClient(this.storage, this.makePath(path));
    },

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
    },

    makePath: function(path) {
      return this.base + path;
    }

  };

  /**
   * Method: RemoteStorage#scope
   *
   * Returns a new <RemoteStorage.BaseClient> scoped to the given path.
   *
   * Parameters:
   *   path - Root path of new BaseClient.
   *
   *
   * Example:
   *   (start code)
   *
   *   var foo = remoteStorage.scope('/foo/');
   *
   *   // PUTs data "baz" to path /foo/bar
   *   foo.storeFile('text/plain', 'bar', 'baz');
   *
   *   var something = foo.scope('something/');
   *
   *   // GETs listing from path /foo/something/bla/
   *   something.getListing('bla/');
   *
   *   (end code)
   *
   */


  RemoteStorage.BaseClient._rs_init = function() {
    RemoteStorage.prototype.scope = function(path) {
      return new RemoteStorage.BaseClient(this, path);
    };
    return promising().fulfill();
  };

  /* e.g.:
  remoteStorage.defineModule('locations', function(priv, pub) {
    return {
      exports: {
        features: priv.scope('features/').defaultType('feature'),
        collections: priv.scope('collections/').defaultType('feature-collection');
      }
    };
  });
  */

})();
