//situations:
// disconnected
// fetching
// delivering
// connected
// versioning should take care of creating local revisions and merging.
// incoming remote: merge into existing remote; whenever there is news, pass it on to local
// local change detected: create new local revision, and if connected and merged, push it out
// ahead of remote
// remote ahead of local
//
// when logging in, retrieve remote. merge in any keys that are ahead of local
// every 10 seconds, maybe create new local. if so, push it and make it the new head.
//
// data structures:
// _shadowState
//   local: (timestamp) 
//   remote: (timestamp)
// _shadowRevision_(timestamp)
//   (key): (timestamp)
// _shadowItem_(key)_(timestamp) - contains value of that key at that timestamp. in the unlikely event of a timestamp-collision, local wins.

exports.versioning = (function() {
  function takeLocalSnapshot() {
    var hasChanges = false;
    var now = ((new Date()).getTime())/1000;
    var state = JSON.parse(localStorage.getItem('_shadowState'));
    if(!state) {
      state = {
        local: 0,
        remote: 0
      };
    }
    var index;
    if(state.local) {
      index = JSON.parse(localStorage.getItem('_shadowRevision_'+state.local));
    } else {
      index = {};
      hasChanges = true;
    }
    for(var i = 0; i<localStorage.length; i++) {
      var thisKey = localStorage.key(i);
      if(thisKey.substring(0, 7) != '_shadow') {
        var val = localStorage.getItem(thisKey);
        var shadowVal;
        var previousTimestamp = index[thisKey];
        if(previousTimestamp) {
          shadowVal = localStorage.getItem('_shadowItem_'+thisKey+'_'+previousTimestamp);
        }
        if(val != shadowVal) {
          localStorage.setItem('_shadowItem_'+thisKey+'_'+now, val);
          console.log('storing local version of item "'+thisKey+'" @'+now);
          index[thisKey] = now;
          hasChanges = true;
        }
      }
    }
    if(hasChanges) {
      state.local = now;
      localStorage.setItem('_shadowState', JSON.stringify(state));
      localStorage.setItem('_shadowRevision_'+now, JSON.stringify(index));
      console.log('storing local snapshot '+now);
      return now;
    } else {
      return false;
    }
  }
  return {
    takeLocalSnapshot: takeLocalSnapshot
  };
})();
