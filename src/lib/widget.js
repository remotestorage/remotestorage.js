define(['./assets', './webfinger', './hardcoded', './wireClient', './sync', './store', './platform', './util', './schedule', './mailcheck', './levenshtein'], function (assets, webfinger, hardcoded, wireClient, sync, store, platform, util, schedule, mailcheck, levenshtein) {

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

  var locale='en';
  var connectElement;
  var widgetState;
  var userAddress;
  var authDialogStrategy = 'redirect';
  var authPopupRef;
  var initialSync;
  var scopesObj = {};
  var timeoutCount = 0;

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
    if(state == 'offline') {
      schedule.disable();
    }
    events.emit('state', state);
  }

  function getWidgetState() {
    return widgetState || 'anonymous';
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
        'src': assets.remotestorageIcon
      }),
      bubble: el('span', 'remotestorage-bubble'),
      helpHint: el('a', 'remotestorage-questionmark', {
        'href': 'http://remotestorage.io',
        'target': '_blank',
        '_content': '?'
      }),
      helpText: el('span', 'remotestorage-infotext', {
        'class': 'infotext',
        '_content': 'This app allows you to use your own data storage!<br/>Click for more info on remotestorage.'
      }),
      userAddress: el('input', 'remotestorage-useraddress', {
        'placeholder': 'user@host',
        'type': 'email'
      }),
      style: el('style'),

      menu: el('div', 'remotestorage-menu'),
      menuItemSync: el('div', null, {
        'class': 'item'
      }),
      syncButton: el('button', 'remotestorage-sync-button', {
        '_content': 'Sync now',
        'class': 'remotestoage-button'
      }),
      error: el('div', 'remotestorage-error', {
        'style': 'display:none'
      })

    };

    widget.root.appendChild(widget.connectButton);
    widget.root.appendChild(widget.registerButton);
    widget.root.appendChild(widget.cube);
    widget.root.appendChild(widget.bubble);
    widget.root.appendChild(widget.helpHint);
    widget.root.appendChild(widget.helpText);
    widget.root.appendChild(widget.userAddress);
    widget.root.appendChild(widget.menu);
    widget.root.appendChild(widget.error);

    widget.menu.appendChild(widget.menuItemSync);

    widget.style.innerHTML = assets.widgetCss;

    return widget;
  }

  function handleSyncNowClick() {
    if(widgetState == 'connected' || widgetState == 'busy') {
      sync.forceSync();
    }
  }

  function showMenu() {
    if(widgetState == 'connected' || widgetState == 'busy') {
      if(widget.menu.style.display != 'block') {
        widget.menu.style.display = 'block';
        if(widgetState == 'busy') {
          widget.menuItemSync.innerHTML = "Syncing";
        } else if(sync.needsSync()) {
          widget.menuItemSync.innerHTML = "Unsynced";
        } else if(sync.lastSyncAt > 0) {
          var t = new Date().getTime() - sync.lastSyncAt.getTime();
          widget.menuItemSync.innerHTML = "Synced " + Math.round(t / 1000) + ' seconds ago';
        } else {
          widget.menuItemSync.innerHTML = "(never synced)";
        }
        widget.menuItemSync.appendChild(widget.syncButton);
      }
    }
  }

  function hideMenu() {
    widget.menu.style.display = 'none';
  }

  function displayWidgetState(state, userAddress) {
    if(state === 'authing') {
      displayError("Authentication was aborted. Please try again.");
      return setWidgetState('typing');
    }

    if(! widget) {
      var root = document.getElementById(connectElement);
      widget = buildWidget();

      widget.registerButton.addEventListener('click', handleRegisterButtonClick);
      widget.connectButton.addEventListener('click', handleConnectButtonClick);
      widget.bubble.addEventListener('click', handleBubbleClick);
      widget.cube.addEventListener('click', handleCubeClick);
      widget.userAddress.addEventListener('keyup', handleWidgetTypeUserAddress);
      widget.syncButton.addEventListener('click', handleSyncNowClick);
      widget.root.addEventListener('mouseover', showMenu);
      widget.root.addEventListener('mouseout', hideMenu);

      root.appendChild(widget.style);
      root.appendChild(widget.root);
    }

    if(state == 'connecting') {
      widget.connectButton.setAttribute('disabled', 'disabled');
      widget.userAddress.setAttribute('disabled', 'disabled');
    } else {
      widget.connectButton.removeAttribute('disabled');
      widget.userAddress.removeAttribute('disabled');
    }

    hideMenu();

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
    var cubeIcon = assets.remotestorageIcon;
    if(initialSync && state != 'offline') {
      bubbleText = 'Connecting ' + userAddress;
      bubbleVisible = true;
    } else if(state == 'connected') {
      bubbleText = 'Disconnect ' + userAddress;
    } else if(state == 'busy') {
      bubbleText = 'Synchronizing ' + userAddress + '...';
    } else if(state == 'offline') {
      if(offlineReason == 'unauthorized') {
        cubeIcon = assets.remotestorageIconError;
        bubbleText = 'Access denied by remotestorage. Click to reconnect.';
        bubbleVisible = true;
      } else {
        cubeIcon = assets.remotestorageIconOffline;
        bubbleText = 'Offline (' + userAddress + ')';
        bubbleVisible = true;
      }
    }

    widget.cube.setAttribute('src', cubeIcon);
    
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

  function displayError(message) {
    if(widget) {
      widget.error.style.display = 'block';
      widget.error.innerHTML = message;
    } else {
      alert(message);
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
          displayError('webfinger discovery failed! Please check if your user address is correct and try again. If the problem persists, contact your storage provider for support. (Error is: ' + err + ')');
        }
        if(authDialogStrategy == 'popup') {
          closeAuthPopup();
        }
        setWidgetState('typing');
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
      tweakConnectButton();
    }
  }

  function handleBubbleClick() {
    if(widgetState == 'connected' || widgetState == 'busy') {
      // DISCONNECT
      sync.fullPush(function() {
        wireClient.disconnectRemote();
        store.forgetAll();
        sync.clearSettings();
        localStorage.removeItem('remote_storage_widget_useraddress');
        widget.userAddress.value = '';
        // trigger 'disconnected' once, so the app can clear it's views.
        setWidgetState('disconnected', true);
        setWidgetState('anonymous');
      });
    } else if(widgetState == 'offline' && offlineReason == 'unauthorized') {
      dance();
    } else if(widgetState == 'offline' && offlineReason == 'timeout') {
      tryReconnect();
    }
  }
  function handleCubeClick() {
    if(widgetState == 'connected' || widgetState == 'connected') {
      handleBubbleClick();
    }
  }

  function tweakConnectButton() {
    if(widget.userAddress.value.length > 0) {
      widget.connectButton.removeAttribute('disabled');
    } else {
      widget.connectButton.setAttribute('disabled', 'disabled');
    }
  }

  function handleWidgetTypeUserAddress(event) {
    if(event.keyCode === 13) {
      widget.connectButton.click();
    } else {
      tweakConnectButton();
    }
  }
  function handleWidgetHover() {
    logger.debug('handleWidgetHover');
  }

  function nowConnected() {
    logger.info("NOW CONNECTED");
    setWidgetState('connected');
    initialSync = true;
    store.fireInitialEvents();
    sync.forceSync(function() {
      logger.info("Initial sync done.");
      initialSync = false;
      setWidgetState(getWidgetState());
      schedule.enable();
      events.emit('ready');
    });
  }

  function tryReconnect() {
    var tCount = timeoutCount;
    sync.fullSync(function() {
      if(timeoutCount == tCount) {
        timeoutCount = 0;
        setWidgetState('connected');
        schedule.enable();
      }
    });
  }

  function scheduleReconnect(milliseconds) {
    setTimeout(tryReconnect, milliseconds);
  }

  function handleSyncTimeout() {
    offlineReason = 'timeout';
    setWidgetState('offline');
    timeoutCount++;
    scheduleReconnect(Math.min(timeoutCount * 10000, 300000));
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
        // clear bearer token, so the wireClient state is correct.
        wireClient.setBearerToken(null);
        setWidgetState('offline');
      } else if(error.message == 'unknown error') {
        // "unknown error" happens when the XHR doesn't
        // have any status code set. this usually means
        // a network error occured. We handle it exactly
        // like we handle a timeout.
        handleSyncTimeout();
      } else {
        logger.error("unhandled sync error: ", error);
      }
      
      if(initialSync) {
        // abort initial sync
        initialSync = false;
        // give control to the app (it runs in offline-mode now)
        events.emit('ready');
      }
    });

    sync.on('timeout', handleSyncTimeout);

    // sync access-roots every minute.
    schedule.watch('/', 60000);

    connectElement = setConnectElement;

    if(wireClient.calcState() == 'connected') {
      nowConnected();
    } else {
      wireClient.on('connected', nowConnected);
    }

    wireClient.on('error', function(err) {
      displayError(translate(err));
    });

    sync.on('state', function(syncState) {
      if(wireClient.getState() == 'connected') {
        setWidgetState(syncState);
      }
    });

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
      if(widgetState != 'anonymous' && widgetState != 'authing' && widgetState != 'connecting' && sync.needsSync()) {
        sync.fullPush();
        var message = "Synchronizing your data now. Please wait until the cube stops spinning.";
        event.returnValue = message;
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
