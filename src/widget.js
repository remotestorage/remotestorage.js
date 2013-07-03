(function() {

  function stateSetter(widget, state) {
    return function() { 
      console.log('widget:',widget);
      widget.view.setState(state);
    };
  }

  RemoteStorage.Widget = function(remoteStorage) {
    this.rs = remoteStorage;
    this.view = new View;

    this.rs.on('ready', stateSetter(this, 'connected'));
    this.rs.on('disconnected', stateSetter(this, 'disconnected'));
    this.view.on('connect', 
                 function(a){
                   console.log(this);
                   this.rs.connect(a);
                }.bind(this)
  )
  };

  RemoteStorage.Widget.prototype = {
    display: function() {
      this.view.display.apply(this.view, arguments);
      return this;
    }
  };

  RemoteStorage.prototype.displayWidget = function() {
    if(typeof(this.widget) === 'undefined')
      (this.widget = new RemoteStorage.Widget(this)).display();
    else
      this.widget.display();
  };

  RemoteStorage.Widget._rs_init = function(remoteStorage){
    window.addEventListener('load', function() {
      remoteStorage.displayWidget();
    });
  }

    function cEl(t){
    return document.createElement(t);
  }
  function gCl(parent, className){
    return parent.getElementsByClassName(className)[0];
  }
  function gTl(parent, className){
    return parent.getElementsByTagName(className)[0];
  }

  function toggle_bubble(widget){
    var el = gCl(widget,'bubble-expandable');
    if(el.style.display === 'none'){
      show(el);
    }else{
      hide(el);
    }
  }
  function show(el, display){
    if(typeof(display) === 'undefined'){
      display = 'block';
    }
    el.style.display = display
    return el;
  }
  function hide(el){
    show(el,'none');
    return el;
  }

  // MAYBE do those two in a el.className.split(' ') way more safe
  function removeClass(el, className){
    el.className = el.className.replace(' '+className+' ', ' ');
  }
  function addClass(el, className){
    el.className += ' '+className;
  }


  function View(){
    if(typeof(document) === 'undefined') {
      throw "Widget not supported";
    }
    RemoteStorage.eventHandling(this, 
                                'connect', 
                                'disconnect', 
                                'sync', 
                                'reconnect', 
                                'display')
    
    this.display = function() {
      
        if( ! (typeof(this.widget) === 'undefined') )
          return this.widget;
        
        var element = cEl('div')
        var style = cEl('style');
        style.innerHTML = RemoteStorage.Assets.widgetCss;
        
        element.id="remotestorage-widget"
        
        element.innerHTML = RemoteStorage.Assets.widget;
      
      
        element.appendChild(style)
        document.body.appendChild(element);
      
      var el;
        //connect button
      cb = gCl(element,'connect')
      gTl(cb, 'img').src=RemoteStorage.Assets.connectIcon;
      console.log(this);
      cb.addEventListener('click', this.events.connect.bind(this));

        // input
      el = gTl(element, 'form').userAddress;
      el.addEventListener('keyup', function(event){
        
        if(event.target.value) cb.removeAttribute('disabled');
        else cb.setAttribute('disabled','disabled');
        
      })
        
        //the cube
      el = gCl(element, 'cube');
      el.src = RemoteStorage.Assets.remoteStorageIcon
      el.addEventListener('click', 
                          function(){
                            toggle_bubble(this.widget)
                          }.bind(this)
                         )
      
  
      this.widget = element;
      
      this.states.initial.bind(this)()
      return this.widget;  
    }

    this.setState = function(state){
      var s;
      if(typeof(this.states[state]) === 'undefined'){
  	throw "Bad State assigned to view"
      }
      this.states[state].call(this);
      
    }
    
    this.setUserAdress = function(addr){
      widget.userAdress = addr;
    }
  };
  
  View.prototype = {
     // States:
     //  initial      - not connected
     //  authing      - in auth flow
     //  connected    - connected to remote storage, not syncing at the moment
     //  busy         - connected, syncing at the moment
     //  offline      - connected, but no network connectivity
     //  error        - connected, but sync error happened
     //  unauthorized - connected, but request returned 401
    currentState : 'initial',
    states :  {
      initial : function(){
        this.widget.className = "remotestorage-state-initial"
      },
      authing : function(){
      },
      connected : function(){
        this.widget.className = "remotestorage-state-connected"
      },
      busy : function(){},
      offline : function(){},
      error : function(){},
      unauthorized : function(){}
    },
    events : {
      connect : function(event) {
        event.preventDefault();
        console.log('connect button clicked')
        this._emit('connect', gTl(this.widget, 'form').userAddress.value);
      }
    }
  }
 

  // // the view.
  // var view = defaultView;
  // // options passed to displayWidget
  // var widgetOptions = {};
  // // passed to display() to avoid circular deps
  // var remoteStorage;

  // var reconnectInterval = 1000;

  // var offlineTimer = null;

  // var viewState;

  // function calcReconnectInterval() {
  //   var i = reconnectInterval;
  //   if(reconnectInterval < 10000) {
  //     reconnectInterval *= 2;
  //   }
  //   return i;
  // }

  // var stateActions = {
  //   offline: function() {
  //     if(! offlineTimer) {
  //       offlineTimer = setTimeout(function() {
  //         offlineTimer = null;
  //         sync.fullSync().
  //           then(function() {
  //             schedule.enable();
  //           });
  //       }, calcReconnectInterval());
  //     }
  //   },
  //   connected: function() {
  //     if(offlineTimer) {
  //       clearTimeout(offlineTimer);
  //       offlineTimer = null;
  //     }
  //   }
  // };
  

  // function setState(state) {
  //   if(state === viewState) {
  //     return;
  //   }
  //   viewState = state;
  //   var action = stateActions[state];
  //   if(action) {
  //     action.apply(null, arguments);
  //   }
  //   view.setState.apply(view, arguments);
  //   events.emit('state', state);    
  // }

  // function requestToken(authEndpoint) {
  //   logger.info('requestToken', authEndpoint);
  //   var redirectUri = (widgetOptions.redirectUri || view.getLocation());
  //   var state;
  //   var md = redirectUri.match(/^(.+)#(.*)$/);
  //   if(md) {
  //     redirectUri = md[1];
  //     state = md[2];
  //   }
  //   var clientId = util.hostNameFromUri(redirectUri);
  //   authEndpoint += authEndpoint.indexOf('?') > 0 ? '&' : '?';
  //   var params = [
  //     ['redirect_uri', redirectUri],
  //     ['client_id', clientId],
  //     ['scope', remoteStorage.access.scopeParameter],
  //     ['response_type', 'token']
  //   ];
  //   if(typeof(state) === 'string' && state.length > 0) {
  //     params.push(['state', state]);
  //   }
  //   authEndpoint += params.map(function(kv) {
  //     return kv[0] + '=' + encodeURIComponent(kv[1]);
  //   }).join('&');
  //   console.log('redirecting to', authEndpoint);
  //   return view.redirectTo(authEndpoint);
  // }

  // function connectStorage(userAddress) {
  //   settings.set('userAddress', userAddress);
  //   setState('authing');
  //   return webfinger.getStorageInfo(userAddress).
  //     then(remoteStorage.setStorageInfo, function(error) {
  //       if(error === 'timeout') {
  //         adjustTimeout();
  //       }
  //       setState((typeof(error) === 'string') ? 'typing' : 'error', error);
  //     }).
  //     then(function(storageInfo) {
  //       if(storageInfo) {
  //         requestToken(storageInfo.properties['auth-endpoint']);
  //         schedule.enable();
  //       }
  //     }, util.curry(setState, 'error'));
  // }

  // function reconnectStorage() {
  //   connectStorage(settings.get('userAddress'));
  // }

  // function disconnectStorage() {
  //   schedule.disable();
  //   remoteStorage.flushLocal();
  //   events.emit('state', 'disconnected');
  //   events.emit('disconnect');
  // }

  // // destructively parse query string from URI fragment
  // function parseParams() {
  //   var md = view.getLocation().match(/^(.*?)#(.*)$/);
  //   var result = {};
  //   if(md) {
  //     var hash = md[2];
  //     hash.split('&').forEach(function(param) {
  //       var kv = param.split('=');
  //       if(kv[1]) {
  //         result[kv[0]] = decodeURIComponent(kv[1]);
  //       }
  //     });
  //     if(Object.keys(result).length > 0) {
  //       view.setLocation(md[1] + '#');
  //     }
  //   }
  //   return result; 
  // }

  // function processParams() {
  //   var params = parseParams();

  //   // Query parameter: access_token
  //   if(params.access_token) {
  //     wireClient.setBearerToken(params.access_token);
  //   }
  //   // Query parameter: remotestorage
  //   if(params.remotestorage) {
  //     view.setUserAddress(params.remotestorage);
  //     setTimeout(function() {
  //       if(wireClient.getState() !== 'connected') {
  //         connectStorage(params.remotestorage);
  //       }
  //     }, 0);
  //   } else {
  //     var userAddress = settings.get('userAddress');
  //     if(userAddress) {
  //       view.setUserAddress(userAddress);
  //     }
  //   }
  //   // Query parameter: state
  //   if(params.state) {
  //     view.setLocation(view.getLocation().split('#')[0] + '#' + params.state);
  //   }
  // }

  // function handleSyncError(error) {
  //   if(error.message === 'unauthorized') {
  //     setState('unauthorized');
  //   } else if(error.message === 'network error') {
  //     setState('offline', error);
  //   } else {
  //     setState('error', error);
  //   }
  // }

  // function adjustTimeout() {
  //   var t = getputdelete.getTimeout();
  //   if(t < maxTimeout) {
  //     t *= timeoutAdjustmentFactor;
  //     webfinger.setTimeout(t);
  //     getputdelete.setTimeout(t);
  //   }
  // }

  // function handleSyncTimeout() {
  //   adjustTimeout();
  //   schedule.disable();
  //   setState('offline');
  // }

  // function initialSync() {
  //   if(settings.get('initialSyncDone')) {
  //     schedule.enable();
  //     store.fireInitialEvents().then(util.curry(events.emit, 'ready'));
  //   } else {
  //     setState('busy', true);
  //     sync.fullSync().then(function() {
  //       schedule.enable();
  //       settings.set('initialSyncDone', true);
  //       setState('connected');
  //       events.emit('ready');
  //     }, handleSyncError);
  //   }
  // }

  // function display(_remoteStorage, element, options) {
  //   remoteStorage = _remoteStorage;
  //   widgetOptions = options;
  //   if(! options) {
  //     options = {};
  //   }

  //   options.getLastSyncAt = function() {
  //     return (sync.lastSyncAt || new Date()).getTime();
  //   };

  //   schedule.watch('/', 30000);

  //   view.display(element, options);

  //   view.on('sync', sync.forceSync);
  //   view.on('connect', connectStorage);
  //   view.on('disconnect', disconnectStorage);
  //   view.on('reconnect', reconnectStorage);

  //   wireClient.on('busy', util.curry(setState, 'busy'));
  //   wireClient.on('unbusy', util.curry(setState, 'connected'));
  //   wireClient.on('connected', function() {
  //     setState('connected');
  //     initialSync();
  //   });
  //   wireClient.on('disconnected', util.curry(setState, 'initial'));

  //   BaseClient.on('error', util.curry(setState, 'error'));
  //   sync.on('error', handleSyncError);
  //   sync.on('timeout', handleSyncTimeout);

  //   processParams();

  //   wireClient.calcState();
  // }

  // RemoteStorage.widget = util.extend({
  //   display : display,

  //   clearSettings: settings.clear,

  //   setView: function(_view) {
  //     view = _view;
  //   }
  // }, events);

})();
