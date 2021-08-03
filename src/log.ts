import config from './config';

/**
 * Log using console.log, when remoteStorage logging is enabled.
 *
 * You can enable logging with ``RemoteStorage#enableLog``.
 *
 * (You can also enable logging during remoteStorage object creation. See:
 * {@link RemoteStorage}).
 */
function log(...args): void {
  if (config.logging) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

export = log;
