'use strict';

const util = require('./util');
const log = require('./log');
const SyncedGetPutDelete = require('./syncedgetputdelete');

let featuresDone = 0;
let features = [];


const featureModules = {
  'WireClient': require('./wireclient'),
  'I18n': require('./i18n'),
  'Dropbox': require('./dropbox'),
  'GoogleDrive': require('./googledrive'),
  'Access': require('./access'),
  'Caching': require('./caching'),
  'Discover': require('./discover'),
  'Authorize': require('./authorize'),
  'IndexedDB': require('./indexeddb'),
  'LocalStorage': require('./localstorage'),
  'InMemoryStorage': require('./inmemorystorage'),
  'Sync': require('./sync'),
  'BaseClient': require('./baseclient'),
  'Env': require('./env')
};

function loadFeatures() {
	for (let featureName in featureModules) {
		// TOFIX this has to push the promised return value into an
		// array of promises and use Promise.all to emit `ready`
		// instead of increment a counter of loaded features.
		this.loadFeature(featureName)
	}
}

    /**
     * Method: hasFeature
     *
     * Checks whether a feature is enabled or not within remoteStorage.
     * Returns a boolean.
     *
     * Parameters:
     *   name - Capitalized name of the feature. e.g. Authorize, or IndexedDB
     *
     * Example:
     *   (start code)
     *   if (remoteStorage.hasFeature('LocalStorage')) {
     *     console.log('LocalStorage is enabled!');
     *   }
     *   (end code)
     *
     */
function hasFeature(feature) {
  for (var i = this.features.length - 1; i >= 0; i--) {
    if (this.features[i].name === feature) {
      return this.features[i].supported;
    }
  }
  return false;
}

function loadFeature(featureName) {
	const feature = featureModules[featureName];
	log(`[RemoteStorage] [FEATURE ${featureName}] initializing ...`);

	const supported = !feature._rs_supported || feature._rs_supported();
	if (typeof supported === 'object') {
		supported.then( () => {
			this.featureSupported(featureName, true);
			this.initFeature(featureName);
		}, () => {
			this.featureSupported(featureName, false);
		});
	} else if (typeof supported === 'boolean') {
		this.featureSupported(featureName, supported);
		if (supported) {
			this.initFeature(featureName);
		}
	} else {
		this.featureSupported(featureName, false);
	}
}

function initFeature(featureName) {
  const feature = featureModules[featureName]
  let initResult;
  try {
    initResult = feature._rs_init(this);
  } catch(e) {
    this.featureFailed(featureName, e);
    return;
  }

  if (typeof(initResult) === 'object' && typeof(initResult.then) === 'function') {
    initResult.then(
      () => { this.featureInitialized(featureName); },
      (err) => { this.featureFailed(featureName, err); }
    );
  } else {
    this.featureInitialized(featureName);
  }
}

function featureFailed(featureName, err) {
  log(`[RemoteStorage] [FEATURE ${featureName}] initialization failed (${err})`);
  this.featureDone();
}


function featureSupported(featureName, success) {
  log(`[RemoteStorage] [FEATURE ${featureName}]  ${success ? '' : ' not'} supported`);
  if (!success) {
  	this.featureDone()
  }
}

function featureInitialized(featureName) {
  log(`[RemoteStorage] [FEATURE ${featureName}] initialized.`);
  this.features.push({
    name : featureName,
    init :  featureModules[featureName]._rs_init,
    supported : true,
    cleanup : featureModules[featureName]._rs_cleanup
  });
  this.featureDone();
}

function featureDone () {
	featuresDone++;
	if (featuresDone === Object.keys(featureModules).length) {
		setTimeout(this.featuresLoaded.bind(this), 0);
	}
}

function _setCachingModule () {
  const cachingModules = ['IndexedDB', 'LocalStorage', 'InMemoryStorage'];

  cachingModules.some( cachingLayer => {
    if (this.features.some(feature => feature.name === cachingLayer)) {
      this.features.local = featureModules[cachingLayer];
      return true;
    }
  });
}


let readyFired = false;
function _fireReady() {
  try {
    if (!readyFired) {
      this._emit('ready');
      readyFired = true;
    }
  } catch(e) {
    console.error("'ready' failed: ", e, e.stack);
    this._emit('error', e);
  }
}	   

function featuresLoaded () {
	log(`[REMOTESTORAGE] All features loaded !`)
	
	this._setCachingModule()
  this.local = this.features.local && new this.features.local();

  // this.remote set by WireClient._rs_init as lazy property on
  // RS.prototype

  if (this.local && this.remote) {
    this._setGPD(SyncedGetPutDelete, this);
    this._bindChange(this.local);
  } else if (this.remote) {
    this._setGPD(this.remote, this.remote);
  }
  if (this.remote) {
    this.remote.on('connected', () => {
      this._fireReady();
      this._emit('connected');
    });
    this.remote.on('not-connected', () => {
      this._fireReady();
      this._emit('not-connected');
    });
    if (this.remote.connected) {
      this._fireReady();
      this._emit('connected');
    }

    if (!this.hasFeature('Authorize')) {
      this.remote.stopWaitingForToken();
    }
  }

  this._collectCleanupFunctions();

  try {
    this._allLoaded = true;
    this._emit('features-loaded');
  } catch(exc) {
    util.logError(exc);
    this._emit('error', exc);
  }
  this._processPending();
}

function _collectCleanupFunctions () {
  this._cleanups = [];
  for (var i=0; i < this.features.length; i++) {
    var cleanup = this.features[i].cleanup;
    if (typeof(cleanup) === 'function') {
      this._cleanups.push(cleanup);
    }
  }
}

module.exports = {
	features,
	loadFeature,
	initFeature,
	loadFeatures,
	featureSupported,
	featuresDone,
	featureDone,
	featuresLoaded,
	featureInitialized,
	featureFailed,
	featureSupported,
	hasFeature,
	_setCachingModule,
	_collectCleanupFunctions,
	_fireReady
}
