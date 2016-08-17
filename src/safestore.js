// mrhTODO NEXT: create safestore.js anew (branch feature/safestore-backend-gd)
// mrhTODO       DONE: get working with old encrypted API - commit! tag as safestore-gb-working-00
// mrhTODO       DONE: merge/rebase and check still works with latest remotestorage/src
// mrhTODO       DONE (no changes): integrate diff of upstream/master googledrive.js and start of branch feature/safestore-backend-gd
// mrhTODO       DONE: integrate galfert's connect/setAPI change

// mrhTODO       DONE: test!!!! (may be some bug not always deleting the file when delete the screen object - NOT SEEN, delete works ok)

// mrhTODO       IGNORED: beware breaking go-safe linux cmds by cretz: strip out encryption and base64 encoding
// mrhTODO       NEXT: get working with new unencrypted API - commit!
// mrhTODO       NEXT: when working:
// mrhTODO           NEXT: encryption: remove libsodium from build
// mrhTODO           NEXT: encryption: remove bops from build
// mrhTODO             -> Update compoonents.json, package.json, clean up lib/, remove bower_components/
// mrhTODO           NEXT: retrofit localstorage settings

// mrhTODO      [ ] Review/implement features noted at top of safestore-db.js (local file) up to "create safestore.js anew"
// mrhTODO      (| Promises recursion: http://stackoverflow.com/questions/29020722/recursive-promise-in-javascript/29020886?noredirect=1#comment62855125_29020886)

// mrhTODO - look at how Dropbox overrides BaseClient getItemURL and consider for safestore.js
// mrhTODO   (see https://github.com/remotestorage/remotestorage.js/blob/master/src/dropbox.js#L16-L17)
// mrhTODO
// mrhTODO - review isPrivate / isPathShared values, maybe make App configurable (part of setApiKeys (rename?)
// mrh TODO  Note: when file has own folder can ditch remoteStorage/appname prefix - only use when store is public
// mrhTODO 

// mrhTODO ensure build/components.json includes the required dependencies:
// mrhTODO as per MaidSafe example for now...
// mrhTODO npm install libsodium-wrappers request
// mrhTODO switch from 'request' to XMLHtmlRequest and remove 'request' from build/components.json

// mrhTODO Implement eTag headers when SAFE Launcher API supports them (versioning)
// mrhTODO  (For spec search "Versioning" in https://tools.ietf.org/html/draft-dejong-remotestorage-07)

// mrhTODO Implement CORS headers (RS spec says *all* responses must return CORS headers)

// mrhTODO Review RS spec and check compliance
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

LAUNCHER_URL = 'http://localhost:8100'; // Client device must be running SAFE Launcher which provides REST API

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
  
  // mrhTODO: this...
  var hasLocalStorage;//???
  var SETTINGS_KEY = 'remotestorage:safestore';
  var cleanPath = RS.WireClient.cleanPath;
  var PATH_PREFIX = '/remotestorage/';
  
  var RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

  function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
  }

  // mrhTODO: is this in use?
  function baseName(path) {
    var parts = path.split('/');
    if (path.substr(-1) === '/') {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

  // mrhTODO: is this in use?
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
    this._fileInfoCache = new Cache(60 * 5); // mrhTODO: info expires after 5 minutes (is this a good idea?)

    this.connected = false;

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
//mrhTODO (was from dropbox version - stops connect doing anything)    this.rs.on('error', onErrorCb);

    // mrhTODO port dropbox style load/save settings from localStorage
};

  RS.Safestore.prototype = {
    connected: false,
    online: true,
    isPathShared: true,         // App private storage mrhTODO shared or private? app able to control?
    launcherUrl: LAUNCHER_URL,  // Can be overridden by App

    configure: function (settings) { // Settings parameter compatible with WireClient
      // mrhTODO: review dropbox approach later
      
      if (settings.token) {
        localStorage['remotestorage:safestore:token'] = settings.token;
        this.token = settings.token;
        this.connected = true;
        this.permissions = settings.permissions;    // List of permissions approved by the user

        this._emit('connected');
        RS.log('Safestore.configure() [CONNECTED]');
      } else {
        this.connected = false;
        delete this.token;
        this.permissions = null;
        delete localStorage['remotestorage:safestore:token'];
        RS.log('Safestore.configure() [DISCONNECTED]');
      }
    },

    connect: function () {
      RS.log('Safestore.connect()...');

      // mrhTODO: note dropbox connect calls hookIt() if it has a token - for sync?
      // mrhTODO: note dropbox connect skips auth if it has a token - enables it to remember connection across sessions
      // mrhTODO: if storing Authorization consider security risk - e.g. another app could steal to access SAFE Drive?
      this.rs.setBackend('safestore');
      this.safestoreAuthorize(this.rs.apiKeys['safestore']);
    },

    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    safestoreAuthorize: function (appApiKeys) {
      var self = this;

      // Session data
      this.launcherUrl = LAUNCHER_URL;
      // App can override url by setting appApiKeys.laucherURL
      if ( typeof appApiKeys.launcherURL !== 'undefined' ) { this.launcherUrl = appApiKeys.launcherURL;  }
      // JSON string ("payload") for POST
      this.payload = appApiKeys;     // App calls setApiKeys() to configure persistent part of "payload"

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
        // 401 - Unauthorised
        // 400 - Fields are missing
        if (xhr && (xhr.status === 400 || xhr.status == 401) ) {
          RS.log('Safestore Authorisation Failed');
//mrhTODO causes error:          return Promise.reject({statusCode: xhr.status});
        } else {
          var response = JSON.parse(xhr.responseText);
    
          // Save session info
          self.configure({ 
              token:                response.token,        // Auth token
              permissions:          response.permissions,  // List of permissions approved by the user
            });
          
//mrhTODO:          return Promise.resolve(xhr);
        }
      });
    },
    
    // For reference see WireClient#get (wireclient.js)
    get: function (path, options) {
      RS.log('Safestore.get(' + path + ',...)' );
      var fullPath = RS.WireClient.cleanPath(PATH_PREFIX + '/' + path);

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
    
    put: function (path, body, contentType, options) {
      RS.log('Safestore.put(' + path + ',...)' );
      var fullPath = RS.WireClient.cleanPath(PATH_PREFIX + '/' + path);

      // putDone - handle PUT response codes, optionally decodes metadata from JSON format response
      var self = this;
      function putDone(response) {
        RS.log('Safestore.put putDone(' + response.responseText + ') for path: ' + path );

        if (response.status >= 200 && response.status < 300) {
          return self._getFileInfo(fullPath).then( function (fileInfo){

            var etagWithoutQuotes;
            if ( fileInfo.ETag === 'string') {
              etagWithoutQuotes = fileInfo.ETag.substring(1, fileInfo.ETag.length-1);
            }
            
            return Promise.resolve({statusCode: 200, 'contentType': contentType, revision: etagWithoutQuotes});
          });
        } else if (response.status === 412) {   // Precondition failed
          return Promise.resolve({statusCode: 412, revision: 'conflict'});
        } else {
          return Promise.reject(new Error("PUT failed with status " + response.status + " (" + response.responseText + ")"));
        }
      }
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (fileInfo) {
          if (options && (options.ifNoneMatch === '*')) {
            return putDone({ status: 412 });    // Precondition failed
          }
          return self._updateFile(fullPath, body, contentType, options).then(putDone);
        } else {
          return self._createFile(fullPath, body, contentType, options).then(putDone);
        }
      });
    },

    // mrhTODO: delete bug - when the last file or folder in a folder is deleted that folder 
    // mrhTODO:       must no longer appear in listings of the parent folder, and so should
    // mrhTODO:       be deleted from the SAFE NFS drive, and so on for its parent folder as 
    // mrhTODO:       needed. This is not done currently.
    //
    'delete': function (path, options) {
      RS.log('Safestore.delete(' + path + ',...)' );
      var fullPath = RS.WireClient.cleanPath(PATH_PREFIX + '/' + path);

      RS.log('Safestore.delete: ' + fullPath + ', ...)' );
      var self = this;
      
      
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (!fileInfo) {
          // File doesn't exist. Ignore.
          return Promise.resolve({statusCode: 200});
        }

        var etagWithoutQuotes;
        if (fileInfo.ETag === 'string') {
          etagWithoutQuotes = fileInfo.ETag.substring(1, fileInfo.ETag.length-1);
        }
        if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
          return {statusCode: 412, revision: etagWithoutQuotes};
        }

        var NFStype = ( fullPath.substr(-1)==='/' ? '/nfs/directory/' : '/nfs/file/' );
        var rootPath = ( self.isPathShared ? 'drive/' : 'app/' );
          
        var fullUrl = self.launcherUrl + NFStype + rootPath + encodeURIComponent(fullPath);

        var options = {
          url: fullUrl,
          headers: {
          },
        };

        RS.log('Safestore.delete calling _request( POST, ' + options.url + ', ...)' );
        return self._request('DELETE', options.url, options).then(function (response) {
          if (response.status === 200 || response.status === 204) {
            return Promise.resolve({statusCode: 200});
          } else {
            return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
          }
        });

      });
    },

    // mrhTODO - replace _updateFile / _createFile with single _putFile (as POST /nfs/file now does both)
    // mrhTODO contentType is ignored on update (to change it would require file delete and create before update)
    _updateFile: function (path, body, contentType, options) {
      RS.log('Safestore._updateFile(' + path + ',...)' );
      var self = this;

      /* mrhTODO GoogleDrive only I think...
      if ((!contentType.match(/charset=/)) &&
          (encryptedData instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(encryptedData))) {
        contentType += '; charset=binary';
      }
*/
      
      // STORE/UPDATE FILE CONTENT (PUT) (https://maidsafe.readme.io/docs/nfs-update-file-content)
      var queryParams = 'offset=0';
      var rootPath = ( self.isPathShared ? 'drive/' : 'app/' );
      var urlPUT = self.launcherUrl + '/nfs/file/' + rootPath + encodeURIComponent(path);//mrhTODO + '?' + queryParams;

      // mrhTODO I'm not sure what header/content-type needed for encrypted data
      // mrhTODO Should CT denote the type that is encrypted, or say it's encrypted?
      var optionsPUT = {
          url: urlPUT,
        headers: {
          'Content-Type': contentType
        },
        body: body,
      };

      // mrhTODO googledrive does two PUTs, one initiates resumable tx, the second sends data - review when streaming API avail
      return self._request('PUT', optionsPUT.url, optionsPUT).then(function (response) {
        // self._shareIfNeeded(path);  // mrhTODO what's this? (was part of dropbox.js)
        return response;
      });
    },

    _createFile: function (path, body, contentType, options) {
      RS.log('Safestore._createFile(' + path + ',...)' );
      var self = this;
      
      // Ensure path exists by recursively calling create on parent folder
      return self._makeParentPath(path).then(function (parentPath) {
                
/* mrhTODO GoogleDrive only I think...
         if ((!contentType.match(/charset=/)) &&
            (encryptedData instanceof ArrayBuffer || RS.WireClient.isArrayBufferView(encryptedData))) {
          contentType += '; charset=binary';
        }
*/
        var fileMetadata = {
            mimetype:   contentType,    // WireClient.put provides a mime type which we store as metadata for get
        };
        
        // CREATE/UPDATE FILE (POST) (https://maidsafe.readme.io/docs/nfsfile)
        var queryParams = 'offset=0'; //mrhTODO???
        var rootPath = ( self.isPathShared ? 'drive/' : 'app/' );
        var urlPOST = self.launcherUrl + '/nfs/file/' + rootPath + encodeURIComponent(path);//mrhTODO + '?' + queryParams;

//        var payloadPOST = {
            //metadata:       JSON.stringify(fileMetadata), mrhTODO: test this, with v0.4 API POST causes 400 from SAFE API
//        };

        var optionsPOST = {
            url: urlPOST,
            headers: {
              'Content-Type': 'text/plain', // For POST - not related to contentType (file)
              'Content-Length': body.length,// ???
              //'Metadata:        JSON.stringify(fileMetadata), mrhTODO: test this, with v0.4 API POST causes 400 from SAFE API

            },
            body: body,
          };
        
        return self._request('POST', optionsPOST.url, optionsPOST).then(function (response) {
          // self._shareIfNeeded(path);  // mrhTODO what's this?

          if (response.status !== 200){
            return Promise.reject( {statusCode: reponse.status} );
          }
          else {
            RS.log("DEBUG _createFile() response.responseText: ", response.responseText);
            return Promise.resolve(response);

         }
        });
      });
    },

    // For reference see WireClient#get (wireclient.js)
    _getFile: function (path, options) {
      RS.log('Safestore._getFile(' + path + ', ...)' );
      if (! this.connected) { return Promise.reject("not connected (path: " + path + ")"); }
      var revCache = this._revCache;
      var self = this;

      var rootPath = ( self.isPathShared ? 'drive/' : 'app/' );
      var url = self.launcherUrl + '/nfs/file/' + rootPath + encodeURIComponent(path);//mrhTODO + '?' + queryParams;

      // Check if file exists. Creates parent folder if that doesn't exist.
      return self._getFileInfo(path).then(function (fileInfo) {
        var etagWithoutQuotes;
        if (fileInfo && typeof(fileInfo.ETag) === 'string') {
          etagWithoutQuotes = fileInfo.ETag.substring(1, fileInfo.ETag.length-1);
        }

        // Request is only for changed file, so if eTag matches return "304 Not Modified"
        if (options && options.ifNoneMatch && (etagWithoutQuotes === options.ifNoneMatch)) {
          return Promise.resolve({statusCode: 304});
        }
          
        return self._request('GET', url, {}).then(function (response) {
          var body;
          var status = response.status;

          if (status === 400 || status === 401) {
            return Promise.resolve({statusCode: status});
          }

          body = response.responseText;
          
          /* SAFE NFS API file-metadata - disabled for now:
          var fileMetadata = response.getResponseHeader('file-metadata');
          if (fileMetadata && fileMetadata.length() > 0){
            fileMetadata = JSON.parse(fileMetadata);
          }
          RS.log('..file-metadata: ' + fileMetadata);
          */
            
          var retResponse = {
            statusCode: status, 
            body: body, 
            revision: etagWithoutQuotes,
          };

          if (fileInfo){
            retResponse.contentType = fileInfo.mimetype;
          
            // mrhTODO: This is intended to parse remotestorage JSON format objects, so when saving those
            // mrhTODO: it may be necessary to set memeType in the saved file-metadata
            if (retResponse.contentType.match(/^application\/json/)) {
              try {
                retResponse.body = JSON.parse(body);
              } catch(e) {}
            }            
          }
         
          return Promise.resolve( retResponse );
        });
      });
    },
    
    // _getFolder - obtain folder listing and create parent folder(s) if absent
    //
    // For reference see WireClient#get (wireclient.js) summarised as follows:
    // - parse JSON (spec example: https://github.com/remotestorage/spec/blob/master/release/draft-dejong-remotestorage-07.txt#L223-L235)
    // - return a map of item names to item object mapping values for "Etag:", "Content-Type:" and "Content-Length:"
    // - NOTE: dropbox.js only provides etag, safestore.js provides etag and Content-Length but not Content-Type
    // - NOTE: safestore.js etag values are faked (ie not provided by launcher) but functionally adequate
      
    _getFolder: function (path, options) {
      RS.log('Safestore._getFolder(' + path + ', ...)' );
      var self = this;

      // Check if folder exists. Create parent folder if parent doesn't exist
      return self._getFileInfo(path).then(function (fileInfo) {
        var query, fields, data, i, etagWithoutQuotes, itemsMap;
        if (!fileInfo) {
          return Promise.resolve({statusCode: 404});
        }

        // folder exists so obtain listing
        var rootPath = ( self.isPathShared ? 'drive/' : 'app/' );
        var url = self.launcherUrl + '/nfs/directory/' + rootPath + encodeURIComponent(path);
        var revCache = self._revCache;

        return self._request('GET', url, {}).then(function (resp) {
          var sCode = resp.status;

          // 401 - Unauthorized
          // 400 - Fields are missing
          //if (sCode === 400 || sCode === 401) {
          if (sCode === 401) { // Unuathorized
            return Promise.resolve({statusCode: sCode});
          }

          var listing, listingFiles, listingSubdirectories, body, mime, rev;
          try{
            body = JSON.parse(resp.responseText);
          } catch (e) {
            return Promise.reject(e);
          }
          
          if (body.info) {
            var folderETagWithoutQuotes = path + '-' + body.info.createdOn + '-' + body.info.modifiedOn;
            RS.log('..folder eTag: ' + folderETagWithoutQuotes);
            
            var folderMetadata;
            if ( body.info.metadata ){ 
              folderMetadata = body.info.metadata; 
              RS.log('..folder metadata: ' + folderMetadata);
            }
            
            listingFiles = body.files.reduce(function (m, item) {
              var itemPath = path + item.name;
              
              
              var metadata; // mrhTODO compact next few lines
              if ( item.metadata.length > 0 ) {
                metadata = JSON.parse(metadata);
              }
              else {
                metadata = { mimetype: 'application/json' };  // mrhTODO should never be used
              }

              // mrhTODO: Until SAFE API supports eTags make them manually:
              // mrhTODO: any ASCII char except double quote: https://tools.ietf.org/html/rfc7232#section-2.3
              var eTagWithQuotes = '"' + itemPath + '-' + item.createdOn + '-' + item.modifiedOn + '-' + item.size + '"';
                
              // Add file info to cache
              var fileInfo = {      // Structure members must pass sync.js#corruptServerItemsMap()
                path: itemPath,
                ETag: eTagWithQuotes,
                'Content-Length': item.size,
                mimetype: metadata.mimetype,
                // mimetype: ??? // mrhTODO: "Content-Type" not yet supported
                //                  mrhTODO: (would need to be stored alongside file content and set/updated by _createFile/_updateFile)
              };

              self._fileInfoCache.set(itemPath, fileInfo);
              RS.log('_fileInfoCache.set(' + itemPath  + ', ' + fileInfo + ')' );
              m[item.name] =  fileInfo;              
              return m;
            }, {});

            listingSubdirectories = body.subDirectories.reduce(function (m, item) {
              var itemPath = path + item.name + '/';
              
              // mrhTODO until SAFE API supports eTags make them manually:
              // Create eTag manually (any ASCII char except double quote: https://tools.ietf.org/html/rfc7232#section-2.3)
              var eTagWithQuotes =  '"' + itemPath + '-' + item.createdOn + '-' + item.modifiedOn + '"';
                
              // Add file info to cache
              var fileInfo = { 
                path: itemPath,
                etag: eTagWithQuotes,
              };
              
              self._fileInfoCache.set(itemPath, fileInfo);
              RS.log('_fileInfoCache.set(' + itemPath  + ', ' + fileInfo + ')' );
              m[item.name + '/'] = fileInfo;
              return m;
            }, {});

            // Merge into one listing
            var listing = {};
            for (var attrname in listingFiles) {            listing[attrname] = listingFiles[attrname]; }
            for (var attrname in listingSubdirectories) {   listing[attrname] = listingSubdirectories[attrname]; }          
          }

          RS.log('Safestore._getFolder(' + path + ', ...) RESULT: lising contains ' + JSON.stringify( listing ) );
          return Promise.resolve({statusCode: sCode, body: listing, meta: folderMetadata, contentType: RS_DIR_MIME_TYPE, revision: folderETagWithoutQuotes });
        });
      });
    },

    // Ensure path exists by recursively calling _createFolder if the parent doesn't exist
    _makeParentPath: function (path) {
      RS.log('Safestore._makeParentPath(' + path + ')' );
      var parentFolder = parentPath(path);
      var self = this;
      return self._getFileInfo(parentFolder).then(function (parentInfo) {
        if (parentInfo) {
          return Promise.resolve(parentInfo);
        } else {
          return self._createFolder(parentFolder);
        }
      });
    },

    _createFolder: function (folderPath) {
      RS.log('Safestore._createFolder(' + folderPath + ')' );
      var self = this;

      // Recursively create parent folders
      return self._makeParentPath(folderPath).then(function (parentInfo) {
        // Parent exists so create 'folderPath'
        
//mrhTODO var needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
//mrhTODO the above line is not in the googledrive.js version (must be from my port of dropbox.js)

        
        // CREATE folder (POST) (https://maidsafe.readme.io/docs/nfsfolder)
        var rootPath = ( self.isPathShared ? 'drive/' : 'app/' );
        var urlPOST = self.launcherUrl + '/nfs/directory/' + rootPath + encodeURIComponent(folderPath);

        var payloadPOST = {
//            isPrivate:            self.isPrivate, // mrhTODO is this needed
            metadata:             "",
        };

        var optionsPOST = {
            url: urlPOST,
            headers: {
              'Content-Type': 'text/plain',
            },
            body: JSON.stringify(payloadPOST),
          };
            
        return self._request('POST', optionsPOST.url, optionsPOST).then(function (response) {
//          self._shareIfNeeded(folderPath);  // mrhTODO what's this? (was part of dropbox.js)
          return Promise.resolve(response);
        });
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
      RS.log('Safestore._getFileInfo(' + fullPath + ')' );

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
            });
          }
        }
        
        return Promise.resolve(info);         // Pass back info (null if doesn't exist)
      });
      
    },

    _request: function (method, url, options) {
      RS.log('Safestore._request(' + method + ', ' + url + ', ...)' );
      var self = this;
      if (! options.headers) { options.headers = {}; }
      options.headers['Authorization'] = 'Bearer ' + self.token;
      return RS.WireClient.request.call(self, method, url, options).then(function (xhr) {
        RS.log('Safestore._request() response: xhr.status is ' + xhr.status );
        // Launcher responses
        // 401 - Unauthorized
        // 400 - Fields are missing
        if (xhr && (xhr.status === 400 || xhr.status == 401) ) {
          return Promise.reject({statusCode: xhr.status});
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
