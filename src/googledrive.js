
  /**
   * Class: GoogleDrive
   *
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   *
   * To use this backend, you need to specify the app's client ID like so:
   *
   * (start code)
   *
   * remoteStorage.setApiKeys('googledrive', {
   *   clientId: 'your-client-id'
   * });
   *
   * (end code)
   *
   * An client ID can be obtained by registering your app in the Google
   * Developers Console: https://developers.google.com/drive/web/auth/web-client
   *
   * Docs: https://developers.google.com/drive/web/auth/web-client#create_a_client_id_and_client_secret
   **/

  var Authorize = require('./authorize');
  var WireClient = require('./wireclient');
  var eventHandling = require('./eventhandling');
  var util = require('./util');

  var BASE_URL = 'https://www.googleapis.com';
  var AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
  var AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';
  var SETTINGS_KEY = 'remotestorage:googledrive';

  var GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
  var RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

  var isFolder = util.isFolder;
  var hasLocalStorage;

  // function buildQueryString(params) {
  //   return Object.keys(params).map(function (key) {
  //     return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  //   }).join('&');
  // }

  // function fileNameFromMeta(meta) {
  //   return encodeURIComponent(meta.title) + (meta.mimeType === GD_DIR_MIME_TYPE ? '/' : '');
  // }

  function metaTitleFromFileName(filename) {
    if (filename.substr(-1) === '/') {
      filename = filename.substr(0, filename.length - 1);
    }
    return decodeURIComponent(filename);
  }

  function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
  }

  function baseName(path) {
    var parts = path.split('/');
    if (path.substr(-1) === '/') {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

  var Cache = function (maxAge) {
    this.maxAge = maxAge;
    this._items = {};
  };

  Cache.prototype = {
    get: function (key) {
      var item = this._items[key];
      var now = new Date().getTime();
      return (item && item.t >= (now - this.maxAge)) ? item.v : undefined;
    },

    set: function (key, value) {
      this._items[key] = {
        v: value,
        t: new Date().getTime()
      };
    }
  };

  var GoogleDrive = function (remoteStorage, clientId) {

    eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');

    this.rs = remoteStorage;
    this.clientId = clientId;

    this._fileIdCache = new Cache(60 * 5); // ids expire after 5 minutes (is this a good idea?)

    hasLocalStorage = util.localStorageAvailable();

    if (hasLocalStorage){
      var settings;
      try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      } catch(e){}
      if (settings) {
        this.configure(settings);
      }
    }

  };

  GoogleDrive.prototype = {
    connected: false,
    online: true,

    configure: function (settings) { // Settings parameter compatible with WireClient
      // We only update this.userAddress if settings.userAddress is set to a string or to null
      if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
      // Same for this.token. If only one of these two is set, we leave the other one at its existing value
      if (typeof settings.token !== 'undefined') { this.token = settings.token; }

      var writeSettingsToCache = function() {
        if (hasLocalStorage) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            userAddress: this.userAddress,
            token: this.token
          }));
        }
      };

      var handleError = function() {
        this.connected = false;
        delete this.token;
        if (hasLocalStorage) {
          localStorage.removeItem(SETTINGS_KEY);
        }
      };

      if (this.token) {
        this.connected = true;

        if (this.userAddress) {
          this._emit('connected');
          writeSettingsToCache.apply(this);
        } else {
          this.info().then(function(info) {
            this.userAddress = info.user.emailAddress;
            this._emit('connected');
            writeSettingsToCache.apply(this);
          }.bind(this)).catch(function() {
            handleError.apply(this);
            this.rs._emit('error', new Error('Could not fetch user info.'));
          }.bind(this));
        }
      } else {
        handleError.apply(this);
      }
    },

    connect: function () {
      this.rs.setBackend('googledrive');
      Authorize(this.rs, AUTH_URL, AUTH_SCOPE, String(Authorize.getLocation()), this.clientId);
    },

    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    get: function (path, options) {
      if (path.substr(-1) === '/') {
        return this._getFolder(path, options);
      } else {
        return this._getFile(path, options);
      }
    },

    put: function (path, body, contentType, options) {
      var self = this;
      function putDone(response) {
        if (response.status >= 200 && response.status < 300) {
          var meta = JSON.parse(response.responseText);
          var etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          return Promise.resolve({statusCode: 200, contentType: meta.mimeType, revision: etagWithoutQuotes});
        } else if (response.status === 412) {
          return Promise.resolve({statusCode: 412, revision: 'conflict'});
        } else {
          return Promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
        }
      }
      return self._getFileId(path).then(function (id) {
        if (id) {
          if (options && (options.ifNoneMatch === '*')) {
            return putDone({ status: 412 });
          }
          return self._updateFile(id, path, body, contentType, options).then(putDone);
        } else {
          return self._createFile(path, body, contentType, options).then(putDone);
        }
      });
    },

    'delete': function (path, options) {
      var self = this;
      return self._getFileId(path).then(function (id) {
        if (!id) {
          // File doesn't exist. Ignore.
          return Promise.resolve({statusCode: 200});
        }

        return self._getMeta(id).then(function (meta) {
          var etagWithoutQuotes;
          if ((typeof meta === 'object') && (typeof meta.etag === 'string')) {
            etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          }
          if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
            return {statusCode: 412, revision: etagWithoutQuotes};
          }

          return self._request('DELETE', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
            if (response.status === 200 || response.status === 204) {
              return {statusCode: 200};
            } else {
              return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
            }
          });
        });
      });
    },

    /**
     * Method: info
     *
     * Fetches the user's info from Google and returns a promise for it.
     *
     * Returns:
     *
     *   A promise to the user's info
     */
    info: function () {
      var url = BASE_URL + '/drive/v2/about?fields=user';
      // requesting user info(mainly for userAdress)
      return this._request('GET', url, {}).then(function (resp){
        try {
          var info = JSON.parse(resp.responseText);
          return Promise.resolve(info);
        } catch (e) {
          return Promise.reject(e);
        }
      });
    },

    _updateFile: function (id, path, body, contentType, options) {
      var self = this;
      var metadata = {
        mimeType: contentType
      };
      var headers = {
        'Content-Type': 'application/json; charset=UTF-8'
      };

      if (options && options.ifMatch) {
        headers['If-Match'] = '"' + options.ifMatch + '"';
      }

      return self._request('PUT', BASE_URL + '/upload/drive/v2/files/' + id + '?uploadType=resumable', {
        body: JSON.stringify(metadata),
        headers: headers
      }).then(function (response) {
        if (response.status === 412) {
          return (response);
        } else {
          return self._request('PUT', response.getResponseHeader('Location'), {
            body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
          });
        }
      });
    },

    _createFile: function (path, body, contentType, options) {
      var self = this;
      return self._getParentId(path).then(function (parentId) {
        var fileName = baseName(path);
        var metadata = {
          title: metaTitleFromFileName(fileName),
          mimeType: contentType,
          parents: [{
            kind: "drive#fileLink",
            id: parentId
          }]
        };
        return self._request('POST', BASE_URL + '/upload/drive/v2/files?uploadType=resumable', {
          body: JSON.stringify(metadata),
          headers: {
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }).then(function (response) {
          return self._request('POST', response.getResponseHeader('Location'), {
            body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
          });
        });
      });
    },

    _getFile: function (path, options) {
      var self = this;
      return self._getFileId(path).then(function (id) {
        return self._getMeta(id).then(function (meta) {
          var etagWithoutQuotes;
          if (typeof(meta) === 'object' && typeof(meta.etag) === 'string') {
            etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          }

          if (options && options.ifNoneMatch && (etagWithoutQuotes === options.ifNoneMatch)) {
            return Promise.resolve({statusCode: 304});
          }

          var options2 = {};
          if (!meta.downloadUrl) {
            if (meta.exportLinks && meta.exportLinks['text/html']) {
              // Documents that were generated inside GoogleDocs have no
              // downloadUrl, but you can export them to text/html instead:
              meta.mimeType += ';export=text/html';
              meta.downloadUrl = meta.exportLinks['text/html'];
            } else {
              // empty file
              return Promise.resolve({statusCode: 200, body: '', contentType: meta.mimeType, revision: etagWithoutQuotes});
            }
          }

          if (meta.mimeType.match(/charset=binary/)) {
            options2.responseType = 'blob';
          }
          return self._request('GET', meta.downloadUrl, options2).then(function (response) {
            var body = response.response;
            if (meta.mimeType.match(/^application\/json/)) {
              try {
                body = JSON.parse(body);
              } catch(e) {}
            }
            return Promise.resolve({statusCode: 200, body: body, contentType: meta.mimeType, revision: etagWithoutQuotes});
          });
        });
      });
    },

    _getFolder: function (path, options) {
      var self = this;
      return self._getFileId(path).then(function (id) {
        var query, fields, data, etagWithoutQuotes, itemsMap;
        if (! id) {
          return Promise.resolve({statusCode: 404});
        }

        query = '\'' + id + '\' in parents';
        fields = 'items(downloadUrl,etag,fileSize,id,mimeType,title)';
        return self._request('GET', BASE_URL + '/drive/v2/files?'
            + 'q=' + encodeURIComponent(query)
            + '&fields=' + encodeURIComponent(fields)
            + '&maxResults=1000',
            {})
        .then(function (response) {
          if (response.status !== 200) {
            return Promise.reject('request failed or something: ' + response.status);
          }

          try {
            data = JSON.parse(response.responseText);
          } catch(e) {
            return Promise.reject('non-JSON response from GoogleDrive');
          }

          itemsMap = {};
          for (var i = 0, len = data.items.length; i < len; i++) {
            etagWithoutQuotes = data.items[i].etag.substring(1, data.items[i].etag.length-1);
            if (data.items[i].mimeType === GD_DIR_MIME_TYPE) {
              self._fileIdCache.set(path + data.items[i].title + '/', data.items[i].id);
              itemsMap[data.items[i].title + '/'] = {
                ETag: etagWithoutQuotes
              };
            } else {
              self._fileIdCache.set(path + data.items[i].title, data.items[i].id);
              itemsMap[data.items[i].title] = {
                ETag: etagWithoutQuotes,
                'Content-Type': data.items[i].mimeType,
                'Content-Length': data.items[i].fileSize
              };
            }
          }
          // FIXME: add revision of folder!
          return Promise.resolve({statusCode: 200, body: itemsMap, contentType: RS_DIR_MIME_TYPE, revision: undefined});
        });
      });
    },

    _getParentId: function (path) {
      var foldername = parentPath(path);
      var self = this;
      return self._getFileId(foldername).then(function (parentId) {
        if (parentId) {
          return Promise.resolve(parentId);
        } else {
          return self._createFolder(foldername);
        }
      });
    },

    _createFolder: function (path) {
      var self = this;
      return self._getParentId(path).then(function (parentId) {
        return self._request('POST', BASE_URL + '/drive/v2/files', {
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
        }).then(function (response) {
          var meta = JSON.parse(response.responseText);
          return Promise.resolve(meta.id);
        });
      });
    },

    _getFileId: function (path) {
      var self = this;
      var id;
      if (path === '/') {
        // "root" is a special alias for the fileId of the root folder
        return Promise.resolve('root');
      } else if ((id = this._fileIdCache.get(path))) {
        // id is cached.
        return Promise.resolve(id);
      }
      // id is not cached (or file doesn't exist).
      // load parent folder listing to propagate / update id cache.
      return self._getFolder(parentPath(path)).then(function () {
        id = self._fileIdCache.get(path);
        if (!id) {
          if (path.substr(-1) === '/') {
            return self._createFolder(path).then(function () {
              return self._getFileId(path);
            });
          } else {
            return Promise.resolve();
          }
        }
        return Promise.resolve(id);
      });
    },

    _getMeta: function (id) {
      return this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
        if (response.status === 200) {
          return Promise.resolve(JSON.parse(response.responseText));
        } else {
          return Promise.reject("request (getting metadata for " + id + ") failed with status: " + response.status);
        }
      });
    },

    _request: function (method, url, options) {
      var self = this;

      if (! options.headers) { options.headers = {}; }
      options.headers['Authorization'] = 'Bearer ' + self.token;

      this._emit('wire-busy', {
        method: method,
        isFolder: isFolder(url)
      });

      return WireClient.request.call(this, method, url, options).then(function(xhr) {
        // Google tokens expire from time to time...
        if (xhr && xhr.status === 401) {
          self.connect();
          return;
        } else {
          if (!self.online) {
            self.online = true;
            self.rs._emit('network-online');
          }
          self._emit('wire-done', {
            method: method,
            isFolder: isFolder(url),
            success: true
          });

          return Promise.resolve(xhr);
        }
      }, function(error) {
        if (self.online) {
          self.online = false;
          self.rs._emit('network-offline');
        }
        self._emit('wire-done', {
          method: method,
          isFolder: isFolder(url),
          success: false
        });

        return Promise.reject(error);
      });
    }
  };

  GoogleDrive._rs_init = function (remoteStorage) {
    var config = remoteStorage.apiKeys.googledrive;
    if (config) {
      remoteStorage.googledrive = new GoogleDrive(remoteStorage, config.clientId);
      if (remoteStorage.backend === 'googledrive') {
        remoteStorage._origRemote = remoteStorage.remote;
        remoteStorage.remote = remoteStorage.googledrive;
      }
    }
  };

  GoogleDrive._rs_supported = function (rs) {
    return true;
  };

  GoogleDrive._rs_cleanup = function (remoteStorage) {
    remoteStorage.setBackend(undefined);
    if (remoteStorage._origRemote) {
      remoteStorage.remote = remoteStorage._origRemote;
      delete remoteStorage._origRemote;
    }
  };


  module.exports = GoogleDrive;
