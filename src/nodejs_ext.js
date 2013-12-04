(function(global) {
  global.XMLHttpRequest = require('xhr2');

  RemoteStorage.WireClient.readBinaryData = function(content, mimeType, callback) {
    callback(content);
  };
}(global));
