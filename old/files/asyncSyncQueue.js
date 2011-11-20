
      ////////////////////////////////////////
     // asynchronous synchronization queue //
    ////////////////////////////////////////

      function work() {
        if(!(localStorage.getItem('_remoteStorageOauthToken'))) {
          return;
        }
        var time = 1;
        var dirties = JSON.parse(localStorage.getItem('_remoteStorageDirties'));
        for(dirty in dirties) {
          //var alreadyWorking = localStorage.getItem('_remoteStorageWorking_'+dirty);
          //if(!alreadyWorking) {
          if(true) {
            //localStorage.setItem('_remoteStorageWorking_'+dirty, time);
            localStorage.setItem('_remoteStorageDirties', JSON.stringify(dirties));
            if(dirties[dirty]) {
              backend.tryOutbound(dirty, function() {
                //localStorage.removeItem('_remoteStorageWorking_'+dirty);
              });
            } else {
              backend.tryInbound(dirty, function() {
                //localStorage.removeItem('_remoteStorageWorking_'+dirty);
              });
            }
            delete dirties[dirty];
          }
        }
      }
      function markDirty(key, outbound) {
        if(outbound==undefined) {
          outbound = true;
        }
        var dirties = JSON.parse(localStorage.getItem('_remoteStorageDirties'));
        if(dirties==null){
          dirties={};
        }
        var time;
        if(outbound) {
          time = new Date().getTime();
        } else {
          time = 0;
        }
        dirties[key] = time;
        localStorage.setItem('_remoteStorageDirties', JSON.stringify(dirties));
      }
      work();
