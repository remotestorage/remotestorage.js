exports.sync = (function() {
  var backend;
  
  function setBackend(backendToSet) {
    backend = backendToSet;
  }
  function start() {
    localStorage.setItem('_shadowSyncStatus', 'pulling');
    console.log('setting sync status to pulling');
  }
  function push() {
    if(localStorage.getItem('_shadowSyncStatus') == 'pulling') {
      console.log('will push after pulling is completed');
    } else {
      localStorage.setItem('_shadowSyncStatus', 'pushing');
      console.log('setting sync status to pushing');
    }
  }
  function getItemToPull(next) {
    var itemToPull = localStorage.getItem('_shadowSyncCurrEntry');
    if(next) {
      if(itemToPull == null) {
        itemToPull = -1;
      }
      var shadowRemote =JSON.parse(localStorage.getItem('_shadowRemote'));
      var shadowIndex =JSON.parse(localStorage.getItem('_shadowIndex'));
      var keysArr = keys(shadowRemote);
      while(true) {
        itemToPull += 1;
        var thisKey = keysArr[itemToPull];
        if(shadowRemote[thisKey] > localStorage[thisKey]) {
           localStorage.setItem('_shadowSyncCurrEntry', itemToPull);
           return thisKey;
        }
        //if(itemToPull >= keysArr.length) { - this gets into an infinite loop with polluted array prototype
        if(typeof(keysArr[itemToPull]) == "undefined") {
          return false;
        }
      }
    }
    if(itemToPull == null) {
        return '_shadowIndex';
    } else {
      return (keys(JSON.parse(localStorage.getItem('_shadowRemote'))))[itemToPull];
    }
  }
  function resumePulling(timeout, cb) {
    var startTime = (new Date().getTime());
    console.log('resume pulling');
    itemToPull = getItemToPull(false);
    if(!itemToPull) {
      localStorage.setItem('_shadowSyncStatus', 'idle');
    } else {
      var remoteKeyName = itemToPull;
      if(itemToPull != '_shadowIndex') {
        remoteKeyName += '_'+JSON.parse(localStorage.getItem('_shadowRemote'))[itemToPull];
      }
      backend.get(remoteKeyName, function(msg) {
        console.log('error retrieving "'+remoteKeyName+'":'+msg);
        if((remoteKeyName == '_shadowIndex') && (msg==404)) {
          console.log('virgin remote');
          localStorage.setItem('_shadowRemote', JSON.stringify({}));
          localStorage.setItem('_shadowSyncStatus', 'idle');
        }
      }, function(value) {
        if(itemToPull == '_shadowIndex') {
          localStorage.setItem('_shadowRemote', value);
        } else {
           cb(itemToPull, value);
        }
        var nextItem = getItemToPull(true);
        if(nextItem) {
          var timeElapsed = (new Date().getTime()) - startTime;
          work(timeout - timeElapsed, cb);
        } else {
          localStorage.setItem('_shadowSyncStatus', 'idle');
        }
      }, timeout);
    }
  }
  //FIXME
  function keys(obj) {
    var keysArr = [];
    for(var i in obj) {
      keysArr.push(i);
    }
    return keysArr;
  }

  function getItemToPush(next) {
    var index = JSON.parse(localStorage.getItem('_shadowIndex'));
    var entryToPush = localStorage.getItem('_shadowSyncCurrEntry');
    if(entryToPush == null) {
      entryToPush = 0;//leave as null in localStorage, no use updating that
    }
    if(next) {
      entryToPush++;
      localStorage.setItem('_shadowSyncCurrEntry', entryToPush);
    }
    var keysArr = keys(index);
    if(entryToPush < keysArr.length) {
      return keysArr[entryToPush];
    } else if(entryToPush == keysArr.length) {
      return '_shadowIndex';
    } else {
      localStorage.removeItem('_shadowSyncCurrEntry');
      return false;
    }
  }

  function resumePushing(timeout) {
    var startTime = (new Date().getTime());
    console.log('resume pushing');
    var itemToPush = getItemToPush(false);
    var remoteKeyName = itemToPush;
    if(itemToPush != '_shadowIndex') {
      remoteKeyName += '_'+JSON.parse(localStorage.getItem('_shadowIndex'))[itemToPush];
    }
    backend.set(remoteKeyName, localStorage.getItem(itemToPush), function(msg) {
      console.log('error putting '+itemToPush);
    }, function() {
      if(getItemToPush(true)) {
        var timeElapsed = (new Date().getTime()) - startTime;
        work(timeout - timeElapsed, function() {
          console.log('incoming changes should not happen when pushing!');
        });
      } else {
        localStorage.setItem('_shadowSyncStatus', 'idle');
      }
    }, timeout);
  }
  function work(timeout, cbIncomingChange) {
    if(timeout < 0) {
      return;
    }
    console.log('sync working for '+timeout+' milliseconds:');
    if(localStorage.getItem('_shadowSyncStatus') == 'pulling') {
      resumePulling(timeout, cbIncomingChange);
    } else if(localStorage.getItem('_shadowSyncStatus') == 'pushing') {
      resumePushing(timeout);
    } else {
      console.log('nothing to work on.');
    }
  }
  return {
    setBackend: setBackend,
    start: start,
    push: push,
    work: work
  };
})();
