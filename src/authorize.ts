const log = require('./log');
import { localStorageAvailable, globalContext, toBase64 } from './util';
import UnauthorizedError from './unauthorized-error';

interface AuthResult {
  access_token?: string;
  rsDiscovery?: object;
  error?: string;
  remotestorage?: string;
  state?: string;
}

// This is set in _rs_init and needed for removal in _rs_cleanup
let onFeaturesLoaded;

function extractParams (url?: string): AuthResult {
  // FF already decodes the URL fragment in document.location.hash, so use this instead:
  const location = url || Authorize.getLocation().href;
  const hashPos  = location.indexOf('#');
  if (hashPos === -1) { return; }
  const urlFragment = location.substring(hashPos+1);
  // if hash is not of the form #key=val&key=val, it's probably not for us
  if (!urlFragment.includes('=')) { return; }

  return urlFragment.split('&').reduce(function(params, kvs) {
    const kv = kvs.split('=');

    if (kv[0] === 'state' && kv[1].match(/rsDiscovery/)) {
      // extract rsDiscovery data from the state param
      let stateValue = decodeURIComponent(kv[1]);
      const encodedData = stateValue.substr(stateValue.indexOf('rsDiscovery='))
                                  .split('&')[0]
                                  .split('=')[1];

      params['rsDiscovery'] = JSON.parse(atob(encodedData));

      // remove rsDiscovery param
      stateValue = stateValue.replace(new RegExp('&?rsDiscovery=' + encodedData), '');

      if (stateValue.length > 0) {
        params['state'] = stateValue;
      }
    } else {
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
    }

    return params;
  }, {});
}

function buildOAuthURL (authURL: string, redirectUri: string, scope: string, clientId: string): string {
  const hashPos = redirectUri.indexOf('#');
  let url = authURL;

  url += authURL.indexOf('?') > 0 ? '&' : '?';
  url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
  url += '&scope=' + encodeURIComponent(scope);
  url += '&client_id=' + encodeURIComponent(clientId);

  if (hashPos !== - 1 && hashPos+1 !== redirectUri.length) {
    url += '&state=' + encodeURIComponent(redirectUri.substring(hashPos+1));
  }
  url += '&response_type=token';

  return url;
}

export default class Authorize {
  static IMPLIED_FAKE_TOKEN = false;

  static authorize (remoteStorage, { authURL, scope, redirectUri, clientId }): void {
    log('[Authorize] authURL = ', authURL, 'scope = ', scope, 'redirectUri = ', redirectUri, 'clientId = ', clientId);

    // TODO add a test for this
    // keep track of the discovery data during redirect if we can't save it in localStorage
    if (!localStorageAvailable() && remoteStorage.backend === 'remotestorage') {
      redirectUri += redirectUri.indexOf('#') > 0 ? '&' : '#';

      const discoveryData = {
        userAddress: remoteStorage.remote.userAddress,
        href: remoteStorage.remote.href,
        storageApi: remoteStorage.remote.storageApi,
        properties: remoteStorage.remote.properties
      };

      redirectUri += 'rsDiscovery=' + toBase64(JSON.stringify(discoveryData));
    }

    const url = buildOAuthURL(authURL, redirectUri, scope, clientId);

    // FIXME declare potential `cordonva` property on global somehow, so we don't have to
    // use a string accessor here.
    if (globalContext['cordova']) {
      Authorize
        .openWindow(url, redirectUri, 'location=yes,clearsessioncache=yes,clearcache=yes')
        .then((authResult: AuthResult) => {
          remoteStorage.remote.configure({ token: authResult.access_token });
        });
      return;
    }

    Authorize.setLocation(url);
  }

  /**
   * Get current document location
   *
   * Override this method if access to document.location is forbidden
   */
  static getLocation = function (): Location {
    return document.location;
  };

  /**
   * Open new InAppBrowser window for OAuth in Cordova
   */
  static openWindow = function (url, redirectUri, options): Promise<any> {
    return new Promise((resolve, reject): any => {

      const newWindow = open(url, '_blank', options);

      if (!newWindow || newWindow.closed) {
        return reject('Authorization popup was blocked');
      }

      function handleExit () {
        return reject('Authorization was canceled');
      };

      function handleLoadstart (event) {
        if (event.url.indexOf(redirectUri) !== 0) {
          return;
        }

        newWindow.removeEventListener('exit', handleExit);
        newWindow.close();

        const authResult: AuthResult = extractParams(event.url);

        if (!authResult) {
          return reject('Authorization error');
        }

        return resolve(authResult);
      };

      newWindow.addEventListener('loadstart', handleLoadstart);
      newWindow.addEventListener('exit', handleExit);
    });
  };

  /**
   * Set current document location
   *
   * Override this method if access to document.location is forbidden
   */
  static setLocation (location: string | Location): void {
    if (typeof location === 'string') {
      document.location.href = location;
    } else if (typeof location === 'object') {
      document.location = location;
    } else {
      throw "Invalid location " + location;
    }
  };

  static _rs_supported (): boolean {
    return typeof(document) !== 'undefined';
  };

  static _rs_init = function (remoteStorage): void {
    const params = extractParams();
    let location;

    if (params) {
      location = Authorize.getLocation();
      location.hash = '';
    }

    onFeaturesLoaded = function() {
      let authParamsUsed = false;

      if (!params) { return; };

      if (params.error) {
        if (params.error === 'access_denied') {
          throw new UnauthorizedError('Authorization failed: access denied', { code: 'access_denied' });
        } else {
          throw new UnauthorizedError(`Authorization failed: ${params.error}`);
        }
      }

      // rsDiscovery came with the redirect, because it couldn't be
      // saved in localStorage
      if (params.rsDiscovery) {
        remoteStorage.remote.configure(params.rsDiscovery);
      }

      if (params.access_token) {
        remoteStorage.remote.configure({ token: params.access_token });
        authParamsUsed = true;
      }

      if (params.remotestorage) {
        remoteStorage.connect(params.remotestorage);
        authParamsUsed = true;
      }

      if (params.state) {
        location = Authorize.getLocation();
        Authorize.setLocation(location.href.split('#')[0]+'#'+params.state);
      }

      if (!authParamsUsed) {
        remoteStorage.remote.stopWaitingForToken();
      }
    };

    remoteStorage.on('features-loaded', onFeaturesLoaded);
  };

  static _rs_cleanup (remoteStorage): void {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
  };
};

module.exports = Authorize;
