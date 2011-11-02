
      ////////////////////////////////////////
     // asynchronous synchronization tasks //
    ////////////////////////////////////////

      return {
        clear: function(cb) {
          var revision = 0;
          var index = JSON.parse(localStorage.getItem('remoteStorageIndex'));
          for(var i in index) {
            doCall('DELETE', i, null, function() {});
          }
          index={};
          localStorage.setItem('remoteStorageIndex', JSON.stringify(index));
          doCall('PUT', 'remoteStorageIndex', index, cb);
        },
        setItem: function(key, value, revision, cb) {
          var index = JSON.parse(localStorage.getItem('remoteStorageIndex'));
          if(!index) {//first use
            index={};
            localStorage.setItem('remoteStorageIndex', JSON.stringify(index));
          }
          if((!index[key]) || (index[key]<revision)) {
            doCall('PUT', key, value, function() {
              index[key]=revision;
              localStorage.setItem('remoteStorageIndex', JSON.stringify(index));
              doCall('PUT', 'remoteStorageIndex', index, cb);
            });
          } else {//shouldn't happen!
            cb(revision+1);
          }
        },
        removeItem: function(key, revision, cb) {
          var index = JSON.parse(localStorage.getItem('remoteStorageIndex'));
          if((!index[key]) || (index[key]<revision)) {
            doCall('DELETE', key, null, function() {
              index[keys]=revision;
              localStorage.setItem('remoteStorageIndex', JSON.stringify(index));
              doCall('PUT', 'remoteStorageIndex', index, cb);
            });
          }
        },
        connect: function(userAddress, dataScope, cb) {
          var onError = function(errorMsg) {
            alert(errorMsg);
          }
          var callback = function(rsAuth, rStemplate, rSapi) {
            cb();
            var rSkvParts = rStemplate.split('{scope}');
            var rSkv = rSkvParts[0]+dataScope+rSkvParts[1];
            localStorage.setItem('_remoteStorageUserAddress', userAddress);
            localStorage.setItem('_remoteStorageDataScope', dataScope);
            localStorage.setItem('_remoteStorageKV', rSkv)
            localStorage.setItem('_remoteStorageAPI', rSapi)
            localStorage.setItem('_remoteStorageAuthAddress', rSauth)
            oauth.go(rSauth, dataScope, userAddress);
          }
          webfinger.getDavBaseAddress(userAddress, onError, callback);
        },
        setToken: function(token) {
          localStorage.setItem('_remoteStorageOauthToken', token);
        },
        sync: function() {
          var localIndex = JSON.parse(localStorage.getItem('remoteStorageIndex'));
          if(!localIndex) {
            localIndex = {};
          }
          doCall('GET', 'remoteStorageIndex', null, function(data) {
            var remoteIndex;
            try {
              remoteIndex = JSON.parse(data.value);
            } catch(e) {
              remoteIndex = {};
            }
            for(var i in remoteIndex) {
              if((localIndex[i] == undefined) || (remoteIndex[i] > localIndex[i])) {//need to pull it
                doCall('GET', i, null, function(data) {
                  localStorage.setItem('_remoteStorage_'+i, data.value);
                  var localIndex = JSON.parse(localStorage.getItem('remoteStorageIndex'));
                  if(!localIndex) {
                    localIndex = {};
                  }
                  localIndex[i]=data.revision;
                  localStorage.setItem('remoteStorageIndex', JSON.stringify(localIndex));
                  var oldValue = localStorage.getItem('_remoteStorage_'+i);
                  if(window.remoteStorage.options.onChange) {
                    window.remoteStorage.options.onChange(i, oldValue, data.value);
                  }
                });
              } else if(remoteIndex[i] < localIndex[i]) {//need to push it
                localValue = localStorage.getItem('_remoteStorage_'+i);
                var obj = JSON.parse(localValue);
                obj.revision = localIndex[i];
                doCall('PUT', i, obj, function() {});
              }
            }
          });
        }
      }
    })()
