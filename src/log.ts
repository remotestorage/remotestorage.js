import * as config from './config';

/**
 * Log using console.log, when remoteStorage logging is enabled.
 *
 * You can enable logging with ``RemoteStorage#enableLog``.
 *
 * (In node.js you can also enable logging during remoteStorage object
 * creation. See: {@link RemoteStorage}).
 */
export default function log(...args: any): void {
  if (config.logging) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

module.exports = log;
