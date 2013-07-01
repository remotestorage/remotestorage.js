(function() {
    
    
    
  RemoteStorage.Widget = function() {
    this.view = new View;
  };

  RemoteStorage.Widget.prototype = {
    display: function() {
      this.view.display.apply(this.view, arguments);
      return this;
    }
  };

  
  RemoteStorage.Widget._rs_init = function(){
    RemoteStorage.prototype.displayWidget = function() {
      this.widget = new RemoteStorage.Widget().display();
    };
    // MAYBE execute display widget on new RemeoteStorage
    return promising().fulfill();
  }



  // var settings = util.getSettingStore('remotestorage_widget');
  // var events = util.getEventEmitter('ready', 'disconnect', 'state');
  // var logger = util.getLogger('widget');

  // var maxTimeout = 45000;
  // var timeoutAdjustmentFactor = 1.5;
  function cEl(t){
    return document.createElement(t);
  }
  function View(){
  /*

    Interface: WidgetView

      A stateful view providing interaction with remoteStorage.

    States:
      initial      - not connected
      authing      - in auth flow
      connected    - connected to remote storage, not syncing at the moment
      busy         - connected, syncing at the moment
      offline      - connected, but no network connectivity
      error        - connected, but sync error happened
      unauthorized - connected, but request returned 401


    Event: connect
      Fired when the "connect" action is caused by the user.
    
    Parameters:
      userAddress - The user address to connect to


    Event: disconnect
      Fired when "disconnect" action is requested.


    Event: sync
      Fired when "sync" action is requested


    Event: reconnect
      Fired when reconnect is requested in 'unauthorized' state.


    Method: display
      Display the widget in "initial" state
    
    Parameters:
      domId   - String, id attribute of element to place the widget in (FIXME: put this in the options)
      options - Object, see below.

    Options:
      locale - locale to use. only present when provided by app.


    Method: setState
      Set widget state to given value.

    Parameters:
      state - a string. one of the states listed above.

    Method: redirectTo
      Navigate to given url.

    Parameters:
      url - a string representing https URL to redirect to.

   */

  var gEl = util.bind(document.getElementById, document);
  var cEl = util.bind(document.createElement, document);

  var t = util.curry(i18n.t, 'widget');

  var events = util.getEventEmitter('connect', 'disconnect', 'sync', 'reconnect');

  var browserEvents = [];

  var widgetOptions = {};

  function escape(s) {
    return s.replace(/>/, '&gt;').replace(/</, '&lt;');
  }

  function addEvent(element, eventName, handler) {
    browserEvents.push([element, eventName, handler]);
    element.addEventListener(eventName, handler);
  }

  function clearEvents() {
    browserEvents.forEach(function(event) {
      event[0].removeEventListener(event[1], event[2]);
    });
    browserEvents = [];
  }

  function bubbleHiddenToggler() {
    var visible = false;

    function handleBodyClick(event) {
      toggleBubbleVisibility(event);
      if(event.target !== document.body) {
        event.target.click();
      }
      return false;
    }

    function toggleBubbleVisibility(event) {
      if(event.preventDefault) {
        event.preventDefault();
      }
      if(event.stopPropagation) {
        event.stopPropagation();
      }
      event.cancelBubble = true;
      event.returnValue = false;
      if(visible) {
        addClass(elements.bubble, 'hidden');
        document.body.removeEventListener('click', handleBodyClick);
        document.body.removeEventListener('touchstart', handleBodyClick);
      } else {
        removeClass(elements.bubble, 'hidden'); 
        document.body.addEventListener('click', handleBodyClick);
        document.body.addEventListener('touchstart', handleBodyClick);
      }
      visible = !visible;
      return false;
    }

    return toggleBubbleVisibility;
  }

  var userAddress = '';

  var currentState = 'initial';

  var elements = {};

  var cubeStateIcons = {
    connected: assets.remoteStorageIcon,
    error: assets.remoteStorageIconError,
    offline: assets.remoteStorageIconOffline
  };

  // used to keep track of connection error in "typing" state
  var lastConnectionError, lastFailedAddress;

  var stateViews = {

    initial: function() {
      if(! lastConnectionError) {
        userAddress = '';
      }

      addClass(elements.bubble, 'one-line');

      setBubbleText(t('connect-remotestorage'));
      setBubbleAction(jumpAction('typing'));

      setCubeState('connected');
      setCubeAction(jumpAction('typing'));
    },

    typing: function(connectionError) {
      if(lastConnectionError && lastFailedAddress === userAddress) {
        connectionError = lastConnectionError;
      } else {
        lastConnectionError = connectionError;
        lastFailedAddress = userAddress;
      }
      elements.connectForm.userAddress.setAttribute('value', userAddress);
      setBubbleText(t('connect-remotestorage'));
      elements.bubble.appendChild(elements.connectForm);
      addEvent(elements.connectForm, 'submit', function(event) {
        event.preventDefault();
        userAddress = elements.connectForm.userAddress.value;
        if(userAddress.length > 0) {
          events.emit('connect', userAddress);
        }
      });
      var adjustButton = function() {
        if(elements.connectForm.userAddress.value.length > 0) {
          elements.connectForm.connect.removeAttribute('disabled');
        } else {
          elements.connectForm.connect.setAttribute('disabled', 'disabled');
        }
      };
      elements.connectForm.userAddress.addEventListener('keyup', adjustButton);
	    adjustButton();

      if(connectionError) {
        // error bubbled from webfinger
        setCubeState('error');
        addClass(
          addBubbleHint(t('webfinger-failed', { message: t('webfinger-error-' + connectionError) })),
          'error'
        );
      } else {
        setCubeState('connected');
        addBubbleHint(t('typing-hint'));
      }

      function hideBubble(evt) {
        var e = evt.target;
        while(e) {
          if(e === elements.widget) {
            return true;
          }
          e = e.parentElement;
        }
        evt.preventDefault();
        evt.stopPropagation();
        setState('initial');
        document.body.removeEventListener('click', hideBubble);
        document.body.removeEventListener('touchstart', hideBubble);
        return false;
      }

      setCubeAction(hideBubble);
      document.body.addEventListener('click', hideBubble);
      document.body.addEventListener('touchstart', hideBubble);

      elements.connectForm.userAddress.focus();
    },

    authing: function() {
      setBubbleText(t('connecting', { userAddress: userAddress }));
      addClass(elements.bubble, 'one-line');
      setCubeState('connected');
      addClass(elements.cube, 'remotestorage-loading');
    },

    connected: function() {
      if(widgetOptions.syncShortcut !== false) {
        addEvent(window, 'keydown', function(evt) {
          if(evt.ctrlKey && evt.which == 83) {
            evt.preventDefault();
            events.emit('sync');
            return false;
          }
        });
      }
      addClass(elements.bubble, 'hidden');

      setCubeState('connected');

      setBubbleText('<strong class="userAddress">' + userAddress + '</strong>');

      var content = cEl('div');
      addClass(content, 'content');

      var hint = cEl('div');
      addClass(hint, 'info last-synced-message');

      function updateLastSynced() {
        hint.innerHTML = t('last-synced', { t: i18n.helpers.timeAgo(
          new Date().getTime() - widgetOptions.getLastSyncAt()
        ) });
      }
      addEvent(elements.bubble, 'mouseover', updateLastSynced);

      updateLastSynced();

      content.appendChild(elements.syncButton);
      content.appendChild(hint);
      content.appendChild(elements.disconnectButton);
      addEvent(elements.syncButton, 'click', function() {
        // emulate "busy" state for a second (i.e. one animation cycle) to
        // give the user feedback that sync is happening, even though the
        // cube wouldn't be animated until there are PUT / DELETE requests
        setState('busy')
        // actual sync is delayed until after the animation cycle, so there
        // are no 'busy' / 'connected' race conditions.
        setTimeout(function() {
          setState('connected');
          events.emit('sync');
        }, 1000);
      });
      addEvent(elements.disconnectButton, 'click', disconnectAction);

      elements.bubble.appendChild(content);

      setCubeAction(bubbleHiddenToggler());
    },

    busy: function(initialSync) {
      setCubeState('connected');
      addClass(elements.cube, 'remotestorage-loading');
      addClass(elements.bubble, 'one-line');
      if(initialSync) {
        setBubbleText(t('connecting', { userAddress: userAddress }));
      } else {
        addClass(elements.bubble, 'hidden');
        setBubbleText(t('synchronizing', { userAddress: userAddress }));
        setCubeAction(bubbleHiddenToggler());
      }
    },

    error: function(error) {
      setCubeState('error');
      setBubbleText(t('error'));
      var trace = cEl('pre');
      elements.bubble.appendChild(trace);
      if(error instanceof Error) {
        trace.innerHTML = '<strong>' + escape(error.message) + '</strong>' +
          "\n" + escape(error.stack);
      } else if(typeof(error) === 'object') {
        trace.innerHTML = JSON.stringify(error, null, 2);
      } else {
        trace.innerHTML = error;
      }
      var errorInfo = document.createElement('p');
      errorInfo.setAttribute('class', 'remotestorage-error-info');
      errorInfo.innerHTML = t('error-info');
      var resetButton = document.createElement('button');
      resetButton.setAttribute('class', 'remotestorage-reset');
      resetButton.innerHTML = t('reset');
      resetButton.addEventListener('click', function() {
        if(confirm(t('reset-confirmation-message'))) {
          // FIXME: don't clear localStorage here, but instead fire some event.
          localStorage.clear();
          document.location = String(document.location).split('#')[0];
        }
      });
      elements.bubble.appendChild(errorInfo);
      elements.bubble.appendChild(resetButton);
    },

    offline: function(error) {
      setCubeState('offline');
      addClass(elements.bubble, 'one-line hidden');
      setCubeAction(bubbleHiddenToggler());
      setBubbleText(t('offline', { userAddress: userAddress }));
    },

    unauthorized: function() {
      setCubeState('error');
      setBubbleText('<strong>' + userAddress + '</strong><br>' + t('unauthorized') + '<br>');
      setCubeAction(util.curry(events.emit, 'reconnect'));
      setBubbleAction(util.curry(events.emit, 'reconnect'));
      elements.bubble.appendChild(elements.disconnectButton);
      addEvent(elements.disconnectButton, 'click', disconnectAction);
    }

  };

  function disconnectAction(event) {
    event.preventDefault();
    events.emit('disconnect');
    if(currentState === 'error') {
      setState('initial');
    }
    return false;
  }

  function getClassNameMap(element) {
    var classNames = (element.getAttribute('class') || '').split(/\s+/);
    var nameMap = {};
    classNames.forEach(function(name) {
      nameMap[name] = true;
    });    
    return nameMap;
  }

  function setClassNameMap(element, nameMap) {
    element.setAttribute('class', Object.keys(nameMap).join(' '));
  }

  function addClass(element, className) {
    var nameMap = getClassNameMap(element);
    nameMap[className] = true;
    setClassNameMap(element, nameMap);
  }

  function removeClass(element, className) {
    var nameMap = getClassNameMap(element);
    delete nameMap[className];
    setClassNameMap(element, nameMap);
  }

  function resetElementState() {
    elements.cube.setAttribute('class', 'cube');
    elements.bubble.setAttribute('class', 'bubble');
    elements.connectForm.userAddress.setAttribute('value', '');

    elements.connectForm.userAddress.removeAttribute('disabled');
    elements.connectForm.connect.removeAttribute('disabled');

    elements.connectForm.connect.setAttribute('title', t('connect'));
    elements.syncButton.setAttribute('title', t('sync'));
    elements.disconnectButton.setAttribute('title', t('disconnect'));
  }
  
  function prepareWidget() {
    elements.style = cEl('style');
    elements.style.innerHTML = assets.widgetCss;
    // #remotestorage-widget
    elements.widget = cEl('div');
    elements.widget.setAttribute('id', 'remotestorage-widget');
    elements.widget.setAttribute('class', 'remotestorage-state-initial');
    // .cube
    elements.cube = cEl('img');
    // .bubble
    elements.bubble = cEl('div');

    elements.widget.appendChild(elements.bubble);
    elements.widget.appendChild(elements.cube);

    // form.connect
    elements.connectForm = cEl('form');
    elements.connectForm.setAttribute('novalidate', '');
    elements.connectForm.innerHTML = [
      '<input type="email" placeholder="user@provider.com" name="userAddress" novalidate>',
      '<button class="connect" value="" name="connect">'
    ].join('');
    var connectIcon = cEl('img');
    connectIcon.setAttribute('src', assets.connectIcon);
    elements.connectForm.connect.appendChild(connectIcon);
    // button.sync
    elements.syncButton = cEl('button');
    elements.syncButton.setAttribute('class', 'sync');
    var syncIcon = cEl('img');
    syncIcon.setAttribute('src', assets.syncIcon);
    elements.syncButton.appendChild(syncIcon);
    // button.disconnect
    elements.disconnectButton = cEl('button');
    elements.disconnectButton.setAttribute('class', 'disconnect');
    var disconnectIcon = cEl('img');
    disconnectIcon.setAttribute('src', assets.disconnectIcon);
    elements.disconnectButton.appendChild(disconnectIcon);

    resetElementState();
  }

  function clearWidget() {
    Array.prototype.forEach.call(elements.bubble.children, function(child) {
      elements.bubble.removeChild(child);
    });
    clearEvents();
    resetElementState();
  }

  function updateWidget() {
    var stateView = stateViews[currentState];
    if(stateView) {
      clearWidget();
      stateView.apply(this, arguments);
    }
  }

  function addBubbleHint(text) {
    var hint = cEl('div');
    addClass(hint, 'info');
    hint.innerHTML = text;
    elements.bubble.appendChild(hint);
    return hint;
  }

  function setBubbleText(text) {
    elements.bubble.innerHTML = '<div class="bubble-text">' + text + '</div>';
  }

  function setBubbleAction(action) {
    addClass(elements.bubble, 'action');
    addEvent(elements.bubble, 'click', action);
  }

  function setCubeAction(action) {
    addClass(elements.cube, 'action');
    addEvent(elements.cube, 'click', action);
  }

  function setCubeState(state) {
    var icon = cubeStateIcons[state];
    if(! icon) {
      throw "Unknown cube state: " + state;
    }
    elements.cube.setAttribute('src', icon);
  }

  function jumpAction(state) {
    return function(event) {
      if(event) {
        event.preventDefault();
      }
      setState(state);
      return false;
    };
  }

  // PUBLIC

  function display(element, options) {
    if(! options) {
      options = {};
    }
    widgetOptions = options;

    i18n.setLocale('en');

    if(! element) {
      element = document.body;
    } else if(typeof(element) === 'string') {
      element = gEl(element);
    }

    prepareWidget();
    element.appendChild(elements.style);
    element.appendChild(elements.widget);
    updateWidget();
  }

  function setState(state) {
    var args = Array.prototype.slice.call(arguments, 1);
    currentState = state;
    elements.widget.setAttribute('class', 'remotestorage-state-' + state);
    util.nextTick(function() {
      updateWidget.apply(undefined, args);
    });
  }

  function redirectTo(url) {
    setBubbleText(t('redirecting', { hostName: util.hostNameFromUri(url) }));
    addClass(elements.bubble, 'one-line');
    setTimeout(function() {
      document.location = url;
    }, 500);
  }

  function setUserAddress(addr) {
    userAddress = addr;
    elements.connectForm.userAddress.setAttribute('value', addr);
  }

  function getLocation() {
    return document.location.href;
  }

  function setLocation(url) {
    document.location = url;
  }

  return util.extend({

    display: display,
    setState: setState,
    redirectTo: redirectTo,
    setUserAddress: setUserAddress,
    getLocation: getLocation,
    setLocation: setLocation

  }, events);

});

  // };
  // View.prototype = {
  //    // States:
  //    //  initial      - not connected
  //    //  authing      - in auth flow
  //    //  connected    - connected to remote storage, not syncing at the moment
  //    //  busy         - connected, syncing at the moment
  //    //  offline      - connected, but no network connectivity
  //    //  error        - connected, but sync error happened
  //    //  unauthorized - connected, but request returned 401
  //   states : ['initial'
  // 	      , 'authing'
  // 	      , 'connected'
  // 	      , 'busy'
  // 	      , 'offline'
  // 	      , 'error'
  // 	      , 'unauthorized'],
  //   widget : undefined,
  //   state :  0,
  //   display : function(){
  //      //TODO this is just a placeholder
  //     var element = cEl('div')
  //     var state = cEl('p');
  //     state.innerHTML = this.states[this.state];
  //     state.className = 'state' 
  //     element.innerHTML = "widget";
  //     element.appendChild(state);
  //     element.style.position = "fixed";
  //     element.style.top = "0px";
  //     element.style.right = "0px";
  //     element.style.border = "solid"
  //     document.body.appendChild(element);
  //     this.widget = element;
  //    },

  //   setState : function(state){
  //     var s;
  //     if((s = this.states.indexOf(state)) < 0){
  // 	throw "Bad State assigned to view"
  //     }
  //     this.state = s;
  //     this.updateWidget();
  //   },
  //   updateWidget : function(){
  //     this.widget.getElementsByClassName('state')[0].innerHTML = this.states[this.state];
  //   }
  // }

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
