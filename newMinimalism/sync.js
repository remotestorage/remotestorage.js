exports.sync = (function() {
  var backend = {
    get: function(key, err, cb, timeout) {
      console.log('backend.get("'+key+'", "'+value+'", err, cb, '+timeout+');');
    },
    set: function(key, value, err, cb, timeout) {
      console.log('backend.set("'+key+'", "'+value+'", err, cb, '+timeout+');');
    },
    remove: function(key, err, cb, timeout) {
      console.log('backend.remove("'+key+'", "'+value+'", err, cb, '+timeout+');');
    }
  };
  function setBackend(backendToSet) {
    backend = backendToSet;
  }
  function start() {
    localStorage.setItem('_shadowSyncStatus', 'pulling');
    console.log('setting sync status to pulling');
  }
  function push(timestamp) {
    if(localStorage.getItem('_shadowSyncStatus') == 'pulling') {
      console.log('will push after pulling is completed');
    } else {
      localStorage.setItem('_shadowSyncStatus', 'pushing');
      localStorage.setItem('_shadowSyncPushRev', timestamp);
      console.log('setting sync status to pushing revision '+timestamp);
    }
  }
  function resumePulling(timeout, cb) {
    console.log('resume pulling');
    backend.get('_shadowLatestRevision', function(msg) {
      console.log('error retrieving _shadowLatestRevision');
    }, function(value) {
      localStorage.setItem('_shadowRemote', value);
      localStorage.setItem('_shadowSyncStatus') == 'idle';
      cb();
    }, timeout);
  }
  function objLength(obj) {//FIXME: look up javascript lang ref when connected
    var i = 0;
    for(var j in obj) {
      i++;
    }
    return i;
  }
  function objKey(obj, i) {//FIXME: look up javascript lang ref when connected
    var j = 0;
    for(var k in obj) {
      if(i==j) {
        return k;
      }
      j++;
    }
    return undefined;
  }

  function getItemToPush(next) {
    var pushRev = localStorage.getItem('_shadowSyncPushRev');
    var index = JSON.parse(localStorage.getItem('_shadowRevision_'+pushRev));
    var entryToPush = localStorage.getItem('_shadowSyncCurrEntry');
    if(entryToPush == null) {
      entryToPush = 0;//leave as null in localStorage, no use updating that
    }
    if(next) {
      entryToPush++;
      localStorage.setItem('_shadowSyncCurrEntry', entryToPush);
    }
    if(entryToPush < objLength(index)) {
      return objKey(index, entryToPush);
    } else if(entryToPush == objLength(index)) {
      return '_shadowRevision_'+pushRev;
    } else {
      localStorage.removeItem('_shadowSyncCurrEntry');
      return false;
    }
  }

  function resumePushing(timeout, cb) {
    console.log('resume pushing');
    var itemToPush = getItemToPush(false);
    backend.set(itemToPush, localStorage.getItem(itemToPush), function(msg) {
      console.log('error putting '+itemToPush);
    }, function() {
      if(getItemToPush(true)) {
        var timeElapsed = (new Date().getTime()) - startTime;
        work(timeout - timeElapsed, cb);
      } else {
        localStorage.setItem('_shadowSyncStatus') == 'idle';
        cb();
      }
    }, timeout);
  }
  function work(timeout, cb) {
    var startTime = (new Date().getTime());
    console.log('sync working for '+timeout+' milliseconds:');
    if(localStorage.getItem('_shadowSyncStatus') == 'pulling') {
      resumePulling(timeout, cb);
    } else if(localStorage.getItem('_shadowSyncStatus') == 'pushing') {
      resumePushing(timeout, cb);
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
