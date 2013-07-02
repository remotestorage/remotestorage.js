(function() {
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
        console.log("WARNING: Can't resolve promise, already resolved!");
        return;
      }
      success = succ;
      result = Array.prototype.slice.call(res);
      setTimeout(function() {
        var cl = consumers.length;
        if(cl === 0 && (! success)) {
          // console.error("Possibly uncaught error: ", result);
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

  if(typeof(module) !== 'undefined') {
    module.exports = getPromise;
  } else if(typeof(define) === 'function') {
    define([], function() { return getPromise; });
  } else if(typeof(window) !== 'undefined') {
    window.promising = getPromise;
  }

})();
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
        return this.local.put(path, body, contentType).then(function() {
          RemoteStorage.sync.push(this.local, this.remote, path);
        }.bind(this));
      } else {
        return this.remote.put(path, body, contentType);
      }
    },

    delete: function(path) {
      if(this.caching.cachePath(path)) {
        return this.local.delete(path).then(function() {
          RemoteStorage.sync.push(this.local, this.remote, path);
        }.bind(this));
      } else {
        return this.remote.delete(path);
      }
    }
  }

  var RemoteStorage = function() {
    RemoteStorage.eventHandling(this, 'ready', 'connected', 'disconnected');
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

    this._init();
  };

  RemoteStorage.prototype = {

    _init: function() {
      this._loadFeatures(function(features) {
        console.log('all features loaded');
        this.local = features.local && new features.local();
        this.remote = new features.remote();

        if(this.local && this.remote) {
          this._setGPD(SyncedGetPutDelete, this);
          this._bindChange(this.local);
        } else if(this.remote) {
          this._setGPD(this.remote, this.remote);
        }

        if(this.remote) {
          this._delegateEvent('connected', this.remote)
        }

        var fl = features.length;
        for(var i=0;i<fl;i++) {
          var cleanup = features[i].cleanup;
          if(cleanup) {
            this._cleanups.push(cleanup);
          }
        }

        try {
          this._emit('ready');
          this._processPending();
        } catch(exc) {
          console.error("remoteStorage#ready block failed: ");
          if(typeof(exc) == 'string') {
            console.error(exc);
          } else {
            console.error(exc.message, exc.stack);
          }
        }
      });
    },

    _detectFeatures: function() {
      // determine availability
      var features = [
        'WireClient',
        'Access',
        'Caching',
        'Discover',
        'Authorize',
        'IndexedDB',
        'LocalStorage',
        'Sync',
        'BaseClient',
	      'Widget'
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
        console.log("[FEATURE " + feature.name + "] " + (supported ? '' : 'not ') + 'supported.');
        return supported;
      });

      features.local = RemoteStorage.IndexedDB || RemoteStorage.LocalStorage;
      features.remote = RemoteStorage.WireClient;
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
          console.log("[FEATURE " + name + "] initialized. (" + i + "/" + n + ")");
          if(i == n)
            setTimeout(function() {
              callback.apply(self, [features]);
            }, 0);
        }
      }
      features.forEach(function(feature) {
        console.log("[FEATURE " + feature.name + "] initializing...");
        var initResult = feature.init(self);
        var cb = featureDoneCb(feature.name);
        if(typeof(initResult) == 'object' && typeof(initResult.then) == 'function') {
          initResult.then(cb);
        } else {
          cb();
        }
      });
    },

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
    },

    _notReady: function() {
      throw "remotestorage not ready!";
    },

    onChange: function(path, handler) {
      if(! this._pathHandlers[path]) {
        this._pathHandlers[path] = [];
      }
      this._pathHandlers[path].push(handler);
    },

    _bindChange: function(object) {
      object.on('change', this._dispatchChange.bind(this));
    },

    _dispatchChange: function(event) {
      console.log('dispatch change', event, '(handlers: ', Object.keys(this._pathHandlers), ')');
      for(var path in this._pathHandlers) {
        var pl = path.length;
        this._pathHandlers[path].forEach(function(handler) {
          if(event.path.substr(0, pl) == path) {
            var ev = {};
            for(var key in event) { ev[key] = event[key]; }
            ev.relativePath = event.path.replace(new RegExp('^' + path), '');
            handler(ev);
          }
        });
      }
    },
    connect : function(userAddress) {
      RemoteStorage.Discover(userAddress,function(href, storageApi, authURL){
        this.remote.configure(href, storageApi);
        this.authorize(authURL);
      }.bind(this));
    },
    disconnect : function() {
      var n = this._cleanups.length, i = 0;
      var oneDone = function() {
        i++;
        if(i == n) {
          this._init();
          this._emit('disconnected');
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
    }
  };


  
    window.RemoteStorage = RemoteStorage;

})();
(function(global) {
  var methods = {
    /**
     * Method: on
     *
     * Install an event handler for the given event name.
     */
    on: function(eventName, handler) {
      this._validateEvent(eventName);
      this._handlers[eventName].push(handler);
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
        throw "Unknown event: " + eventName;
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
(function(global) {
  var haveLocalStorage;
  var SETTINGS_KEY = "remotestorage:wireclient";

  var API_2012 = 1, API_00 = 2, API_01 = 3, API_HEAD = 4;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  function request(method, path, token, headers, body, getEtag) {
    var promise = promising();
    console.log(method, path);
    var xhr = new XMLHttpRequest();
    xhr.open(method, path, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + encodeURIComponent(token));
    for(var key in headers) {
      if(typeof(headers[key]) !== 'undefined') {
        xhr.setRequestHeader(key, headers[key]);
      }
    }
    xhr.onload = function() {
      var mimeType = xhr.getResponseHeader('Content-Type');
      var body = mimeType && mimeType.match(/^application\/json/) ? JSON.parse(xhr.responseText) : xhr.responseText;
      var revision = getEtag ? xhr.getResponseHeader('ETag') : undefined;
      promise.fulfill(xhr.status, body, mimeType, revision);
    };
    xhr.onerror = function(error) {
      promise.reject(error);
    };
    if(typeof(body) === 'object' && !(object instanceof ArrayBuffer)) {
      body = JSON.stringify(body);
    }
    xhr.send(body);
    return promise;
  }

  RemoteStorage.WireClient = function() {
    this.connected = false;
    RemoteStorage.eventHandling(this, 'change', 'connected');

    if(haveLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {};
      if(settings) {
        this.configure(settings.href, settings.storageApi, settings.token);
      }
    }
  };

  RemoteStorage.WireClient.prototype = {

    configure: function(href, storageApi, token) {
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
      }
      if(haveLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({ href: this.href, token: this.token, storageApi: this.storageApi });
      }
    },

    get: function(path, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      var headers = {};
      if(this.supportsRevs) {
        // setting '' causes the browser (at least chromium) to ommit
        // the If-None-Match header it would normally send.
        headers['If-None-Match'] = options.ifNoneMatch || '';
      }
      return request('GET', this.href + path, this.token, headers,
                     undefined, this.supportsRevs);
    },

    put: function(path, body, contentType, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      var headers = { 'Content-Type': contentType };
      if(this.supportsRevs) {
        headers['If-Match'] = options.ifMatch;
        headers['If-None-Match'] = options.ifNoneMatch;
      }
      return request('PUT', this.href + path, this.token,
                     headers, body, this.supportsRevs);
    },

    delete: function(path, callback, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      return request('DELETE', this.href + path, this.token,
                     this.supportsRevs ? { 'If-Match': options.ifMatch } : {},
                     undefined, this.supportsRevs);
    }

  };

  RemoteStorage.WireClient._rs_init = function() {
  };

  RemoteStorage.WireClient._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    return !! global.XMLHttpRequest;
  };

  RemoteStorage.WireClient._rs_cleanup = function(){
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
  }


})(this);
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
      console.log('try url', url);
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
        console.log('got profile', profile, 'and link', link);
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
    var scope = '';
    for(var key in scopes) {
      var mode = scopes[key];
      if(key == 'root') {
        if(! storageApi.match(/^draft-dejong-remotestorage-/)) {
          key = '';
        }
      }
      scope += key + ':' + mode;
    }

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
    console.log("found Params : ", params);
    remoteStorage.on('ready', function() {
      if(params) {
        if(params.access_token) {
          remoteStorage.remote.configure(undefined, undefined, params.access_token);
        }
        if(params.user_address) {
          remoteStorage.connect(params.user_address);
        }
        if(params.error) {
          throw "Authorization server errored: " + params.error;
        }
      }
    });
  }

})();
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
      return this.scopes.map(function(module) {
        return (module === 'root' && this.storageType === '2012.04' ? '' : module) + ':' + this.get(module);
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
      Object.defineProperty(RemoteStorage.prototype, 'access', {
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
(function() {
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
        console.log("WARNING: Can't resolve promise, already resolved!");
        return;
      }
      success = succ;
      result = Array.prototype.slice.call(res);
      setTimeout(function() {
        var cl = consumers.length;
        if(cl === 0 && (! success)) {
          // console.error("Possibly uncaught error: ", result);
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

  if(typeof(module) !== 'undefined') {
    module.exports = getPromise;
  } else if(typeof(define) === 'function') {
    define([], function() { return getPromise; });
  } else if(typeof(window) !== 'undefined') {
    window.promising = getPromise;
  }

})();
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
        return this.local.put(path, body, contentType).then(function() {
          RemoteStorage.sync.push(this.local, this.remote, path);
        }.bind(this));
      } else {
        return this.remote.put(path, body, contentType);
      }
    },

    delete: function(path) {
      if(this.caching.cachePath(path)) {
        return this.local.delete(path).then(function() {
          RemoteStorage.sync.push(this.local, this.remote, path);
        }.bind(this));
      } else {
        return this.remote.delete(path);
      }
    }
  }

  var RemoteStorage = function() {
    RemoteStorage.eventHandling(this, 'ready', 'connected', 'disconnected');
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

    this._init();
  };

  RemoteStorage.prototype = {

    _init: function() {
      this._loadFeatures(function(features) {
        console.log('all features loaded');
        this.local = features.local && new features.local();
        this.remote = new features.remote();

        if(this.local && this.remote) {
          this._setGPD(SyncedGetPutDelete, this);
          this._bindChange(this.local);
        } else if(this.remote) {
          this._setGPD(this.remote, this.remote);
        }

        if(this.remote) {
          this._delegateEvent('connected', this.remote)
        }

        var fl = features.length;
        for(var i=0;i<fl;i++) {
          var cleanup = features[i].cleanup;
          if(cleanup) {
            this._cleanups.push(cleanup);
          }
        }

        try {
          this._emit('ready');
          this._processPending();
        } catch(exc) {
          console.error("remoteStorage#ready block failed: ");
          if(typeof(exc) == 'string') {
            console.error(exc);
          } else {
            console.error(exc.message, exc.stack);
          }
        }
      });
    },

    _detectFeatures: function() {
      // determine availability
      var features = [
        'WireClient',
        'Access',
        'Caching',
        'Discover',
        'Authorize',
        'IndexedDB',
        'LocalStorage',
        'Sync',
        'BaseClient',
	      'Widget'
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
        console.log("[FEATURE " + feature.name + "] " + (supported ? '' : 'not ') + 'supported.');
        return supported;
      });

      features.local = RemoteStorage.IndexedDB || RemoteStorage.LocalStorage;
      features.remote = RemoteStorage.WireClient;
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
          console.log("[FEATURE " + name + "] initialized. (" + i + "/" + n + ")");
          if(i == n)
            setTimeout(function() {
              callback.apply(self, [features]);
            }, 0);
        }
      }
      features.forEach(function(feature) {
        console.log("[FEATURE " + feature.name + "] initializing...");
        var initResult = feature.init(self);
        var cb = featureDoneCb(feature.name);
        if(typeof(initResult) == 'object' && typeof(initResult.then) == 'function') {
          initResult.then(cb);
        } else {
          cb();
        }
      });
    },

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
    },

    _notReady: function() {
      throw "remotestorage not ready!";
    },

    onChange: function(path, handler) {
      if(! this._pathHandlers[path]) {
        this._pathHandlers[path] = [];
      }
      this._pathHandlers[path].push(handler);
    },

    _bindChange: function(object) {
      object.on('change', this._dispatchChange.bind(this));
    },

    _dispatchChange: function(event) {
      console.log('dispatch change', event, '(handlers: ', Object.keys(this._pathHandlers), ')');
      for(var path in this._pathHandlers) {
        var pl = path.length;
        this._pathHandlers[path].forEach(function(handler) {
          if(event.path.substr(0, pl) == path) {
            var ev = {};
            for(var key in event) { ev[key] = event[key]; }
            ev.relativePath = event.path.replace(new RegExp('^' + path), '');
            handler(ev);
          }
        });
      }
    },
    connect : function(userAddress) {
      RemoteStorage.Discover(userAddress,function(href, storageApi, authURL){
        this.remote.configure(href, storageApi);
        this.authorize(authURL);
      }.bind(this));
    },
    disconnect : function() {
      var n = this._cleanups.length, i = 0;
      var oneDone = function() {
        i++;
        if(i == n) {
          this._init();
          this._emit('disconnected');
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
    }
  };


  
    window.RemoteStorage = RemoteStorage;

})();
(function(global) {
  var methods = {
    /**
     * Method: on
     *
     * Install an event handler for the given event name.
     */
    on: function(eventName, handler) {
      this._validateEvent(eventName);
      this._handlers[eventName].push(handler);
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
        throw "Unknown event: " + eventName;
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
(function(global) {
  var haveLocalStorage;
  var SETTINGS_KEY = "remotestorage:wireclient";

  var API_2012 = 1, API_00 = 2, API_01 = 3, API_HEAD = 4;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  function request(method, path, token, headers, body, getEtag) {
    var promise = promising();
    console.log(method, path);
    var xhr = new XMLHttpRequest();
    xhr.open(method, path, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + encodeURIComponent(token));
    for(var key in headers) {
      if(typeof(headers[key]) !== 'undefined') {
        xhr.setRequestHeader(key, headers[key]);
      }
    }
    xhr.onload = function() {
      var mimeType = xhr.getResponseHeader('Content-Type');
      var body = mimeType && mimeType.match(/^application\/json/) ? JSON.parse(xhr.responseText) : xhr.responseText;
      var revision = getEtag ? xhr.getResponseHeader('ETag') : undefined;
      promise.fulfill(xhr.status, body, mimeType, revision);
    };
    xhr.onerror = function(error) {
      promise.reject(error);
    };
    if(typeof(body) === 'object' && !(object instanceof ArrayBuffer)) {
      body = JSON.stringify(body);
    }
    xhr.send(body);
    return promise;
  }

  RemoteStorage.WireClient = function() {
    this.connected = false;
    RemoteStorage.eventHandling(this, 'change', 'connected');

    if(haveLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {};
      if(settings) {
        this.configure(settings.href, settings.storageApi, settings.token);
      }
    }
  };

  RemoteStorage.WireClient.prototype = {

    configure: function(href, storageApi, token) {
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
      }
      if(haveLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({ href: this.href, token: this.token, storageApi: this.storageApi });
      }
    },

    get: function(path, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      var headers = {};
      if(this.supportsRevs) {
        // setting '' causes the browser (at least chromium) to ommit
        // the If-None-Match header it would normally send.
        headers['If-None-Match'] = options.ifNoneMatch || '';
      }
      return request('GET', this.href + path, this.token, headers,
                     undefined, this.supportsRevs);
    },

    put: function(path, body, contentType, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      var headers = { 'Content-Type': contentType };
      if(this.supportsRevs) {
        headers['If-Match'] = options.ifMatch;
        headers['If-None-Match'] = options.ifNoneMatch;
      }
      return request('PUT', this.href + path, this.token,
                     headers, body, this.supportsRevs);
    },

    delete: function(path, callback, options) {
      if(! this.connected) throw new Error("not connected");
      if(!options) options = {};
      return request('DELETE', this.href + path, this.token,
                     this.supportsRevs ? { 'If-Match': options.ifMatch } : {},
                     undefined, this.supportsRevs);
    }

  };

  RemoteStorage.WireClient._rs_init = function() {
  };

  RemoteStorage.WireClient._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    return !! global.XMLHttpRequest;
  };

  RemoteStorage.WireClient._rs_cleanup = function(){
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
  }


})(this);
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
      console.log('try url', url);
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
        console.log('got profile', profile, 'and link', link);
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
    var scope = '';
    for(var key in scopes) {
      var mode = scopes[key];
      if(key == 'root') {
        if(! storageApi.match(/^draft-dejong-remotestorage-/)) {
          key = '';
        }
      }
      scope += key + ':' + mode;
    }

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
    console.log("found Params : ", params);
    remoteStorage.on('ready', function() {
      if(params) {
        if(params.access_token) {
          remoteStorage.remote.configure(undefined, undefined, params.access_token);
        }
        if(params.user_address) {
          remoteStorage.connect(params.user_address);
        }
        if(params.error) {
          throw "Authorization server errored: " + params.error;
        }
      }
    });
  }

})();
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
      return this.scopes.map(function(module) {
        return (module === 'root' && this.storageType === '2012.04' ? '' : module) + ':' + this.get(module);
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
      Object.defineProperty(RemoteStorage.prototype, 'access', {
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
(function() {

  function stateSetter(widget, state) {
    return function() { widget.state = state; };
  }

  RemoteStorage.Widget = function(remoteStorage) {
    this.rs = remoteStorage;
    this.view = new View;

    this.rs.on('connected', stateSetter(this, 'connected'));
    this.rs.on('disconnected', stateSetter(this, 'disconnected'));
  };

  RemoteStorage.Widget.prototype = {
    display: function() {
      this.view.display.apply(this.view, arguments);
      return this;
    }
  };

  RemoteStorage.prototype.displayWidget = function() {
    this.widget = new RemoteStorage.Widget(this).display();
  };

  RemoteStorage.Widget._rs_init = function(remoteStorage){
    window.addEventListener('load', function() {
      remoteStorage.displayWidget();
    });
  }

  // var settings = util.getSettingStore('remotestorage_widget');
  // var events = util.getEventEmitter('ready', 'disconnect', 'state');
  // var logger = util.getLogger('widget');

  // var maxTimeout = 45000;
  // var timeoutAdjustmentFactor = 1.5;
  function cEl(t){
    return document.createElement(t);
  }
  function View(){
  };
  View.prototype = {
     // States:
     //  initial      - not connected
     //  authing      - in auth flow
     //  connected    - connected to remote storage, not syncing at the moment
     //  busy         - connected, syncing at the moment
     //  offline      - connected, but no network connectivity
     //  error        - connected, but sync error happened
     //  unauthorized - connected, but request returned 401
    states : ['initial'
  	      , 'authing'
  	      , 'connected'
  	      , 'busy'
  	      , 'offline'
  	      , 'error'
  	      , 'unauthorized'],
    widget : undefined,
    state :  0,
    display : function(){
       //TODO this is just a placeholder
      var element = cEl('div')
      var state = cEl('p');
      state.innerHTML = this.states[this.state];
      state.className = 'state' 
      element.innerHTML = "widget";
      element.appendChild(state);
      element.style.position = "fixed";
      element.style.top = "0px";
      element.style.right = "0px";
      element.style.border = "solid"
      document.body.appendChild(element);
      this.widget = element;
     },

    setState : function(state){
      var s;
      if((s = this.states.indexOf(state)) < 0){
  	throw "Bad State assigned to view"
      }
      this.state = s;
      this.updateWidget();
    },
    updateWidget : function(){
      this.widget.getElementsByClassName('state')[0].innerHTML = this.states[this.state];
    }
  }

  // // the view.
  // var view = defaultView;
  // // options passed to displayWidget
  // var widgetOptions = {};
  // // passed to display() to avoid circular deps
  // var remoteStorage;

  // var reconnectInterval = 1000;

  // var offlineTimer = null;

  // var viewState;

  // function calcReconnectInterval() {
  //   var i = reconnectInterval;
  //   if(reconnectInterval < 10000) {
  //     reconnectInterval *= 2;
  //   }
  //   return i;
  // }

  // var stateActions = {
  //   offline: function() {
  //     if(! offlineTimer) {
  //       offlineTimer = setTimeout(function() {
  //         offlineTimer = null;
  //         sync.fullSync().
  //           then(function() {
  //             schedule.enable();
  //           });
  //       }, calcReconnectInterval());
  //     }
  //   },
  //   connected: function() {
  //     if(offlineTimer) {
  //       clearTimeout(offlineTimer);
  //       offlineTimer = null;
  //     }
  //   }
  // };
  

  // function setState(state) {
  //   if(state === viewState) {
  //     return;
  //   }
  //   viewState = state;
  //   var action = stateActions[state];
  //   if(action) {
  //     action.apply(null, arguments);
  //   }
  //   view.setState.apply(view, arguments);
  //   events.emit('state', state);    
  // }

  // function requestToken(authEndpoint) {
  //   logger.info('requestToken', authEndpoint);
  //   var redirectUri = (widgetOptions.redirectUri || view.getLocation());
  //   var state;
  //   var md = redirectUri.match(/^(.+)#(.*)$/);
  //   if(md) {
  //     redirectUri = md[1];
  //     state = md[2];
  //   }
  //   var clientId = util.hostNameFromUri(redirectUri);
  //   authEndpoint += authEndpoint.indexOf('?') > 0 ? '&' : '?';
  //   var params = [
  //     ['redirect_uri', redirectUri],
  //     ['client_id', clientId],
  //     ['scope', remoteStorage.access.scopeParameter],
  //     ['response_type', 'token']
  //   ];
  //   if(typeof(state) === 'string' && state.length > 0) {
  //     params.push(['state', state]);
  //   }
  //   authEndpoint += params.map(function(kv) {
  //     return kv[0] + '=' + encodeURIComponent(kv[1]);
  //   }).join('&');
  //   console.log('redirecting to', authEndpoint);
  //   return view.redirectTo(authEndpoint);
  // }

  // function connectStorage(userAddress) {
  //   settings.set('userAddress', userAddress);
  //   setState('authing');
  //   return webfinger.getStorageInfo(userAddress).
  //     then(remoteStorage.setStorageInfo, function(error) {
  //       if(error === 'timeout') {
  //         adjustTimeout();
  //       }
  //       setState((typeof(error) === 'string') ? 'typing' : 'error', error);
  //     }).
  //     then(function(storageInfo) {
  //       if(storageInfo) {
  //         requestToken(storageInfo.properties['auth-endpoint']);
  //         schedule.enable();
  //       }
  //     }, util.curry(setState, 'error'));
  // }

  // function reconnectStorage() {
  //   connectStorage(settings.get('userAddress'));
  // }

  // function disconnectStorage() {
  //   schedule.disable();
  //   remoteStorage.flushLocal();
  //   events.emit('state', 'disconnected');
  //   events.emit('disconnect');
  // }

  // // destructively parse query string from URI fragment
  // function parseParams() {
  //   var md = view.getLocation().match(/^(.*?)#(.*)$/);
  //   var result = {};
  //   if(md) {
  //     var hash = md[2];
  //     hash.split('&').forEach(function(param) {
  //       var kv = param.split('=');
  //       if(kv[1]) {
  //         result[kv[0]] = decodeURIComponent(kv[1]);
  //       }
  //     });
  //     if(Object.keys(result).length > 0) {
  //       view.setLocation(md[1] + '#');
  //     }
  //   }
  //   return result; 
  // }

  // function processParams() {
  //   var params = parseParams();

  //   // Query parameter: access_token
  //   if(params.access_token) {
  //     wireClient.setBearerToken(params.access_token);
  //   }
  //   // Query parameter: remotestorage
  //   if(params.remotestorage) {
  //     view.setUserAddress(params.remotestorage);
  //     setTimeout(function() {
  //       if(wireClient.getState() !== 'connected') {
  //         connectStorage(params.remotestorage);
  //       }
  //     }, 0);
  //   } else {
  //     var userAddress = settings.get('userAddress');
  //     if(userAddress) {
  //       view.setUserAddress(userAddress);
  //     }
  //   }
  //   // Query parameter: state
  //   if(params.state) {
  //     view.setLocation(view.getLocation().split('#')[0] + '#' + params.state);
  //   }
  // }

  // function handleSyncError(error) {
  //   if(error.message === 'unauthorized') {
  //     setState('unauthorized');
  //   } else if(error.message === 'network error') {
  //     setState('offline', error);
  //   } else {
  //     setState('error', error);
  //   }
  // }

  // function adjustTimeout() {
  //   var t = getputdelete.getTimeout();
  //   if(t < maxTimeout) {
  //     t *= timeoutAdjustmentFactor;
  //     webfinger.setTimeout(t);
  //     getputdelete.setTimeout(t);
  //   }
  // }

  // function handleSyncTimeout() {
  //   adjustTimeout();
  //   schedule.disable();
  //   setState('offline');
  // }

  // function initialSync() {
  //   if(settings.get('initialSyncDone')) {
  //     schedule.enable();
  //     store.fireInitialEvents().then(util.curry(events.emit, 'ready'));
  //   } else {
  //     setState('busy', true);
  //     sync.fullSync().then(function() {
  //       schedule.enable();
  //       settings.set('initialSyncDone', true);
  //       setState('connected');
  //       events.emit('ready');
  //     }, handleSyncError);
  //   }
  // }

  // function display(_remoteStorage, element, options) {
  //   remoteStorage = _remoteStorage;
  //   widgetOptions = options;
  //   if(! options) {
  //     options = {};
  //   }

  //   options.getLastSyncAt = function() {
  //     return (sync.lastSyncAt || new Date()).getTime();
  //   };

  //   schedule.watch('/', 30000);

  //   view.display(element, options);

  //   view.on('sync', sync.forceSync);
  //   view.on('connect', connectStorage);
  //   view.on('disconnect', disconnectStorage);
  //   view.on('reconnect', reconnectStorage);

  //   wireClient.on('busy', util.curry(setState, 'busy'));
  //   wireClient.on('unbusy', util.curry(setState, 'connected'));
  //   wireClient.on('connected', function() {
  //     setState('connected');
  //     initialSync();
  //   });
  //   wireClient.on('disconnected', util.curry(setState, 'initial'));

  //   BaseClient.on('error', util.curry(setState, 'error'));
  //   sync.on('error', handleSyncError);
  //   sync.on('timeout', handleSyncTimeout);

  //   processParams();

  //   wireClient.calcState();
  // }

  // RemoteStorage.widget = util.extend({
  //   display : display,

  //   clearSettings: settings.clear,

  //   setView: function(_view) {
  //     view = _view;
  //   }
  // }, events);

})();

(function() {

  RemoteStorage.BaseClient = function(storage, base) {
    if(base[base.length - 1] != '/') {
      throw "Not a directory: " + base;
    }
    this.storage = storage;
    this.base = base;

    var parts = this.base.split('/');
    if(parts.length > 2) {
      this.moduleName = parts[1];
    } else {
      this.moduleName = 'root';
    }

    RemoteStorage.eventHandling(this, 'change', 'conflict');
    this.on = this.on.bind(this);
    storage.onChange(this.base, this._fireChange.bind(this));
  };

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
  RemoteStorage.BaseClient.prototype = {
    
    extend: function(object) {
      for(var key in object) {
        this[key] = object[key];
      }
      return this;
    },

    scope: function(path) {
      return new RemoteStorage.BaseClient(this.storage, this.makePath(path));
    },

    // folder operations

    getListing: function(path) {
      if(path.length > 0 && path[path.length - 1] != '/') {
        throw "Not a directory: " + path;
      }
      return this.storage.get(path).then(function(status, body) {
        return typeof(body) === 'object' ? Object.keys(body) : undefined;
      });
    },

    getAll: function(path) {
      if(path.length > 0 && path[path.length - 1] != '/') {
        throw "Not a directory: " + path;
      }
      return this.storage.get(this.makePath(path)).then(function(status, body) {
        if(typeof(body) === 'object') {
          var promise = promising();
          var count = Object.keys(body).length, i = 0;
          for(var key in body) {
            return this.get(this.makePath(path + key)).then(function(status, body) {
              body[this.key] = body;
              i++;
              if(i == count) promise.fulfill(body);
            }.bind({ key: key }));
          }
          return promise;
        }
      }.bind(this));
    },

    // file operations

    getFile: function(path) {
      return this.storage.get(this.makePath(path)).then(function(status, body, mimeType, revision) {
        return {
          data: body,
          mimeType: mimeType,
          revision: revision // (this is new)
        };
      });
    },

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

    getObject: function(path) {
      return this.storage.get(this.makePath(path)).then(function(status, body, mimeType, revision) {
        if(typeof(body) == 'object') {
          return body;
        } else if(typeof(body) !== 'undefined' && status == 200) {
          throw "Not an object: " + this.makePath(path);
        }
      });
    },

    storeObject: function(mimeType, path, object) {
      return this.storage.put(this.makePath(path), object, mimeType).then(function(status, _body, _mimeType, revision) {
        if(status == 200 || status == 201) {
          return revision;
        } else {
          throw "Request (PUT " + this.makePath(path) + ") failed with status: " + status; 
        }
      });
    },

    // generic operations

    remove: function(path) {
      return this.storage.delete(this.makePath(path));
    },

    makePath: function(path) {
      return this.base + path;
    },

    _fireChange: function(event) {
      this._emit('change', event);
    }

  };

  /**
   * Method: RemoteStorage#scope
   *
   * Returns a new <RemoteStorage.BaseClient> scoped to the given path.
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


  RemoteStorage.BaseClient._rs_init = function() {
    RemoteStorage.prototype.scope = function(path) {
      return new RemoteStorage.BaseClient(this, path);
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

})();

(function() {

  RemoteStorage.BaseClient.Types = {
    uris: {},
    schemas: {},
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
      this.aliases[uri] = fullAlias
      this.schemas[uri] = schema;
    }
  };

  RemoteStorage.BaseClient.prototype.declareType = function(alias, uri, schema) {
    if(! schema) {
      schema = uri;
      uri = 'http://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
    }
    RemoteStorage.BaseClient.Types.declare(this.moduleName, alias, uri, schema);
  }

})();(function(global) {

  var haveLocalStorage = 'localStorage' in global;
  var SETTINGS_KEY = "remotestorage:caching";

  function containingDir(path) {
    return path.replace(/\/+/g, '/').replace(/[^\/]+\/?$/, '');
  }

  function isDir(path) {
    return path.substr(-1) == '/';
  }

  function pathContains(a, b) {
    return a.slice(0, b.length) === b;
  }

  RemoteStorage.Caching = function() {
    this.reset();

    this.__defineGetter__('list', function() {
      var list = [];
      for(var path in this._pathSettingsMap) {
        list.push({ path: path, settings: this._pathSettingsMap[path] });
      }
      return list;
    });

    if(haveLocalStorage) {
      var settings = localStorage[SETTINGS_KEY];
      if(settings) {
        this._pathSettingsMap = JSON.parse(settings);
        this._updateRoots();
      }
    }
  };

  RemoteStorage.Caching.prototype = {

    /**
     ** configuration methods
     **/

    get: function(path) {
      this._validateDirPath(path);
      return this._pathSettingsMap[path];
    },

    set: function(path, settings) {
      this._validateDirPath(path);
      if(typeof(settings) !== 'object') {
        throw new Error("settings is required");
      }
      this._pathSettingsMap[path] = settings;
      this._updateRoots();
    },

    remove: function(path) {
      this._validateDirPath(path);
      delete this._pathSettingsMap[path];
      this._updateRoots();
    },

    reset: function() {
      this.rootPaths = [];
      this._pathSettingsMap = {};
    },

    /**
     ** query methods
     **/

    // Method: descendIntoPath
    //
    // Checks if the given directory path should be followed.
    //
    // Returns: true or false
    descendIntoPath: function(path) {
      this._validateDirPath(path);
      return !! this._query(path);
    },

    // Method: cachePath
    //
    // Checks if given path should be cached.
    //
    // Returns: true or false
    cachePath: function(path) {
      this._validatePath(path);
      var settings = this._query(path);
      return settings && (isDir(path) || settings.data);
    },

    /**
     ** private methods
     **/

    // gets settings for given path. walks up the path until it finds something.
    _query: function(path) {
      return this._pathSettingsMap[path] ||
        path !== '/' &&
        this._query(containingDir(path));
    },

    _validatePath: function(path) {
      if(typeof(path) !== 'string') {
        throw new Error("path is required");
      }
    },

    _validateDirPath: function(path) {
      this._validatePath(path);
      if(! isDir(path)) {
        throw new Error("not a directory path: " + path);
      }
      if(path[0] !== '/') {
        throw new Error("path not absolute: " + path);
      }
    },

    _updateRoots: function() {
      var roots = {}
      for(var a in this._pathSettingsMap) {
        // already a root
        if(roots[a]) {
          continue;
        }
        var added = false;
        for(var b in this._pathSettingsMap) {
          if(pathContains(a, b)) {
            roots[b] = true;
            added = true;
            break;
          }
        }
        if(! added) {
          roots[a] = true;
        }
      }
      this.rootPaths = Object.keys(roots);
      if(haveLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify(this._pathSettingsMap);
      }
    },

  };

  Object.defineProperty(RemoteStorage.prototype, 'caching', {
    get: function() {
      var caching = new RemoteStorage.Caching();
      Object.defineProperty(this, 'caching', {
        value: caching
      });
      return caching;
    }
  });

  RemoteStorage.Caching._rs_init = function() {};
  RemoteStorage.Caching._rs_cleanup = function() {
    if(haveLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(this);
(function(global) {

  function isDir(path) {
    return path[path.length - 1] == '/';
  }

  function synchronize(source, target, path, options) {
    var promise = promising();
    console.log('synchronize', path, options);
    if(!options) options = {};
    if(typeof(options.data) === 'undefined') options.data = true;
    function syncRev(localRevision) {
      source.get(path).then(function(status, body, contentType, remoteRevision) {
        if(status == 412) {
          // up to date.
          promise.fulfill();
        } else {
          target.setRevision(path, remoteRevision || options.remRev).then(function() {
            console.log('have set rev of ' + path + ' to ' + (remoteRevision||options.remRev), 'no descending?', body);
            if(isDir(path)) {
              var keys = Object.keys(body);
              function syncChild() {
                var key = keys.shift();
                if(key) {
                  var childPath = path + key;
                  target.getRevision(childPath).then(function(childRev) {
                    console.log('got revision', childPath, childRev, 'changed?', childRev != body[key]);
                    if(childRev != body[key]) {
                      if(isDir(key) || options.data) {
                        synchronize(source, target, childPath, {
                          rev: childRev,
                          remRev: body[key],
                          data: options.data
                        }).then(syncChild);
                      } else {
                        // only set revision for files w/o data sync.
                        target.setRevision(childPath, body[key]).then(syncChild);
                      }
                    }
                  });
                } else {
                  promise.fulfill();
                }
              }
              syncChild();
            } else {
              target.put(path, body, contentType).then(function() {
                promise.fulfill();
              });
            }
          });
        }
      }, {
        ifNoneMatch: localRevision
      });
    }
    options.rev ? syncRev(options.rev) : target.getRevision(path).then(syncRev);
    return promise;
  }

  RemoteStorage.Sync = {
    sync: function(source, target, path) {
      return synchronize(source, target, path);
    },

    syncTree: function(source, target, path) {
      return synchronize(source, target, path, {
        data: false
      });
    }
  };

  RemoteStorage.prototype.sync = function() {
    if(! (this.local && this.caching)) {
      throw "Sync requires 'local' and 'caching'!";
    }
    var roots = this.caching.rootPaths;
    var n = roots.length, i = 0;
    var aborted = false;
    return promising(function(promise) {
      var path;
      while((path = roots.shift())) {
        synchronize(this.remote, this.local, path, this.caching.get(path)).
          then(function() {
            if(aborted) return;
            i++;
            if(n == i) {
              promise.fulfill();
            }
          }, function(error) {
            aborted = true;
            promise.reject(error);
          });
      }
    }.bind(this));
  };

  RemoteStorage.Sync._rs_init = function() {};

})(this);
(function(global) {
  
  var DEFAULT_DB_NAME = 'remotestorage';
  var DEFAULT_DB;
  
  function keepDirNode(node) {
    return Object.keys(node.body).length > 0 ||
      Object.keys(node.cached).length > 0;
  }

  function removeFromParent(nodes, path, key) {
    var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
    if(parts) {
      var dirname = parts[1], basename = parts[2];
      nodes.get(dirname).onsuccess = function(evt) {
        var node = evt.target.result;
        delete node[key][basename];
        if(keepDirnode(node)) {
          nodes.put(node);
        } else {
          nodes.remove(node).onsuccess = function() {
            if(dirname != '/') {
              removeFromParent(nodes, dirname, key);
            }
          };
        }
      };
    }
  }

  function makeNode(path) {
    var node = { path: path };
    if(path[path.length - 1] == '/') {
      node.body = {};
      node.cached = {};
      node.contentType = 'application/json';
    }
    return node;
  }

  function addToParent(nodes, path, key) {
    var parts = path.match(/^(.*\/)([^\/]+\/?)$/);
    if(parts) {
      var dirname = parts[1], basename = parts[2];
      nodes.get(dirname).onsuccess = function(evt) {
        var node = evt.target.result || makeNode(dirname);
        console.log('try to set key', key, 'on node', node);
        node[key][basename] = true;
        nodes.put(node).onsuccess = function() {
          if(dirname != '/') {
            addToParent(nodes, dirname, key);
          }
        };
      };
    }
  }

  RemoteStorage.IndexedDB = function(database) {
    this.db = database || DEFAULT_DB;
    RemoteStorage.eventHandling(this, 'change');
  };
  RemoteStorage.IndexedDB.prototype = {

    get: function(path) {
      var promise = promising();
      console.log('GET', path);
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var nodes = transaction.objectStore('nodes');
      var nodeReq = nodes.get(path);
      var node;
      nodeReq.onsuccess = function() {
        node = nodeReq.result;
      };
      transaction.oncomplete = function() {
        if(node) {
          promise.fulfill(200, node.body, node.contentType, node.revision);
        } else {
          promise.fulfill(404);
        }
      };
      return promise;
    },

    put: function(path, body, contentType) {
      var promise = promising();
      console.log('PUT', path);
      if(path[path.length - 1] == '/') { throw "Bad: don't PUT folders"; }
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodes = transaction.objectStore('nodes');
      var oldNode;
      nodes.get(path).onsuccess = function(evt) {
        oldNode = evt.target.result;
        nodes.put({ path: path, contentType: contentType, body: body }).
          onsuccess = function() { addToParent(nodes, path, 'body'); };
      };
      transaction.oncomplete = function() {
        this._emit('change', {
          path: path,
          origin: 'window',
          oldValue: oldNode ? oldNode.body : undefined,
          newValue: body
        });
        promise.fulfill(200);
      }.bind(this);
      return promise;
    },

    delete: function(path) {
      var promise = promising();
      console.log('DELETE', path);
      if(path[path.length - 1] == '/') { throw "Bad: don't DELETE folders"; }
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodes = transaction.objectStore('nodes');
      nodes.delete(path).onsuccess = function() {
        removeFromParent(nodes, path, 'body');
      };
      transaction.oncomplete = function() {
        promise.fulfill(200);
      };
      return promise;
    },

    setRevision: function(path, revision) {
      return this.setRevisions([[path, revision]]);
    },

    setRevisions: function(revs) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      revs.forEach(function(rev) {
        console.log('set rev', rev);
        var nodes = transaction.objectStore('nodes');
        nodes.get(rev[0]).onsuccess = function(event) {
          var node = event.target.result || makeNode(rev[0]);
          node.revision = rev[1];
          console.log('putting', node);
          nodes.put(node).onsuccess = function() {
            addToParent(nodes, rev[0], 'cached');
          };
        };
      });
      transaction.oncomplete = function() {
        promise.fulfill();
      };
      return promise;
    },

    getRevision: function(path) {
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var rev;
      transaction.objectStore('nodes').
        get(path).onsuccess = function(evt) {
          if(evt.target.result) {
            rev = evt.target.result.revision;
          }
        };
      transaction.oncomplete = function() {
        promise.fulfill(rev);
      };
      return promise;
    },

    getCached: function(path) {
      if(path[path.length - 1] != '/') {
        return this.get(path);
      }
      var promise = promising();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var nodes = transaction.objectStore('nodes');
      nodes.get(path).onsuccess = function(evt) {
        var node = evt.target.result || {};
        console.log('getCached', path, '->', node.cached);
        promise.fulfill(200, node.cached, node.contentType, node.revision);
      };
      return promise;
    },

    reset: function(callback) {
      var dbName = this.db.name;
      this.db.close();
      var self = this;
      RemoteStorage.IndexedDB.clean(this.db.name, function() {
        RemoteStorage.IndexedDB.open(dbName, function(other) {
          // hacky!
          self.db = other.db;
          callback(self);
        });
      });
    },

    _fireInitial: function() {
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var cursorReq = transaction.objectStore('nodes').openCursor();
      cursorReq.onsuccess = function(evt) {
        var cursor = evt.target.result;
        if(cursor) {
          var path = cursor.key;
          if(path.substr(-1) != '/') {
            this._emit('change', {
              path: path,
              origin: 'window',
              oldValue: undefined,
              newValue: cursor.value.body
            });
          }
          cursor.continue();
        }
      }.bind(this);
    }

  };

  var DB_VERSION = 1;
  RemoteStorage.IndexedDB.open = function(name, callback) {
    var dbOpen = indexedDB.open(name, DB_VERSION);
    dbOpen.onerror = function() {
      console.error("Opening db failed: ", dbOpen.errorCode);
    };
    dbOpen.onupgradeneeded = function() {
      var db = dbOpen.result;
      db.createObjectStore('nodes', { keyPath: 'path' });
    }
    dbOpen.onsuccess = function() {
      callback(dbOpen.result);
    };
  };

  RemoteStorage.IndexedDB.clean = function(databaseName, callback) {
    var req = indexedDB.deleteDatabase(databaseName);
    req.onsuccess = function() {
      console.log('done removing db');
      callback();
    };
    req.onerror = function(evt) {
      console.error('failed to remove database "' + databaseName + '"', evt);
    };
  };

  RemoteStorage.IndexedDB._rs_init = function(remoteStorage) {
    var promise = promising();
    remoteStorage.on('ready', function() {
      promise.then(function() {
        remoteStorage.local._fireInitial();
      });
    });
    RemoteStorage.IndexedDB.open(DEFAULT_DB_NAME, function(db) {
      DEFAULT_DB = db;
      promise.fulfill();
    });
    return promise;
  };

  RemoteStorage.IndexedDB._rs_supported = function() {
    return 'indexedDB' in global;
  }

})(this);

// TODO!
// TODO!
(function() {

  RemoteStorage.BaseClient = function(storage, base) {
    if(base[base.length - 1] != '/') {
      throw "Not a directory: " + base;
    }
    this.storage = storage;
    this.base = base;

    var parts = this.base.split('/');
    if(parts.length > 2) {
      this.moduleName = parts[1];
    } else {
      this.moduleName = 'root';
    }

    RemoteStorage.eventHandling(this, 'change', 'conflict');
    this.on = this.on.bind(this);
    storage.onChange(this.base, this._fireChange.bind(this));
  };

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
  RemoteStorage.BaseClient.prototype = {
    
    extend: function(object) {
      for(var key in object) {
        this[key] = object[key];
      }
      return this;
    },

    scope: function(path) {
      return new RemoteStorage.BaseClient(this.storage, this.makePath(path));
    },

    // folder operations

    getListing: function(path) {
      if(path.length > 0 && path[path.length - 1] != '/') {
        throw "Not a directory: " + path;
      }
      return this.storage.get(path).then(function(status, body) {
        return typeof(body) === 'object' ? Object.keys(body) : undefined;
      });
    },

    getAll: function(path) {
      if(path.length > 0 && path[path.length - 1] != '/') {
        throw "Not a directory: " + path;
      }
      return this.storage.get(this.makePath(path)).then(function(status, body) {
        if(typeof(body) === 'object') {
          var promise = promising();
          var count = Object.keys(body).length, i = 0;
          for(var key in body) {
            return this.get(this.makePath(path + key)).then(function(status, body) {
              body[this.key] = body;
              i++;
              if(i == count) promise.fulfill(body);
            }.bind({ key: key }));
          }
          return promise;
        }
      }.bind(this));
    },

    // file operations

    getFile: function(path) {
      return this.storage.get(this.makePath(path)).then(function(status, body, mimeType, revision) {
        return {
          data: body,
          mimeType: mimeType,
          revision: revision // (this is new)
        };
      });
    },

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

    getObject: function(path) {
      return this.storage.get(this.makePath(path)).then(function(status, body, mimeType, revision) {
        if(typeof(body) == 'object') {
          return body;
        } else if(typeof(body) !== 'undefined' && status == 200) {
          throw "Not an object: " + this.makePath(path);
        }
      });
    },

    storeObject: function(mimeType, path, object) {
      return this.storage.put(this.makePath(path), object, mimeType).then(function(status, _body, _mimeType, revision) {
        if(status == 200 || status == 201) {
          return revision;
        } else {
          throw "Request (PUT " + this.makePath(path) + ") failed with status: " + status; 
        }
      });
    },

    // generic operations

    remove: function(path) {
      return this.storage.delete(this.makePath(path));
    },

    makePath: function(path) {
      return this.base + path;
    },

    _fireChange: function(event) {
      this._emit('change', event);
    }

  };

  /**
   * Method: RemoteStorage#scope
   *
   * Returns a new <RemoteStorage.BaseClient> scoped to the given path.
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


  RemoteStorage.BaseClient._rs_init = function() {
    RemoteStorage.prototype.scope = function(path) {
      return new RemoteStorage.BaseClient(this, path);
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

})();
(function() {

  RemoteStorage.MODULES = {};

  RemoteStorage.defineModule = function(moduleName, builder) {
    RemoteStorage.MODULES[moduleName] = builder;
  };

  RemoteStorage.prototype.loadModule = function(moduleName) {
    var builder = RemoteStorage.MODULES[moduleName];
    if(builder) {
      var module = builder(new RemoteStorage.BaseClient(this, '/' + moduleName + '/'),
                           new RemoteStorage.BaseClient(this, '/public/' + moduleName + '/'));
      this[moduleName] = module.exports;
    } else {
      throw "Unknown module: " + moduleName;
    }
  };

  RemoteStorage.prototype.defineModule = function(moduleName) {
    console.log("remoteStorage.defineModule is deprecated, use RemoteStorage.defineModule instead!");
    RemoteStorage.defineModule.apply(RemoteStorage, arguments);
    this.loadModule(moduleName);
  };

})();
(function() {
  function loadTable(table, storage) {
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
      if(storage.getCached) {
        storage.getCached(path).then(processRow);
      } else {
        storage.get(path).then(processRow);
      }
    }

    table.on

    loadRow('/');
  }


  function renderWrapper(title, table, storage) {
    var wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    var heading = document.createElement('h2');
    heading.textContent = title;
    wrapper.appendChild(heading);
    var updateButton = document.createElement('button');
    updateButton.textContent = "Update";
    updateButton.onclick = function() { loadTable(table, storage); };
    wrapper.appendChild(updateButton);
    if(storage.reset) {
      var resetButton = document.createElement('button');
      resetButton.textContent = "Reset";
      resetButton.onclick = function() {
        storage.reset(function(newStorage) {
          storage = newStorage;
          loadTable(table, storage);
        });
      };
      wrapper.appendChild(resetButton);
    }
    wrapper.appendChild(table);
    loadTable(table, storage);
    return wrapper;
  }

  RemoteStorage.prototype.inspect = function() {

    var widget = document.createElement('div');
    widget.id = 'remotestorage-inspect';

    if(this.local) {
      var syncButton = document.createElement('button');
      syncButton.textContent = "Synchronize";
      widget.appendChild(syncButton);
    }

    var remoteTable = document.createElement('table');
    var localTable = document.createElement('table');
    widget.appendChild(renderWrapper("Remote", remoteTable, this.remote));
    if(this.local) {
      widget.appendChild(renderWrapper("Local", localTable, this.local));

      syncButton.onclick = function() {
        this.sync().then(function() {
          loadTable(localTable, this.local)
        }.bind(this));
      }.bind(this);
    }

    document.body.appendChild(widget);
  };

})();
