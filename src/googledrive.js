(function(global) {

  var RS = RemoteStorage;

  var BASE_URL = 'https://www.googleapis.com';
  var AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
  var AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';

  var GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
  var RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

  function buildQueryString(params) {
    return Object.keys(params).map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
  }

  function fileNameFromMeta(meta) {
    return encodeURIComponent(meta.title) + (meta.mimeType === GD_DIR_MIME_TYPE ? '/' : '');
  }

  function metaTitleFromFileName(filename) {
    if(filename.substr(-1) === '/') {
      filename = filename.substr(0, filename.length - 1);
    }
    return decodeURIComponent(filename);
  }

  function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
  }

  function baseName(path) {
    var parts = path.split('/');
    if(path.substr(-1) === '/') {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

  var Cache = function(maxAge) {
    this.maxAge = maxAge;
    this._items = {};
  };

  Cache.prototype = {
    get: function(key) {
      var item = this._items[key];
      var now = new Date().getTime();
      return (item && item.t >= (now - this.maxAge)) ? item.v : undefined;
    },

    set: function(key, value) {
      this._items[key] = {
        v: value,
        t: new Date().getTime()
      };
    }
  };

  RS.GoogleDrive = function(remoteStorage, clientId) {

    RS.eventHandling(this, 'connected');

    this.rs = remoteStorage;
    this.clientId = clientId;

    this._fileIdCache = new Cache(60 * 5); // ids expire after 5 minutes (is this a good idea?)

    setTimeout(function() {
      this.configure(undefined, undefined, undefined, localStorage['remotestorage:googledrive:token']);
    }.bind(this), 0);
  };

  RS.GoogleDrive.prototype = {

    configure: function(_x, _y, _z, token) { // parameter list compatible with WireClient
      if(token) {
        localStorage['remotestorage:googledrive:token'] = token;
        this.token = token;
        this.connected = true;
        this._emit('connected');
      } else {
        this.connected = false;
        delete this.token;
        // not reseting backend whenever googledrive gets initialized without an token
//       this.rs.setBackend(undefined);
        delete localStorage['remotestorage:googledrive:token'];
      }
    },

    connect: function() {
      this.rs.setBackend('googledrive');
      RS.Authorize(AUTH_URL, AUTH_SCOPE, String(RS.Authorize.getLocation()), this.clientId);
    },

    get: function(path, options) {
      if(path.substr(-1) === '/') {
        return this._getDir(path, options);
      } else {
        return this._getFile(path, options);
      }
    },

    put: function(path, body, contentType, options) {
      var promise = promising();
      function putDone(error, response) {
        if(error) {
          promise.reject(error);
        } else if(response.status >= 200 && response.status < 300) {
          var meta = JSON.parse(response.responseText);
          promise.fulfill(200, undefined, meta.mimeType, meta.etag);
        } else {
          promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
        }
      }
      this._getFileId(path, function(idError, id) {
        if(idError) {
          promise.reject(idError);
          return;
        } else if(id) {
          this._updateFile(id, path, body, contentType, options, putDone);
        } else {
          this._createFile(path, body, contentType, options, putDone);
        }
      });
      return promise;
    },

    'delete': function(path, options) {
      var promise = promising();
      this._getFileId(path, function(idError, id) {
        if(idError) {
          promise.reject(idError);
        } else if(id) {
          this._request('DELETE', BASE_URL + '/drive/v2/files/' + id, {}, function(deleteError, response) {
            if(deleteError) {
              promise.reject(deleteError);
            } else if(response.status === 200 || response.status === 204) {
              promise.fulfill(200);
            } else {
              promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
            }
          });
        } else {
          // file doesn't exist. ignore.
          promise.fulfill(200);
        }
      });
      return promise;
    },

    _updateFile: function(id, path, body, contentType, options, callback) {
      callback = callback.bind(this);
      var metadata = {
        mimeType: contentType
      };
      this._request('PUT', BASE_URL + '/upload/drive/v2/files/' + id + '?uploadType=resumable', {
        body: JSON.stringify(metadata),
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        }
      }, function(metadataError, response) {
        if(metadataError) {
          callback(metadataError);
        } else {
          this._request('PUT', response.getResponseHeader('Location'), {
            body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
          }, callback);
        }
      });
    },

    _createFile: function(path, body, contentType, options, callback) {
      callback = callback.bind(this);
      this._getParentId(path, function(parentIdError, parentId) {
        if(parentIdError) {
          callback(parentIdError);
          return;
        }
        var fileName = baseName(path);
        var metadata = {
          title: metaTitleFromFileName(fileName),
          mimeType: contentType,
          parents: [{
            kind: "drive#fileLink",
            id: parentId
          }]
        };
        this._request('POST', BASE_URL + '/upload/drive/v2/files?uploadType=resumable', {
          body: JSON.stringify(metadata),
          headers: {
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }, function(metadataError, response) {
          if(metadataError) {
            callback(metadataError);
          } else {
            this._request('POST', response.getResponseHeader('Location'), {
              body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
            }, callback);
          }
        });
      });
    },

    _getFile: function(path, options) {
      var promise = promising();
      this._getFileId(path, function(idError, id) {
        if(idError) {
          promise.reject(idError);
        } else {
          this._getMeta(id, function(metaError, meta) {
            if(metaError) {
              promise.reject(metaError);
            } else if(meta.downloadUrl) {
              var options = {};
              if(meta.mimeType.match(/charset=binary/)) {
                options.responseType = 'blob';
              }
              this._request('GET', meta.downloadUrl, options, function(downloadError, response) {
                if(downloadError) {
                  promise.reject(downloadError);
                } else {
                  var body = response.response;
                  if(meta.mimeType.match(/^application\/json/)) {
                    try {
                      body = JSON.parse(body);
                    } catch(e) {}
                  }
                  promise.fulfill(200, body, meta.mimeType, meta.etag);
                }
              });
            } else {
              // empty file
              promise.fulfill(200, '', meta.mimeType, meta.etag);
            }
          });
        }
      });
      return promise;
    },

    _getDir: function(path, options) {
      var promise = promising();
      this._getFileId(path, function(idError, id) {
        if(idError) {
          promise.reject(idError);
        } else if(! id) {
          promise.fulfill(404);
        } else {
          this._request('GET', BASE_URL + '/drive/v2/files/' + id + '/children', {}, function(childrenError, response) {
            if(childrenError) {
              promise.reject(childrenError);
            } else {
              if(response.status === 200) {
                var data = JSON.parse(response.responseText);
                var n = data.items.length, i = 0;
                if(n === 0) {
                  // FIXME: add revision of directory!
                  promise.fulfill(200, {}, RS_DIR_MIME_TYPE, undefined);
                  return;
                }
                var result = {};
                var idCache = {};
                var gotMeta = function(err, meta) {
                  if(err) {
                    // FIXME: actually propagate the error.
                    console.error("getting meta stuff failed: ", err);
                  } else {
                    var fileName = fileNameFromMeta(meta);
                    // NOTE: the ETags are double quoted. This is not a bug, but just the
                    // way etags from google drive look like.
                    // Example listing:
                    //  {
                    //    "CMakeCache.txt": "\"HK9znrxLd1pIgz63yXyznaLN5rM/MTM3NzA1OTk5NjE1NA\"",
                    //    "CMakeFiles": "\"HK9znrxLd1pIgz63yXyznaLN5rM/MTM3NzA1OTk5NjUxNQ\"",
                    //    "Makefile": "\"HK9znrxLd1pIgz63yXyznaLN5rM/MTM3NzA2MDIwNDA0OQ\"",
                    //    "bgrive": "\"HK9znrxLd1pIgz63yXyznaLN5rM/MTM3NzA1OTkzODE4Nw\"",
                    //    "cmake_install.cmake": "\"HK9znrxLd1pIgz63yXyznaLN5rM/MTM3NzA1OTkzNzU2NA\"",
                    //    "grive": "\"HK9znrxLd1pIgz63yXyznaLN5rM/MTM3NzA1OTk2Njg2Ng\"",
                    //    "libgrive": "\"HK9znrxLd1pIgz63yXyznaLN5rM/MTM3NzA2MDAxNDk1NQ\""
                    //  }
                    result[fileName] = meta.etag;

                    // propagate id cache
                    this._fileIdCache.set(path + fileName, meta.id);
                  }
                  i++;
                  if(i === n) {
                    promise.fulfill(200, result, RS_DIR_MIME_TYPE, undefined);
                  }
                }.bind(this);
                data.items.forEach(function(item) {
                  this._getMeta(item.id, gotMeta);
                }.bind(this));
              } else {
                promise.reject('request failed or something: ' + response.status);
              }
            }
          });
        }
      });
      return promise;
    },

    _getParentId: function(path, callback) {
      callback = callback.bind(this);
      var dirname = parentPath(path);
      this._getFileId(dirname, function(idError, parentId) {
        if(idError) {
          callback(idError);
        } else if(parentId) {
          callback(null, parentId);
        } else {
          this._createDir(dirname, callback);
        }
      });
    },

    _createDir: function(path, callback) {
      callback = callback.bind(this);
      this._getParentId(path, function(idError, parentId) {
        if(idError) {
          callback(idError);
        } else {
          this._request('POST', BASE_URL + '/drive/v2/files', {
            body: JSON.stringify({
              title: metaTitleFromFileName(baseName(path)),
              mimeType: GD_DIR_MIME_TYPE,
              parents: [{
                id: parentId
              }]
            }),
            headers: {
              'Content-Type': 'application/json; charset=UTF-8'
            }
          }, function(createError, response) {
            if(createError) {
              callback(createError);
            } else {
              var meta = JSON.parse(response.responseText);
              callback(null, meta.id);
            }
          });
        }
      });
    },

    _getFileId: function(path, callback) {
      callback = callback.bind(this);
      var id;
      if(path === '/') {
        // "root" is a special alias for the fileId of the root directory
        callback(null, 'root');
      } else if((id = this._fileIdCache.get(path))) {
        // id is cached.
        callback(null, id);
      } else {
        // id is not cached (or file doesn't exist).
        // load parent directory listing to propagate / update id cache.
        this._getDir(parentPath(path)).then(function() {
          var id = this._fileIdCache.get(path);
          if (!id) {
            callback('no file or directory found at the path: ' + path, null);
            return;
          }
          callback(null, id);
        }.bind(this), callback);
      }
    },

    _getMeta: function(id, callback) {
      callback = callback.bind(this);
      this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}, function(err, response) {
        if(err) {
          callback(err);
        } else {
          if(response.status === 200) {
            callback(null, JSON.parse(response.responseText));
          } else {
            callback("request (getting metadata for " + id + ") failed with status: " + response.status);
          }
        }
      });
    },

    _request: function(method, url, options, callback) {
      callback = callback.bind(this);
      if (! options.headers) { options.headers = {}; }
      options.headers['Authorization'] = 'Bearer ' + this.token;
      RS.WireClient.request.call(this, method, url, options, function(err, xhr) {
        // google tokens expire from time to time...
        if(xhr.status === 401) {
          this.connect();
          return;
        }
        callback(err, xhr);
      });
    }
  };

  RS.GoogleDrive._rs_init = function(remoteStorage) {
    var config = remoteStorage.apiKeys.googledrive;
    if(config) {
      remoteStorage.googledrive = new RS.GoogleDrive(remoteStorage, config.client_id);
      if(remoteStorage.backend === 'googledrive') {
        remoteStorage._origRemote = remoteStorage.remote;
        remoteStorage.remote = remoteStorage.googledrive;
      }
    }
  };

  RS.GoogleDrive._rs_supported = function(rs){
    return true;
  };

  RS.GoogleDrive._rs_cleanup = function(remoteStorage) {
    remoteStorage.setBackend(undefined);
    if(remoteStorage._origRemote) {
      remoteStorage.remote = remoteStorage._origRemote;
      delete remoteStorage._origRemote;
    }
  };

})(this);
