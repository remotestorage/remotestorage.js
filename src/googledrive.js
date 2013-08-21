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
    return encodeURIComponent(meta.title) + (meta.mimeType == GD_DIR_MIME_TYPE ? '/' : '');
  }

  RS.GoogleDrive = function(remoteStorage, clientId, apiKey) {

    RS.eventHandling(this, 'connected');

    this.rs = remoteStorage;
    this.clientId = clientId, this.apiKey = apiKey;

    this._fileIdCache = {};

    setTimeout(function() {
      this.configure(undefined, undefined, undefined, localStorage['remotestorage:googledrive:token']);
    }.bind(this), 0);
  };

  RS.GoogleDrive.prototype = {

    configure: function(_x, _y, _z, token) { // parameter list compatible with WireClient
      console.log('configure wiht token', token);
      localStorage['remotestorage:googledrive:token'] = token;
      if(token) {
        this.token = token;
        this.connected = true;
        this._emit('connected');
      } else {
        this.connected = false;
        delete this.token;
        delete localStorage.googledrive;
      }
    },

    connect: function() {
      localStorage.googledrive = true;
      RS.Authorize(AUTH_URL, AUTH_SCOPE, String(document.location), this.clientId);
    },

    get: function(path, options) {
      if(path.substr(-1) == '/') {
        return this._getDir(path, options);
      } else {
        return this._getFile(path, options);
      }
    },

    _getFile: function(path, options) {
      return promising(function(p) {
        console.log('fake file', path);
        p.fulfill(200, '', 'text/plain');
      });
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
              if(response.status == 200) {
                var data = JSON.parse(response.responseText);
                var n = data.items.length, i = 0;
                if(n == 0) {
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
                    this._fileIdCache[path + fileName] = meta.id;
                  }
                  i++;
                  if(i == n) {
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

    _getFileId: function(path, callback) {
      if(path == '/') {
        // "root" is a special alias for the fileId of the root directory
        callback.call(this, null, 'root');
      } else if(path in this._fileIdCache) {
        // id is cached.
        callback.call(this, null, this._fileIdCache[path]);
      } else {
        // id is not cached (or file doesn't exist).
        // load parent directory listing to propagate / update id cache.
        this._getDir(path.replace(/[^\/]+\/?$/, '')).then(function() {
          callback.call(this, null, this._fileIdCache[path]);
        }.bind(this), callback.bind(this));
      }
    },

    _getMeta: function(id, callback) {
      this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}, function(err, response) {
        if(err) {
          callback(err);
        } else {
          if(response.status == 200) {
            callback(null, JSON.parse(response.responseText));
          } else {
            callback("request (getting metadata for " + id + ") failed with status: " + response.status);
          }
        }
      });
    },

    _request: function(method, url, options, callback) {
      if(! this.token) {
        callback.call(this, "Not authorized!");
      }
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.token);
      if(options.headers) {
        for(var key in options.headers) {
          xhr.setRequestHeader(key, options.headers[key]);
        }
      }
      xhr.onload = function() {
        callback.call(this, null, xhr);
      }.bind(this);
      xhr.onerror = function(error) {
        callback.call(this, error);
      }.bind(this);
      xhr.send(options.body);
    }
  };

  RS.GoogleDrive._rs_init = function(remoteStorage) {
    var config = remoteStorage.apiKeys.googledrive;
    if(config) {
      remoteStorage.googledrive = new RS.GoogleDrive(remoteStorage, config.client_id, config.api_key);
      if(localStorage.googledrive) {
        remoteStorage.remote = remoteStorage.googledrive;
      }
    }
  };

})(this);
