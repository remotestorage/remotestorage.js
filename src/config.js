var config = {
	logging: false,
	changeEvents: {
      local:    true,
      window:   false,
      remote:   true,
      conflict: true
  },
  cache: true,
  disableFeatures: [],
  discoveryTimeout: 10000,
  syncInterval: 10000,
  backgroundSyncInterval: 60000,
  isBackground: false,
  cordovaRedirectUri: undefined
};

module.exports = config;