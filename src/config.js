/**
 * The default config, merged with the object passed to the constructor of the
 * RemoteStorage object
 */
var config = {
  // Enable remoteStorage logging
  logging: false,
  // Change Events that are enabled. See the BaseClient API for more information
  changeEvents: {
    local:    true,
    window:   false,
    remote:   true,
    conflict: true
  },
  // enable caching
  cache: true,
  // disable specified modules
  disableFeatures: [],
  // timeout for the Webfinger lookup, discovering a connecting user's storage details
  discoveryTimeout: 10000,
  // sync interval when the application is in the foreground
  syncInterval: 10000,
  // sync interval when the application is in the background
  backgroundSyncInterval: 60000,
  // initial value for the internal state of the app being in the background
  isBackground: false,
  // set a redirect URI for Cordova apps
  cordovaRedirectUri: undefined,
  // timeout for network requests
  requestTimeout: 30000,
  // extra ES6 modules to load
  modules: []
};

module.exports = config;
