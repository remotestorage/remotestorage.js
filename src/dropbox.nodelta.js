(function(global) {
  var RS = RemoteStorage;
  /**
   * Dropbox backend for RemoteStorage.js
   * known limits :
   *   files larger than 150mb are not suported for upload
   *   directories with more than 10.000 files will cause problems to list
   *   content-type is guessed by dropbox.com therefore they aren't fully supported
   *   dropbox preserves cases but not case sensitive
   *   arayBuffers aren't supported currently
   *
   * the nodelta version can be used with low syncCycle intervall but will request each directory listing on each sync
   * the delta version behaves like rs but might get blocked after a while
   */
  var haveLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize';
  var SETTINGS_KEY = 'remotestorage:dropbox';

  /*************************
   * LowerCaseCache
   * this Cache will lowercase its keys and propagate the values to "upper directories"
   * get : get a value
   * set : set a value and propagate
   * delete : delete and propagate
   *************************/
  function LowerCaseCache(defaultValue){
    this.defaultValue = defaultValue; //defaults to undefimned if initialized without arguments
    this._storage = { };
    this.set = this.justSet;
    this.delete = this.justDelete;
  }
  LowerCaseCache.prototype = {
    get : function(key) {
      key = key.toLowerCase();
      var stored = this._storage[key]
      if(!stored){
        stored = this.defaultValue;
        this._storage[key] = stored;
      }
      return stored;
    },
    propagateSet : function(key, value) {
      key = key.toLowerCase();
      if(this._storage[key] == value)
        return value;
      this._propagate(key, value);
      return this._storage[key] = value;
    },
    propagateDelete : function(key) {
      var key = key.toLowerCase();
      this._propagate(key, this._storage[key]);
      return delete this._storage[key];
    },
    _activatePropagation: function(){
      this.set = this.propagateSet;
      this.delete = this.propagateDelete;
      return true;
    },
    justSet : function(key, value) {
      key = key.toLowerCase();
      return this._storage[key] = value;
    },
    justDelete : function(key, value) {
      var key = key.toLowerCase();
      return delete this._storage[key];
    },
    _propagate: function(key, rev){
      var dirs = key.split('/').slice(0,-1);
      var len = dirs.length;
      var path = '';

      for(var i = 0; i < len; i++){
        path+=dirs[i]+'/'
        if(!rev)
          rev = this._storage[path]+1
        this._storage[path] =  rev;
      }
    }
  }

  /****************************
   * Dropbox - Backend for remtoeStorage.js
   * methods :
   * connect
   * configure
   * get
   * put
   * delete
   * share
   *
   *****************************/
  RS.Dropbox = function(rs) {
    this.rs = rs;
    this.connected = false;
    this.rs = rs;
    RS.eventHandling(this, 'change', 'connected');
    rs.on('error', function(error){
      if(error instanceof RemoteStorage.Unauthorized) {

        // happens in configure
        //
        // this.connected = false;
        // if(haveLocalStorage){
        //   delete localStorage[SETTINGS_KEY]
        // }
        this.configure(null,null,null,null)
      }
    }.bind(this));

    this.clientId = rs.apiKeys.dropbox.api_key;
    this._revCache = new LowerCaseCache();
    this._itemRefs = {};

    if(haveLocalStorage){
      var settings;
      try {
        settings = JSON.parse(localStorage[SETTINGS_KEY]);
      } catch(e){}
      if(settings) {
        this.configure(settings.userAddress, undefined, undefined, settings.token);
      }
      try {
        this._itemRefs = JSON.parse(localStorage[ SETTINGS_KEY+':shares' ])
      } catch(e) {  }
    }
    if(this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.Dropbox.prototype = {

    connect: function() {
      this.rs.setBackend('dropbox');
      RS.Authorize(AUTH_URL, '', String(RS.Authorize.getLocation()), this.clientId);
    },

    configure: function(userAddress, href, storageApi, token) {
      console.log('dropbox configure',arguments);
      if(typeof(token) !== 'undefined') this.token = token;
      if(typeof(useradress) !== 'undefined') this.userAddress = userAddress;

      if(this.token){
        this.connected = true;
        if( !this.useradress ){
          this.info().then(function(info){
            this.userAddress = info.display_name;
            //FIXME propagate this to the view
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
      var revCache = this._revCache;
      var promise = promising();
      var hash = revCache.get(path);
      if(hash)
        url+='?hash='+encodeURIComponent(hash);
      this._request('GET', url, {}, function(err, resp){
        if(err){
          promise.reject(err);
        }else{
          var listing, body, mime, rev;
          mime = 'application/json; charset=UTF-8';
          var status = resp.status;

          if(status==304){
            this.rs.local.getCached(path).then(function(status, listing, mime, rev){
              promise.fulfill(status, listing, mime, hash);
            }, function(){
              promise.reject(arguments);
            })
            return;
          }
          try{
            body = JSON.parse(resp.responseText)
          } catch(e) {
            promise.reject(e);
            return;
          }

          if(body.contents) {
            listing = body.contents.reduce(function(m, item) {
              var itemName = item.path.split('/').slice(-1)[0] + ( item.is_dir ? '/' : '' );

              if(!item.is_dir){
                revCache.set(path+itemName, item.rev);
                m[itemName] = item.rev;
              } else {
                m[itemName] = undefined;
              }
              return m;
            }, {});
            revCache.set(path, body.hash);
          }
          promise.fulfill(status, listing, mime, body.hash);
        }
      });
      return promise;
    },
    get: function(path, options){
      console.log('dropbox.get', arguments);

      var url = 'https://api-content.dropbox.com/1/files/auto' + path
      //use _getDir for directories
      if(path.substr(-1) == '/') return this._getDir(path, options);

      var promise = promising().then(function(){  //checking and maybe fetching the share_url after each get
        this.share(path);
        return arguments
      }.bind(this));
      var revCache = this._revCache
      var savedRev = revCache.get(path)
      if(options && options.ifNoneMatch &&
         savedRev && (savedRev == options.ifNoneMatch)) {
        // nothing changed.
        console.log("nothing changed for",path,savedRev, options.ifNoneMatch)
        promise.fulfill(304);
        return promise;
      }

      this._request('GET', url, {}, function(err, resp){
        if(err) {
          promise.reject(err);
        } else {
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
            // TODO handling binary data
            if(mime.search('application/json') >= 0 || true) {
              try {
                body = JSON.parse(body);
              } catch(e) {
                this.rs.log("Failed parsing Json, assume it is something else then",e,e.stack,e.body);
              }
            }
            revCache.set(path, rev);
          }
          promise.fulfill(status, body, mime, rev);
        }
      });
      return promise
    },
    put: function(path, body, contentType, options){
      if(! this.connected) throw new Error("not connected (path: " + path + ")");

      var promise = promising().then(function(){   //checking and maybe fetching the share_url after each put
        this.share(path);
        return arguments
      }.bind(this));

      //check if file has changed and return 412
      var savedRev = this._revCache.get(path)
      if(options && options.ifMatch &&  savedRev && (savedRev != options.ifMatch) ) {
        promise.fulfill(412);
        return promise;
      }
      if(! contentType.match(/charset=/)) {
        contentType += '; charset=' + ((body instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(body)) ? 'binary' : 'utf-8');
      }
      var url = 'https://api-content.dropbox.com/1/files_put/auto/' + path + '?'
      if(options.ifMatch) {
        url += "parent_rev="+encodeURIComponent(options.ifMatch)
      }
      // if(body.length>150*1024*1024){ //FIXME actual content-length
      //   //https://www.dropbox.com/developers/core/docs#chunked-upload
      // } else {
        this._request('PUT', url, {body:body, headers:{'Content-Type':contentType}}, function(err, resp) {
          if(err) {
            promise.reject(err)
          } else {
            var response = JSON.parse(resp.responseText);
            // if dropbox reports an file conflict they just change the name of the file
            // TODO find out which stays the origianl and how to deal with this
            if(response.path != path){
              promise.fulfill(412);
              rs.log('Dropbox created conflicting File ', response.path)
            }
            else
              this._revCache.set(path, response.rev);
              promise.fulfill(resp.status);
          }
        })
      // }
      return promise
    },
    'delete': function(path, options){
      console.log('dropbox.delete ', arguments);
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
          promise.fulfill(resp.status);
          this._revCache.delete(path);
        }
      })

      return promise.then(function(){
        delete this._itemRefs[path]
        return arguments;
      }.bind(this))
    },
    // get share url from Dropbox
    share: function(path){
      var url = "https://api.dropbox.com/1/media/auto"+path
      var promise = promising();

      if(!path.match(/^\/public\//) && typeof this._itemRefs[path] != 'undefined'){
        console.log('not public or already in store', path)
        return promise.fulfill(this._itemRefs[path]);
      }
      // requesting shareing url
      this._request('POST', url, {}, function(err, resp){
        if(err) {
          console.log(err)
          err.message = 'Shareing Dropbox Thingie("'+path+'") failed' + err.message;
          promise.reject(err)
        } else {
          try{
            promise.fulfill( JSON.parse(resp.responseText).url );
            this._itemRefs[path] = url;
            if(haveLocalStorage)
              localStorage[SETTINGS_KEY+":shares"] = JSON.stringify(this._itemRefs);
            console.log(resp)
          }catch(e) {
            err.message += "share error"
            promise.reject(err);
          }
        }
      });
      return promise
    },
    // fetching user info from Dropbox returns promise
    info: function() {
      var url = 'https://api.dropbox.com/1/account/info'
      var promise = promising();
      // requesting user info(mainly for userAdress)
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
    }
  };

  function hookGetItemURL(rs) {
    if(rs._origBaseClientGetItemURL)
      retrun;
    rs._origBaseClientGetItemURL = RS.BaseClient.prototype.getItemURL;
    RS.BaseClient.prototype.getItemURL = function(path){
      var ret = rs.dropbox._itemRefs[path];
      return  ret ? ret : '';
    }
  }
  function unHookGetItemURL(rs){
    if(! rs._origBaseClieNtGetItemURL)
      return;
    RS.BaseClient.prototype.getItemURL = rs._origBaseClietGetItemURL;
    delete rs._origBaseClietGetItemURL;
  }

  RS.Dropbox._rs_init = function(rs) {
    if( rs.apiKeys.dropbox ) {
      rs.dropbox = new RS.Dropbox(rs);
    }
    if(rs.backend == 'dropbox'){
      rs._origRemote = rs.remote;
      rs.remote = rs.dropbox;
      hookGetItemURL(rs);
    }
  };

  RS.Dropbox._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    return true;
  };

  RS.Dropbox._rs_cleanup = function(rs) {
    unHookGetItemURL(rs);

    if(rs._origRemote)
      rs.remote = rs._origRemote;
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    rs.setBackend(undefined);
  };
})(this);
