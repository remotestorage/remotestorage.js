(function(global) {
  var API_2012 = 1, API_00 = 2, API_01 = 3, API_HEAD = 4;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  function request(method, path, token, headers, body, getEtag) {
    var promise = promising();
    console.log(method, path);
    var xhr = new XMLHttpRequest();
    xhr.open(method, path, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + encodeURIComponent(token));
    for(var key in headers) {
      if(typeof(headers[key]) !== 'undefined') {
        xhr.setRequestHeader(key, headers[key]);
      }
    }
    xhr.onload = function() {
      var mimeType = xhr.getResponseHeader('Content-Type');
      var body = mimeType && mimeType.match(/^application\/json/) ? JSON.parse(xhr.responseText) : xhr.responseText;
      var revision = getEtag ? xhr.getResponseHeader('ETag') : undefined;
      promise.fulfill(xhr.status, body, mimeType, revision);
    };
    xhr.onerror = function(error) {
      promise.reject(error);
    };
    if(typeof(body) === 'object' && !(object instanceof ArrayBuffer)) {
      body = JSON.stringify(body);
    }
    xhr.send(body);
    return promise;
  }

  RemoteStorage.WireClient = function() {
    this.connected = false;
    RemoteStorage.eventHandling(this, 'change', 'connected');
  };

  RemoteStorage.WireClient.prototype = {

    connect: function(href, storageApi, token) {
      this.href = href;
      this.storageApi = storageApi;
      this.token = token;
      this._storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
      this.supportsRevs = this._storageApi >= API_00;      
      this.connected = true;
    },

    get: function(path, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      var headers = {};
      if(this.supportsRevs) {
        // setting '' causes the browser (at least chromium) to ommit
        // the If-None-Match header it would normally send.
        headers['If-None-Match'] = options.ifNoneMatch || '';
      }
      return request('GET', this.href + path, this.token, headers,
                     undefined, this.supportsRevs);
    },

    put: function(path, body, contentType, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      var headers = { 'Content-Type': contentType };
      if(this.supportsRevs) {
        headers['If-Match'] = options.ifMatch;
        headers['If-None-Match'] = options.ifNoneMatch;
      }
      return request('PUT', this.href + path, this.token,
                     headers, body, this.supportsRevs);
    },

    delete: function(path, callback, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      return request('DELETE', this.href + path, this.token,
                     this.supportsRevs ? { 'If-Match': options.ifMatch } : {},
                     undefined, this.supportsRevs);
    }

  };

  RemoteStorage.WireClient._rs_init = function() {
    return promising().fulfill();
  };

  RemoteStorage.WireClient._rs_supported = function() {
    return !! global.XMLHttpRequest;
  };

})(this);
