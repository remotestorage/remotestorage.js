(function(global) {
  var RS = RemoteStorage;
  /**
   * Dropbox backend for RemoteStorage.js
   */
  var haveLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize'
  

  var SETTINGS_KEY = 'remotestorage:dropbox';
  RS.Dropbox = function(rs) {
    this.connected = false;
    RS.eventHandling(this, 'change', 'connected');
    rs.on('error', function(error){
      if(error instanceof RemoteStorage.Unauthorized) {
        //TODO deconfiguer the dropbox here and now
      }
    })
    this.clientId = rs.apiKeys.dropbox.api_key
    if(haveLocalStorage){
      var settings;
      try{
        settings = JSON.parse(localStorage[SETTINGS_KEY]);
      } catch(e){
        console.error(e);
      }
      if(settings) {
        this.configure(settings.userAdress, undefined, undefined, settings.token)
      }
    }
    if(this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
   
  }
  RS.Dropbox.prototype = {
    connect: function() {
      localStorage[RemoteStorage.BACKEND_KEY] = 'dropbox';
      RS.Authorize(AUTH_URL, '', String(document.location), this.clientId);
    },
    configure: function(useradress, href, storageApi, token) { 
      console.log('dropbox configure',arguments);
      if(typeof(token) !== 'undefined') this.token = token;
      if(typeof(useradress) !== 'undefined') this.useradress = token;
      
      if(this.token){
        this.connected = true;
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if(haveLocalStorage){
        localStorage[SETTINGS_KEY] = JSON.stringify( { token: this.token, 
                                                      useradress: this.useradress } );
      }
    },
    get: function(path, options){
      console.log('dropbox.get', arguments);
      var url = 'https://api-content.dropbox.com/1/files/auto' + path
      var promise = promising();
      this._request('GET', url, {}, function(err, resp){
        if(err){
          promise.reject(err)
        }else{
          console.log(resp);
          var status = resp.status;
          var meta, body, mime, rev;
          if(status == 200){
            body = resp.responseText;
            try {
              meta = JSON.parse( resp.getResponseHeader('x-dropbox-metadata') )
            } catch(e) {
              promise.reject(e)
              return;
            }
            mime = meta.mime_type;
            rev = meta.rev;
          }
          promise.fulfill(status, body, mime, rev);
        }
      })
      return promise;
    },
    put: function(path, body, contentType, options){
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      var promise = promising();
      dropbox.writeFile(path, body, 
        function(error, stat) {
          if(error){
            promise.reject(error)
          }else{
            promise.fulfill(stat);
          }

            })
    },
    'delete': function(path, options){
      console.log('dropbox.delete ', arguemnts);
    },
    _request: function(method, url, options, callback) {
      callback = callback.bind(this);
      if(! this.token) {
        callback("Not authorized!");
      }
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      if(options.responseType) {
        xhr.responseType = options.responseType;
      }
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.token);
      if(options.headers) {
        for(var key in options.headers) {
          xhr.setRequestHeader(key, options.headers[key]);
        }
      }
      xhr.onload = function() {
        // google tokens expire from time to time...
        if(xhr.status == 401) {
          this.connect();
          return;
        }
        callback(null, xhr);
      }.bind(this);
      xhr.onerror = function(error) {
        callback(error);
      }.bind(this);
      xhr.send(options.body);
    }
  };

  RS.Dropbox._rs_init = function(rs) {
    console.log("Dropbox init",rs)
    var config = rs.apiKeys.dropbox
    if(config) {
      console.log('dropbox init ',config)
      rs.dropbox = new RS.Dropbox(rs);
    }
    if(localStorage[RemoteStorage.BACKEND_KEY] == 'dropbox'){
      rs._origRemote = rs.remote;
      rs.remote = rs.dropbox;
    }
  }
  
  RS.Dropbox._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    console.log("Dropbox _rs_supported ??")
    return true;
  }
  RS.Dropbox._rs_cleanup = function() {
    console.log('rs_cleanup :P')
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
      delete localStorage[RemoteStorage.BACKEND_KEY];
    }
  }
})(this)
