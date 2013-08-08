(function(global) {
  var RS = RemoteStorage;

  /**
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

  var haveLocalStorage;
  var SETTINGS_KEY = "remotestorage:wireclient";

  var API_2012 = 1, API_00 = 2, API_01 = 3, API_HEAD = 4;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  function request(method, uri, token, headers, body, getEtag, fakeRevision) {
    if((method == 'PUT' || method == 'DELETE') && uri[uri.length - 1] == '/') {
      throw "Don't " + method + " on directories!";
    }

    var timedOut = false;
    var timer = setTimeout(function() {
      timedOut = true;
      promise.reject('timeout');
    }, RS.WireClient.REQUEST_TIMEOUT);

    var promise = promising();
    RemoteStorage.log(method, uri);
    var xhr = new XMLHttpRequest();
    xhr.open(method, uri, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    for(var key in headers) {
      if(typeof(headers[key]) !== 'undefined') {
        xhr.setRequestHeader(key, headers[key]);
      }
    }
    xhr.onload = function() {
      if(timedOut) return;
      clearTimeout(timer);
      var mimeType = xhr.getResponseHeader('Content-Type');
      var body;
      var revision = getEtag ? xhr.getResponseHeader('ETag') : (xhr.status == 200 ? fakeRevision : undefined);
      if(mimeType.match(/charset=binary/)) {
        var blob = new Blob([xhr.response], {type: mimeType});
        var reader = new FileReader();
        reader.addEventListener("loadend", function() {
          // reader.result contains the contents of blob as a typed array
          promise.fulfill(xhr.status, reader.result, mimeType, revision);
        });
        reader.readAsArrayBuffer(blob);
      } else {
        body = mimeType && mimeType.match(/^application\/json/) ? JSON.parse(xhr.responseText) : xhr.responseText;
        promise.fulfill(xhr.status, body, mimeType, revision);
      }
    };
    xhr.onerror = function(error) {
      if(timedOut) return;
      clearTimeout(timer);
      promise.reject(error);
    };
    if(typeof(body) === 'object' && !(body instanceof ArrayBuffer)) {
      body = JSON.stringify(body);
    }
    xhr.send(body);
    return promise;
  }

  function cleanPath(path) {
    // strip duplicate slashes.
    return path.replace(/\/+/g, '/');
  }

  RS.WireClient = function(rs) {
    this.connected = false;
    RS.eventHandling(this, 'change', 'connected');
    rs.on('error', function(error){
      if(error instanceof RemoteStorage.Unauthorized) {
        this.configure(undefined, undefined, undefined, null);
      }
    }.bind(this))
    if(haveLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {};
      if(settings) {
        this.configure(settings.userAddress, settings.href, settings.storageApi, settings.token);
      }
    }

    this._revisionCache = {};

    if(this.connected) {
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
      if(typeof(userAddress) !== 'undefined') this.userAddress = userAddress;
      if(typeof(href) !== 'undefined') this.href = href;
      if(typeof(storageApi) !== 'undefined') this.storageApi = storageApi;
      if(typeof(token) !== 'undefined') this.token = token;
      if(typeof(this.storageApi) !== 'undefined') {
        this._storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
        this.supportsRevs = this._storageApi >= API_00;
      }
      if(this.href && this.token) {
        this.connected = true;
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if(haveLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({
          userAddress: this.userAddress,
          href: this.href,
          token: this.token,
          storageApi: this.storageApi
        });
      }
    },

    get: function(path, options) {
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      if(!options) options = {};
      var headers = {};
      if(this.supportsRevs) {
        // setting '' causes the browser (at least chromium) to ommit
        // the If-None-Match header it would normally send.
        headers['If-None-Match'] = options.ifNoneMatch || '';
      } else if(options.ifNoneMatch) {
        var oldRev = this._revisionCache[path];
        if(oldRev === options.ifNoneMatch) {
          return promising().fulfill(412);
        }
      }
      var promise = request('GET', this.href + cleanPath(path), this.token, headers,
                            undefined, this.supportsRevs, this._revisionCache[path]);
      if(this.supportsRevs || path.substr(-1) != '/') {
        return promise;
      } else {
        return promise.then(function(status, body, contentType, revision) {
          if(status == 200 && typeof(body) == 'object') {
            if(Object.keys(body).length === 0) {
              // no children (coerce response to 'not found')
              status = 404;
            } else {
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
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      if(!options) options = {};
      if(! contentType.match(/charset=/)) {
        contentType += '; charset=' + (body instanceof ArrayBuffer ? 'binary' : 'utf-8');
      }
      var headers = { 'Content-Type': contentType };
      if(this.supportsRevs) {
        headers['If-Match'] = options.ifMatch;
        headers['If-None-Match'] = options.ifNoneMatch;
      }
      return request('PUT', this.href + cleanPath(path), this.token,
                     headers, body, this.supportsRevs);
    },

    'delete': function(path, callback, options) {
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      if(!options) options = {};
      return request('DELETE', this.href + cleanPath(path), this.token,
                     this.supportsRevs ? { 'If-Match': options.ifMatch } : {},
                     undefined, this.supportsRevs);
    }

  };

  RS.WireClient._rs_init = function() {
    Object.defineProperty(RS.prototype, 'remote', {
      configurable: true,
      get: function() {
        var wireclient = new RS.WireClient(this);
        Object.defineProperty(this, 'remote', {
          value: wireclient
        });
        return wireclient;
      }
    });
  };

  RS.WireClient._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    return !! global.XMLHttpRequest;
  };

  RS.WireClient._rs_cleanup = function(){
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
  }


})(this);
