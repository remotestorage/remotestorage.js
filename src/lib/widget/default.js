define(['../util', '../assets', '../i18n'], function(util, assets, i18n) {

  if(typeof(document) === 'undefined') {
    return { display: function() { throw "Widget not supported"; } };
  }

  /*

    Interface: WidgetView

      A stateful view providing interaction with remotestorage.

    States:
      initial      - not connected
      authing      - in auth flow
      connected    - connected to remotestorage, not syncing at the moment
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

  var userAddress = '';

  var currentState = 'initial';

  var elements = {};

  var cubeStateIcons = {
    connected: assets.remotestorageIcon,
    error: assets.remotestorageIconError,
    offline: assets.remotestorageIconOffline
  };

  var stillInitialSync = false;

  var stateViews = {

    initial: function() {
      userAddress = '';

      addClass(elements.bubble, 'one-line');

      setBubbleText(t('connect-remotestorage'));
      setBubbleAction(jumpAction('typing'));

      setCubeState('connected');
      setCubeAction(jumpAction('typing'));
    },

    typing: function(connectionError) {
      elements.connectForm.userAddress.setAttribute('value', userAddress);
      setCubeState('offline');
      setBubbleText(t('connect-remotestorage'));
      elements.bubble.appendChild(elements.connectForm);
      addEvent(elements.connectForm, 'submit', function(event) {
        event.preventDefault();
        userAddress = elements.connectForm.userAddress.value;
        events.emit('connect', userAddress);
      });

      if(connectionError) {
        // error bubbled from webfinger
        addClass(
          addBubbleHint(t('webfinger-failed')),
          'error'
        );
      } else {
        addBubbleHint(t('typing-hint'));
      }

      elements.bubble.appendChild(elements.localeChooser);

      addEvent(elements.localeChooser, 'change', function() {
        i18n.setLocale(elements.localeChooser.value);
        setState(currentState);
      });
      
      setCubeAction(jumpAction('initial'));

      elements.connectForm.userAddress.focus();
    },

    authing: function() {
      setBubbleText(t('connecting', { userAddress: userAddress }));
      elements.bubble.appendChild(elements.connectForm);
      elements.connectForm.userAddress.setAttribute('disabled', 'disabled');
      elements.connectForm.connect.setAttribute('disabled', 'disabled');
      elements.connectForm.userAddress.setAttribute('value', userAddress);
      setCubeState('offline');
      addClass(elements.cube, 'spinning');
    },

    connected: function() {
      if(stillInitialSync) {
        stillInitialSync = false;
      }

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

      content.appendChild(cEl('br'));

      var hint = cEl('div');
      addClass(hint, 'info');

      function updateLastSynced() {
        hint.innerHTML = t('last-synced', { t: i18n.helpers.timeAgo(
          new Date().getTime() - widgetOptions.getLastSyncAt()
        ) });
      }
      addEvent(elements.bubble, 'mouseover', updateLastSynced);

      updateLastSynced();

      content.appendChild(hint);

      content.appendChild(cEl('br'));
      content.appendChild(elements.syncButton);
      content.appendChild(elements.disconnectButton);
      addEvent(elements.syncButton, 'click', function() {
        events.emit('sync');
      });
      addEvent(elements.disconnectButton, 'click', disconnectAction);

      elements.bubble.appendChild(content);

      var visible = false;
      setCubeAction(function() {
        if(visible) {
          addClass(elements.bubble, 'hidden');
        } else {
          removeClass(elements.bubble, 'hidden');
        }
        visible = !visible;
      });
    },

    busy: function(initialSync) {
      setCubeState('connected');
      addClass(elements.cube, 'spinning');
      if(! (initialSync || stillInitialSync)) {
        addClass(elements.bubble, 'hidden');
        setBubbleText(t('synchronizing', { userAddress: userAddress }));
      } else if(initialSync) {
        stillInitialSync = true;
        setBubbleText(t('connecting', { userAddress: userAddress }));
      }
    },

    error: function(error) {
      setCubeState('error');
      setBubbleText("An error occured: ");
      var trace = cEl('pre');
      elements.bubble.appendChild(trace);
      if(error instanceof Error) {
        trace.innerHTML = error.stack;
      } else if(typeof(error) === 'object') {
        trace.innerHTML = JSON.stringify(error, null, 2);
      } else {
        trace.innerHTML = error;
      }
      elements.bubble.appendChild(elements.disconnectButton);
      addEvent(elements.disconnectButton, 'click', disconnectAction);
    },

    offline: function(error) {
      setCubeState('offline');
      addClass(elements.bubble, 'one-line');
      setBubbleText(t('offline', { userAddress: userAddress }));
    },

    unauthorized: function() {
      setCubeState('error');
      setBubbleText('<strong>' + userAddress + '</strong><br/>' + t('unauthorized') + '<br/>');
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

    elements.connectForm.connect.value = t('connect');
    elements.syncButton.innerHTML = t('sync');
    elements.disconnectButton.innerHTML = t('disconnect');
  }
  
  function prepareWidget() {
    elements.style = cEl('style');
    elements.style.innerHTML = assets.widgetCss;
    // #remotestorage-widget
    elements.widget = cEl('div');
    elements.widget.setAttribute('id', 'remotestorage-widget');
    // .cube
    elements.cube = cEl('img');
    // .bubble
    elements.bubble = cEl('div');

    elements.widget.appendChild(elements.bubble);
    elements.widget.appendChild(elements.cube);

    // form.connect
    elements.connectForm = cEl('form');
    elements.connectForm.innerHTML = [
      '<input type="email" placeholder="user@host" name="userAddress" autocomplete="off">',
      '<input type="submit" value="" name="connect">'
    ].join('');
    // button.sync
    elements.syncButton = cEl('button');
    elements.syncButton.setAttribute('class', 'sync');
    // button.disconnect
    elements.disconnectButton = cEl('button');
    elements.disconnectButton.setAttribute('class', 'disconnect');

    // select.locale
    elements.localeChooser = cEl('select');
    addClass(elements.localeChooser, 'locale');

    var currentLocale = i18n.getLocale();
    i18n.locales.forEach(function(locale) {
      var option = cEl('option');
      option.setAttribute('value', locale);
      option.innerHTML = locale;
      if(locale === currentLocale) {
        option.setAttribute('selected', 'selected');
      }
      elements.localeChooser.appendChild(option);
    });

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
    elements.bubble.innerHTML = text;
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

  function display(domId, options) {
    if(! options) {
      options = {};
    }
    widgetOptions = options;

    if(options.locale) {
      i18n.setLocale(options.locale);
    } else {
      i18n.autoDetect();
    }

    prepareWidget();
    gEl(domId).appendChild(elements.style);
    gEl(domId).appendChild(elements.widget);
    updateWidget();
  }

  function setState(state) {
    var args = Array.prototype.slice.call(arguments, 1);
    currentState = state;
    util.nextTick(function() {
      updateWidget.apply(undefined, args);
    });
  }

  function redirectTo(url) {
    setBubbleText(t('redirecting', { hostName: util.hostNameFromUri(url) }));
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
