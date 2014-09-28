(function (window){

  var t = RemoteStorage.I18n.translate;

  /**
   * Class: RemoteStorage.Widget.View
   *
   * Controls the visible widget
   *
   * States:
   *
   *   initial      - not connected
   *   authing      - in auth flow
   *   connected    - connected to remote storage, not syncing at the moment
   *   ciphered     - connected, with cipher
   *   notciphered  - connected, without cipher
   *   busy         - connected, syncing at the moment
   *   offline      - connected, but no network connectivity
   *   error        - connected, but sync error happened
   *   unauthorized - connected, but request returned 401
   **/
  RemoteStorage.Widget.View = function (remoteStorage) {
    this.rs = remoteStorage;
    if (typeof(document) === 'undefined') {
      throw "Widget not supported";
    }
    RemoteStorage.eventHandling(this,
                                'connect',
                                'secret-entered',
                                'secret-cancelled',
                                'disconnect',
                                'sync',
                                'display',
                                'reset');

    // Re-binding the event so they can be called from the window
    for (var event in this.events){
      this.events[event] = this.events[event].bind(this);
    }

    this.hideBubbleOnBodyClick = function (event) {
      for (var p = event.target; p !== document.body; p = p.parentElement) {
        if (p.id === 'remotestorage-widget') {
          return;
        }
      }
      this.hideBubble();
    }.bind(this);
  };

  RemoteStorage.Widget.View.prototype = {

    connectGdrive: function () {
      this._emit('connect', { special: 'googledrive' });
    },

    connectDropbox: function (){
      this._emit('connect', { special: 'dropbox'});
    },

    /**
     * Method: setState
     *
     * Call the function that applies the state to the widget
     *
     * Parameters:
     *
     *   state
     *   args
     **/
    setState: function (state, args) {
      RemoteStorage.log('[View] widget.view.setState(',state,',',args,');');
      var s = this.states[state];
      if (typeof(s) === 'undefined') {
        throw new Error("Bad State assigned to view: " + state);
      }
      s.apply(this, args);
    },

    /**
     * Method: setUserAddress
     *
     * Set user address of the input field
     **/
    setUserAddress: function (addr) {
      this.userAddress = addr || '';

      var el;
      if (this.div && (el = this.div.querySelector('form.remotestorage-initial').userAddress)) {
        el.value = this.userAddress;
      }
    },

    /**
     * Method: setUserSecretKey
     *
     * Set user secret key
     **/
    setUserSecretKey: function (secretKey) {
      this.userSecretKey = secretKey;
    },

    /**
    * Method: toggleBubble
    *
    * Show the bubble when hidden and the other way around
    **/
    toggleBubble: function (event) {
      if (this.bubble.className.search('rs-hidden') < 0) {
        this.hideBubble(event);
      } else {
        this.showBubble(event);
      }
    },

    /**
     * Method: hideBubble
     *
     * Hide the bubble
     **/
    hideBubble: function (){
      addClass(this.bubble, 'rs-hidden');
      document.body.removeEventListener('click', this.hideBubbleOnBodyClick);
    },

    /**
     * Method: showBubble
     *
     * Show the bubble
     **/
    showBubble: function (event){
      removeClass(this.bubble, 'rs-hidden');
      if (typeof(event) !== 'undefined') {
        stopPropagation(event);
      }
      document.body.addEventListener('click', this.hideBubbleOnBodyClick);
      if (this.div.querySelector('.remotestorage-connected').classList.contains('remotestorage-cipher') && !this.userSecretKey) {
        this.bubble.querySelector('form.remotestorage-cipher-form').userSecretKey.focus();
      } else {
        this.bubble.querySelector('form.remotestorage-initial').userAddress.focus();
      }
    },

    /**
     * Method: display
     *
     * Draw the widget inside of the dom element with the id options.domID
     *
     * Parameters:
     *
     *   options
     *
     * Returns:
     *
     *   The widget div
     **/
    display: function (options) {
      if (typeof this.div !== 'undefined') {
        return this.div;
      }

      var element = document.createElement('div');
      var style = document.createElement('style');
      style.innerHTML = RemoteStorage.Assets.widgetCss;

      element.id = "remotestorage-widget";

      element.innerHTML = RemoteStorage.Assets.widget;

      element.appendChild(style);
      if (options.domID) {
        var parent = document.getElementById(options.domID);
        if (! parent) {
          throw "Failed to find target DOM element with id=\"" + options.domID + "\"";
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
      var connectButton = setupButton(element, 'connect', 'connectIcon', this.events.connect);

      // Handle connectButton state
      this.form = element.querySelector('form.remotestorage-initial');
      var el = this.form.userAddress;
      el.addEventListener('load', handleButtonState);
      el.addEventListener('keyup', handleButtonState);
      if (this.userAddress) {
        el.value = this.userAddress;
      }

      if (options.encryption) {
        this.cipher = true;

        var secretKeyInput = element.querySelector('form.remotestorage-cipher-form').userSecretKey;

        // This is to avoid the 'password field on an insecured page' warning, when not used and on http (not https)
        secretKeyInput.type = 'password';

        // Cipher button
        var cipherButton = setupButton(element, 'rs-cipher', 'cipherIcon', this.events['secret-entered']);

        // Handle cipherButton state
        secretKeyInput.addEventListener('load', handleButtonState);
        secretKeyInput.addEventListener('keyup', handleButtonState);

        // No cipher button
        setupButton(element, 'rs-nocipher', 'nocipherIcon', this.events['secret-cancelled']);
      }

      // The cube
      this.cube = setupButton(element, 'rs-cube', 'remoteStorageIcon', this.toggleBubble.bind(this));

      // Google Drive and Dropbox icons
      setupButton(element, 'rs-dropbox', 'dropbox', this.connectDropbox.bind(this));
      setupButton(element, 'rs-googledrive', 'googledrive', this.connectGdrive.bind(this));

      var bubbleDontCatch = { INPUT: true, BUTTON: true, IMG: true };
      var eventListener = function (event) {
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

    states:  {
      initial: function (message) {
        var cube = this.cube;
        var info = message || t("view_info");

        cube.src = RemoteStorage.Assets.remoteStorageIcon;

        this._renderTranslatedInitialContent();

        if (message) {
          cube.src = RemoteStorage.Assets.remoteStorageIconError;
          removeClass(this.cube, 'remotestorage-loading');
          this.showBubble();

          // Show the red error cube for 5 seconds, then show the normal orange one again
          setTimeout(function (){
            cube.src = RemoteStorage.Assets.remoteStorageIcon;
          },2000);
        } else {
          this.hideBubble();
        }
        this.div.className = "remotestorage-state-initial";

        if (this.userSecretKey) {
          delete this.userSecretKey;
        }

        // Google Drive and Dropbox icons
        var backends = 1;
        if (this._activateBackend('dropbox')) { backends += 1; }
        if (this._activateBackend('googledrive')) { backends += 1; }
        this.div.querySelector('.rs-bubble-text').style.paddingRight = backends*32+8+'px';

        // If address not empty connect button enabled
        var cb = this.div.querySelector('.connect');
        if (this.form.userAddress.value) {
          cb.removeAttribute('disabled');
        }

        var infoEl = this.div.querySelector('.rs-info-msg');
        infoEl.innerHTML = info;

        if (message) {
          infoEl.classList.add('remotestorage-error-info');
        } else {
          infoEl.classList.remove('remotestorage-error-info');
        }
      },

      authing: function () {
        this.div.removeEventListener('click', this.events.connect);
        this.div.className = "remotestorage-state-authing";
        this.div.querySelector('.rs-status-text').innerHTML = t("view_connecting", this.userAddress);
        addClass(this.cube, 'remotestorage-loading');
      },

      connected: function () {
        var cube = this.cube;
        this.div.className = "remotestorage-state-connected";
        this.div.querySelector('.userAddress').innerHTML = this.userAddress;
        cube.src = RemoteStorage.Assets.remoteStorageIcon;
        removeClass(cube, 'remotestorage-loading');

        if (this.cipher) {
          if (this.userSecretKey) {
            if (this.userSecretKeyError) {
              cube.src = RemoteStorage.Assets.remoteStorageIconError;
              addClass(this.div.querySelector('.remotestorage-connected'), 'remotestorage-cipher');
              addClass(this.div.querySelector('.remotestorage-invalid-key'), 'remotestorage-cipher-error');
              this.showBubble();

              // Show the red error cube for 5 seconds, then show the normal orange one again
              setTimeout(function (){
                cube.src = RemoteStorage.Assets.remoteStorageIcon;
              },5000);
            } else {
              removeClass(this.div.querySelector('.remotestorage-invalid-key'), 'remotestorage-cipher-error');
              cube.src = RemoteStorage.Assets.remoteStorageIconCiphered;
            }
          } else {
            addClass(this.div.querySelector('.remotestorage-connected'), 'remotestorage-cipher');
            this.showBubble();
          }
        }

        var icons = {
          googledrive: this.div.querySelector('.rs-googledrive'),
          dropbox: this.div.querySelector('.rs-dropbox')
        };
        icons.googledrive.style.display = icons.dropbox.style.display = 'none';
        if (icons[this.rs.backend]) {
          icons[this.rs.backend].style.display = 'inline-block';
          this.div.querySelector('.rs-bubble-text').style.paddingRight = 2*32+8+'px';
        } else {
          this.div.querySelector('.rs-bubble-text').style.paddingRight = 32+8+'px';
        }
      },

      ciphered: function () {
        this.div.querySelector('form.remotestorage-cipher-form').userSecretKey.value = '';
        removeClass(this.div.querySelector('.remotestorage-invalid-key'), 'remotestorage-cipher-error');
        removeClass(this.div.querySelector('.remotestorage-connected'), 'remotestorage-cipher');
        this.cube.src = RemoteStorage.Assets.remoteStorageIconCiphered;
        this.hideBubble();
      },

      notciphered: function () {
        this.cipher = false;
        removeClass(this.div.querySelector('.remotestorage-invalid-key'), 'remotestorage-cipher-error');
        removeClass(this.div.querySelector('.remotestorage-connected'), 'remotestorage-cipher');
        this.hideBubble();
      },

      busy: function () {
        this.div.className = "remotestorage-state-busy";
        addClass(this.cube, 'remotestorage-loading'); //TODO needs to be undone when is that neccesary
      },

      offline: function () {
        this.div.className = "remotestorage-state-offline";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconOffline;
        this.div.querySelector('.rs-status-text').innerHTML = t("view_offline");
      },

      error: function (err) {
        var errorMsg = err;
        this.div.className = "remotestorage-state-error";

        this.div.querySelector('.rs-bubble-text').innerHTML = '<strong>'+t('view_error_occured')+'</strong>';
        //FIXME I don't know what an DOMError is and my browser doesn't know too(how to handle this?)
        if (err instanceof Error /*|| err instanceof DOMError*/) {
          errorMsg = err.message + '\n\n' +
            err.stack;
        }
        this.div.querySelector('.rs-error-msg').textContent = errorMsg;
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.showBubble();
      },

      unauthorized: function () {
        this.div.className = "remotestorage-state-unauthorized";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.showBubble();
        this.div.addEventListener('click', this.events.connect);
      }
    },

    events: {
    /**
     * Event: connect
     *
     * Emitted when the connect button is clicked
     **/
      connect: function (event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('connect', this.div.querySelector('form.remotestorage-initial').userAddress.value);
      },

    /**
     * Event: secret-entered
     *
     * Emitted when the cipher button is clicked
     **/
      'secret-entered': function (event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('secret-entered', this.div.querySelector('form.remotestorage-cipher-form').userSecretKey.value);
      },

    /**
     * Event: secret-cancelled
     *
     * Emitted when the nocipher button is clicked
     **/
      'secret-cancelled': function (event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('secret-cancelled');
      },

      /**
       * Event: sync
       *
       * Emitted when the sync button is clicked
       **/
      sync: function (event) {
        stopPropagation(event);
        event.preventDefault();

        this._emit('sync');
      },

      /**
       * Event: disconnect
       *
       * Emitted when the disconnect button is clicked
       **/
      disconnect: function (event) {
        stopPropagation(event);
        event.preventDefault();
        this._emit('disconnect');
      },

      /**
       * Event: reset
       *
       * Emitted after crash triggers disconnect
       **/
      reset: function (event){
        event.preventDefault();
        var result = window.confirm(t('view_confirm_reset'));
        if (result){
          this._emit('reset');
        }
      },

      /**
       * Event: display
       *
       * Emitted when finished displaying the widget
       **/
      display : function (event) {
        if (event) {
          event.preventDefault();
        }
        this._emit('display');
      }
    },

    _renderTranslatedInitialContent: function () {
      this.div.querySelector('.rs-status-text').innerHTML = t("view_connect");
      this.div.querySelector('.remotestorage-reset').innerHTML = t("view_get_me_out");
      this.div.querySelector('.rs-error-plz-report').innerHTML = t("view_error_plz_report");
      this.div.querySelector('.remotestorage-unauthorized').innerHTML = t("view_unauthorized");
      this.div.querySelector('.remotestorage-invalid-key').innerHTML = t("view_invalid_key");
    },

    _activateBackend: function activateBackend(backendName) {
      var className = 'rs-' + backendName;
      if (this.rs.apiKeys[backendName]) {
        this.div.querySelector('.' + className).style.display = 'inline-block';
        return true;
      } else {
        this.div.querySelector('.' + className).style.display = 'none';
        return false;
      }
    }
  };

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
    var element = parent.querySelector('.' + className);
    if (typeof iconName !== 'undefined') {
      var img = element.querySelector('img');
      (img || element).src = RemoteStorage.Assets[iconName];
    }
    element.addEventListener('click', eventListener);
    return element;
  }

  function handleButtonState(event) {
    if (event.target.value) {
      event.target.nextElementSibling.removeAttribute('disabled');
    } else {
      event.target.nextElementSibling.setAttribute('disabled','disabled');
    }
  }
})(typeof(window) !== 'undefined' ? window : global);
