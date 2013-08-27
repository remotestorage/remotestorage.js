(function(global) {
  var RS = RemoteStorage;
  /**
   * Dropbox backend for RemoteStorage.js
   */
  var haveLocalStorage;
  var AUTH_URL = 'https://www.dropbox.com/1/oauth2/authorize'
  

  var SETTINGS_KEY = 'remotestorage:dropboxclient';
  RS.Dropbox = function(rs) {
    this.connected = false;
    RS.eventHandling(this, 'change', 'connected');
    rs.on('error', function(error){
      if(error instanceof RemoteStorage.Unauthorized) {
        //TODO deconfiguer the dropbox here and now
      }
    })
    this.clientId = rs.apiKeys.dropbox.api_key
    if(haveLocalStorage){
      var settings;
      try{
        settings = JSON.parse(localStorage[SETTINGS_KEY]);
      } catch(e){}
      if(settings) {
        //configure the dropbox client here and now
      }
    }
    if(this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
   
  }
  RS.Dropbox.prototype = {
    connect: function() {
      localStorage[RemoteStorage.BACKEND_KEY] = 'dropbox';
      RS.Authorize(AUTH_URL, '', String(document.location), this.clientId);
    },
    configure: function(useradress, href, storageApi, token) { 
      console.log('dropbox configure',arguments);
      if(typeof(token) !== 'undefined') this.token = token;
      if(this.token){
        this.connected = true;
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if(haveLocalStorage){
        localStorage[SETTINGS_KEY] = token
      }
    },
    get: function(path, options){},
    put: function(path, body, contentType, options){
      if(! this.connected) throw new Error("not connected (path: " + path + ")");
      var promise = promising();
      dropbox.writeFile(path, body, 
        function(error, stat) {
          if(error){
            promise.reject(error)
          }else{
            promise.fulfill(stat);
          }

            })
    },
    'delete': function(path, options){}
  }
  RS.Dropbox._rs_init = function(rs) {
    console.log("Dropbox init",rs)
    var config = rs.apiKeys.dropbox
    if(config) {
      console.log('dropbox init ',config)
      Object.defineProperty(RS.prototype, 'dropbox',{value: new RS.Dropbox(rs)})
    }
    if(localStorage[RemoteStorage.BACKEND_KEY] == 'dropbox'){
      rs._origRemote = rs.remote;
      rs.remote = rs.dropbox;
    }
  }
  
  RS.Dropbox._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    console.log("Dropbox _rs_supported ??")
    return true;
  }
  RS.Dropbox._rs_cleanup = function() {
    console.log('rs_cleanup :P')
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
      delete localStorage[RemoteStorage.BACKEND_KEY];
    }
  }
})(this)
