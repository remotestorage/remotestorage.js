'use strict';

import WebFinger from 'webfinger.js';
import type { StorageInfo } from './interfaces/storage_info';
import config from './config';
import log from './log';
import { globalContext, localStorageAvailable } from './util';

// feature detection flags
let hasLocalStorage;

// used to store settings in localStorage
const SETTINGS_KEY = 'remotestorage:discover';

// cache loaded from localStorage
// TODO use class property
let cachedInfo = {};

/**
 * This function deals with the Webfinger lookup, discovering a connecting
 * user's storage details.
 *
 * @param userAddress - user@host or URL
 *
 * @returns A promise for an object with the following properties.
 *          href - Storage base URL,
 *          storageApi - RS protocol version,
 *          authUrl - OAuth URL,
 *          properties - Webfinger link properties
 **/

const Discover = function Discover(userAddress: string): Promise<StorageInfo> {
  if (userAddress in cachedInfo) {
    return Promise.resolve(cachedInfo[userAddress]);
  }

  const webFinger = new WebFinger({
    tls_only: false,
    uri_fallback: true,
    request_timeout: config.discoveryTimeout,
    // Defaults to true (see config.ts) so that browser apps can discover
    // localhost / LAN remoteStorage servers, since the same-origin policy /
    // CORS already gate cross-origin requests there. Non-browser embedders
    // can opt back into webfinger.js v3's SSRF guard via
    // `new RemoteStorage({ discoveryAllowPrivateAddresses: false })`.
    allow_private_addresses: config.discoveryAllowPrivateAddresses
  });

  let timer;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('timed out'));
    }, config.discoveryTimeout);
  });

  return Promise.race([
    webFinger.lookup(userAddress),
    timeoutPromise
  ]).then(response => {
    clearTimeout(timer);

    if ((typeof response.idx.links.remotestorage !== 'object') ||
        (typeof response.idx.links.remotestorage.length !== 'number') ||
        (response.idx.links.remotestorage.length <= 0)) {
      log("[Discover] WebFinger record for " + userAddress + " does not have remotestorage defined in the links section ", JSON.stringify(response.object));
      throw new Error("WebFinger record for " + userAddress + " does not have remotestorage defined in the links section.");
    }

    const rs = response.idx.links.remotestorage[0];
    const properties = rs.properties || {};
    const authURL    = properties['http://tools.ietf.org/html/rfc6749#section-4.2'] ||
                       properties['auth-endpoint'];
    const storageApi = properties['http://remotestorage.io/spec/version'] ||
                       rs.type;

    cachedInfo[userAddress] = {
      href: rs.href,
      storageApi,
      authURL,
      properties
    };

    if (hasLocalStorage) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ cache: cachedInfo }));
    }

    return cachedInfo[userAddress];
  }).catch(err => {
    clearTimeout(timer);
    throw err;
  });
};

Discover.DiscoveryError = function(message) {
  this.name = 'DiscoveryError';
  this.message = message;
  this.stack = (new Error()).stack;
};
Discover.DiscoveryError.prototype = Object.create(Error.prototype);
Discover.DiscoveryError.prototype.constructor = Discover.DiscoveryError;

Discover._rs_init = function (/*remoteStorage*/): void {
  hasLocalStorage = localStorageAvailable();
  if (hasLocalStorage) {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (settings) { cachedInfo = settings.cache; }
  }
};

Discover._rs_supported = function (): boolean {
  return Object.prototype.hasOwnProperty.call(globalContext, 'fetch') ||
         Object.prototype.hasOwnProperty.call(globalContext, 'XMLHttpRequest');
};

Discover._rs_cleanup = function (): void {
  if (hasLocalStorage) {
    localStorage.removeItem(SETTINGS_KEY);
  }
};

export = Discover;
