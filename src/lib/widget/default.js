define(['../util', '../assets', '../i18n'], function(util, assets, i18n) {

  /*

    Interface: WidgetView

    A stateful view providing interaction with remotestorage.

    States:
      initial   - not connected
      authing   - in auth flow
      connected - connected to remotestorage, not syncing at the moment
      busy      - connected, syncing at the moment
      offline   - connected, but no network connectivity
      error     - connected, but sync error happened

    Event: connect
    Fired when the "connect" action is caused by the user.
    
    Parameters:
      userAddress - The user address to connect to

    Event: disconnect
    Fired when "disconnect" action is requested.

    Event: sync
    Fired when "sync" action is requested

    Method: display
    Display the widget in "initial" state
    
    Parameters:
    any

    Method: setState
    Set widget state to given value.

    Parameters:
      state - a string. one of the states listed above.

   */

  var t = i18n('widget');

  var events = util.getEventEmitter('connect', 'disconnect', 'sync');

  var browserEvents = [];

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

  var stateViews = {

    initial: function() {
      userAddress = '';
      elements.widget.appendChild(elements.bubble);
      elements.widget.appendChild(elements.cube);

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
      elements.widget.appendChild(elements.bubble);
      elements.widget.appendChild(elements.cube);

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
      content.appendChild(elements.scopeInfo);

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

    busy: function() {
      elements.widget.appendChild(elements.bubble);
      elements.widget.appendChild(elements.cube);

      addClass(elements.bubble, 'hidden');
      addClass(elements.cube, 'spinning');
      setBubbleText('Synchronizing <strong>' + userAddress + '</strong>');
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
    // form.connect
    elements.connectForm = document.createElement('form');
    var userAddressInput = document.createElement('input');
    userAddressInput.setAttribute('type', 'email');
    userAddressInput.setAttribute('placeholder', 'user@host');
    userAddressInput.setAttribute('name', 'userAddress');
    elements.connectForm.appendChild(userAddressInput);
    var connectButton = document.createElement('input');
    connectButton.setAttribute('type', 'submit');
    connectButton.setAttribute('value', t('connect'));
    elements.connectForm.appendChild(connectButton);
    resetElementState();
    // button.sync
    elements.syncButton = document.createElement('button');
    elements.syncButton.setAttribute('class', 'sync');
    elements.syncButton.innerHTML = t('sync');
    // button.disconnect
    elements.disconnectButton = document.createElement('button');
    elements.disconnectButton.setAttribute('class', 'disconnect');
    elements.disconnectButton.innerHTML = t('disconnect');
    // .scope-info
    elements.scopeInfo = document.createElement('div');
    elements.scopeInfo.setAttribute('class', 'scope-info');
    var permLabel = document.createElement('strong');
    permLabel.innerHTML = t('permissions') + ':';
    elements.scopeInfo.appendChild(permLabel);
    var scopeList = document.createElement('ul');
    for(var scope in widgetOptions.scopes) {
      var el = document.createElement('li');
      el.innerHTML = scope || t('all-data');
      switch(widgetOptions.scopes[scope]) {
      case 'r':
        el.innerHTML += ' (read-only)';
        break;
      case 'rw':
        el.innerHTML += ' (read and write)';
      }
      scopeList.appendChild(el);
    }
    elements.scopeInfo.appendChild(scopeList);
  }

  function clearWidget() {
    Array.prototype.forEach.call(elements.widget.children, function(child) {
      elements.widget.removeChild(child);
    });
    clearEvents();
    resetElementState();
  }

  function updateWidget() {
    var stateView = stateViews[currentState];
    if(stateView) {
      clearWidget();
      stateView();
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

  var widgetOptions;

  function display(domId, options) {
    widgetOptions = options;
    prepareWidget();
    document.getElementById(domId).appendChild(elements.style);
    document.getElementById(domId).appendChild(elements.widget);
    updateWidget();
  }

  function setState(state) {
    currentState = state;
    util.nextTick(updateWidget);
  }

  function displayError(error) {
    alert("ERROR: " + error);
  }

  function redirectTo(url) {
    document.location = url;
  }

  function setUserAddress(addr) {
    userAddress = addr;
    elements.connectForm.userAddress.setAttribute('value', addr);
  }

  return util.extend({

    display: display,
    setState: setState,
    displayError: displayError,
    redirectTo: redirectTo,
    setUserAddress: setUserAddress

  }, events);

});
