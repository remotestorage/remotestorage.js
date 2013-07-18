(function(window) {

  var haveLocalStorage;
  var LS_STATE_KEY = "remotestorage:widget:state";
  function stateSetter(widget, state) {
    return function() {
      if(haveLocalStorage) {
        localStorage[LS_STATE_KEY] = state;
      }
      if(widget.view) {
        if(widget.rs.remote) {
          widget.view.setUserAddress(widget.rs.remote.userAddress);
        }
        widget.view.setState(state, arguments);
      }
    };
  }
  function errorsHandler(widget){
    //decided to not store error state
    return function(error){
      if(error instanceof RemoteStorage.DiscoveryError) {
        console.log('discovery failed',  error, '"' + error.message + '"');
        widget.view.setState('initial', [error.message]);
      } else if(error instanceof RemoteStorage.SyncError) {
        widget.view.setState('offline', []);
      } else if(error instanceof RemoteStorage.Unauthorized){
        widget.view.setState('unauthorized')
      } else {
        widget.view.setState('error', [error]);
      }
    }
  }
  RemoteStorage.Widget = function(remoteStorage) {
    this.rs = remoteStorage;
    this.rs.on('ready', stateSetter(this, 'connected'));
    this.rs.on('disconnected', stateSetter(this, 'initial'));
    //this.rs.on('connecting', stateSetter(this, 'connecting'))
    this.rs.on('authing', stateSetter(this, 'authing'));
    this.rs.on('sync-busy', stateSetter(this, 'busy'));
    this.rs.on('sync-done', stateSetter(this, 'connected'));
    this.rs.on('error', errorsHandler(this) );
    if(haveLocalStorage) {
      var state = localStorage[LS_STATE_KEY] = state;
      if(state) {
        this._rememberedState = state;
      }
    }
  };

  RemoteStorage.Widget.prototype = {
    display: function(domID) {
      if(! this.view) {
        this.setView(new View(domID));
      }
      this.view.display.apply(this.view, arguments);
      return this;
    },

    setView: function(view) {
      this.view = view;
      this.view.on('connect', this.rs.connect.bind(this.rs));
      this.view.on('disconnect', this.rs.disconnect.bind(this.rs));
      this.view.on('sync', this.rs.sync.bind(this.rs));
      try {
        this.view.on('reset', function(){
          this.rs.on('disconnected', document.location.reload.bind(document.location))
          this.rs.disconnect()
        }.bind(this));
      } catch(e) {
        if(e.message && e.message.match(/Unknown event/)) {
          // ignored. (the 0.7 widget-view interface didn't have a 'reset' event)
        } else {
          throw e;
        }
      }

      if(this._rememberedState) {
        stateSetter(this, this._rememberedState)();
        delete this._rememberedState;
      }
    }
  };

  RemoteStorage.prototype.displayWidget = function(domID) {
    this.widget.display(domID);
  };

  RemoteStorage.Widget._rs_init = function(remoteStorage) {
    if(! remoteStorage.widget) {
      remoteStorage.widget = new RemoteStorage.Widget(remoteStorage);
    }
  };

  RemoteStorage.Widget._rs_supported = function(remoteStorage) {
    haveLocalStorage = 'localStorage' in window;
    return true;
  };
var cEl = document.createElement.bind(document);

  function gCl(parent, className) {
    return parent.getElementsByClassName(className)[0];
  }
  function gTl(parent, className) {
    return parent.getElementsByTagName(className)[0];
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

  function removeClass(el, className) {
    return el.classList.remove(className);
  }

  function addClass(el, className) {
    return el.classList.add(className);
  }

  function stop_propagation(event) {
    if(typeof(event.stopPropagation) == 'function') {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
  }


  function View() {
    if(typeof(document) === 'undefined') {
      throw "Widget not supported";
    }
    RemoteStorage.eventHandling(this,
                                'connect',
                                'disconnect',
                                'sync',
                                'display',
                                'reset');

    this.toggle_bubble = function(event) {
      if(this.bubble.className.search('hidden') < 0) {
        this.hide_bubble(event);
      } else {
        this.show_bubble(event);
      }
    }.bind(this);

    this.hide_bubble = function(){
      //console.log('hide bubble',this);
      addClass(this.bubble, 'hidden')
      document.body.removeEventListener('click', hide_bubble_on_body_click);
    }

    hide_bubble_on_body_click = function (event) {
      for(var p = event.target; p != document.body; p = p.parentElement) {
        if(p.id == 'remotestorage-widget') {
          return;
        }
      }
      this.hide_bubble();
    }.bind(this);

    this.show_bubble = function(event){
      //console.log('show bubble',this.bubble,event)
      removeClass(this.bubble, 'hidden');
      if(typeof(event) != 'undefined') {
         stop_propagation(event);
       }
      document.body.addEventListener('click', hide_bubble_on_body_click);
      gTl(this.bubble,'form').userAddress.focus();
    };


    this.display = function(domID) {

      if(typeof(this.widget) !== 'undefined')
        return this.widget;

      var element = cEl('div');
      var style = cEl('style');
      style.innerHTML = RemoteStorage.Assets.widgetCss;

      element.id = "remotestorage-widget";

      element.innerHTML = RemoteStorage.Assets.widget;


      element.appendChild(style);
      if(domID) {
        var parent = document.getElementById(domID);
        if(! parent) {
          throw "Failed to find target DOM element with id=\"" + domID + "\"";
        }
        parent.appendChild(element);
      } else {
        document.body.appendChild(element);
      }

      var el;
      //sync button
      el = gCl(element, 'sync');
      gTl(el, 'img').src = RemoteStorage.Assets.syncIcon;
      el.addEventListener('click', this.events.sync.bind(this));

      //disconnect button
      el = gCl(element, 'disconnect');
      gTl(el, 'img').src = RemoteStorage.Assets.disconnectIcon;
      el.addEventListener('click', this.events.disconnect.bind(this));


      //get me out of here
      var el = gCl(element, 'remotestorage-reset').addEventListener('click', this.events.reset.bind(this));
      //connect button
      var cb = gCl(element,'connect');
      gTl(cb, 'img').src = RemoteStorage.Assets.connectIcon;
      cb.addEventListener('click', this.events.connect.bind(this));


      // input
      this.form = gTl(element, 'form')
      el = this.form.userAddress;
      el.addEventListener('keyup', function(event) {
        if(event.target.value) cb.removeAttribute('disabled');
        else cb.setAttribute('disabled','disabled');
      });
      if(this.userAddress) {
        el.value = this.userAddress;
      }

      //the cube
      el = gCl(element, 'cube');
      el.src = RemoteStorage.Assets.remoteStorageIcon;
      el.addEventListener('click', this.toggle_bubble);
      this.cube = el 

      //the bubble
      this.bubble = gCl(element,'bubble');
      // what is the meaning of this hiding the b
      var bubbleDontCatch = { INPUT: true, BUTTON: true, IMG: true };
      this.bubble.addEventListener('click', function(event) {
        if(! bubbleDontCatch[event.target.tagName] || this.div.classList.search('remotestorage-state-unauthorized')) {
          this.hide_bubble(event);
        };
      }.bind(this))
      this.hide_bubble();

      this.div = element;

      this.states.initial.call(this);
      this.events.display.call(this);
      return this.div;
    };

    this.setState = function(state, args) {
      //console.log('setState(',state,',',args,');');
      var s = this.states[state];
      if(typeof(s) === 'undefined') {
        throw new Error("Bad State assigned to view: " + state);
      }
      s.apply(this,args);
    };

    this.setUserAddress = function(addr) {
      this.userAddress = addr;

      var el;
      if(this.div && (el = gTl(this.div, 'form').userAddress)) {
        el.value = this.userAddress;
      }
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
      initial : function(message) {
        var cube = this.cube;
        var info = message || 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/" target="_blank">remotestorage.io';
        if(message) {
          cube.src = RemoteStorage.Assets.remoteStorageIconError;
          removeClass(this.cube, 'remotestorage-loading');
          this.show_bubble();
          setTimeout(function(){
            cube.src = RemoteStorage.Assets.remoteStorageIcon;
          },3512)
        } else {
          this.hide_bubble();
        }
        this.div.className = "remotestorage-state-initial";
        gCl(this.div, 'status-text').innerHTML = "Connect <strong>remotestorage</strong>";

        //if address not empty connect button enabled
        //TODO check if this works
        var cb = gCl(this.div, 'connect')
        if(cb.value)
          cb.removeAttribute('disabled');
        
        var infoEl = gCl(this.div, 'info');
        infoEl.innerHTML = info;

        if(message) {
          infoEl.classList.add('remotestorage-error-info');
        } else {
          infoEl.classList.remove('remotestorage-error-info');
        }

      },
      authing : function() {
        this.div.removeEventListener('click', this.events.connect);
        this.div.className = "remotestorage-state-authing";
        gCl(this.div, 'status-text').innerHTML = "Connecting <strong>"+this.userAddress+"</strong>";
        addClass(this.cube, 'remotestorage-loading'); //TODO needs to be undone, when is that neccesary
      },
      connected : function() {
        this.div.className = "remotestorage-state-connected";
        gCl(this.div, 'userAddress').innerHTML = this.userAddress;
        this.cube.src = RemoteStorage.Assets.remoteStorageIcon;
        removeClass(this.cube, 'remotestorage-loading');
      },
      busy : function() {
        this.div.className = "remotestorage-state-busy";
        addClass(this.cube, 'remotestorage-loading'); //TODO needs to be undone when is that neccesary
        this.hide_bubble();
      },
      offline : function() {
        this.div.className = "remotestorage-state-offline";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconOffline;
        gCl(this.div, 'status-text').innerHTML = 'Offline';
      },
      error : function(err) {
        var errorMsg = err;
        this.div.className = "remotestorage-state-error";

        gCl(this.div, 'bubble-text').innerHTML = '<strong> Sorry! An error occured.</strong>'
        if(err instanceof Error) {
          errorMsg = err.message + '\n\n' +
            err.stack;
        }
        gCl(this.div, 'error-msg').textContent = errorMsg;
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.show_bubble();
      },
      unauthorized : function() {
        this.div.className = "remotestorage-state-unauthorized";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.show_bubble();
        this.div.addEventListener('click', this.events.connect.bind(this));
      }
    },
    events : {
      connect : function(event) {
        stop_propagation(event);
        event.preventDefault();
        this._emit('connect', gTl(this.div, 'form').userAddress.value);
      },
      sync : function(event) {
        stop_propagation(event);
        event.preventDefault();
        
        this._emit('sync');
      },
      disconnect : function(event) {
        stop_propagation(event);
        event.preventDefault();
        this._emit('disconnect');
      },
      reset : function(event){
        event.preventDefault();
        var result = window.confirm("Are you sure you want to reset everything? That will probably make the error go away, but also clear your entire localStorage and reload the page. Please make sure you know what you are doing, before clicking 'yes' :-)");
        if(result){
          this._emit('reset');
        }
      },
      display : function(event) {
        if(event)
          event.preventDefault();
        this._emit('display');
      }
    }
  };


})(this);
