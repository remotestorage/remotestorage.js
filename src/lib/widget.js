define([
  './util',
  './webfinger',
  './wireClient',
  './sync',
  './schedule',
  './baseClient',
  './platform',
  './getputdelete',
  './widget/default'
], function(util, webfinger, wireClient, sync, schedule, BaseClient,
            platform, getputdelete, defaultView) {

  // Namespace: widget
  //
  // The remotestorage widget.
  //
  // See <remoteStorage.displayWidget>
  //

  "use strict";

  var settings = util.getSettingStore('remotestorage_widget');
  var events = util.getEventEmitter('ready', 'state');
  var logger = util.getLogger('widget');

  // the view.
  var view = defaultView;
  // options passed to displayWidget
  var widgetOptions = {};
  // passed to display() to avoid circular deps
  var remoteStorage;

  var reconnectInterval = 10000;

  var offlineTimer = null;

  var stateActions = {
    offline: function() {
      if(! offlineTimer) {
        offlineTimer = setTimeout(function() {
          offlineTimer = null;
          sync.fullSync();
        }, reconnectInterval);
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
    var action = stateActions[state];
    if(action) {
      action.apply(null, arguments);
    }
    view.setState.apply(view, arguments);
    events.emit('state', state);    
  }

  function buildScopeRequest() {
    var scopes = remoteStorage.claimedModules;
    return Object.keys(remoteStorage.claimedModules).map(function(module) {
      return (module === 'root' ? '' : module) + ':' + scopes[module];
    }).join(' ');
  }

  function requestToken(authEndpoint) {
    logger.info('requestToken', authEndpoint);
    var redirectUri = view.getLocation().split('#')[0];
    var clientId = util.hostNameFromUri(redirectUri);
    authEndpoint += authEndpoint.indexOf('?') > 0 ? '&' : '?';
    authEndpoint += [
      ['redirect_uri', redirectUri],
      ['client_id', clientId],
      ['scope', buildScopeRequest()],
      ['response_type', 'token']
    ].map(function(kv) {
      return kv[0] + '=' + encodeURIComponent(kv[1]);
    }).join('&');
    return view.redirectTo(authEndpoint);
  }

  function connectStorage(userAddress) {
    settings.set('userAddress', userAddress);
    setState('authing');
    return webfinger.getStorageInfo(userAddress).
      then(wireClient.setStorageInfo, util.curry(setState, 'typing')).
      get('properties').get('auth-endpoint').
      then(requestToken).
      then(schedule.enable, util.curry(setState, 'error'));
  }

  function reconnectStorage() {
    connectStorage(settings.get('userAddress'));
  }

  function disconnectStorage() {
    schedule.disable();
    remoteStorage.flushLocal();
    events.emit('state', 'disconnected');
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
    // Query parameter: storage_root, storage_api
    if(params.storage_root && params.storage_api) {
      wireClient.setStorageInfo({
        type: params.storage_api,
        href: params.storage_root
      });
    }
    // Query parameter: authorize_endpoint
    if(params.authorize_endpoint) {
      requestToken(params.authorize_endpoint);
    }
    // Query parameter: user_address
    if(params.user_address) {
      view.setUserAddress(params.user_address);
    } else {
      var userAddress = settings.get('userAddress');
      if(userAddress) {
        view.setUserAddress(userAddress);
      }
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

  function handleSyncTimeout() {
    schedule.disable();
    setState('offline');
  }

  function initialSync() {
    setState('busy', true);
    sync.forceSync().then(function() {
      schedule.enable();
      events.emit('ready');
    }, handleSyncError);
  }

  function display(_remoteStorage, domId, options) {
    remoteStorage = _remoteStorage;
    widgetOptions = options;
    if(! options) {
      options = {};
    }

    options.getLastSyncAt = function() {
      return sync.lastSyncAt && sync.lastSyncAt.getTime();
    };

    schedule.watch('/', 30000);

    view.display(domId, options);

    view.on('sync', sync.forceSync);
    view.on('connect', connectStorage);
    view.on('disconnect', disconnectStorage);
    view.on('reconnect', reconnectStorage);

    sync.on('busy', util.curry(setState, 'busy'));
    sync.on('ready', util.curry(setState, 'connected'));
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
