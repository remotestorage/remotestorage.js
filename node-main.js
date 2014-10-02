(function (global) {
  global.XMLHttpRequest = require('xhr2');
  global.Promise = require('bluebird');
  require('./lib/bluebird-defer.js');

  global.RemoteStorage = require('./src/remotestorage.js');
  require('./src/util.js');
  require('./src/eventhandling.js');
  require('./src/wireclient.js');
  require('./src/discover.js');
  require('./src/cachinglayer.js');
  require('./src/indexeddb.js');
  require('./src/inmemorystorage.js');
  require('./src/localstorage.js');
  require('./src/sync.js');
  require('./src/access.js');
  require('./src/caching.js');
  require('./src/modules.js');
  require('./src/baseclient.js');
  require('./src/baseclient/types.js');
  require('./src/i18n.js');
  require('./src/env.js');
  require('./src/googledrive.js');
  require('./src/dropbox.js');
  require('./src/nodejs_ext.js');

  RemoteStorage.WireClient.readBinaryData = function (content, mimeType, callback) {
    callback(content);
  };

  module.exports = RemoteStorage;

}(global));