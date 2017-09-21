(function (global) {
  /**
   * Class: RemoteStorage.SafeNetwork
   *
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   *
   * SAFE Network backend for RemoteStorage.js This file exposes a
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
   * To use this backend, you need to provide information for SAFE
   * authorisation: mrhTODO: update the following from myfd app.js:
   *
   * (start code)
   *
   * remoteStorage.setApiKeys('safenetwork', { // For details see SAFE DOM API
   * app: { name: 'RemoteStorage Demo', // Your app name etc. version: '0.0.1',
   * vendor: 'remoteStorage', id: 'org.remotestorage.rsdemo', // Identifies
   * stored data (unique per vendor) permissions: ['SAFE_DRIVE_ACCESS'] // List
   * of permissions to request. On authorisation, }, // holds permissions
   * granted by user } );
   *
   * (end code)
   *
   */

  // mrhTODOs:
  // DONE: port the file/directory methods to use SAFE DOM API (safeNfs)
  // mrhTODO NEXT: go through fixing up all mrhTODOs!
  // mrhTODO figure out when/how to free fileHandle / self.fileHandle / self.openFileHandle
  //
  // o limitation: safeNfs API has a limit of 1000 items (files) per container.
  // Directories are inferred
  // so don't add to the count. Ask for way to obtain this limit from the API
  //
  // o SAFE containers: public v private, shared v app specific? Logically I
  // think
  // one shared, private container for all RS apps, unless the App specifies, in
  // which case the app's
  // data will not be visible to other apps. So default is that all user data is
  // private, but visible to
  // all RS apps authorised by the user. This leaves question of how to share a
  // public URL for later!
  // UPDATE: consider use of shareable MDs in the above (added with Test19)
  //
  // o sharing: how to share a public URL to private data (see use of SAFE
  // containers (above)? We could
  // default to all data public, and rely on obfuscation of URLs (filenames) to
  // hide from other users,
  // but that's insecure and probably easily defeated. My be better for sharing
  // a URL to create a copy
  // of the file in a public container used by all RS apps, which also provides
  // a way for a user to list
  // what they've shared and invalidate the share URLs by deleting the public
  // copy.
  //
  // o review SAFE API app: init, auth,connect wrt to RS app and widget control
  // flows
  // o review storage of SAFE API appToken? (Maybe store authUri as token - but
  // how to use it?)
  //
  // NOTES:
  // I need to either use a standard container _public, _private etc or create
  // one and then...
  // Check if RS mutable data exists, and if not create it - and insert it into
  // the container
  // Save the mdHandle for the RS mutable data.
  // -> 1) just use _public and get that working (probably need to write a
  // wrapper that caches a file/directory structure based on the MD key
  // values/paths)
  // -> 2) review behaviours and how to handle >100 entries, and create/insert
  // an MD just for RS apps (perhaps chain multiples together!?)
  // o safeMutableDataMutation.insert/remove/update add operations to a
  // transaction that must later be
  // committed by calling applyEntriesMutation on the container MD.
  //
  // QUESTIONS:
  // o what happens when _public, or any other standard container tries to
  // exceed MAX_MUTABLE_DATA_ENTRIES (1000 in Test18)?
  // o how can web DOM code obtain the value of MAX_MUTABLE_DATA_ENTRIES and
  // other magic numbers?
  //
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

  RS.SafeNetwork = function (remoteStorage, config) {
    this.rs = remoteStorage;
    this._fileInfoCache = new Cache(60 * 5); // mrhTODO: info expires after 5
                                              // minutes (is this a good idea?)
    this.connected = false;
    var self = this;

    hasLocalStorage = RemoteStorage.util.localStorageAvailable();

    onErrorCb = function (error){
      // mrhTODO should this affect this.connected, this.online and emit
      // network-offline?

      if (error instanceof RemoteStorage.Unauthorized) {

        // Delete all the settings - see the documentation of
        // wireclient.configure
        self.configure({
          // mrhTODO can probably eliminate all these - check if any apply to
          // SAFE backend first
          userAddress: null,    // webfinger style address (username@server)
          href: null,           // server URL from webfinger
          storageApi: null,     // remoteStorage API dependencies in here
                                // (safenetwork.js), not server, so hardcode?

          // SAFE Launcher auth response:
          appHandle:      null,                // safeApp.initialise() return
                                                // (appToken)
          authUri:        null,                    // safeApp.authorise()
                                                    // return (authUri)
          permissions:    null, // Permissions used to request authorisation
          options:        null,     // Options used to request authorisation
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
    isPathShared: true,         // App private storage mrhTODO shared or
                                // private? app able to control?
    mdRoot:   null,             // Handle for root mutable data (mrhTODO:
                                // initially maps to _public)
    nfsRoot:  null,             // Handle for nfs emulation


    // Return a Promise which resolves to the mdHandle of the public container,
    // or null
    // App must already be authorised (see safeAuthorise())
    _getMdHandle: function (appHandle) {
      self = this;

      let result = new Promise((resolve,reject) => {
        if (self.mdHandle){
          resolve(self.mdHandle);
        }
        else {
          window.safeApp.canAccessContainer(appHandle, '_public', ['Insert', 'Update', 'Delete'])
          .then((r) => {
            if (r) {
            RS.log('The app has been granted permissions for `_public` container');
            window.safeApp.getContainer(appHandle, '_public')
             .then((mdHandle) => {
               self.mdRoot = mdHandle;
               window.safeMutableData.emulateAs(self.mdRoot, 'NFS')
                 .then((nfsHandle) => {
                   self.nfsRoot = nfsHandle;
                   resolve(mdHandle); // Return mdHandle only if we have the
                                      // nfsHandle
                 }, (err) => { // mrhTODO how to handle in UI?
                   RS.log('SafeNetwork failed to access container');
                   RS.log(err);
                   window.safeMutableData.free(self.mdRoot);
                   self.mdRoot = null;
                   reject(null);
                 });
               });
            }
          },
          (err) => {
            RS.log('The app has been DENIED permissions for `_public` container');
            RS.log(err);
          });
        }
      });

      return result;
    },

    // Release all handles from the SAFE API
    freeSafeAPI: function (){
      // mrhTODO - confirm that freeing the appHandle frees all other handles
      if (this.appHandle) {
        window.safeApp.free(this.appHandle);
        this.appHandle = null;
        this.mdRoot = null;
        this.nfsRoot = null;
      }
    },


    configure: function (settings) {
      // We only update these when set to a string or to null:
      if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
      if (typeof settings.appHandle !== 'undefined') { this.appHandle = settings.appHandle; }

      var writeSettingsToCache = function() {
        if (hasLocalStorage) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            userAddress:    this.userAddress,
            /*
             * appHandle: this.appHandle, authUri: this.authUri, permissions:
             * this.permissions,
             */
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

      if (this.appHandle) {
        this.connected = true;
        this.permissions = settings.permissions;
        if (this.userAddress) {
          this._emit('connected');
// ??? mdh = this.getMdHandle(); // ???TEST

          writeSettingsToCache.apply(this);
          RS.log('SafeNetwork.configure() [CONNECTED-1]');
        } else {
          // mrhTODO if SN implements account names implement in
          // SafeNetwork.info:
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

      // mrhTODO: note dropbox connect calls hookIt() if it has a token - for
      // sync?
      // mrhTODO: note dropbox connect skips auth if it has a token - enables it
      // to remember connection across sessions
      // mrhTODO: if storing Authorization consider security risk - e.g. another
      // app could steal to access SAFE Drive?
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
      // - this backend was not already set in localStorage on load, *and*
      // - this backend doesn't do a redirect (page reload) after authorisation
      //
      // See: https://github.com/theWebalyst/remotestorage.js/issues/1#
      //
      if (this.rs.backend === 'safenetwork' && typeof this.rs._safenetworkOrigRemote === 'undefined') {
        this.rs._safenetworkOrigRemote = this.rs.remote;
        this.rs.remote = this.rs.safenetwork;
        this.rs.sync.remote = this.rs.safenetwork;

        // mrhTODO - this doesn't check that the event listener hasn't already
        // been installed - should it?

        // mrhTODO - hope fireReady() only matters in RS _init() (see below)

        if (rs.widget)
          rs.widget.initRemoteListeners();

        this.on('connected', function (){
          // fireReady();
          rs._emit('connected');
        });
        this.on('not-connected', function (){
          // fireReady();
          rs._emit('not-connected');
        });

        if (this.connected) {
          // fireReady();
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
      RS.log('safenetworkAuthorize()...');

      var self = this;
      self.appKeys = appApiKeys.app;

      // mrhTODOx ??? tokenKey = SETTINGS_KEY + ':appToken';

      let prom = window.safeApp.initialise(self.appKeys, (newState) => {
        RS.log("SafeNetwork state changed to: ", newState);
        });

      // mrhTODO debug code... NOW WORKING can tidy up (more like commented out
      // stuff below this block)
      prom = prom.then((appHandle) => {
        RS.log('SAFEApp instance initialised and appHandle returned: ', appHandle);

        let prom3 = window.safeApp.authorise(appHandle, self.appKeys.permissions, self.appKeys.options);

        prom3 = prom3.then((authUri) => {
          RS.log('SAFEApp was authorised and authUri received: ', authUri);
          let prom4 = window.safeApp.connectAuthorised(appHandle, authUri);


          prom4 = prom4.then(_ => {
            RS.log('SAFEApp was authorised & a session was created with the SafeNetwork');

              let prom5 = self._getMdHandle(appHandle)
              .then((mdHandle) => {
                if (mdHandle){
                  self.configure({
                    appHandle:      appHandle,                // safeApp.initialise()
                                                              // return
                                                              // (appHandle)
                    authURI:        authUri,                  // safeApp.authorise()
                                                              // return
                                                              // (authUri)
                    permissions:    self.appKeys.permissions, // Permissions
                                                              // used to request
                                                              // authorisation
                    options:        self.appKeys.options,     // Options used to
                                                              // request
                                                              // authorisation
                  });
                  RS.log('SAFEApp authorised and configured');
                }
              },
              _ => {
                RS.log('SAFEApp authorisation FAILED');
              });
          }, function (err){
            self.reflectNetworkStatus(false);
            RS.log('SAFEApp SafeNetwork Connect Failed: ' + err);
          });

        }, function (err){
          self.reflectNetworkStatus(false);
          RS.log('SAFEApp SafeNetwork Authorisation Failed: ' + err);
        });

      }, function (err){
          self.reflectNetworkStatus(false);
          RS.log('SAFEApp SafeNetwork Initialise Failed: ' + err);
      });
/*
 * original: window.safeApp.initialise(self.appKeys, (newState) => {
 * RS.log("SafeNetwork state changed to: ", newState); }).then((appHandle) => {
 * RS.log('SAFEApp instance initialised and appHandle returned: ', appHandle);
 *
 * window.safeApp.authorise(appHandle, self.appKeys.permissions,
 * self.appKeys.options) .then((authUri) => { RS.log('SAFEApp was authorised and
 * authUri received: ', authUri); window.safeApp.connectAuthorised(appHandle,
 * authUri) .then(_ => { RS.log('SAFEApp was authorised & a session was created
 * with the SafeNetwork');
 *
 * self.configure({ appHandle: appHandle, // safeApp.initialise() return
 * (appHandle) authURI: authUri, // safeApp.authorise() return (authUri)
 * permissions: self.appKeys.permissions, // Permissions used to request
 * authorisation options: self.appKeys.options, // Options used to request
 * authorisation });
 *
 * if (!self.getMdHandle()) { RS.log('getMdHandle() failed'); }
 *  }, function (err){ self.reflectNetworkStatus(false); RS.log('SAFEApp
 * SafeNetwork Connect Failed: ' + err); });
 *  }, function (err){ self.reflectNetworkStatus(false); RS.log('SAFEApp
 * SafeNetwork Authorisation Failed: ' + err); });
 *  }, function (err){ self.reflectNetworkStatus(false); RS.log('SAFEApp
 * SafeNetwork Initialise Failed: ' + err); });
 */
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
    get: function (path, options) {
      result = this._get(path, options);
      RS.log('get result: ' + result)
      return this._wrapBusyDone.call(this, result, "get", path);
    },

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
    // Spec:
    // https://github.com/remotestorage/spec/blob/master/release/draft-dejong-remotestorage-07.txt#L295-L296
    // See WireClient#put and _request for details of what is returned
    //
    //
    // mrhTODO bug: if the file exists (ie put is doing an update), contentType
    // is not updated
    // mrhTODO because it can only be set by _createFile (SAFE NFS API: POST)
    // mrhTODO FIX: when API stable, best may be to store contentType in the
    // file not as metadata
    // mrhTODO when API stable, best may be to store contentType in the file not
    // as metadata

    put: function (path, body, contentType, options) {        return this._wrapBusyDone.call(this, this._put(path, body, contentType, options), "put", path); },

    _put: function (path, body, contentType, options) {
      RS.log('SafeNetwork.put(' + path + ', ' + (options ? ( '{IfMatch: ' + options.IfMatch + ', IfNoneMatch: ' + options.IfNoneMatch + '})') : 'null)' ) );
      var fullPath = ( PATH_PREFIX + '/' + path ).replace(/\/+/g, '/');

      // putDone - handle PUT response codes, optionally decodes metadata from
      // JSON format response
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
            return putDone({ statusCode: 412 });    // Precondition failed
                                                    // (because entity exists,
                                                    // version irrelevant)
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

    // mrhTODO: delete bug - when the last file or folder in a folder is deleted
    // that folder
    // mrhTODO: must no longer appear in listings of the parent folder, and so
    // should
    // mrhTODO: be deleted from the SAFE NFS drive, and so on for its parent
    // folder as
    // mrhTODO: needed. This is not done currently.
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

        if ( fullPath.substr(-1) !== '/') {
//ODDBUG          return window.safeMutableData.getVersion(self.nfsRoot).then( function (containerVersion){

            RS.log('safeNfs.delete() param self.nfsRoot: ' + self.nfsRoot);
            RS.log('                 param fullPath: ' + fullPath);
            RS.log('                 param version: ' + fileInfo.version);
            RS.log('                 param containerVersion: ' + fileInfo.containerVersion);
            return window.safeNfs.delete(self.nfsRoot, fullPath, fileInfo.version + 1).then(function (success){
              // mrhTODO must handle: if file doesn't exist also do
              // self._fileInfoCache.delete(fullPath);

              self.reflectNetworkStatus(true);   // mrhTODO - should be true,
                                                  // unless 401 - Unauthorized

              if (success) {
                self._fileInfoCache.delete(fullPath);
                return Promise.resolve({statusCode: 200});
              } else {
                // mrhTODO - may need to trigger update of cached container info
                return Promise.reject('safeNFS deleteFunction("' + fullPath + '") failed: ' + success );
              }
            }, function (err){
              // mrhTODO - may need to trigger update of cached container info
              RS.log('REJECTING!!! deleteFunction("' + fullPath + '") failed: ' + err.message)
              return Promise.reject(err);
            });
//ODDBUG          }, function (err){
//ODDBUG            RS.log('REJECTING!!! safeMutableData.getVersion(...) failed: ' + err.message)
//ODDBUG            return Promise.reject(err);
//ODDBUG          });
        }
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
     * A promise to the user's account info
     */
    info: function () {        return this._wrapBusyDone.call(this, this._info(), "get", ''); },

    _info: function () {
      // Not yet implemented on SAFE, so provdie a default
      return Promise.resolve({accountName: 'SafeNetwork'});
    },

    OLD_updateFile: function (fullPath, body, contentType, options) {
      RS.log('SafeNetwork._updateFile(' + fullPath + ',...)' );
      var self = this;

      /*
       * mrhTODO GoogleDrive only I think... if
       * ((!contentType.match(/charset=/)) && (encryptedData instanceof
       * ArrayBuffer || RS.WireClient.isArrayBufferView(encryptedData))) {
       * contentType += '; charset=binary'; }
       */

      return window.safeNFS.createOrUpdateFile(self.token, fullPath, body, contentType, body.length, null, self.isPathShared).then(function (result) {
        // self._shareIfNeeded(fullPath); // mrhTODO what's this? (was part of
        // dropbox.js)

        var response = { statusCode: ( result ? 200 : 400  ) }; // mrhTODO
                                                                // currently
                                                                // just a
                                                                // response that
                                                                // resolves to
                                                                // truthy (may
                                                                // be extended
                                                                // to return
                                                                // status?)
        self.reflectNetworkStatus(true);

        self._fileInfoCache.delete(fullPath);     // Invalidate any cached eTag
        return Promise.resolve( response );
      }, function (err){
        self.reflectNetworkStatus(false);                // mrhTODO - should go
                                                          // offline for Unauth
                                                          // or Timeout
        RS.log('REJECTING!!! safeNFS.createOrUpdateFile("' + fullPath + '") failed: ' + err.message)
        return Promise.reject(err);
      });
    },

    _updateFile: function (fullPath, body, contentType, options) {
      RS.log('SafeNetwork._updateFile(' + fullPath + ',...)' );
      var self = this;

      /*
       * mrhTODO GoogleDrive only I think... if
       * ((!contentType.match(/charset=/)) && (encryptedData instanceof
       * ArrayBuffer || RS.WireClient.isArrayBufferView(encryptedData))) {
       * contentType += '; charset=binary'; }
       */
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (!fileInfo) {          // File doesn't exist. Ignore.
          self._fileInfoCache.delete(fullPath);     // Invalidate any cached
                                                    // eTag
          return Promise.resolve({statusCode: 200});
        }

        var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );
        if (ENABLE_ETAGS && options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
          return {statusCode: 412, revision: etagWithoutQuotes};
        }

        // Only act on file (directories are inferred, don't exist as objects so
        // no need to delete)
        if ( fullPath.substr(-1) === '/') {
          self._fileInfoCache.delete(fullPath);     // Directory - invalidate
                                                    // any cached eTag
        }
        else {
          return window.safeNfs.update(self.nfsRoot, fullPath, body, fileInfo.version).then(function (success){
            // mrhTODOx update file metadata (contentType) - how?

            self.reflectNetworkStatus(true);   // mrhTODO - should be true,
                                                // unless 401 - Unauthorized

            if (success) {
              self._fileInfoCache.delete(fullPath);     // Invalidate any cached
                                                        // eTag
              return Promise.resolve({statusCode: 200});
            } else {
              return Promise.reject('safeNfs.update("' + fullPath + '") failed: ' + success );
            }
          }, function (err){
            RS.log('REJECTING!!! safeNfs.update("' + fullPath + '") failed: ' + err.message)
            return Promise.reject(err);
          });
        }
      }, function (err){
        self.reflectNetworkStatus(false);
        RS.log('REJECTING!!! ' + err.message)
        return Promise.reject(err);
      });
    },

    _createFile: function (fullPath, body, contentType, options) {
      RS.log('SafeNetwork._createFile(' + fullPath + ',...)' );
      var self = this;
      var result = new Promise((resolve,reject) => {

/*
 * mrhTODOx DELETE
 *  // Ensure path exists by recursively calling create on parent folder return
 * self._makeParentPath(fullPath).then(function (parentPath) {
 */
        // Store file as immutable data. fileHandle is a raw pointer to the data
        // on network
        return window.safeNfs.create(self.nfsRoot, body).then(function (fileHandle) {
          // mrhTODOx set file metadata (contentType) - how?

          // Add the file (fileHandle) to the directory (inserts file pointer
          // into container)
          return window.safeNfs.insert(self.nfsRoot, fileHandle, fullPath).then(function (fileHandle) {
            // self._shareIfNeeded(fullPath); // mrhTODO what's this?

            var response = { statusCode: ( fileHandle ? 200 : 400  ) }; // mrhTODO currently just a response that resolves to truthy (may be exteneded to return status?)
            self.reflectNetworkStatus(true);

            // mrhTODO Not sure if eTags can still be simulated:
            // mrhTODO would it be better to not delte, but set the fileHandle
            // in the fileInfo?
            self._fileInfoCache.delete(fullPath);     // Invalidate any cached
                                                      // eTag

            return resolve(response);
          }, function (err){
            self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
            RS.log('REJECTING!!! safeNfs.insert("' + fullPath + '") failed: ' + err.message)
            return reject(err);
          });
        }, function (err){
          self.reflectNetworkStatus(false);                // mrhTODO - should
                                                            // go offline for
                                                            // Unauth or Timeout
          RS.log('REJECTING!!! safeNfs.create("' + fullPath + '") failed: ' + err.message)
          return reject(err);
        });
// DELETE }, function (err){
// RS.log('REJECTING!!! _makeParentPath("' + fullPath + '") failed: ' +
// err.message)
// return Promise.reject(err);
// });
      });

      return result;
    },

    // For reference see WireClient#get (wireclient.js)
    _getFile: function (fullPath, options) {
      RS.log('SafeNetwork._getFile(' + fullPath + ', ...)' );
      if (! this.connected) { return Promise.reject("not connected (fullPath: " + fullPath + ")"); }
      var revCache = this._revCache;
      var self = this;

      // Check if file exists by obtaining directory listing if not already cached
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (!fileInfo){
          Promise.resolve({statusCode: 404});   // File does not exist (mrhTODO should this reject?)
        }

        var etagWithoutQuotes = fileInfo.ETag; // mrhTODO don't need this I
                                                // think: ( fileInfo.ETag &&
                                                // typeof(fileInfo.ETag) ===
                                                // 'string' ? fileInfo.ETag :
                                                // undefined );

        // Request is only for changed file, so if eTag matches return "304 Not
        // Modified"
        // mrhTODO strictly this should be asked of SAFE API, but until
        // versioning supported, we cache last eTags
        if (ENABLE_ETAGS && options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
          return Promise.resolve({statusCode: 304});
        }

        return window.safeNfs.fetch(self.nfsRoot, fullPath)
          .then((fileHandle) => {
            RS.log('fetched fileHandle: ' + fileHandle.toString());
            self.fileHandle = fileHandle; // mrhTODOx need setter to compare & free if new fileHandle
            return window.safeNfs.open(self.nfsRoot,fileHandle,4/* read */)
            .then((fileHandle) => {
              RS.log('safeNfs.open() returns fileHandle: ' + fileHandle.toString());
              self.openFileHandle = fileHandle;
              return window.safeNfsFile.size(self.openFileHandle)
            .then((size) => {
              RS.log('safeNfsFile.size() returns size: ' + size.toString());
              return window.safeNfsFile.read(self.openFileHandle,0,size)
            .then((content) => {
              RS.log(content.byteLength + ' bytes read from file.');

              decoder = new TextDecoder();
              data = decoder.decode(content);
              RS.log('data: "' + data + '"');

              /* SAFE NFS API file-metadata - disabled for now: var fileMetadata = response.getResponseHeader('file-metadata'); if (fileMetadata && fileMetadata.length() > 0){ fileMetadata = JSON.parse(fileMetadata); } RS.log('..file-metadata: ' + fileMetadata);*/
              // Refer to baseclient.js#getFile for retResponse spec (note getFile header comment wrong!)
              var retResponse = {
                statusCode: 200,
                body: data,
                /*body: JSON.stringify(data),*/     // mrhTODO not sure stringify() needed, but without it RS.local copies of nodes differ when loaded from SAFE
                                                // mrhTODO RS ISSUE:  is it a bug that RS#get accepts a string *or an object* for body? Should it only accept a string?
                revision: etagWithoutQuotes,
              };

              retResponse.contentType = 'application/json; charset=UTF-8';   // mrhTODO googledrive.js#put always sets this type, so farily safe default until SAFE NFS supports save/get of content type

              if (fileInfo && fileInfo['Content-Type'] ){
                retResponse.contentType = fileInfo['Content-Type'];
              }

              self.reflectNetworkStatus(true);
              return Promise.resolve( retResponse );
            }, function (err){
              self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
              RS.log('REJECTING!!! safeNfs get file: "' + fullPath + '" failed: ' + err.message)
              return Promise.reject({statusCode: 404}); // mrhTODO can we get statusCode from err?
          });
        }, function (err){
          RS.log('REJECTING!!! ' + err.message);  // mrhTODO - MAYBE go offline (see above)
          return Promise.reject(err);
        });
      }, function (err){
        RS.log('REJECTING!!! ' + err.message);  // mrhTODO - MAYBE go offline (see above)
        return Promise.reject(err);
      });
    }, function (err){
      RS.log('REJECTING!!! ' + err.message);  // mrhTODO - MAYBE go offline (see above)
      return Promise.reject(err);
    });
      }, function (err){
        RS.log('REJECTING!!! ' + err.message);    // mrhTODO - MAYBE go offline (see above)
        return Promise.reject(err);
      });
    },

    // _getFolder - obtain folder listing and create parent folder(s) if absent
    //
    // For reference see WireClient#get (wireclient.js) summarised as follows:
    // - parse JSON (spec example:
    // https://github.com/remotestorage/spec/blob/master/release/draft-dejong-remotestorage-07.txt#L223-L235)
    // - return a map of item names to item object mapping values for "Etag:",
    // "Content-Type:" and "Content-Length:"
    // - NOTE: googledrive.js only provides ETag, safenetwork.js provides ETag,
    // Content-Length but not Content-Type
    // - NOTE: safenetwork.js ETag values are faked (ie not provided by
    // launcher) but functionally adequate

    _getFolder: function (fullPath, options) {
      RS.log('SafeNetwork._getFolder(' + fullPath + ', ...)' );
      var self = this;

      let result = new Promise((resolve,reject) => {
        // mrhTODO folders are implied, so this comment needs altering if I keep this call:
        // Check if folder exists. Create parent folder if parent doesn't exist
        return self._getFileInfo(fullPath).then(function (fileInfo) {
          var query, fields, data, i, etagWithoutQuotes, itemsMap;
          if (!fileInfo) {
            return resolve({statusCode: 404}); // mrhTODO should this reject?
          }

          // Just list as a test / mrhTODO remove:
          // window.safeMutableData.getEntries(self.mdRoot)
          // .then((entriesHandle) => window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
          //     RS.log('Key: ', k.toString());
          //     RS.log('Value: ', v.buf.toString('base64') );
          //     RS.log('Version: ', v.version);
          //   }).then(_ => RS.log('Iteration finished'))
          // );

          window.safeMutableData.getVersion(self.mdRoot).then((rootVersion) => {

            var folderETagWithoutQuotes = fullPath + '-v' + rootVersion;
            RS.log('..folder eTag: ' + folderETagWithoutQuotes);

    // mrhTODOx: folderMetadata (also file metadata - see below)
            var folderMetadata = {};
            /*
             * mrhTODO: SAFE containers (top level) may have useful metadata,
             * but folders are inferred and not objects, so except for the top
             * level there's nothing to insert here and for now I'm going to
             * ignore it.
             *
             * if ( body.info.metadata ){ folderMetadata = body.info.metadata; }
             */
            folderMetadata.ETag = folderETagWithoutQuotes;
            RS.log('..folder metadata: ' + JSON.stringify(folderMetadata));

            // Create listing by enumerating container keys beginning with
            // fullPath
            var listing = {};
            window.safeMutableData.getEntries(self.mdRoot)
            .then((entriesHandle) => window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {

      if (k.toString() == '/remotestorage/myfavoritedrinks/whiskey'){
        RS.log('THE ONE!');
      }
      // Skip deleted entries
      if (v.buf.length == 0){
        return true;  // Nexxt
      }
                RS.log('Key: ', k.toString());
                RS.log('Value: ', v.buf.toString('base64') );
                RS.log('Version: ', v.version);
                RS.log('containerVersion: ', rootVersion);
                var dirPath = fullPath;
                if (dirPath.slice(-1) != '/')
                  dirPath += '/';

                key = k.toString();
                if (key.length > dirPath.length && key.substr(0,dirPath.length) == dirPath) {
                  var remainder = key.slice(dirPath.length);
                  var name = remainder // File name will be up to but excluding first '/'

                  var firstSlash = remainder.indexOf('/');
                  if (firstSlash != -1) {
                    name = remainder.slice(0,firstSlash); // Directory name with trailing '/'
                  }

                  // Add file/directory info to cache and for return as listing
                  var fullItemPath = dirPath + name;

                  // mrhTODO: Until SAFE API supports eTags make them manually:
                  // mrhTODO: any ASCII char except double quote: https://tools.ietf.org/html/rfc7232#section-2.3
                  var eTagWithoutQuotes = fullItemPath + '-v' + v.version; /* mrhTODO ??? + '-' + intem.createdOn + '-' + item.modifiedOn + '-' + item.size */

                  // Add file info to cache
                  var fileInfo = {
                    fullPath:   fullItemPath, // Used by _fileInfoCache() but nothing
                    version:    v.version,
                    containerVersion: rootVersion,

                    // Remaining members must pass RS.js test: sync.js#corruptServerItemsMap()
                    ETag:       eTagWithoutQuotes,
                  };

                  if (firstSlash == -1) {
                    // Files only (not directories) have metadata:
                    var metadata; // mrhTODO ??? - obtain this?
                    metadata = { mimetype: 'application/json; charset=UTF-8' };  // mrhTODO fake it until implemented - should never be used
    // mrhTODOx add in get file size - or maybe leave this unset, and set it
    // when getting the file?
                    fileInfo['Content-Length'] = 123456; // mrhTODO: item.size,
                    fileInfo['Content-Type'] = metadata.mimetype;  // metadata.mimetype currently faked (see above) mrhTODO see next
                  }

                  self._fileInfoCache.set(fullItemPath, fileInfo);
                  RS.log('..._fileInfoCache.set(file: ' + fullItemPath  + ')' );
                  RS.log('Listing: ', name);
                  listing[name] = fileInfo;
                }
            }).then(_ => {
              RS.log('Iteration finished')
              RS.log('SafeNetwork._getFolder(' + fullPath + ', ...) RESULT: lising contains ' + JSON.stringify( listing ) );
              return resolve({statusCode: 200, body: listing, meta: folderMetadata, contentType: RS_DIR_MIME_TYPE/*, mrhTODOx revision: folderETagWithoutQuotes*/ });
            }, function (err){
              self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
              RS.log('safeNfs.getEntries("' + fullPath + '") failed: ' + err.status );
              // var status = (err == 'Unauthorized' ? 401 : 404); // mrhTODO
              // ideally safe-js would provide response code (possible enhancement)
              if (err.status === undefined)
                  err.status = 401; // Force Unauthorised, to handle issue in safe-js:

              if (err.status == 401){
                // Modelled on how googledrive.js handles expired token
                if (self.connected){
                  self.connect();
                  return resolve({statusCode: 401}); // mrhTODO should this reject
                }
              }
              return reject({statusCode: err.status});
            }));

            // mrhTODOx DELETE (moved above)
            // RS.log('SafeNetwork._getFolder(' + fullPath + ', ...) RESULT: lising contains ' + JSON.stringify( listing ) );
            // return resolve({statusCode: 200, body: listing, meta: folderMetadata, contentType: RS_DIR_MIME_TYPE/*, mrhTODOx revision: folderETagWithoutQuotes*/ });
          }, function (err){
            RS.log('safeMutableData.getVersion("' + fullPath + '") failed: ' + err)
            return reject(err);
          });
        }, function (err){
          RS.log('_getFileInfo("' + fullPath + '") failed: ' + err)
          return reject(err);
        });

      });

      return result;
    },

    /*
     * mrhTODO remove previous IMP: // mrhTODO change getDir to listLongNames on
     * API update ??? RS.log('safeNFS.getDir(token, ' + fullPath + ',
     * isPathShared = ' + self.isPathShared + ')' ); return
     * window.safeNFS.getDir(self.token, fullPath,
     * self.isPathShared).then(function (body) {
     *
     * self.reflectNetworkStatus(true); var listing, listingFiles,
     * listingSubdirectories, mime, rev; if (body.info) { var
     * folderETagWithoutQuotes = fullPath + '-' + body.info.createdOn + '-' +
     * body.info.modifiedOn; RS.log('..folder eTag: ' +
     * folderETagWithoutQuotes);
     *
     * var folderMetadata = {}; if ( body.info.metadata ){ folderMetadata =
     * body.info.metadata; } folderMetadata.ETag = folderETagWithoutQuotes;
     * RS.log('..folder metadata: ' + JSON.stringify(folderMetadata));
     *
     * listingFiles = body.files.reduce(function (m, item) { var fullItemPath =
     * fullPath + item.name;
     *
     *
     * var metadata; // mrhTODO compact next few lines if ( item.metadata.length >
     * 0 ) { metadata = JSON.parse(metadata); } else { metadata = { mimetype:
     * 'application/json; charset=UTF-8' }; // mrhTODO fake it until implemented -
     * should never be used }
     *  // mrhTODO: Until SAFE API supports eTags make them manually: //
     * mrhTODO: any ASCII char except double quote:
     * https://tools.ietf.org/html/rfc7232#section-2.3 var eTagWithoutQuotes =
     * fullItemPath + '-' + item.createdOn + '-' + item.modifiedOn + '-' +
     * item.size;
     *  // Add file info to cache var fileInfo = { fullPath: fullItemPath, //
     * Used by _fileInfoCache() but nothing else
     *  // Remaining members must pass RS.js test:
     * sync.js#corruptServerItemsMap() ETag: eTagWithoutQuotes,
     * 'Content-Length': item.size, 'Content-Type': metadata.mimetype, //
     * metadata.mimetype currently faked (see above) mrhTODO, see next };
     *
     * self._fileInfoCache.set(fullItemPath, fileInfo);
     * RS.log('..._fileInfoCache.set(file: ' + fullItemPath + ')' );
     * m[item.name] = fileInfo; return m; }, {});
     *
     * listingSubdirectories = body.subDirectories.reduce(function (m, item) {
     * var fullItemPath = fullPath + item.name + '/';
     *  // mrhTODO until SAFE API supports eTags make them manually: // Create
     * eTag manually (any ASCII char except double quote:
     * https://tools.ietf.org/html/rfc7232#section-2.3) var eTagWithoutQuotes =
     * fullItemPath + '-' + item.createdOn + '-' + item.modifiedOn;
     *  // Add file info to cache var fileInfo = { fullPath: fullItemPath, ETag:
     * eTagWithoutQuotes, };
     *
     * self._fileInfoCache.set(fullItemPath, fileInfo);
     * RS.log('..._fileInfoCache.set(directory: ' + fullItemPath + ')' );
     * m[item.name + '/'] = fileInfo; return m; }, {});
     *  // Merge into one listing var listing = {}; for (var attrname in
     * listingFiles) { listing[attrname] = listingFiles[attrname]; } for (var
     * attrname in listingSubdirectories) { listing[attrname] =
     * listingSubdirectories[attrname]; } }
     */
// mrhTODOx maybe now can call _getFileInfo() instead (because directories don't
// need to be created)

    // Ensure fullPath exists by recursively calling _createFolder if the parent
    // doesn't exist

/*  _makeParentPath: function (fullPath) {
    RS.log('SafeNetwork._makeParentPath(' +  fullPath + ')' );

    var parentFolder = parentPath(fullPath);
    var self = this;

      return self._getFileInfo(parentFolder).then(function (parentInfo) {
        if (parentInfo) {
        return Promise.resolve(parentInfo);
        }
        else {
          return self._createFolder(parentFolder);
          }
        }, function (err){
          RS.log('REJECTING!!! ' + err.message)
          return Promise.reject(err);
        });
    },
*/
  /*
     * mrhTODOx DELETE - folders are inferred from paths and don't exist as
     * objects
     *  // Folders are inferred, so for now I've just neutered _createFolder //
     * mrhTODO remove it unless useful to help build fileInfo? _createFolder:
     * function (folderPath) { RS.log('SafeNetwork._createFolder(' + folderPath +
     * ')' ); var self = this;
     *
     * var userMetadata = "";
     *  /* mrhTODOx - folders don't exist so fake the tree in fileInfoCache
     *  // Recursively create parent folders return
     * self._makeParentPath(folderPath).then(function (parentInfo) { // Parent
     * exists so create 'folderPath'
     *
     * //mrhTODO var needsMetadata = options && (options.ifMatch ||
     * (options.ifNoneMatch === '*')); //mrhTODO the above line is not in the
     * googledrive.js version (must be from my port of dropbox.js) response =
     * true;//WAS: ??? return window.safeNFS.createDir(self.token, folderPath,
     * self.isPrivate, self.userMetadata, self.isPathShared).then(function
     * (response) { // self._shareIfNeeded(folderPath); // mrhTODO what's this?
     * (was part of dropbox.js) self.reflectNetworkStatus(true); return
     * Promise.resolve(response); //}, function (err){ //
     * self.reflectNetworkStatus(false); // mrhTODO - should go offline for
     * Unauth or Timeout // RS.log('safeNFS.createDir("' + folderPath + '")
     * failed: ' + err.message) // return Promise.reject({statusCode: 404}); //
     * mrhTODO can we get statusCode from err? });
     *  /* }, function (err){ RS.log('_makeParentPath("' + folderPath + '")
     * failed: ' + err.message) return Promise.reject(err); });
     *  },
     */

    // mrhTODO review and fix all these function headers

    // _getFileInfo() - check if file exists and create parent folder if
    // necessary
    //
    // Checks if the file/folder (fullPath) is in the _fileInfoCache(), and if
    // not found
    // obtains a parent folder listing to check if it exists. Causes update of
    // _fileInfoCache
    // with contents of its parent folder.
    //
    // If the parent folder does not exist it will be created as a side effect,
    // so this
    // function can be used to check if a file exists before creating or
    // updating its content.
    //
    // RETURNS
    // Promise() with
    // if a file { path: string, ETag: string, 'Content-Length': number }
    // if a folder { path: string, ETag: string }
    // if root '/' { path: '/' ETag }
    // or {} if file/folder doesn't exist
    // See _getFolder() to confirm the above content values (as it creates
    // fileInfo objects)
    //
    // Note:
    // if the parent folder doesn't exist it will be created
    //
    _getFileInfo: function (fullPath) {
      RS.log('SafeNetwork._getFileInfo(' + fullPath + ')' );

      var self = this;
      let result = new Promise((resolve,reject) => {

        if (fullPath === '/' ) {
          return resolve({ path: fullPath, ETag: 'root' }); // Dummy fileInfo to
                                                            // stop at "root"
        }
        /*
         * mrhTODOx DELETE folders don't exist so aren't in the cache else if
         * ((info = self._fileInfoCache.get(fullPath))) { return
         * Promise.resolve(info); // If cached we believe it exists }
         */

        if (info = self._fileInfoCache.get(fullPath)){
          return resolve(info);
        }

        // Not yet cached or doesn't exist
        // Load parent folder listing update _fileInfoCache.
        window.safeMutableData.getVersion(self.mdRoot).then((rootVersion) => {

          if (fullPath.substr(-1) === '/') {    // folder, so fake its info
            var eTagWithoutQuotes = fullPath + '-v' + rootVersion;

            // Add file info to cache
            var fileInfo = {
              fullPath:   fullPath, // Used by _fileInfoCache() but nothing else
              version:    rootVersion,

              // Remaining members must pass RS.js test:
              // sync.js#corruptServerItemsMap()
              ETag:       eTagWithoutQuotes,
            };

            self._fileInfoCache.set(fullPath, fileInfo);
            return resolve(fileInfo);
          }

          self._getFolder(parentPath(fullPath)).then(_ => {
            if (info = self._fileInfoCache.get(fullPath)){
              return resolve(info);
            }
            else {                                // file, doesn't exist
              RS.log('_getFileInfo(' + fullPath + ') file does not exist, no fileInfo available ')
              return resolve(null);
            }
          }, (err) => {
            RS.log('_getFileInfo(' + fullPath + ') failed to get parent directory of file ')
            return resolve(null);
          });

        }, function (err){
          RS.log('safeMutableData.getVersion() FAILED: ' + err)
          return reject(err);
        });
      });

      return result;
    }
  };

  // mrhTODO see dropbox version - probably need to modify this in line with
  // that (check with RS team)
  // differences are:
  // 1) config.clientId not present - removed this from this file
  // 2) it uses hookIt() (and in _rs_cleanup() unHookIt()) instead of inline
  // assignements
  // which causes dropbox version to also call hookSync() and hookGetItemURL()
  //
  // mrhTODO re-above, also need to check if app calling setAPIKeys for multiple
  // backends breaks this
  // mrhTODO and may cause problems with starting sync?
  // mrhTODO Maybe the hookIt stuff in Dropbox allows chaining, but not yet in
  // GD or SN?
  //

  RS.SafeNetwork._rs_init = function (remoteStorage) {
    hasLocalStorage = RemoteStorage.util.localStorageAvailable();

    var config = remoteStorage.apiKeys.safenetwork;
    if (config) {
      remoteStorage.safenetwork = new RS.SafeNetwork(remoteStorage, config);
      if (remoteStorage.backend === 'safenetwork' && remoteStorage.remote !== remoteStorage.safenetwork) {
        remoteStorage._safenetworkOrigRemote = remoteStorage.remote;
        remoteStorage.remote = remoteStorage.safenetwork;
      }
    }
  };

  RS.SafeNetwork._rs_supported = function (rs) {
    return true;
  };

  // mrhTODO see dropbox version
// mrhTODOx make safeNfs changes - should probably call method to free SAFE DOM
// objects?
  RS.SafeNetwork._rs_cleanup = function (remoteStorage) {
    if (remoteStorage.safenetwork)
      remoteStorage.safenetwork.freeSafeAPI();

    remoteStorage.setBackend(undefined);
    if (remoteStorage._safenetworkOrigRemote) {
      remoteStorage.remote = remoteStorage._safenetworkOrigRemote;
      delete remoteStorage._safenetworkOrigRemote;
    }
  };

})(this);
