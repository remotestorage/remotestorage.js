(function(global) {
  var RS = RemoteStorage;
  /**
   * Dropbox backend for RemoteStorage.js
   */
  var haveLocalStorage;
  var dropbox = new Dropbox.Client({key : "e2z66d213q8isms"})
  var SETTINGS_KEY = 'remotestorage:dropboxclient';
  RS.DropboxClient = function(rs) {
    this.connected = dropbox.isAuthenticated();
    RS.eventHandling(this, 'change', 'connected');
    console.log(rs)
    rs.on('error', function(error){
      if(error instanceof RemoteStorage.Unauthorized) {
        //TODO deconfiguer the dropbox here and now
      }
    })
    
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

  RS.DropboxClient._rs_init = function(rs) {
    console.log("Dropbox init",rs)
    Object.defineProperty(RS.prototype, 'remote',{value: new RS.DropboxClient(rs)})
  }
  
  RS.DropboxClient._rs_supported = function() {
    haveLocalStorage = 'localStorage' in global;
    console.log("Dropbox _rs_supported ??")
    return true;
  }
  RS.DropboxClient._rs_cleanup = function() {
    console.log('rs_cleanup :P')
    if(haveLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
  }
})(this)
