(function (global) {
  var RS = RemoteStorage;
  // next steps :
  //  features:
  // handle fetchDelta has_more
  // handle files larger than 150MB
  //
  //  testing:
  // add to remotestorage browser
  // add to sharedy
  // maybe write tests for remote
  //


  /**
   * Class: RemoteStorage.Dropbox
   *
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   *
   * Dropbox backend for RemoteStorage.js
   * this file exposes a get/put/delete interface which is compatible with the wireclient
   * it requires to get configured with a dropbox token similar to the wireclient.configure
   *
   * when the remotestorage.backend was set to 'dropbox' it will initialize and resets
   * remoteStorage.remote with remoteStorage.dropbox
   *
   * for compability with the public folder the getItemURL function of the BaseClient gets
   * highjackt and returns the dropbox share-url
   *
   * to connect with dropbox a connect function is provided
   *
   * known issues :
   *   files larger than 150mb are not suported for upload
   *   folders with more than 10.000 files will cause problems to list
   *   content-type is guessed by dropbox.com therefore they aren't fully supported
   *   dropbox preserves cases but not case sensitive
   *   share_urls and therfeor getItemURL is asynchronius , which means
   *     getItemURL returns usefull values after the syncCycle
   **/
  var hasLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize';
  var SETTINGS_KEY = 'remotestorage:dropbox';
  var cleanPath = RS.WireClient.cleanPath;

  /*************************
   * LowerCaseCache
   * this Cache will lowercase its keys
   * and can propagate the values to "upper folders"
   *
   * intialized with default Value(undefined will be accepted)
   *
   * set and delete will be set to justSet and justDelete on initialization
   *
   * get : get a value or default Value
   * set : set a value
   * justSet : just set a value and don't propagate at all
   * propagateSet : Set a value and propagate
   * delete : delete
   * justDelete : just delete a value and don't propagate at al
   * propagateDelete : deleta a value and propagate
   * _activatePropagation : replace set and delete with their propagate versions
   *************************/
  function LowerCaseCache(defaultValue){
    this.defaultValue = defaultValue; //defaults to undefimned if initialized without arguments
    this._storage = { };
    this.set = this.justSet;
    this.delete = this.justDelete;
  }

  LowerCaseCache.prototype = {
    get : function (key) {
      key = key.toLowerCase();
      var stored = this._storage[key];
      if (typeof stored === 'undefined'){
        stored = this.defaultValue;
        this._storage[key] = stored;
      }
      return stored;
    },
    propagateSet : function (key, value) {
      key = key.toLowerCase();
      if (this._storage[key] === value) {
        return value;
      }
      this._propagate(key, value);
      return this._storage[key] = value;
    },
    propagateDelete : function (key) {
      key = key.toLowerCase();
      this._propagate(key, this._storage[key]);
      return delete this._storage[key];
    },
    _activatePropagation: function (){
      this.set = this.propagateSet;
      this.delete = this.propagateDelete;
      return true;
    },
    justSet : function (key, value) {
      key = key.toLowerCase();
      return this._storage[key] = value;
    },
    justDelete : function (key, value) {
      key = key.toLowerCase();
      return delete this._storage[key];
    },
    _propagate: function (key, rev){
      var folders = key.split('/').slice(0,-1);
      var path = '';

      for (var i = 0, len = folders.length; i < len; i++){
        path += folders[i]+'/';
        if (!rev) {
          rev = this._storage[path]+1;
        }
        this._storage[path] =  rev;
      }
    }
  };

  /****************************
   * Dropbox - Backend for remtoeStorage.js
   * methods :
   * connect
   * configure
   * get
   * put
   * delete
   * share
   * info
   * Properties :
   * connected
   * rs
   * token
   * userAddress
   *****************************/
  var onErrorCb;
  RS.Dropbox = function (rs) {

    this.rs = rs;
    this.connected = false;
    this.rs = rs;
    var self = this;

    onErrorCb = function (error){
      if (error instanceof RemoteStorage.Unauthorized) {
        self.configure(null,null,null,null);
      }
    };

    RS.eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');
    rs.on('error', onErrorCb);

    this.clientId = rs.apiKeys.dropbox.api_key;
    this._revCache = new LowerCaseCache('rev');
    this._itemRefs = {};
    this._metadataCache = {};

    if (hasLocalStorage){
      var settings;
      try {
        settings = JSON.parse(localStorage[SETTINGS_KEY]);
      } catch(e){}
      if (settings) {
        this.configure(settings.userAddress, undefined, undefined, settings.token);
      }
      try {
        this._itemRefs = JSON.parse(localStorage[ SETTINGS_KEY+':shares' ]);
      } catch(e) {  }
    }
    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.Dropbox.prototype = {
    online: true,

    /**
     * Method : connect()
     *   redirects to AUTH_URL(https://www.dropbox.com/1/oauth2/authorize)
     *   and set's backend to dropbox
     *   therefor it starts the auth flow and end's up with a token and the dropbox backend in place
     **/
    connect: function () {
      //ToDo handling when token is already present
      this.rs.setBackend('dropbox');
      if (this.token){
        hookIt(this.rs);
      } else {
        RS.Authorize(AUTH_URL, '', String(RS.Authorize.getLocation()), this.clientId);
      }
    },
    /**
     * Method : configure(userAdress, x, x, token)
     *   accepts its parameters according to the wireClient
     *   set's the connected flag
     **/
    configure: function (userAddress, href, storageApi, token) {
      if (typeof token !== 'undefined') { this.token = token; }
      if (typeof userAddress !== 'undefined') { this.userAddress = userAddress; }

      if (this.token) {
        this.connected = true;
        if ( !this.userAddress ){
          this.info().then(function (info){
            this.userAddress = info.display_name;
            //FIXME propagate this to the view
          }.bind(this));
        }
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if (hasLocalStorage){
        localStorage[SETTINGS_KEY] = JSON.stringify( { token: this.token,
                                                       userAddress: this.userAddress } );
      }
    },

    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    /**
     * Method : _getFolder(path, options)
     **/
    _getFolder: function (path, options) {
      // FIXME simplify promise handling
      var url = 'https://api.dropbox.com/1/metadata/auto/'+cleanPath(path);
      var revCache = this._revCache;
      var self = this;

      return this._request('GET', url, {}).then(function (resp) {
        var status = resp.status;
        if (status === 304) {
          return Promise.resolve({statusCode: status});
        }
        var listing, body, mime, rev;
        try{
          body = JSON.parse(resp.responseText);
        } catch (e) {
          return Promise.reject(e);
        }
        rev = self._revCache.get(path);
        mime = 'application/json; charset=UTF-8';
        if (body.contents) {
          listing = body.contents.reduce(function (m, item) {
            var itemName = item.path.split('/').slice(-1)[0] + ( item.is_dir ? '/' : '' );
            if (item.is_dir){
              m[itemName] = { ETag: revCache.get(path+itemName) };
            } else {
              m[itemName] = { ETag: item.rev };
            }
            return m;
          }, {});
        }
        return Promise.resolve({statusCode: status, body: listing, contentType: mime, revision: rev});
      });
    },

    /**
     * Method : get(path, options)
     *   get compatible with wireclient
     *   checks for path in _revCache and decides based on that if file has changed
     *   calls _getFolder if file is a folder
     *   calls share(path) afterwards to fill the _hrefCache
     **/
    get: function (path, options) {
      if (! this.connected) { return Promise.reject("not connected (path: " + path + ")"); }
      path = cleanPath(path);
      var url = 'https://api-content.dropbox.com/1/files/auto' + path;
      var self = this;

      var savedRev = this._revCache.get(path);
      if (savedRev === null) {
        // file was deleted server side
        return Promise.resolve({statusCode: 404});
      }
      if (options && options.ifNoneMatch &&
         savedRev && (savedRev === options.ifNoneMatch)) {
        // nothing changed.
        return Promise.resolve({statusCode: 304});
      }

      //use _getFolder for folders
      if (path.substr(-1) === '/') { return this._getFolder(path, options); }

      return this._request('GET', url, {}).then(function (resp) {
        var status = resp.status;
        var meta, body, mime, rev;
        if (status !== 200) {
          return Promise.resolve({statusCode: status});
        }

        body = resp.responseText;
        try {
          meta = JSON.parse( resp.getResponseHeader('x-dropbox-metadata') );
        } catch(e) {
          return Promise.reject(e);
        }

        mime = meta.mime_type; //resp.getResponseHeader('Content-Type');
        rev = meta.rev;
        self._revCache.set(path, rev);
        self._shareIfNeeded(path); // The shared link expires every 4 hours

        // handling binary
        if (!resp.getResponseHeader('Content-Type') ||
            resp.getResponseHeader('Content-Type').match(/charset=binary/)) {
          var pending = Promise.defer();

          RS.WireClient.readBinaryData(resp.response, mime, function (result) {
            pending.resolve({
              statusCode: status,
              body: result,
              contentType: mime,
              revision: rev
            });
          });

          return pending.promise;
        }

        // handling json (always try)
        if (mime && mime.search('application/json') >= 0 || true) {
          try {
            body = JSON.parse(body);
            mime = 'application/json; charset=UTF-8';
          } catch(e) {
            //Failed parsing Json, assume it is something else then
          }
        }

        return Promise.resolve({statusCode: status, body: body, contentType: mime, revision: rev});
      });
    },

    /**
     * Method : put(path, body, contentType, options)
     *   put compatible with wireclient
     *   also uses _revCache to check for version conflicts
     *   also shares via share(path)
     **/
    put: function (path, body, contentType, options) {
      var self = this;

      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }

      path = cleanPath(path);

      //check if file has changed and return 412
      var savedRev = this._revCache.get(path);
      if (options && options.ifMatch &&
          savedRev && (savedRev !== options.ifMatch)) {
        return Promise.resolve({statusCode: 412, revision: savedRev});
      }
      if (options && (options.ifNoneMatch === '*') &&
          savedRev && (savedRev !== 'rev')) {
        return Promise.resolve({statusCode: 412, revision: savedRev});
      }

      if ((!contentType.match(/charset=/)) &&
          (body instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(body))) {
        contentType += '; charset=binary';
      }

      if (body.length > 150 * 1024 * 1024) {
        //https://www.dropbox.com/developers/core/docs#chunked-upload
        return Promise.reject(new Error("Cannot upload file larger than 150MB"));
      }

      var needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
      var uploadParams = {
        body: body,
        contentType: contentType,
        path: path
      };

      if (needsMetadata) {
        return this._getMetadata(path).then(function (metadata) {
          if (options && (options.ifNoneMatch === '*') && metadata) {
            // if !!metadata === true, the file exists
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          }

          if (options && options.ifMatch && metadata && (metadata.rev !== options.ifMatch)) {
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          }

          return self._uploadSimple(uploadParams);
        });
      }

      return self._uploadSimple(uploadParams);
    },

    /**
     * Method : delete(path, options)
     *   similar to get and set
     **/
    'delete': function (path, options) {
      var self = this;

      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }

      path = cleanPath(path);

      //check if file has changed and return 412
      var savedRev = this._revCache.get(path);
      if (options && options.ifMatch && savedRev && (options.ifMatch !== savedRev)) {
        return Promise.resolve({ statusCode: 412, revision: savedRev });
      }

      if (options && options.ifMatch) {
        return this._getMetadata(path).then(function (metadata) {
          if (options && options.ifMatch && metadata && (metadata.rev !== options.ifMatch)) {
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          }

          return self._deleteSimple(path);
        });
      }

      return self._deleteSimple(path);
    },

    /**
     * Method : shareIfNeeded(path)
     *   share a file or folder, if needed
     **/
    shareIfNeeded: function (path) {
      if (path.match(/^\/public\/.*[^\/]$/) && this._itemRefs[path] === undefined) {
        this.share(path);
      }
    },

    /**
     * Method : share(path)
     *   get sher_url s from dropbox and pushes those into this._hrefCache
     *   returns promise
     */
    share: function (path) {
      path = cleanPath(path);

      var self = this;
      var url = 'https://api.dropbox.com/1/media/auto/' + path;

      return this._request('POST', url, {}).then(function (response) {
        if (response.status !== 200) {
          return Promise.reject(new Error('Invalid DropBox API response status when sharing "' + path + '":' + response.status));
        }

        try {
          response = JSON.parse(response.responseText);
        } catch (e) {
          return Promise.reject(new Error('Invalid DropBox API response when sharing "' + path + '": ' + response.responseText));
        }

        self._itemRefs[path] = response.url;

        if (hasLocalStorage) {
          localStorage[SETTINGS_KEY + ':shares'] = JSON.stringify(self._itemRefs);
        }

        return Promise.resolve(url);
      }, function (error) {
        err.message = 'Sharing DropBox file or folder ("' + path + '") failed.' + err.message;
        return Promise.reject(error);
      });
    },

    /**
     * Method : info()
     *   fetching user info from Dropbox returns promise
     **/
    info: function () {
      var url = 'https://api.dropbox.com/1/account/info';
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

    _request: function (method, url, options) {
      var self = this;
      if (! options.headers) { options.headers = {}; }
      options.headers['Authorization'] = 'Bearer ' + this.token;
      return RS.WireClient.request.call(this, method, url, options).then(function (xhr) {
        //503 means retry this later
        if (xhr && xhr.status === 503) {
          return global.setTimeout(self._request(method, url, options), 3210);
        } else {
          return Promise.resolve(xhr);
        }
      });
    },

    /**
    * method: fetchDelta
    *
    *   this method fetches the deltas from the dropbox api, used to sync the storage
    *   here we retrive changes and put them into the _revCache, those values will then be used
    *   to determin if something has changed.
    **/
    fetchDelta: function () {
      var args = Array.prototype.slice.call(arguments);
      var self = this;
      return self._request('POST', 'https://api.dropbox.com/1/delta', {
        body: self._deltaCursor ? ('cursor=' + encodeURIComponent(self._deltaCursor)) : '',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).then(function (response) {
        // break if status != 200
        if (response.status !== 200 ) {
          if (response.status === 400) {
            self.rs._emit('error', new RemoteStorage.Unauthorized());
            return Promise.resolve(args);
          } else {
            return Promise.reject("dropbox.fetchDelta returned "+response.status+response.responseText);
          }
          return;
        }

        var delta;
        try {
          delta = JSON.parse(response.responseText);
        } catch(error) {
          RS.log('fetchDeltas can not parse response',error);
          return Promise.reject("can not parse response of fetchDelta : "+error.message);
        }
        // break if no entries found
        if (!delta.entries) {
          return Promise.reject('dropbox.fetchDeltas failed, no entries found');
        }

        // Dropbox sends the complete state
        if (delta.reset) {
          self._revCache = new LowerCaseCache('rev');
        }

        //saving the cursor for requesting further deltas in relation to the cursor position
        if (delta.cursor) {
          self._deltaCursor = delta.cursor;
        }

        //updating revCache
        RemoteStorage.log("Delta : ", delta.entries);
        delta.entries.forEach(function (entry) {
          var path = entry[0];
          var rev;
          if (!entry[1]){
            rev = null;
          } else {
            if (entry[1].is_dir) {
              return;
            }
            rev = entry[1].rev;
          }
          self._revCache.set(path, rev);
        });
        return Promise.resolve(args);
      }, function (err) {
        this.rs.log('fetchDeltas', err);
        this.rs._emit('error', new RemoteStorage.SyncError('fetchDeltas failed.' + err));
        promise.reject(err);
      }).then(function () {
        if (self._revCache) {
          var args = Array.prototype.slice.call(arguments);
          self._revCache._activatePropagation();
          return Promise.resolve(args);
        }
      });
    },

    _getMetadata: function (path, options) {
      var self = this;
      var cached = this._metadataCache[path];
      var url = 'https://api.dropbox.com/1/metadata/auto' + cleanPath(path);
      url += '?list=' + ((options && options.list) ? 'true' : 'false');
      if (cached && cached.hash) {
        url += '&hash=' + encodeURIComponent(cached.hash);
      }
      return this._request('GET', url, {}).then(function (resp) {
        if (resp.status === 304) {
          return Promise.resolve(cached);
        } else if (resp.status === 200) {
          var response = JSON.parse(resp.responseText);
          self._metadataCache[path] = response;
          return Promise.resolve(response);
        } else {
          // The file doesn't exist
          return Promise.resolve();
        }
      });
    },

    _uploadSimple: function (params) {
      var self = this;
      var url = 'https://api-content.dropbox.com/1/files_put/auto' + cleanPath(params.path) + '?';

      if (params && params.ifMatch) {
        url += "parent_rev=" + encodeURIComponent(params.ifMatch);
      }

      return self._request('PUT', url, {
        body: params.body,
        headers: {
          'Content-Type': params.contentType
        }
      }).then(function (resp) {
        if (resp.status !== 200) {
          return Promise.resolve({ statusCode: resp.status });
        }

        var response;

        try {
          response = JSON.parse(resp.responseText);
        } catch (e) {
          return Promise.reject(e);
        }

        // Conflict happened. Delete the copy created by DropBox
        if (response.path != params.path) {
          var deleteUrl = 'https://api.dropbox.com/1/fileops/delete?root=auto&path=' + encodeURIComponent(response.path);
          self._request('POST', deleteUrl, {});

          return self._getMetadata(params.path).then(function (metadata) {
            return Promise.resolve({
              statusCode: 412,
              revision: metadata.rev
            });
          });
        }

        self._revCache.propagateSet(params.path, response.rev);
        return Promise.resolve({ statusCode: resp.status });
      });
    },

    _deleteSimple: function (path) {
      var self = this;
      var url = 'https://api.dropbox.com/1/fileops/delete?root=auto&path=' + encodeURIComponent(path);

      return self._request('POST', url, {}).then(function (resp) {
        if (resp.status === 406) {
          // Too many files would be involved in the operation for it to
          // complete successfully.
          // TODO: Handle this somehow
          return Promise.reject(new Error("Cannot delete '" + path + "': too many files involved"));
        }

        if (resp.status === 200) {
          self._revCache.delete(path);
          delete self._itemRefs[path];
        }

        return Promise.resolve({ statusCode: resp.status });
      });
    }
  };

  //hooking and unhooking the sync

  function hookSync(rs) {
    if (rs._dropboxOrigSync) { return; } // already hooked
    rs._dropboxOrigSync = rs.sync.bind(rs);
    rs.sync = function () {
      return this.dropbox.fetchDelta.apply(this.dropbox, arguments).
        then(rs._dropboxOrigSync, function (err) {
          rs._emit('error', new rs.SyncError(err));
        });
    };
  }

  function unHookSync(rs) {
    if (! rs._dropboxOrigSync) { return; } // not hooked
    rs.sync = rs._dropboxOrigSync;
    delete rs._dropboxOrigSync;
  }

  // hooking and unhooking getItemURL

  function hookGetItemURL(rs) {
    if (rs._origBaseClientGetItemURL) { return; }
    rs._origBaseClientGetItemURL = RS.BaseClient.prototype.getItemURL;
    RS.BaseClient.prototype.getItemURL = function (path){
      var ret = rs.dropbox._itemRefs[path];
      return  ret ? ret : '';
    };
  }

  function unHookGetItemURL(rs){
    if (! rs._origBaseClieNtGetItemURL) { return; }
    RS.BaseClient.prototype.getItemURL = rs._origBaseClietGetItemURL;
    delete rs._origBaseClietGetItemURL;
  }

  function hookRemote(rs){
    if (rs._origRemote) { return; }
    rs._origRemote = rs.remote;
    rs.remote = rs.dropbox;
  }

  function unHookRemote(rs){
    if (rs._origRemote) {
      rs.remote = rs._origRemote;
      delete rs._origRemote;
    }
  }

  function hookIt(rs){
    hookRemote(rs);
    if (rs.sync) {
      hookSync(rs);
    }
    hookGetItemURL(rs);
  }

  function unHookIt(rs){
    unHookRemote(rs);
    unHookSync(rs);
    unHookGetItemURL(rs);
  }

  RS.Dropbox._rs_init = function (rs) {
    hasLocalStorage = rs.localStorageAvailable();
    if ( rs.apiKeys.dropbox ) {
      rs.dropbox = new RS.Dropbox(rs);
    }
    if (rs.backend === 'dropbox') {
      hookIt(rs);
    }
  };

  RS.Dropbox._rs_supported = function () {
    return true;
  };

  RS.Dropbox._rs_cleanup = function (rs) {
    unHookIt(rs);
    if (hasLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    rs.removeEventListener('error', onErrorCb);
    rs.setBackend(undefined);
  };
})(this);
