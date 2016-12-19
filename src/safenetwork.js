(function (global) {
  /**
   * Class: RemoteStorage.SafeNetwork
   *
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   *
   * SAFE Network backend for RemoteStorage.js mrhTODO: ??? This file exposes a
   * get/put/delete interface which is compatible with
   * <RemoteStorage.WireClient>.
   * 
   * When remoteStorage.backend is set to 'safenetwork', this backend will
   * initialize and replace remoteStorage.remote with remoteStorage.safenetwork.
   * 
   * mrhTODO: ??? In order to ensure compatibility with the public folder,
   * <BaseClient.getItemURL> gets hijacked to return the Dropbox public share
   * URL.
   * 
   * To use this backend, you need to provide information for SAFE authorisation:
   *
   * (start code)
   *
   * remoteStorage.setApiKeys('safenetwork', 
   *     {   
   *         // For details see safe-js safeAuth API
   *         app: {
   *             name: 'RemoteStorage Demo',        // Your app name etc.
   *             version: '0.0.1',
   *             vendor: 'remoteStorage',
   *             id: 'org.remotestorage.rsdemo',    // Identifies stored data (unique per vendor)
   *             permissions: ['SAFE_DRIVE_ACCESS'] // List of permissions to request. On authorisation, 
   *         },                                     // holds permissions granted by user    
   *     }
   * ); 
   *
   * (end code)
   *
   **/

  ENABLE_ETAGS = true;   // false disables ifMatch / ifNoneMatch checks

  var RS = RemoteStorage;
  
  var isFolder = RemoteStorage.util.isFolder;
  var hasLocalStorage;
  var SETTINGS_KEY = 'remotestorage:safenetwork';
  var PATH_PREFIX = '/remotestorage/';  // mrhTODO app configurable?
  
  var RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

  function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
  }

  // Used to cache file info
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
    },
    
    'delete': function (key) {
      var item = this._items[key];
      if ( item ) {
        delete item;
      }
    }
  };

  var onErrorCb;

  RS.SafeNetwork = function (remoteStorage, clientId) {
    this.rs = remoteStorage;
    this.clientId = clientId;
    this._fileInfoCache = new Cache(60 * 5); // mrhTODO: info expires after 5 minutes (is this a good idea?)
    this.connected = false;
    var self = this;

    hasLocalStorage = RemoteStorage.util.localStorageAvailable();

    onErrorCb = function (error){
      // mrhTODO should this affect this.connected, this.online and emit network-offline?
      
      if (error instanceof RemoteStorage.Unauthorized) {

        // Delete all the settings - see the documentation of
        // wireclient.configure
        self.configure({
          // mrhTODO can probably eliminate all these - check if any apply to SAFE backend first
          userAddress: null,    // webfinger style address (username@server)
          href: null,           // server URL from webfinger
          storageApi: null,     // remoteStorage API dependencies in here (safenetwork.js), not server, so hardcode?
          
          options: null,        // http request headers - maybe Dropbox only?
            
          // SAFE Launcher auth response:
          token: null,
          permissions: null,    // List of granted SAFE Network access permssions (e.g. 'SAFE_DRIVE_ACCESS')
        });
      }
    };    

    // Events that we either handle, or emit on self
    RS.eventHandling(this, 'connected', 'not-connected', 'wire-busy', 'wire-done');
    this.rs.on('error', onErrorCb);

    if (hasLocalStorage){
      var settings;
      try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      } catch(e) {
        localStorage.removeItem(SETTINGS_KEY);  // Clear broken settings
      }
      
      if (settings)
        this.configure(settings);
    }
    
};

  RS.SafeNetwork.prototype = {
    connected: false,
    online: true,
    isPathShared: true,         // App private storage mrhTODO shared or private? app able to control?
        
    configure: function (settings) {
      // We only update this.userAddress if settings.userAddress is set to a string or to null:
      if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
      // Same for this.token. If only one of these two is set, we leave the other one at its existing value:
      if (typeof settings.token !== 'undefined') { this.token = settings.token; }

      var writeSettingsToCache = function() {
        if (hasLocalStorage) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            userAddress: this.userAddress,
            token: this.token,
            permissions: this.permissions,
          }));
        }
      };

      var handleError = function() {
        this.connected = false;
        delete this.permissions;
        
        if (hasLocalStorage) {
          localStorage.removeItem(SETTINGS_KEY);
        }
        RS.log('SafeNetwork.configure() [DISCONNECTED]');
      };

      if (this.token) {
        this.connected = true;
        this.permissions = settings.permissions;
        if (this.userAddress) {
          this._emit('connected');
          writeSettingsToCache.apply(this);
          RS.log('SafeNetwork.configure() [CONNECTED-1]');
        } else {
          // mrhTODO if SN implements account names implement in SafeNetwork.info:
          this.info().then(function (info){
            this.userAddress = info.accountName;
            this.rs.widget.view.setUserAddress(this.userAddress);
            this._emit('connected');
            writeSettingsToCache.apply(this);
            RS.log('SafeNetwork.configure() [CONNECTED]-2');
          }.bind(this)).catch(function() {
            handleError.apply(this);
            this._emit('error', new Error('Could not fetch account info.'));
          }.bind(this));
        }
      } else {
        handleError.apply(this);
      }
    },
    
    connect: function () {
      RS.log('SafeNetwork.connect()...');

      // mrhTODO: note dropbox connect calls hookIt() if it has a token - for sync?
      // mrhTODO: note dropbox connect skips auth if it has a token - enables it to remember connection across sessions
      // mrhTODO: if storing Authorization consider security risk - e.g. another app could steal to access SAFE Drive?
      this.rs.setBackend('safenetwork');
      this._setBackendExtras('safenetwork');
      this.safenetworkAuthorize(this.rs.apiKeys['safenetwork']);
    },

    // SafeNetwork is the first backend that doesn't involve a re-direct, and so
    // doesn't trigger RS._init() upon successful authorisation. So we have to
    // do a bit more here to ensure what happens at the end of RS loadFeatures()
    // as a result of the redirect is also done without it.
    //
    // mrhTODO - this should probably go in the RS setBackend()
    _setBackendExtras: function () {
      var rs = this.rs;

      // Missing from RS.setBackend()
      // Needed to ensure we're the active backend or sync won't start 
      // if:
      //    - this backend was not already set in localStorage on load, *and*
      //    - this backend doesn't do a redirect (page reload) after authorisation
      //
      // See: https://github.com/theWebalyst/remotestorage.js/issues/1#
      //
      if (this.rs.backend === 'safenetwork' && typeof this.rs._safenetworkOrigRemote === 'undefined') {
        this.rs._safenetworkOrigRemote = this.rs.remote;
        this.rs.remote = this.rs.safenetwork;
        this.rs.sync.remote = this.rs.safenetwork;

        // mrhTODO - this doesn't check that the event listener hasn't already been installed - should it?
        
        // mrhTODO - hope fireReady() only matters in RS _init() (see below)
        
        if (rs.widget)
          rs.widget.initRemoteListeners();

        this.on('connected', function (){
          //fireReady();
          rs._emit('connected');
        });
        this.on('not-connected', function (){
          //fireReady();
          rs._emit('not-connected');
        });
        
        if (this.connected) {
          //fireReady();
          rs._emit('connected');
        }

        if (!rs.hasFeature('Authorize')) {
          this.stopWaitingForToken();
        }
      }
    },

    
    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    reflectNetworkStatus: function (isOnline){
      if (this.online != isOnline) {
        this.online = isOnline;
        RS.log('reflectNetworkStatus() emitting: ' + (isOnline ? 'network-online' : 'network-offline'));
        this.rs._emit(isOnline ? 'network-online' : 'network-offline');
      }
    },

    safenetworkAuthorize: function (appApiKeys) {
      var self = this;
      self.appKeys = appApiKeys.app;

      tokenKey = SETTINGS_KEY + ':token';
      window.safeAuth.authorise(self.appKeys, tokenKey).then( function(response) {
        self.configure({ 
            token:          response.token,         // Auth token
            permissions:    response.permissions,   // List of permissions approved by the user
          });
        
      }, function (err){
        self.reflectNetworkStatus(false);
        RS.log('SafeNetwork Authorisation Failed');
        RS.log(err);
      });
    },

    
    // mrhTODO Adapted from remotestorage.js
    _wrapBusyDone: function (result, method, path) {
      var self = this;
      var folderFlag = isFolder(path);
      
      self._emit('wire-busy', { method: method, isFolder: folderFlag });
      return result.then(function (r) {
        self._emit('wire-done', { method: method, success: true, isFolder: folderFlag });
        return Promise.resolve(r);
      }, function (err) {
        self._emit('wire-done', { method: method, success: false, isFolder: folderFlag });
        return Promise.reject(err);
      });
    },

    // For reference see WireClient#get (wireclient.js)
    get: function (path, options) {        return this._wrapBusyDone.call(this, this._get(path, options), "get", path); },

    _get: function (path, options) {
      RS.log('SafeNetwork.get(' + path + ',...)' );
      var fullPath = ( PATH_PREFIX + '/' + path ).replace(/\/+/g, '/');

      if (path.substr(-1) === '/') {
        return this._getFolder(fullPath, options);
      } else {
        return this._getFile(fullPath, options);
      }
    },

    // put - create and/or update a file
    //
    // "The response MUST contain a strong etag header, with the document's
    // new version (for instance a hash of its contents) as its value."
    //  Spec: https://github.com/remotestorage/spec/blob/master/release/draft-dejong-remotestorage-07.txt#L295-L296
    //  See WireClient#put and _request for details of what is returned
    //
    //
    // mrhTODO bug: if the file exists (ie put is doing an update), contentType is not updated 
    // mrhTODO      because it can only be set by _createFile (SAFE NFS API: POST)
    // mrhTODO      FIX: when API stable, best may be to store contentType in the file not as metadata
    // mrhTODO           when API stable, best may be to store contentType in the file not as metadata
    
    put: function (path, body, contentType, options) {        return this._wrapBusyDone.call(this, this._put(path, body, contentType, options), "put", path); },

    _put: function (path, body, contentType, options) {
      RS.log('SafeNetwork.put(' + path + ', ' + (options ? ( '{IfMatch: ' + options.IfMatch + ', IfNoneMatch: ' + options.IfNoneMatch + '})') : 'null)' ) );
      var fullPath = ( PATH_PREFIX + '/' + path ).replace(/\/+/g, '/');

      // putDone - handle PUT response codes, optionally decodes metadata from JSON format response
      var self = this;
      function putDone(response) {
        RS.log('SafeNetwork.put putDone(statusCode: ' + response.statusCode + ') for path: ' + path );
        
        // mrhTODO SAFE API v0.6: _createFile/_updateFile lack version support
        // mrhTODO so the response.statusCode checks here are untested
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return self._getFileInfo(fullPath).then( function (fileInfo){
            
            var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );            
            return Promise.resolve({statusCode: 200, 'contentType': contentType, revision: etagWithoutQuotes});
          }, function (err){
            RS.log('REJECTING!!! ' + err.message)
            return Promise.reject(err);
          });
        } else if (response.statusCode === 412) {   // Precondition failed
          RS.log('putDone(...) conflict - resolving with statusCode 412');
          return Promise.resolve({statusCode: 412, revision: 'conflict'});
        } else {
          return Promise.reject(new Error("PUT failed with status " + response.statusCode + " (" + response.responseText + ")"));
        }
      }
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (fileInfo) {
          if (options && (options.ifNoneMatch === '*')) {
            return putDone({ statusCode: 412 });    // Precondition failed (because entity exists, version irrelevant)
          }
          return self._updateFile(fullPath, body, contentType, options).then(putDone);
        } else {
          return self._createFile(fullPath, body, contentType, options).then(putDone);
        }
      }, function (err){
        RS.log('REJECTING!!! ' + err.message)
        return Promise.reject(err);
      });
    },

    // mrhTODO: delete bug - when the last file or folder in a folder is deleted that folder 
    // mrhTODO:       must no longer appear in listings of the parent folder, and so should
    // mrhTODO:       be deleted from the SAFE NFS drive, and so on for its parent folder as 
    // mrhTODO:       needed. This is not done currently.
    //
    delete: function (path, options) {        return this._wrapBusyDone.call(this, this._delete(path, options), "delete", path); },

    _delete: function (path, options) {
      RS.log('SafeNetwork.delete(' + path + ',...)' );
      var fullPath = ( PATH_PREFIX + '/' + path ).replace(/\/+/g, '/');

      RS.log('SafeNetwork.delete: ' + fullPath + ', ...)' );
      var self = this;
      
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (!fileInfo) {
          // File doesn't exist. Ignore.
          return Promise.resolve({statusCode: 200});
        }

        var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );
        if (ENABLE_ETAGS && options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
          return {statusCode: 412, revision: etagWithoutQuotes};
        }

        deleteFunction = ( fullPath.substr(-1)==='/' ? window.safeNFS.deleteDir : window.safeNFS.deleteFile );
        return deleteFunction(self.token, fullPath, self.isPathShared).then(function (success){
          // mrhTODO must handle: if file doesn't exist also do self._fileInfoCache.delete(fullPath);

          self.reflectNetworkStatus(true);   // mrhTODO - should be true, unless 401 - Unauthorized

          if (success) {
            self._fileInfoCache.delete(fullPath);
            return Promise.resolve({statusCode: 200});
          } else {
            return Promise.reject('safeNFS deleteFunction("' + fullPath + '") failed: ' + success );
          }
        }, function (err){
          RS.log('REJECTING!!! deleteFunction("' + fullPath + '") failed: ' + err.message)
          return Promise.reject(err);
        });

      }, function (err){
        self.reflectNetworkStatus(false);
        RS.log('REJECTING!!! ' + err.message)
        return Promise.reject(err);
      });
    },

    /**
     * Method: info
     *
     * Fetches an account name for display in widget
     *
     * Returns:
     *
     *   A promise to the user's account info
     */
    info: function () {        return this._wrapBusyDone.call(this, this._info(), "get", ''); },

    _info: function () {
      // Not yet implemented on SAFE, so provdie a default
      return Promise.resolve({accountName: 'SafeNetwork'});
    },

    _updateFile: function (fullPath, body, contentType, options) {
      RS.log('SafeNetwork._updateFile(' + fullPath + ',...)' );
      var self = this;

      /* mrhTODO GoogleDrive only I think...
      if ((!contentType.match(/charset=/)) &&
          (encryptedData instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(encryptedData))) {
        contentType += '; charset=binary';
      }
*/
      
      return window.safeNFS.createOrUpdateFile(self.token, fullPath, body, contentType, body.length, null, self.isPathShared).then(function (result) {
        // self._shareIfNeeded(fullPath);  // mrhTODO what's this? (was part of dropbox.js)

        var response = { statusCode: ( result ? 200 : 400  ) }; // mrhTODO currently just a response that resolves to truthy (may be extended to return status?)
        self.reflectNetworkStatus(true);
        
        self._fileInfoCache.delete(fullPath);     // Invalidate any cached eTag
        return Promise.resolve( response );
      }, function (err){
        self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
        RS.log('REJECTING!!! safeNFS.createOrUpdateFile("' + fullPath + '") failed: ' + err.message)
        return Promise.reject(err);
      });
    },

    _createFile: function (fullPath, body, contentType, options) {
      RS.log('SafeNetwork._createFile(' + fullPath + ',...)' );
      var self = this;
      
      // Ensure path exists by recursively calling create on parent folder
      return self._makeParentPath(fullPath).then(function (parentPath) {
        
        return window.safeNFS.createFile(self.token, fullPath, body, contentType, body.length, null, self.isPathShared).then(function (result) {
          // self._shareIfNeeded(fullPath);  // mrhTODO what's this?

          var response = { statusCode: ( result ? 200 : 400  ) }; // mrhTODO currently just a response that resolves to truthy (may be extended to return status?)
          self.reflectNetworkStatus(true);

          self._fileInfoCache.delete(fullPath);     // Invalidate any cached eTag
          return Promise.resolve(response);
        }, function (err){
          self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
          RS.log('REJECTING!!! _createFile("' + fullPath + '") failed: ' + err.message)
          return Promise.reject(err);
        });
      }, function (err){
        RS.log('REJECTING!!! _makeParentPath("' + fullPath + '") failed: ' + err.message)
        return Promise.reject(err);
      });
    },

    // For reference see WireClient#get (wireclient.js)
    _getFile: function (fullPath, options) {
      RS.log('SafeNetwork._getFile(' + fullPath + ', ...)' );
      if (! this.connected) { return Promise.reject("not connected (fullPath: " + fullPath + ")"); }
      var revCache = this._revCache;
      var self = this;

      // Check if file exists. Creates parent folder if that doesn't exist.
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        var etagWithoutQuotes = fileInfo.ETag; // mrhTODO don't need this I think: ( fileInfo.ETag && typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );

        // Request is only for changed file, so if eTag matches return "304 Not Modified"
        // mrhTODO strictly this should be asked of SAFE API, but until versioning supported, we cache last eTags
        if (ENABLE_ETAGS && options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
          return Promise.resolve({statusCode: 304});
        }
        
        return window.safeNFS.getFile(self.token, fullPath, 'json', self.isPathShared).then(function (body) {
          
          /* SAFE NFS API file-metadata - disabled for now:
          var fileMetadata = response.getResponseHeader('file-metadata');
          if (fileMetadata && fileMetadata.length() > 0){
            fileMetadata = JSON.parse(fileMetadata);
          }
          RS.log('..file-metadata: ' + fileMetadata);
          */
          
          // Refer to baseclient.js#getFile for retResponse spec (note getFile header comment wrong!)
          var retResponse = {
            statusCode: 200, 
            body: JSON.stringify(body),     // mrhTODO not sure stringify() needed, but without it RS.local copies of nodes differ when loaded from SAFE
                                            // mrhTODO RS ISSUE: is it a bug that RS#get accepts a string *or an object* for body? Should it only accept a string?
            revision: etagWithoutQuotes,
          };

          retResponse.contentType = 'application/json; charset=UTF-8';   // mrhTODO googledrive.js#put always sets this type, so fairly safe default until SAFE NFS supports save/get of content type

          if (fileInfo && fileInfo['Content-Type'] ){
            retResponse.contentType = fileInfo['Content-Type'];
          }
         
          self.reflectNetworkStatus(true);
          return Promise.resolve( retResponse );
        }, function (err){
          self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
          RS.log('REJECTING!!! safeNFS.getFile("' + fullPath + '") failed: ' + err.message)
          return Promise.reject({statusCode: 404}); // mrhTODO can we get statusCode from err?
        });
      }, function (err){
        RS.log('REJECTING!!! ' + err.message)
        return Promise.reject(err);
      });
    },
    

    // _getFolder - obtain folder listing and create parent folder(s) if absent
    //
    // For reference see WireClient#get (wireclient.js) summarised as follows:
    // - parse JSON (spec example: https://github.com/remotestorage/spec/blob/master/release/draft-dejong-remotestorage-07.txt#L223-L235)
    // - return a map of item names to item object mapping values for "Etag:", "Content-Type:" and "Content-Length:"
    // - NOTE: googledrive.js only provides ETag, safenetwork.js provides ETag, Content-Length but not Content-Type
    // - NOTE: safenetwork.js ETag values are faked (ie not provided by launcher) but functionally adequate
      
    _getFolder: function (fullPath, options) {
      RS.log('SafeNetwork._getFolder(' + fullPath + ', ...)' );
      var self = this;

      // Check if folder exists. Create parent folder if parent doesn't exist
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        var query, fields, data, i, etagWithoutQuotes, itemsMap;
        if (!fileInfo) {
          return Promise.resolve({statusCode: 404}); // mrhTODO should this reject?
        }

        // folder exists so obtain listing
        // mrhTODO change getDir to listLongNames on API update
        RS.log('safeNFS.getDir(token, ' + fullPath + ', isPathShared = ' + self.isPathShared + ')' );
        return window.safeNFS.getDir(self.token, fullPath, self.isPathShared).then(function (body) {

          self.reflectNetworkStatus(true);
          var listing, listingFiles, listingSubdirectories, mime, rev;
          if (body.info) {
            var folderETagWithoutQuotes = fullPath + '-' + body.info.createdOn + '-' + body.info.modifiedOn;
            RS.log('..folder eTag: ' + folderETagWithoutQuotes);
            
            var folderMetadata = {};
            if ( body.info.metadata ){ 
              folderMetadata = body.info.metadata; 
            }
            folderMetadata.ETag = folderETagWithoutQuotes;
            RS.log('..folder metadata: ' + JSON.stringify(folderMetadata));
            
            listingFiles = body.files.reduce(function (m, item) {
              var fullItemPath = fullPath + item.name;
              
              
              var metadata; // mrhTODO compact next few lines
              if ( item.metadata.length > 0 ) {
                metadata = JSON.parse(metadata);
              }
              else {
                metadata = { mimetype: 'application/json; charset=UTF-8' };  // mrhTODO fake it until implemented - should never be used
              }

              // mrhTODO: Until SAFE API supports eTags make them manually:
              // mrhTODO: any ASCII char except double quote: https://tools.ietf.org/html/rfc7232#section-2.3
              var eTagWithoutQuotes = fullItemPath + '-' + item.createdOn + '-' + item.modifiedOn + '-' + item.size;
                
              // Add file info to cache
              var fileInfo = {
                fullPath: fullItemPath, // Used by _fileInfoCache() but nothing else
                
                // Remaining members must pass RS.js test: sync.js#corruptServerItemsMap()
                ETag: eTagWithoutQuotes,
                'Content-Length': item.size,
                'Content-Type': metadata.mimetype,  // metadata.mimetype currently faked (see above) mrhTODO, see next
              };

              self._fileInfoCache.set(fullItemPath, fileInfo);
              RS.log('..._fileInfoCache.set(file: ' + fullItemPath  + ')' );
              m[item.name] =  fileInfo;              
              return m;
            }, {});

            listingSubdirectories = body.subDirectories.reduce(function (m, item) {
              var fullItemPath = fullPath + item.name + '/';
              
              // mrhTODO until SAFE API supports eTags make them manually:
              // Create eTag manually (any ASCII char except double quote: https://tools.ietf.org/html/rfc7232#section-2.3)
              var eTagWithoutQuotes = fullItemPath + '-' + item.createdOn + '-' + item.modifiedOn;
                
              // Add file info to cache
              var fileInfo = { 
                fullPath: fullItemPath,
                ETag: eTagWithoutQuotes,
              };
              
              self._fileInfoCache.set(fullItemPath, fileInfo);
              RS.log('..._fileInfoCache.set(directory: ' + fullItemPath  + ')' );
              m[item.name + '/'] = fileInfo;
              return m;
            }, {});

            // Merge into one listing
            var listing = {};
            for (var attrname in listingFiles) {            listing[attrname] = listingFiles[attrname]; }
            for (var attrname in listingSubdirectories) {   listing[attrname] = listingSubdirectories[attrname]; }          
          }

          RS.log('SafeNetwork._getFolder(' + fullPath + ', ...) RESULT: lising contains ' + JSON.stringify( listing ) );
          return Promise.resolve({statusCode: 200, body: listing, meta: folderMetadata, contentType: RS_DIR_MIME_TYPE/*, mrhTODO revision: folderETagWithoutQuotes*/ });
        }, function (err){
          self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
          RS.log('safeNFS.getDir("' + fullPath + '") failed: ' + err.status );
          //var status = (err == 'Unauthorized' ? 401 : 404); // mrhTODO ideally safe-js would provide response code (possible enhancement)
          if (err.status == 401){
            // Modelled on how googledrive.js handles expired token
            if (self.connected)
              self.connect();
              return;
          }
          return Promise.reject({statusCode: err.status});
        });
      }, function (err){
        RS.log('_getFileInfo("' + fullPath + '") failed: ' + err)
        return Promise.reject(err);
      });
    },

    // Ensure fullPath exists by recursively calling _createFolder if the parent doesn't exist
    _makeParentPath: function (fullPath) {
      RS.log('SafeNetwork._makeParentPath(' + fullPath + ')' );
      var parentFolder = parentPath(fullPath);
      var self = this;
      return self._getFileInfo(parentFolder).then(function (parentInfo) {
        if (parentInfo) {
          return Promise.resolve(parentInfo);
        } else {
          return self._createFolder(parentFolder);
        }
      }, function (err){
        RS.log('REJECTING!!! ' + err.message)
        return Promise.reject(err);
      });
    },

    _createFolder: function (folderPath) {
      RS.log('SafeNetwork._createFolder(' + folderPath + ')' );
      var self = this;

      var userMetadata = "";
      
      // Recursively create parent folders
      return self._makeParentPath(folderPath).then(function (parentInfo) {
        // Parent exists so create 'folderPath'
        
//mrhTODO var needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
//mrhTODO the above line is not in the googledrive.js version (must be from my port of dropbox.js)

        return window.safeNFS.createDir(self.token, folderPath, self.isPrivate, self.userMetadata, self.isPathShared).then(function (response) {
//          self._shareIfNeeded(folderPath);  // mrhTODO what's this? (was part of dropbox.js)
          self.reflectNetworkStatus(true);
          return Promise.resolve(response);
        }, function (err){
          self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
          RS.log('safeNFS.createDir("' + folderPath + '") failed: ' + err.message)
          return Promise.reject({statusCode: 404}); // mrhTODO can we get statusCode from err?
        });

      }, function (err){
        RS.log('_makeParentPath("' + folderPath + '") failed: ' + err.message)
        return Promise.reject(err);
      });
    },


    // _getFileInfo() - check if file exists and create parent folder if necessary
    //
    // Checks if the file/folder (fullPath) is in the _fileInfoCache(), and if not found
    // obtains a parent folder listing to check if it exists. Causes update of _fileInfoCache
    // with contents of its parent folder. 
    //
    // If the parent folder does not exist it will be created as a side effect, so this
    // function can be used to check if a file exists before creating or updating its content.
    //
    // RETURNS
    //  Promise() with
    //      if a file    { path: string, ETag: string, 'Content-Length': number }
    //      if a folder  { path: string, ETag: string }
    //      if root '/'  { path: '/' ETag }
    //      or {} if file/folder doesn't exist
    //  See _getFolder() to confirm the above content values (as it creates fileInfo objects)
    // 
    // Note:
    //      if the parent folder doesn't exist it will be created
    //
    _getFileInfo: function (fullPath) {
      RS.log('SafeNetwork._getFileInfo(' + fullPath + ')' );

      var self = this;
      var info;

      if (fullPath === '/' ) {
        return Promise.resolve({ path: fullPath, ETag: 'root' }); // Dummy fileInfo to stop at "root"
      } else if ((info = self._fileInfoCache.get(fullPath))) {
        return Promise.resolve(info);               // If cached we believe it exists
      }
      
      // Not yet cached or doesn't exist
      // Load parent folder listing update _fileInfoCache.
      return self._getFolder(parentPath(fullPath)).then(function () {
        
        info = self._fileInfoCache.get(fullPath);
        if (!info) {
          // Doesn't exist yet so...
          if (fullPath.substr(-1) === '/') {    // folder, so create it
            return self._createFolder(fullPath).then(function () {
              return self._getFileInfo(fullPath);
            }, function (err){
              RS.log('_createFolder("' + fullPath + '") ERROR statusCode: ' + err.statusCode )
              return Promise.reject(err);
            });
          }
          else {                                // file, doesn't exist
            RS.log('_getFileInfo(' + fullPath + ') file does not exist, no fileInfo available ')
            return Promise.resolve(null);            
          }
        }
        
        return Promise.resolve(info);         // Pass back info (null if doesn't exist)
      }, function (err){
        RS.log('_getFolder("' + parentPath(fullPath) + '") ERROR statusCode: ' + err.statusCode )
        return Promise.reject(err);
      });
      
    }
  };

  // mrhTODO see dropbox version - probably need to modify this in line with that (check with RS team)
  // differences are:
  //    1) config.clientId not present
  //    2) it uses hookIt() (and in _rs_cleanup() unHookIt()) instead of inline assignements
  //       which causes dropbox version  to also call hookSync() and hookGetItemURL()
  //
  // mrhTODO re-above, also need to check if app calling setAPIKeys for multiple backends breaks this
  // mrhTODO and may cause problems with starting sync?
  // mrhTODO Maybe the hookIt stuff in Dropbox allows chaining, but not yet in GD or SN?
  //
  
  RS.SafeNetwork._rs_init = function (remoteStorage) {
    hasLocalStorage = RemoteStorage.util.localStorageAvailable();

    var config = remoteStorage.apiKeys.safenetwork;
    if (config) {
      remoteStorage.safenetwork = new RS.SafeNetwork(remoteStorage, config.clientId);
      if (remoteStorage.backend === 'safenetwork' && remoteStorage.remote !== remoteStorage.safenetwork) {
        remoteStorage._safenetworkOrigRemote = remoteStorage.remote;
        remoteStorage.remote = remoteStorage.safenetwork;

          // Handle connect on load of app (final part of SN authorisation)
/*        if ( hasLocalStorage && localStorage.getItem(SETTINGS_KEY + ':connect-on-load') ){
          localStorage.removeItem(SETTINGS_KEY + ':connect-on-load');
          
          remoteStorage.remote.configure({
            token:        localStorage[SETTINGS_KEY + ':token'],
            permissions:  localStorage[SETTINGS_KEY + ':permissions']
          });             // Complete the connect
          remoteStorage.remote.reflectNetworkStatus(true);      // Emit network-online
        }
*/      }
    }
  };

  RS.SafeNetwork._rs_supported = function (rs) {
    return true;
  };

  // mrhTODO see dropbox version
  RS.SafeNetwork._rs_cleanup = function (remoteStorage) {
    remoteStorage.setBackend(undefined);
    if (remoteStorage._safenetworkOrigRemote) {
      remoteStorage.remote = remoteStorage._safenetworkOrigRemote;
      delete remoteStorage._safenetworkOrigRemote;
    }
  };

})(this);
