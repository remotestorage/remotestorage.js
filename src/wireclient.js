(function(global) {
  var RS = RemoteStorage;

  /**
   * Class: RemoteStorage.WireClient
   *
   * WireClient Interface
   * --------------------
   *
   * This file exposes a get/put/delete interface on top of XMLHttpRequest.
   * It requires to be configured with parameters about the remotestorage server to
   * connect to.
   * Each instance of WireClient is always associated with a single remotestorage
   * server and access token.
   *
   * Usually the WireClient instance can be accessed via `remoteStorage.remote`.
   *
   * This is the get/put/delete interface:
   *
   *   - #get() takes a path and optionally a ifNoneMatch option carrying a version
   *     string to check. It returns a promise that will be fulfilled with the HTTP
   *     response status, the response body, the MIME type as returned in the
   *     'Content-Type' header and the current revision, as returned in the 'ETag'
   *     header.
   *   - #put() takes a path, the request body and a content type string. It also
   *     accepts the ifMatch and ifNoneMatch options, that map to the If-Match and
   *     If-None-Match headers respectively. See the remotestorage-01 specification
   *     for details on handling these headers. It returns a promise, fulfilled with
   *     the same values as the one for #get().
   *   - #delete() takes a path and the ifMatch option as well. It returns a promise
   *     fulfilled with the same values as the one for #get().
   *
   * In addition to this, the WireClient has some compatibility features to work with
   * remotestorage 2012.04 compatible storages. For example it will cache revisions
   * from directory listings in-memory and return them accordingly as the "revision"
   * parameter in response to #get() requests. Similarly it will return 404 when it
   * receives an empty directory listing, to mimic remotestorage-01 behavior. Note
   * that it is not always possible to know the revision beforehand, hence it may
   * be undefined at times (especially for caching-roots).
   */

  var hasLocalStorage;
  var SETTINGS_KEY = "remotestorage:wireclient";

  var API_2012 = 1, API_00 = 2, API_01 = 3, API_02 = 4, API_HEAD = 5;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'draft-dejong-remotestorage-02': API_02,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  var isArrayBufferView;

  if (typeof(ArrayBufferView) === 'function') {
    isArrayBufferView = function(object) { return object && (object instanceof ArrayBufferView); };
  } else {
    var arrayBufferViews = [
      Int8Array, Uint8Array, Int16Array, Uint16Array,
      Int32Array, Uint32Array, Float32Array, Float64Array
    ];
    isArrayBufferView = function(object) {
      for(var i=0;i<8;i++) {
        if (object instanceof arrayBufferViews[i]) {
          return true;
        }
      }
      return false;
    };
  }

  function request(method, uri, token, headers, body, getEtag, fakeRevision) {
    if ((method === 'PUT' || method === 'DELETE') && uri[uri.length - 1] === '/') {
      throw "Don't " + method + " on directories!";
    }

    var promise = promising();
    var revision;

    headers['Authorization'] = 'Bearer ' + token;

    RS.WireClient.request(method, uri, {
      body: body,
      headers: headers
    }, function(error, response) {
      if (error) {
        promise.reject(error);
      } else {
        if ([401, 403, 404, 412].indexOf(response.status) >= 0) {
          promise.fulfill(response.status);
        } else if ([201, 204, 304].indexOf(response.status) >= 0 ||
                   (response.status === 200 && method !== 'GET')) {
          revision = response.getResponseHeader('ETag');
          promise.fulfill(response.status, undefined, undefined, revision);
        } else {
          var mimeType = response.getResponseHeader('Content-Type');
          var body;
          if (getEtag) {
            revision = response.getResponseHeader('ETag');
          } else {
            revision = response.status === 200 ? fakeRevision : undefined;
          }

          if ((! mimeType) || mimeType.match(/charset=binary/)) {
            RS.WireClient.readBinaryData(response.response, mimeType, function(result) {
              promise.fulfill(response.status, result, mimeType, revision);
            });
          } else {
            if (mimeType && mimeType.match(/^application\/json/)) {
              body = JSON.parse(response.responseText);
            } else {
              body = response.responseText;
            }
            promise.fulfill(response.status, body, mimeType, revision);
          }
        }
      }
    });
    return promise;
  }

  function readBinaryData(content, mimeType, callback) {
    var blob = new Blob([content], { type: mimeType });
    var reader = new FileReader();
    reader.addEventListener("loadend", function() {
      callback(reader.result); // reader.result contains the contents of blob as a typed array
    });
    reader.readAsArrayBuffer(blob);
  }

  function cleanPath(path) {
    return path.replace(/\/+/g, '/').split('/').map(encodeURIComponent).join('/');
  }

  function isFolderDescription(body) {
    return ((Object.keys(body).length === 2)
                && (body['@context'] === 'http://remotestorage.io/spec/folder-description')
                && (typeof(body['items']) === 'object'));
  }

  var onErrorCb;

  /**
   * Class : RemoteStorage.WireClient
   **/
  RS.WireClient = function(rs) {
    this.connected = false;
    /**
     * Event: change
     *   never fired for some reason
     *
     * Event: connected
     *   fired when the wireclient connect method realizes that it is
     *   in posession of a token and a href
     **/
    RS.eventHandling(this, 'change', 'connected', 'sync-busy', 'sync-done');

    onErrorCb = function(error){
      if(error instanceof RemoteStorage.Unauthorized) {
        this.configure(undefined, undefined, undefined, null);
      }
    }.bind(this);
    rs.on('error', onErrorCb);
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        setTimeout(function() {
          this.configure(settings.userAddress, settings.href, settings.storageApi, settings.token);
        }.bind(this), 0);
      }
    }

    this._revisionCache = {};

    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.WireClient.REQUEST_TIMEOUT = 30000;

  RS.WireClient.prototype = {
    /**
     * Property: token
     *
     * Holds the bearer token of this WireClient, as obtained in the OAuth dance
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.token
     *   // -> 'DEADBEEF01=='
     */

    /**
     * Property: href
     *
     * Holds the server's base URL, as obtained in the Webfinger discovery
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.href
     *   // -> 'https://storage.example.com/users/jblogg/'
     */

    /**
     * Property: storageApi
     *
     * Holds the spec version the server claims to be compatible with
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.storageApi
     *   // -> 'draft-dejong-remotestorage-01'
     */

    configure: function(userAddress, href, storageApi, token) {
      if (typeof(userAddress) !== 'undefined') {
        this.userAddress = userAddress;
      }
      if (typeof(href) !== 'undefined') {
        this.href = href;
      }
      if (typeof(storageApi) !== 'undefined') {
        this.storageApi = storageApi;
      }
      if (typeof(token) !== 'undefined') {
        this.token = token;
      }
      if (typeof(this.storageApi) !== 'undefined') {
        this._storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
        this.supportsRevs = this._storageApi >= API_00;
      }
      if (this.href && this.token) {
        this.connected = true;
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if (hasLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({
          userAddress: this.userAddress,
          href: this.href,
          token: this.token,
          storageApi: this.storageApi
        });
      }
      RS.WireClient.configureHooks.forEach(function(hook) {
        hook.call(this);
      }.bind(this));
    },

    get: function(path, options) {
      var that = this; 
      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }
      if (!options) { options = {}; }
      var headers = {};
      if (this.supportsRevs) {
        if (options.ifNoneMatch) {
          headers['If-None-Match'] = options.ifNoneMatch;
        }
      } else if (options.ifNoneMatch) {
        var oldRev = this._revisionCache[path];
        if (oldRev === options.ifNoneMatch) {
          // since sync descends for allKeys(local, remote), this causes
          // https://github.com/remotestorage/remotestorage.js/issues/399
          // commenting this out so that it gets the actual 404 from the
          // server. this only affects legacy servers
          // (this.supportsRevs==false):

          // return promising().fulfill(412);
          // FIXME empty block and commented code
        }
      }
      if(path.substr(-1) !== '/') {
        this._emit('sync-busy');
      }
      var promise = request('GET', this.href + cleanPath(path), this.token, headers,
                            undefined, this.supportsRevs, this._revisionCache[path]).then(function(status, body, contentType, revision) {
        if(path.substr(-1) !== '/') {
          that._emit('sync-done');
        }
        return promising().fulfill(status, body, contentType, revision);
      }, function(err) {
        if(path.substr(-1) !== '/') {
          that._emit('sync-done');
        }
        throw err;
      });
      if (this.supportsRevs || path.substr(-1) !== '/') {
        return promise;
      } else {
        return promise.then(function(status, body, contentType, revision) {
          var tmp;
          if (status === 200 && typeof(body) === 'object') {
            if (Object.keys(body).length === 0) {
              // no children (coerce response to 'not found')
              status = 404;
            } else if(isFolderDescription(body)) {
              tmp = {};
              for(var item in body.items) {
                this._revisionCache[path + item] = body.items[item].ETag;
                tmp[item] = body.items[item].ETag;
              }
              body = tmp;
            } else {//pre-02 server
              for(var key in body) {
                this._revisionCache[path + key] = body[key];
              }
            }
          }
          return promising().fulfill(status, body, contentType, revision);
        }.bind(this));
      }
    },

    put: function(path, body, contentType, options) {
      var that = this; 
      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }
      if (!options) { options = {}; }
      if (!contentType.match(/charset=/)) {
        contentType += '; charset=' + ((body instanceof ArrayBuffer || isArrayBufferView(body)) ? 'binary' : 'utf-8');
      }
      var headers = { 'Content-Type': contentType };
      if (this.supportsRevs) {
        if (options.ifMatch) {
          headers['If-Match'] = options.ifMatch;
        }
        if (options.ifNoneMatch) {
          headers['If-None-Match'] = options.ifNoneMatch;
        }
      }
      this._emit('sync-busy');
      return request('PUT', this.href + cleanPath(path), this.token,
                     headers, body, this.supportsRevs).then(function(status, body, contentType, revision) {
        that._emit('sync-done');
        return promising().fulfill(status, body, contentType, revision);
      }, function(err) {
        that._emit('sync-done');
        throw err;
      });
    },

    'delete': function(path, options) {
      var that = this; 
      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }
      if (!options) { options = {}; }
      var headers = {};
      if (this.supportsRevs) {
        if (options.ifMatch) {
          headers['If-Match'] = options.ifMatch;
        }
      }
      this._emit('sync-busy');
      return request('DELETE', this.href + cleanPath(path), this.token,
                     headers,
                     undefined, this.supportsRevs).then(function(status, body, contentType, revision) {
        that._emit('sync-done');
        return promising().fulfill(status, body, contentType, revision);
      }, function(err) {
        that._emit('sync-done');
        throw err;
      });
    }
  };

  // Shared cleanPath used by Dropbox
  RS.WireClient.cleanPath = cleanPath;

  // Shared isArrayBufferView used by WireClient and Dropbox
  RS.WireClient.isArrayBufferView = isArrayBufferView;

  RS.WireClient.readBinaryData = readBinaryData;

  // Shared request function used by WireClient, GoogleDrive and Dropbox.
  RS.WireClient.request = function(method, url, options, callback) {
    RemoteStorage.log(method, url);

    callback = callback.bind(this);

    var timedOut = false;

    var timer = setTimeout(function() {
      timedOut = true;
      callback('timeout');
    }, RS.WireClient.REQUEST_TIMEOUT);

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    if (options.responseType) {
      xhr.responseType = options.responseType;
    }
    if (options.headers) {
      for(var key in options.headers) {
        xhr.setRequestHeader(key, options.headers[key]);
      }
    }

    xhr.onload = function() {
      if (timedOut) { return; }
      clearTimeout(timer);
      callback(null, xhr);
    };

    xhr.onerror = function(error) {
      if (timedOut) { return; }
      clearTimeout(timer);
      callback(error);
    };

    var body = options.body;

    if (typeof(body) === 'object') {
      if (isArrayBufferView(body)) {
        /* alright. */
        //FIXME empty block
      }
      else if (body instanceof ArrayBuffer) {
        body = new Uint8Array(body);
      } else {
        body = JSON.stringify(body);
      }
    }
    xhr.send(body);
  };

  Object.defineProperty(RemoteStorage.WireClient.prototype, 'storageType', {
    get: function() {
      if (this.storageApi) {
        var spec = this.storageApi.match(/draft-dejong-(remotestorage-\d\d)/);
        return spec ? spec[1] : '2012.04';
      }
    }
  });

  RS.WireClient.configureHooks = [];

  RS.WireClient._rs_init = function(remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    remoteStorage.remote = new RS.WireClient(remoteStorage);
  };

  RS.WireClient._rs_supported = function() {
    return !! global.XMLHttpRequest;
  };

  RS.WireClient._rs_cleanup = function(remoteStorage){
    if (hasLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    remoteStorage.removeEventListener('error', onErrorCb);
  };

})(typeof(window) !== 'undefined' ? window : global);
