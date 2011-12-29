define([
  'require',
  './ajax',
  './oauth',
  './webfinger'
], function(require, ajax, oauth, webfinger) {
  var status = 'nobody';
  onHandlers = {};
  var webfingerAttr = null;
  function on(eventName, handler) {
    if(typeof(onHandlers[eventName]) == 'undefined') {
      onHandlers[eventName] = [];
    }
    onHandlers[eventName].push(handler);
  }
  function trigger(eventName, arg0) {
    if(typeof(onHandlers[eventName]) == 'undefined') {
      return;
    }
    var i;
    for(i=0;i<onHandlers[eventName].length;i++) {
      onHandlers[eventName][i](arg0);
    }
  }
  function setStatus(newStatus) {
    //statuses: nobody, checking, noauth-, pushing, idle, disconnected
    if(newStatus in {'nobody':'', 'checking':'', 'noauth-':'', 'authing':'', 'pushing':'', 'idle':'', 'disconnected':''}) {
      status = newStatus;
      trigger('status', newStatus);
    } else {
      console.log('unknown status '+newStatus);
    }
  }
  function fail(msg) {
    trigger('fail', msg);
  }
  function setUserAddress(userAddress) {
    setStatus('checking');
    webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: false
    }, function(err) {
      fail(err);
      setStatus('nobody');
    }, function(attributes) {
      webfingerAttr = attributes;
      setStatus('noauth-');
    });
  }
  function publish(content, loc, cb) {
    if(status == 'checking') {
      fail('can only publish from a click handler, and still have to wait for webfinger to come back');
      trigger('status', 'pushing');
    } else if(status == 'noauth-') {
      window.open(webfingerAttr.auth
        + ((webfingerAttr.auth.indexOf('?') == -1)?'?':'&')
        + 'client_id=' + loc
        + '&redirect_uri=' + loc
        + '&scope=public'
        + '&response_type=token');
      window.addEventListener('storage', function(e) {
        if(e.key=='_shadowBackendToken') {
          trigger('status', 'pushing');
          getBackend(function(backend) {
            var hash = sha1.sha1(content);
            backend.put(hash, content, function() {
              cb(hash);
            });
          });
        }
      });
      trigger('status', 'authing');
    }
  }
  return {
    on: on,
    setUserAddress: setUserAddress,
    publish: publish
  };
});
