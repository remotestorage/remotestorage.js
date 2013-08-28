(function(global) {
  var RS = RemoteStorage;
  /**
   * Dropbox backend for RemoteStorage.js
   */
  var haveLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize';


  var SETTINGS_KEY = 'remotestorage:dropbox';
  RS.Dropbox = function(rs) {
    this.rs = rs;
    this.connected = false;
    this.rs = rs;
    RS.eventHandling(this, 'change', 'connected');
    rs.on('error', function(error){
      if(error instanceof RemoteStorage.Unauthorized) {
        //TODO deconfiguer the dropbox here and now
      }
    });
    this.clientId = rs.apiKeys.dropbox.api_key;
    if(haveLocalStorage){
      var settings;
      try{
        settings = JSON.parse(localStorage[SETTINGS_KEY]);
      } catch(e){
        console.error(e);
      }
      if(settings) {
        this.configure(settings.userAdress, undefined, undefined, settings.token);
      }
    }
    if(this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.Dropbox.prototype = {

    connect: function() {
      this.rs.setBackend('dropbox');
      RS.Authorize(AUTH_URL, '', String(document.location), this.clientId);
    },

    configure: function(useradress, href, storageApi, token) {
      console.log('dropbox configure',arguments);
      if(typeof(token) !== 'undefined') this.token = token;
      if(typeof(useradress) !== 'undefined') this.useradress = token;

      if(this.token){
        this.connected = true;
        this._emit('connected');
        if(!this.useradress){
          this.info().then(function(info){
            this.configure(info.display_name);
          })
        }
      } else {
        this.connected = false;
      }
      if(haveLocalStorage){
        localStorage[SETTINGS_KEY] = JSON.stringify( { token: this.token,
                                                       useradress: this.useradress } );
      }
    },
    _getDir: function(path, options){
      var url = 'https://api.dropbox.com/1/metadata/auto'+path;
      var promise = promising();
      this._request('GET', url, {}, function(err, resp){
        if(err){
          promise.reject(err);
        }else{
          console.log(resp);
          var status = resp.status;
          if(status==304){
            promise.fulfill(status);
            return;
          }  
          var listing, body, mime, rev;
          try{
            body = JSON.parse(resp.responseText)
          } catch(e) {
            promise.reject(e);
            return;
          }
          rev = body.rev;
          mime = 'application/json; charset=UTF-8'
          if(body.contents)
            listing = body.contents.reduce(function(m, item) {
              m[item.path.split('/').slice(-1)[0] + 
                         ( item.is_dir ? '/' : '' ) ] = item.rev;
              return m;
            }, {});
          
          promise.fulfill(status, listing, mime, rev);
        }
      });
      return promise;
    },
    get: function(path, options){
      console.log('dropbox.get', arguments);
      if(path.substr(-1) == '/')
        return this._getDir(path, options);
      var url = 'https://api-content.dropbox.com/1/files/auto' + path
      var promise = promising();
      this._request('GET', url, {}, function(err, resp){
        if(err){
          promise.reject(err);
        }else{
          console.log(resp);
          var status = resp.status;
          var meta, body, mime, rev;
          if(status == 200){
            body = resp.responseText;
            try {
              meta = JSON.parse( resp.getResponseHeader('x-dropbox-metadata') );
            } catch(e) {
              promise.reject(e);
              return;
            }
            mime = meta.mime_type;
            rev = meta.rev;
            if(mime.search('application/json') >= 0)
              try {
                body = JSON.parse(body);
              } catch(e) {
                this.rs.log(e);
              }
          }
          promise.fulfill(status, body, mime, rev);
        }
      });
      return promise;
    },

    put: function(path, body, contentType, options){
      
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      var promise = promising();
      //check if file has changed and return 412
      var url = 'https://api-content.dropbox.com/1/files_put/auto/' + path + '?'
      this._request('PUT', url, {body:body, headers:{'Content-Type':contentType}}, function(err, resp) {
          if(err) {
            promise.reject(err)
          } else {
            console.log(resp);
            promise.fulfill(resp.status);
          }

      })
      return promise;
    },

    'delete': function(path, options){
      console.log('dropbox.delete ', arguemnts);
      //check if file has changed and return 412
      var url = 'https://api.dropbox.com/1/fileops/delete?root=auto&path='+encodeURIComponent(path);
      this._request('POST', url, {}, function(err, resp){
         if(err){
            promise.reject(error)
          }else{
            console.log(resp);
            promise.fulfill(resp.status);
          }
      })
    },
    info: function(){
      var url = 'https://api.dropbox.com/1/account/info'
      var promise = promising();
      this._request('GET', url, {}, function(err, resp){
        if(err) {
          promise.reject(err);
        } else {
          try {
            var info = JSON.parse(resp.responseText)
            promise.fulfill(info);
          } catch(e) {
            promise.reject(err);
          }
        }
      })
      return promise;
    },
    _request: function(method, url, options, callback) {
      callback = callback.bind(this);
      if(! options.headers) options.headers = {};
      options.headers['Authorization'] = 'Bearer ' + this.token;
      RS.WireClient.request.call(this, method, url, options, function(err, xhr) {
        // google tokens expire from time to time...
        if(xhr.status == 401) {
          this.connect();
          return;
        }
        callback(err, xhr);
      });
    }
  };

  RS.Dropbox._rs_init = function(rs) {
    console.log("Dropbox init",rs);
    var config = rs.apiKeys.dropbox;
    if(config) {
      console.log('dropbox init ',config);
      rs.dropbox = new RS.Dropbox(rs);
    }
    if(rs.backend == 'dropbox'){
      rs._origRemote = rs.remote;
      rs.remote = rs.dropbox;
    }
  };

  RS.Dropbox._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    console.log("Dropbox _rs_supported ??");
    return true;
  };

  RS.Dropbox._rs_cleanup = function(rs) {
    console.log('rs_cleanup :P');
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
      rs.setBackend(undefined);
    }
  };
})(this);
