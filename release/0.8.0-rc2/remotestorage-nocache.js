/** remotestorage.js 0.8.0-rc2 remotestorage.io, MIT-licensed **/

/** FILE: lib/promising.js **/
(function(global) {
  function getPromise(builder) {
    var promise;

    if(typeof(builder) === 'function') {
      setTimeout(function() {
        try {
          builder(promise);
        } catch(e) {
          promise.reject(e);
        }
      }, 0);
    }

    var consumers = [], success, result;

    function notifyConsumer(consumer) {
      if(success) {
        var nextValue;
        if(consumer.fulfilled) {
          try {
            nextValue = [consumer.fulfilled.apply(null, result)];
          } catch(exc) {
            consumer.promise.reject(exc);
            return;
          }
        } else {
          nextValue = result;
        }
        if(nextValue[0] && typeof(nextValue[0].then) === 'function') {
          nextValue[0].then(consumer.promise.fulfill, consumer.promise.reject);
        } else {
          consumer.promise.fulfill.apply(null, nextValue);
        }
      } else {
        if(consumer.rejected) {
          var ret;
          try {
            ret = consumer.rejected.apply(null, result);
          } catch(exc) {
            consumer.promise.reject(exc);
            return;
          }
          if(ret && typeof(ret.then) === 'function') {
            ret.then(consumer.promise.fulfill, consumer.promise.reject);
          } else {
            consumer.promise.fulfill(ret);
          }
        } else {
          consumer.promise.reject.apply(null, result);
        }
      }
    }

    function resolve(succ, res) {
      if(result) {
        console.error("WARNING: Can't resolve promise, already resolved!");
        return;
      }
      success = succ;
      result = Array.prototype.slice.call(res);
      setTimeout(function() {
        var cl = consumers.length;
        if(cl === 0 && (! success)) {
          console.error("Possibly uncaught error: ", result, result[0] && result[0].stack);
        }
        for(var i=0;i<cl;i++) {
          notifyConsumer(consumers[i]);
        }
        consumers = undefined;
      }, 0);
    }

    promise = {

      then: function(fulfilled, rejected) {
        var consumer = {
          fulfilled: typeof(fulfilled) === 'function' ? fulfilled : undefined,
          rejected: typeof(rejected) === 'function' ? rejected : undefined,
          promise: getPromise()
        };
        if(result) {
          setTimeout(function() {
            notifyConsumer(consumer)
          }, 0);
        } else {
          consumers.push(consumer);
        }
        return consumer.promise;
      },

      fulfill: function() {
        resolve(true, arguments);
        return this;
      },
      
      reject: function() {
        resolve(false, arguments);
        return this;
      }
      
    };

    return promise;
  };

  global.promising = getPromise;

})(this);


/** FILE: src/remotestorage.js **/
(function() {

  var SyncedGetPutDelete = {
    get: function(path) {
      if(this.caching.cachePath(path)) {
        return this.local.get(path);
      } else {
        return this.remote.get(path);
      }
    },

    put: function(path, body, contentType) {
      if(this.caching.cachePath(path)) {
        return this.local.put(path, body, contentType);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
    },

    'delete': function(path) {
      if(this.caching.cachePath(path)) {
        return this.local.delete(path);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path));
      }
    },

    _wrapBusyDone: function(result) {
      this._emit('sync-busy');
      return result.then(function() {
        var promise = promising();
        this._emit('sync-done');
        return promise.fulfill.apply(promise, arguments);
      }.bind(this), function(err) {
        throw err;
      });
    }
  }

  /**
   * Class: RemoteStorage
   *
   * Constructor for global <remoteStorage> object.
   *
   * This class primarily contains feature detection code and a global convenience API.
   *
   * Depending on which features are built in, it contains different attributes and
   * functions. See the individual features for more information.
   *
   */
  var RemoteStorage = function() {
    RemoteStorage.eventHandling(
      this, 'ready', 'disconnected', 'disconnect', 'conflict', 'error',
      'features-loaded', 'connecting', 'authing', 'sync-busy', 'sync-done'
    );
    // pending get/put/delete calls.
    this._pending = [];
    this._setGPD({
      get: this._pendingGPD('get'),
      put: this._pendingGPD('put'),
      delete: this._pendingGPD('delete')
    });
    this._cleanups = [];
    this._pathHandlers = {};

    this.__defineGetter__('connected', function() {
      return this.remote.connected;
    });

    var origOn = this.on;
    this.on = function(eventName, handler) {
      if(eventName == 'ready' && this.remote.connected && this._allLoaded) {
        setTimeout(handler, 0);
      } else if(eventName == 'features-loaded' && this._allLoaded) {
        setTimeout(handler, 0);
      }
      return origOn.call(this, eventName, handler);
    }

    this._init();

    this.on('ready', function() {
      if(this.local) {
        setTimeout(this.local.fireInitial.bind(this.local), 0);
      }
    }.bind(this));
  };

  RemoteStorage.DiscoveryError = function(message) {
    Error.apply(this, arguments);
    this.message = message;
  };
  RemoteStorage.DiscoveryError.prototype = Object.create(Error.prototype);

  RemoteStorage.Unauthorized = function() { Error.apply(this, arguments); };
  RemoteStorage.Unauthorized.prototype = Object.create(Error.prototype);

  RemoteStorage.log = function() {
    if(RemoteStorage._log) {
      console.log.apply(console, arguments);
    }
  };

  RemoteStorage.prototype = {

    /**
     ** PUBLIC INTERFACE
     **/

    /**
     * Method: connect
     *
     * Connect to a remotestorage server.
     *
     * Parameters:
     *   userAddress - The user address (user@host) to connect to.
     *
     * Discovers the webfinger profile of the given user address and
     * initiates the OAuth dance.
     *
     * This method must be called *after* all required access has been claimed.
     *
     */
    connect: function(userAddress) {
      if( userAddress.indexOf('@') < 0) {
        this._emit('error', new RemoteStorage.DiscoveryError("user adress doesn't contain an @"));
        return;
      }
      this._emit('connecting');
      this.remote.configure(userAddress);
      RemoteStorage.Discover(userAddress,function(href, storageApi, authURL){
        if(!href){
          this._emit('error', new RemoteStorage.DiscoveryError('failed to contact storage server'));
          return;
        }
        this._emit('authing');
        this.remote.configure(userAddress, href, storageApi);
        if(! this.remote.connected) {
          this.authorize(authURL);
        }
      }.bind(this));
    },

    /**
     * Method: disconnect
     *
     * "Disconnect" from remotestorage server to terminate current session.
     * This method clears all stored settings and deletes the entire local cache.
     *
     * Once the disconnect is complete, the "disconnected" event will be fired.
     * From that point on you can connect again (using <connect>).
     */
    disconnect: function() {
      if(this.remote) {
        this.remote.configure(null, null, null, null);
      }
      this._setGPD({
        get: this._pendingGPD('get'),
        put: this._pendingGPD('put'),
        delete: this._pendingGPD('delete')
      });
      var n = this._cleanups.length, i = 0;
      var oneDone = function() {
        i++;
        if(i == n) {
          this._init();
          this._emit('disconnected');
          this._emit('disconnect');// DEPRECATED?
        }
      }.bind(this);
      this._cleanups.forEach(function(cleanup) {
        var cleanupResult = cleanup(this);
        if(typeof(cleanup) == 'object' && typeof(cleanup.then) == 'function') {
          cleanupResult.then(oneDone);
        } else {
          oneDone();
        }
      }.bind(this));
    },

    /**
     * Method: onChange
     *
     * Adds a 'change' event handler to the given path.
     * Whenever a 'change' happens (as determined by the backend, such
     * as <RemoteStorage.IndexedDB>) and the affected path is equal to
     * or below the given 'path', the given handler is called.
     *
     * Parameters:
     *   path    - Absolute path to attach handler to.
     *   handler - Handler function.
     */
    onChange: function(path, handler) {
      if(! this._pathHandlers[path]) {
        this._pathHandlers[path] = [];
      }
      this._pathHandlers[path].push(handler);
    },

    enableLog: function() {
      RemoteStorage._log = true;
    },

    disableLog: function() {
      RemoteStorage._log = false;
    },

    log: function() {
      RemoteStorage.log.apply(RemoteStorage, arguments);
    },

    /**
     ** INITIALIZATION
     **/

    _init: function() {
      this._loadFeatures(function(features) {
        this.log('all features loaded');
        this.local = features.local && new features.local();
        // (this.remote set by WireClient._rs_init
        //  as lazy property on RS.prototype)

        if(this.local && this.remote) {
          this._setGPD(SyncedGetPutDelete, this);
          this._bindChange(this.local);
        } else if(this.remote) {
          this._setGPD(this.remote, this.remote);
        }

        if(this.remote) {
          this.remote.on('connected', function() {
            try {
              this._emit('ready');
            } catch(e) {
              console.error("'ready' failed: ", e, e.stack);
              this._emit('error', e);
            };
          }.bind(this));
          if(this.remote.connected) {
            try {
              this._emit('ready');
            } catch(e) {
              console.error("'ready' failed: ", e, e.stack);
              this._emit('error', e);
            };
          }
        }

        var fl = features.length;
        for(var i=0;i<fl;i++) {
          var cleanup = features[i].cleanup;
          if(cleanup) {
            this._cleanups.push(cleanup);
          }
        }

        try {
          this._allLoaded = true;
          this._emit('features-loaded');
        } catch(exc) {
          console.error("remoteStorage#ready block failed: ");
          if(typeof(exc) == 'string') {
            console.error(exc);
          } else {
            console.error(exc.message, exc.stack);
          }
          this._emit('error', exc);
        }
        this._processPending();
      });
    },

    /**
     ** FEATURE DETECTION
     **/

    _detectFeatures: function() {
      // determine availability
      var features = [
        'WireClient',
        'Access',
        'Caching',
        'Discover',
        'Authorize',
	      'Widget',
        'IndexedDB',
        'LocalStorage',
        'Sync',
        'BaseClient'
      ].map(function(featureName) {
        var impl = RemoteStorage[featureName];
        return {
          name: featureName,
          init: (impl && impl._rs_init),
          supported: impl && (impl._rs_supported ? impl._rs_supported() : true),
          cleanup: ( impl && impl._rs_cleanup )
        };
      }).filter(function(feature) {
        var supported = !! (feature.init && feature.supported);
        this.log("[FEATURE " + feature.name + "] " + (supported ? '' : 'not ') + 'supported.');
        return supported;
      }.bind(this));

      features.forEach(function(feature) {
        if(feature.name == 'IndexedDB') {
          features.local = RemoteStorage.IndexedDB;
        } else if(feature.name == 'LocalStorage' && ! features.local) {
          features.local = RemoteStorage.LocalStorage;
        }
      });
      features.caching = !!RemoteStorage.Caching;
      features.sync = !!RemoteStorage.Sync;

      this.features = features;

      return features;
    },

    _loadFeatures: function(callback) {
      var features = this._detectFeatures();
      var n = features.length, i = 0;
      var self = this;
      function featureDoneCb(name) {
        return function() {
          i++;
          self.log("[FEATURE " + name + "] initialized. (" + i + "/" + n + ")");
          if(i == n)
            setTimeout(function() {
              callback.apply(self, [features]);
            }, 0);
        }
      }
      features.forEach(function(feature) {
        self.log("[FEATURE " + feature.name + "] initializing...");
        var initResult = feature.init(self);
        var cb = featureDoneCb(feature.name);
        if(typeof(initResult) == 'object' && typeof(initResult.then) == 'function') {
          initResult.then(cb);
        } else {
          cb();
        }
      });
    },

    /**
     ** GET/PUT/DELETE INTERFACE HELPERS
     **/

    _setGPD: function(impl, context) {
      this.get = impl.get.bind(context);
      this.put = impl.put.bind(context);
      this.delete = impl.delete.bind(context);
    },

    _pendingGPD: function(methodName) {
      return function() {
        var promise = promising();
        this._pending.push({
          method: methodName,
          args: Array.prototype.slice.call(arguments),
          promise: promise
        });
        return promise;
      }.bind(this);
    },

    _processPending: function() {
      this._pending.forEach(function(pending) {
        this[pending.method].apply(this, pending.args).then(pending.promise.fulfill, pending.promise.reject);
      }.bind(this));
      this._pending = [];
    },

    /**
     ** CHANGE EVENT HANDLING
     **/

    _bindChange: function(object) {
      object.on('change', this._dispatchChange.bind(this));
    },

    _dispatchChange: function(event) {
      for(var path in this._pathHandlers) {
        var pl = path.length;
        this._pathHandlers[path].forEach(function(handler) {
          if(event.path.substr(0, pl) == path) {
            var ev = {};
            for(var key in event) { ev[key] = event[key]; }
            ev.relativePath = event.path.replace(new RegExp('^' + path), '');
            try {
              handler(ev);
            } catch(e) {
              console.error("'change' handler failed: ", e, e.stack);
              this._emit('error', e);
            }
          }
        }.bind(this));
      }
    }
  };

  window.RemoteStorage = RemoteStorage;

})();


/** FILE: src/eventhandling.js **/
(function(global) {
  var methods = {
    /**
     * Method: eventhandling.addEventListener
     *
     * Install an event handler for the given event name.
     */
    addEventListener: function(eventName, handler) {
      this._validateEvent(eventName);
      this._handlers[eventName].push(handler);
    },

    removeEventListener: function(eventName, handler) {
      this._validateEvent(eventName);
      var hl = this._handlers[eventName].length;
      for(var i=0;i<hl;i++) {
        if(this._handlers[eventName][i] === handler) {
          this._handlers[eventName].splice(i, 1);
          return;
        }
      }
    },

    _emit: function(eventName) {
      this._validateEvent(eventName);
      var args = Array.prototype.slice.call(arguments, 1);
      this._handlers[eventName].forEach(function(handler) {
        handler.apply(this, args);
      });
    },

    _validateEvent: function(eventName) {
      if(! (eventName in this._handlers)) {
        throw new Error("Unknown event: " + eventName);
      }
    },

    _delegateEvent: function(eventName, target) {
      target.on(eventName, function(event) {
        this._emit(eventName, event);
      }.bind(this));
    },

    _addEvent: function(eventName) {
      this._handlers[eventName] = [];
    }
  };

  // Method: eventhandling.on
  // Alias for <addEventListener>
  methods.on = methods.addEventListener;

  /**
   * Function: eventHandling
   *
   * Mixes event handling functionality into an object.
   *
   * The first parameter is always the object to be extended.
   * All remaining parameter are expected to be strings, interpreted as valid event
   * names.
   *
   * Example:
   *   (start code)
   *   var MyConstructor = function() {
   *     eventHandling(this, 'connected', 'disconnected');
   *
   *     this._emit('connected');
   *     this._emit('disconnected');
   *     // this would throw an exception:
   *     //this._emit('something-else');
   *   };
   *
   *   var myObject = new MyConstructor();
   *   myObject.on('connected', function() { console.log('connected'); });
   *   myObject.on('disconnected', function() { console.log('disconnected'); });
   *   // this would throw an exception as well:
   *   //myObject.on('something-else', function() {});
   *
   *   (end code)
   */
  RemoteStorage.eventHandling = function(object) {
    var eventNames = Array.prototype.slice.call(arguments, 1);
    for(var key in methods) {
      object[key] = methods[key];
    }
    object._handlers = {};
    eventNames.forEach(function(eventName) {
      object._addEvent(eventName);
    });
  };
})(this);


/** FILE: src/wireclient.js **/
(function(global) {
  var RS = RemoteStorage;

  /**
   * WireClient Interface
   * --------------------
   *
   * This file exposes a get/put/delete interface on top of XMLHttpRequest.
   * It requires to be configured with parameters about the remotestorage server to
   * connect to.
   * Each instance of WireClient is always associated with a single remotestorage
   * server and access token.
   *
   * Usually the WireClient instance can be accessed via `remoteStorage.remote`.
   *
   * This is the get/put/delete interface:
   *
   *   - #get() takes a path and optionally a ifNoneMatch option carrying a version
   *     string to check. It returns a promise that will be fulfilled with the HTTP
   *     response status, the response body, the MIME type as returned in the
   *     'Content-Type' header and the current revision, as returned in the 'ETag'
   *     header.
   *   - #put() takes a path, the request body and a content type string. It also
   *     accepts the ifMatch and ifNoneMatch options, that map to the If-Match and
   *     If-None-Match headers respectively. See the remotestorage-01 specification
   *     for details on handling these headers. It returns a promise, fulfilled with
   *     the same values as the one for #get().
   *   - #delete() takes a path and the ifMatch option as well. It returns a promise
   *     fulfilled with the same values as the one for #get().
   *
   * In addition to this, the WireClient has some compatibility features to work with
   * remotestorage 2012.04 compatible storages. For example it will cache revisions
   * from directory listings in-memory and return them accordingly as the "revision"
   * parameter in response to #get() requests. Similarly it will return 404 when it
   * receives an empty directory listing, to mimic remotestorage-01 behavior. Note
   * that it is not always possible to know the revision beforehand, hence it may
   * be undefined at times (especially for caching-roots).
   */

  var haveLocalStorage;
  var SETTINGS_KEY = "remotestorage:wireclient";

  var API_2012 = 1, API_00 = 2, API_01 = 3, API_HEAD = 4;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  function request(method, uri, token, headers, body, getEtag, fakeRevision) {
    if((method == 'PUT' || method == 'DELETE') && uri[uri.length - 1] == '/') {
      throw "Don't " + method + " on directories!";
    }

    var timedOut = false;
    var timer = setTimeout(function() {
      timedOut = true;
      promise.reject('timeout');
    }, RS.WireClient.REQUEST_TIMEOUT);

    var promise = promising();
    RemoteStorage.log(method, uri);
    var xhr = new XMLHttpRequest();
    xhr.open(method, uri, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    for(var key in headers) {
      if(typeof(headers[key]) !== 'undefined') {
        xhr.setRequestHeader(key, headers[key]);
      }
    }
    xhr.onload = function() {
      if(timedOut) return;
      clearTimeout(timer);
      var mimeType = xhr.getResponseHeader('Content-Type');
      var body = mimeType && mimeType.match(/^application\/json/) ? JSON.parse(xhr.responseText) : xhr.responseText;
      var revision = getEtag ? xhr.getResponseHeader('ETag') : (xhr.status == 200 ? fakeRevision : undefined);
      promise.fulfill(xhr.status, body, mimeType, revision);
    };
    xhr.onerror = function(error) {
      if(timedOut) return;
      clearTimeout(timer);
      promise.reject(error);
    };
    if(typeof(body) === 'object' && !(body instanceof ArrayBuffer)) {
      body = JSON.stringify(body);
    }
    xhr.send(body);
    return promise;
  }

  function cleanPath(path) {
    // strip duplicate slashes.
    return path.replace(/\/+/g, '/');
  }

  RS.WireClient = function(rs) {
    this.connected = false;
    RS.eventHandling(this, 'change', 'connected');
    rs.on('error', function(error){
      if(error instanceof RemoteStorage.Unauthorized){
        this.configure(undefined, undefined, undefined, null);
      }
    }.bind(this))
    if(haveLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {};
      if(settings) {
        this.configure(settings.userAddress, settings.href, settings.storageApi, settings.token);
      }
    }

    this._revisionCache = {};

    if(this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.WireClient.REQUEST_TIMEOUT = 30000;

  RS.WireClient.prototype = {

    configure: function(userAddress, href, storageApi, token) {
      if(typeof(userAddress) !== 'undefined') this.userAddress = userAddress;
      if(typeof(href) !== 'undefined') this.href = href;
      if(typeof(storageApi) !== 'undefined') this.storageApi = storageApi;
      if(typeof(token) !== 'undefined') this.token = token;
      if(typeof(this.storageApi) !== 'undefined') {
        this._storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
        this.supportsRevs = this._storageApi >= API_00;
      }
      if(this.href && this.token) {
        this.connected = true;
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if(haveLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({
          userAddress: this.userAddress,
          href: this.href,
          token: this.token,
          storageApi: this.storageApi
        });
      }
    },

    get: function(path, options) {
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      if(!options) options = {};
      var headers = {};
      if(this.supportsRevs) {
        // setting '' causes the browser (at least chromium) to ommit
        // the If-None-Match header it would normally send.
        headers['If-None-Match'] = options.ifNoneMatch || '';
      } else if(options.ifNoneMatch) {
        var oldRev = this._revisionCache[path];
        if(oldRev === options.ifNoneMatch) {
          return promising().fulfill(412);
        }
      }
      var promise = request('GET', this.href + cleanPath(path), this.token, headers,
                            undefined, this.supportsRevs, this._revisionCache[path]);
      if(this.supportsRevs || path.substr(-1) != '/') {
        return promise;
      } else {
        return promise.then(function(status, body, contentType, revision) {
          if(status == 200 && typeof(body) == 'object') {
            if(Object.keys(body).length === 0) {
              // no children (coerce response to 'not found')
              status = 404;
            } else {
              for(var key in body) {
                this._revisionCache[path + key] = body[key];
              }
            }
          }
          return promising().fulfill(status, body, contentType, revision);
        }.bind(this));
      }
    },

    put: function(path, body, contentType, options) {
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      if(!options) options = {};
      if(! contentType.match(/charset=/)) {
        contentType += '; charset=' + (body instanceof ArrayBuffer ? 'binary' : 'utf-8');
      }
      var headers = { 'Content-Type': contentType };
      if(this.supportsRevs) {
        headers['If-Match'] = options.ifMatch;
        headers['If-None-Match'] = options.ifNoneMatch;
      }
      return request('PUT', this.href + cleanPath(path), this.token,
                     headers, body, this.supportsRevs);
    },

    'delete': function(path, callback, options) {
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      if(!options) options = {};
      return request('DELETE', this.href + cleanPath(path), this.token,
                     this.supportsRevs ? { 'If-Match': options.ifMatch } : {},
                     undefined, this.supportsRevs);
    }

  };

  RS.WireClient._rs_init = function() {
    Object.defineProperty(RS.prototype, 'remote', {
      configurable: true,
      get: function() {
        var wireclient = new RS.WireClient(this);
        Object.defineProperty(this, 'remote', {
          value: wireclient
        });
        return wireclient;
      }
    });
  };

  RS.WireClient._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    return !! global.XMLHttpRequest;
  };

  RS.WireClient._rs_cleanup = function(){
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
  }


})(this);


/** FILE: src/discover.js **/
(function(global) {

  // feature detection flags
  var haveXMLHttpRequest, haveLocalStorage;
  // used to store settings in localStorage
  var SETTINGS_KEY = 'remotestorage:discover';
  // cache loaded from localStorage
  var cachedInfo = {};

  RemoteStorage.Discover = function(userAddress, callback) {
    if(userAddress in cachedInfo) {
      var info = cachedInfo[userAddress];
      callback(info.href, info.type, info.authURL);
      return;
    }
    var hostname = userAddress.split('@')[1]
    var params = '?resource=' + encodeURIComponent('acct:' + userAddress);
    var urls = [
      'https://' + hostname + '/.well-known/webfinger' + params,
      'https://' + hostname + '/.well-known/host-meta.json' + params,
      'http://' + hostname + '/.well-known/webfinger' + params,
      'http://' + hostname + '/.well-known/host-meta.json' + params
    ];
    function tryOne() {
      var xhr = new XMLHttpRequest();
      var url = urls.shift();
      if(! url) return callback();
      RemoteStorage.log('try url', url);
      xhr.open('GET', url, true);
      xhr.onabort = xhr.onerror = function() {
        console.error("webfinger error", arguments, '(', url, ')');
        tryOne();
      }
      xhr.onload = function() {
        if(xhr.status != 200) return tryOne();
        var profile = JSON.parse(xhr.responseText);
        var link;
        profile.links.forEach(function(l) {
          if(l.rel == 'remotestorage') {
            link = l;
          } else if(l.rel == 'remoteStorage' && !link) {
            link = l;
          }
        });
        RemoteStorage.log('got profile', profile, 'and link', link);
        if(link) {
          var authURL = link.properties['auth-endpoint'] ||
            link.properties['http://tools.ietf.org/html/rfc6749#section-4.2'];
          cachedInfo[userAddress] = { href: link.href, type: link.type, authURL: authURL };
          if(haveLocalStorage) {
            localStorage[SETTINGS_KEY] = JSON.stringify({ cache: cachedInfo });
          }
          callback(link.href, link.type, authURL);
        } else {
          tryOne();
        }
      }
      xhr.send();
    }
    tryOne();
  },



  RemoteStorage.Discover._rs_init = function(remoteStorage) {
    if(haveLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {};
      if(settings) {
        cachedInfo = settings.cache;
      }
    }
  };

  RemoteStorage.Discover._rs_supported = function() {
    haveLocalStorage = !! global.localStorage;
    haveXMLHttpRequest = !! global.XMLHttpRequest;
    return haveXMLHttpRequest;
  }

  RemoteStorage.Discover._rs_cleanup = function() {
    if(haveLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(this);


/** FILE: src/authorize.js **/
(function() {

  function extractParams() {
    if(! document.location.hash) return;
    return document.location.hash.slice(1).split('&').reduce(function(m, kvs) {
      var kv = kvs.split('=');
      m[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      return m;
    }, {});
  };

  RemoteStorage.Authorize = function(authURL, storageApi, scopes, redirectUri) {
    RemoteStorage.log('Authorize authURL = ',authURL)
    var scope = [];
    for(var key in scopes) {
      var mode = scopes[key];
      if(key == 'root') {
        if(! storageApi.match(/^draft-dejong-remotestorage-/)) {
          key = '';
        }
      }
      scope.push(key + ':' + mode);
    }
    scope = scope.join(' ');

    var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

    var url = authURL;
    url += authURL.indexOf('?') > 0 ? '&' : '?';
    url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
    url += '&scope=' + encodeURIComponent(scope);
    url += '&client_id=' + encodeURIComponent(clientId);
    document.location = url;
  };

  RemoteStorage.prototype.authorize = function(authURL) {
    RemoteStorage.Authorize(authURL, this.remote.storageApi, this.access.scopeModeMap, String(document.location));
  };

  RemoteStorage.Authorize._rs_init = function(remoteStorage) {
    var params = extractParams();
    if(params) {
      document.location.hash = '';
    }
    remoteStorage.on('features-loaded', function() {
      if(params) {
        if(params.access_token) {
          remoteStorage.remote.configure(undefined, undefined, undefined, params.access_token);
        }
        if(params.remotestorage) {
          remoteStorage.connect(params.remotestorage);
        }
        if(params.error) {
          throw "Authorization server errored: " + params.error;
        }
      }
    });
  }

})();


/** FILE: src/access.js **/
(function(global) {

  var haveLocalStorage = 'localStorage' in global;
  var SETTINGS_KEY = "remotestorage:access";

  RemoteStorage.Access = function() {
    this.reset();

    if(haveLocalStorage) {
      var rawSettings = localStorage[SETTINGS_KEY];
      if(rawSettings) {
        var savedSettings = JSON.parse(rawSettings);
        for(var key in savedSettings) {
          this.set(key, savedSettings[key]);
        }
      }
    }

    this.__defineGetter__('scopes', function() {
      return Object.keys(this.scopeModeMap).map(function(key) {
        return { name: key, mode: this.scopeModeMap[key] };
      }.bind(this));
    });

    this.__defineGetter__('scopeParameter', function() {
      return this.scopes.map(function(scope) {
        return (scope.name === 'root' && this.storageType === '2012.04' ? '' : scope.name) + ':' + scope.mode;
      }.bind(this)).join(' ');
    });
  };

  RemoteStorage.Access.prototype = {
    // not sure yet, if 'set' or 'claim' is better...

    claim: function() {
      this.set.apply(this, arguments);
    },

    set: function(scope, mode) {
      this._adjustRootPaths(scope);
      this.scopeModeMap[scope] = mode;
      this._persist();
    },

    get: function(scope) {
      return this.scopeModeMap[scope];
    },

    remove: function(scope) {
      var savedMap = {};
      for(var name in this.scopeModeMap) {
        savedMap[name] = this.scopeModeMap[name];
      }
      this.reset();
      delete savedMap[scope];
      for(var name in savedMap) {
        this.set(name, savedMap[name]);
      }
      this._persist();
    },

    check: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode === 'r' || actualMode === 'rw');
    },

    reset: function() {
      this.rootPaths = [];
      this.scopeModeMap = {};
    },

    _adjustRootPaths: function(newScope) {
      if('root' in this.scopeModeMap || newScope === 'root') {
        this.rootPaths = ['/'];
      } else if(! (newScope in this.scopeModeMap)) {
        this.rootPaths.push('/' + newScope + '/');
        this.rootPaths.push('/public/' + newScope + '/');
      }
    },

    _persist: function() {
      if(haveLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify(this.scopeModeMap);
      }
    },

    setStorageType: function(type) {
      this.storageType = type;
    }
  };

  Object.defineProperty(RemoteStorage.prototype, 'access', {
    get: function() {
      var access = new RemoteStorage.Access();
      Object.defineProperty(this, 'access', {
        value: access
      });
      return access;
    },
    configurable: true
  });

  function setModuleCaching(remoteStorage, key) {
    if(key == 'root' || key === '') {
      remoteStorage.caching.set('/', { data: true });
    } else {
      remoteStorage.caching.set('/' + key + '/', { data: true });
      remoteStorage.caching.set('/public/' + key + '/', { data: true });
    }
  }

  RemoteStorage.prototype.claimAccess = function(scopes) {
    if(typeof(scopes) === 'object') {
      for(var key in scopes) {
        this.access.claim(key, scopes[key]);
        setModuleCaching(this, key); // legacy hack
      }
    } else {
      this.access.claim(arguments[0], arguments[1])
      setModuleCaching(this, arguments[0]); // legacy hack;
    }
  };

  RemoteStorage.Access._rs_init = function() {};
  RemoteStorage.Access._rs_cleanup = function() {
    if(haveLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(this);


/** FILE: src/assets.js **/
/** THIS FILE WAS GENERATED BY build/compile-assets.js. DO NOT CHANGE IT MANUALLY, BUT INSTEAD CHANGE THE ASSETS IN assets/. **/
RemoteStorage.Assets = {

  connectIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiCiAgIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIgogICB3aWR0aD0iMTYiCiAgIGhlaWdodD0iMTYiCiAgIGlkPSJzdmczODc1IgogICB2ZXJzaW9uPSIxLjEiCiAgIGlua3NjYXBlOnZlcnNpb249IjAuNDguMy4xIHI5ODg2IgogICBzb2RpcG9kaTpkb2NuYW1lPSJ1cGxvYWQuc3ZnIgogICBpbmtzY2FwZTpleHBvcnQtZmlsZW5hbWU9Ii9ob21lL3VzZXIvb3duY2xvdWQvY29yZS9pbWcvYWN0aW9ucy91cGxvYWQtd2hpdGUucG5nIgogICBpbmtzY2FwZTpleHBvcnQteGRwaT0iOTAiCiAgIGlua3NjYXBlOmV4cG9ydC15ZHBpPSI5MCI+CiAgPGRlZnMKICAgICBpZD0iZGVmczM4NzciIC8+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIGlkPSJiYXNlIgogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxLjAiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAuMCIKICAgICBpbmtzY2FwZTpwYWdlc2hhZG93PSIyIgogICAgIGlua3NjYXBlOnpvb209IjQuNDgwNDY4OCIKICAgICBpbmtzY2FwZTpjeD0iMjkuNDk1OTk1IgogICAgIGlua3NjYXBlOmN5PSIxOC43MzQ3MTIiCiAgICAgaW5rc2NhcGU6ZG9jdW1lbnQtdW5pdHM9InB4IgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9ImxheWVyMSIKICAgICBzaG93Z3JpZD0idHJ1ZSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjEyMTUiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iNzc2IgogICAgIGlua3NjYXBlOndpbmRvdy14PSI2NSIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iMjQiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMSI+CiAgICA8aW5rc2NhcGU6Z3JpZAogICAgICAgdHlwZT0ieHlncmlkIgogICAgICAgaWQ9ImdyaWQzODgzIgogICAgICAgZW1wc3BhY2luZz0iNSIKICAgICAgIHZpc2libGU9InRydWUiCiAgICAgICBlbmFibGVkPSJ0cnVlIgogICAgICAgc25hcHZpc2libGVncmlkbGluZXNvbmx5PSJ0cnVlIiAvPgogIDwvc29kaXBvZGk6bmFtZWR2aWV3PgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTM4ODAiPgogICAgPHJkZjpSREY+CiAgICAgIDxjYzpXb3JrCiAgICAgICAgIHJkZjphYm91dD0iIj4KICAgICAgICA8ZGM6Zm9ybWF0PmltYWdlL3N2Zyt4bWw8L2RjOmZvcm1hdD4KICAgICAgICA8ZGM6dHlwZQogICAgICAgICAgIHJkZjpyZXNvdXJjZT0iaHR0cDovL3B1cmwub3JnL2RjL2RjbWl0eXBlL1N0aWxsSW1hZ2UiIC8+CiAgICAgICAgPGRjOnRpdGxlPjwvZGM6dGl0bGU+CiAgICAgIDwvY2M6V29yaz4KICAgIDwvcmRmOlJERj4KICA8L21ldGFkYXRhPgogIDxnCiAgICAgaW5rc2NhcGU6bGFiZWw9IkxheWVyIDEiCiAgICAgaW5rc2NhcGU6Z3JvdXBtb2RlPSJsYXllciIKICAgICBpZD0ibGF5ZXIxIgogICAgIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAsLTEwMzYuMzYyMikiPgogICAgPHBhdGgKICAgICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1vcGFjaXR5OjE7c3Ryb2tlOm5vbmUiCiAgICAgICBkPSJtIDEsMTA0Ny4zNjIyIDAsLTYgNywwIDAsLTQgNyw3IC03LDcgMCwtNCB6IgogICAgICAgaWQ9InBhdGgzMDg2IgogICAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIKICAgICAgIHNvZGlwb2RpOm5vZGV0eXBlcz0iY2NjY2NjY2MiIC8+CiAgPC9nPgo8L3N2Zz4K',
  disconnectIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgdmVyc2lvbj0iMS4wIgogICB3aWR0aD0iMTYiCiAgIGhlaWdodD0iMTYiCiAgIGlkPSJzdmcyNDAzIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjMuMSByOTg4NiIKICAgc29kaXBvZGk6ZG9jbmFtZT0ibG9nb3V0LnN2ZyIKICAgaW5rc2NhcGU6ZXhwb3J0LWZpbGVuYW1lPSJsb2dvdXQucG5nIgogICBpbmtzY2FwZTpleHBvcnQteGRwaT0iOTAiCiAgIGlua3NjYXBlOmV4cG9ydC15ZHBpPSI5MCI+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxIgogICAgIG9iamVjdHRvbGVyYW5jZT0iMTAiCiAgICAgZ3JpZHRvbGVyYW5jZT0iMTAiCiAgICAgZ3VpZGV0b2xlcmFuY2U9IjEwIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxMjE1IgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9Ijc3NiIKICAgICBpZD0ibmFtZWR2aWV3MzA0NyIKICAgICBzaG93Z3JpZD0iZmFsc2UiCiAgICAgaW5rc2NhcGU6em9vbT0iMTIuNjM5NTM0IgogICAgIGlua3NjYXBlOmN4PSIxMy45MzQ0MjMiCiAgICAgaW5rc2NhcGU6Y3k9IjcuODIyNzQyNCIKICAgICBpbmtzY2FwZTp3aW5kb3cteD0iNjUiCiAgICAgaW5rc2NhcGU6d2luZG93LXk9IjI0IgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiCiAgICAgaW5rc2NhcGU6Y3VycmVudC1sYXllcj0ic3ZnMjQwMyIgLz4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGExNSI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGUgLz4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGRlZnMKICAgICBpZD0iZGVmczI0MDUiPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB4MT0iMTEuNjQ0MDY4IgogICAgICAgeTE9IjIuNDk4ODY3OCIKICAgICAgIHgyPSIxMS42NDQwNjgiCiAgICAgICB5Mj0iMTUuMDAyODEiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQyMzkyIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzY3OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09InRyYW5zbGF0ZSgxLjAwMDAwMDEsMS4xOTIwOTI4ZS04KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeDE9IjguNDk2NDc3MSIKICAgICAgIHkxPSItMC4wNjE1NzM3NTkiCiAgICAgICB4Mj0iOC40OTY0NzcxIgogICAgICAgeTI9IjguMDgzMjA5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MjM5NSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM2NzgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4wNTI2MzE2LDAsMCwwLjk4NDM2MjUsMC41Nzg5NDcsMC4wNjAyNDI4MSkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM2NzgiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDM2ODAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZmZmZmY7c3RvcC1vcGFjaXR5OjEiCiAgICAgICAgIG9mZnNldD0iMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3AzNjgyIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTZlNmU2O3N0b3Atb3BhY2l0eToxIgogICAgICAgICBvZmZzZXQ9IjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzNjc4IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50Mzg3OSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjA1MjYzMTYsMCwwLDAuOTg0MzYyNSwwLjU3ODk0NywwLjA2MDI0MjgxKSIKICAgICAgIHgxPSI4LjQ5NjQ3NzEiCiAgICAgICB5MT0iLTAuMDYxNTczNzU5IgogICAgICAgeDI9IjguNDk2NDc3MSIKICAgICAgIHkyPSI4LjA4MzIwOSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzY3OCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM5MDgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJ0cmFuc2xhdGUoMS4wMDAwMDAxLDEuMTkyMDkyOGUtOCkiCiAgICAgICB4MT0iMTEuNjQ0MDY4IgogICAgICAgeTE9IjIuNDk4ODY3OCIKICAgICAgIHgyPSIxMS42NDQwNjgiCiAgICAgICB5Mj0iMTUuMDAyODEiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM2NzgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzOTE0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMDUyNjMxNiwwLDAsMC45ODQzNjI1LDAuNTc4OTQ3LDAuMDYwMjQyODEpIgogICAgICAgeDE9IjguNDk2NDc3MSIKICAgICAgIHkxPSItMC4wNjE1NzM3NTkiCiAgICAgICB4Mj0iOC40OTY0NzcxIgogICAgICAgeTI9IjguMDgzMjA5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzNjc4IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzkxNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09InRyYW5zbGF0ZSgxLjAwMDAwMDEsMS4xOTIwOTI4ZS04KSIKICAgICAgIHgxPSIxMS42NDQwNjgiCiAgICAgICB5MT0iMi40OTg4Njc4IgogICAgICAgeDI9IjExLjY0NDA2OCIKICAgICAgIHkyPSIxNS4wMDI4MSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzY3OCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM5MTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJ0cmFuc2xhdGUoMS4wMDAwMDAxLDEuMTkyMDkyOGUtOCkiCiAgICAgICB4MT0iMTEuNjQ0MDY4IgogICAgICAgeTE9IjIuNDk4ODY3OCIKICAgICAgIHgyPSIxMS42NDQwNjgiCiAgICAgICB5Mj0iMTUuMDAyODEiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM2NzgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzOTIyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMDUyNjMxNiwwLDAsMC45ODQzNjI1LDAuNTc4OTQ3LDAuMDYwMjQyODEpIgogICAgICAgeDE9IjguNDk2NDc3MSIKICAgICAgIHkxPSItMC4wNjE1NzM3NTkiCiAgICAgICB4Mj0iOC40OTY0NzcxIgogICAgICAgeTI9IjguMDgzMjA5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzNjc4IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzkyNSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjA1MjYzMTYsMCwwLDAuOTg0MzYyNSwwLjU3ODk0NywwLjA2MDI0MjgxKSIKICAgICAgIHgxPSI4LjQ5NjQ3NzEiCiAgICAgICB5MT0iLTAuMDYxNTczNzU5IgogICAgICAgeDI9IjguNDk2NDc3MSIKICAgICAgIHkyPSIxNS4yMTY2NzQiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM2NzgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzOTQyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMDUyNjMxNiwwLDAsMC45ODQzNjI1LC0wLjQyMDk4OTY0LDAuMDYwMjQyODEpIgogICAgICAgeDE9IjguNDk2NDc3MSIKICAgICAgIHkxPSItMC4wNjE1NzM3NTkiCiAgICAgICB4Mj0iOC40OTY0NzcxIgogICAgICAgeTI9IjE1LjIxNjY3NCIgLz4KICA8L2RlZnM+CiAgPHBhdGgKICAgICBzb2RpcG9kaTpub2RldHlwZXM9InNjY3NjY3NjY3Nzc2NzY3Nzc2NzY2MiCiAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIKICAgICBzdHlsZT0iZm9udC1zaXplOm1lZGl1bTtmb250LXN0eWxlOm5vcm1hbDtmb250LXZhcmlhbnQ6bm9ybWFsO2ZvbnQtd2VpZ2h0Om5vcm1hbDtmb250LXN0cmV0Y2g6bm9ybWFsO3RleHQtaW5kZW50OjA7dGV4dC1hbGlnbjpzdGFydDt0ZXh0LWRlY29yYXRpb246bm9uZTtsaW5lLWhlaWdodDpub3JtYWw7bGV0dGVyLXNwYWNpbmc6bm9ybWFsO3dvcmQtc3BhY2luZzpub3JtYWw7dGV4dC10cmFuc2Zvcm06bm9uZTtkaXJlY3Rpb246bHRyO2Jsb2NrLXByb2dyZXNzaW9uOnRiO3dyaXRpbmctbW9kZTpsci10Yjt0ZXh0LWFuY2hvcjpzdGFydDtiYXNlbGluZS1zaGlmdDpiYXNlbGluZTtjb2xvcjojMDAwMDAwO2ZpbGw6I2ZmZmZmZjtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MjttYXJrZXI6bm9uZTt2aXNpYmlsaXR5OnZpc2libGU7ZGlzcGxheTppbmxpbmU7b3ZlcmZsb3c6dmlzaWJsZTtlbmFibGUtYmFja2dyb3VuZDphY2N1bXVsYXRlO2ZvbnQtZmFtaWx5OlNhbnM7LWlua3NjYXBlLWZvbnQtc3BlY2lmaWNhdGlvbjpTYW5zIgogICAgIGQ9Im0gOC4wMDAwNjM0LDAgYyAtMC40NzE0MDQ1LDAgLTAuOTYxMDMwNCwwLjU0MTkwMjMgLTAuOTUsMSBsIDAsNiBjIC0wLjAwNzQ3LDAuNTI4MzEyNiAwLjQyMTYzNDYsMSAwLjk1LDEgMC41MjgzNjU0LDAgMC45NTc0NzIsLTAuNDcxNjg3NCAwLjk1LC0xIGwgMCwtNiBjIDAuMDE0NjIyLC0wLjYwNTEwNSAtMC40Nzg1OTU1LC0xIC0wLjk1LC0xIHogbSAtMy4zNDM3NSwyLjUgYyAtMC4wODcxODYsMC4wMTkyOTQgLTAuMTcxNjI1MSwwLjA1MDk1OSAtMC4yNSwwLjA5Mzc1IC0yLjk5OTQ5OTksMS41NzE1MTMzIC0zLjkxODQyODc0LDQuNzk3ODU2NiAtMy4xMjUsNy40Njg3NSBDIDIuMDc0NzQyMSwxMi43MzMzOTMgNC41NjExNzI1LDE1IDcuOTY4ODEzNCwxNSAxMS4zMjc4MzMsMTUgMTMuODQ2MjA0LDEyLjg1MDU2MiAxNC42ODc1NjMsMTAuMjE4NzUgMTUuNTI4OTIyLDcuNTg2OTM3OCAxNC42MzAzNjMsNC4zOTU1NjM4IDExLjU2MjU2MywyLjYyNSAxMS4xMjg5NTcsMi4zNzEzNjM5IDEwLjUwMzY2MSwyLjUzNTEyMiAxMC4yNTAwMzgsMi45Njg3MzU2IDkuOTk2NDE1NCwzLjQwMjM0OTEgMTAuMTYwMTkyLDQuMDI3NjQwMSAxMC41OTM4MTMsNC4yODEyNSBjIDIuMzkwNzkzLDEuMzc5ODMxMSAyLjg4MjQ1MiwzLjQ5NDQxMDkgMi4yODEyNSw1LjM3NSAtMC42MDEyMDIsMS44ODA1ODkgLTIuMzQ0MDM3LDMuNDM3NSAtNC45MDYyNDk2LDMuNDM3NSAtMi41NzU5MjMsMCAtNC4yOTc2MzQsLTEuNjUwMTgxIC00Ljg3NSwtMy41OTM3NSBDIDIuNTE2NDQ3NCw3LjU1NjQzMTMgMy4wNDY5NTE5LDUuNDUxODg4IDUuMjgxMzEzNCw0LjI4MTI1IDUuNjU5OTY1OSw0LjA3NDg4ODcgNS44NjAzNzExLDMuNTg4NzA2NyA1LjczNzEyMjIsMy4xNzU0NjA1IDUuNjEzODczNCwyLjc2MjIxNDQgNS4xNzk4OTM3LDIuNDY1MjM0OSA0Ljc1MDA2MzQsMi41IDQuNzE4ODM4NCwyLjQ5ODQ2IDQuNjg3NTM4NCwyLjQ5ODQ2IDQuNjU2MzEzNCwyLjUgeiIKICAgICBpZD0icGF0aDM3ODEiIC8+Cjwvc3ZnPgo=',
  remoteStorageIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjIgcjk4MTkiCiAgIHNvZGlwb2RpOmRvY25hbWU9InJlbW90ZVN0b3JhZ2UtaWNvbi5zdmciCiAgIGlua3NjYXBlOmV4cG9ydC1maWxlbmFtZT0iL2hvbWUvdXNlci93ZWJzaXRlL2ltZy9yZW1vdGVTdG9yYWdlLWljb24ucG5nIgogICBpbmtzY2FwZTpleHBvcnQteGRwaT0iOTAiCiAgIGlua3NjYXBlOmV4cG9ydC15ZHBpPSI5MCI+CiAgPGRlZnMKICAgICBpZD0iZGVmczQiPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2UyMjFiNztzdG9wLW9wYWNpdHk6MC43NDYxNTM4MzsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTIyMWI3O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwMzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuNzM4NDYxNTU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzkiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGlua3NjYXBlOnBlcnNwZWN0aXZlCiAgICAgICBzb2RpcG9kaTp0eXBlPSJpbmtzY2FwZTpwZXJzcDNkIgogICAgICAgaW5rc2NhcGU6dnBfeD0iMCA6IDUyNi4xODEwOSA6IDEiCiAgICAgICBpbmtzY2FwZTp2cF95PSIwIDogMTAwMCA6IDAiCiAgICAgICBpbmtzY2FwZTp2cF96PSI3NDQuMDk0NDggOiA1MjYuMTgxMDkgOiAxIgogICAgICAgaW5rc2NhcGU6cGVyc3AzZC1vcmlnaW49IjM3Mi4wNDcyNCA6IDM1MC43ODczOSA6IDEiCiAgICAgICBpZD0icGVyc3BlY3RpdmUyOTg1IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iMCIKICAgICAgIHgyPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDE9IjEyOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50Mzg5MCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMiIKICAgICAgIHgxPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEyOCIKICAgICAgIHkyPSIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzOS0wLTgiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjExMiIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMzIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMyIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTMwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MzA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDI1LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni00IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwNDhiZmY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDQ4YmZmO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtODkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0yIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC05Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsMjI0LDEwMjAuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsMTkwLjg1MTI1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDY1LjE0ODc1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQtMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTUtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTkiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC01IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU3LTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTciCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTkiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi04Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS02IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTUiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtMyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ0MzQiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MDgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNzAyLjg1MTI1LDEwNzEuNTAwNSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi04IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw1NzcuMTQ4NzUsMTA3MS41MDA1KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTQ0LC02ZS01KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTE3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1ODQsNzk2LjM2MjEyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNTc3LjE0ODc1LDc3Ny4yMjM4KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDcwMi44NTEyNSw3NzcuMjIzOCkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3MzYsMjU2LjAwMDAyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzc2LDEwNTIuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTY0LDc5Ni4zNjIxMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTM0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDc1NiwyNTYuMDAwMDIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOSIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSw2MCw3MTAuMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTgiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5LTciCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsLTIwLDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktOCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTctOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMy04IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDE2LDMzMC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOS0wIgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLC0yMCw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMi03LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMtMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsNzk3LjUsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni0zIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0yIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTIiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctNiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojODE4MTgxO3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTQiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzcwNzA3MDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjEyNDk5OTk5LDAsMCwwLjE0Mjg1NzEzLDczMy41MDAwMSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NjAxIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDIzNiw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny05IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM4MTgxODE7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzA3MDcwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsODI5LjUwMDAxLDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ2NDUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwyMzYsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni04IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTEiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctMiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowLjczODQ2MTU1OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTIiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDIxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OC0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi0wIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTEiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTYiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctODkiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOS03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zLTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0zIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMyIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1OTA0ZmY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMi04IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNTkwNGZmO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTItNSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtOS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMtOCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTgtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw2NS4xNDg3NSw3NDUuMjIzNzYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTctMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni02LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyMzUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNTI2Ljg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDIzOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw0MDEuMTQ4NzUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDM1Miw0MDMuOTk5OTkpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQ0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw0NjgsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNDAxLjE0ODc1LDk5Ny4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDUyNi44NTEyNSw5OTcuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NDQsNjYwLjAwMDA5KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDQwMS4xNDg3NSw3MDkuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNTI2Ljg1MTI1LDcwOS4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NjAsOTg0LjM2MjMyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQzODctNyIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01MiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC00IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMTM5LjA0NjYsLTM2MC4xNDk5NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY3MywwLDAsMC4xNjY2NjY0Miw5MDcuMTAyMjMsODk3LjEyNjU2KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwxMzkuMDQ2NiwtMzYwLjE0OTk3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI1NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsMTQ1LjE0ODc1LDk5Ny4yMjM4MSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwMzMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSwyNzAuODUxMjUsOTk3LjIyMzgxKSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNS0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSwzMDQsMTI3Mi4zNjIzKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA1OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsLTEwOCwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsLTc0Ljg1MTI1MiwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDYyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDUwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMjcwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMTQ1LjE0ODc1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDcxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxMTIsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjAtNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03NyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9Ijk1Ljk5OTk3NyIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDIwOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDMyMDkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY5OSwwLDAsMC4xNjY2NjY3MywxMjAxLjUzNTgsODc3LjExNDg4KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgPC9kZWZzPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0iYmFzZSIKICAgICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyY29sb3I9IiM2NjY2NjYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMS4wIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwLjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp6b29tPSIxNiIKICAgICBpbmtzY2FwZTpjeD0iMTYuMzA2MTY1IgogICAgIGlua3NjYXBlOmN5PSIxNi4yMzcyMjUiCiAgICAgaW5rc2NhcGU6ZG9jdW1lbnQtdW5pdHM9InB4IgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9ImxheWVyMSIKICAgICBzaG93Z3JpZD0idHJ1ZSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjEyODAiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iNzk5IgogICAgIGlua3NjYXBlOndpbmRvdy14PSIwIgogICAgIGlua3NjYXBlOndpbmRvdy15PSIxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiCiAgICAgZml0LW1hcmdpbi10b3A9IjAiCiAgICAgZml0LW1hcmdpbi1sZWZ0PSIwIgogICAgIGZpdC1tYXJnaW4tcmlnaHQ9IjAiCiAgICAgZml0LW1hcmdpbi1ib3R0b209IjAiCiAgICAgaW5rc2NhcGU6c25hcC1wYWdlPSJ0cnVlIgogICAgIGlua3NjYXBlOnNuYXAtbm9kZXM9InRydWUiCiAgICAgZ3JpZHRvbGVyYW5jZT0iMTAiCiAgICAgc2hvd2JvcmRlcj0idHJ1ZSIKICAgICBzaG93Z3VpZGVzPSJ0cnVlIgogICAgIGlua3NjYXBlOmd1aWRlLWJib3g9InRydWUiPgogICAgPGlua3NjYXBlOmdyaWQKICAgICAgIHR5cGU9Inh5Z3JpZCIKICAgICAgIGlkPSJncmlkMzAyMSIKICAgICAgIGVtcHNwYWNpbmc9IjQiCiAgICAgICB2aXNpYmxlPSJ0cnVlIgogICAgICAgZW5hYmxlZD0idHJ1ZSIKICAgICAgIHNuYXB2aXNpYmxlZ3JpZGxpbmVzb25seT0idHJ1ZSIKICAgICAgIHNwYWNpbmd4PSIxNnB4IgogICAgICAgc3BhY2luZ3k9IjE2cHgiCiAgICAgICBkb3R0ZWQ9InRydWUiIC8+CiAgPC9zb2RpcG9kaTpuYW1lZHZpZXc+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNTc4NSwtOTU2LjM1MTg5KSI+CiAgICA8cGF0aAogICAgICAgc3R5bGU9ImNvbG9yOiMwMDAwMDA7ZmlsbDp1cmwoI3JhZGlhbEdyYWRpZW50MzIwOSk7ZmlsbC1vcGFjaXR5OjE7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOm5vbmU7bWFya2VyOm5vbmU7dmlzaWJpbGl0eTp2aXNpYmxlO2Rpc3BsYXk6aW5saW5lO292ZXJmbG93OnZpc2libGU7ZW5hYmxlLWJhY2tncm91bmQ6YWNjdW11bGF0ZSIKICAgICAgIGQ9Im0gMTM1Mi41Nzg1LDk1Ni4zNTE4OSAwLjI4ODYsMTUuMTM2MjkgMTMuNTY2OCwtNy4xMzUxNiAtMTMuODU1NCwtOC4wMDExMyB6IG0gMCwwIC0xMy44NTU0LDguMDAxMTMgMTMuNTY2Nyw3LjEzNTE2IDAuMjg4NywtMTUuMTM2MjkgeiBtIC0xMy44NTU0LDguMDAxMTMgMCwxNS45OTc3NCAxMi45NTc5LC03LjgxNjIxIC0xMi45NTc5LC04LjE4MTUzIHogbSAwLDE1Ljk5Nzc0IDEzLjg1NTQsOC4wMDExMyAtMC42MDg5LC0xNS4zMTY3IC0xMy4yNDY1LDcuMzE1NTcgeiBtIDEzLjg1NTQsOC4wMDExMyAxMy44NTU0LC04LjAwMTEzIC0xMy4yNTEsLTcuMzE1NTcgLTAuNjA0NCwxNS4zMTY3IHogbSAxMy44NTU0LC04LjAwMTEzIDAsLTE1Ljk5Nzc0IC0xMi45NjI0LDguMTgxNTMgMTIuOTYyNCw3LjgxNjIxIHoiCiAgICAgICBpZD0icGF0aDQwMTYtMy04LTYiCiAgICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDwvZz4KPC9zdmc+Cg==',
  remoteStorageIconError: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjMuMSByOTg4NiIKICAgc29kaXBvZGk6ZG9jbmFtZT0icmVtb3Rlc3RvcmFnZUljb25FcnJvcjIuc3ZnIgogICBpbmtzY2FwZTpleHBvcnQtZmlsZW5hbWU9Ii9ob21lL3VzZXIvcmVtb3Rlc3RvcmFnZS1pY29uLWVycm9yLnBuZyIKICAgaW5rc2NhcGU6ZXhwb3J0LXhkcGk9IjkwIgogICBpbmtzY2FwZTpleHBvcnQteWRwaT0iOTAiPgogIDxkZWZzCiAgICAgaWQ9ImRlZnM0Ij4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAzMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNlMjIxYjc7c3RvcC1vcGFjaXR5OjAuNzQ2MTUzODM7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDAzNSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2UyMjFiNztzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDM3IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDU3NSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3NyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowLjczODQ2MTU1OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4NiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NCI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0NiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkxMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxpbmtzY2FwZTpwZXJzcGVjdGl2ZQogICAgICAgc29kaXBvZGk6dHlwZT0iaW5rc2NhcGU6cGVyc3AzZCIKICAgICAgIGlua3NjYXBlOnZwX3g9IjAgOiA1MjYuMTgxMDkgOiAxIgogICAgICAgaW5rc2NhcGU6dnBfeT0iMCA6IDEwMDAgOiAwIgogICAgICAgaW5rc2NhcGU6dnBfej0iNzQ0LjA5NDQ4IDogNTI2LjE4MTA5IDogMSIKICAgICAgIGlua3NjYXBlOnBlcnNwM2Qtb3JpZ2luPSIzNzIuMDQ3MjQgOiAzNTAuNzg3MzkgOiAxIgogICAgICAgaWQ9InBlcnNwZWN0aXZlMjk4NSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNjNDZmMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9IjAiCiAgICAgICB4Mj0iMTI4IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgxPSIxMjgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4OTAiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzOS0wLTIiCiAgICAgICB4MT0iMTI4IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMjgiCiAgICAgICB5Mj0iMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNlOTAwMDA7c3RvcC1vcGFjaXR5OjAuNzYwNzg0MzM7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNlOTAwMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC04IgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMTIiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjMyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkxMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNjNDZmMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTIiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzOS0wLTMiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkzMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTMwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NDY5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAyNS01IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0zIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDQ4YmZmO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTciCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzA0OGJmZjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzOS0wLTg5IgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTIiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtMiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni0zIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni02IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtNSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTU5IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDIyNCwxMDIwLjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNjEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDE5MC44NTEyNSw3NDUuMjIzNzYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTYzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw2NS4xNDg3NSw3NDUuMjIzNzYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTc0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTIiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTc0LTIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTIiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU1LTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctNyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNSIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1Ny00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTkiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzE3IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzU4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDIwOS4xNDg3NSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzU4LTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi04IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2MC00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDIwOS4xNDg3NSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTItOCI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTMiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTYiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjItNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTYiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC0wIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS04IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUzLTktNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMi03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTUtNy0xIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDIwOS4xNDg3NSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctNy01IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC01LTMiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzE3LTgiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNS01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOS02IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zLTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NDM0IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTA4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDcwMi44NTEyNSwxMDcxLjUwMDUpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MTEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNTc3LjE0ODc1LDEwNzEuNTAwNSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDU0NCwtNmUtNSkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTg0LDc5Ni4zNjIxMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDU3Ny4xNDg3NSw3NzcuMjIzOCkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTIzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSw3MDIuODUxMjUsNzc3LjIyMzgpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzM2LDI1Ni4wMDAwMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTI5IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDc3NiwxMDUyLjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MzIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDU2NCw3OTYuMzYyMTIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUzNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3NTYsMjU2LjAwMDAyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MzkiCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsNjAsNzEwLjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS04IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOS03IgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLC0yMCw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTgiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMi03LTkiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMtOCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwxNiwzMzAuMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MzktMCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwtMjAsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItNy02IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNC0zLTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjEyNDk5OTk5LDAsMCwwLjE0Mjg1NzEzLDc5Ny41LDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYtMyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUtMiIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDU3NS0yIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3LTYiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzgxODE4MTtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3OS00IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3MDcwNzA7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xMjQ5OTk5OSwwLDAsMC4xNDI4NTcxMyw3MzMuNTAwMDEsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDYwMSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwyMzYsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni01IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0zIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctOSIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojODE4MTgxO3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzcwNzA3MDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjEyNDk5OTk5LDAsMCwwLjE0Mjg1NzEzLDgyOS41MDAwMSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NjQ1IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0zIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsMjM2LDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYtOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUtMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDU3NS0xIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3LTIiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MC43Mzg0NjE1NTsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3OS0yIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDE3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDE5IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAyMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgtMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS02IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2MC02IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDIwOS4xNDg3NSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTItMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTAiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTIiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjItMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTciPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC00IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS03IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTAiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUzLTktMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTAiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMi0xIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNC02IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTUtNy03IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDIwOS4xNDg3NSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTItOS01Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctNy03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC01LTgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzE3LTg5IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUtMCIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTUtMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTktNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMy04IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtNyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni0zMiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjc0NTA5ODA1OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTIiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjc0NTA5ODA1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01LTIiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNTkwNGZmO3N0b3Atb3BhY2l0eTowLjc0NTA5ODA1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTItOCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzU5MDRmZjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0yLTUiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTktMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni0zLTgiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC04LTYiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTctMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNjMtOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNjUuMTQ4NzUsNzQ1LjIyMzc2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC03LTMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZDJkZDI2O3N0b3Atb3BhY2l0eTowLjc0NTA5ODA1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtNi0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZDJkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtNS03IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjM1IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDUyNi44NTEyNSwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyMzgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNDAxLjE0ODc1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzNTIsNDAzLjk5OTk5KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0NCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNDY4LDEwMTYuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUtMCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDQwMS4xNDg3NSw5OTcuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSw1MjYuODUxMjUsOTk3LjIyMzkpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNTQ0LDY2MC4wMDAwOSkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw0MDEuMTQ4NzUsNzA5LjIyMzkpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDUyNi44NTEyNSw3MDkuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNTYwLDk4NC4zNjIzMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNTIiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0Mzg3LTciCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNTIiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC00IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTYiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsLTI0NC45NTMzOSw4Ni41MDUwMzUpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTIyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLDEzOS4wNDY2LC0zNjAuMTQ5OTcpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNTIiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTI0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTQ0MzI2NzMsMCwwLDAuMTY2NjY2NDIsOTA3LjEwMjIzLDg5Ny4xMjY1NikiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MzIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMTM5LjA0NjYsLTM2MC4xNDk5NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTctMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDMyNTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDE0NS4xNDg3NSw5OTcuMjIzODEpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDMzIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsMjcwLjg1MTI1LDk5Ny4yMjM4MSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDMyNjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsMzA0LDEyNzIuMzYyMykiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNTgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLC0xMDgsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LC03NC44NTEyNTIsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSw1MC44NTEyNSwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDY1IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDI3MC44NTEyNSwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDY4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDE0NS4xNDg3NSwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA3MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTEyLDEwMTYuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMjAiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTIwLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsLTI0NC45NTMzOSw4Ni41MDUwMzUpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtMjAiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTkiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSI5NS45OTk5NzciCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQyMDgiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQzNjE0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLDIxOS4wNDY2MSw4OS4xNjc3NTcpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQzNjI1IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLDIxOS4wNDY2MSw4OS4xNjc3NTcpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQzMjA5IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTQ0MzI2OTksMCwwLDAuMTY2NjY2NzMsMTIwMS41MzU4LDg3Ny4xMTQ4OCkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogIDwvZGVmcz4KICA8c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgaWQ9ImJhc2UiCiAgICAgcGFnZWNvbG9yPSIjZmZmZmZmIgogICAgIGJvcmRlcmNvbG9yPSIjNjY2NjY2IgogICAgIGJvcmRlcm9wYWNpdHk9IjEuMCIKICAgICBpbmtzY2FwZTpwYWdlb3BhY2l0eT0iMC4wIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6em9vbT0iMTEuMzEzNzA4IgogICAgIGlua3NjYXBlOmN4PSIxNS4yOTc1MjUiCiAgICAgaW5rc2NhcGU6Y3k9IjEwLjkzMzE1MiIKICAgICBpbmtzY2FwZTpkb2N1bWVudC11bml0cz0icHgiCiAgICAgaW5rc2NhcGU6Y3VycmVudC1sYXllcj0ibGF5ZXIxIgogICAgIHNob3dncmlkPSJ0cnVlIgogICAgIGlua3NjYXBlOndpbmRvdy13aWR0aD0iMTIxNSIKICAgICBpbmtzY2FwZTp3aW5kb3ctaGVpZ2h0PSI3NzYiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9IjY1IgogICAgIGlua3NjYXBlOndpbmRvdy15PSIyNCIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIxIgogICAgIGZpdC1tYXJnaW4tdG9wPSIwIgogICAgIGZpdC1tYXJnaW4tbGVmdD0iMCIKICAgICBmaXQtbWFyZ2luLXJpZ2h0PSIwIgogICAgIGZpdC1tYXJnaW4tYm90dG9tPSIwIgogICAgIGlua3NjYXBlOnNuYXAtcGFnZT0idHJ1ZSIKICAgICBpbmtzY2FwZTpzbmFwLW5vZGVzPSJ0cnVlIgogICAgIGdyaWR0b2xlcmFuY2U9IjEwIgogICAgIHNob3dib3JkZXI9InRydWUiCiAgICAgc2hvd2d1aWRlcz0idHJ1ZSIKICAgICBpbmtzY2FwZTpndWlkZS1iYm94PSJ0cnVlIj4KICAgIDxpbmtzY2FwZTpncmlkCiAgICAgICB0eXBlPSJ4eWdyaWQiCiAgICAgICBpZD0iZ3JpZDMwMjEiCiAgICAgICBlbXBzcGFjaW5nPSI0IgogICAgICAgdmlzaWJsZT0idHJ1ZSIKICAgICAgIGVuYWJsZWQ9InRydWUiCiAgICAgICBzbmFwdmlzaWJsZWdyaWRsaW5lc29ubHk9InRydWUiCiAgICAgICBzcGFjaW5neD0iMTZweCIKICAgICAgIHNwYWNpbmd5PSIxNnB4IgogICAgICAgZG90dGVkPSJ0cnVlIiAvPgogIDwvc29kaXBvZGk6bmFtZWR2aWV3PgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTciPgogICAgPHJkZjpSREY+CiAgICAgIDxjYzpXb3JrCiAgICAgICAgIHJkZjphYm91dD0iIj4KICAgICAgICA8ZGM6Zm9ybWF0PmltYWdlL3N2Zyt4bWw8L2RjOmZvcm1hdD4KICAgICAgICA8ZGM6dHlwZQogICAgICAgICAgIHJkZjpyZXNvdXJjZT0iaHR0cDovL3B1cmwub3JnL2RjL2RjbWl0eXBlL1N0aWxsSW1hZ2UiIC8+CiAgICAgICAgPGRjOnRpdGxlPjwvZGM6dGl0bGU+CiAgICAgIDwvY2M6V29yaz4KICAgIDwvcmRmOlJERj4KICA8L21ldGFkYXRhPgogIDxnCiAgICAgaW5rc2NhcGU6bGFiZWw9IkxheWVyIDEiCiAgICAgaW5rc2NhcGU6Z3JvdXBtb2RlPSJsYXllciIKICAgICBpZD0ibGF5ZXIxIgogICAgIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0xMzM2LjU3ODUsLTk1Ni4zNTE4OSkiPgogICAgPHBhdGgKICAgICAgIHN0eWxlPSJjb2xvcjojMDAwMDAwO2ZpbGw6dXJsKCNyYWRpYWxHcmFkaWVudDMyMDkpO2ZpbGwtb3BhY2l0eToxO2ZpbGwtcnVsZTpub256ZXJvO3N0cm9rZTpub25lO21hcmtlcjpub25lO3Zpc2liaWxpdHk6dmlzaWJsZTtkaXNwbGF5OmlubGluZTtvdmVyZmxvdzp2aXNpYmxlO2VuYWJsZS1iYWNrZ3JvdW5kOmFjY3VtdWxhdGUiCiAgICAgICBkPSJtIDEzNTIuNTc4NSw5NTYuMzUxODkgMC4yODg2LDE1LjEzNjI5IDEzLjU2NjgsLTcuMTM1MTYgLTEzLjg1NTQsLTguMDAxMTMgeiBtIDAsMCAtMTMuODU1NCw4LjAwMTEzIDEzLjU2NjcsNy4xMzUxNiAwLjI4ODcsLTE1LjEzNjI5IHogbSAtMTMuODU1NCw4LjAwMTEzIDAsMTUuOTk3NzQgMTIuOTU3OSwtNy44MTYyMSAtMTIuOTU3OSwtOC4xODE1MyB6IG0gMCwxNS45OTc3NCAxMy44NTU0LDguMDAxMTMgLTAuNjA4OSwtMTUuMzE2NyAtMTMuMjQ2NSw3LjMxNTU3IHogbSAxMy44NTU0LDguMDAxMTMgMTMuODU1NCwtOC4wMDExMyAtMTMuMjUxLC03LjMxNTU3IC0wLjYwNDQsMTUuMzE2NyB6IG0gMTMuODU1NCwtOC4wMDExMyAwLC0xNS45OTc3NCAtMTIuOTYyNCw4LjE4MTUzIDEyLjk2MjQsNy44MTYyMSB6IgogICAgICAgaWQ9InBhdGg0MDE2LTMtOC02IgogICAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIgLz4KICA8L2c+Cjwvc3ZnPgo=',
  remoteStorageIconOffline: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjEgcjk3NjAiCiAgIHNvZGlwb2RpOmRvY25hbWU9InJlbW90ZXN0b3JhZ2VJY29uT2ZmbGluZS5zdmciCiAgIGlua3NjYXBlOmV4cG9ydC1maWxlbmFtZT0iL2hvbWUvdXNlci93ZWJzaXRlL2ltZy9yZW1vdGVTdG9yYWdlLWljb24ucG5nIgogICBpbmtzY2FwZTpleHBvcnQteGRwaT0iOTAiCiAgIGlua3NjYXBlOmV4cG9ydC15ZHBpPSI5MCI+CiAgPGRlZnMKICAgICBpZD0iZGVmczQiPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2UyMjFiNztzdG9wLW9wYWNpdHk6MC43NDYxNTM4MzsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTIyMWI3O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwMzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuNzM4NDYxNTU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzkiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGlua3NjYXBlOnBlcnNwZWN0aXZlCiAgICAgICBzb2RpcG9kaTp0eXBlPSJpbmtzY2FwZTpwZXJzcDNkIgogICAgICAgaW5rc2NhcGU6dnBfeD0iMCA6IDUyNi4xODEwOSA6IDEiCiAgICAgICBpbmtzY2FwZTp2cF95PSIwIDogMTAwMCA6IDAiCiAgICAgICBpbmtzY2FwZTp2cF96PSI3NDQuMDk0NDggOiA1MjYuMTgxMDkgOiAxIgogICAgICAgaW5rc2NhcGU6cGVyc3AzZC1vcmlnaW49IjM3Mi4wNDcyNCA6IDM1MC43ODczOSA6IDEiCiAgICAgICBpZD0icGVyc3BlY3RpdmUyOTg1IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iMCIKICAgICAgIHgyPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDE9IjEyOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50Mzg5MCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMiIKICAgICAgIHgxPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEyOCIKICAgICAgIHkyPSIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzY5Njk2OTtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzY3Njc2NztzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzOS0wLTgiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjExMiIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMzIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMyIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTMwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MzA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDI1LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni00IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwNDhiZmY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDQ4YmZmO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtODkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0yIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC05Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsMjI0LDEwMjAuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsMTkwLjg1MTI1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDY1LjE0ODc1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQtMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTUtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTkiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC01IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU3LTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTciCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTkiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi04Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS02IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTUiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtMyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ0MzQiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MDgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNzAyLjg1MTI1LDEwNzEuNTAwNSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi04IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw1NzcuMTQ4NzUsMTA3MS41MDA1KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTQ0LC02ZS01KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTE3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1ODQsNzk2LjM2MjEyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNTc3LjE0ODc1LDc3Ny4yMjM4KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDcwMi44NTEyNSw3NzcuMjIzOCkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3MzYsMjU2LjAwMDAyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzc2LDEwNTIuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTY0LDc5Ni4zNjIxMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTM0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDc1NiwyNTYuMDAwMDIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOSIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSw2MCw3MTAuMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTgiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5LTciCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsLTIwLDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktOCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTctOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMy04IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDE2LDMzMC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOS0wIgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLC0yMCw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMi03LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMtMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsNzk3LjUsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni0zIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0yIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTIiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctNiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojODE4MTgxO3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTQiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzcwNzA3MDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjEyNDk5OTk5LDAsMCwwLjE0Mjg1NzEzLDczMy41MDAwMSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NjAxIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDIzNiw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny05IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM4MTgxODE7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzA3MDcwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsODI5LjUwMDAxLDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ2NDUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwyMzYsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni04IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTEiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctMiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowLjczODQ2MTU1OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTIiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDIxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OC0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi0wIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTEiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTYiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctODkiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOS03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zLTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0zIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMyIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1OTA0ZmY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMi04IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNTkwNGZmO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTItNSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtOS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMtOCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTgtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw2NS4xNDg3NSw3NDUuMjIzNzYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTctMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni02LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyMzUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNTI2Ljg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDIzOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw0MDEuMTQ4NzUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDM1Miw0MDMuOTk5OTkpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQ0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw0NjgsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNDAxLjE0ODc1LDk5Ny4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDUyNi44NTEyNSw5OTcuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NDQsNjYwLjAwMDA5KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDQwMS4xNDg3NSw3MDkuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNTI2Ljg1MTI1LDcwOS4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NjAsOTg0LjM2MjMyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQzODctNyIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01MiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC00IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMTM5LjA0NjYsLTM2MC4xNDk5NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY3MywwLDAsMC4xNjY2NjY0Miw5MDcuMTAyMjMsODk3LjEyNjU2KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwxMzkuMDQ2NiwtMzYwLjE0OTk3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI1NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsMTQ1LjE0ODc1LDk5Ny4yMjM4MSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwMzMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSwyNzAuODUxMjUsOTk3LjIyMzgxKSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNS0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSwzMDQsMTI3Mi4zNjIzKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA1OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsLTEwOCwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsLTc0Ljg1MTI1MiwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDYyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDUwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMjcwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMTQ1LjE0ODc1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDcxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxMTIsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjAtNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03NyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9Ijk1Ljk5OTk3NyIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDIwOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDMyMDkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY5OSwwLDAsMC4xNjY2NjY3MywxMjAxLjUzNTgsODc3LjExNDg4KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgPC9kZWZzPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0iYmFzZSIKICAgICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyY29sb3I9IiM2NjY2NjYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMS4wIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwLjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp6b29tPSIxNiIKICAgICBpbmtzY2FwZTpjeD0iLTUuMTAwMDg1IgogICAgIGlua3NjYXBlOmN5PSIxNi4yMzcyMjUiCiAgICAgaW5rc2NhcGU6ZG9jdW1lbnQtdW5pdHM9InB4IgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9ImxheWVyMSIKICAgICBzaG93Z3JpZD0idHJ1ZSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjEzOTYiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iMTAyNyIKICAgICBpbmtzY2FwZTp3aW5kb3cteD0iMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iMTkiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMSIKICAgICBmaXQtbWFyZ2luLXRvcD0iMCIKICAgICBmaXQtbWFyZ2luLWxlZnQ9IjAiCiAgICAgZml0LW1hcmdpbi1yaWdodD0iMCIKICAgICBmaXQtbWFyZ2luLWJvdHRvbT0iMCIKICAgICBpbmtzY2FwZTpzbmFwLXBhZ2U9InRydWUiCiAgICAgaW5rc2NhcGU6c25hcC1ub2Rlcz0idHJ1ZSIKICAgICBncmlkdG9sZXJhbmNlPSIxMCIKICAgICBzaG93Ym9yZGVyPSJ0cnVlIgogICAgIHNob3dndWlkZXM9InRydWUiCiAgICAgaW5rc2NhcGU6Z3VpZGUtYmJveD0idHJ1ZSI+CiAgICA8aW5rc2NhcGU6Z3JpZAogICAgICAgdHlwZT0ieHlncmlkIgogICAgICAgaWQ9ImdyaWQzMDIxIgogICAgICAgZW1wc3BhY2luZz0iNCIKICAgICAgIHZpc2libGU9InRydWUiCiAgICAgICBlbmFibGVkPSJ0cnVlIgogICAgICAgc25hcHZpc2libGVncmlkbGluZXNvbmx5PSJ0cnVlIgogICAgICAgc3BhY2luZ3g9IjE2cHgiCiAgICAgICBzcGFjaW5neT0iMTZweCIKICAgICAgIGRvdHRlZD0idHJ1ZSIgLz4KICA8L3NvZGlwb2RpOm5hbWVkdmlldz4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGE3Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT48L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZwogICAgIGlua3NjYXBlOmxhYmVsPSJMYXllciAxIgogICAgIGlua3NjYXBlOmdyb3VwbW9kZT0ibGF5ZXIiCiAgICAgaWQ9ImxheWVyMSIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTMzNi41Nzg1LC05NTYuMzUxODkpIj4KICAgIDxwYXRoCiAgICAgICBzdHlsZT0iY29sb3I6IzAwMDAwMDtmaWxsOnVybCgjcmFkaWFsR3JhZGllbnQzMjA5KTtmaWxsLW9wYWNpdHk6MTtmaWxsLXJ1bGU6bm9uemVybztzdHJva2U6bm9uZTttYXJrZXI6bm9uZTt2aXNpYmlsaXR5OnZpc2libGU7ZGlzcGxheTppbmxpbmU7b3ZlcmZsb3c6dmlzaWJsZTtlbmFibGUtYmFja2dyb3VuZDphY2N1bXVsYXRlIgogICAgICAgZD0ibSAxMzUyLjU3ODUsOTU2LjM1MTg5IDAuMjg4NiwxNS4xMzYyOSAxMy41NjY4LC03LjEzNTE2IC0xMy44NTU0LC04LjAwMTEzIHogbSAwLDAgLTEzLjg1NTQsOC4wMDExMyAxMy41NjY3LDcuMTM1MTYgMC4yODg3LC0xNS4xMzYyOSB6IG0gLTEzLjg1NTQsOC4wMDExMyAwLDE1Ljk5Nzc0IDEyLjk1NzksLTcuODE2MjEgLTEyLjk1NzksLTguMTgxNTMgeiBtIDAsMTUuOTk3NzQgMTMuODU1NCw4LjAwMTEzIC0wLjYwODksLTE1LjMxNjcgLTEzLjI0NjUsNy4zMTU1NyB6IG0gMTMuODU1NCw4LjAwMTEzIDEzLjg1NTQsLTguMDAxMTMgLTEzLjI1MSwtNy4zMTU1NyAtMC42MDQ0LDE1LjMxNjcgeiBtIDEzLjg1NTQsLTguMDAxMTMgMCwtMTUuOTk3NzQgLTEyLjk2MjQsOC4xODE1MyAxMi45NjI0LDcuODE2MjEgeiIKICAgICAgIGlkPSJwYXRoNDAxNi0zLTgtNiIKICAgICAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiIC8+CiAgPC9nPgo8L3N2Zz4K',
  syncIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgdmVyc2lvbj0iMS4xIgogICBpZD0iTGF5ZXJfMSIKICAgeD0iMHB4IgogICB5PSIwcHgiCiAgIHdpZHRoPSIxNiIKICAgaGVpZ2h0PSIxNiIKICAgdmlld0JveD0iMCAwIDE1Ljk5OTk5OSAxNiIKICAgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgODcuNSAxMDAiCiAgIHhtbDpzcGFjZT0icHJlc2VydmUiCiAgIGlua3NjYXBlOnZlcnNpb249IjAuNDguMy4xIHI5ODg2IgogICBzb2RpcG9kaTpkb2NuYW1lPSJzeW5jLnN2ZyI+PG1ldGFkYXRhCiAgIGlkPSJtZXRhZGF0YTMwMjIiPjxyZGY6UkRGPjxjYzpXb3JrCiAgICAgICByZGY6YWJvdXQ9IiI+PGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+PGRjOnR5cGUKICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz48L2NjOldvcms+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnMKICAgaWQ9ImRlZnMzMDIwIj4KCQoKCQkKCQkKCQoJCQkKCQkJCgkJCgkJCQoJCQkKCQk8L2RlZnM+PHNvZGlwb2RpOm5hbWVkdmlldwogICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgIGJvcmRlcmNvbG9yPSIjNjY2NjY2IgogICBib3JkZXJvcGFjaXR5PSIxIgogICBvYmplY3R0b2xlcmFuY2U9IjEwIgogICBncmlkdG9sZXJhbmNlPSIxMCIKICAgZ3VpZGV0b2xlcmFuY2U9IjEwIgogICBpbmtzY2FwZTpwYWdlb3BhY2l0eT0iMCIKICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxMjE1IgogICBpbmtzY2FwZTp3aW5kb3ctaGVpZ2h0PSI3NzYiCiAgIGlkPSJuYW1lZHZpZXczMDE4IgogICBzaG93Z3JpZD0iZmFsc2UiCiAgIGZpdC1tYXJnaW4tdG9wPSIwIgogICBmaXQtbWFyZ2luLWxlZnQ9IjEiCiAgIGZpdC1tYXJnaW4tcmlnaHQ9IjEiCiAgIGZpdC1tYXJnaW4tYm90dG9tPSIwIgogICBpbmtzY2FwZTp6b29tPSIyOS4zNDAzODEiCiAgIGlua3NjYXBlOmN4PSI2LjI1OTE1MzUiCiAgIGlua3NjYXBlOmN5PSI3LjU5OTcwNjkiCiAgIGlua3NjYXBlOndpbmRvdy14PSI2NSIKICAgaW5rc2NhcGU6d2luZG93LXk9IjI0IgogICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIxIgogICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJMYXllcl8xIiAvPgo8ZwogICBpZD0iTGF5ZXJfMV8xXyIKICAgZGlzcGxheT0ibm9uZSIKICAgc3R5bGU9ImRpc3BsYXk6bm9uZSIKICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUuNTExMTc3LC03Ni41MjQ5OTcpIj4KCTxwYXRoCiAgIGRpc3BsYXk9ImlubGluZSIKICAgZD0ibSA1MS40NzMsNDIuMjU1IC0yLjIwNSwyLjIxMiBjIDEuNDc4LDEuNDc3IDIuMjk1LDMuNDQyIDIuMjk1LDUuNTMzIDAsNC4zMDkgLTMuNTA0LDcuODEyIC03LjgxMiw3LjgxMiBWIDU2LjI1IGwgLTMuMTI1LDMuMTI1IDMuMTI0LDMuMTI1IHYgLTEuNTYyIGMgNi4wMjksMCAxMC45MzgsLTQuOTA2IDEwLjkzOCwtMTAuOTM4IDAsLTIuOTI3IC0xLjE0MSwtNS42NzYgLTMuMjE1LC03Ljc0NSB6IgogICBpZD0icGF0aDI5OTgiCiAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiCiAgIHN0eWxlPSJmaWxsOiMwMDAwMDA7ZGlzcGxheTppbmxpbmUiIC8+Cgk8cGF0aAogICBkaXNwbGF5PSJpbmxpbmUiCiAgIGQ9Ik0gNDYuODc1LDQwLjYyNSA0My43NSwzNy41IHYgMS41NjIgYyAtNi4wMywwIC0xMC45MzgsNC45MDcgLTEwLjkzOCwxMC45MzggMCwyLjkyNyAxLjE0MSw1LjY3NiAzLjIxNyw3Ljc0NSBsIDIuMjAzLC0yLjIxMiBDIDM2Ljc1NSw1NC4wNTQgMzUuOTM4LDUyLjA5MSAzNS45MzgsNTAgYyAwLC00LjMwOSAzLjUwNCwtNy44MTIgNy44MTIsLTcuODEyIHYgMS41NjIgbCAzLjEyNSwtMy4xMjUgeiIKICAgaWQ9InBhdGgzMDAwIgogICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIgogICBzdHlsZT0iZmlsbDojMDAwMDAwO2Rpc3BsYXk6aW5saW5lIiAvPgo8L2c+CjxnCiAgIGlkPSJMYXllcl8yIgogICBkaXNwbGF5PSJub25lIgogICBzdHlsZT0iZGlzcGxheTpub25lIgogICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtNS41MTExNzcsLTc2LjUyNDk5NykiPgo8L2c+CjxwYXRoCiAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1vcGFjaXR5OjEiCiAgIGQ9Ik0gMTAgMCBMIDkuMjUgMS45MDYyNSBDIDguMjQyMjMyNyAxLjYxMTk4MTUgNS43OTE0MzkzIDEuMTM1NDQzNCAzLjU5Mzc1IDIuODQzNzUgQyAzLjU5Mzc1IDIuODQzNTY1MyAtMC4zMzY0MjI4MiA1LjQzNzkzODMgMS41IDEwLjQzNzUgTCAzLjE1NjI1IDkuNzE4NzUgQyAzLjE1NjI1IDkuNzE4NzUgMS42MTYzNDQgNi42MDY1NzcxIDQuODQzNzUgNC4xODc1IEMgNC44NDM3NSA0LjE4NzUgNi41Mzk1Mzg2IDMuMDUzNjQyNyA4LjUzMTI1IDMuNTkzNzUgTCA3LjgxMjUgNS40MDYyNSBMIDExLjYyNSAzLjc4MTI1IEwgMTAgMCB6ICIKICAgaWQ9InBhdGgzMDA4IiAvPjxwYXRoCiAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1vcGFjaXR5OjEiCiAgIGQ9Ik0gMTQgNS41NjI1IEwgMTIuMzQzNzUgNi4yODEyNSBDIDEyLjM0Mzc1IDYuMjgxMjUgMTMuODg0OTQ5IDkuMzk0NzE1NSAxMC42NTYyNSAxMS44MTI1IEMgMTAuNjU2MjUgMTEuODEyNSA4LjkyODgxNjQgMTIuOTQ2NTUyIDYuOTM3NSAxMi40MDYyNSBMIDcuNjg3NSAxMC41OTM3NSBMIDMuODc1IDEyLjE4NzUgTCA1LjQ2ODc1IDE2IEwgNi4yNSAxNC4wOTM3NSBDIDcuMjYxMjUxOCAxNC4zODg4ODIgOS43MTE1MjY2IDE0Ljg2MDQ5NiAxMS45MDYyNSAxMy4xNTYyNSBDIDExLjkwNjI1IDEzLjE1NjI1IDE1LjgzNDIwNyAxMC41NjIwNjIgMTQgNS41NjI1IHogIgogICBpZD0icGF0aDMwMTQiIC8+Cjwvc3ZnPg==',
  widget: ' <div class="rs-bubble rs-hidden">   <div class="rs-bubble-text remotestorage-initial remotestorage-error remotestorage-authing remotestorage-offline">     <span class="rs-status-text">       Connect <strong>remotestorage</strong>     </span>   </div>   <div class="rs-bubble-expandable">     <!-- error -->     <div class="remotestorage-error">       <pre class="rs-status-text rs-error-msg">ERROR</pre>          <button class="remotestorage-reset">get me out of here</button>     <p class="rs-centered-text"> If this problem persists, please <a href="http://remotestorage.io/community/" target="_blank">let us know</a>!</p>     </div>     <!-- connected -->     <div class="rs-bubble-text remotestorage-connected">       <strong class="userAddress"> User Name </strong>       <span class="remotestorage-unauthorized">         <br/>Unauthorized! Click to reconnect.<br/>       </span>     </div>     <div class="content remotestorage-connected">       <button class="rs-sync" title="sync">  <img>  </button>       <button class="rs-disconnect" title="disconnect">  <img>  </button>     </div>     <!-- initial -->     <form novalidate class="remotestorage-initial">       <input  type="email" placeholder="user@host" name="userAddress" novalidate>       <button class="connect" name="connect" title="connect" disabled="disabled">         <img>       </button>     </form>     <div class="rs-info-msg remotestorage-initial">       This app allows you to use your own storage! Find more info on       <a href="http://remotestorage.io/" target="_blank">remotestorage.io</a>     </div>      </div> </div> <img class="rs-cube rs-action">  ',
  widgetCss: '/** encoding:utf-8 **/ /* RESET */ #remotestorage-widget{text-align:left;}#remotestorage-widget input, #remotestorage-widget button{font-size:11px;}#remotestorage-widget form input[type=email]{margin-bottom:0;/* HTML5 Boilerplate */}#remotestorage-widget form input[type=submit]{margin-top:0;/* HTML5 Boilerplate */}/* /RESET */ #remotestorage-widget, #remotestorage-widget *{-moz-box-sizing:border-box;box-sizing:border-box;}#remotestorage-widget{position:absolute;right:10px;top:10px;font:normal 16px/100% sans-serif !important;user-select:none;-webkit-user-select:none;-moz-user-select:-moz-none;cursor:default;z-index:10000;}#remotestorage-widget .rs-bubble{background:rgba(80, 80, 80, .7);border-radius:5px 15px 5px 5px;color:white;font-size:0.8em;padding:5px;position:absolute;right:3px;top:9px;min-height:24px;white-space:nowrap;text-decoration:none;}#remotestorage-widget .rs-bubble-text{padding-right:32px;/* make sure the bubble doesn\'t "jump" when initially opening. */ min-width:182px;}#remotestorage-widget .rs-action{cursor:pointer;}/* less obtrusive cube when connected */ #remotestorage-widget.remotestorage-state-connected .rs-cube, #remotestorage-widget.remotestorage-state-busy .rs-cube{opacity:.3;-webkit-transition:opacity .3s ease;-moz-transition:opacity .3s ease;-ms-transition:opacity .3s ease;-o-transition:opacity .3s ease;transition:opacity .3s ease;}#remotestorage-widget.remotestorage-state-connected:hover .rs-cube, #remotestorage-widget.remotestorage-state-busy:hover .rs-cube, #remotestorage-widget.remotestorage-state-connected .rs-bubble:not(.rs-hidden) + .rs-cube{opacity:1 !important;}#remotestorage-widget .rs-cube{position:relative;top:5px;right:0;}/* pulsing animation for cube when loading */ #remotestorage-widget .rs-cube.remotestorage-loading{-webkit-animation:remotestorage-loading .5s ease-in-out infinite alternate;-moz-animation:remotestorage-loading .5s ease-in-out infinite alternate;-o-animation:remotestorage-loading .5s ease-in-out infinite alternate;-ms-animation:remotestorage-loading .5s ease-in-out infinite alternate;animation:remotestorage-loading .5s ease-in-out infinite alternate;}@-webkit-keyframes remotestorage-loading{to{opacity:.7}}@-moz-keyframes remotestorage-loading{to{opacity:.7}}@-o-keyframes remotestorage-loading{to{opacity:.7}}@-ms-keyframes remotestorage-loading{to{opacity:.7}}@keyframes remotestorage-loading{to{opacity:.7}}#remotestorage-widget a{text-decoration:underline;color:inherit;}#remotestorage-widget form{margin-top:.7em;position:relative;}#remotestorage-widget form input{display:table-cell;vertical-align:top;border:none;border-radius:6px;font-weight:bold;color:white;outline:none;line-height:1.5em;height:2em;}#remotestorage-widget form input:disabled{color:#999;background:#444 !important;cursor:default !important;}#remotestorage-widget form input[type=email]{background:#000;width:100%;height:26px;padding:0 30px 0 5px;border-top:1px solid #111;border-bottom:1px solid #999;}#remotestorage-widget button:focus, #remotestorage-widget input:focus{box-shadow:0 0 4px #ccc;}#remotestorage-widget form input[type=email]::-webkit-input-placeholder{color:#999;}#remotestorage-widget form input[type=email]:-moz-placeholder{color:#999;}#remotestorage-widget form input[type=email]::-moz-placeholder{color:#999;}#remotestorage-widget form input[type=email]:-ms-input-placeholder{color:#999;}#remotestorage-widget form input[type=submit]{background:#000;cursor:pointer;padding:0 5px;}#remotestorage-widget form input[type=submit]:hover{background:#333;}#remotestorage-widget .rs-info-msg{font-size:10px;color:#eee;margin-top:0.7em;white-space:normal;}#remotestorage-widget .rs-info-msg.last-synced-message{display:inline;white-space:nowrap;margin-bottom:.7em}#remotestorage-widget .rs-info-msg a:hover, #remotestorage-widget .rs-info-msg a:active{color:#fff;}#remotestorage-widget button img{vertical-align:baseline;}#remotestorage-widget button{border:none;border-radius:6px;font-weight:bold;color:white;outline:none;line-height:1.5em;height:26px;width:26px;background:#000;cursor:pointer;margin:0;padding:5px;}#remotestorage-widget button:hover{background:#333;}#remotestorage-widget .rs-bubble button.connect{display:block;background:none;position:absolute;right:0;top:0;opacity:1;/* increase clickable area of connect button */ margin:-5px;padding:10px;width:36px;height:36px;}#remotestorage-widget .rs-bubble button.connect:not([disabled]):hover{background:rgba(150,150,150,.5);}#remotestorage-widget .rs-bubble button.connect[disabled]{opacity:.5;cursor:default !important;}#remotestorage-widget .rs-bubble button.rs-sync{position:relative;left:-5px;bottom:-5px;padding:4px 4px 0 4px;background:#555;}#remotestorage-widget .rs-bubble button.rs-sync:hover{background:#444;}#remotestorage-widget .rs-bubble button.rs-disconnect{background:#721;position:absolute;right:0;bottom:0;padding:4px 4px 0 4px;}#remotestorage-widget .rs-bubble button.rs-disconnect:hover{background:#921;}#remotestorage-widget .remotestorage-error-info{color:#f92;}#remotestorage-widget .remotestorage-reset{width:100%;background:#721;}#remotestorage-widget .remotestorage-reset:hover{background:#921;}#remotestorage-widget .rs-bubble .content{margin-top:7px;}#remotestorage-widget pre{user-select:initial;-webkit-user-select:initial;-moz-user-select:text;max-width:27em;margin-top:1em;overflow:auto;}#remotestorage-widget .rs-centered-text{text-align:center;}#remotestorage-widget .rs-bubble.rs-hidden{padding-bottom:2px;border-radius:5px 15px 15px 5px;}#remotestorage-widget .rs-error-msg{min-height:5em;}.rs-bubble.rs-hidden .rs-bubble-expandable{display:none;}.remotestorage-state-connected .rs-bubble.rs-hidden{display:none;}.remotestorage-connected{display:none;}.remotestorage-state-connected .remotestorage-connected{display:block;}.remotestorage-initial{display:none;}.remotestorage-state-initial .remotestorage-initial{display:block;}.remotestorage-error{display:none;}.remotestorage-state-error .remotestorage-error{display:block;}.remotestorage-state-authing .remotestorage-authing{display:block;}.remotestorage-state-offline .remotestorage-connected, .remotestorage-state-offline .remotestorage-offline{display:block;}.remotestorage-unauthorized{display:none;}.remotestorage-state-unauthorized .rs-bubble.rs-hidden{display:none;}.remotestorage-state-unauthorized .remotestorage-connected, .remotestorage-state-unauthorized .remotestorage-unauthorized{display:block;}.remotestorage-state-unauthorized .rs-sync{display:none;}.remotestorage-state-busy .rs-bubble{display:none;}.remotestorage-state-authing .rs-bubble-expandable{display:none;}'
};


/** FILE: src/widget.js **/
(function(window) {

  var haveLocalStorage;
  var LS_STATE_KEY = "remotestorage:widget:state";
  // states allowed to immediately jump into after a reload.
  var VALID_ENTRY_STATES = {
    initial: true, connected: true, offline: true
  };

  function stateSetter(widget, state) {
    return function() {
      if(haveLocalStorage) {
        localStorage[LS_STATE_KEY] = state;
      }
      if(widget.view) {
        if(widget.rs.remote) {
          widget.view.setUserAddress(widget.rs.remote.userAddress);
        }
        widget.view.setState(state, arguments);
      } else {
        widget._rememberedState = state;
      }
    };
  }
  function errorsHandler(widget){
    //decided to not store error state
    return function(error){
      if(error instanceof RemoteStorage.DiscoveryError) {
        console.error('discovery failed',  error, '"' + error.message + '"');
        widget.view.setState('initial', [error.message]);
      } else if(error instanceof RemoteStorage.SyncError) {
        widget.view.setState('offline', []);
      } else if(error instanceof RemoteStorage.Unauthorized){
        widget.view.setState('unauthorized')
      } else {
        widget.view.setState('error', [error]);
      }
    }
  }
  RemoteStorage.Widget = function(remoteStorage) {

    // setting event listeners on rs events to put
    // the widget into corresponding states
    this.rs = remoteStorage;
    this.rs.on('ready', stateSetter(this, 'connected'));
    this.rs.on('disconnected', stateSetter(this, 'initial'));
    this.rs.on('authing', stateSetter(this, 'authing'));
    this.rs.on('sync-busy', stateSetter(this, 'busy'));
    this.rs.on('sync-done', stateSetter(this, 'connected'));
    this.rs.on('error', errorsHandler(this) );
    if(haveLocalStorage) {
      var state = localStorage[LS_STATE_KEY];
      if(state && VALID_ENTRY_STATES[state]) {
        this._rememberedState = state;
      }
    }
  };

  RemoteStorage.Widget.prototype = {
    // Methods :
    //   display(domID)
    //     displays the widget via the view.display method
    //    returns: this
    //
    //   setView(view)
    //     sets the view and initializes event listeners to
    //     react on widget events
    //

    display: function(domID) {
      if(! this.view) {
        this.setView(new RemoteStorage.Widget.View(domID));
      }
      this.view.display.apply(this.view, arguments);
      return this;
    },

    setView: function(view) {
      this.view = view;
      this.view.on('connect', this.rs.connect.bind(this.rs));
      this.view.on('disconnect', this.rs.disconnect.bind(this.rs));
      if(this.rs.sync) {
        this.view.on('sync', this.rs.sync.bind(this.rs));
      }
      try {
        this.view.on('reset', function(){
          this.rs.on('disconnected', document.location.reload.bind(document.location))
          this.rs.disconnect()
        }.bind(this));
      } catch(e) {
        if(e.message && e.message.match(/Unknown event/)) {
          // ignored. (the 0.7 widget-view interface didn't have a 'reset' event)
        } else {
          throw e;
        }
      }

      if(this._rememberedState) {
        setTimeout(stateSetter(this, this._rememberedState), 0);
        delete this._rememberedState;
      }
    }
  };

  RemoteStorage.prototype.displayWidget = function(domID) {
    this.widget.display(domID);
  };

  RemoteStorage.Widget._rs_init = function(remoteStorage) {
    if(! remoteStorage.widget) {
      remoteStorage.widget = new RemoteStorage.Widget(remoteStorage);
    }
  };

  RemoteStorage.Widget._rs_supported = function(remoteStorage) {
    haveLocalStorage = 'localStorage' in window;
    return true;
  };

})(this);


/** FILE: src/view.js **/
(function(window){


  //
  // helper methods
  //
  var cEl = document.createElement.bind(document);
  function gCl(parent, className) {
    return parent.getElementsByClassName(className)[0];
  }
  function gTl(parent, className) {
    return parent.getElementsByTagName(className)[0];
  }

  function removeClass(el, className) {
    return el.classList.remove(className);
  }

  function addClass(el, className) {
    return el.classList.add(className);
  }

  function stop_propagation(event) {
    if(typeof(event.stopPropagation) == 'function') {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
  }


  RemoteStorage.Widget.View = function() {
    if(typeof(document) === 'undefined') {
      throw "Widget not supported";
    }
    RemoteStorage.eventHandling(this,
                                'connect',
                                'disconnect',
                                'sync',
                                'display',
                                'reset');

    // re-binding the event so they can be called from the window
    for(var event in this.events){
      this.events[event] = this.events[event].bind(this);
    }


    // bubble toggling stuff
    this.toggle_bubble = function(event) {
      if(this.bubble.className.search('rs-hidden') < 0) {
        this.hide_bubble(event);
      } else {
        this.show_bubble(event);
      }
    }.bind(this);

    this.hide_bubble = function(){
      //console.log('hide bubble',this);
      addClass(this.bubble, 'rs-hidden')
      document.body.removeEventListener('click', hide_bubble_on_body_click);
    }.bind(this);

    var hide_bubble_on_body_click = function (event) {
      for(var p = event.target; p != document.body; p = p.parentElement) {
        if(p.id == 'remotestorage-widget') {
          return;
        }
      }
      this.hide_bubble();
    }.bind(this);

    this.show_bubble = function(event){
      //console.log('show bubble',this.bubble,event)
      removeClass(this.bubble, 'rs-hidden');
      if(typeof(event) != 'undefined') {
         stop_propagation(event);
       }
      document.body.addEventListener('click', hide_bubble_on_body_click);
      gTl(this.bubble,'form').userAddress.focus();
    }.bind(this);


    this.display = function(domID) {

      if(typeof(this.div) !== 'undefined')
        return this.div;

      var element = cEl('div');
      var style = cEl('style');
      style.innerHTML = RemoteStorage.Assets.widgetCss;

      element.id = "remotestorage-widget";

      element.innerHTML = RemoteStorage.Assets.widget;


      element.appendChild(style);
      if(domID) {
        var parent = document.getElementById(domID);
        if(! parent) {
          throw "Failed to find target DOM element with id=\"" + domID + "\"";
        }
        parent.appendChild(element);
      } else {
        document.body.appendChild(element);
      }

      var el;
      //sync button
      el = gCl(element, 'rs-sync');
      gTl(el, 'img').src = RemoteStorage.Assets.syncIcon;
      el.addEventListener('click', this.events.sync);

      //disconnect button
      el = gCl(element, 'rs-disconnect');
      gTl(el, 'img').src = RemoteStorage.Assets.disconnectIcon;
      el.addEventListener('click', this.events.disconnect);


      //get me out of here
      var el = gCl(element, 'remotestorage-reset').addEventListener('click', this.events.reset);
      //connect button
      var cb = gCl(element,'connect');
      gTl(cb, 'img').src = RemoteStorage.Assets.connectIcon;
      cb.addEventListener('click', this.events.connect);


      // input
      this.form = gTl(element, 'form')
      el = this.form.userAddress;
      el.addEventListener('keyup', function(event) {
        if(event.target.value) cb.removeAttribute('disabled');
        else cb.setAttribute('disabled','disabled');
      });
      if(this.userAddress) {
        el.value = this.userAddress;
      }

      //the cube
      el = gCl(element, 'rs-cube');
      el.src = RemoteStorage.Assets.remoteStorageIcon;
      el.addEventListener('click', this.toggle_bubble);
      this.cube = el

      //the bubble
      this.bubble = gCl(element,'rs-bubble');
      // what is the meaning of this hiding the b
      var bubbleDontCatch = { INPUT: true, BUTTON: true, IMG: true };
      this.bubble.addEventListener('click', function(event) {
        if(! bubbleDontCatch[event.target.tagName] && ! (this.div.classList.contains('remotestorage-state-unauthorized') )) {

          this.show_bubble(event);
        };
      }.bind(this))
      this.hide_bubble();

      this.div = element;

      this.states.initial.call(this);
      this.events.display.call(this);
      return this.div;
    };

  }

  RemoteStorage.Widget.View.prototype = {

    // Methods:
    //
    //  display(domID)
    //    draws the widget inside of the dom element with the id domID
    //   returns: the widget div
    //
    //  showBubble()
    //    shows the bubble
    //  hideBubble()
    //    hides the bubble
    //  toggleBubble()
    //    shows the bubble when hidden and the other way around
    //
    //  setState(state, args)
    //    calls states[state]
    //    args are the arguments for the
    //    state(errors mostly)
    //
    // setUserAddres
    //    set userAddress of the input field
    //
    // States:
    //  initial      - not connected
    //  authing      - in auth flow
    //  connected    - connected to remote storage, not syncing at the moment
    //  busy         - connected, syncing at the moment
    //  offline      - connected, but no network connectivity
    //  error        - connected, but sync error happened
    //  unauthorized - connected, but request returned 401
    //
    // Events:
    // connect    : fired when the connect button is clicked
    // sync       : fired when the sync button is clicked
    // disconnect : fired when the disconnect button is clicked
    // reset      : fired after crash triggers disconnect
    // display    : fired when finished displaying the widget
    setState : function(state, args) {
      RemoteStorage.log('widget.view.setState(',state,',',args,');');
      var s = this.states[state];
      if(typeof(s) === 'undefined') {
        throw new Error("Bad State assigned to view: " + state);
      }
      s.apply(this,args);
    },
    setUserAddress : function(addr) {
      this.userAddress = addr || '';

      var el;
      if(this.div && (el = gTl(this.div, 'form').userAddress)) {
        el.value = this.userAddress;
      }
    },

    states :  {
      initial : function(message) {
        var cube = this.cube;
        var info = message || 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/" target="_blank">remotestorage.io';
        if(message) {
          cube.src = RemoteStorage.Assets.remoteStorageIconError;
          removeClass(this.cube, 'remotestorage-loading');
          this.show_bubble();
          setTimeout(function(){
            cube.src = RemoteStorage.Assets.remoteStorageIcon;
          },3512)
        } else {
          this.hide_bubble();
        }
        this.div.className = "remotestorage-state-initial";
        gCl(this.div, 'rs-status-text').innerHTML = "Connect <strong>remotestorage</strong>";

        //if address not empty connect button enabled
        //TODO check if this works
        var cb = gCl(this.div, 'connect')
        if(cb.value)
          cb.removeAttribute('disabled');

        var infoEl = gCl(this.div, 'rs-info-msg');
        infoEl.innerHTML = info;

        if(message) {
          infoEl.classList.add('remotestorage-error-info');
        } else {
          infoEl.classList.remove('remotestorage-error-info');
        }

      },
      authing : function() {
        this.div.removeEventListener('click', this.events.connect);
        this.div.className = "remotestorage-state-authing";
        gCl(this.div, 'rs-status-text').innerHTML = "Connecting <strong>"+this.userAddress+"</strong>";
        addClass(this.cube, 'remotestorage-loading'); //TODO needs to be undone, when is that neccesary
      },
      connected : function() {
        this.div.className = "remotestorage-state-connected";
        gCl(this.div, 'userAddress').innerHTML = this.userAddress;
        this.cube.src = RemoteStorage.Assets.remoteStorageIcon;
        removeClass(this.cube, 'remotestorage-loading');
      },
      busy : function() {
        this.div.className = "remotestorage-state-busy";
        addClass(this.cube, 'remotestorage-loading'); //TODO needs to be undone when is that neccesary
        this.hide_bubble();
      },
      offline : function() {
        this.div.className = "remotestorage-state-offline";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconOffline;
        gCl(this.div, 'rs-status-text').innerHTML = 'Offline';
      },
      error : function(err) {
        var errorMsg = err;
        this.div.className = "remotestorage-state-error";

        gCl(this.div, 'bubble-text').innerHTML = '<strong> Sorry! An error occured.</strong>'
        if(err instanceof Error || err instanceof DOMError) {
          errorMsg = err.message + '\n\n' +
            err.stack;
        }
        gCl(this.div, 'rs-error-msg').textContent = errorMsg;
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.show_bubble();
      },
      unauthorized : function() {
        this.div.className = "remotestorage-state-unauthorized";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.show_bubble();
        this.div.addEventListener('click', this.events.connect);
      }
    },

    events : {
      connect : function(event) {
        stop_propagation(event);
        event.preventDefault();
        this._emit('connect', gTl(this.div, 'form').userAddress.value);
      },
      sync : function(event) {
        stop_propagation(event);
        event.preventDefault();

        this._emit('sync');
      },
      disconnect : function(event) {
        stop_propagation(event);
        event.preventDefault();
        this._emit('disconnect');
      },
      reset : function(event){
        event.preventDefault();
        var result = window.confirm("Are you sure you want to reset everything? That will probably make the error go away, but also clear your entire localStorage and reload the page. Please make sure you know what you are doing, before clicking 'yes' :-)");
        if(result){
          this._emit('reset');
        }
      },
      display : function(event) {
        if(event)
          event.preventDefault();
        this._emit('display');
      }
    }
  };
})(this);


/** FILE: lib/tv4.js **/
/**
Author: Geraint Luff and others
Year: 2013

This code is released into the "public domain" by its author(s).  Anybody may use, alter and distribute the code without restriction.  The author makes no guarantees, and takes no liability of any kind for use of this code.

If you find a bug or make an improvement, it would be courteous to let the author know, but it is not compulsory.
**/

(function (global) {
var ValidatorContext = function (parent, collectMultiple) {
	this.missing = [];
	this.schemas = parent ? Object.create(parent.schemas) : {};
	this.collectMultiple = collectMultiple;
	this.errors = [];
	this.handleError = collectMultiple ? this.collectError : this.returnError;
};
ValidatorContext.prototype.returnError = function (error) {
	return error;
};
ValidatorContext.prototype.collectError = function (error) {
	if (error) {
		this.errors.push(error);
	}
	return null;
}
ValidatorContext.prototype.prefixErrors = function (startIndex, dataPath, schemaPath) {
	for (var i = startIndex; i < this.errors.length; i++) {
		this.errors[i] = this.errors[i].prefixWith(dataPath, schemaPath);
	}
	return this;
}

ValidatorContext.prototype.getSchema = function (url) {
	if (this.schemas[url] != undefined) {
		var schema = this.schemas[url];
		return schema;
	}
	var baseUrl = url;
	var fragment = "";
	if (url.indexOf('#') != -1) {
		fragment = url.substring(url.indexOf("#") + 1);
		baseUrl = url.substring(0, url.indexOf("#"));
	}
	if (this.schemas[baseUrl] != undefined) {
		var schema = this.schemas[baseUrl];
		var pointerPath = decodeURIComponent(fragment);
		if (pointerPath == "") {
			return schema;
		} else if (pointerPath.charAt(0) != "/") {
			return undefined;
		}
		var parts = pointerPath.split("/").slice(1);
		for (var i = 0; i < parts.length; i++) {
			var component = parts[i].replace("~1", "/").replace("~0", "~");
			if (schema[component] == undefined) {
				schema = undefined;
				break;
			}
			schema = schema[component];
		}
		if (schema != undefined) {
			return schema;
		}
	}
	if (this.missing[baseUrl] == undefined) {
		this.missing.push(baseUrl);
		this.missing[baseUrl] = baseUrl;
	}
};
ValidatorContext.prototype.addSchema = function (url, schema) {
	var map = {};
	map[url] = schema;
	normSchema(schema, url);
	searchForTrustedSchemas(map, schema, url);
	for (var key in map) {
		this.schemas[key] = map[key];
	}
	return map;
};
	
ValidatorContext.prototype.validateAll = function validateAll(data, schema, dataPathParts, schemaPathParts) {
	if (schema['$ref'] != undefined) {
		schema = this.getSchema(schema['$ref']);
		if (!schema) {
			return null;
		}
	}
	
	var errorCount = this.errors.length;
	var error = this.validateBasic(data, schema)
		|| this.validateNumeric(data, schema)
		|| this.validateString(data, schema)
		|| this.validateArray(data, schema)
		|| this.validateObject(data, schema)
		|| this.validateCombinations(data, schema)
		|| null
	if (error || errorCount != this.errors.length) {
		while ((dataPathParts && dataPathParts.length) || (schemaPathParts && schemaPathParts.length)) {
			var dataPart = (dataPathParts && dataPathParts.length) ? "" + dataPathParts.pop() : null;
			var schemaPart = (schemaPathParts && schemaPathParts.length) ? "" + schemaPathParts.pop() : null;
			if (error) {
				error = error.prefixWith(dataPart, schemaPart);
			}
			this.prefixErrors(errorCount, dataPart, schemaPart);
		}
	}
		
	return this.handleError(error);
}

function recursiveCompare(A, B) {
	if (A === B) {
		return true;
	}
	if (typeof A == "object" && typeof B == "object") {
		if (Array.isArray(A) != Array.isArray(B)) {
			return false;
		} else if (Array.isArray(A)) {
			if (A.length != B.length) {
				return false
			}
			for (var i = 0; i < A.length; i++) {
				if (!recursiveCompare(A[i], B[i])) {
					return false;
				}
			}
		} else {
			for (var key in A) {
				if (B[key] === undefined && A[key] !== undefined) {
					return false;
				}
			}
			for (var key in B) {
				if (A[key] === undefined && B[key] !== undefined) {
					return false;
				}
			}
			for (var key in A) {
				if (!recursiveCompare(A[key], B[key])) {
					return false;
				}
			}
		}
		return true;
	}
	return false;
}

ValidatorContext.prototype.validateBasic = function validateBasic(data, schema) {
	var error;
	if (error = this.validateType(data, schema)) {
		return error.prefixWith(null, "type");
	}
	if (error = this.validateEnum(data, schema)) {
		return error.prefixWith(null, "type");
	}
	return null;
}

ValidatorContext.prototype.validateType = function validateType(data, schema) {
	if (schema.type == undefined) {
		return null;
	}
	var dataType = typeof data;
	if (data == null) {
		dataType = "null";
	} else if (Array.isArray(data)) {
		dataType = "array";
	}
	var allowedTypes = schema.type;
	if (typeof allowedTypes != "object") {
		allowedTypes = [allowedTypes];
	}
	
	for (var i = 0; i < allowedTypes.length; i++) {
		var type = allowedTypes[i];
		if (type == dataType || (type == "integer" && dataType == "number" && (data%1 == 0))) {
			return null;
		}
	}
	return new ValidationError(ErrorCodes.INVALID_TYPE, "invalid data type: " + dataType);
}

ValidatorContext.prototype.validateEnum = function validateEnum(data, schema) {
	if (schema["enum"] == undefined) {
		return null;
	}
	for (var i = 0; i < schema["enum"].length; i++) {
		var enumVal = schema["enum"][i];
		if (recursiveCompare(data, enumVal)) {
			return null;
		}
	}
	return new ValidationError(ErrorCodes.ENUM_MISMATCH, "No enum match for: " + JSON.stringify(data));
}
ValidatorContext.prototype.validateNumeric = function validateNumeric(data, schema) {
	return this.validateMultipleOf(data, schema)
		|| this.validateMinMax(data, schema)
		|| null;
}

ValidatorContext.prototype.validateMultipleOf = function validateMultipleOf(data, schema) {
	var multipleOf = schema.multipleOf || schema.divisibleBy;
	if (multipleOf == undefined) {
		return null;
	}
	if (typeof data == "number") {
		if (data%multipleOf != 0) {
			return new ValidationError(ErrorCodes.NUMBER_MULTIPLE_OF, "Value " + data + " is not a multiple of " + multipleOf);
		}
	}
	return null;
}

ValidatorContext.prototype.validateMinMax = function validateMinMax(data, schema) {
	if (typeof data != "number") {
		return null;
	}
	if (schema.minimum != undefined) {
		if (data < schema.minimum) {
			return new ValidationError(ErrorCodes.NUMBER_MINIMUM, "Value " + data + " is less than minimum " + schema.minimum).prefixWith(null, "minimum");
		}
		if (schema.exclusiveMinimum && data == schema.minimum) {
			return new ValidationError(ErrorCodes.NUMBER_MINIMUM_EXCLUSIVE, "Value "+ data + " is equal to exclusive minimum " + schema.minimum).prefixWith(null, "exclusiveMinimum");
		}
	}
	if (schema.maximum != undefined) {
		if (data > schema.maximum) {
			return new ValidationError(ErrorCodes.NUMBER_MAXIMUM, "Value " + data + " is greater than maximum " + schema.maximum).prefixWith(null, "maximum");
		}
		if (schema.exclusiveMaximum && data == schema.maximum) {
			return new ValidationError(ErrorCodes.NUMBER_MAXIMUM_EXCLUSIVE, "Value "+ data + " is equal to exclusive maximum " + schema.maximum).prefixWith(null, "exclusiveMaximum");
		}
	}
	return null;
}
ValidatorContext.prototype.validateString = function validateString(data, schema) {
	return this.validateStringLength(data, schema)
		|| this.validateStringPattern(data, schema)
		|| null;
}

ValidatorContext.prototype.validateStringLength = function validateStringLength(data, schema) {
	if (typeof data != "string") {
		return null;
	}
	if (schema.minLength != undefined) {
		if (data.length < schema.minLength) {
			return new ValidationError(ErrorCodes.STRING_LENGTH_SHORT, "String is too short (" + data.length + " chars), minimum " + schema.minLength).prefixWith(null, "minLength");
		}
	}
	if (schema.maxLength != undefined) {
		if (data.length > schema.maxLength) {
			return new ValidationError(ErrorCodes.STRING_LENGTH_LONG, "String is too long (" + data.length + " chars), maximum " + schema.maxLength).prefixWith(null, "maxLength");
		}
	}
	return null;
}

ValidatorContext.prototype.validateStringPattern = function validateStringPattern(data, schema) {
	if (typeof data != "string" || schema.pattern == undefined) {
		return null;
	}
	var regexp = new RegExp(schema.pattern);
	if (!regexp.test(data)) {
		return new ValidationError(ErrorCodes.STRING_PATTERN, "String does not match pattern").prefixWith(null, "pattern");
	}
	return null;
}
ValidatorContext.prototype.validateArray = function validateArray(data, schema) {
	if (!Array.isArray(data)) {
		return null;
	}
	return this.validateArrayLength(data, schema)
		|| this.validateArrayUniqueItems(data, schema)
		|| this.validateArrayItems(data, schema)
		|| null;
}

ValidatorContext.prototype.validateArrayLength = function validateArrayLength(data, schema) {
	if (schema.minItems != undefined) {
		if (data.length < schema.minItems) {
			var error = (new ValidationError(ErrorCodes.ARRAY_LENGTH_SHORT, "Array is too short (" + data.length + "), minimum " + schema.minItems)).prefixWith(null, "minItems");
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxItems != undefined) {
		if (data.length > schema.maxItems) {
			var error = (new ValidationError(ErrorCodes.ARRAY_LENGTH_LONG, "Array is too long (" + data.length + " chars), maximum " + schema.maxItems)).prefixWith(null, "maxItems");
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateArrayUniqueItems = function validateArrayUniqueItems(data, schema) {
	if (schema.uniqueItems) {
		for (var i = 0; i < data.length; i++) {
			for (var j = i + 1; j < data.length; j++) {
				if (recursiveCompare(data[i], data[j])) {
					var error = (new ValidationError(ErrorCodes.ARRAY_UNIQUE, "Array items are not unique (indices " + i + " and " + j + ")")).prefixWith(null, "uniqueItems");
					if (this.handleError(error)) {
						return error;
					}
				}
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateArrayItems = function validateArrayItems(data, schema) {
	if (schema.items == undefined) {
		return null;
	}
	var error;
	if (Array.isArray(schema.items)) {
		for (var i = 0; i < data.length; i++) {
			if (i < schema.items.length) {
				if (error = this.validateAll(data[i], schema.items[i], [i], ["items", i])) {
					return error;
				}
			} else if (schema.additionalItems != undefined) {
				if (typeof schema.additionalItems == "boolean") {
					if (!schema.additionalItems) {
						error = (new ValidationError(ErrorCodes.ARRAY_ADDITIONAL_ITEMS, "Additional items not allowed")).prefixWith("" + i, "additionalItems");
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (error = this.validateAll(data[i], schema.additionalItems, [i], ["additionalItems"])) {
					return error;
				}
			}
		}
	} else {
		for (var i = 0; i < data.length; i++) {
			if (error = this.validateAll(data[i], schema.items, [i], ["items"])) {
				return error;
			}
		}
	}
	return null;
}
ValidatorContext.prototype.validateObject = function validateObject(data, schema) {
	if (typeof data != "object" || data == null || Array.isArray(data)) {
		return null;
	}
	return this.validateObjectMinMaxProperties(data, schema)
		|| this.validateObjectRequiredProperties(data, schema)
		|| this.validateObjectProperties(data, schema)
		|| this.validateObjectDependencies(data, schema)
		|| null;
}

ValidatorContext.prototype.validateObjectMinMaxProperties = function validateObjectMinMaxProperties(data, schema) {
	var keys = Object.keys(data);
	if (schema.minProperties != undefined) {
		if (keys.length < schema.minProperties) {
			var error = new ValidationError(ErrorCodes.OBJECT_PROPERTIES_MINIMUM, "Too few properties defined (" + keys.length + "), minimum " + schema.minProperties).prefixWith(null, "minProperties");
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxProperties != undefined) {
		if (keys.length > schema.maxProperties) {
			var error = new ValidationError(ErrorCodes.OBJECT_PROPERTIES_MAXIMUM, "Too many properties defined (" + keys.length + "), maximum " + schema.maxProperties).prefixWith(null, "maxProperties");
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateObjectRequiredProperties = function validateObjectRequiredProperties(data, schema) {
	if (schema.required != undefined) {
		for (var i = 0; i < schema.required.length; i++) {
			var key = schema.required[i];
			if (data[key] === undefined) {
				var error = new ValidationError(ErrorCodes.OBJECT_REQUIRED, "Missing required property: " + key).prefixWith(null, "" + i).prefixWith(null, "required");
				if (this.handleError(error)) {
					return error;
				}
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateObjectProperties = function validateObjectProperties(data, schema) {
	var error;
	for (var key in data) {
		var foundMatch = false;
		if (schema.properties != undefined && schema.properties[key] != undefined) {
			foundMatch = true;
			if (error = this.validateAll(data[key], schema.properties[key], [key], ["properties", key])) {
				return error;
			}
		}
		if (schema.patternProperties != undefined) {
			for (var patternKey in schema.patternProperties) {
				var regexp = new RegExp(patternKey);
				if (regexp.test(key)) {
					foundMatch = true;
					if (error = this.validateAll(data[key], schema.patternProperties[patternKey], [key], ["patternProperties", patternKey])) {
						return error;
					}
				}
			}
		}
		if (!foundMatch && schema.additionalProperties != undefined) {
			if (typeof schema.additionalProperties == "boolean") {
				if (!schema.additionalProperties) {
					error = new ValidationError(ErrorCodes.OBJECT_ADDITIONAL_PROPERTIES, "Additional properties not allowed").prefixWith(key, "additionalProperties");
					if (this.handleError(error)) {
						return error;
					}
				}
			} else {
				if (error = this.validateAll(data[key], schema.additionalProperties, [key], ["additionalProperties"])) {
					return error;
				}
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateObjectDependencies = function validateObjectDependencies(data, schema) {
	var error;
	if (schema.dependencies != undefined) {
		for (var depKey in schema.dependencies) {
			if (data[depKey] !== undefined) {
				var dep = schema.dependencies[depKey];
				if (typeof dep == "string") {
					if (data[dep] === undefined) {
						error = new ValidationError(ErrorCodes.OBJECT_DEPENDENCY_KEY, "Dependency failed - key must exist: " + dep).prefixWith(null, depKey).prefixWith(null, "dependencies");
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (Array.isArray(dep)) {
					for (var i = 0; i < dep.length; i++) {
						var requiredKey = dep[i];
						if (data[requiredKey] === undefined) {
							error = new ValidationError(ErrorCodes.OBJECT_DEPENDENCY_KEY, "Dependency failed - key must exist: " + requiredKey).prefixWith(null, "" + i).prefixWith(null, depKey).prefixWith(null, "dependencies");
							if (this.handleError(error)) {
								return error;
							}
						}
					}
				} else {
					if (error = this.validateAll(data, dep, [], ["dependencies", depKey])) {
						return error;
					}
				}
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateCombinations = function validateCombinations(data, schema) {
	var error;
	return this.validateAllOf(data, schema)
		|| this.validateAnyOf(data, schema)
		|| this.validateOneOf(data, schema)
		|| this.validateNot(data, schema)
		|| null;
}

ValidatorContext.prototype.validateAllOf = function validateAllOf(data, schema) {
	if (schema.allOf == undefined) {
		return null;
	}
	var error;
	for (var i = 0; i < schema.allOf.length; i++) {
		var subSchema = schema.allOf[i];
		if (error = this.validateAll(data, subSchema, [], ["allOf", i])) {
			return error;
		}
	}
	return null;
}

ValidatorContext.prototype.validateAnyOf = function validateAnyOf(data, schema) {
	if (schema.anyOf == undefined) {
		return null;
	}
	var errors = [];
	var startErrorCount = this.errors.length;
	for (var i = 0; i < schema.anyOf.length; i++) {
		var subSchema = schema.anyOf[i];

		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["anyOf", i]);

		if (error == null && errorCount == this.errors.length) {
			this.errors = this.errors.slice(0, startErrorCount);
			return null;
		}
		if (error) {
			errors.push(error.prefixWith(null, "" + i).prefixWith(null, "anyOf"));
		}
	}
	errors = errors.concat(this.errors.slice(startErrorCount));
	this.errors = this.errors.slice(0, startErrorCount);
	return new ValidationError(ErrorCodes.ANY_OF_MISSING, "Data does not match any schemas from \"anyOf\"", "", "/anyOf", errors);
}

ValidatorContext.prototype.validateOneOf = function validateOneOf(data, schema) {
	if (schema.oneOf == undefined) {
		return null;
	}
	var validIndex = null;
	var errors = [];
	var startErrorCount = this.errors.length;
	for (var i = 0; i < schema.oneOf.length; i++) {
		var subSchema = schema.oneOf[i];
		
		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["oneOf", i]);
		
		if (error == null && errorCount == this.errors.length) {
			if (validIndex == null) {
				validIndex = i;
			} else {
				this.errors = this.errors.slice(0, startErrorCount);
				return new ValidationError(ErrorCodes.ONE_OF_MULTIPLE, "Data is valid against more than one schema from \"oneOf\": indices " + validIndex + " and " + i, "", "/oneOf");
			}
		} else if (error) {
			errors.push(error.prefixWith(null, "" + i).prefixWith(null, "oneOf"));
		}
	}
	if (validIndex == null) {
		errors = errors.concat(this.errors.slice(startErrorCount));
		this.errors = this.errors.slice(0, startErrorCount);
		return new ValidationError(ErrorCodes.ONE_OF_MISSING, "Data does not match any schemas from \"oneOf\"", "", "/oneOf", errors);
	} else {
		this.errors = this.errors.slice(0, startErrorCount);
	}
	return null;
}

ValidatorContext.prototype.validateNot = function validateNot(data, schema) {
	if (schema.not == undefined) {
		return null;
	}
	var oldErrorCount = this.errors.length;
	var error = this.validateAll(data, schema.not);
	var notErrors = this.errors.slice(oldErrorCount);
	this.errors = this.errors.slice(0, oldErrorCount);
	if (error == null && notErrors.length == 0) {
		return new ValidationError(ErrorCodes.NOT_PASSED, "Data matches schema from \"not\"", "", "/not")
	}
	return null;
}

// parseURI() and resolveUrl() are from https://gist.github.com/1088850
//   -  released as public domain by author ("Yaffle") - see comments on gist

function parseURI(url) {
	var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
	// authority = '//' + user + ':' + pass '@' + hostname + ':' port
	return (m ? {
		href     : m[0] || '',
		protocol : m[1] || '',
		authority: m[2] || '',
		host     : m[3] || '',
		hostname : m[4] || '',
		port     : m[5] || '',
		pathname : m[6] || '',
		search   : m[7] || '',
		hash     : m[8] || ''
	} : null);
}

function resolveUrl(base, href) {// RFC 3986

	function removeDotSegments(input) {
		var output = [];
		input.replace(/^(\.\.?(\/|$))+/, '')
			.replace(/\/(\.(\/|$))+/g, '/')
			.replace(/\/\.\.$/, '/../')
			.replace(/\/?[^\/]*/g, function (p) {
				if (p === '/..') {
					output.pop();
				} else {
					output.push(p);
				}
		});
		return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
	}

	href = parseURI(href || '');
	base = parseURI(base || '');

	return !href || !base ? null : (href.protocol || base.protocol) +
		(href.protocol || href.authority ? href.authority : base.authority) +
		removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
		(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
		href.hash;
}

function normSchema(schema, baseUri) {
	if (baseUri == undefined) {
		baseUri = schema.id;
	} else if (typeof schema.id == "string") {
		baseUri = resolveUrl(baseUri, schema.id);
		schema.id = baseUri;
	}
	if (typeof schema == "object") {
		if (Array.isArray(schema)) {
			for (var i = 0; i < schema.length; i++) {
				normSchema(schema[i], baseUri);
			}
		} else if (typeof schema['$ref'] == "string") {
			schema['$ref'] = resolveUrl(baseUri, schema['$ref']);
		} else {
			for (var key in schema) {
				if (key != "enum") {
					normSchema(schema[key], baseUri);
				}
			}
		}
	}
}

var ErrorCodes = {
	INVALID_TYPE: 0,
	ENUM_MISMATCH: 1,
	ANY_OF_MISSING: 10,
	ONE_OF_MISSING: 11,
	ONE_OF_MULTIPLE: 12,
	NOT_PASSED: 13,
	// Numeric errors
	NUMBER_MULTIPLE_OF: 100,
	NUMBER_MINIMUM: 101,
	NUMBER_MINIMUM_EXCLUSIVE: 102,
	NUMBER_MAXIMUM: 103,
	NUMBER_MAXIMUM_EXCLUSIVE: 104,
	// String errors
	STRING_LENGTH_SHORT: 200,
	STRING_LENGTH_LONG: 201,
	STRING_PATTERN: 202,
	// Object errors
	OBJECT_PROPERTIES_MINIMUM: 300,
	OBJECT_PROPERTIES_MAXIMUM: 301,
	OBJECT_REQUIRED: 302,
	OBJECT_ADDITIONAL_PROPERTIES: 303,
	OBJECT_DEPENDENCY_KEY: 304,
	// Array errors
	ARRAY_LENGTH_SHORT: 400,
	ARRAY_LENGTH_LONG: 401,
	ARRAY_UNIQUE: 402,
	ARRAY_ADDITIONAL_ITEMS: 403
};

function ValidationError(code, message, dataPath, schemaPath, subErrors) {
	if (code == undefined) {
		throw new Error ("No code supplied for error: "+ message);
	}
	this.code = code;
	this.message = message;
	this.dataPath = dataPath ? dataPath : "";
	this.schemaPath = schemaPath ? schemaPath : "";
	this.subErrors = subErrors ? subErrors : null;
}
ValidationError.prototype = {
	prefixWith: function (dataPrefix, schemaPrefix) {
		if (dataPrefix != null) {
			dataPrefix = dataPrefix.replace("~", "~0").replace("/", "~1");
			this.dataPath = "/" + dataPrefix + this.dataPath;
		}
		if (schemaPrefix != null) {
			schemaPrefix = schemaPrefix.replace("~", "~0").replace("/", "~1");
			this.schemaPath = "/" + schemaPrefix + this.schemaPath;
		}
		if (this.subErrors != null) {
			for (var i = 0; i < this.subErrors.length; i++) {
				this.subErrors[i].prefixWith(dataPrefix, schemaPrefix);
			}
		}
		return this;
	}
};

function searchForTrustedSchemas(map, schema, url) {
	if (typeof schema.id == "string") {
		if (schema.id.substring(0, url.length) == url) {
			var remainder = schema.id.substring(url.length);
			if ((url.length > 0 && url.charAt(url.length - 1) == "/")
				|| remainder.charAt(0) == "#"
				|| remainder.charAt(0) == "?") {
				if (map[schema.id] == undefined) {
					map[schema.id] = schema;
				}
			}
		}
	}
	if (typeof schema == "object") {
		for (var key in schema) {
			if (key != "enum" && typeof schema[key] == "object") {
				searchForTrustedSchemas(map, schema[key], url);
			}
		}
	}
	return map;
}

var globalContext = new ValidatorContext();

var publicApi = {
	validate: function (data, schema) {
		var context = new ValidatorContext(globalContext);
		if (typeof schema == "string") {
			schema = {"$ref": schema};
		}
		var added = context.addSchema("", schema);
		var error = context.validateAll(data, schema);
		this.error = error;
		this.missing = context.missing;
		this.valid = (error == null);
		return this.valid;
	},
	validateResult: function () {
		var result = {};
		this.validate.apply(result, arguments);
		return result;
	},
	validateMultiple: function (data, schema) {
		var context = new ValidatorContext(globalContext, true);
		if (typeof schema == "string") {
			schema = {"$ref": schema};
		}
		context.addSchema("", schema);
		context.validateAll(data, schema);
		var result = {};
		result.errors = context.errors;
		result.missing = context.missing;
		result.valid = (result.errors.length == 0);
		return result;
	},
	addSchema: function (url, schema) {
		return globalContext.addSchema(url, schema);
	},
	getSchema: function (url) {
		return globalContext.getSchema(url);
	},
	missing: [],
	error: null,
	normSchema: normSchema,
	resolveUrl: resolveUrl,
	errorCodes: ErrorCodes
};

global.tv4 = publicApi;

})((typeof module !== 'undefined' && module.exports) ? exports : this);



/** FILE: lib/Math.uuid.js **/
/*!
  Math.uuid.js (v1.4)
  http://www.broofa.com
  mailto:robert@broofa.com

  Copyright (c) 2010 Robert Kieffer
  Dual licensed under the MIT and GPL licenses.

  ********

  Changes within remoteStorage.js:
  2012-10-31:
  - added AMD wrapper <niklas@unhosted.org>
  - moved extensions for Math object into exported object.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
  // Private array of chars to use
  var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

Math.uuid = function (len, radix) {
  var chars = CHARS, uuid = [], i;
  radix = radix || chars.length;

  if (len) {
    // Compact form
    for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
  } else {
    // rfc4122, version 4 form
    var r;

    // rfc4122 requires these characters
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';

    // Fill in random data.  At i==19 set the high bits of clock sequence as
    // per rfc4122, sec. 4.1.5
    for (i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = 0 | Math.random()*16;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
  }

  return uuid.join('');
};


/** FILE: src/baseclient.js **/

(function(global) {

  function deprecate(thing, replacement) {
    console.log('WARNING: ' + thing + ' is deprecated. Use ' +
                replacement + ' instead.');
  }

  var RS = RemoteStorage;

  /**
   * Class: RemoteStorage.BaseClient
   *
   * Provides a high-level interface to access data below a given root path.
   *
   * A BaseClient deals with three types of data: folders, objects and files.
   *
   * <getListing> returns a list of all items within a folder. Items that end
   * with a forward slash ("/") are child folders.
   *
   * <getObject> / <storeObject> operate on JSON objects. Each object has a type.
   *
   * <getFile> / <storeFile> operates on files. Each file has a MIME type.
   *
   * <remove> operates on either objects or files (but not folders, folders are
   * created and removed implictly).
   */
  RS.BaseClient = function(storage, base) {
    if(base[base.length - 1] != '/') {
      throw "Not a directory: " + base;
    }
    /**
     * Property: storage
     *
     * The <RemoteStorage> instance this <BaseClient> operates on.
     */
    this.storage = storage;
    /**
     * Property: base
     *
     * Base path this <BaseClient> operates on.
     *
     * For the module's privateClient this would be /<moduleName>/, for the
     * corresponding publicClient /public/<moduleName>/.
     */
    this.base = base;

    var parts = this.base.split('/');
    if(parts.length > 2) {
      this.moduleName = parts[1];
    } else {
      this.moduleName = 'root';
    }

    RS.eventHandling(this, 'change', 'conflict');
    this.on = this.on.bind(this);
    storage.onChange(this.base, this._fireChange.bind(this));
  };

  RS.BaseClient.prototype = {

    // BEGIN LEGACY
    use: function(path) {
      deprecate('BaseClient#use(path)', 'BaseClient#cache(path)');
      return this.cache(path);
    },

    release: function(path) {
      deprecate('BaseClient#release(path)', 'BaseClient#cache(path, false)');
      return this.cache(path, false);
    },
    // END LEGACY

    extend: function(object) {
      for(var key in object) {
        this[key] = object[key];
      }
      return this;
    },

    /**
     * Method: scope
     *
     * Returns a new <BaseClient> operating on a subpath of the current <base> path.
     */
    scope: function(path) {
      return new RS.BaseClient(this.storage, this.makePath(path));
    },

    // folder operations

    /**
     * Method: getListing
     *
     * Get a list of child nodes below a given path.
     *
     * The callback semantics of getListing are identical to those of getObject.
     *
     * Parameters:
     *   path     - The path to query. It MUST end with a forward slash.
     *
     * Returns:
     *   A promise for an Array of keys, representing child nodes.
     *   Those keys ending in a forward slash, represent *directory nodes*, all
     *   other keys represent *data nodes*.
     *
     * Example:
     *   (start code)
     *   client.getListing('').then(function(listing) {
     *     listing.forEach(function(item) {
     *       console.log('- ' + item);
     *     });
     *   });
     *   (end code)
     */
    getListing: function(path) {
      if(typeof(path) == 'undefined') {
        path = '';
      } else if(path.length > 0 && path[path.length - 1] != '/') {
        throw "Not a directory: " + path;
      }
      return this.storage.get(this.makePath(path)).then(function(status, body) {
        if(status == 404) return;
        return typeof(body) === 'object' ? Object.keys(body) : undefined;
      });
    },

    /**
     * Method: getAll
     *
     * Get all objects directly below a given path.
     *
     * Parameters:
     *   path      - path to the direcotry
     *   typeAlias - (optional) local type-alias to filter for
     *
     * Returns:
     *   a promise for an object in the form { path : object, ... }
     *
     * Example:
     *   (start code)
     *   client.getAll('').then(function(objects) {
     *     for(var key in objects) {
     *       console.log('- ' + key + ': ', objects[key]);
     *     }
     *   });
     *   (end code)
     */
    getAll: function(path) {
      if(typeof(path) == 'undefined') {
        path = '';
      } else if(path.length > 0 && path[path.length - 1] != '/') {
        throw "Not a directory: " + path;
      }
      return this.storage.get(this.makePath(path)).then(function(status, body) {
        if(status == 404) return;
        if(typeof(body) === 'object') {
          var promise = promising();
          var count = Object.keys(body).length, i = 0;
          if(count == 0) {
            // treat this like 404. it probably means a directory listing that
            // has changes that haven't been pushed out yet.
            return;
          }
          for(var key in body) {
            this.storage.get(this.makePath(path + key)).
              then(function(status, b) {
                body[this.key] = b;
                i++;
                if(i == count) promise.fulfill(body);
              }.bind({ key: key }));
          }
          return promise;
        }
      }.bind(this));
    },

    // file operations

    /**
     * Method: getFile
     *
     * Get the file at the given path. A file is raw data, as opposed to
     * a JSON object (use <getObject> for that).
     *
     * Except for the return value structure, getFile works exactly like
     * getObject.
     *
     * Parameters:
     *   path     - see getObject
     *
     * Returns:
     *   A promise for an object:
     *
     *   mimeType - String representing the MIME Type of the document.
     *   data     - Raw data of the document (either a string or an ArrayBuffer)
     *
     * Example:
     *   (start code)
     *   // Display an image:
     *   client.getFile('path/to/some/image').then(function(file) {
     *     var blob = new Blob([file.data], { type: file.mimeType });
     *     var targetElement = document.findElementById('my-image-element');
     *     targetElement.src = window.URL.createObjectURL(blob);
     *   });
     *   (end code)
     */
    getFile: function(path) {
      return this.storage.get(this.makePath(path)).then(function(status, body, mimeType, revision) {
        return {
          data: body,
          mimeType: mimeType,
          revision: revision // (this is new)
        };
      });
    },

    /**
     * Method: storeFile
     *
     * Store raw data at a given path.
     *
     * Parameters:
     *   mimeType - MIME media type of the data being stored
     *   path     - path relative to the module root. MAY NOT end in a forward slash.
     *   data     - string or ArrayBuffer of raw data to store
     *
     * The given mimeType will later be returned, when retrieving the data
     * using <getFile>.
     *
     * Example (UTF-8 data):
     *   (start code)
     *   client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>');
     *   (end code)
     *
     * Example (Binary data):
     *   (start code)
     *   // MARKUP:
     *   <input type="file" id="file-input">
     *   // CODE:
     *   var input = document.getElementById('file-input');
     *   var file = input.files[0];
     *   var fileReader = new FileReader();
     *
     *   fileReader.onload = function() {
     *     client.storeFile(file.type, file.name, fileReader.result);
     *   };
     *
     *   fileReader.readAsArrayBuffer(file);
     *   (end code)
     *
     */
    storeFile: function(mimeType, path, body) {
      return this.storage.put(this.makePath(path), body, mimeType).then(function(status, _body, _mimeType, revision) {
        if(status == 200 || status == 201) {
          return revision;
        } else {
          throw "Request (PUT " + this.makePath(path) + ") failed with status: " + status;
        }
      });
    },

    // object operations

    /**
     * Method: getObject
     *
     * Get a JSON object from given path.
     *
     * Parameters:
     *   path     - relative path from the module root (without leading slash)
     *
     * Returns:
     *   A promise for the object.
     *
     * Example:
     *   (start code)
     *   client.getObject('/path/to/object').
     *     then(function(object) {
     *       // object is either an object or null
     *     });
     *   (end code)
     */
    getObject: function(path) {
      return this.storage.get(this.makePath(path)).then(function(status, body, mimeType, revision) {
        if(typeof(body) == 'object') {
          return body;
        } else if(typeof(body) !== 'undefined' && status == 200) {
          throw "Not an object: " + this.makePath(path);
        }
      });
    },

    /**
     * Method: storeObject
     *
     * Store object at given path. Triggers synchronization.
     *
     * Parameters:
     *
     *   type     - unique type of this object within this module. See description below.
     *   path     - path relative to the module root.
     *   object   - an object to be saved to the given node. It must be serializable as JSON.
     *
     * Returns:
     *   A promise to store the object. The promise fails with a ValidationError, when validations fail.
     *
     *
     * What about the type?:
     *
     *   A great thing about having data on the web, is to be able to link to
     *   it and rearrange it to fit the current circumstances. To facilitate
     *   that, eventually you need to know how the data at hand is structured.
     *   For documents on the web, this is usually done via a MIME type. The
     *   MIME type of JSON objects however, is always application/json.
     *   To add that extra layer of "knowing what this object is", remoteStorage
     *   aims to use <JSON-LD at http://json-ld.org/>.
     *   A first step in that direction, is to add a *@context attribute* to all
     *   JSON data put into remoteStorage.
     *   Now that is what the *type* is for.
     *
     *   Within remoteStorage.js, @context values are built using three components:
     *     http://remotestoragejs.com/spec/modules/ - A prefix to guarantee unqiueness
     *     the module name     - module names should be unique as well
     *     the type given here - naming this particular kind of object within this module
     *
     *   In retrospect that means, that whenever you introduce a new "type" in calls to
     *   storeObject, you should make sure that once your code is in the wild, future
     *   versions of the code are compatible with the same JSON structure.
     *
     * How to define types?:
     *
     *   See <declareType> or the calendar module (src/modules/calendar.js) for examples.
     */
    storeObject: function(typeAlias, path, object) {
      this._attachType(object, typeAlias);
      try {
        var validationResult = this.validate(object);
        if(! validationResult.valid) {
          return promising().reject(validationResult);
        }
      } catch(exc) {
        if(exc instanceof RS.BaseClient.Types.SchemaNotFound) {
          // ignore.
        } else {
          return promising().reject(exc);
        }
      }
      return this.storage.put(this.makePath(path), object, 'application/json; charset=UTF-8').then(function(status, _body, _mimeType, revision) {
        if(status == 200 || status == 201) {
          return revision;
        } else {
          throw "Request (PUT " + this.makePath(path) + ") failed with status: " + status;
        }
      }.bind(this));
    },

    // generic operations

    /**
     * Method: remove
     *
     * Remove node at given path from storage. Triggers synchronization.
     *
     * Parameters:
     *   path     - Path relative to the module root.
     */
    remove: function(path) {
      return this.storage.delete(this.makePath(path));
    },

    cache: function(path, disable) {
      this.storage.caching[disable !== false ? 'enable' : 'disable'](
        this.makePath(path)
      );
      return this;
    },

    makePath: function(path) {
      return this.base + (path || '');
    },

    _fireChange: function(event) {
      this._emit('change', event);
    },

    getItemURL: function(path) {
      if(this.storage.connected) {
        return this.storage.remote.href + this.makePath(path);
      } else {
        return undefined;
      }
    },

    uuid: function() {
      return Math.uuid();
    }

  };

  /**
   * Method: RS#scope
   *
   * Returns a new <RS.BaseClient> scoped to the given path.
   *
   * Parameters:
   *   path - Root path of new BaseClient.
   *
   *
   * Example:
   *   (start code)
   *
   *   var foo = remoteStorage.scope('/foo/');
   *
   *   // PUTs data "baz" to path /foo/bar
   *   foo.storeFile('text/plain', 'bar', 'baz');
   *
   *   var something = foo.scope('something/');
   *
   *   // GETs listing from path /foo/something/bla/
   *   something.getListing('bla/');
   *
   *   (end code)
   *
   */


  RS.BaseClient._rs_init = function() {
    RS.prototype.scope = function(path) {
      return new RS.BaseClient(this, path);
    };
  };

  /* e.g.:
  remoteStorage.defineModule('locations', function(priv, pub) {
    return {
      exports: {
        features: priv.scope('features/').defaultType('feature'),
        collections: priv.scope('collections/').defaultType('feature-collection');
      }
    };
  });
  */

})(this);


/** FILE: src/baseclient/types.js **/

(function(global) {

  RemoteStorage.BaseClient.Types = {
    // <alias> -> <uri>
    uris: {},
    // <uri> -> <schema>
    schemas: {},
    // <uri> -> <alias>
    aliases: {},

    declare: function(moduleName, alias, uri, schema) {
      var fullAlias = moduleName + '/' + alias;

      if(schema.extends) {
        var extendedAlias;
        var parts = schema.extends.split('/');
        if(parts.length === 1) {
          extendedAlias = moduleName + '/' + parts.shift();
        } else {
          extendedAlias = parts.join('/');
        }
        var extendedUri = this.uris[extendedAlias];
        if(! extendedUri) {
          throw "Type '" + fullAlias + "' tries to extend unknown schema '" + extendedAlias + "'";
        }
        schema.extends = this.schemas[extendedUri];
      }
      
      this.uris[fullAlias] = uri;
      this.aliases[uri] = fullAlias;
      this.schemas[uri] = schema;
    },

    resolveAlias: function(alias) {
      return this.uris[alias];
    },

    getSchema: function(uri) {
      return this.schemas[uri];
    }
  };

  var SchemaNotFound = function(uri) {
    Error.apply(this, ["Schema not found: " + uri]);
  };
  SchemaNotFound.prototype = Error.prototype;

  RemoteStorage.BaseClient.Types.SchemaNotFound = SchemaNotFound;

  RemoteStorage.BaseClient.prototype.extend({

    validate: function(object) {
      var schema = RemoteStorage.BaseClient.Types.getSchema(object['@context']);
      if(schema) {
        return tv4.validateResult(object, schema);
      } else {
        throw new SchemaNotFound(object['@context']);
      }
    },

    // client.declareType(alias, schema);
    //  /* OR */
    // client.declareType(alias, uri, schema);
    declareType: function(alias, uri, schema) {
      if(! schema) {
        schema = uri;
        uri = this._defaultTypeURI(alias);
      }
      RemoteStorage.BaseClient.Types.declare(this.moduleName, alias, uri, schema);
    },

    _defaultTypeURI: function(alias) {
      return 'http://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
    },

    _attachType: function(object, alias) {
      object['@context'] = RemoteStorage.BaseClient.Types.resolveAlias(alias) || this._defaultTypeURI(alias);
    }
  });

})(this);


/** FILE: src/modules.js **/
(function() {

  RemoteStorage.MODULES = {};

  RemoteStorage.defineModule = function(moduleName, builder) {
    RemoteStorage.MODULES[moduleName] = builder;

    Object.defineProperty(RemoteStorage.prototype, moduleName, {
      configurable: true,
      get: function() {
        var instance = this._loadModule(moduleName);
        Object.defineProperty(this, moduleName, {
          value: instance
        });
        return instance;
      }
    });

    if(moduleName.indexOf('-') != -1) {
      var camelizedName = moduleName.replace(/\-[a-z]/g, function(s) {
        return s[1].toUpperCase();
      });
      Object.defineProperty(RemoteStorage.prototype, camelizedName, {
        get: function() {
          return this[moduleName];
        }
      });
    }
  };

  RemoteStorage.prototype._loadModule = function(moduleName) {
    var builder = RemoteStorage.MODULES[moduleName];
    if(builder) {
      var module = builder(new RemoteStorage.BaseClient(this, '/' + moduleName + '/'),
                           new RemoteStorage.BaseClient(this, '/public/' + moduleName + '/'));
      return module.exports;
    } else {
      throw "Unknown module: " + moduleName;
    }
  };

  RemoteStorage.prototype.defineModule = function(moduleName) {
    console.log("remoteStorage.defineModule is deprecated, use RemoteStorage.defineModule instead!");
    RemoteStorage.defineModule.apply(RemoteStorage, arguments);
  };

})();


/** FILE: src/debug/inspect.js **/
(function() {
  function loadTable(table, storage, paths) {
    table.setAttribute('border', '1');
    table.style.margin = '8px';
    table.innerHTML = '';
    var thead = document.createElement('thead');
    table.appendChild(thead);
    var titleRow = document.createElement('tr');
    thead.appendChild(titleRow);
    ['Path', 'Content-Type', 'Revision'].forEach(function(label) {
      var th = document.createElement('th');
      th.textContent = label;
      thead.appendChild(th);
    });

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    function renderRow(tr, path, contentType, revision) {
      [path, contentType, revision].forEach(function(value) {
        var td = document.createElement('td');
        td.textContent = value || '';
        tr.appendChild(td);
      });      
    }

    function loadRow(path) {
      if(storage.connected === false) return;
      function processRow(status, body, contentType, revision) {
        if(status == 200) {
          var tr = document.createElement('tr');
          tbody.appendChild(tr);
          renderRow(tr, path, contentType, revision);
          if(path[path.length - 1] == '/') {
            for(var key in body) {
              loadRow(path + key);
            }
          }
        }
      }
      storage.get(path).then(processRow);
    }

    paths.forEach(loadRow);
  }


  function renderWrapper(title, table, storage, paths) {
    var wrapper = document.createElement('div');
    //wrapper.style.display = 'inline-block';
    var heading = document.createElement('h2');
    heading.textContent = title;
    wrapper.appendChild(heading);
    var updateButton = document.createElement('button');
    updateButton.textContent = "Refresh";
    updateButton.onclick = function() { loadTable(table, storage, paths); };
    wrapper.appendChild(updateButton);
    if(storage.reset) {
      var resetButton = document.createElement('button');
      resetButton.textContent = "Reset";
      resetButton.onclick = function() {
        storage.reset(function(newStorage) {
          storage = newStorage;
          loadTable(table, storage, paths);
        });
      };
      wrapper.appendChild(resetButton);
    }
    wrapper.appendChild(table);
    loadTable(table, storage, paths);
    return wrapper;
  }

  function renderLocalChanges(local) {
    var wrapper = document.createElement('div');
    //wrapper.style.display = 'inline-block';
    var heading = document.createElement('h2');
    heading.textContent = "Outgoing changes";
    wrapper.appendChild(heading);
    var updateButton = document.createElement('button');
    updateButton.textContent = "Refresh";
    wrapper.appendChild(updateButton);
    var list = document.createElement('ul');
    list.style.fontFamily = 'courier';
    wrapper.appendChild(list);

    function updateList() {
      local.changesBelow('/').then(function(changes) {
        list.innerHTML = '';
        changes.forEach(function(change) {
          var el = document.createElement('li');
          el.textContent = JSON.stringify(change);
          list.appendChild(el);
        });
      });
    }

    updateButton.onclick = updateList;
    updateList();
    return wrapper;
  }

  RemoteStorage.prototype.inspect = function() {

    var widget = document.createElement('div');
    widget.id = 'remotestorage-inspect';
    widget.style.position = 'absolute';
    widget.style.top = 0;
    widget.style.left = 0;
    widget.style.background = 'black';
    widget.style.color = 'white';
    widget.style.border = 'groove 5px #ccc';

    var controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.top = 0;
    controls.style.left = 0;

    var heading = document.createElement('strong');
    heading.textContent = " remotestorage.js inspector ";

    controls.appendChild(heading);

    if(this.local) {
      var syncButton = document.createElement('button');
      syncButton.textContent = "Synchronize";
      controls.appendChild(syncButton);
    }

    var closeButton = document.createElement('button');
    closeButton.textContent = "Close";
    closeButton.onclick = function() {
      document.body.removeChild(widget);
    }
    controls.appendChild(closeButton);

    widget.appendChild(controls);

    var remoteTable = document.createElement('table');
    var localTable = document.createElement('table');
    widget.appendChild(renderWrapper("Remote", remoteTable, this.remote, this.caching.rootPaths));
    if(this.local) {
      widget.appendChild(renderWrapper("Local", localTable, this.local, ['/']));
      widget.appendChild(renderLocalChanges(this.local));

      syncButton.onclick = function() {
        this.log('sync clicked');
        this.sync().then(function() {
          this.log('SYNC FINISHED');
          loadTable(localTable, this.local, ['/'])
        }.bind(this), function(err) {
          console.error("SYNC FAILED", err, err.stack);
        });
      }.bind(this);
    }

    document.body.appendChild(widget);
  };

})();


/** FILE: src/legacy.js **/

(function() {
  var util = {
    getEventEmitter: function() {
      var object = {};
      var args = Array.prototype.slice.call(arguments);
      args.unshift(object);
      RemoteStorage.eventHandling.apply(RemoteStorage, args);
      object.emit = object._emit;
      return object;
    },

    extend: function(target) {
      var sources = Array.prototype.slice.call(arguments, 1);
      sources.forEach(function(source) {
        for(var key in source) {
          target[key] = source[key];
        }
      });
      return target;
    },

    asyncEach: function(array, callback) {
      return this.asyncMap(array, callback).
        then(function() { return array; });
    },

    asyncMap: function(array, callback) {
      var promise = promising();
      var n = array.length, i = 0;
      var results = [], errors = [];
      function oneDone() {
        i++;
        if(i == n) {
          promise.fulfill(results, errors);
        }
      }
      array.forEach(function(item, index) {
        try {
          var result = callback(item);
        } catch(exc) {
          oneDone();
          errors[index] = exc;
        }
        if(typeof(result) == 'object' && typeof(result.then) == 'function') {
          result.then(function(res) { results[index] = res; oneDone(); },
                      function(error) { errors[index] = res; oneDone(); });
        } else {
          oneDone();
          results[index] = result;
        }
      });
      return promise;
    },

    containingDir: function(path) {
      var dir = path.replace(/[^\/]+\/?$/, '');
      return dir == path ? null : dir;
    },

    isDir: function(path) {
      return path.substr(-1) == '/';
    },

    baseName: function(path) {
      var parts = path.split('/');
      if(util.isDir(path)) {
        return parts[parts.length-2]+'/';
      } else {
        return parts[parts.length-1];
      }
    },

    bindAll: function(object) {
      for(var key in this) {
        if(typeof(object[key]) == 'function') {
          object[key] = object[key].bind(object);
        }
      }
    }
  };

  Object.defineProperty(RemoteStorage.prototype, 'util', {
    get: function() {
      console.log("DEPRECATION WARNING: remoteStorage.util is deprecated and will be removed with the next major release.");
      return util;
    }
  });

})();

remoteStorage = new RemoteStorage();