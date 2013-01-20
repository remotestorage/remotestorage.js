remoteStorage.defineModule('messages', function(privateClient, publicClient) {
  var sock, open, sockStateCb = function() {}, resultCb = function() {};
  function getConfig() {
    return privateClient.getObject('.sockethub');
  }
  function getWebsocketAddress() {
    return getConfig().then(function(obj) {
      console.log('config is now', typeof(obj), obj, obj.domain, obj.port);
      if(obj) {
        return {
          wss: 'wss://'+obj.domain+':'+obj.port+'/sock/websocket',
          https: 'https://'+obj.domain+':'+obj.port+'/'
        };
      }
    });
  }
  function tryConnect() {
    getWebsocketAddress().then(function(obj) {
      console.log('setting sock to '+obj.wss);
      try {
        sock = new WebSocket(obj.wss);
      } catch(e) {
        console.log(e);
        sockStateCb(false);
        return;
      }
      sock.onopen = function() {
        sockStateCb(true);
        open=true;
      };
      sock.onmessage = function(e) {
        var timeStr = new Date().getTime().toString(),
          timePath = 'outgoing/'+timeStr.substring(0, 4)+'/'+timeStr.substring(4);
        privateClient.storeObject('activity', timePath, e).then(function() {
          resultCb();
        });
      };
      sock.onclose = function() {
        console.log('onclose', open);
        if(open) {//open socket died
          tryConnect();
        } else {//socket failed to open
          sockStateCb(false);
        }
      };
    });
  }
  return {
    exports: {
      getConfig: getConfig,
      getWebsocketAddress: getWebsocketAddress,
      tryConnect: tryConnect,
      setConfig: function (obj) {
        return privateClient.storeObject('sockethub-config', '.sockethub', obj);
      },
      getHistory: function() {
        var timeStr = new Date().getTime().toString(),
          timePath = 'outgoing/'+timeStr.substring(0, 4)+'/';
        return privateClient.getAll(timePath);
      },
      sendTo: function(world, text) {
        return getConfig().then(function(config) {
          sock.send(JSON.stringify({
            world: world,
            id: new Date().getTime(),
            object: {
              text: text
            },
            secret: config.secret
          }));
        });
      },
      onSockState: function(cb) {
        sockStateCb = cb;
      },
      onResult: function(cb) {
        resultCb = cb;
      }
    }
  };
});
