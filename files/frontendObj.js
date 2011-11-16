    function FrontendObj() {
      return {
        length: calcLength(),
        _tryConnect: _tryConnect,
        key: function(req) {
          for(var i=0; i<localStorage.length; i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              if(req == 0) {
                return localStorage.key(i).substring(15);
              }
              req--;
            }
          }
        },
        getItem: function(k) {
          var cacheObj = localStorage.getItem('_remoteStorage_'+k);
          if(cacheObj) {
            try {
              return JSON.parse(cacheObj).value;
            }catch(e) {}
          }
          return null;
        },
        setItem: function(k,v) {
          var cacheObj = {};
          var cacheStr = localStorage.getItem('_remoteStorage_'+k);
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
          localStorage.setItem('_remoteStorage_'+k, JSON.stringify(cacheObj));
          window.remoteStorage.length = calcLength();
          markDirty(k);
          work();
        },
        removeItem: function(k) {
          localStorage.removeItem('_remoteStorage_'+k);
          window.remoteStorage.length = calcLength();
          markDirty(k);
          work();
        },
        clear: function() {
          var keysToRemove = [];
          for(var i=0;i<localStorage.length;i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              keysToRemove.push(localStorage.key(i));
              keysToRemove.push('_remoteStorageWorking_'+localStorage.key(i));
              markDirty(localStorage.key(i));
            }
          }
          keysToRemove.forEach(function(key){
            localStorage.removeItem(key);
          });
          window.remoteStorage.length = 0;
          work();
        },
        isConnected: function() {
          return (localStorage.getItem('_remoteStorageOauthToken') != null);
        },
        getUserAddress: function() {
          return localStorage.getItem('_remoteStorageUserAddress');
        },
        disconnect: function() {
          localStorage.removeItem('_remoteStorageUserAddress');
          localStorage.removeItem('_remoteStorageCategory');
          localStorage.removeItem('_remoteStorageKV');
          localStorage.removeItem('_remoteStorageAPI');
          localStorage.removeItem('_remoteStorageAuthAddress');
          localStorage.removeItem('_remoteStorageOauthToken');
          localStorage.removeItem('_remoteStorageDirties');
          localStorage.removeItem('remoteStorageIndex');
          var keysToRemove = [];
          for(var i=0; i<localStorage.length; i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              keysToRemove.push(localStorage.key(i));
            }
          }
          keysToRemove.forEach(function(key){
            if(window.remoteStorage.options.onChange) {
              remoteStorage.options.onChange(key.substring(15), localStorage.getItem(key), null);
            }
            localStorage.removeItem(key);
          });
        },
        _init: function() {
          backend.sync();
        },
        cssFilePath: cssFilePath
      }
