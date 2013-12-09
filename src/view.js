(function(window){

  var t = RemoteStorage.I18n.translate;

  var cEl = function(){
    return document.createElement.apply(document, arguments);
  };

  function gCl(parent, className) {
    return parent.getElementsByClassName(className)[0];
  }

  function gTl(parent, tagName) {
    return parent.getElementsByTagName(tagName)[0];
  }

  function removeClass(el, className) {
    return el.classList.remove(className);
  }

  function addClass(el, className) {
    return el.classList.add(className);
  }

  function stopPropagation(event) {
    if (typeof(event.stopPropagation) === 'function') {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
  }

  function setupButton(parent, className, iconName, eventListener) {
    var element = gCl(parent, className);
    if (typeof iconName !== 'undefined') {
      var img = gTl(element, 'img');
      (img || element).src = RemoteStorage.Assets[iconName];
    }
    element.addEventListener('click', eventListener);
    return element;
  }

  /**
   * Class: RemoteStorage.Widget.View
   *
   * The View controles the actual visible widget
   *
   * States:
   *   initial      - not connected
   *   authing      - in auth flow
   *   connected    - connected to remote storage, not syncing at the moment
   *   busy         - connected, syncing at the moment
   *   offline      - connected, but no network connectivity
   *   error        - connected, but sync error happened
   *   unauthorized - connected, but request returned 401
   **/
  RemoteStorage.Widget.View = function(remoteStorage) {
    this.rs = remoteStorage;
    if (typeof(document) === 'undefined') {
      throw "Widget not supported";
    }
    RemoteStorage.eventHandling(this,
                                'connect',
                                'disconnect',
                                'sync',
                                'display',
                                'reset');

    // Re-binding the event so they can be called from the window
    for (var event in this.events){
      this.events[event] = this.events[event].bind(this);
    }

    this.hideBubbleOnBodyClick = function(event) {
      for (var p = event.target; p !== document.body; p = p.parentElement) {
        if (p.id === 'remotestorage-widget') {
          return;
        }
      }
      this.hideBubble();
    }.bind(this);
  };

  RemoteStorage.Widget.View.prototype = {

    connectGdrive: function() {
      this._emit('connect', { special: 'googledrive' });
    },

    connectDropbox: function(){
      this._emit('connect', { special: 'dropbox'});
    },

    /**
     * Method: setState(state, args)
     *    calls states[state]
     *    args are the arguments for the
     *    state(errors mostly)
     **/
    setState: function(state, args) {
      RemoteStorage.log('widget.view.setState(',state,',',args,');');
      var s = this.states[state];
      if (typeof(s) === 'undefined') {
        throw new Error("Bad State assigned to view: " + state);
      }
      s.apply(this,args);
    },

    /**
     * Method: setUserAddres
     *    set userAddress of the input field
     **/
    setUserAddress: function(addr) {
      this.userAddress = addr || '';

      var el;
      if (this.div && (el = gTl(this.div, 'form').userAddress)) {
        el.value = this.userAddress;
      }
    },

    /**
    *  toggleBubble()
    *    shows the bubble when hidden and the other way around
    **/
    toggleBubble: function(event) {
      if (this.bubble.className.search('rs-hidden') < 0) {
        this.hideBubble(event);
      } else {
        this.showBubble(event);
      }
    },

    /**
     *  hideBubble()
     *   hides the bubble
     **/
    hideBubble: function(){
      addClass(this.bubble, 'rs-hidden');
      document.body.removeEventListener('click', this.hideBubbleOnBodyClick);
    },

    /**
     * Method: showBubble()
     *   shows the bubble
     **/
    showBubble: function(event){
      removeClass(this.bubble, 'rs-hidden');
      if (typeof(event) !== 'undefined') {
        stopPropagation(event);
      }
      document.body.addEventListener('click', this.hideBubbleOnBodyClick);
      gTl(this.bubble,'form').userAddress.focus();
    },

     /**
     * Method: display(domID)
     *   draws the widget inside of the dom element with the id domID
     *   returns: the widget div
     **/
    display: function(domID) {
      if (typeof this.div !== 'undefined') {
        return this.div;
      }

      var element = cEl('div');
      var style = cEl('style');
      style.innerHTML = RemoteStorage.Assets.widgetCss;

      element.id = "remotestorage-widget";

      element.innerHTML = RemoteStorage.Assets.widget;

      element.appendChild(style);
      if (domID) {
        var parent = document.getElementById(domID);
        if (! parent) {
          throw "Failed to find target DOM element with id=\"" + domID + "\"";
        }
        parent.appendChild(element);
      } else {
        document.body.appendChild(element);
      }

      // Sync button
      setupButton(element, 'rs-sync', 'syncIcon', this.events.sync);

      // Disconnect button
      setupButton(element, 'rs-disconnect', 'disconnectIcon', this.events.disconnect);

      // Get me out of here
      setupButton(element, 'remotestorage-reset', undefined, this.events.reset);

      // Connect button
      var cb = setupButton(element, 'connect', 'connectIcon', this.events.connect);

      // Input
      this.form = gTl(element, 'form');
      var el = this.form.userAddress;
      el.addEventListener('keyup', function(event) {
        if (event.target.value) {
          cb.removeAttribute('disabled');
        } else {
          cb.setAttribute('disabled','disabled');
        }
      });
      if (this.userAddress) {
        el.value = this.userAddress;
      }

      // The cube
      this.cube = setupButton(element, 'rs-cube', 'remoteStorageIcon', this.toggleBubble.bind(this));

      // Google Drive and Dropbox icons
      setupButton(element, 'rs-dropbox', 'dropbox', this.connectDropbox.bind(this));
      setupButton(element, 'rs-googledrive', 'googledrive', this.connectGdrive.bind(this));

      var bubbleDontCatch = { INPUT: true, BUTTON: true, IMG: true };
      var eventListener = function(event) {
        if (! bubbleDontCatch[event.target.tagName] && ! (this.div.classList.contains('remotestorage-state-unauthorized') )) {
          this.showBubble(event);
        }
      }.bind(this);
      this.bubble = setupButton(element, 'rs-bubble', undefined, eventListener);

      this.hideBubble();

      this.div = element;

      this.states.initial.call(this);
      this.events.display.call(this);
      return this.div;
    },

    _renderTranslatedInitialContent: function() {
      gCl(this.div, 'rs-status-text').innerHTML = t("view_connect");
      gCl(this.div, 'remotestorage-reset').innerHTML = t("view_get_me_out");
      gCl(this.div, 'rs-error-plz-report').innerHTML = t("view_error_plz_report");
      gCl(this.div, 'remotestorage-unauthorized').innerHTML = t("view_unauthorized");
    },

    states:  {
      initial: function(message) {
        var cube = this.cube;
        var info = message || t("view_info");

        this._renderTranslatedInitialContent();

        if (message) {
          cube.src = RemoteStorage.Assets.remoteStorageIconError;
          removeClass(this.cube, 'remotestorage-loading');
          this.showBubble();

          // Show the red error cube for 5 seconds, then show the normal orange one again
          setTimeout(function(){
            cube.src = RemoteStorage.Assets.remoteStorageIcon;
          },5000);
        } else {
          this.hideBubble();
        }
        this.div.className = "remotestorage-state-initial";

        // Google Drive and Dropbox icons
        var backends = 1;
        if (this._activateBackend('dropbox')) { backends += 1; }
        if (this._activateBackend('googledrive')) { backends += 1; }
        gCl(this.div, 'rs-bubble-text').style.paddingRight = backends*32+8+'px';

        // If address not empty connect button enabled
        var cb = gCl(this.div, 'connect');
        if (this.form.userAddress.value) {
          cb.removeAttribute('disabled');
        }

        var infoEl = gCl(this.div, 'rs-info-msg');
        infoEl.innerHTML = info;

        if (message) {
          infoEl.classList.add('remotestorage-error-info');
        } else {
          infoEl.classList.remove('remotestorage-error-info');
        }
      },

      authing: function() {
        this.div.removeEventListener('click', this.events.connect);
        this.div.className = "remotestorage-state-authing";
        gCl(this.div, 'rs-status-text').innerHTML = t("view_connecting", this.userAddress);
        addClass(this.cube, 'remotestorage-loading'); //TODO needs to be undone, when is that neccesary
      },

      connected: function() {
        this.div.className = "remotestorage-state-connected";
        gCl(this.div, 'userAddress').innerHTML = this.userAddress;
        this.cube.src = RemoteStorage.Assets.remoteStorageIcon;
        removeClass(this.cube, 'remotestorage-loading');
        var icons = {
          googledrive: gCl(this.div, 'rs-googledrive'),
          dropbox: gCl(this.div, 'rs-dropbox')
        };
        icons.googledrive.style.display = icons.dropbox.style.display = 'none';
        if (icons[this.rs.backend]) {
          icons[this.rs.backend].style.display = 'inline-block';
          gCl(this.div, 'rs-bubble-text').style.paddingRight = 2*32+8+'px';
        } else {
          gCl(this.div, 'rs-bubble-text').style.paddingRight = 32+8+'px';
        }
      },

      busy: function() {
        this.div.className = "remotestorage-state-busy";
        addClass(this.cube, 'remotestorage-loading'); //TODO needs to be undone when is that neccesary
        this.hideBubble();
      },

      offline: function() {
        this.div.className = "remotestorage-state-offline";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconOffline;
        gCl(this.div, 'rs-status-text').innerHTML = t("view_offline");
      },

      error: function(err) {
        var errorMsg = err;
        this.div.className = "remotestorage-state-error";

        gCl(this.div, 'rs-bubble-text').innerHTML = '<strong>'+t('view_error_occured')+'</strong>';
        //FIXME I don't know what an DOMError is and my browser doesn't know too(how to handle this?)
        if (err instanceof Error /*|| err instanceof DOMError*/) {
          errorMsg = err.message + '\n\n' +
            err.stack;
        }
        gCl(this.div, 'rs-error-msg').textContent = errorMsg;
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.showBubble();
      },

      unauthorized: function() {
        this.div.className = "remotestorage-state-unauthorized";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.showBubble();
        this.div.addEventListener('click', this.events.connect);
      }
    },

    events: {
    /**
     * Event: connect
     * emitted when the connect button is clicked
     **/
      connect: function(event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('connect', gTl(this.div, 'form').userAddress.value);
      },

      /**
       * Event: sync
       * emitted when the sync button is clicked
       **/
      sync: function(event) {
        stopPropagation(event);
        event.preventDefault();

        this._emit('sync');
      },

      /**
       * Event: disconnect
       * emitted when the disconnect button is clicked
       **/
      disconnect: function(event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('disconnect');
      },

      /**
       * Event: reset
       * fired after crash triggers disconnect
       **/
      reset: function(event){
        event.preventDefault();
        var result = window.confirm(t('view_confirm_reset'));
        if (result){
          this._emit('reset');
        }
      },

      /**
       * Event: display
       * fired when finished displaying the widget
       **/
      display : function(event) {
        if (event) {
          event.preventDefault();
        }
        this._emit('display');
      }
    },

    _activateBackend: function activateBackend(backendName) {
      var className = 'rs-' + backendName;
      if (this.rs.apiKeys[backendName]) {
        gCl(this.div, className).style.display = 'inline-block';
        return true;
      } else {
        gCl(this.div, className).style.display = 'none';
        return false;
      }
    }
  };
})(typeof(window) !== 'undefined' ? window : global);
