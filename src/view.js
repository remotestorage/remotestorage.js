(function(window){


  //
  // helper methods
  //
  var cEl = document.createElement.bind(document);
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
    if(typeof(event.stopPropagation) == 'function') {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
  }


  RemoteStorage.Widget.View = function() {
    if(typeof(document) === 'undefined') {
      throw "Widget not supported";
    }
    RemoteStorage.eventHandling(this,
                                'connect',
                                'disconnect',
                                'sync',
                                'display',
                                'reset');

    // re-binding the event so they can be called from the window
    for(var event in this.events){
      this.events[event] = this.events[event].bind(this);
    }


    // bubble toggling stuff
    this.toggle_bubble = function(event) {
      if(this.bubble.className.search('rs-hidden') < 0) {
        this.hide_bubble(event);
      } else {
        this.show_bubble(event);
      }
    }.bind(this);

    this.hide_bubble = function(){
      //console.log('hide bubble',this);
      addClass(this.bubble, 'rs-hidden')
      document.body.removeEventListener('click', hide_bubble_on_body_click);
    }.bind(this);

    var hide_bubble_on_body_click = function (event) {
      for(var p = event.target; p != document.body; p = p.parentElement) {
        if(p.id == 'remotestorage-widget') {
          return;
        }
      }
      this.hide_bubble();
    }.bind(this);

    this.show_bubble = function(event){
      //console.log('show bubble',this.bubble,event)
      removeClass(this.bubble, 'rs-hidden');
      if(typeof(event) != 'undefined') {
         stop_propagation(event);
       }
      document.body.addEventListener('click', hide_bubble_on_body_click);
      gTl(this.bubble,'form').userAddress.focus();
    }.bind(this);


    this.display = function(domID) {

      if(typeof(this.div) !== 'undefined')
        return this.div;

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
      el = gCl(element, 'rs-sync');
      gTl(el, 'img').src = RemoteStorage.Assets.syncIcon;
      el.addEventListener('click', this.events.sync);

      //disconnect button
      el = gCl(element, 'rs-disconnect');
      gTl(el, 'img').src = RemoteStorage.Assets.disconnectIcon;
      el.addEventListener('click', this.events.disconnect);


      //get me out of here
      var el = gCl(element, 'remotestorage-reset').addEventListener('click', this.events.reset);
      //connect button
      var cb = gCl(element,'connect');
      gTl(cb, 'img').src = RemoteStorage.Assets.connectIcon;
      cb.addEventListener('click', this.events.connect);


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
      el = gCl(element, 'rs-cube');
      el.src = RemoteStorage.Assets.remoteStorageIcon;
      el.addEventListener('click', this.toggle_bubble);
      this.cube = el

      //the bubble
      this.bubble = gCl(element,'rs-bubble');
      // what is the meaning of this hiding the b
      var bubbleDontCatch = { INPUT: true, BUTTON: true, IMG: true };
      this.bubble.addEventListener('click', function(event) {
        if(! bubbleDontCatch[event.target.tagName] && ! (this.div.classList.contains('remotestorage-state-unauthorized') )) {

          this.show_bubble(event);
        };
      }.bind(this))
      this.hide_bubble();

      this.div = element;

      this.states.initial.call(this);
      this.events.display.call(this);
      return this.div;
    };

  }

  RemoteStorage.Widget.View.prototype = {

    // Methods:
    //
    //  display(domID)
    //    draws the widget inside of the dom element with the id domID
    //   returns: the widget div
    //
    //  showBubble()
    //    shows the bubble
    //  hideBubble()
    //    hides the bubble
    //  toggleBubble()
    //    shows the bubble when hidden and the other way around
    //
    //  setState(state, args)
    //    calls states[state]
    //    args are the arguments for the
    //    state(errors mostly)
    //
    // setUserAddres
    //    set userAddress of the input field
    //
    // States:
    //  initial      - not connected
    //  authing      - in auth flow
    //  connected    - connected to remote storage, not syncing at the moment
    //  busy         - connected, syncing at the moment
    //  offline      - connected, but no network connectivity
    //  error        - connected, but sync error happened
    //  unauthorized - connected, but request returned 401
    //
    // Events:
    // connect    : fired when the connect button is clicked
    // sync       : fired when the sync button is clicked
    // disconnect : fired when the disconnect button is clicked
    // reset      : fired after crash triggers disconnect
    // display    : fired when finished displaying the widget
    setState : function(state, args) {
      RemoteStorage.log('widget.view.setState(',state,',',args,');');
      var s = this.states[state];
      if(typeof(s) === 'undefined') {
        throw new Error("Bad State assigned to view: " + state);
      }
      s.apply(this,args);
    },
    setUserAddress : function(addr) {
      this.userAddress = addr || '';

      var el;
      if(this.div && (el = gTl(this.div, 'form').userAddress)) {
        el.value = this.userAddress;
      }
    },

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
          },5000)//show the red error cube for 5 seconds, then show the normal orange one again
        } else {
          this.hide_bubble();
        }
        this.div.className = "remotestorage-state-initial";
        gCl(this.div, 'rs-status-text').innerHTML = "Connect <strong>remotestorage</strong>";

        //if address not empty connect button enabled
        //TODO check if this works
        var cb = gCl(this.div, 'connect')
        if(cb.value)
          cb.removeAttribute('disabled');

        var infoEl = gCl(this.div, 'rs-info-msg');
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
        gCl(this.div, 'rs-status-text').innerHTML = "Connecting <strong>"+this.userAddress+"</strong>";
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
        gCl(this.div, 'rs-status-text').innerHTML = 'Offline';
      },
      error : function(err) {
        var errorMsg = err;
        this.div.className = "remotestorage-state-error";

        gCl(this.div, 'rs-bubble-text').innerHTML = '<strong> Sorry! An error occured.</strong>'
        if(err instanceof Error /*|| err instanceof DOMError*/) { //I don't know what an DOMError is and my browser doesn't know too(how to handle this?)
          errorMsg = err.message + '\n\n' +
            err.stack;
        }
        gCl(this.div, 'rs-error-msg').textContent = errorMsg;
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.show_bubble();
      },
      unauthorized : function() {
        this.div.className = "remotestorage-state-unauthorized";
        this.cube.src = RemoteStorage.Assets.remoteStorageIconError;
        this.show_bubble();
        this.div.addEventListener('click', this.events.connect);
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
})(typeof(window) !== 'undefined' ? window : global);
