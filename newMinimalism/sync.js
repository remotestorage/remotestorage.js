exports.sync = (function() {
  var backend = {
    function get(key, err, cb, timeout) {
      console.log('backend.get("'+key+'", "'+value+'", err, cb, '+timeout+');');
    }
    function set(key, value, err, cb, timeout) {
      console.log('backend.set("'+key+'", "'+value+'", err, cb, '+timeout+');');
    }
    function remove(key, err, cb, timeout) {
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
    if(entryToPush < index.length) {
      return index[entryToPush];
    } else if(entryToPush == index.length) {
      return '_shadowRevision_'+pushRev;
    } else {
      localStorage.removeItem('_shadowSyncCurrEntry');
      return false;
    }
  }

  function resumePushing(timeout, cb) {
    console.log('resume pushing');
    var itemToPush = getItemToPush(false);
    backend.set(nextItemToPush, localStorage.getItem(itemToPush), function(msg) {
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
