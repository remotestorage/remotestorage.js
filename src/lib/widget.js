define(['./assets', './webfinger', './hardcoded', './wireClient', './sync', './store', './platform', './util'], function (assets, webfinger, hardcoded, wireClient, sync, store, platform, util) {

  // Namespace: widget
  //
  // The remotestorage widget.
  //
  // See <remoteStorage.displayWidget>
  //
  //
  // Event: state
  //
  // Fired when the widget state changes.
  // See <remoteStorage.getWidgetState> for available states.

  "use strict";

  var locale='en',
    connectElement,
    widgetState,
    userAddress,
    authDialogStrategy = 'redirect',
    authPopupRef,
    initialSync,
    scopesObj = {};

  var widget;
  var offlineReason;

  var events = util.getEventEmitter('state', 'ready');

  var popupSettings = 'resizable,toolbar=yes,location=yes,scrollbars=yes,menubar=yes,width=820,height=800,top=0,left=0';

  var logger = util.getLogger('widget');
  function translate(text) {
    return text;
  }

  function calcWidgetState() {
    var wireClientState = wireClient.getState();
    if(wireClientState == 'connected') {
      return sync.getState();// 'connected', 'busy'
    }
    return wireClientState;//'connected', 'authing', 'anonymous'
  }

  function setWidgetStateOnLoad() {
    setWidgetState(calcWidgetState());
  }

  function setWidgetState(state, updateView) {
    widgetState = state;
    if(updateView !== false) {
      displayWidgetState(state, userAddress);
    }
    events.emit('state', state);
  }

  function getWidgetState() {
    return widgetState;
  }

  function buildWidget() {

    function el(tag, id, attrs) {
      var e = document.createElement(tag);
      if(id) {
        e.setAttribute('id', id);
      }
      if(attrs && attrs._content) {
        e.innerHTML = attrs._content;
        delete attrs._content;
      }
      for(var key in attrs) {
        e.setAttribute(key, attrs[key]);
      }
      return e;
    }

    var widget = {
      root: el('div', 'remotestorage-state'),
      connectButton: el('input', 'remotestorage-connect-button', {
        'class': 'remotestorage-button',
        'type': 'submit',
        'value': translate('connect')
      }),
      registerButton: el('span', 'remotestorage-register-button', {
        'class': 'remotestorage-button',
        '_content': translate('get remotestorage')
      }),
      cube: el('img', 'remotestorage-cube', {
        'src': assets.remoteStorageCube
      }),
      bubble: el('span', 'remotestorage-bubble'),
      helpHint: el('a', 'remotestorage-questionmark', {
        'href': 'http://unhosted.org/#remotestorage',
        'target': '_blank'
      }),
      helpText: el('span', 'remotestorage-infotext', {
        'class': 'infotext',
        '_content': 'This app allows you to use your own data storage!<br/>Click for more info on the Unhosted movement.'
      }),
      userAddress: el('input', 'remotestorage-useraddress', {
        'placeholder': 'user@host'
      }),

      style: el('style')
    };

    widget.root.appendChild(widget.connectButton);
    widget.root.appendChild(widget.registerButton);
    widget.root.appendChild(widget.cube);
    widget.root.appendChild(widget.bubble);
    widget.root.appendChild(widget.helpHint);
    widget.root.appendChild(widget.helpText);
    widget.root.appendChild(widget.userAddress);

    widget.style.innerHTML = assets.widgetCss;

    return widget;
  }

  function displayWidgetState(state, userAddress) {
    if(state === 'authing') {
      platform.alert("Authentication was aborted. Please try again.");
      return setWidgetState('typing')
    }

    if(! widget) {
      var root = document.getElementById(connectElement);
      widget = buildWidget();

      widget.registerButton.addEventListener('click', handleRegisterButtonClick);
      widget.connectButton.addEventListener('click', handleConnectButtonClick);
      widget.bubble.addEventListener('click', handleBubbleClick);
      widget.cube.addEventListener('click', handleCubeClick);
      widget.userAddress.addEventListener('keyup', handleWidgetTypeUserAddress);

      root.appendChild(widget.style);
      root.appendChild(widget.root);
    }

    widget.root.setAttribute('class', state);


    var userAddress = localStorage['remote_storage_widget_useraddress'] || '';

    if(userAddress) {
      widget.userAddress.value = userAddress;
      userAddress = '<strong>' + userAddress + '</strong>';
    } else {
      userAddress = '<strong>(n/a)</strong>';
    }

    var bubbleText = '';
    var bubbleVisible = false;
    if(initialSync) {
      bubbleText = 'Connecting ' + userAddress;
      bubbleVisible = true
    } else if(state == 'connected') {
      bubbleText = 'Disconnect ' + userAddress;
    } else if(state == 'busy') {
      bubbleText = 'Synchronizing ' + userAddress + '...';
    } else if(state == 'offline') {
      if(offlineReason == 'unauthorized') {
        bubbleText = 'Access denied by remotestorage. Click to reconnect.';
        bubbleVisible = true;
      } else {
        bubbleText = 'Offline (' + userAddress + ')';
      }
    }
    
    widget.bubble.innerHTML = bubbleText;

    if(bubbleVisible) {
      // always show cube & bubble while connecting or error
      widget.cube.setAttribute('style', 'opacity:1');
      widget.bubble.setAttribute('style', 'display:inline');
    } else {
      widget.cube.removeAttribute('style');
      widget.bubble.removeAttribute('style');
    }

    if(state === 'typing') {
      widget.userAddress.focus();
    }
  }

  function handleRegisterButtonClick() {
    window.open(
      'http://unhosted.org/en/a/register.html',
      'Get your remote storage',
      popupSettings
    );
  }

  function redirectUriToClientId(loc) {
    //TODO: add some serious unit testing to this function
    if(loc.substring(0, 'http://'.length) == 'http://') {
      loc = loc.substring('http://'.length);
    } else if(loc.substring(0, 'https://'.length) == 'https://') {
      loc = loc.substring('https://'.length);
    } else {
      return loc;//for all other schemes
    }
    var hostParts = loc.split('/')[0].split('@');
    if(hostParts.length > 2) {
      return loc;//don't know how to simplify URLs with more than 1 @ before the third slash
    }
    if(hostParts.length == 2) {
      hostParts.shift();
    }
    return hostParts[0];
  }

  //
  // //Section: Auth popup
  //
  //
  // when remoteStorage.displayWidget is called with the authDialog option set to 'popup',
  // the following happens:
  //   * When clicking "connect", a window is opened and saved as authPopupRef (prepareAuthPopup)
  //   * Once webfinger discovery is done, authPopupRef's location is set to the auth URL (setPopupLocation)
  //   * In case webfinger discovery fails, the popup is closed (closeAuthPopup)
  //   * As soon as the auth dialog redirects back with an access_token, the child popup calls
  //     "remotestorageTokenReceived" on the opening window and closes itself.
  //   * remotestorageTokenReceived recalculates the widget state -> we're connected!
  // 

  function prepareAuthPopup() { // in parent window
    authPopupRef = window.open(
      document.location,
      'remotestorageAuthPopup',
      popupSettings + ',dependent=yes'
    );
    window.remotestorageTokenReceived = function() {
      delete window.remotestorageTokenReceived;
      setWidgetStateOnLoad();
    };
  }

  function closeAuthPopup() { // in parent window
    authPopupRef.close();
  }

  function setAuthPopupLocation(location) { // in parent window
    authPopupRef.document.location = location;
  }

  function finalizeAuthPopup() { // in child window
    if(! frames.opener) {
      // not in child window (probably due to storage-first)
      return;
    }
    frames.opener.remotestorageTokenReceived();
    window.close();
  }

  function dance() {
    var endpoint = localStorage['remote_storage_widget_auth_endpoint'];
    var endPointParts = endpoint.split('?');
    var queryParams = [];
    if(endPointParts.length == 2) {
      queryParams=endPointParts[1].split('&');
    } else if(endPointParts.length>2) {
      errorHandler('more than one questionmark in auth-endpoint - ignoring');
    }
    var loc = platform.getLocation();
    var scopesArr = [];
    for(var i in scopesObj) {
      scopesArr.push(i+':'+scopesObj[i]);
    }
    queryParams.push('response_type=token');
    queryParams.push('scope='+encodeURIComponent(scopesArr.join(' ')));
    queryParams.push('redirect_uri='+encodeURIComponent(loc));
    queryParams.push('client_id='+encodeURIComponent(redirectUriToClientId(loc)));

    var authLocation = endPointParts[0]+'?'+queryParams.join('&');

    if(typeof(authDialogStrategy) == 'function') {
      authDialogStrategy(authLocation);
    } else {
      switch(authDialogStrategy) {
      case 'redirect':
        platform.setLocation(authLocation);
        break;
      case 'popup':
        setAuthPopupLocation(authLocation);
        break;
      default:
        throw "Invalid strategy for auth dialog: " + authDialogStrategy;
      }
    }
  }

  function discoverStorageInfo(userAddress, cb) {
    webfinger.getStorageInfo(userAddress, {timeout: 5000}, function(err, data) {
      if(err) {
        hardcoded.guessStorageInfo(userAddress, {timeout: 5000}, function(err2, data2) {
          if(err2) {
            logger.debug("Error from fakefinger: " + err2);
            cb(err);
          } else {
            if(data2.type && data2.href && data.properties && data.properties['auth-endpoint']) {
              wireClient.setStorageInfo(data2.type, data2.href);
              cb(null, data2.properties['auth-endpoint']);
            } else {
              cb('cannot make sense of storageInfo from webfinger');
            }
          }
        });
      } else {
        if(data.type && data.href && data.properties && data.properties['auth-endpoint']) {
          wireClient.setStorageInfo(data.type, data.href);
          cb(null, data.properties['auth-endpoint']);
        } else {
          cb('cannot make sense of storageInfo from hardcoded');
        }
      }
    });
  }

  var maxRetryCount = 2;

  function tryWebfinger(userAddress, retryCount) {
    if(typeof(retryCount) == 'undefined') {
      retryCount = 0;
    }
    discoverStorageInfo(userAddress, function(err, auth) {
      if(err) {
        if(err == 'timeout' && retryCount != maxRetryCount) {
          tryWebfinger(userAddress, retryCount + 1);
        } else {
          platform.alert('webfinger discovery failed! Please check if your user address is correct and try again. If the problem persists, contact your storage provider for support. (Error is: ' + err + ')');
        }
        if(authDialogStrategy == 'popup') {
          closeAuthPopup();
        }
        setWidgetState('failed');
      } else {
        localStorage['remote_storage_widget_auth_endpoint'] = auth;
        dance();
      }
    });
  }

  function handleConnectButtonClick() {
    if(widgetState == 'typing') {
      userAddress = widget.userAddress.value;
      localStorage['remote_storage_widget_useraddress'] = userAddress;
      setWidgetState('connecting');
      if(authDialogStrategy == 'popup') {
        prepareAuthPopup();
      }
      tryWebfinger(userAddress);
    } else {
      setWidgetState('typing');
    }
  }

  function handleBubbleClick() {
    if(widgetState == 'connected' || widgetState == 'busy') {
      // DISCONNECT
      sync.fullPush(function() {
        wireClient.disconnectRemote();
        store.forgetAll();
        sync.clearSettings();
        // trigger 'disconnected' once, so the app can clear it's views.
        setWidgetState('disconnected', true);
        setWidgetState('anonymous');
      });
    } else if(widgetState == 'offline' && offlineReason == 'unauthorized') {
      dance();
    }
  }
  function handleCubeClick() {
    if(widgetState == 'connected' || widgetState == 'connected') {
      handleBubbleClick();
    }
  }
  function handleWidgetTypeUserAddress(event) {
    if(event.keyCode === 13) {
      widget.connectButton.click();
    }
  }
  function handleWidgetHover() {
    logger.debug('handleWidgetHover');
  }

  function nowConnected() {
    console.log("NOW CONNECTED");
    setWidgetState('connected');
    initialSync = true;
    store.fireInitialEvents();
    sync.forceSync(function() {
      logger.info("Initial sync done.");
      initialSync = false;
      setWidgetState(getWidgetState());
      events.emit('ready');
    });
  }

  function display(setConnectElement, options) {
    var tokenHarvested = platform.harvestParam('access_token');
    var storageRootHarvested = platform.harvestParam('storage_root');
    var storageApiHarvested = platform.harvestParam('storage_api');
    var authorizeEndpointHarvested = platform.harvestParam('authorize_endpoint');
    if(! options) {
      options = {};
    }

    sync.on('error', function(error) {
      if(error.message == 'unauthorized') {
        offlineReason = 'unauthorized';
        if(initialSync) {
          // abort initial sync
          initialSync = false;
          events.emit('ready');
        }
        setWidgetState('offline');
      }
    });

    connectElement = setConnectElement;

    if(wireClient.calcState() == 'connected') {
      nowConnected();
    } else {
      wireClient.on('connected', nowConnected);
    }

    wireClient.on('error', function(err) {
      platform.alert(translate(err));
    });

    sync.on('state', setWidgetState);

    if(typeof(options.authDialog) !== 'undefined') {
      authDialogStrategy = options.authDialog;
    }

    locale = options.locale;

    if(tokenHarvested) {
      wireClient.setBearerToken(tokenHarvested);

      if(authDialogStrategy === 'popup') {
        finalizeAuthPopup();
      }
    }
    if(storageRootHarvested) {
      wireClient.setStorageInfo((storageApiHarvested ? storageApiHarvested : '2012.04'), storageRootHarvested);
    }
    if(authorizeEndpointHarvested) {
      localStorage['remote_storage_widget_auth_endpoint'] = authorizeEndpointHarvested;
      dance();
    }

    setWidgetStateOnLoad();

    if(options.syncShortcut !== false) {
      window.addEventListener('keydown', function(evt) {
        if(evt.ctrlKey && evt.which == 83) {
          evt.preventDefault();
          sync.fullSync();
          return false;
        }
      });
    }

    window.addEventListener('beforeunload', function(event) {
      if(widgetState != 'anonymous' && sync.needsSync()) {
        sync.fullPush();
        var message = "Synchronizing your data now. Please wait until the cube stops spinning."
        event.returnValue = message
        return message;
      }
    });
    
  }

  function addScope(module, mode) {
    if(!scopesObj[module] || mode == 'rw') {
      scopesObj[module] = mode;
    }
  }
  
  return {
    display : display,
    addScope: addScope,
    getState: getWidgetState,
    on: events.on
  };
});
