define(['../util', '../assets', '../i18n'], function(util, assets, i18n) {

  if(typeof(document) === 'undefined') {
    return { display: function() { throw "Widget not supported"; } };
  }

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
      '<input type="email" placeholder="user@host" name="userAddress" novalidate>',
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
