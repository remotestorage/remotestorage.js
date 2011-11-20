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
  function resumePulling(timeout, cb) {
    console.log('resume pulling');
    backend.get('_shadowIndex', function(msg) {
      console.log('error retrieving _shadowIndex:'+msg);
      if(msg==404) {
        console.log('virgin remote');
        localStorage.setItem('_shadowRemote', JSON.stringify({}));
        localStorage.setItem('_shadowSyncStatus', 'idle');
        cb();
      }
    }, function(value) {
      localStorage.setItem('_shadowRemote', value);
      localStorage.setItem('_shadowSyncStatus', 'idle');
      cb();
    }, timeout);
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
    var index = JSON.parse(localStorage.getItem('_shadowLocal'));
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

  function resumePushing(timeout, cb) {
    var startTime = (new Date().getTime());
    console.log('resume pushing');
    var itemToPush = getItemToPush(false);
    backend.set(itemToPush, localStorage.getItem(itemToPush), function(msg) {
      console.log('error putting '+itemToPush);
    }, function() {
      if(getItemToPush(true)) {
        var timeElapsed = (new Date().getTime()) - startTime;
        work(timeout - timeElapsed, cb);
      } else {
        localStorage.setItem('_shadowSyncStatus', 'idle');
        cb();
      }
    }, timeout);
  }
  function work(timeout, cb) {
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
