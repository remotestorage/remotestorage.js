exports.sync = (function() {
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
  function work(timeout) {
    console.log('sync working for '+timeout+' milliseconds:');
    if(localStorage.getItem('_shadowSyncStatus') == 'pulling') {
      console.log('resume pulling');
    } else if(localStorage.getItem('_shadowSyncStatus') == 'pushing') {
      console.log('resume pulling');
    } else {
      console.log('nothing to work on.');
    }
  }
  return {
    start: start,
    push: push,
    work: work
  };
})();
