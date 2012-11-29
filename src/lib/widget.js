define([
  './assets',
  './webfinger',
  './wireClient',
  './sync',
  './store',
  './platform',
  './util',
  './schedule',
  '../vendor/mailcheck',
  '../vendor/levenshtein',
  './store/localStorage',
  './store/indexedDb',
  './widget/default'
  './BaseClient'
], function(assets, webfinger, wireClient, sync, store, platform, util, schedule, mailcheck, levenshtein, localStorageAdapter, indexedDbAdapter, defaultView, BaseClient) {

  // Namespace: widget
  //
  // The remotestorage widget.
  //
  // See <remoteStorage.displayWidget>
  //

  "use strict";

  var view = defaultView;
  var settings = util.getSettingStore('remotestorage_widget');
  var events = util.getEventEmitter();
  var logger = util.getLogger('widget');
  var widgetOptions = {};

  function buildScopeRequest() {
    return Object.keys(widgetOptions.scopes).map(function(module) {
      return module + ':' + widgetOptions.scopes[module];
    }).join(' ');
  }

  function requestToken(authEndpoint) {
    logger.info('requestToken', authEndpoint);
    authEndpoint += authEndpoint.indexOf('?') > 0 ? '&' : '?';
    authEndpoint += [
      ['redirect_uri', document.location.href.split('#')[0]],
      ['scope', buildScopeRequest()],
      ['response_type', 'token']
    ].map(function(kv) {
      return kv[0] + '=' + encodeURIComponent(kv[1]);
    }).join('&');
    return view.redirectTo(authEndpoint);
  }

  function connectStorage(userAddress) {
    settings.set('userAddress', userAddress);
    return webfinger.getStorageInfo(userAddress).
      then(wireClient.setStorageInfo).
      get('properties').get('auth-endpoint').
      then(requestToken).
      then(undefined, util.curry(view.setState, 'error'));
  }

  function disconnectStorage() {
    remoteStorage.flushLocal();
  }

  // destructively parse query string from URI fragment
  function parseParams() {
    var md = String(document.location).match(/^(.*?)#(.*)$/);
    var hash = md[2];
    var result = {};
    if(hash) {
      hash.split('&').forEach(function(param) {
        var kv = param.split('=');
        result[kv[0]] = decodeURIComponent(kv[1]);
      })
      document.location = md[1] + '#';
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

  function display(domId, options) {
    widgetOptions = options;
    if(! options) {
      options = {};
    }

    view.display(domId, options);

    view.on('sync', sync.forceSync);
    view.on('connect', connectStorage);
    view.on('disconnect', disconnectStorage);

    sync.on('busy', util.curry(view.setState, 'busy'));
    sync.on('ready', util.curry(view.setState, 'connected'));
    wireClient.on('connected', util.curry(view.setState, 'connected'));
    wireClient.on('disconnected', util.curry(view.setState, 'initial'));

    BaseClient.on('error', util.curry(view.setState, 'error'));
    sync.on('error', util.curry(view.setState, 'error'));

    processParams();

    wireClient.calcState();
  }
  
  return util.extend({
    display : display,

    clearSettings: settings.clear
  }, events);
});
