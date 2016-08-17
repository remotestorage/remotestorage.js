// mrhTODO - DONE: have fudged (HacketyHack) code to work so can probe put/get
// mrhTODO - DONE: manually apply https://github.com/remotestorage/remotestorage.js/commit/2ed78fbe17bf3c1d16a9c241d1900f3db9f95b9e
// mrhTODO          Strangely, this seemed to introduced CORS errors in the browser console output once I have an auth token!
// mrhTODO          This appears to be due to the change in the URL to a longer path! If I change PATH_PREFIX back to '/' it reverts.
// mrhTODO -> TEST: disableCache: ignore rev cache pending SAFE API (let all calls through to server - fairly ok since no shared access, but not robust)
// mrhTODO - DONE: log calls/paths for put: get: delete: (and response?) 
// mrhTODO - DONE SAFE uses POST to create an EMPTY FILE
// mrhTODO - DONE    so use POST to create, and PUT to store content
// mrhTODO - DONE Get to point where I can see that POST creates a file with good content
// mrhTODO STATUS: 
// mrhTODO - put/get seem to work provided the parent directory exists, so...
// mrhTODO   make it with: safe mkdir -vs /myfavoritedrinks
// mrhTODO   monitor with: while (true) do  clear; safe ls -s /myfavoritedrinks ; sleep 1; done
// mrhTODO
// mrhTODO - I currently need to manually create app direcotry (e.g. /myfavoritedrinks)
// mrhTODO - PATH_PREFIX is temporary shortened to '/'
// mrhTODO - I'm not trying to do any versioning (might follow code in googledrive.js)?
// mrhTODO - I'm not using any caching (have disabled in this code)
// mrhTODO - some issues with widget and connection status and errors in console() log
// mrhTODO - Above committed and tagged: apiworking-01-encrypted
// mrhTODO
// mrhTODO - DONE: research (db/gd?) & implement creation of path if parent not exist
// mrhTODO          Dropbox creates folders automatically, Googledrive does not, and googledrive.js code looks close to what I need
// mrhTODO NEXT:    create safestore.js anew, using encapsulated raw SAFE API calls rather than having inline requests as in googledrive.js
// mrhTODO NEXT: consider- try to sort out the issues from console output (including with widget?)
// mrhTODO NEXT: consider- port the googledrive.js code _getFile() etc which has a cache of file ids and creates when file or parent folders don't exist
// mrhTODO NEXT: consider- simulate versioning using file metadata 
// mrhTODO NEXT:              until SAFE implements this in API
// mrhTODO - MAYBE: fixup the connect/disconnect so they work and reflect in the widget
// mrhTODO - look at how Dropbox overrides BaseClient getItemURL and consider for safestore.js
// mrhTODO   (see https://github.com/remotestorage/remotestorage.js/blob/master/src/dropbox.js#L16-L17)
// mrhTODO
// mrhTODO - review isPrivate / isPathShared values, maybe make App configurable (part of setApiKeys (rename?)
// mrhTODO 
// mrhTODO encryption: wait until Launcher drops this then remove libsodium from build
// mrhTODO             -> Update compoonents.json, package.json, clean up lib/, remove bower_components/
  
// mrhTODO check if these are stricly needed and..
// mrhTODO if so add to RS npm install tweetnacl base64-js

// mrhTODO ensure build/components.json includes the required dependencies:
// mrhTODO as per MaidSafe example for now...
// mrhTODO npm install libsodium-wrappers request
// mrhTODO switch from 'request' to XMLHtmlRequest and remove 'request' from build/components.json

// mrhTODO RS plan to move all to https://github.com/stefanpenner/es6-promise
// mrhTODO so I need to co-ordinate with that.

// mrhTODO document ApiKeys - these are settings configured by the App call to RemoteStorage.setApiKeys():
/*    remoteStorage.setApiKeys('safestore', 
        {   
            // For details see SAFE Launcher /auth JSON API
            app: {
                name: 'RemoteStorage Demo',     // Your app name etc.
                version: '0.0.1',
                vendor: 'remoteStorage',
                id: 'org.remotestorage.rsdemo'  // Identifies stored data (unique per vendor)
            },
            permissions: ['SAFE_DRIVE_ACCESS']  // List of permissions to request. On authorisation, 
                                                // holds permissions granted by user
        }
*/

var binary = require('bops');
var httpRequest = require('request');   // mrhTODO - can remove this (now uses XMLHttpRequest)

LAUNCHER_URL = 'http://localhost:8100'; // Client device must run SAFE Launcher: provides localhost REST API

(function (global) {
  var RS = RemoteStorage;
  var disableCache = true; // mrhTODO - hack to cause revCache to be ignored - all requests go through

  /**
   * File: Safestore
   * 
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   * 
   * SAFE Network backend for RemoteStorage.js mrhTODO: ??? This file exposes a
   * get/put/delete interface which is compatible with
   * <RemoteStorage.WireClient>.
   * 
   * When remoteStorage.backend is set to 'safestore', this backend will
   * initialize and replace remoteStorage.remote with remoteStorage.safestore.
   * 
   * mrhTODO: ??? In order to ensure compatibility with the public folder,
   * <BaseClient.getItemURL> gets hijacked to return the Dropbox public share
   * URL.
   * 
   * mrhTODO: ??? To use this backend, you need to specify the Dropbox app key
   * like so:
   * 
   * (start code)
   * 
   * remoteStorage.setApiKeys('safestore', { appKey: 'your-app-key' });
   * 
   * (end code)
   * 
   * mrhTODO: ??? An app key can be obtained by registering your app at
   * https://www.dropbox.com/developers/apps
   * 
   * mrhTODO: ??? Known issues:
   *  - Storing files larger than 150MB is not yet supported - Listing and
   * deleting folders with more than 10'000 files will cause problems -
   * Content-Type is not fully supported due to limitations of the Dropbox API -
   * Dropbox preserves cases but is not case-sensitive - getItemURL is
   * asynchronous which means getIetmURL returns useful values after the
   * syncCycle
   */

  // mrhTODO: everything below this!
  // mrhTODO: add regression tests in test/unit/safestore-suite.js
  
  // mrhTODO: this...
  var hasLocalStorage;
  var SETTINGS_KEY = 'remotestorage:safestore';
  var cleanPath = RS.WireClient.cleanPath;
  var PATH_PREFIX = '/'; // '/remotestorage';
  
  var encodeQuery = function (obj) {
    var pairs = [];
  
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
      }
    }
  
    return pairs.join('&');
  };
  
  // mrhTODO: 1) Dropbox ignores case. SAFE uses it, so LowerCaseCache breaks Safestore
  // mrhTODO: 2) Versioning (eg ETags currently not implemented in SAFE) so need to do without for now
  
  /**
   * class: LowerCaseCache
   * 
   * A cache which automatically converts all keys to lower case and can
   * propagate changes up to parent folders.
   * 
   * By default the set and delete methods are aliased to justSet and
   * justDelete.
   * 
   * Parameters:
   * 
   * defaultValue - the value that is returned for all keys that don't exist in
   * the cache
   */
  // mrhTODO: this...
  function LowerCaseCache(defaultValue){
    this.defaultValue = defaultValue;
    this._storage = { };
    this.set = this.justSet;
    this.delete = this.justDelete;
  }

  // mrhTODO: this...
  LowerCaseCache.prototype = {
    /**
     * Method: get
     * 
     * Get a value from the cache or defaultValue, if the key is not in the
     * cache.
     */
    get : function (key) {
      key = key.toLowerCase();
      var stored = this._storage[key];
      if (typeof stored === 'undefined'){
        stored = this.defaultValue;
        this._storage[key] = stored;
      }
      return stored;
    },

    /**
     * Method: propagateSet
     * 
     * Set a value and also update the parent folders with that value.
     */
    // mrhTODO: this...
    propagateSet : function (key, value) {
      key = key.toLowerCase();
      if (this._storage[key] === value) {
        return value;
      }
      this._propagate(key, value);
      this._storage[key] = value;
      return value;
    },

    /**
     * Method: propagateDelete
     * 
     * Delete a value and propagate the changes to the parent folders.
     */
    // mrhTODO: this...
    propagateDelete : function (key) {
      key = key.toLowerCase();
      this._propagate(key, this._storage[key]);
      return delete this._storage[key];
    },

    // mrhTODO: this...
    _activatePropagation: function (){
      this.set = this.propagateSet;
      this.delete = this.propagateDelete;
      return true;
    },

    /**
     * Method: justSet
     * 
     * Set a value without propagating.
     */
    // mrhTODO: this...
    justSet : function (key, value) {
      key = key.toLowerCase();
      this._storage[key] = value;
      return value;
    },

    /**
     * Method: justDelete
     * 
     * Delete a value without propagating.
     */
    // mrhTODO: this...
    justDelete : function (key, value) {
      key = key.toLowerCase();
      return delete this._storage[key];
    },

    // mrhTODO: this...
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

  // mrhTODO: this...
  var onErrorCb;

  /**
   * Class: RemoteStorage.Safestore
   */
  // mrhTODO: this...
  RS.Safestore = function (rs) {

    this.rs = rs;
    this.connected = false;
    this.nacl = sodium;

    var self = this;

    onErrorCb = function (error){
      if (error instanceof RemoteStorage.Unauthorized) {

    	// mrhTODO store auth info here (e.g. token, safeURL?) - CHECK API: WireClient.configure 
    	  
    	// Delete all the settings - see the documentation of
        // wireclient.configure
        self.configure({
          // mrhTODO can probably eliminate all these - check if any apply to SAFE backend first
          userAddress: null,	// webfinger style address (username@server)
          href: null,			// server URL from webfinger
          storageApi: null,		// remoteStorage API dependencies in here (safestore.js), not server, so hardcode?
          
          options: null,        // http request headers - maybe Dropbox only?
            
          // SAFE Launcher auth response:
          token: null,
          permissions: null,    // List of granted SAFE Network access permssions (e.g. 'SAFE_DRIVE_ACCESS')
          symetricKeyBase64: null,    
          symetricNonceBase64: null,
        });
      }
    };

    RS.eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');
    rs.on('error', onErrorCb);

    // mrhTODO purge unused settings like clientId...
    //this.clientId = rs.apiKeys.safestore.appKey;
    this._revCache = new LowerCaseCache('rev');
    this._itemRefs = {};
    this._metadataCache = {};

  if (hasLocalStorage){
    var settings;
    try {
      settings = JSON.parse(localStorage[SETTINGS_KEY]);
    } catch(e){}
    if (settings) {
      this.configure(settings);
    }
    try {
      this._itemRefs = JSON.parse(localStorage[ SETTINGS_KEY+':shares' ]);
    } catch(e) {  }
  }
  
    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.Safestore.prototype = {
    online: true,
    isPathShared: true,        // App private storage mrhTODO shared or private? app able to control?
    launcherUrl: LAUNCHER_URL,  // Can be overridden by App
    assymetricKeys: null,       // For encrypted communications
    nonce: null,                // with SAFE Launcher

    ////////// mrhTODO PORTING TO Wireclient.lrequrest / XMLHttpResponse
    //
    // mrhTODO code in progress: Promise based REST auth and request handling

    //mrhTODO current status:
    //- authorize seems to work, but once it has stored a token I end up in a mess
    //  with various things failing so I think I to console: localStorage.clear()
    //- I do also sometimes get an exception ??? about options.special?
    //- Maybe also temporarily disable saving the token (so it always goes to auth?)
    safestoreAuthorize: function (appApiKeys) {
      var self = this;

      // Session data
      var nacl = RS.Safestore.nacl = sodium;
      RS.Safestore.assymetricKeys = nacl.crypto_box_keypair();                // Generate Assymetric Key pairs
      RS.Safestore.nonce = nacl.randombytes_buf(nacl.crypto_box_NONCEBYTES);  // Generate random Nonce
      this.launcherUrl = LAUNCHER_URL;
      // App can override url by setting appApiKeys.laucherURL
      if ( typeof appApiKeys.launcherURL !== 'undefined' ) { this.launcherUrl = appApiKeys.launcherURL;  }
      // JSON string ("payload") for POST
      this.payload = appApiKeys;     // App calls setApiKeys() to configure persistent part of "payload"
      // For this session only
      this.payload.publicKey = binary.to(RS.Safestore.assymetricKeys.publicKey,'base64');
      this.payload.nonce = binary.to(RS.Safestore.nonce,'base64');

      // The request...
      var options = {
        url: this.launcherUrl + '/auth',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.payload)
      };
      
      // POST
      return RS.WireClient.request.call(this, 'POST', options.url, options).then(function (xhr) {    
        // Launcher responses
        // 401 - Unauthorized
        // 400 - Fields are missing
        if (xhr && (xhr.status === 400 || xhr.status == 401) ) {
          return Promise.resolve({statusCode: xhr.status});
        } else {
          var response = JSON.parse(xhr.responseText);
          // The encrypted symmetric key received as base64 string is converted to Uint8Array
          var cipherText = binary.from(response.encryptedKey, 'base64');
          var replayCipherText = binary.to(cipherText, 'base64');
          // The asymmetric public key of launcher received as base64 string is converted to Uint8Array
          var publicKey = binary.from(response.publicKey, 'base64');
          var replaypublicKey = binary.to(publicKey, 'base64');
          // the cipher message is decrypted using the asymmetric private key of application and the public key of launcher
          var data = RS.Safestore.nacl.crypto_box_open_easy(cipherText, RS.Safestore.nonce, publicKey, RS.Safestore.assymetricKeys.privateKey);

          // The first segment of the data will have the symmetric key
          var symmetricKey = data.slice(0, RS.Safestore.nacl.crypto_secretbox_KEYBYTES);
          // The second segment of the data will have the nonce to be used
          var symmetricNonce = data.slice(RS.Safestore.nacl.crypto_secretbox_KEYBYTES);
    
          // Save session info
          self.configure({ 
              token:                response.token,        // Auth token
              permissions:          response.permissions,  // List of permissions approved by the user
              symmetricKeyBase64:   binary.to(symmetricKey,'base64'),   
              symmetricNonceBase64: binary.to(symmetricNonce,'base64'),
            });
          
          return Promise.resolve(xhr);
        }
      });
    },
    
    /**
     * Method: connect
     * 
     * Set the backed to 'safestore' and start the authentication flow in order
     * to obtain an API token from SAFE Launcher.
     */
    // mrhTODO: this...
    connect: function () {
      // mrhTODO TODO handling when token is already present
      RS.log('Safestore.connect()...');

//mrhTODO Review the logic for what happens when we have a token but get an "Unauthorized" response
//mrhTODO ..presumably should delete the token and attempt to authorise.
      this.rs.setBackend('safestore');
      if (this.token){
//mrhTODOtemphack next line is hack while hookIt() has sync disabled - probably wasn't ok for safestore anyway
//this.safestoreAuthorize(this.rs.apiKeys['safestore']);
        hookIt(this.rs);//mrhTODO googledrive lacks this, does hook remote inside _rs_init
      } else {
        this.safestoreAuthorize(this.rs.apiKeys['safestore']);
      }
    },

    /**
     * Method : configure(settings) Accepts its parameters according to the
     * <RemoteStorage.WireClient>. Sets the connected flag
     */
    configure: function (settings) {
      // A value is left unchanged if settings passes it as 'undefined'
      
      if (typeof settings.token !== 'undefined') { this.token = settings.token; }

// mrhTODO HacketyHack BEGIN...
// mrhTODO This is just for testing and forces disconnect status when the App is reloaded.
// mrhTODO I'm doing to avoid looking into why this.configure() causes a problem before
// mrhTODO the Safestore object is initialised (see comment about this.configure() below)
/*
if (this.token !== null ){
  try {
    this.info().then(function (info){
      this.userAddress = "Hello SAFE!!"; // info.display_name;
      this.rs.widget.view.setUserAddress(this.userAddress);
      this._emit('connected');
    }.bind(this));
  }
  catch(e){
    if (e.message !== "not connected to SAFE Network"){
      this.token = null;
    }
  }
}
// mrhTODO HacketyHack END
*/
      
      if (this.token === null ) {
        // If token is 'null' clear the other settings too
        this.token = null;          // Auth token
        this.permissions = null;    // List of permissions approved by the user
        this.symmetricKey = null;   
        this.symmetricNonce = null;
        this.symmetricKeyBase64 = null;
        this.symmetricNonceBase64 = null;
      }
      else {
        if ( settings.permissions !== 'undefined' ) {           this.permissions = settings.permissions; }
        
        if ( settings.symmetricKeyBase64 !== 'undefined' ) {    
          this.symmetricKeyBase64 = settings.symmetricKeyBase64; 
          this.symmetricKey = binary.from(settings.symmetricKeyBase64,'base64'); 
        }
        
        if ( settings.symmetricNonce !== 'undefined' ) {        
          this.symmetricNonceBase64 = settings.symmetricNonceBase64; 
          this.symmetricNonce = binary.from(settings.symmetricNonceBase64,'base64'); 
        }
      }

      if (this.token) {
        this.connected = true;
        // mrhTODO maybe implement some info in the widget (user specific, or permissions or???)
//        if ( !this.userAddress ){
          // mrhTODO Note: this.configure() can be called during initialisation, when Safestore.info is still to be undefined
//          this.info().then(function (info){
        this.userAddress = "Hello SAFE!!"; // info.display_name;
        try {
            this.rs.widget.view.setUserAddress(this.userAddress); // mrhTODO ignore this.rs.widget undefined
        } catch(e){}
        
            this._emit('connected');
//          }.bind(this));
//        }
        
      } else {
        this.connected = false;
      }
      if (hasLocalStorage){
        var sKeyBase64 = null;
        var sNonceBase64 = null;
        
        if ( this.symmetricNonce !== null ) {
          sKeyBase64 = binary.to(this.symmetricKey,'base64');
          sNonceBase64 = binary.to(this.symmetricNonce,'base64');
        }
        localStorage[SETTINGS_KEY] = JSON.stringify({
          token: this.token,
          permissions: this.permissions,
          symmetricKeyBase64: sKeyBase64,
          symmetricNonceBase64: sNonceBase64,
        });
      }
    },

    /**
     * Method: stopWaitingForToken
     * 
     * Stop waiting for the token and emit not-connected
     */
    // mrhTODO: this...
    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    /**
     * Method: _getFolder
     * 
     * Get all items in a folder.
     * 
     * Parameters:
     * 
     * path - path of the folder to get, with leading slash options - not used
     * 
     * Returns:
     * 
     * statusCode - HTTP status code body - array of the items found contentType -
     * 'application/json; charset=UTF-8' revision - revision of the folder
     */
    // mrhTODO: this...
    _getFolder: function (path, options) {
      // FIXME simplify promise handling <- from Dropbox.js
      
      var url = this.launcherUrl + '/nfs/directory/' + encodeURIComponent(RS.WireClient.cleanPath(PATH_PREFIX + '/' + path)) + '/' + this.isPathShared;
      var revCache = this._revCache;
      var self = this;

      return this._request('GET', url, {}).then(function (resp) {
        var sCode = resp.status;

        // 401 - Unauthorized
        // 400 - Fields are missing
        //if (sCode === 400 || sCode === 401) {

        if (sCode === 401) { // Unuathorized
          return Promise.resolve({statusCode: sCode});
        }
        // Handle directory doesn't exist as if it is empty:
        /* if (sCode === 400) { // Fields are missing
          // mrhTODO Pretend response until:
          // mrhTODO 1) I fudge access to a directory that doesn't exist yet (here)
          // mrhTODO 2) I have code that can creates directories/files (POST)
          sCode = 200; // Pretend ok
          resp.responseText ='{ "info": { "name": "myfavoritedrinks", "isPrivate": true, "isVersioned": true, "createdOn": 0, "modifiedOn": 0, "metadata": "" }, "files": [],            "subDirectories": [] }';
        }*/

        var listing, body, mime, rev;
        try{
          body = new binary.from(resp.responseText, 'base64');
          body = self.nacl.crypto_secretbox_open_easy(new Uint8Array(body), self.symmetricNonce, self.symmetricKey);
          body = binary.to(body,'utf8');
          body = JSON.parse(body);
        } catch (e) {
          return Promise.reject(e);
        }
        rev = self._revCache.get(path);
        mime = 'application/json; charset=UTF-8';
        if (body.info) {
          listingFiles = body.files.reduce(function (m, item) {
            // mrhTODO versioning not supported in Launcher (API v0.5)
            // mrhTODO so we'll let the cache create an ETag for both files and directories
              m[item.name] = { ETag: revCache.get(path+item.name) }; //mrhTODO was item.rev but SAFE API doesn't have this (at least not yet)
            return m;
          }, {});

          listingSubdirectories = body.subDirectories.reduce(function (m, item) {
            var itemName = item.name + '/';
            // mrhTODO versioning not supported in Launcher (API v0.5)
            // mrhTODO so we'll let the cache create an ETag for both files and directories
            m[itemName] = { ETag: revCache.get(path+itemName) };
            return m;
          }, {});
          
          var listing = {};
          for (var attrname in listingFiles) {          listing[attrname] = listingFiles[attrname]; }
          for (var attrname in listingSubdirectories) { listing[attrname] = listingSubdirectories[attrname]; }          
        }
        return Promise.resolve({statusCode: sCode, body: listing, contentType: mime, revision: rev});
      });
    },

    /**
     * Method: get
     * 
     * Compatible with <RemoteStorage.WireClient.get>
     * 
     * Checks for the path in _revCache and decides based on that if file has
     * changed. Calls _getFolder is the path points to a folder.
     * 
     * Calls <RemoteStorage.Safestore.share> afterwards to fill _itemRefs.
     */
    // mrhTODO: this...
    get: function (path, options) {
      RS.log('Safestore.get( ' + path + ', ...)' );
      if (! this.connected) { return Promise.reject("not connected (path: " + path + ")"); }
      var revCache = this._revCache;
      var self = this;

      var queryParams = 'offset=0';
      var queryParams = self.nacl.crypto_secretbox_easy(queryParams, self.symmetricNonce, self.symmetricKey);
      queryParams = binary.to(queryParams,'base64');
      
      var url = this.launcherUrl + '/nfs/file/' + encodeURIComponent(RS.WireClient.cleanPath(PATH_PREFIX + '/' + path)) + '/' + this.isPathShared + '?' + queryParams;

      // mrhTODO disableCache - SAFE NFS lacks match support (lobbying for it to be added)
      if (!disableCache){
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
      }
      
      // use _getFolder for folders
      if (path.substr(-1) === '/') { return this._getFolder(path, options); }

      return this._request('GET', url, {}).then(function (resp) {
        var status = resp.statusCode;
        var meta, body, mime, rev;
        if (status !== 200) {
          return Promise.resolve({statusCode: status});
        }

        // Decrypt the file content
//???        var ss = RS.Safestore; -> now using self.xxx
        body = new binary.from(resp.responseText, 'base64');
        body = self.nacl.crypto_secretbox_open_easy(new Uint8Array(body), self.symmetricNonce, self.symmetricKey);
        body = binary.to(body,'utf8');
        
        try {
          meta = JSON.parse( resp.getResponseHeader('file-metadata') ); //???
        } catch(e) {
          return Promise.reject(e);
        }

        mime = meta.mime_type; // resp.getResponseHeader('Content-Type');
        rev = meta.rev;
        self._revCache.set(path, rev);
        self._shareIfNeeded(path); // The shared link expires every 4 hours

        /* mrhTODO redundant?
        // handling binary
        if (!resp.getResponseHeader('Content-Type') ||
            resp.getResponseHeader('Content-Type').match(/charset=binary/)) {
          var pending = Promise.defer();

          // mrhTODO have I already done this above?
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
        */
        
        // handling json (always try)
        if (mime && mime.search('application/json') >= 0 || true) {
          try {
            body = JSON.parse(body);
            mime = 'application/json; charset=UTF-8';
          } catch(e) {
            // Failed parsing Json, assume it is something else then
          }
        }

        return Promise.resolve({statusCode: status, body: body, contentType: mime, revision: rev});
      });
    },

    /**
     * Method: put
     * 
     * Compatible with <RemoteStorage.WireClient>
     * 
     * Checks for the path in _revCache and decides based on that if file has
     * changed.
     * 
     * Calls <RemoteStorage.Safestore.share> afterwards to fill _itemRefs.
     */

    // BEGIN mrhTODOputPathHack
    //
    // mrhTODOputPathHack - hack to ensure the entire path exists when putting a file
    //
    // Temporarily replace put() and rename put() as putPathHack()

    // mrhTODO - this works - creates directory provided parent exists VERY TEMP HACK!
    putXXX: function (path, body, contentType, options) {
      RS.log('Safestore.put or putPathHack s ( '+ path + ', ...)' );
      var self = this;
      
      // mrhTODOBUG - this made a file, not a directory
      return this.putPathHack('/myfavoritedrinks/', body, contentType,options).then( function( response ) {
        return self.putPathHack(path, body, contentType, options);
      });
    },
    // END mrhTODOputPathHack
    
    // mrhTODONEXT: SAFE uses POST to create an EMPTY FILE
    // mrhTODONEXT: so use POST to create, and PUT to store content

    // mrhTODO - this works - PROVIDED the directory exists already (created using hack above!) :-)
    put: function (path, body, contentType, options) {      
      RS.log('Safestore.put or putPathHack B ( '+ path + ', ...)' );

      var self = this;

      if (!this.connected) { throw new Error("not connected (path: " + path + ")"); }

      if (path.substr(-1) === '/') { return this._putDirectory(path, options); }

      // mrhTODO disableCache - SAFE NFS lacks match support (lobbying for it to be added)
      if (!disableCache){
        // check if file has changed and return 412
        var savedRev = this._revCache.get(path);
        if (options && options.ifMatch &&
            savedRev && (savedRev !== options.ifMatch)) {
          return Promise.resolve({statusCode: 412, revision: savedRev});
        }
        // mrhTODO should I remove this?
        if (options && (options.ifNoneMatch === '*') &&
            savedRev && (savedRev !== 'rev')) {
          return Promise.resolve({statusCode: 412, revision: savedRev});
        }
      }
      // Encrypt the file content using the symmetricKey and symmetricNonce
      var encryptedData = self.nacl.crypto_secretbox_easy(body, self.symmetricNonce, self.symmetricKey);
      encryptedData = binary.to(encryptedData,'base64');
      
      if ((!contentType.match(/charset=/)) &&
          (encryptedData instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(encryptedData))) {
        contentType += '; charset=binary';
      }

      /* mrhTODO test upload of large files!
      if (body.length > 150 * 1024 * 1024) {
        // mrhTODO https://www.dropbox.com/developers/core/docs#chunked-upload
        return Promise.reject(new Error("Cannot upload file larger than 150MB"));
      }
      */
      
      var result;
      var needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));

      // CREATE FILE (POST) (https://maidsafe.readme.io/docs/nfsfile)
      var urlPOST = this.launcherUrl + '/nfs/file/';

      var payloadPOST = {
          filePath:             RS.WireClient.cleanPath(PATH_PREFIX + '/' + path ),
//        isPrivate:            this.isPrivate, // mrhTODO is this needed
          metadata:             "",
          isVersioned:          false,
          isPathShared:         this.isPathShared,
      };

      var optionsPOST = {
          url: urlPOST,
          headers: {
            'Content-Type': 'text/plain',
          },
          body: binary.to(self.nacl.crypto_secretbox_easy(JSON.stringify(payloadPOST), self.symmetricNonce, self.symmetricKey),'base64'),
        };

      // STORE/UPDATE FILE CONTENT (PUT) (https://maidsafe.readme.io/docs/nfs-update-file-content)
      var queryParams = 'offset=0';
      var queryParams = self.nacl.crypto_secretbox_easy(queryParams, self.symmetricNonce, self.symmetricKey);
      queryParams = binary.to(queryParams,'base64');
      
      var urlPUT = this.launcherUrl + '/nfs/file/' + encodeURIComponent(RS.WireClient.cleanPath(PATH_PREFIX + '/' + path)) + '/' + this.isPathShared + '?' + queryParams;

      // mrhTODO I'm not sure what header/content-type needed for encrypted data
      // mrhTODO Should CT denote the type that is encrypted, or say it's encrypted?
      var optionsPUT = {
          url: urlPUT,
        headers: {
          'Content-Type': contentType
        },
        body: binary.to(self.nacl.crypto_secretbox_easy(body, self.symmetricNonce, self.symmetricKey),'base64'),
      };
      
      // mrhTODO disableCache - SAFE NFS lacks match support (lobbying for it to be added)
      if (!disableCache){
        if (needsMetadata) {
          result = this._getMetadata(path).then(function (metadata) {
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
        } else {
          result = self._uploadSimple(uploadParams);
        }
      }

      // Before we can PUT data, we must ensure the directories exist, and the file itself
//        ??? looks like googledrive.js has suitable code for this _getFileId() will create file, partent folder etc if doesn't exist for example
          
      return this._request('POST', optionsPOST.url, optionsPOST).then(function (response) {
        self._shareIfNeeded(path);  // mrhTODO what's this?
        if (response.status !== 200){ //xyz
          return response;
        }
        else {
          return self._request('PUT', optionsPUT.url, optionsPUT).then(function (response) {
            self._shareIfNeeded(path);  // mrhTODO what's this?
            return response;
          });
        }
      });
      
/*      //      RS.log('Safestore.put calling _request( POST, ' + options.url + ', ...)' );
      return this._request('POST', options.url, options).then(function (ret) {
        self._shareIfNeeded(path);  // mrhTODO what's this?
        return ret;
      });*/
    },

    // mrhTODO - this works
    _putDirectory: function (path, options) {      
      RS.log('Safestore._putDirectory( '+ path + ', ...)' );

      var self = this;

      // mrhTODO disableCache - SAFE NFS lacks match support (lobbying for it to be added)
      if (!disableCache){
        // check if file has changed and return 412
        var savedRev = this._revCache.get(path);
        if (options && options.ifMatch &&
            savedRev && (savedRev !== options.ifMatch)) {
          return Promise.resolve({statusCode: 412, revision: savedRev});
        }
        // mrhTODO should I remove this?
        if (options && (options.ifNoneMatch === '*') &&
            savedRev && (savedRev !== 'rev')) {
          return Promise.resolve({statusCode: 412, revision: savedRev});
        }
      }

      /* mrhTODO test upload of large files!
      if (body.length > 150 * 1024 * 1024) {
        // mrhTODO https://www.dropbox.com/developers/core/docs#chunked-upload
        return Promise.reject(new Error("Cannot upload file larger than 150MB"));
      }
      */
      
      var result;
      var needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));

      // CREATE DIRECTORY (POST) (https://maidsafe.readme.io/docs/nfsdirectory)
      var urlPOST = this.launcherUrl + '/nfs/directory/';

      var payloadPOST = {
          dirPath:             RS.WireClient.cleanPath(PATH_PREFIX + '/' + path ),
//          isPrivate:            this.isPrivate, // mrhTODO is this needed
          metadata:             "",
          isVersioned:          false,
          isPathShared:         this.isPathShared,
      };

      var optionsPOST = {
          url: urlPOST,
          headers: {
            'Content-Type': 'text/plain',
          },
          body: binary.to(self.nacl.crypto_secretbox_easy(JSON.stringify(payloadPOST), self.symmetricNonce, self.symmetricKey),'base64'),
        };

      // mrhTODO disableCache - SAFE NFS lacks match support (lobbying for it to be added)
      if (!disableCache){
        if (needsMetadata) {
          result = this._getMetadata(path).then(function (metadata) {
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
        } else {
          result = self._uploadSimple(uploadParams);
        }
      }

      // Before we can PUT data, we must ensure the directories exis, and the file itself
//        ??? looks like googledrive.js has suitable code for this _getFileId() will create file, partent folder etc if doesn't exist for example
          
      return this._request('POST', optionsPOST.url, optionsPOST).then(function (response) {
        self._shareIfNeeded(path);  // mrhTODO what's this?
        return response;
      });
      
/*      //      RS.log('Safestore.put calling _request( POST, ' + options.url + ', ...)' );
      return this._request('POST', options.url, options).then(function (ret) {
        self._shareIfNeeded(path);  // mrhTODO what's this?
        return ret;
      });*/
    },
    
    /**
     * Method: delete
     * 
     * Compatible with <RemoteStorage.WireClient.delete>
     * 
     * Checks for the path in _revCache and decides based on that if file has
     * changed.
     * 
     * Calls <RemoteStorage.Safestore.share> afterwards to fill _itemRefs.
     */
    'delete': function (path, options) {
      RS.log('Safestore.delete: ' + path + ', ...)' );
      var self = this;

      if (!this.connected) { throw new Error("not connected (path: " + path + ")"); }

      // check if file has changed and return 412
      var savedRev = this._revCache.get(path);
      if (!disableCache && options && options.ifMatch && savedRev && (options.ifMatch !== savedRev)) {
        return Promise.resolve({ statusCode: 412, revision: savedRev });
      }

      // mrhTODO check behaviour for ifNoneMatch etc options throughout
      if (!disableCache && options && options.ifMatch) {
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

      // BEGIN SAFE CODE //
      var fullUrl = this.launcherUrl + '/nfs/file/' + encodeURIComponent(RS.WireClient.cleanPath(PATH_PREFIX + '/' + path)) + '/' + this.isPathShared;
      // mrhTODO I'm not sure what header/content-type needed for encrypted data
      // mrhTODO Should CT denote the type that is encrypted, or say it's encrypted?
      var options = {
        url: fullUrl,
        headers: {
          'Content-Type': contentType
        },
        body: encryptedData
      };

      RS.log('Safestore.delete calling _request( POST, ' + options.url + ', ...)' );
      return _request('DELETE', options.url, options);
      // END SAFE CODE //
      
      return self._deleteSimple(path);
    },

    /**
     * Method: _shareIfNeeded
     * 
     * Calls share, if the provided path resides in a public folder.
     */
    // mrhTODO look at whether this could be supported
    // mrhTODO So far I chose (arbitratily) that Safestore would use storage
    // mrhTODO limited to the app (isPathShared false) but if I change that
    // mrhTODO it may be possible to support this and also "share:" below.
    // mrhTODO User can still choose to keep the files in either public or private
    // mrhTODO folder.
    _shareIfNeeded: function (path) {
      if (path.match(/^\/public\/.*[^\/]$/) && this._itemRefs[path] === undefined) {
        this.share(path);
      }
    },

    /**
     * Method: share
     * 
     * Gets a publicly-accessible URL for the path from Safestore and stores it
     * in _itemRefs.
     * 
     * Returns:
     * 
     * A promise for the URL
     */
    // mrhTODO: this...
    share: function (path) {
      RS.log('Safestore.share(' + options.url + ') - NOT IMPLEMENTED' );

      if (!this.connected) { throw new Error("share in place not supported"); }
      // mrhTODO this would have to make a copy to a public share and return
      // mrhTODO the path to the copy as a SAFE Network URL (i.e. not accessible
      // mrhTODO outside SAFE Network)
    },

    /**
     * Method: info
     * 
     * Fetches the user's info from SAFE Network and returns a promise for it.
     * 
     * Returns:
     * 
     * A promise to the user's info
     */
    info: function () {
      RS.log('Safestore.info() - NOT IMPLEMENTED' );
      if (this.connected) { 
        // mrhTODO a standard could be implemented for this but none yet exists
        //throw new Error("info is not supported on SAFE Network"); 
        var info = {display_name: "Stay SAFE! info()" }
        return Promise.resolve(info);
      }
      else {
        return Promise.reject( new Error("not connected to SAFE Network") );         
      }
    },

    /**
     * Method: _request
     * 
     * Make a HTTP request.
     * 
     * Options:
     * 
     * headers - an object containing the request headers
     * 
     * Parameters:
     * 
     * method - the method to use url - the URL to make the request to options -
     * see above
     */
    // mrhTODO sweep this file for "dropbox" and clean up!

    _request: function (method, url, options) {
      RS.log('Safestore._request(' + method + ', ' + url + ', ...)' );
      var self = this;
      if (! options.headers) { options.headers = {}; }
      options.headers['Authorization'] = 'Bearer ' + this.token;
      return RS.WireClient.request.call(this, method, url, options).then(function (xhr) {
        // Launcher responses
        // 401 - Unauthorized
        // 400 - Fields are missing
        if (xhr && (xhr.status === 400 || xhr.status == 401) ) {
          return Promise.resolve({statusCode: xhr.status});
        } else {
          return Promise.resolve(xhr);
        }
      });
    },
    /**
     * Method: fetchDelta
     * 
     * Fetches the revision of all the files from SAFE Network API and puts them
     * into _revCache. These values can then be used to determine if something
     * has changed.
     */
// mrhTODO: this API doesn't exist in SAFE API so sync will need to operate differently
// mrhTODO  take a look at googledrive.js and see if there's anything suitable there
    fetchDelta: function () {
      // mrhTODO disableCache - while cache ignored, ok for this to do nothing
      if (disableCache){ return Promise.resolve(args); } // mrhTODO disableCache

      // mrhTODO TODO: Handle `has_more`
      var args = Array.prototype.slice.call(arguments);
      var self = this;
      var body = { path_prefix: PATH_PREFIX };
  
      if (self._deltaCursor) {
          body.cursor = self._deltaCursor;
      }
      
      return self._request('POST', 'https://api.safenet???/1/delta', {
        body: encodeQuery(body),
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
            return Promise.reject("safestore.fetchDelta returned "+response.status+response.responseText);
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
          return Promise.reject('safestore.fetchDeltas failed, no entries found');
        }

        // SAFE Network ??? sends the complete state
        if (delta.reset) {
          self._revCache = new LowerCaseCache('rev');
        }

        // saving the cursor for requesting further deltas in relation to the
        // cursor position
        if (delta.cursor) {
          self._deltaCursor = delta.cursor;
        }

        // updating revCache
        RemoteStorage.log("Delta : ", delta.entries);
        delta.entries.forEach(function (entry) {
          var path = entry[0].substr(PATH_PREFIX.length);
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

    /**
     * Method: _getMetadata
     * 
     * Gets metadata for a path (can point to either a file or a folder).
     * 
     * Options:
     * 
     * list - if path points to a folder, specifies whether to list the metadata
     * of the folder's children. False by default.
     * 
     * Parameters:
     * 
     * path - the path to get metadata for options - see above
     * 
     * Returns:
     * 
     * A promise for the metadata
     */
    // mrhTODO: This can do a get with zero file length (so could merge into one function)
    _getMetadata: function (path, options) {
//mrhTODO???
      var self = this;
      var cached = this._metadataCache[path];
      var url = 'https://api.safenet???/1/metadata/auto' + cleanPath(PATH_PREFIX + '/' + path);
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

    /**
     * Method: _uploadSimple
     * 
     * Upload a simple file (the size is no more than 150MB).
     * 
     * Parameters:
     * 
     * ifMatch - same as for get path - path of the file body - contents of the
     * file to upload contentType - mime type of the file
     * 
     * Returns:
     * 
     * statusCode - HTTP status code revision - revision of the newly-created
     * file, if any
     */
/*mrhTODO not sure if this is useful - maybe compare Dropbox and GoogleDrive
      _uploadSimple: function (params) {
      var self = this;
      var url = 'https://api-content.safenet???/1/files_put/auto' + cleanPath(PATH_PREFIX + '/' + params.path) + '?';

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

        // Conflict happened. Delete the copy created by safestore
        if (response.path !== params.path) {
          var deleteUrl = 'https://api.safenet???/1/fileops/delete?root=auto&path=' + encodeURIComponent(response.path);
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
*/

    /**
     * Method: _deleteSimple
     * 
     * Deletes a file or a folder. If the folder contains more than 10'000 items
     * (recursively) then the operation may not complete successfully. If that
     * is the case, an Error gets thrown.
     * 
     * Parameters:
     * 
     * path - the path to delete
     * 
     * Returns:
     * 
     * statusCode - HTTP status code
     */
    // mrhTODO: this...
/*    _deleteSimple: function (path) {
      var self = this;
      var url = 'https://api.safenet???/1/fileops/delete?root=auto&path=' + encodeURIComponent(path);

      return self._request('POST', url, {}).then(function (resp) {
        if (resp.status === 406) {
          // Too many files would be involved in the operation for it to
          // complete successfully.
          // TODO: Handle this somehow
          return Promise.reject(new Error("Cannot delete '" + path + "': too many files involved"));
        }

        if (resp.status === 200 || resp.status === 404) {
          self._revCache.delete(path);
          delete self._itemRefs[path];
        }

        return Promise.resolve({ statusCode: resp.status });
      });
    }
*/
  };
    
  // hooking and unhooking the sync

  // mrhTODO: this...
  function hookSync(rs) {
    if (rs._safestoreOrigSync) { return; } // already hooked
    rs._safestoreOrigSync = rs.sync.sync.bind(rs); //mrhTODO should this be rs.sync.sync.bind(rs)? (was rs.sync.bind(rs)) - if so check dropbox.js & googledrive.js 
    rs.sync.sync = function () {                   //mrhTODO was rs.sync = funtion() {
                                                  // mrhTODO if I'm right here, I should rename sync.sync as sync.syncFn and safestoreOrigSync as safestoreOrigSyncFn
        //mrhTODO confirmed as issue: https://github.com/remotestorage/remotestorage.js/issues/851
      return this.safestore.fetchDelta.apply(this.safestore, arguments).
        then(rs._safestoreOrigSync, function (err) {
          rs._emit('error', new rs.SyncError(err));
        });
    }.bind(rs);
  }

  // mrhTODO: this...
  function unHookSync(rs) {
    if (! rs._safestoreOrigSync) { return; } // not hooked
    rs.sync.sync = rs._safestoreOrigSync;               //mrhTODO was rs.cyn = ...
    delete rs._safestoreOrigSync;
  }

  // hooking and unhooking getItemURL

  // mrhTODO: this...
  function hookGetItemURL(rs) {
    if (rs._origBaseClientGetItemURL) { return; }
    rs._origBaseClientGetItemURL = RS.BaseClient.prototype.getItemURL;
    RS.BaseClient.prototype.getItemURL = function (path){
      var ret = rs.safestore._itemRefs[path];
      return  ret ? ret : '';
    };
  }

  // mrhTODO: this...
  function unHookGetItemURL(rs){
    if (! rs._origBaseClientGetItemURL) { return; }
    RS.BaseClient.prototype.getItemURL = rs._origBaseClientGetItemURL;
    delete rs._origBaseClientGetItemURL;
  }

  // mrhTODO: this...
  function hookRemote(rs){
    if (rs._origRemote) { return; }
    rs._origRemote = rs.remote;
    rs.remote = rs.safestore;
  }

  // mrhTODO: this...
  function unHookRemote(rs){
    if (rs._origRemote) {
      rs.remote = rs._origRemote;
      delete rs._origRemote;
    }
  }

  // mrhTODO: PROBABLY disable call to hookSync() leave the others
  function hookIt(rs){
    hookRemote(rs);
    if (rs.sync) {      //mrhTODO I think this is correct, i.e. asking if Sync feature enabled.
      hookSync(rs); // mrhTODO I've disabled sync (not sure impact of this
                      // mrhTODO NOTE: googledrive only does hook of remote, not for GetItemURL or sync
    }
    hookGetItemURL(rs);
  }

  // mrhTODO: this...
  function unHookIt(rs){
    unHookRemote(rs);
    unHookSync(rs);
    unHookGetItemURL(rs);
  }

  // mrhTODO: this...
  RS.Safestore._rs_init = function (rs) {
    hasLocalStorage = rs.localStorageAvailable();
    if ( rs.apiKeys.safestore ) {
      rs.safestore = new RS.Safestore(rs);
    }
    if (rs.backend === 'safestore') {
      hookIt(rs);
    }
  };

  // mrhTODO: this...
  RS.Safestore._rs_supported = function () {
    return true;
  };

  // mrhTODO: this...
  RS.Safestore._rs_cleanup = function (rs) {
    unHookIt(rs);
    if (hasLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    rs.removeEventListener('error', onErrorCb);
    rs.setBackend(undefined);
  };
})(this);
