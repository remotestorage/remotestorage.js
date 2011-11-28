exports.versioning = (function() {
  function incomingChange(key, value) {
    var now = ((new Date()).getTime())/1000;
    var shadowIndex = JSON.parse(localStorage.getItem('_shadowIndex')) || {};
    shadowIndex[key] = now;
    localStorage.setItem('_shadowIndex', JSON.stringify(shadowIndex));
    localStorage.setItem(key, value);
  }
  function takeLocalSnapshot() {
    var hasChanges = false;
    var now = ((new Date()).getTime())/1000;
    var shadowIndex = JSON.parse(localStorage.getItem('_shadowIndex')) || {};
    var shadowRemote = JSON.parse(localStorage.getItem('_shadowRemote')) || {};
    for(var i = 0; i<localStorage.length; i++) {
      var thisKey = localStorage.key(i);
      if(thisKey.substring(0, 7) != '_shadow') {
        var val = localStorage.getItem(thisKey);
        var shadowVal = localStorage.getItem('_shadowItem_'+thisKey);
        if(val != shadowVal) {
          localStorage.setItem('_shadowItem_'+thisKey, val);
          console.log('storing local version of item "'+thisKey+'" @'+now);
          shadowIndex[thisKey] = now;
          hasChanges = true;
        }
      }
    }
    if(hasChanges) {
      localStorage.setItem('_shadowIndex', JSON.stringify(shadowIndex));
      console.log('storing local snapshot '+now);
      return now;
    } else {
      return false;
    }
  }
  return {
    incomingChange: incomingChange,
    takeLocalSnapshot: takeLocalSnapshot
  };
})();
