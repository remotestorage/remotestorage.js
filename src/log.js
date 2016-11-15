var RemoteStorage = require('./remotestorage');
console.log(RemoteStorage, 'log')

module.exports = function () {
  // if (RemoteStorage.config.logging) {
    console.log.apply(console, arguments);
  // }
};