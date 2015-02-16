(function (window) {

  var hasLocalStorage;
  var LS_STATE_KEY = 'remotestorage:widget:state';

  // states allowed to immediately jump into after a reload.
  var VALID_ENTRY_STATES = {
    initial: true,
    connected: true,
    offline: true
  };

  /**
   * Class: RemoteStorage.Widget
   *
   * The widget controller that communicates with the view and listens to
   * its remoteStorage instance.
   *
   * While listening to the events emitted by its remoteStorage it sets
   * corresponding states of the view.
   *
   * - connected    ->  connected
   * - disconnected ->  initial
   * - connecting   ->  authing
   * - authing      ->  authing
   * - wire-busy    ->  busy
   * - wire-done    ->  connected
   * - error        ->  one of initial, offline, unauthorized, or error
   **/
  RemoteStorage.Widget = function (remoteStorage) {
    var self = this;
    var requestsToFlashFor = 0;

    // setting event listeners on rs events to put
    // the widget into corresponding states
    this.rs = remoteStorage;
    this.rs.remote.on('connected', stateSetter(this, 'connected'));
    this.rs.on('disconnected', stateSetter(this, 'initial'));
    this.rs.on('connecting', stateSetter(this, 'authing'));
    this.rs.on('authing', stateSetter(this, 'authing'));
    this.rs.on('error', errorsHandler(this));

    if (this.rs.remote) {
      this.rs.remote.on('wire-busy', function (evt) {
        if (flashFor(evt)) {
          requestsToFlashFor++;
          stateSetter(self, 'busy')();
        }
      });

      this.rs.remote.on('wire-done', function (evt) {
        if (flashFor(evt)) {
          requestsToFlashFor--;
        }
        if (requestsToFlashFor <= 0 && evt.success) {
          stateSetter(self, 'connected')();
        }
      });
    }

    if (hasLocalStorage) {
      var state = localStorage[LS_STATE_KEY];
      if (state && VALID_ENTRY_STATES[state]) {
        this._rememberedState = state;
      }
    }
  };

  RemoteStorage.Widget.prototype = {

    /**
    * Method: display
    *
    * Displays the widget via the view.display method
    *
    * Parameters:
    *
    *   options
    **/
    display: function (options) {
      if (typeof(options) === 'string') {
        options = { domID: options };
      } else if (typeof(options) === 'undefined') {
        options = {};
      }
      if (! this.view) {
        this.setView(new RemoteStorage.Widget.View(this.rs));
      }
      this.view.display(options);
      return this;
    },

    linkWidgetToSync: function () {
      if (typeof(this.rs.sync) === 'object' && typeof(this.rs.sync.sync) === 'function') {
        this.view.on('sync', this.rs.sync.sync.bind(this.rs.sync));
      } else {
        RemoteStorage.log('[Widget] typeof this.rs.sync check fail', this.rs.sync);
        setTimeout(this.linkWidgetToSync.bind(this), 1000);
      }
    },

    /**
    *  Method: setView(view)
    *
    *  Sets the view and initializes event listeners to react on
    *  widget (widget.view) events
    **/
    setView: function (view) {
      this.view = view;
      this.view.on('connect', function (options) {
        if (typeof(options) === 'string') {
          // options is simply a useraddress
          this.rs.connect(options);
        } else if (options.special) {
          this.rs[options.special].connect(options);
        }
      }.bind(this));

      this.view.on('secret-entered', function (secretKey) {
        this.view.setUserSecretKey(secretKey);
        stateSetter(this, 'ciphered')();
      }.bind(this));

      this.view.on('secret-cancelled', function () {
        stateSetter(this, 'notciphered')();
      }.bind(this));

      this.view.on('disconnect', this.rs.disconnect.bind(this.rs));

      this.linkWidgetToSync();
      try {
        this.view.on('reset', function (){
          var location = RemoteStorage.Authorize.getLocation();
          this.rs.on('disconnected', location.reload.bind(location));
          this.rs.disconnect();
        }.bind(this));
      } catch(e) {
        if (!(e.message && e.message.match(/Unknown event/))) { // ignored. (the 0.7 widget-view interface didn't have a 'reset' event)
          throw e;
        }
      }

      if (this._rememberedState) {
        setTimeout(stateSetter(this, this._rememberedState), 0);
        delete this._rememberedState;
      }
    }
  };

  /**
   * Method: displayWidget
   *
   * Same as <display>
   **/
  RemoteStorage.prototype.displayWidget = function (options) {
    return this.widget.display(options);
  };

  RemoteStorage.Widget._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    if (! remoteStorage.widget) {
      remoteStorage.widget = new RemoteStorage.Widget(remoteStorage);
    }
  };

  RemoteStorage.Widget._rs_supported = function (remoteStorage) {
    return typeof(document) !== 'undefined';
  };

  function stateSetter(widget, state) {
    RemoteStorage.log('[Widget] Producing stateSetter for', state);
    return function () {
      RemoteStorage.log('[Widget] Setting state', state, arguments);
      if (hasLocalStorage) {
        localStorage[LS_STATE_KEY] = state;
      }
      if (widget.view) {
        if (widget.rs.remote) {
          widget.view.setUserAddress(widget.rs.remote.userAddress);
        }
        widget.view.setState(state, arguments);
      } else {
        widget._rememberedState = state;
      }
    };
  }

  function errorsHandler(widget) {
    return function (error) {
      var s;
      if (error instanceof RemoteStorage.DiscoveryError) {
        console.error('Discovery failed', error, '"' + error.message + '"');
        s = stateSetter(widget, 'initial', [error.message]);
      } else if (error instanceof RemoteStorage.SyncError) {
        s = stateSetter(widget, 'offline', []);
      } else if (error instanceof RemoteStorage.Unauthorized) {
        s = stateSetter(widget, 'unauthorized');
      } else {
        RemoteStorage.log('[Widget] Unknown error');
        s = stateSetter(widget, 'error', [error]);
      }
      s.apply();
    };
  }

  function flashFor(evt) {
    if (evt.method === 'GET' && evt.isFolder) {
      return false;
    }
    return true;
  }
})(typeof(window) !== 'undefined' ? window : global);
