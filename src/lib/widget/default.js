define(['../util', '../assets', '../i18n'], function(util, assets, i18n) {

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
    any

    Method: setState
    Set widget state to given value.

    Parameters:
      state - a string. one of the states listed above.

   */

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

    typing: function() {
      elements.connectForm.userAddress.setAttribute('value', userAddress);
      elements.widget.appendChild(elements.bubble);
      elements.widget.appendChild(elements.cube);
      setBubbleText(t('connect-remotestorage'));
      elements.bubble.appendChild(elements.connectForm);
      addEvent(elements.connectForm, 'submit', function(event) {
        event.preventDefault();
        userAddress = elements.connectForm.userAddress.value;
        events.emit('connect', userAddress);
      });

      setCubeAction(jumpAction('initial'));

      elements.connectForm.userAddress.focus();
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

      setBubbleText('<strong class="userAddress">' + userAddress + '</strong>');

      var content = document.createElement('div');
      addClass(content, 'content');

      content.appendChild(document.createElement('br'));
      content.appendChild(elements.syncButton);
      content.appendChild(elements.disconnectButton);
      addEvent(elements.syncButton, 'click', function() {
        events.emit('sync');
      });
      addEvent(elements.disconnectButton, 'click', function(event) {
        event.preventDefault();
        events.emit('disconnect');
        return false;
      });

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
      var trace = document.createElement('pre');
      elements.bubble.appendChild(trace);
      if(error instanceof Error) {
        trace.innerHTML = error.stack;
      } else {
        trace.innerHTML = error;
      }
    },

    offline: function(error) {
      setCubeState('offline');
      addClass(elements.bubble, 'one-line');
      setBubbleText(t('offline', { userAddress: userAddress }));
    },

    unauthorized: function() {
      setCubeState('error');
      setBubbleText('<strong>' + userAddress + '</strong><br/>' + t('unauthorized'));
      setCubeAction(util.curry(events.emit, 'reconnect'));
      setBubbleAction(util.curry(events.emit, 'reconnect'));
    }

  };

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

    elements.connectForm.connect.value = t('connect');
    elements.syncButton.innerHTML = t('sync');
    elements.disconnectButton.innerHTML = t('disconnect');
  }
  
  function prepareWidget() {
    elements.style = document.createElement('style');
    elements.style.innerHTML = assets.widgetCss;
    // #remotestorage-widget
    elements.widget = document.createElement('div');
    elements.widget.setAttribute('id', 'remotestorage-widget');
    // .cube
    elements.cube = document.createElement('img');
    // .bubble
    elements.bubble = document.createElement('div');

    elements.widget.appendChild(elements.bubble);
    elements.widget.appendChild(elements.cube);

    // form.connect
    elements.connectForm = document.createElement('form');
    elements.connectForm.innerHTML = [
      '<input type="email" placeholder="user@host" name="userAddress">',
      '<input type="submit" value="" name="connect">'
    ].join();
    // button.sync
    elements.syncButton = document.createElement('button');
    elements.syncButton.setAttribute('class', 'sync');
    // button.disconnect
    elements.disconnectButton = document.createElement('button');
    elements.disconnectButton.setAttribute('class', 'disconnect');
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

    if(widgetOptions.locale) {
      i18n.setLocale(widgetOptions.locale);
    }
    prepareWidget();
    document.getElementById(domId).appendChild(elements.style);
    document.getElementById(domId).appendChild(elements.widget);
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
    console.log("REDIRECTING TO", url);
    setTimeout(function() {
      document.location = url;
    }, 5000);
  }

  function setUserAddress(addr) {
    userAddress = addr;
    elements.connectForm.userAddress.setAttribute('value', addr);
  }

  return util.extend({

    display: display,
    setState: setState,
    redirectTo: redirectTo,
    setUserAddress: setUserAddress

  }, events);

});
