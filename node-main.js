global.XMLHttpRequest = require('xhr2');

const RemoteStorage = require('./src/remotestorage.js');

// TODO re-introduce fix (or verify it's obsolete)
// RemoteStorage.WireClient.readBinaryData = function (content, mimeType, callback) {
//   callback(content);
// };

module.exports = RemoteStorage;
