import log from './log';
import RemoteStorage from './remotestorage';
import {localStorageAvailable, globalContext, toBase64} from './util';
import UnauthorizedError from './unauthorized-error';
import { EventHandler } from './interfaces/event_handling';
import {requestWithTimeout} from "./requests";
import {AuthorizeOptions} from "./interfaces/authorize_options";
import {Remote} from "./remote";


interface AuthResult {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  rsDiscovery?: object;
  error?: string;
  remotestorage?: string;
  state?: string;
}

interface InAppBrowserEvent extends Event {
  type: 'loadstart'|'loadstop'|'loaderror'|'message'|'exit';
  url: string;
  code?: number;
  message?: string;
  data?: string;
}

// This is set in _rs_init and needed for removal in _rs_cleanup
let onFeaturesLoaded: EventHandler;

function extractParams (url?: string): AuthResult {
  // FF already decodes the URL fragment in document.location.hash, so use this instead:
  // eslint-disable-next-line
  const location = url || Authorize.getLocation().href;

  const queryParam = {};
  for (const [key, value] of new URL(location).searchParams) {
    queryParam[key] = value;
  }

  const hashPos  = location.indexOf('#');
  if (hashPos === -1) { return queryParam; }
  const urlFragment = location.substring(hashPos+1);
  // if hash is not of the form #key=val&key=val, it's probably not for us
  if (!urlFragment.includes('=')) { return queryParam; }

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
  }, queryParam);
}

function buildOAuthURL (options: AuthorizeOptions): string {
  const redirect = new URL(options.redirectUri);
  if (! options.state) {
    options.state = redirect.hash ? redirect.hash.substring(1) : '';
  }

  if (! options.response_type) {
    options.response_type = 'token';
  }

  const url = new URL(options.authURL);

  // We don't add a trailing slash as only pathname to redirectUri.
  url.searchParams.set('redirect_uri', options.redirectUri.replace(/#.*$/, ''));
  url.searchParams.set('scope', options.scope);
  url.searchParams.set('client_id', options.clientId);

  for (const key of ['state', 'response_type', 'code_challenge', 'code_challenge_method', 'token_access_type']) {
    const value = options[key];
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.href;
}

class Authorize {
  static IMPLIED_FAKE_TOKEN = false;

  /**
   * Navigates browser to provider's OAuth page. When user grants access,
   * browser will navigate back to redirectUri and OAuth will continue
   * with onFeaturesLoaded.
   */
  static authorize (remoteStorage: RemoteStorage, options: AuthorizeOptions): void {
    log('[Authorize] authURL = ', options.authURL, 'scope = ', options.scope, 'redirectUri = ', options.redirectUri, 'clientId = ', options.clientId, 'response_type =', options.response_type );

    if (!options.scope) {
      throw new Error("Cannot authorize due to undefined or empty scope; did you forget to access.claim()?");
    }

    // TODO add a test for this
    // keep track of the discovery data during redirect if we can't save it in localStorage
    if (!localStorageAvailable() && remoteStorage.backend === 'remotestorage') {
      options.redirectUri += options.redirectUri.indexOf('#') > 0 ? '&' : '#';

      const discoveryData = {
        userAddress: remoteStorage.remote.userAddress,
        href: remoteStorage.remote.href,
        storageApi: remoteStorage.remote.storageApi,
        properties: remoteStorage.remote.properties
      };

      options.redirectUri += 'rsDiscovery=' + toBase64(JSON.stringify(discoveryData));
    }

    const url = buildOAuthURL(options);

    // FIXME declare potential `cordova` property on global somehow, so we don't have to
    // use a string accessor here.
    if (globalContext['cordova']) {
      Authorize
        .openWindow(url, options.redirectUri, 'location=yes,clearsessioncache=yes,clearcache=yes')
        .then((authResult: AuthResult) => {
          remoteStorage.remote.configure({ token: authResult.access_token });
        });
      return;
    }

    Authorize.setLocation(url);
  }

  /** On success, calls remote.configure() with new access token */
  static async refreshAccessToken (rs: RemoteStorage, remote: Remote, refreshToken: string): Promise<void> {
    await remote.configure({token: null, tokenType: null});
    const formValues = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: remote.clientId,
      refresh_token: refreshToken,
    });
    const xhr = await requestWithTimeout('POST', remote.TOKEN_URL, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: formValues.toString(),
      responseType: 'json'
    });
    if (xhr?.status === 200) {
      log(`[Authorize] access token good for ${xhr?.response?.expires_in} seconds`);
      const settings = {
        token: xhr?.response?.access_token,
        tokenType: xhr?.response?.token_type,
      };
      if (settings.token) {
        await remote.configure(settings);
      } else {
        throw new Error(`no access_token in "successful" refresh: ${xhr.response}`);
      }
    } else {
      await remote.configure({refreshToken: null});
      throw new UnauthorizedError("refresh token rejected:" + JSON.stringify(xhr.response));
    }
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
  static openWindow = function (url: string, redirectUri: string, options: string): Promise<AuthResult|string|void> {
    return new Promise<AuthResult|string|void>((resolve, reject) => {

      const newWindow = open(url, '_blank', options);

      if (!newWindow || newWindow.closed) {
        reject('Authorization popup was blocked'); return;
      }

      function handleExit (): void {
        reject('Authorization was canceled');
      }

      function handleLoadstart (event: InAppBrowserEvent): void {
        if (event.url.indexOf(redirectUri) !== 0) { return; }

        newWindow.removeEventListener('exit', handleExit);
        newWindow.close();

        const authResult: AuthResult = extractParams(event.url);

        if (!authResult) {
          reject('Authorization error'); return;
        }

        resolve(authResult);
      }

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
  }

  static _rs_supported (): boolean {
    return typeof(document) !== 'undefined';
  }

  static _rs_init = function (remoteStorage: RemoteStorage): void {
    const params = extractParams();
    let location: Location;

    if (params) {
      location = Authorize.getLocation();
      location.hash = '';
    }

    // eslint-disable-next-line
    onFeaturesLoaded = function(): void {
      let authParamsUsed = false;

      if (!params) {
        remoteStorage.remote.stopWaitingForToken();
        return;
      }

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

      if (params.code) {   // OAuth2 code or PKCE flow
        fetchTokens(params.code);   // remote.configure() called asynchronously
        authParamsUsed = true;
      }

      if (!authParamsUsed) {
        remoteStorage.remote.stopWaitingForToken();
      }
    };

    // OAuth2 PKCE flow
    async function fetchTokens(code: string) {
      const codeVerifier = sessionStorage.getItem('remotestorage:codeVerifier');
      if (!codeVerifier) {
        log("[Authorize] Ignoring OAuth code parameter, because no PKCE code verifier found in sessionStorage");
        return;
      }
      location = Authorize.getLocation();
      let redirectUri = location.origin;
      if (location.pathname !== '/') {
        redirectUri += location.pathname;
      }
      const formValues = new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: remoteStorage.remote.clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      });
      const xhr = await requestWithTimeout(
          'POST',
          remoteStorage.remote.TOKEN_URL,
          {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formValues.toString(),
            responseType: 'json'
          }
      );

      switch (xhr.status) {
        case 200:
          log(`[Authorize] access token good for ${xhr?.response?.expires_in} seconds`);
          const settings = {
            token: xhr?.response?.access_token,
            refreshToken: xhr?.response?.refresh_token,
            tokenType: xhr?.response?.token_type,
          };
          if (settings.token) {
            remoteStorage.remote.configure(settings);
          } else {
            remoteStorage._emit('error', new Error(`no access_token in "successful" response: ${xhr.response}`));
          }
          sessionStorage.removeItem('remotestorage:codeVerifier');
          break;
        default:
          remoteStorage._emit('error', new Error(`${xhr.statusText}: ${xhr.response}`));
      }
    }

    remoteStorage.on('features-loaded', onFeaturesLoaded);
  };

  static _rs_cleanup (remoteStorage: RemoteStorage): void {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
  }
}

export = Authorize;
