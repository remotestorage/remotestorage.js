
      ////////////////////////////////////////
     // asynchronous synchronization queue //
    ////////////////////////////////////////

    window.remoteStorage = (function(){
      function work(minRevision) {
        if(!(localStorage.getItem('_remoteStorageOauthToken'))) {
          return;
        }
        var dirties = JSON.parse(localStorage.getItem('_remoteStorageDirties'));
        for(dirty in dirties) {
          var thisAction = dirties[dirty];
          if(thisAction.revision>=minRevision) {
            var alreadyWorking = localStorage.getItem('_remoteStorageWorking_'+thisAction.key);
            if(!alreadyWorking) {
              localStorage.setItem('_remoteStorageWorking_'+thisAction.key, thisAction.revision);
              dirties[dirty]=undefined;
              localStorage.setItem('_remoteStorageDirties', JSON.stringify(dirties));
              if(thisAction.action == 'clear') {
                backend.clear(function() {
                  localStorage.removeItem('_remoteStorageWorking_'+thisAction.key);
                  work(1);
                });
              } else if(thisAction.action == 'setItem') {
                backend.setItem(thisAction.key, thisAction.value, thisAction.revision, function(revision) {
                  localStorage.removeItem('_remoteStorageWorking_'+thisAction.key);
                  work(revision+1);
                });
              } else if(thisAction.action == 'removeItem') {
                backend.removeItem(thisAction.key, thisAction.revision, function(revision) {
                  localStorage.removeItem('_remoteStorageWorking_'+thisAction.key);
                  work(revision+1);
                });
              }
              return;
            }
          }
        }
      }
      function pushAction(action) {
        var dirties = JSON.parse(localStorage.getItem('_remoteStorageDirties'));
        if(dirties==null){
          dirties={};
        }
        action.revision = new Date().getTime();
        dirties[action.key] = action;
        localStorage.setItem('_remoteStorageDirties', JSON.stringify(dirties));
      }
      work(0);
