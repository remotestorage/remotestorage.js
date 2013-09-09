(function(global) {
  var RS = RemoteStorage;
  /**
   * Dropbox backend for RemoteStorage.js
   */
  var haveLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize';

  function LowerCaseCache(){
    console.log('!!!!!!!!!!! RESETED NEW LCC STORAGE !!!!!!!!!!!!!')
    this._storage = {  }
  }
  LowerCaseCache.prototype = {
    get : function(key) {
      return this._storage[key.toLowerCase()]
    },
    set : function(key, value) {
      key = key.toLowerCase()
      console.log(this._storage[key]+'!!!!!!!!!!!'+value+'!!!!!!!!!!!'+key);
      if(this._storage[key] == value) return value;
      this._propagate(key);
      return this._storage[key] = value;
    },
    delete : function(key) {
      key = key.toLowerCase();
      this._propagate(key);
      delete this._storage[key];
    },
    _propagate: function(key){
      console.log('porpagating')
      var dirs = key.split('/').slice(0,-1);
      var len = dirs.length;
      var path = '';
   
      for(var i = 0; i < len; i++){
        path+=dirs[i]+'/'
        this._storage[path]+='1';
      }
    }
  }


  var SETTINGS_KEY = 'remotestorage:dropbox';
  RS.Dropbox = function(rs) {
    this.rs = rs;
    this.connected = false;
    this.rs = rs;
    RS.eventHandling(this, 'change', 'connected');
    rs.on('error', function(error){
      if(error instanceof RemoteStorage.Unauthorized) {
        this.connected = false;
        if(haveLocalStorage){
          delete localStorage[SETTINGS_KEY]
        }
        //TODO deconfiguer the dropbox here and now
      }
    });
    this.clientId = rs.apiKeys.dropbox.api_key;
    this._revCache = new LowerCaseCache();
    if(haveLocalStorage){
      var settings;
      try{
        settings = JSON.parse(localStorage[SETTINGS_KEY]);
      } catch(e){
      }
      if(settings) {
        this.configure(settings.userAddress, undefined, undefined, settings.token);
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

    configure: function(userAddress, href, storageApi, token) {
      console.log('dropbox configure',arguments);
      if(typeof(token) !== 'undefined') this.token = token;
      if(typeof(useradress) !== 'undefined') this.userAddress = userAddress;

      if(this.token){
        this.connected = true;
        if(!this.useradress){
          this.info().then(function(info){
            this.userAddress = info.display_name;
          }.bind(this))
        }
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if(haveLocalStorage){
        localStorage[SETTINGS_KEY] = JSON.stringify( { token: this.token,
                                                       userAddress: this.userAddress } );
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
          if(body.contents) {
            listing = body.contents.reduce(function(m, item) {
              var itemName = item.path.split('/').slice(-1)[0] + ( item.is_dir ? '/' : '' );
              m[itemName] = item.rev;
              return m;
            }, {});
          }
          promise.fulfill(status, listing, mime, rev);
        }
      });
      return promise;
    },
    get: function(path, options){
      console.log('dropbox.get', arguments);
      
      if(options && options.ifNoneMatch && (this._revCache.get(path) == options.ifNoneMatch)) {
        // nothing changed.
        promise.fulfill(304);
        return promise;
      }
      
      //use _getDir for directories 
      if(path.substr(-1) == '/') return this._getDir(path, options);

      var url = 'https://api-content.dropbox.com/1/files/auto' + path
      var promise = promising();


      this._request('GET', url, {}, function(err, resp){
        if(err) {
          promise.reject(err);
        } else {
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
            // TODO Depending on how we handle mimetypes we will have to change that
            // mimetypes  disabled right now
            if(mime.search('application/json') >= 0 || true) {
              try {
                body = JSON.parse(body);
              } catch(e) {
                this.rs.log(e);
              }
            }
            this._revCache.set(path, rev);
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
      var savedRev = this._revCache.get(path)
      if(options.ifMatch &&  savedRev && (savedRev != options.ifMatch) ) {
        promise.fulfill(412);
        return promise;
      }

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
      var promise = promising();

      //check if file has changed and return 412
       var savedRev = this._revCache.get(path)
      if(options.ifMatch && savedRev && (options.ifMatch != savedRev)) {
        promise.fulfill(412);
        return promise;
      }

      var url = 'https://api.dropbox.com/1/fileops/delete?root=auto&path='+encodeURIComponent(path);
      this._request('POST', url, {}, function(err, resp){
        if(err) {
          promise.reject(error)
        } else {
          console.log(resp);
          promise.fulfill(resp.status);
          this._revCache.delete(path);
        }
      })
      
      return promise;
    },
    info: function() {
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
        // // dropbox tokens might  expire from time to time...
        // if(xhr.status == 401) {
        //   this.connect();
        //   return;
        // }
        callback(err, xhr);
      }.bind(this));
    },

    fetchDelta: function() {
      var args = Array.prototype.slice.call(arguments);
      var promise = promising();
      this._request('POST', 'https://api.dropbox.com/1/delta', {
        body: this._deltaCursor ? ('cursor=' + encodeURIComponent(this._deltaCursor)) : '',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }, function(error, response) {
        if(error) {
          promise.reject(error);
        } else {
          var delta = JSON.parse(response.responseText);
          if(delta.reset) {
            // FIXME maybe this might destroy recorded changes
            this._revCache = new LowerCaseCache();
          }
          //saving the cursor for requesting further deltas in relation to the cursor position
          if(delta.curser)
            this._deltaCursor = delta.cursor;
          //updating revCache
          delta.entries.forEach(function(entry) {
            var path = entry[0];
            if(entriy[1].is_dir)
              path+='/';
            this._revCache.set(path, entry[1].rev);
          }.bind(this));
          promise.fulfill.apply(promise, args);
        }
      });
      return promise;
    }
  };

  function hookSync(rs) {
    if(rs._dropboxOrigSync) return; // already hooked
    rs._dropboxOrigSync = rs.sync.bind(rs);
    rs.sync = function() {
      return this.dropbox.fetchDelta.apply(this.dropbox, arguments).
        then(rs._dropboxOrigSync);
    };
  }

  function unHookSync(rs) {
    if(! rs._dropboxOrigSync) return; // not hooked
    rs.sync = rs._dropboxOrigSync;
    delete rs._dropboxOrigSync;
  }

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
      if(rs.sync) {
        hookSync(rs);
      }
    }
  };

  RS.Dropbox._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    console.log("Dropbox _rs_supported ??");
    return true;
  };

  RS.Dropbox._rs_cleanup = function(rs) {
    console.log('rs_cleanup :P');
    unHookSync(rs);
    if(rs._origRemote)
      rs.remote = rs._origRemote;
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
      rs.setBackend(undefined);
    }
  };
})(this);
