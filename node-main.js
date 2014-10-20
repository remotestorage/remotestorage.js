global.XMLHttpRequest = require('xhr2');
global.tv4 = require('tv4');
global.Promise = require('bluebird');
global.WebFinger = require('webfinger.js');
require('./lib/bluebird-defer.js');
require('./lib/Math.uuid.js');

global.RemoteStorage = require('./src/remotestorage.js');

var files = [
  './src/util.js',
  './src/eventhandling.js',
  './src/wireclient.js',
  './src/discover.js',
  './src/authorize.js',
  './src/cachinglayer.js',
  './src/indexeddb.js',
  './src/inmemorystorage.js',
  './src/localstorage.js',
  './src/sync.js',
  './src/access.js',
  './src/caching.js',
  './src/modules.js',
  './src/baseclient.js',
  './src/baseclient/types.js',
  './src/i18n.js',
  './src/env.js',
  './src/googledrive.js',
  './src/dropbox.js'
];

for (var i = 0, len = files.length; i < len; i += 1) {
  try {
    require(files[i]);
  } catch (e) {
    console.log('error loading ' + files[i] + ': ', e, e.stack);
    throw new Error(e);
  }
}


RemoteStorage.WireClient.readBinaryData = function (content, mimeType, callback) {
  callback(content);
};

module.exports = RemoteStorage;
