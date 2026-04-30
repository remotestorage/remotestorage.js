/**
 * The default config, merged with the object passed to the constructor of the
 * RemoteStorage object
 */
const config = {
  cache: true,
  changeEvents: {
    local:    true,
    window:   false,
    remote:   true,
    conflict: true
  },
  cordovaRedirectUri: undefined,
  discovery: {
    // Allow WebFinger discovery to target localhost / private-IP hosts. Set to
    // false in non-browser embedders that want the SSRF guard back.
    allowPrivateAddresses: true,
    // WebFinger lookup timeout, in milliseconds.
    timeout: 5000
  },
  logging: false,
  modules: [],
  // the following are not public and will probably be moved away from the
  // default config
  backgroundSyncInterval: 60000,
  disableFeatures: [],
  isBackground: false,
  requestTimeout: 30000,
  syncInterval: 10000
};

export = config;
