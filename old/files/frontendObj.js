if(!window) {
  var window = {
    localStorage: {
    }
  };
}

exports.frontendObj = (function() {

        //////////////////
       // DOM API shim //
      //////////////////

      function calcLength() {
        var len = 0;
        for(var i=0; i<window.localStorage.length; i++) {
          if(window.localStorage.key(i).substring(0,15)=='_remoteStorage_') {
            len++;
          }
        }
        return len;
      }

  return {
    configure: function(setOptions) {
      window.remoteStorage.options = {//set defaults
        category: location.host,
        onChange: function() {},
        preferBrowserSessionIfNative: true,
        preferBrowserIdIfNative: true,
        preferBrowserIdAlways: false
      };
      if(setOptions) {
        for(var option in setOptions) {
          window.remoteStorage.options[option] = setOptions[option];
        }
      }
      if(window.remoteStorage.options.userAddress) {
        window.localStorage.setItem('_remoteStorageUserAddress', window.remoteStorage.options.userAddress);
      }
      if(window.remoteStorage.options.token) {
        window.localStorage.setItem('_remoteStorageOauthToken', window.remoteStorage.options.token);
      }

      if(NeedLoginBox()=='legacy') {
        var divEl = document.createElement('div');
        divEl.id = 'remoteStorageDiv';
        divEl.innerHTML = '<link rel="stylesheet" href="'+remoteStorage.cssFilePath+'" />'
          +'<input id="userAddressInput" type="text" placeholder="you@yourremotestorage" onkeyup="InputKeyUp(this);">'
          +'<span id="userAddress" style="display:none" onmouseover="SpanMouseOver(this);" onmouseout="SpanMouseOut(this);" onclick="SpanClick(this)"></span>'
          +'<input id="userButton" type="submit" value="Sign in" onclick="ButtonClick(this,'
          +'\''+window.remoteStorage.options.category+'\')">';
        document.body.insertBefore(divEl, document.body.firstChild);
      }
      window.remoteStorage._tryConnect();
      if(window.remoteStorage.isConnected()) {
        window.remoteStorage._init();
      }
      if(NeedLoginBox()=='legacy') {
        DisplayConnectionState();
      }
      return window.remoteStorage.options;
    },
    length: calcLength(),
    _tryConnect: _tryConnect,
    key: function(req) {
      for(var i=0; i<window.localStorage.length; i++) {
        if(window.localStorage.key(i).substring(0,15)=='_remoteStorage_') {
          if(req == 0) {
            return window.localStorage.key(i).substring(15);
          }
          req--;
        }
      }
    },
    getItem: function(k) {
      var cacheObj = window.localStorage.getItem('_remoteStorage_'+k);
      if(cacheObj) {
        try {
          return JSON.parse(cacheObj).value;
        }catch(e) {}
      }
      return null;
    },
    setItem: function(k,v) {
      var cacheObj = {};
      var cacheStr = window.localStorage.getItem('_remoteStorage_'+k);
      if(cacheStr) {
        try {
          var cacheObj = JSON.parse(cacheStr);
          var oldValue = cacheObj.value;
          if(v == oldValue) {
            return;
          }
        }catch(e) {}
      }
      cacheObj.value=v;
      window.localStorage.setItem('_remoteStorage_'+k, JSON.stringify(cacheObj));
      window.remoteStorage.length = calcLength();
      markDirty(k);
      work();
    },
    removeItem: function(k) {
      window.localStorage.removeItem('_remoteStorage_'+k);
      window.remoteStorage.length = calcLength();
      markDirty(k);
      work();
    },
    clear: function() {
      var keysToRemove = [];
      for(var i=0;i<window.localStorage.length;i++) {
        if(window.localStorage.key(i).substring(0,15)=='_remoteStorage_') {
          keysToRemove.push(window.localStorage.key(i));
          keysToRemove.push('_remoteStorageWorking_'+window.localStorage.key(i));
          markDirty(window.localStorage.key(i));
        }
      }
      keysToRemove.forEach(function(key){
        window.localStorage.removeItem(key);
      });
      window.remoteStorage.length = 0;
      work();
    },
    isConnected: function() {
      return (window.localStorage.getItem('_remoteStorageOauthToken') != null);
    },
    getUserAddress: function() {
      return window.localStorage.getItem('_remoteStorageUserAddress');
    },
    disconnect: function() {
      window.localStorage.removeItem('_remoteStorageUserAddress');
      window.localStorage.removeItem('_remoteStorageCategory');
      window.localStorage.removeItem('_remoteStorageKV');
      window.localStorage.removeItem('_remoteStorageAPI');
      window.localStorage.removeItem('_remoteStorageAuthAddress');
      window.localStorage.removeItem('_remoteStorageOauthToken');
      window.localStorage.removeItem('_remoteStorageDirties');
      window.localStorage.removeItem('remoteStorageIndex');
      var keysToRemove = [];
      for(var i=0; i<window.localStorage.length; i++) {
        if(window.localStorage.key(i).substring(0,15)=='_remoteStorage_') {
          keysToRemove.push(window.localStorage.key(i));
        }
      }
      keysToRemove.forEach(function(key){
        if(window.remoteStorage.options.onChange) {
          remoteStorage.options.onChange(key.substring(15), window.localStorage.getItem(key), null);
        }
        window.localStorage.removeItem(key);
      });
    },
    _init: function() {
      backend.sync();
    },
    cssFilePath: cssFilePath
  };
})();
