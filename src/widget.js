(function() {

  function stateSetter(widget, state) {
    return function() {
      if(widget.view) {
        if(widget.rs.remote) {
          widget.view.setUserAddress(widget.rs.remote.userAddress);
        }
        widget.view.setState(state);
      }
    };
  }

  RemoteStorage.Widget = function(remoteStorage) {
    this.rs = remoteStorage;
    this.rs.on('ready', stateSetter(this, 'connected'));
    this.rs.on('disconnected', stateSetter(this, 'initial'));
    //this.rs.on('connecting', stateSetter(this, 'connecting'))
    this.rs.on('authing', stateSetter(this, 'authing'));
    this.rs.on('sync-busy', stateSetter(this, 'busy'));
    this.rs.on('sync-done', stateSetter(this, 'connected'));
  };

  RemoteStorage.Widget.prototype = {
    display: function() {
      if(! this.view) {
        this.setView(new View());
      }
      this.view.display.apply(this.view, arguments);
      return this;
    },

    setView: function(view) {
      this.view = view;
      this.view.on('connect', this.rs.connect.bind(this.rs));
      this.view.on('disconnect', this.rs.disconnect.bind(this.rs));
      this.view.on('sync', this.rs.sync.bind(this.rs));
    }
  };

  RemoteStorage.prototype.displayWidget = function() {
    this.widget.display();
  };

  RemoteStorage.Widget._rs_init = function(remoteStorage) {
    remoteStorage.widget = new RemoteStorage.Widget(remoteStorage);
    window.addEventListener('load', function() {
      remoteStorage.displayWidget();
    });
  };

  var cEl = document.createElement.bind(document);

  function gCl(parent, className) {
    return parent.getElementsByClassName(className)[0];
  }
  function gTl(parent, className) {
    return parent.getElementsByTagName(className)[0];
  }

  function toggle_bubble(widget) {
    var el = gCl(widget,'bubble');
    if(el.className.search('hidden') < 0) {
      addClass(el, 'hidden');
    } else {
      removeClass(el, 'hidden');
      gTl(widget, 'form').userAddress.focus();
    }
  }

  function show(el, display) {
    if(typeof(display) === 'undefined') {
      display = 'block';
    }
    el.style.display = display;
    return el;
  }

  function hide(el) {
    show(el,'none');
    return el;
  }

  // MAYBE do those two in a el.className.split(' ') way more safe
  function removeClass(el, className) {
    el.className = el.className.split(' ').filter(function(val) {
      return val != className;
    }).join(' ');
  }

  function addClass(el, className) {
    el.className += ' ' + className;
  }


  function View() {
    if(typeof(document) === 'undefined') {
      throw "Widget not supported";
    }
    RemoteStorage.eventHandling(this,
                                'connect',
                                'disconnect',
                                'sync',
                                'reconnect',
                                'display');

    this.display = function() {

      if(typeof(this.widget) !== 'undefined')
        return this.widget;

      var element = cEl('div');
      var style = cEl('style');
      style.innerHTML = RemoteStorage.Assets.widgetCss;

      element.id = "remotestorage-widget";

      element.innerHTML = RemoteStorage.Assets.widget;


      element.appendChild(style);
      document.body.appendChild(element);

      var el;
      //sync button
      el = gCl(element, 'sync');
      gTl(el, 'img').src = RemoteStorage.Assets.syncIcon;
      el.addEventListener('click', this.events.sync.bind(this));

      //disconnect button
      el = gCl(element, 'disconnect');
      gTl(el, 'img').src = RemoteStorage.Assets.disconnectIcon;
      el.addEventListener('click', this.events.disconnect.bind(this));

      //connect button
      var cb = gCl(element,'connect');
      gTl(cb, 'img').src = RemoteStorage.Assets.connectIcon;
      cb.addEventListener('click', this.events.connect.bind(this));

      // input
      el = gTl(element, 'form').userAddress;
      el.addEventListener('keyup', function(event) {
        if(event.target.value) cb.removeAttribute('disabled');
        else cb.setAttribute('disabled','disabled');
      });

      //the cube
      el = gCl(element, 'cube');
      el.src = RemoteStorage.Assets.remoteStorageIcon;
      el.addEventListener('click', function() {
        toggle_bubble(this.div);
      }.bind(this));


      this.div = element;

      this.states.initial.call(this);
      this._emit('display');
      return this.div;
    };

    this.setState = function(state) {
      var s = this.states[state];
      if(typeof(s) === 'undefined') {
        throw new Error("Bad State assigned to view: " + state);
      }
      s.call(this);
    };

    this.setUserAddress = function(addr) {
      this.userAddress = addr;
    };
  }

  View.prototype = {
    // States:
    //  initial      - not connected
    //  authing      - in auth flow
    //  connected    - connected to remote storage, not syncing at the moment
    //  busy         - connected, syncing at the moment
    //  offline      - connected, but no network connectivity
    //  error        - connected, but sync error happened
    //  unauthorized - connected, but request returned 401
    currentState : 'initial',
    states :  {
      initial : function() {
        this.div.className = "remotestorage-state-initial";
        gCl(this.div, 'status-text').innerHTML = "Connect <strong>remotestorage</strong>";
      },
      authing : function() {
        this.div.className = "remotestorage-state-authing";
        gCl(this.div, 'status-text').innerHTML = "Connecting";
        addClass(gCl(this.div, 'cube'), 'remotestorage-loading'); //TODO needs to be undone when is that neccesary
      },
      connected : function() {
        this.div.className = "remotestorage-state-connected";
        gCl(this.div, 'userAddress').innerHTML = this.userAddress;
        var cube = gCl(this.div, 'cube');
        cube.src = RemoteStorage.Assets.remoteStorageIcon;
        removeClass(cube, 'remotestorage-loading');
      },
      busy : function() {
        this.div.className = "remotestorage-state-busy";
        addClass(gCl(this.div, 'cube'), 'remotestorage-loading'); //TODO needs to be undone when is that neccesary
      },
      offline : function() {
        this.div.className = "remotestorage-state-offline";
        gCl(this.div, 'cube').src = RemoteStorage.Assets.remoteStorageIconOffline;
      },
      error : function() {
        this.div.className = "remotestorage-state-error";
        gCl(this.div, 'cube').src = RemoteStorage.Assets.remoteStorageIconError;
      },
      unauthorized : function() {
        this.div.className = "remotestorage-state-unauthorized";
      }
    },
    events : {
      connect : function(event) {
        event.preventDefault();
        this._emit('connect', gTl(this.div, 'form').userAddress.value);
      },
      sync : function(event) {
        event.preventDefault();
        this._emit('sync');
      },
      disconnect : function(event) {
        event.preventDefault();
        this._emit('disconnect');
      },
      // FIXME: what are these???
      reconnect : function() {},
      display : function() {}
    }
  };

})();
