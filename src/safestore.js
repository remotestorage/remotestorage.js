// mrhTODO NEXT: create safestore.js anew (branch feature/safestore-backend-gd)
// mrhTODO       DONE: first pass but lots of ??? to go through
// mrhTODO       DONE: review and do getFileId() changes
// mrhTODO       SKIPPED: temp disable _revCache stuff
// mrhTODO       DONE: add in missing encryption bits
// mrhTODO       NEXT: get working with old encrypted API - commit!
// mrhTODO          DONE: get auth working 
// mrhTODO          DONE: trace why it is repeatedly trying to create /remotestorage (maybe listing doesn't get into fileIdCache?) 
// mrhTODO          >NEXT: look into implementing _getMeta(). Prob causing Sync warning "discarding corrupt folder description"
// mrhTODO       NEXT: beware breaking go-safe linux cmds by cretz: strip out encryption and base64 encoding
// mrhTODO       NEXT: get working with new unencrypted API - commit!
// mrhTODO       NEXT: when working:
// mrhTODO           NEXT: retrofit revCache
// mrhTODO           NEXT: retrofit sync
// mrhTODO           NEXT: retrofit localstorage settings

// mrhTODO      [ ] Review/implement features noted at top of safestore-db.js (local file) up to "create safestore.js anew"
// mrhTODO      (| Promises recursion: http://stackoverflow.com/questions/29020722/recursive-promise-in-javascript/29020886?noredirect=1#comment62855125_29020886)

// mrhTODO NEXT: consider- try to sort out the issues from console output (including with widget?)
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
  /**
   * Class: RemoteStorage.Safestore
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
   * mrhTODO: To use this backend, you need to specify the app's client ID like so:
   *
   * (start code)
   *
   * remoteStorage.setApiKeys('safestore', {
   *   clientId: 'your-client-id'
   * });
   *
   * (end code)
   *
   * An client ID can be obtained by registering your app in the Google
   * Developers Console: https://developers.google.com/drive/web/auth/web-client
   *
   * Docs: https://developers.google.com/drive/web/auth/web-client#create_a_client_id_and_client_secret
   **/

  // mrhTODO: everything below this!
  // mrhTODO: add regression tests in test/unit/safestore-suite.js
  var RS = RemoteStorage;
  var disableCache = true;  // mrhTODO - hack to cause revCache to be ignored - all requests go through

  
  // mrhTODO: this...
  var hasLocalStorage;//???
  var SETTINGS_KEY = 'remotestorage:safestore';
  var cleanPath = RS.WireClient.cleanPath;
  var PATH_PREFIX = '/remotestorage/';
  
//  var BASE_URL = 'https://www.googleapis.com';
//  var AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
//  var AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';

//  var GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
  var RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

  function buildQueryString(params) {
    return Object.keys(params).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
  }

  function fileNameFromMeta(meta) {
    return encodeURIComponent(meta.title) + (meta.mimeType === GD_DIR_MIME_TYPE ? '/' : '');
  }

  function metaTitleFromFileName(filename) {
    if (filename.substr(-1) === '/') {
      filename = filename.substr(0, filename.length - 1);
    }
    return decodeURIComponent(filename);
  }

  function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
  }

  function baseName(path) {
    var parts = path.split('/');
    if (path.substr(-1) === '/') {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

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
    }
  };

  var onErrorCb;

  RS.Safestore = function (remoteStorage, clientId) {

    this.rs = remoteStorage;
    this.clientId = clientId;
    this._fileIdCache = new Cache(60 * 5); // ids expire after 5 minutes (is this a good idea?)

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
          userAddress: null,    // webfinger style address (username@server)
          href: null,           // server URL from webfinger
          storageApi: null,     // remoteStorage API dependencies in here (safestore.js), not server, so hardcode?
          
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
    this.rs.on('error', onErrorCb);

    // mrhTODO port dropbox style load/save settings from localStorage
};

  RS.Safestore.prototype = {
    connected: false,
    online: true,
    isPathShared: true,         // App private storage mrhTODO shared or private? app able to control?
    launcherUrl: LAUNCHER_URL,  // Can be overridden by App
    assymetricKeys: null,       // For encrypted communications
    nonce: null,                // with SAFE Launcher

    configure: function (settings) { // Settings parameter compatible with WireClient
      // mrhTODO: review dropbox approach later
      
      if (settings.token) {
        localStorage['remotestorage:safestore:token'] = settings.token;
        this.token = settings.token;
        this.connected = true;
        this.permissions = settings.permissions;    // List of permissions approved by the user
        
        if ( settings.symmetricKeyBase64 !== 'undefined' ) {    
          this.symmetricKeyBase64 = settings.symmetricKeyBase64; 
          this.symmetricKey = binary.from(settings.symmetricKeyBase64,'base64'); 
        }
        
        if ( settings.symmetricNonce !== 'undefined' ) {        
          this.symmetricNonceBase64 = settings.symmetricNonceBase64; 
          this.symmetricNonce = binary.from(settings.symmetricNonceBase64,'base64'); 
        }

        this._emit('connected');
      } else {
        this.connected = false;
        delete this.token;
        this.permissions = null;
        this.symmetricKey = null;   
        this.symmetricNonce = null;
        this.symmetricKeyBase64 = null;
        this.symmetricNonceBase64 = null;
        delete localStorage['remotestorage:safestore:token'];
      }
    },

    connect: function () {
      RS.log('Safestore.connect()...');

      // mrhTODO: note dropbox connect calls hookIt() if it has a token - for sync?
      // mrhTODO: note dropbox connect skips auth if it has a token - enables it to remember connection across sessions
      this.rs.setBackend('safestore');
      this.safestoreAuthorize(this.rs.apiKeys['safestore']);
    },

    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

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
    
    get: function (path, options) {
      RS.log('Safestore.get(' + path + ',...)' );
      var fullPath = RS.WireClient.cleanPath(PATH_PREFIX + '/' + path);

      if (path.substr(-1) === '/') {
        return this._getFolder(fullPath, options);
      } else {
        return this._getFile(fullPath, options);
      }
    },

    put: function (path, body, contentType, options) {
      RS.log('Safestore.put(' + path + ',...)' );
      var fullPath = RS.WireClient.cleanPath(PATH_PREFIX + '/' + path);

      var self = this;
      function putDone(response) {
        if (response.status >= 200 && response.status < 300) {
          var meta = JSON.parse(response.responseText);
          var etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          return Promise.resolve({statusCode: 200, contentType: meta.mimeType, revision: etagWithoutQuotes});
        } else if (response.status === 412) {
          return Promise.resolve({statusCode: 412, revision: 'conflict'});
        } else {
          return Promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
        }
      }
      return self._getFileId(fullPath).then(function (id) {
        if (id) {
          if (options && (options.ifNoneMatch === '*')) {
            return putDone({ status: 412 });
          }
          return self._updateFile(id, fullPath, body, contentType, options).then(putDone);
        } else {
          return self._createFile(fullPath, body, contentType, options).then(putDone);
        }
      });
    },

    'delete': function (path, options) {
      RS.log('Safestore.delete(' + path + ',...)' );
      var fullPath = RS.WireClient.cleanPath(PATH_PREFIX + '/' + path);

      RS.log('Safestore.delete: ' + fullPath + ', ...)' );
      var self = this;
      
      
      return self._getFileId(fullPath).then(function (id) {
        if (!id) {
          // File doesn't exist. Ignore.
          return Promise.resolve({statusCode: 200});
        }

 
        return self._getMeta(id).then(function (meta) {
          var etagWithoutQuotes;
          if ((typeof meta === 'object') && (typeof meta.etag === 'string')) {
            etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          }
          if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
            return {statusCode: 412, revision: etagWithoutQuotes};
          }

          // BEGIN SAFE CODE //
          var fullUrl = self.launcherUrl + '/nfs/file/' + encodeURIComponent(fullPath) + '/' + self.isPathShared;
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
          return _request('DELETE', options.url, options).then(function (response) {
            if (response.status === 200 || response.status === 204) {
              return {statusCode: 200};
            } else {
              return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
            }
          });
          // END SAFE CODE //
        });
      });
    },

    _updateFile: function (id, path, body, contentType, options) {
      RS.log('Safestore._updateFile(' + path + ',...)' );
      var self = this;

      // Encrypt the file content using the symmetricKey and symmetricNonce
      var encryptedData = self.nacl.crypto_secretbox_easy(body, self.symmetricNonce, self.symmetricKey);
      encryptedData = binary.to(encryptedData,'base64');
      
      if ((!contentType.match(/charset=/)) &&
          (encryptedData instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(encryptedData))) {
        contentType += '; charset=binary';
      }

      // STORE/UPDATE FILE CONTENT (PUT) (https://maidsafe.readme.io/docs/nfs-update-file-content)
      var queryParams = 'offset=0';
      var queryParams = self.nacl.crypto_secretbox_easy(queryParams, self.symmetricNonce, self.symmetricKey);
      queryParams = binary.to(queryParams,'base64');
      
      var urlPUT = self.launcherUrl + '/nfs/file/' + encodeURIComponent(path) + '/' + self.isPathShared + '?' + queryParams;

      // mrhTODO I'm not sure what header/content-type needed for encrypted data
      // mrhTODO Should CT denote the type that is encrypted, or say it's encrypted?
      var optionsPUT = {
          url: urlPUT,
        headers: {
          'Content-Type': contentType
        },
        body: binary.to(self.nacl.crypto_secretbox_easy(body, self.symmetricNonce, self.symmetricKey),'base64'),
      };

      // mrhTODO googledrive does two PUTs, one initiates resumable tx, the second sends data - review when streaming API avail
      return self._request('PUT', optionsPUT.url, optionsPUT).then(function (response) {
        // self._shareIfNeeded(path);  // mrhTODO what's this?
        return response;
      });
    },

    _createFile: function (path, body, contentType, options) {
      RS.log('Safestore._createFile(' + path + ',...)' );
      var self = this;
      
      // Ensure path exists by recursively calling create on parent folder
      return self._getParentId(path).then(function (parentId) {
        var fileName = baseName(path);
        /*var metadata = {
          title: metaTitleFromFileName(fileName),
          mimeType: contentType,
          parents: [{
            kind: "drive#fileLink",
            id: parentId
          }]
        };*/
        
        // Encrypt the file content using the symmetricKey and symmetricNonce
        var encryptedData = self.nacl.crypto_secretbox_easy(body, self.symmetricNonce, self.symmetricKey);
        encryptedData = binary.to(encryptedData,'base64');
        
        if ((!contentType.match(/charset=/)) &&
            (encryptedData instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(encryptedData))) {
          contentType += '; charset=binary';
        }

        // CREATE FILE (POST) (https://maidsafe.readme.io/docs/nfsfile)
        var urlPOST = self.launcherUrl + '/nfs/file/';

        var payloadPOST = {
            filePath:             path,
//          isPrivate:            this.isPrivate, // mrhTODO is this needed
            metadata:             "",
            isVersioned:          false,
            isPathShared:         self.isPathShared,
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
        
        var urlPUT = self.launcherUrl + '/nfs/file/' + encodeURIComponent(path) + '/' + self.isPathShared + '?' + queryParams;

        // mrhTODO I'm not sure what header/content-type needed for encrypted data
        // mrhTODO Should CT denote the type that is encrypted, or say it's encrypted?
        var optionsPUT = {
            url: urlPUT,
          headers: {
            'Content-Type': contentType
          },
          body: binary.to(self.nacl.crypto_secretbox_easy(body, self.symmetricNonce, self.symmetricKey),'base64'),
        };
        
        return self._request('POST', optionsPOST.url, optionsPOST).then(function (response) {
          // self._shareIfNeeded(path);  // mrhTODO what's this?
          if (response.status !== 200){ //xyz
            return response;
          }
          else {
            return self._request('PUT', optionsPUT.url, optionsPUT).then(function (response) {
              // self._shareIfNeeded(path);  // mrhTODO what's this?
              return response;
            });
          }
        });
      });
    },

    _getFile: function (path, options) {
      RS.log('Safestore._getFile(' + path + ', ...)' );
      if (! this.connected) { return Promise.reject("not connected (path: " + path + ")"); }
      var revCache = this._revCache;
      var self = this;

      var queryParams = 'offset=0';
      var queryParams = self.nacl.crypto_secretbox_easy(queryParams, self.symmetricNonce, self.symmetricKey);
      queryParams = binary.to(queryParams,'base64');

      var url = self.launcherUrl + '/nfs/file/' + encodeURIComponent(path) + '/' + self.isPathShared + '?' + queryParams;

      // Check if file exists. Creates parent directory if that doesn't exist.
      return self._getFileId(path).then(function (id) {
        return self._getMeta(id).then(function (meta) {
          var etagWithoutQuotes;
          if (typeof(meta) === 'object' && typeof(meta.etag) === 'string') {
            etagWithoutQuotes = meta.etag.substring(1, meta.etag.length-1);
          }

          if (options && options.ifNoneMatch && (etagWithoutQuotes === options.ifNoneMatch)) {
            return Promise.resolve({statusCode: 304});
          }
          
          return self._request('GET', url, {}).then(function (response) {
            var status = response.statusCode;
            var meta, body, mime, rev;
            if (status !== 200) {
              return Promise.resolve({statusCode: status});
            }

            // Decrypt the file content
            body = new binary.from(response.responseText, 'base64');
            body = self.nacl.crypto_secretbox_open_easy(new Uint8Array(body), self.symmetricNonce, self.symmetricKey);
            body = binary.to(body,'utf8');
            
            if (meta.mimeType.match(/^application\/json/)) {
              try {
                body = JSON.parse(body);
              } catch(e) {}
            }
            // mrhTODO dropbox version has statusCode: status
            return Promise.resolve({statusCode: 200, body: body, contentType: meta.mimeType, revision: etagWithoutQuotes});
          });
        });
      });
    },
    
    // Obtain directory listing. Creates parent directory if it doesn't exist
    _getFolder: function (path, options) {
      RS.log('Safestore._getFolder(' + path + ', ...)' );
      var self = this;

      // Check if directory exists. Create parent directory if it doesn't exist
      return self._getFileId(path).then(function (id) {
        var query, fields, data, i, etagWithoutQuotes, itemsMap;
        if (! id) {
          return Promise.resolve({statusCode: 404});
        }

        // Directory exists so obtain listing
        var url = self.launcherUrl + '/nfs/directory/' + encodeURIComponent(path) + '/' + self.isPathShared;
        var revCache = self._revCache;

        return self._request('GET', url, {}).then(function (resp) {
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

          var listing, listingFiles, listingSubdirectories, body, mime, rev;
          try{
            body = new binary.from(resp.responseText, 'base64');
            body = self.nacl.crypto_secretbox_open_easy(new Uint8Array(body), self.symmetricNonce, self.symmetricKey);
            body = binary.to(body,'utf8');
            body = JSON.parse(body);
          } catch (e) {
            return Promise.reject(e);
          }
          
          // ??? review dropbox revCache and maybe retrofit in this safestore.js
          // mrhTODO: rev = self._revCache.get(path);

          if (body.info) {
            listingFiles = body.files.reduce(function (m, item) {
              var itemPath = path + item.name;

              // Add file Id to cache
              self._fileIdCache.set(itemPath , itemPath );
              RS.log('_fileIdCache.set(' + itemPath  + ', ' + itemPath + ')' );

              // mrhTODO versioning not supported in Launcher (API v0.5)
              // mrhTODO so we'll let the cache create an ETag for both files and directories
//            m[item.name] = { ETag: revCache.get(path+item.name) }; //mrhTODO was item.rev but SAFE API doesn't have this (at least not yet)
              m[item.name] =  { ETag: itemPath}//mrhTODO dummy value to create element while above disabled
              return m;
            }, {});

            listingSubdirectories = body.subDirectories.reduce(function (m, item) {
              var itemPath = path + item.name + '/';
              
              // Add file Id to cache
              self._fileIdCache.set(itemPath , itemPath );
              RS.log('_fileIdCache.set(' + itemPath  + ', ' + itemPath + ')' );

              // mrhTODO versioning not supported in Launcher (API v0.5)
              // mrhTODO so we'll let the cache create an ETag for both files and directories
//              m[itemName] = { ETag: revCache.get(path+itemName) };
              m[item.name + '/'] = { ETag: itemPath};    //mrhTODO dummy value to create element while above disabled
              return m;
            }, {});

            // Merge into one listing
            var listing = {};
            for (var attrname in listingFiles) {            listing[attrname] = listingFiles[attrname]; }
            for (var attrname in listingSubdirectories) {   listing[attrname] = listingSubdirectories[attrname]; }          
          }
/* mrhTODO: googledrive.js returns itemsMap rather than listing, and includes additional information which I might
 * mrhTODO: revisit (e.g. eTag when SAFE API includes versioning. Also review Content-Type / -Length. 
          itemsMap = {};
          if ( isDirectory ) {
            self._fileIdCache.set(path + data.items[i].title + '/', data.items[i].id);
            itemsMap[data.items[i].title + '/'] = {
              ETag: etagWithoutQuotes
            };
          }
          else {
            self._fileIdCache.set(path + data.items[i].title, data.items[i].id);
            itemsMap[data.items[i].title] = {
              ETag: etagWithoutQuotes,
              'Content-Type': data.items[i].mimeType,
              'Content-Length': data.items[i].fileSize
            };
          }
*/
          RS.log('Safestore._getFolder(' + path + ', ...) RESULT: lising contains ' + JSON.stringify( listing ) );
          return Promise.resolve({statusCode: sCode, body: listing, contentType: RS_DIR_MIME_TYPE, revision: undefined /*rev (mrhTODO above)*/});
        });
      });
    },

    _getParentId: function (path) {
      RS.log('Safestore._getParentId(' + path + ')' );
      var foldername = parentPath(path);
      var self = this;
      return self._getFileId(foldername).then(function (parentId) {
        if (parentId) {
          return Promise.resolve(parentId);
        } else {
          return self._createFolder(foldername);
        }
      });
    },

    _createFolder: function (path) {
      RS.log('Safestore._createFolder(' + path + ')' );
      var self = this;
      return self._getParentId(path).then(function (parentPath) {
        
        var result;
//        var needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
        var needsMetadata = false;//mrhTODO the above line is not in the googledrive.js version (must be from my port of dropbox.js)

        
        // CREATE DIRECTORY (POST) (https://maidsafe.readme.io/docs/nfsdirectory)
        var urlPOST = self.launcherUrl + '/nfs/directory/';

        var payloadPOST = {
            dirPath:             path,
//            isPrivate:            this.isPrivate, // mrhTODO is this needed
            metadata:             "",
            isVersioned:          false,
            isPathShared:         self.isPathShared,
        };

        var optionsPOST = {
            url: urlPOST,
            headers: {
              'Content-Type': 'text/plain',
            },
            body: binary.to(self.nacl.crypto_secretbox_easy(JSON.stringify(payloadPOST), self.symmetricNonce, self.symmetricKey),'base64'),
          };

// mrhTODO: ??? I might just add in the dropbox cache stuff so from here on I'm leaving 
// mrhTODO: it in, but above this line I probably left it out, so will need to retrofit from 
// mrhTODO: dropbox version
        
        // mrhTODO disableCache - SAFE NFS lacks match support (lobbying for it to be added)
        if (!disableCache){
          if (needsMetadata) {// see above (needsMetadata set to false)
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
            
        return self._request('POST', optionsPOST.url, optionsPOST).then(function (response) {
//          self._shareIfNeeded(path);  // mrhTODO what's this? (was part of dropbox.js)
          return Promise.resolve(path);
        });
      });
    },


    // _getFileId() - check if file exists and create parent directory if necessary
    //
    // Checks if the id (full path) is in the _fileIdCache(), and if not found
    // obtains a directory listing to check if it exists, and if it does inserts the
    // the id into _fileIdCache. If the parent directory does not exist it will
    // be created as a side effect, so this function can be used to check if a file
    // exists before creating or updating its content.
    //
    // RETURNS
    //  Promise() with
    //      file id (full path) if the file exists
    //      empty id, if the file doesn't exist
    // Note:
    //      if the parent directory doesn't exist it will be created
    //
    _getFileId: function (path) {
      RS.log('Safestore._getFileId(' + path + ')' );

      var self = this;
      var id;
      if (path === '/') {
        // "root" is a special alias for the fileId of the root folder
        return Promise.resolve('root');
      } else if ((id = this._fileIdCache.get(path))) {
        // If cached we believe it exists
        return Promise.resolve(id);
      }
      // Not yet cached or doesn't exist
      // Load parent directory listing to propagate / update cache.
      return self._getFolder(parentPath(path)).then(function () {
        
        id = self._fileIdCache.get(path);
        if (!id) {
          // Doesn't exist yet so...
          if (path.substr(-1) === '/') {    // Directory, so create it
            return self._createFolder(path).then(function () {
              return self._getFileId(path);
            });
        } else {                            // File, so we flag doesn't exist (no id)
            return Promise.resolve();
          }
          return;
        }
        return Promise.resolve(id);         // File exists, so pass back id
      });
    },

    // mrhTODO check launcher API and usefulness here
    _getMeta: function (id) {
      // mrhTODO implement this?
      //return Promise.resolve({ETag: id}); // mrhTODO: Dummy metadata - since test app doesn't use this yet
      return Promise.reject('Safestore._getMeta('+id+') mrhTODO: _Safestore._getMeta() NOT IMPMEMENTED');

      return this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
        if (response.status === 200) {
          return Promise.resolve(JSON.parse(response.responseText));
        } else {
          return Promise.reject("request (getting metadata for " + id + ") failed with status: " + response.status);
        }
      });
    },

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
    }
  };

  // mrhTODO see dropbox version - probably need to modify this in line with that (check with RS team)
  // differences are:
  //    1) config.clientId not present
  //    2) it uses hookIt() (and in _rs_cleanup() unHookIt()) instead of inline assignements
  //       which causes dropbox version  to also call hookSync() and hookGetItemURL()
  RS.Safestore._rs_init = function (remoteStorage) {
    var config = remoteStorage.apiKeys.safestore;
    if (config) {
      remoteStorage.safestore = new RS.Safestore(remoteStorage, config.clientId);
      if (remoteStorage.backend === 'safestore') {
        remoteStorage._origRemote = remoteStorage.remote;
        remoteStorage.remote = remoteStorage.safestore;
      }
    }
  };

  RS.Safestore._rs_supported = function (rs) {
    return true;
  };

  // mrhTODO see dropbox version
  RS.Safestore._rs_cleanup = function (remoteStorage) {
    remoteStorage.setBackend(undefined);
    if (remoteStorage._origRemote) {
      remoteStorage.remote = remoteStorage._origRemote;
      delete remoteStorage._origRemote;
    }
  };

})(this);
