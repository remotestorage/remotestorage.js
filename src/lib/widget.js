define([
  './util',
  './webfinger',
  './wireClient',
  './sync',
  './store',
  './schedule',
  './baseClient',
  './platform',
  './getputdelete',
  './widget/default'
], function(util, webfinger, wireClient, sync, store, schedule, BaseClient,
            platform, getputdelete, defaultView) {

  // Namespace: widget
  //
  // The remoteStorage widget.
  //
  // See <remoteStorage.displayWidget>
  //
  //
  // Event: ready
  //   Fired when the user has connected and the initial synchronization
  //   has been performed. After this has fired your app can query and
  //   display data.
  //
  // Event: disconnect
  //   Fired when the user has clicked the 'disconnect' button and all
  //   locally cached data has been removed. At this point your app should
  //   remove all visible user-owned data from the screen and return to
  //   it's initial state.
  //
  // Event: state
  //   Fired whenever the internal state of the widget changes.
  //   Apps usually don't need to use this event, it is only included
  //   for debugging purposes and legacy support.
  //
  //   Parameters:
  //     state - A String. The new state the widget moved into.
  //


  "use strict";

  var settings = util.getSettingStore('remotestorage_widget');
  var events = util.getEventEmitter('ready', 'disconnect', 'state');
  var logger = util.getLogger('widget');

  var maxTimeout = 45000;
  var timeoutAdjustmentFactor = 1.5;

  // the view.
  var view = defaultView;
  // options passed to displayWidget
  var widgetOptions = {};
  // passed to display() to avoid circular deps
  var remoteStorage;

  var reconnectInterval = 1000;

  var offlineTimer = null;

  var viewState;

  function calcReconnectInterval() {
    var i = reconnectInterval;
    if(reconnectInterval < 10000) {
      reconnectInterval *= 2;
    }
    return i;
  }

  var stateActions = {
    offline: function() {
      if(! offlineTimer) {
        offlineTimer = setTimeout(function() {
          offlineTimer = null;
          sync.fullSync().
            then(function() {
              schedule.enable();
            });
        }, calcReconnectInterval());
      }
    },
    connected: function() {
      if(offlineTimer) {
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }
    }
  };
  

  function setState(state) {
    if(state === viewState) {
      return;
    }
    viewState = state;
    var action = stateActions[state];
    if(action) {
      action.apply(null, arguments);
    }
    view.setState.apply(view, arguments);
    events.emit('state', state);    
  }

  function requestToken(authEndpoint) {
    logger.info('requestToken', authEndpoint);
    var redirectUri = (widgetOptions.redirectUri || view.getLocation());
    var state;
    var md = redirectUri.match(/^(.+)#(.*)$/);
    if(md) {
      redirectUri = md[1];
      state = md[2];
    }
    var clientId = util.hostNameFromUri(redirectUri);
    authEndpoint += authEndpoint.indexOf('?') > 0 ? '&' : '?';
    var params = [
      ['redirect_uri', redirectUri],
      ['client_id', clientId],
      ['scope', remoteStorage.access.scopeParameter],
      ['response_type', 'token']
    ];
    if(typeof(state) === 'string' && state.length > 0) {
      params.push(['state', state]);
    }
    authEndpoint += params.map(function(kv) {
      return kv[0] + '=' + encodeURIComponent(kv[1]);
    }).join('&');
    console.log('redirecting to', authEndpoint);
    return view.redirectTo(authEndpoint);
  }

  function connectStorage(userAddress) {
    settings.set('userAddress', userAddress);
    setState('authing');
    return webfinger.getStorageInfo(userAddress).
      then(remoteStorage.setStorageInfo, function(error) {
        if(error === 'timeout') {
          adjustTimeout();
        }
        setState((typeof(error) === 'string') ? 'typing' : 'error', error);
      }).
      then(function(storageInfo) {
        if(storageInfo) {
          requestToken(storageInfo.properties['auth-endpoint']);
          schedule.enable();
        }
      }, util.curry(setState, 'error'));
  }

  function reconnectStorage() {
    connectStorage(settings.get('userAddress'));
  }

  function disconnectStorage() {
    schedule.disable();
    remoteStorage.flushLocal();
    events.emit('state', 'disconnected');
    events.emit('disconnect');
  }

  // destructively parse query string from URI fragment
  function parseParams() {
    var md = view.getLocation().match(/^(.*?)#(.*)$/);
    var result = {};
    if(md) {
      var hash = md[2];
      hash.split('&').forEach(function(param) {
        var kv = param.split('=');
        if(kv[1]) {
          result[kv[0]] = decodeURIComponent(kv[1]);
        }
      });
      if(Object.keys(result).length > 0) {
        view.setLocation(md[1] + '#');
      }
    }
    return result; 
  }

  function processParams() {
    var params = parseParams();

    // Query parameter: access_token
    if(params.access_token) {
      wireClient.setBearerToken(params.access_token);
    }
    // Query parameter: remotestorage
    if(params.remotestorage) {
      view.setUserAddress(params.remotestorage);
      setTimeout(function() {
        if(wireClient.getState() !== 'connected') {
          connectStorage(params.remotestorage);
        }
      }, 0);
    } else {
      var userAddress = settings.get('userAddress');
      if(userAddress) {
        view.setUserAddress(userAddress);
      }
    }
    // Query parameter: state
    if(params.state) {
      view.setLocation(view.getLocation().split('#')[0] + '#' + params.state);
    }
  }

  function handleSyncError(error) {
    if(error.message === 'unauthorized') {
      setState('unauthorized');
    } else if(error.message === 'network error') {
      setState('offline', error);
    } else {
      setState('error', error);
    }
  }

  function adjustTimeout() {
    var t = getputdelete.getTimeout();
    if(t < maxTimeout) {
      t *= timeoutAdjustmentFactor;
      webfinger.setTimeout(t);
      getputdelete.setTimeout(t);
    }
  }

  function handleSyncTimeout() {
    adjustTimeout();
    schedule.disable();
    setState('offline');
  }

  function initialSync() {
    if(settings.get('initialSyncDone')) {
      store.fireInitialEvents().then(util.curry(events.emit, 'ready'));
    } else {
      setState('busy', true);
      sync.fullSync().then(function() {
        schedule.enable();
        settings.set('initialSyncDone', true);
        setState('connected');
        events.emit('ready');
      }, handleSyncError);
    }
  }

  function display(_remoteStorage, element, options) {
    remoteStorage = _remoteStorage;
    widgetOptions = options;
    if(! options) {
      options = {};
    }

    options.getLastSyncAt = function() {
      return (sync.lastSyncAt || new Date()).getTime();
    };

    schedule.watch('/', 30000);

    view.display(element, options);

    view.on('sync', sync.forceSync);
    view.on('connect', connectStorage);
    view.on('disconnect', disconnectStorage);
    view.on('reconnect', reconnectStorage);

    wireClient.on('busy', util.curry(setState, 'busy'));
    wireClient.on('unbusy', util.curry(setState, 'connected'));
    wireClient.on('connected', function() {
      setState('connected');
      initialSync();
    });
    wireClient.on('disconnected', util.curry(setState, 'initial'));

    BaseClient.on('error', util.curry(setState, 'error'));
    sync.on('error', handleSyncError);
    sync.on('timeout', handleSyncTimeout);

    processParams();

    wireClient.calcState();
  }
  
  return util.extend({
    display : display,

    clearSettings: settings.clear,

    setView: function(_view) {
      view = _view;
    }
  }, events);
});
