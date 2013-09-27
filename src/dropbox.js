(function(global) {
  var RS = RemoteStorage;
  /**
   * Dropbox backend for RemoteStorage.js
   * known limits : 
   *   files larger than 150mb are not suported for upload
   *   directories with more than 10.000 files will cause problems to list
   *   content-type is guessed by dropbox.com therefore they aren't fully supported
   */
  var haveLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize';
  var SETTINGS_KEY = 'remotestorage:dropbox';

  /*************************
   * LowerCaseCache
   * this Cache will lowercase it's keys and propagate the values to "upper directories"
   * get : get a value
   * set : set a value and propagate
   * delete : delete and propagate
   *************************/
  function LowerCaseCache(defaultValue){
    this.defaultValue = defaultValue ? defaultValue : 'rev'
    this._storage = { };
    this.set = this.justSet;
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
      if(this._storage[key] == value) return value;
      this._propagate(key, value);
      return this._storage[key] = value;
    },
    _activatePropagation: function(){
      this.set = this.propagateSet;
    },
    justSet : function(key, value) {
      key = key.toLowerCase();
      this._storage[key] = value;
      return value;
    },
    delete : function(key) {
      key = key.toLowerCase();
      this._propagate(key);
      delete this._storage[key];
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
      RS.Authorize(AUTH_URL, '', String(document.location), this.clientId);
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
      var promise = promising();
      var revCache = this._revCache;
      this._request('GET', url, {}, function(err, resp){
        if(err){
          promise.reject(err);
        }else{
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
          rev = this._revCache.get(path)
          mime = 'application/json; charset=UTF-8'
          if(body.contents) {
            listing = body.contents.reduce(function(m, item) {
              var itemName = item.path.split('/').slice(-1)[0] + ( item.is_dir ? '/' : '' );
              if(item.is_dir){
                m[itemName] = revCache.get(path+itemName);
              } else {
                m[itemName] = item.rev;
              }
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
      var url = 'https://api-content.dropbox.com/1/files/auto' + path
      var promise = promising().then(function(){  //checking and maybe fetching the share_url after each get
        this.share(path);
        return arguments
      }.bind(this));
      
      var savedRev = this._revCache.get(path)
      if(savedRev === null) { 
        //file was deleted server side
        console.log(path,' deleted 404')
        promise.fulfill(404);
        return promise;
      }
      if(options && options.ifNoneMatch && 
         savedRev && (savedRev == options.ifNoneMatch)) {
        // nothing changed.
        console.log("nothing changed for",path,savedRev, options.ifNoneMatch)
        promise.fulfill(304);
        return promise;
      }
      
      //use _getDir for directories 
      if(path.substr(-1) == '/') return this._getDir(path, options);

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
            this._revCache.set(path, rev);
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
      if(body.length>150*1024*1024){ //FIXME actual content-length
        //https://www.dropbox.com/developers/core/docs#chunked-upload
      } else { 
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
      }
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
    },
    // method: fetchDelta
    //
    // this method fetches the deltas from the dropbox api, used to sync the storage
    // here we retrive changes and put them into the _revCache, those values will then be used 
    // to determin if something has changed
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
          this.rs.log('fetchDeltas',error);
          this.rs._emit('error', new RemoteStorage.SyncError('fetchDeltas failed'+error));
          promise.reject(error);
        } else {
          // break if status != 200
          if(response.status != 200 ){
            if(response.status == 400) {
              this.rs._emit('error', new RemoteStorage.Unauthorized());
              promise.fulfill(args)
            } else {
              console.log("!!!!dropbox.fetchDelta returned "+response.status+response.responseText);
              promise.reject("dropbox.fetchDelta returned "+response.status+response.responseText);
            }
            return promise;
          }

          try {
            var delta = JSON.parse(response.responseText);
          } catch(error) {
            rs.log('fetchDeltas can not parse response',error)
            return promise.reject("can not parse response of fetchDelta : "+error.message);
          }
          // break if no entries found
          if(!delta.entries){
            console.log("!!!!!DropBox.fetchDeltas() NO ENTRIES FOUND!!", delta);
            return promise.reject('dropbox.fetchDeltas failed, no entries found');
          }

          // Dropbox sends the complete state
          if(delta.reset) {
            this._revCache = new LowerCaseCache();
            promise.then(function(){
              var args = Array.prototype.slice.call(arguments);
              this._revCache._activatePropagation();
              return args;
            }.bind(this));
          }
          
          //saving the cursor for requesting further deltas in relation to the cursor position
          if(delta.cursor)
            this._deltaCursor = delta.cursor;
          
          //updating revCache
          console.log("Delta : ",delta.entries);
          delta.entries.forEach(function(entry) {
            var path = entry[0];
            var rev;
            if(!entry[1]){
              rev = null;
            } else {
              if(entry[1].is_dir)
                return;
              rev = entry[1].rev;
            }
            this._revCache.set(path, rev);
          }.bind(this));
          promise.fulfill.apply(promise, args);
        }
      });
      return promise;
    }
  };

  //hooking and unhooking the sync

  function hookSync(rs) {
    if(rs._dropboxOrigSync) return; // already hooked
    rs._dropboxOrigSync = rs.sync.bind(rs);
    rs.sync = function() {
      return this.dropbox.fetchDelta.apply(this.dropbox, arguments).
        then(rs._dropboxOrigSync, function(err){
          rs._emit('error', new rs.SyncError(err));
        });
    };
  }
  function unHookSync(rs) {
    if(! rs._dropboxOrigSync) return; // not hooked
    rs.sync = rs._dropboxOrigSync;
    delete rs._dropboxOrigSync;
  }
  
  // hooking and unhooking getItemURL

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
      if(rs.sync) {
        hookSync(rs);
      }
      hookGetItemURL(rs);
    }
  };

  RS.Dropbox._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    return true;
  };

  RS.Dropbox._rs_cleanup = function(rs) {
    unHookSync(rs);
    unHookGetItemURL(rs);

    if(rs._origRemote)
      rs.remote = rs._origRemote;
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    rs.setBackend(undefined);
  };
})(this);
