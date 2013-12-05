(function(window){

  var viewState = "initial";
  //
  // Helper methods
  //
  var cEl = function(){
    return document.createElement.apply(document, arguments);
  };

  function gCl(parent, className) {
    return parent.getElementsByClassName(className)[0];
  }

  function gTl(parent, className) {
    return parent.getElementsByTagName(className)[0];
  }

  function removeClass(el, className) {
    return el.classList.remove(className);
  }

  function addClass(el, className) {
    return el.classList.add(className);
  }

  function stop_propagation(event) {
    if (typeof(event.stopPropagation) === 'function') {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
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
                                'reset',
                                'update');

    // Re-binding the event so they can be called from the window
    for (var event in this.events){
      this.events[event] = this.events[event].bind(this);
    }

    /**
    *  toggleBubble()
    *    shows the bubble when hidden and the other way around
    **/
    this.toggle_bubble = function(event) {
      if (this.bubble.className.search('rs-hidden') < 0) {
        this.hide_bubble(event);
      } else {
        this.show_bubble(event);
      }
    }.bind(this);

    /**
     *  hideBubble()
     *   hides the bubble
     **/
    this.hide_bubble = function(){
      addClass(this.bubble, 'rs-hidden');
      document.body.removeEventListener('click', hide_bubble_on_body_click);
    }.bind(this);

    var hide_bubble_on_body_click = function (event) {
      for (var p = event.target; p !== document.body; p = p.parentElement) {
        if (p.id === 'remotestorage-widget') {
          return;
        }
      }
      this.hide_bubble();
    }.bind(this);

    /**
     * Method: showBubble()
     *   shows the bubble
     **/
    this.show_bubble = function(event){
      //console.log('show bubble',this.bubble,event)
      removeClass(this.bubble, 'rs-hidden');
      if (typeof(event) !== 'undefined') {
        stop_propagation(event);
      }
      document.body.addEventListener('click', hide_bubble_on_body_click);
      gTl(this.bubble,'form').userAddress.focus();
    }.bind(this);

     /**
     * Method: display(domID)
     *   draws the widget inside of the dom element with the id domID
     *   returns: the widget div
     **/
    this.display = function(domID) {
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

      var el;

      // Sync button
      el = gCl(element, 'rs-sync');
      gTl(el, 'img').src = RemoteStorage.Assets.syncIcon;
      el.addEventListener('click', this.events.sync);

      // Disconnect button
      el = gCl(element, 'rs-disconnect');
      gTl(el, 'img').src = RemoteStorage.Assets.disconnectIcon;
      el.addEventListener('click', this.events.disconnect);

      // Get me out of here
      el = gCl(element, 'remotestorage-reset').addEventListener('click', this.events.reset);

      // Connect button
      var cb = gCl(element,'connect');
      gTl(cb, 'img').src = RemoteStorage.Assets.connectIcon;
      cb.addEventListener('click', this.events.connect);

      // Input
      this.form = gTl(element, 'form');
      el = this.form.userAddress;
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
      el = gCl(element, 'rs-cube');
      el.src = RemoteStorage.Assets.remoteStorageIcon;
      el.addEventListener('click', this.toggle_bubble);
      this.cube = el;

      // Google Drive and Dropbox icons
      el = gCl(element, 'rs-dropbox');
      el.src = RemoteStorage.Assets.dropbox;
      el.addEventListener('click', this.connectDropbox.bind(this) );

      el = gCl(element, 'rs-googledrive');
      el.src = RemoteStorage.Assets.googledrive;
      el.addEventListener('click', this.connectGdrive.bind(this));

      this.bubble = gCl(element,'rs-bubble');
      //FIXME What is the meaning of this hiding the b
      var bubbleDontCatch = { INPUT: true, BUTTON: true, IMG: true };
      this.bubble.addEventListener('click', function(event) {
        if (! bubbleDontCatch[event.target.tagName] && ! (this.div.classList.contains('remotestorage-state-unauthorized') )) {
          this.show_bubble(event);
        }
      }.bind(this));
      this.hide_bubble();

      this.div = element;

      this.states.initial.call(this);
      this.events.display.call(this);
      return this.div;
    };
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
      this._emit('update', {oldState: viewState, newState: state});
      viewState = state;
    },
    getState: function() {
      return viewState;
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

    states:  {
      initial: function(message) {
        var cube = this.cube;
        var info = message || 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/" target="_blank">remotestorage.io';
        if (message) {
          cube.src = RemoteStorage.Assets.remoteStorageIconError;
          removeClass(this.cube, 'remotestorage-loading');
          this.show_bubble();

          // Show the red error cube for 5 seconds, then show the normal orange one again
          setTimeout(function(){
            cube.src = RemoteStorage.Assets.remoteStorageIcon;
          },5000);
        } else {
          this.hide_bubble();
        }
        this.div.className = "remotestorage-state-initial";
        gCl(this.div, 'rs-status-text').innerHTML = "<strong>Connect</strong> remote storage";

        // Google Drive and Dropbox icons
        var backends = 1;
        if (! this.rs.apiKeys.dropbox) {
          gCl(this.div,'rs-dropbox').style.display = 'none';
        } else {
          gCl(this.div,'rs-dropbox').style.display = 'inline-block';
          backends += 1;
        }
        if (! this.rs.apiKeys.googledrive) {
          gCl(this.div,'rs-googledrive').style.display = 'none';
        } else {
          gCl(this.div,'rs-googledrive').style.display = 'inline-block';
          backends += 1;
        }
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
        gCl(this.div, 'rs-status-text').innerHTML = "Connecting <strong>"+this.userAddress+"</strong>";
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
        this.hide_bubble();
      },

      offline: function() {
        this.div.className = "remotestorage-state-offline";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconOffline;
        gCl(this.div, 'rs-status-text').innerHTML = 'Offline';
      },

      error: function(err) {
        var errorMsg = err;
        this.div.className = "remotestorage-state-error";

        gCl(this.div, 'rs-bubble-text').innerHTML = '<strong> Sorry! An error occured.</strong>';
        //FIXME I don't know what an DOMError is and my browser doesn't know too(how to handle this?)
        if (err instanceof Error /*|| err instanceof DOMError*/) {
          errorMsg = err.message + '\n\n' +
            err.stack;
        }
        gCl(this.div, 'rs-error-msg').textContent = errorMsg;
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.show_bubble();
      },

      unauthorized: function() {
        this.div.className = "remotestorage-state-unauthorized";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.show_bubble();
        this.div.addEventListener('click', this.events.connect);
      }
    },

    events: {
    /**
     * Event: connect
     * emitted when the connect button is clicked
     **/
      connect: function(event) {
        stop_propagation(event);
        event.preventDefault();
        this._emit('connect', gTl(this.div, 'form').userAddress.value);
      },

      /**
       * Event: sync
       * emitted when the sync button is clicked
       **/
      sync: function(event) {
        stop_propagation(event);
        event.preventDefault();

        this._emit('sync');
      },

      /**
       * Event: disconnect
       * emitted when the disconnect button is clicked
       **/
      disconnect: function(event) {
        stop_propagation(event);
        event.preventDefault();
        this._emit('disconnect');
      },

      /**
       * Event: reset
       * fired after crash triggers disconnect
       **/
      reset: function(event){
        event.preventDefault();
        var result = window.confirm("Are you sure you want to reset everything? That will probably make the error go away, but also clear your entire localStorage and reload the page. Please make sure you know what you are doing, before clicking 'yes' :-)");
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
    }
  };
})(typeof(window) !== 'undefined' ? window : global);
