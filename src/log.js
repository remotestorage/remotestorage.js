var config = require('./config');

/**
 * Method: log
 *
 * Log using console.log, when remoteStorage logging is enabled.
 *
 * You can enable logging with <enableLog>.
 *
 * (In node.js you can also enable logging during remoteStorage object
 * creation. See: <RemoteStorage>).
 */
function log() {
  if (config.logging) {
    console.log.apply(console, arguments);
  }
}

module.exports = log;