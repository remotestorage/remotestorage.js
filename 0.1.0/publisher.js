define([
  'require',
  './sha1',
  './ajax',
  './oauth',
  './webfinger'
], function(require, sha1, ajax, oauth, webfinger) {
  var status = 'nobody';
  onHandlers = {};
  var webfingerAttr = null;
  if(localStorage.getItem('_shadowBackendToken')) {
    status = 'idle';
    webfingerAttr = JSON.parse(localStorage.getItem('_shadowWebfingerAttr'));
  }
  function on(eventName, handler) {
    if(typeof(onHandlers[eventName]) == 'undefined') {
      onHandlers[eventName] = [];
    }
    onHandlers[eventName].push(handler);
  }
  function trigger(eventName, arg) {
    if(typeof(onHandlers[eventName]) == 'undefined') {
      return;
    }
    var i;
    for(i=0;i<onHandlers[eventName].length;i++) {
      onHandlers[eventName][i](arg);
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
  function fail(code, msg) {
    trigger('fail', {code: code, msg: msg});
  }
  function setUserAddress(userAddress) {
    if(status != 'nobody') {
      return;
    }
    setStatus('checking');
    webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true,
      onError: function(code, msg) {
        fail(code, msg);
      }
    }, function(err) {
      fail(err);
      setStatus('nobody');
    }, function(attributes) {
      webfingerAttr = attributes;
      localStorage.setItem('_shadowWebfingerAttr', JSON.stringify(webfingerAttr));
      localStorage.setItem('_shadowBackendAddress', webfinger.resolveTemplate(webfingerAttr.template, 'public'));
      setStatus('noauth-');
    });
  }
  function getBackend(cb) {
    if(webfingerAttr.api=='CouchDB') {
      require(['couch'], cb);
    } else if((webfingerAttr.api=='WebDAV') || (webfingerAttr.api=='WebDAV')) {
      require(['dav'], cb);
    }
  }
  function doPublish(content, cb) {
    setStatus('pushing');
    getBackend(function(backend) {
      var hash = sha1.hash(content);

      backend.set(hash, content, function(msg) {
        fail(msg);
      }, function() {
        cb(hash);
        setStatus('idle');
      }, NaN);
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
          doPublish(content, cb);
        }
      });
      trigger('status', 'authing');
    } else if(status == 'idle') {
      doPublish(content, cb);
    }
  }
  return {
    on: on,
    setUserAddress: setUserAddress,
    publish: publish,
    ERR_NO_STORAGE: 5
  };
});
