  var Authorize = require('./authorize');
  var BaseClient = require('./baseclient');
  var WireClient = require('./wireclient');
  var util = require('./util');
  var eventHandling = require('./eventhandling');
  var Sync = require('./sync');

  /**
   * File: Dropbox
   *
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   *
   * Dropbox backend for RemoteStorage.js
   * This file exposes a get/put/delete interface which is compatible with
   * <WireClient>.
   *
   * When remoteStorage.backend is set to 'dropbox', this backend will
   * initialize and replace remoteStorage.remote with remoteStorage.dropbox.
   *
   * In order to ensure compatibility with the public folder, <BaseClient.getItemURL>
   * gets hijacked to return the Dropbox public share URL.
   *
   * To use this backend, you need to specify the Dropbox app key like so:
   *
   * (start code)
   *
   * remoteStorage.setApiKeys('dropbox', {
   *   appKey: 'your-app-key'
   * });
   *
   * (end code)
   *
   * An app key can be obtained by registering your app at https://www.dropbox.com/developers/apps
   *
   * Known issues:
   *
   *   - Storing files larger than 150MB is not yet supported
   *   - Listing and deleting folders with more than 10'000 files will cause problems
   *   - Content-Type is not fully supported due to limitations of the Dropbox API
   *   - Dropbox preserves cases but is not case-sensitive
   *   - getItemURL is asynchronous which means getIetmURL returns useful values
   *     after the syncCycle
   */

  var hasLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize';
  var SETTINGS_KEY = 'remotestorage:dropbox';
  var PATH_PREFIX = '/remotestorage';

  var isFolder = util.isFolder;

  /**
   * Function: getDropboxPath(path)
   *
   * Map a local path to a path in DropBox.
   */
  var getDropboxPath = function (path) {
    return WireClient.cleanPath(PATH_PREFIX + '/' + path).replace(/\/$/, '');
  };

  var encodeQuery = function (obj) {
    var pairs = [];

    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
      }
    }

    return pairs.join('&');
  };

  var compareApiError = function (error, expect) {
    if (!expect.length) {
      return true;
    }
    if (typeof error !== 'object' || error['.tag'] !== expect[0]) {
      return false;
    }
    return compareApiError(error[error['.tag']], expect.slice(1));
  };

  /**
   * class: LowerCaseCache
   *
   * A cache which automatically converts all keys to lower case and can
   * propagate changes up to parent folders.
   *
   * By default the set and delete methods are aliased to justSet and justDelete.
   *
   * Parameters:
   *
   *   defaultValue - the value that is returned for all keys that don't exist
   *                  in the cache
   */
  function LowerCaseCache(defaultValue){
    this.defaultValue = defaultValue;
    this._storage = { };
    this.set = this.justSet;
    this.delete = this.justDelete;
  }

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

    /**
     * Method: justSet
     *
     * Set a value without propagating.
     */
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

  var onErrorCb;

  /**
   * Class: Dropbox
   */
  var Dropbox = function (rs) {

    this.rs = rs;
    this.connected = false;
    this.rs = rs;
    var self = this;

    onErrorCb = function (error){
      if (error instanceof Authorize.Unauthorized) {
        // Delete all the settings - see the documentation of wireclient.configure
        self.configure({
          userAddress: null,
          href: null,
          storageApi: null,
          token: null,
          options: null
        });
      }
    };

    eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');
    rs.on('error', onErrorCb);

    this.clientId = rs.apiKeys.dropbox.appKey;
    this._revCache = new LowerCaseCache('rev');
    this._itemRefs = {};

    hasLocalStorage = util.localStorageAvailable();

    if (hasLocalStorage){
      var settings;
      try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      } catch(e){}
      if (settings) {
        this.configure(settings);
      }
      try {
        this._itemRefs = JSON.parse(localStorage.getItem(SETTINGS_KEY+':shares')) || {};
      } catch(e) {  }
    }
    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  Dropbox.prototype = {
    online: true,

    /**
     * Method: connect
     *
     * Set the backed to 'dropbox' and start the authentication flow in order
     * to obtain an API token from Dropbox.
     */
    connect: function () {
      // TODO handling when token is already present
      this.rs.setBackend('dropbox');
      if (this.token){
        hookIt(this.rs);
      } else {
        Authorize(this.rs, AUTH_URL, '', String(Authorize.getLocation()), this.clientId);
      }
    },

    /**
     * Method : configure(settings)
     * Accepts its parameters according to the <WireClient>.
     * Sets the connected flag
     **/
    configure: function (settings) {
      // We only update this.userAddress if settings.userAddress is set to a string or to null:
      if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
      // Same for this.token. If only one of these two is set, we leave the other one at its existing value:
      if (typeof settings.token !== 'undefined') { this.token = settings.token; }

      var writeSettingsToCache = function() {
        if (hasLocalStorage) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            userAddress: this.userAddress,
            token: this.token
          }));
        }
      };

      var handleError = function() {
        this.connected = false;
        if (hasLocalStorage) {
          localStorage.removeItem(SETTINGS_KEY);
        }
      };

      if (this.token) {
        this.connected = true;
        if (this.userAddress) {
          this._emit('connected');
          writeSettingsToCache.apply(this);
        } else {
          this.info().then(function (info){
            this.userAddress = info.email;
            this._emit('connected');
            writeSettingsToCache.apply(this);
          }.bind(this)).catch(function() {
            handleError.apply(this);
            this.rs._emit('error', new Error('Could not fetch user info.'));
          }.bind(this));
        }
      } else {
        handleError.apply(this);
      }
    },

    /**
     * Method: stopWaitingForToken
     *
     * Stop waiting for the token and emit not-connected
     */
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
     *   path - path of the folder to get, with leading slash
     *   options - not used
     *
     * Returns:
     *
     *  statusCode - HTTP status code
     *  body - array of the items found
     *  contentType - 'application/json; charset=UTF-8'
     *  revision - revision of the folder
     */
    _getFolder: function (path, options) {
      var url = 'https://api.dropboxapi.com/2/files/list_folder';
      var revCache = this._revCache;
      var self = this;

      var processResponse = function (resp) {
        var body, listing;

        if (resp.status !== 200) {
          return Promise.reject('Unexpected response status: ' + resp.status);
        }

        try {
          body = JSON.parse(resp.responseText);
        } catch (e) {
          return Promise.reject(e);
        }

        listing = body.entries.reduce(function (map, item) {
          var isDir = item['.tag'] == 'folder';
          var itemName = item.path_lower.split('/').slice(-1)[0] + (isDir ? '/' : '');
          if (isDir){
            map[itemName] = { ETag: revCache.get(path+itemName) };
          } else {
            map[itemName] = { ETag: item.rev };
          }
          return map;
        }, {});

        if (body.has_more) {
          return loadNext(body.cursor).then(function (nextListing) {
            return Object.assign(listing, nextListing);
          });
        }

        return Promise.resolve(listing);
      };

      var loadNext = function (cursor) {
        var url = 'https://api.dropboxapi.com/2/files/list_folder/continue';
        var params = {
          body: {cursor: cursor}
        };

        return self._request('POST', url, params).then(processResponse);
      };

      return this._request('POST', url, {
        body: {
          path: getDropboxPath(path)
        }
      }).then(processResponse).then(function (listing) {
        return Promise.resolve({
          statusCode: 200,
          body: listing,
          contentType: 'application/json; charset=UTF-8',
          revision: revCache.get(path)
        });
      });
    },

    /**
     * Method: get
     *
     * Compatible with <WireClient.get>
     *
     * Checks for the path in _revCache and decides based on that if file has
     * changed. Calls _getFolder is the path points to a folder.
     *
     * Calls <Dropbox.share> afterwards to fill _itemRefs.
     */
    get: function (path, options) {
      if (! this.connected) { return Promise.reject("not connected (path: " + path + ")"); }
      var url = 'https://content.dropboxapi.com/2/files/download';
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
      if (path.substr(-1) === '/') {
        return this._getFolder(path, options);
      }

      var params = {
        headers: {
          'Dropbox-API-Arg': JSON.stringify({path: getDropboxPath(path)})
        }
      };
      if (options && options.ifNoneMatch) {
        params.headers['If-None-Match'] = options.ifNoneMatch;
      }

      return this._request('GET', url, params).then(function (resp) {
        var status = resp.status;
        var meta, body, mime, rev;
        if (status !== 200 && status !== 409) {
          return Promise.resolve({statusCode: status});
        }
        meta = resp.getResponseHeader('Dropbox-API-Result');
        body = resp.responseText;

        if (status === 409) {
          meta = body;
        }

        try {
          meta = JSON.parse(meta);
        } catch(e) {
          return Promise.reject(e);
        }

        if (compareApiError(meta.error, ['path', 'not_found'])) {
          return Promise.resolve({statusCode: 404});
        }

        mime = resp.getResponseHeader('Content-Type');
        rev = meta.rev;
        self._revCache.set(path, rev);
        self._shareIfNeeded(path);

        // handling binary
        if (!mime || mime.match(/charset=binary/)) {
          // TOFIX: would be better to make readBinaryData return a Promise - les
          return new Promise( (resolve, reject) => {
            WireClient.readBinaryData(resp.response, mime, function (result) {
              resolve({
                statusCode: status,
                body: result,
                contentType: mime,
                revision: rev
              });
            });

          });
        }

        // handling json (always try)
        try {
          body = JSON.parse(body);
          mime = 'application/json; charset=UTF-8';
        } catch(e) {
          //Failed parsing Json, assume it is something else then
        }

        return Promise.resolve({statusCode: status, body: body, contentType: mime, revision: rev});
      });
    },

    /**
     * Method: put
     *
     * Compatible with <WireClient>
     *
     * Checks for the path in _revCache and decides based on that if file has
     * changed.
     *
     * Calls <Dropbox.share> afterwards to fill _itemRefs.
     */
    put: function (path, body, contentType, options) {
      var self = this;

      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }

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
          (body instanceof ArrayBuffer || WireClient.isArrayBufferView(body))) {
        contentType += '; charset=binary';
      }

      if (body.length > 150 * 1024 * 1024) {
        //https://www.dropbox.com/developers/core/docs#chunked-upload
        return Promise.reject(new Error("Cannot upload file larger than 150MB"));
      }

      var result;
      var needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
      var uploadParams = {
        body: body,
        contentType: contentType,
        path: path
      };

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

      return result.then(function (ret) {
        self._shareIfNeeded(path);
        return ret;
      });
    },

    /**
     * Method: delete
     *
     * Compatible with <WireClient.delete>
     *
     * Checks for the path in _revCache and decides based on that if file has
     * changed.
     *
     * Calls <Dropbox.share> afterwards to fill _itemRefs.
     */
    'delete': function (path, options) {
      var self = this;

      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }

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
     * Method: _shareIfNeeded
     *
     * Calls share, if the provided path resides in a public folder.
     */
    _shareIfNeeded: function (path) {
      if (path.match(/^\/public\/.*[^\/]$/) && this._itemRefs[path] === undefined) {
        this.share(path);
      }
    },

    /**
     * Method: share
     *
     * Gets a publicly-accessible URL for the path from Dropbox and stores it
     * in _itemRefs.
     *
     * Returns:
     *
     *   A promise for the URL
     */
    share: function (path) {
      var url = 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings';
      var options = {
        body: {path: getDropboxPath(path)}
      };

      return this._request('POST', url, options).then((response) => {
        if (response.status !== 200 && response.status !== 409) {
          return Promise.reject(new Error('Invalid response status:' + response.status));
        }

        var body;

        try {
          body = JSON.parse(response.responseText);
        } catch (e) {
          return Promise.reject(new Error('Invalid response body: ' + response.responseText));
        }

        if (response.status === 409) {
          if (compareApiError(body.error, ['shared_link_already_exists'])) {
            return this._getSharedLink(path);
          }

          return Promise.reject(new Error('API error: ' + body.error_summary));
        }

        return Promise.resolve(body.url);
      }).then((link) => {
        this._itemRefs[path] = link

        if (hasLocalStorage) {
          localStorage.setItem(SETTINGS_KEY+':shares', JSON.stringify(this._itemRefs));
        }

        return Promise.resolve(link);
      }, (error) => {
        error.message = 'Sharing Dropbox file or folder ("' + path + '") failed: ' + error.message;
        return Promise.reject(error);
      });
    },

    /**
     * Method: info
     *
     * Fetches the user's info from dropbox and returns a promise for it.
     *
     * Returns:
     *
     *   A promise to the user's info
     */
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

    /**
     * Method: _request
     *
     * Make a HTTP request.
     *
     * Options:
     *
     *   headers - an object containing the request headers
     *
     * Parameters:
     *
     *   method - the method to use
     *   url - the URL to make the request to
     *   options - see above
     */
    _request: function (method, url, options) {
      var self = this;

      if (!options.headers) {
        options.headers = {};
      }
      options.headers['Authorization'] = 'Bearer ' + this.token;

      if (typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
        options.headers['Content-Type'] = 'application/json; charset=UTF-8';
      }

      this._emit('wire-busy', {
        method: method,
        isFolder: isFolder(url)
      });

      return WireClient.request.call(this, method, url, options).then(function(xhr) {
        // 503 means retry this later
        if (xhr && xhr.status === 503) {
          if (self.online) {
            self.online = false;
            self.rs._emit('network-offline');
          }
          return setTimeout(self._request(method, url, options), 3210);
        } else {
          if (!self.online) {
            self.online = true;
            self.rs._emit('network-online');
          }
          self._emit('wire-done', {
            method: method,
            isFolder: isFolder(url),
            success: true
          });

          return Promise.resolve(xhr);
        }
      }, function(error) {
        if (self.online) {
          self.online = false;
          self.rs._emit('network-offline');
        }
        self._emit('wire-done', {
          method: method,
          isFolder: isFolder(url),
          success: false
        });

        return Promise.reject(error);
      });
    },

    /**
     * Method: fetchDelta
     *
     * Fetches the revision of all the files from dropbox API and puts them
     * into _revCache. These values can then be used to determine if something
     * has changed.
     */
    fetchDelta: function () {
      // TODO: Handle `has_more`

      var args = Array.prototype.slice.call(arguments);
      var self = this;
      var body = { path_prefix: PATH_PREFIX };

      if (self._deltaCursor) {
        body.cursor = self._deltaCursor;
      }

      return self._request('POST', 'https://api.dropbox.com/1/delta', {
        body: encodeQuery(body),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).then(function (response) {
        // break if status != 200
        if (response.status !== 200 ) {
          if (response.status === 400) {
            self.rs._emit('error', new Authorize.Unauthorized());
            return Promise.resolve(args);
          } else {
            return Promise.reject("dropbox.fetchDelta returned "+response.status+response.responseText);
          }
        }

        var delta;
        try {
          delta = JSON.parse(response.responseText);
        } catch(error) {
          log('fetchDeltas can not parse response',error);
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
        this.rs._emit('error', new Sync.SyncError('fetchDeltas failed.' + err));
        return Promise.resolve(args);
      }.bind(this)).then(function () {
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
     * Parameters:
     *
     *   path - the path to get metadata for
     *   options - see above
     *
     * Returns:
     *
     *   A promise for the metadata
     */
    _getMetadata: function (path) {
      var url = 'https://api.dropboxapi.com/2/files/get_metadata';
      var body = {
        path: getDropboxPath(path)
      };

      return this._request('POST', url, {body}).then((response) => {
        if (response.status !== 200 && response.status !== 409) {
          return Promise.reject(new Error('Invalid response status:' + response.status));
        }

        var body;

        try {
          body = JSON.parse(response.responseText);
        } catch (e) {
          return Promise.reject(new Error('Invalid response body: ' + response.responseText));
        }

        if (response.status === 409) {
          if (compareApiError(body.error, ['path', 'not_found'])) {
            return Promise.resolve();
          }

          return Promise.reject(new Error('API error: ' + body.error_summary));
        }

        return Promise.resolve(body);
      }).then(undefined, (error) => {
        error.message = 'Could not load metadata for file or folder ("' + path + '"): ' + error.message;
        return Promise.reject(error);
      });
    },

    /**
     * Method: _uploadSimple
     *
     * Upload a simple file (the size is no more than 150MB).
     *
     * Parameters:
     *
     *   ifMatch - same as for get
     *   path - path of the file
     *   body - contents of the file to upload
     *   contentType - mime type of the file
     *
     * Returns:
     *
     *   statusCode - HTTP status code
     *   revision - revision of the newly-created file, if any
     */
    _uploadSimple: function (params) {
      var url = 'https://content.dropboxapi.com/2/files/upload';
      var args = {
        path: getDropboxPath(params.path),
        mode: {'.tag': 'overwrite'},
        mute: true
      };

      if (params.ifMatch) {
        args.mode = {'.tag': 'update', update: params.ifMatch};
      }

      return this._request('POST', url, {
        body: params.body,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify(args)
        }
      }).then((response) => {
        if (response.status !== 200 && response.status !== 409) {
          return Promise.resolve({statusCode: response.status});
        }

        var body = response.responseText;

        try {
          body = JSON.parse(body);
        } catch (e) {
          return Promise.reject(new Error('Invalid API result: ' + body));
        }

        if (response.status === 409) {
          if (/path\/conflict\//.test(body.error_summary)) {
            return this._getMetadata(params.path).then(function (metadata) {
              return Promise.resolve({
                statusCode: 412,
                revision: metadata.rev
              });
            });
          }
          return Promise.reject(new Error('API error: ' + body.error_summary));
        }

        this._revCache.propagateSet(params.path, body.rev);
        return Promise.resolve({ statusCode: response.status });
      });
    },

    /**
     * Method: _deleteSimple
     *
     * Deletes a file or a folder. If the folder contains more than 10'000 items
     * (recursively) then the operation may not complete successfully. If that
     * is the case, an Error gets thrown.
     *
     * Parameters:
     *
     *   path - the path to delete
     *
     * Returns:
     *
     *   statusCode - HTTP status code
     */
    _deleteSimple: function (path) {
      var self = this;
      var url = 'https://api.dropbox.com/1/fileops/delete?root=auto&path=' + encodeURIComponent(getDropboxPath(path));

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
    },

    /**
     * Method: _getSharedLink
     *
     * Requests the link for an already-shared file or folder.
     *
     * Parameters:
     *
     *   path - path to the file or folder
     *
     * Returns:
     *
     *   the shared link
     */
    _getSharedLink: function (path) {
      var url = 'https://api.dropbox.com/2/sharing/list_shared_links';
      var options = {
        body: {
          path: getDropboxPath(path),
          direct_only: true
        }
      };

      return this._request('POST', url, options).then((response) => {
        if (response.status !== 200 && response.status !== 409) {
          return Promise.reject(new Error('Invalid response status: ' + response.status));
        }

        var body;

        try {
          body = JSON.parse(response.responseText);
        } catch (e) {
          return Promise.reject(new Error('Invalid response body: ' + response.responseText));
        }

        if (response.status === 409) {
          return Promise.reject(new Error('API error: ' + response.error_summary));
        }

        if (!body.links.length) {
          return Promise.reject(new Error('No links returned'));
        }

        return Promise.resolve(body.links[0].url);
      }, (error) => {
        error.message = 'Could not get link to a shared file or folder ("' + path + '"): ' + error.message;
        return Promise.reject(error);
      });
    }
  };

  // Hooking and unhooking the sync

  function hookSync(rs) {
    if (rs._dropboxOrigSync) { return; } // already hooked
    rs._dropboxOrigSync = rs.sync.sync.bind(rs.sync);
    rs.sync.sync = function () {
      return this.dropbox.fetchDelta.apply(this.dropbox, arguments).
        then(rs._dropboxOrigSync, function (err) {
          rs._emit('error', new Sync.SyncError(err));
          return Promise.reject(err);
        });
    }.bind(rs);
  }

  function unHookSync(rs) {
    if (! rs._dropboxOrigSync) { return; } // not hooked
    rs.sync.sync = rs._dropboxOrigSync;
    delete rs._dropboxOrigSync;
  }

  // Hooking and unhooking getItemURL

  function hookGetItemURL(rs) {
    if (rs._origBaseClientGetItemURL) { return; }
    rs._origBaseClientGetItemURL = BaseClient.prototype.getItemURL;
    BaseClient.prototype.getItemURL = function (path){
      var ret = rs.dropbox._itemRefs[path];
      return  ret ? ret : '';
    };
  }

  function unHookGetItemURL(rs){
    if (! rs._origBaseClientGetItemURL) { return; }
    BaseClient.prototype.getItemURL = rs._origBaseClientGetItemURL;
    delete rs._origBaseClientGetItemURL;
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
    } else {
      // when sync is not available yet, we wait for the remote to be connected,
      // at which point sync should be available as well
      rs.on('connected', function() {
        if (rs.sync) {
          hookSync(rs);
        }
      });
    }
    hookGetItemURL(rs);
  }

  function unHookIt(rs){
    unHookRemote(rs);
    unHookSync(rs);
    unHookGetItemURL(rs);
  }

  Dropbox._rs_init = function (rs) {
    hasLocalStorage = util.localStorageAvailable();
    if ( rs.apiKeys.dropbox ) {
      rs.dropbox = new Dropbox(rs);
    }
    if (rs.backend === 'dropbox') {
      hookIt(rs);
    }
  };

  Dropbox._rs_supported = function () {
    return true;
  };

  Dropbox._rs_cleanup = function (rs) {
    unHookIt(rs);
    if (hasLocalStorage){
      localStorage.removeItem(SETTINGS_KEY);
    }
    rs.removeEventListener('error', onErrorCb);
    rs.setBackend(undefined);
  };


  module.exports = Dropbox;
