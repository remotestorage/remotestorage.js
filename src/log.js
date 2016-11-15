// var RemoteStorage = require('./remotestorage');
var config = require('./config');

module.exports = function () {
  if (config.logging) {
    console.log.apply(console, arguments);
  }
};