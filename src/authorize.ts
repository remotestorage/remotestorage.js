import type RemoteStorage from './remotestorage';
import config from './config';
import log from './log';
import { localStorageAvailable, globalContext, toBase64 } from './util';
import UnauthorizedError from './unauthorized-error';
import { EventHandler } from './eventhandling';
import { requestWithTimeout } from "./requests";
import { Remote, RemoteSettings, noRefreshSettings } from "./remote";

interface AuthResult {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  scope?: string;
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

export interface AuthorizeOptions {
  /** URL of the authorization endpoint */
  authURL: string;
  /** access scope */
  scope?: string;
  redirectUri?: string;
  /**
  * client identifier
  * @defaultValue Origin of the redirectUri
  * */
  clientId?: string;
  response_type?: 'token' | 'code';
  state?: string;
  code_challenge?: string;
  code_challenge_method?: 'S256' | 'plain';
  token_access_type?: 'online' | 'offline'; // Dropbox only
}

/**
 * What the token request needs after the redirect back from the authorization
 * server (a full page load), kept in sessionStorage.
 */
export interface PkceTransaction {
  codeVerifier: string;
  /** The random state sent to the authorization server */
  state: string;
  /** Token endpoint; the remote's TOKEN_URL when not set (Dropbox) */
  tokenURL?: string;
  /** Client id; the remote's clientId when not set (Dropbox) */
  clientId?: string;
  /** The app's location hash before the redirect, restored afterwards */
  appState?: string;
}

const PKCE_KEYS: Array<keyof PkceTransaction> = ['codeVerifier', 'state', 'tokenURL', 'clientId', 'appState'];

/** What a token endpoint returns for a refresh token */
export interface RefreshedToken {
  token: string;
  tokenType?: string;
  /** A rotated refresh token, when the server issues one */
  refreshToken?: string;
}

/** POST a refresh_token grant to the token endpoint */
function postRefreshGrant (tokenURL: string, clientId: string, refreshToken: string): Promise<XMLHttpRequest> {
  const formValues = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });
  return requestWithTimeout('POST', tokenURL, {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: formValues.toString(),
    responseType: 'json'
  });
}

/** The parts of a token endpoint's response that are kept */
interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
}

/**
 * The remote settings from a code exchange's token response. The generic
 * backend also keeps the token endpoint and client id, to refresh the token
 * later; Dropbox sets its own.
 */
function codeExchangeSettings (response: TokenResponse | undefined, transaction: PkceTransaction, tokenURL: string, clientId: string): RemoteSettings {
  const settings: RemoteSettings = {
    token: response?.access_token,
    refreshToken: response?.refresh_token,
    tokenType: response?.token_type,
  };
  if (transaction.tokenURL) {
    settings.tokenURL = tokenURL;
    settings.clientId = clientId;
    // A new authorization replaces any stored refresh token, even with none
    // (e.g. one stored by a refresh in another tab)
    settings.refreshToken = response?.refresh_token ?? null;
  }
  return settings;
}

/** Update a remote's tokens without emitting `connected`, since the session continues. */
async function storeRefreshedToken (remote: Remote, refreshed: RefreshedToken): Promise<void> {
  if (typeof remote._storeTokens === 'function') {
    remote._storeTokens(refreshed.token, refreshed.refreshToken, refreshed.tokenType);
  } else {
    await remote.configure({
      token: refreshed.token,
      tokenType: refreshed.tokenType,
      refreshToken: refreshed.refreshToken,
    });
  }
}

/** Forget a rejected refresh token without emitting `connected`. */
async function forgetRefreshToken (remote: Remote): Promise<void> {
  if (typeof remote._storeTokens === 'function' && typeof remote.token === 'string') {
    // Dropbox: no event, no info() round-trip, no setBackend() risk. The string
    // check routes falsy tokens (RemoteSettings.token may be false) to the
    // configure fallback, which refresh never hits in practice.
    remote._storeTokens(remote.token, null);
  } else {
    // Remotes without a non-emitting update keep using configure(); the
    // transition guard in Dropbox.configure() prevents its event.
    await remote.configure({ refreshToken: null });
  }
}

/** A refresh in flight for one remote session, shared by concurrent callers. */
interface InflightRefresh {
  /** The access token the refresh was started for */
  token: string | false | undefined;
  /** The refresh token the refresh was started for */
  refreshToken: string;
  /** Resolves the new token, or null when the session was replaced */
  promise: Promise<string | null>;
}

// Keyed by the remote instance: at most one refresh per session is in flight;
// concurrent 401s share it instead of each posting their own grant.
const inflightRefreshes = new WeakMap<Remote, InflightRefresh>();

// This is set in _rs_init and needed for removal in _rs_cleanup
let onFeaturesLoaded: EventHandler;

function hasAuthCallbackParams (params: AuthResult): boolean {
  return typeof params.access_token === 'string' ||
    typeof params.code === 'string' ||
    typeof params.error === 'string' ||
    typeof params.remotestorage === 'string' ||
    typeof params.rsDiscovery === 'object';
}

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

export class Authorize {
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

    if (typeof remoteStorage._rememberPendingScope === 'function') {
      // Some providers omit `scope` in the callback/token response, so remember
      // what we asked for before leaving the page.
      remoteStorage._rememberPendingScope(options.scope);
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
    if (globalContext['cordova'] &&
        (Authorize.getLocation().href.startsWith('file:') ||
         (typeof config.cordovaRedirectUri === 'string' &&
          options.redirectUri === config.cordovaRedirectUri))) {
      Authorize
        .openWindow(url, options.redirectUri, 'location=yes,clearsessioncache=yes,clearcache=yes')
        .then((authResult: AuthResult) => {
          // Only a new access token replaces the refresh settings; a callback
          // without one (e.g. Dropbox's code) leaves them alone
          remoteStorage.remote.configure({
            token: authResult.access_token,
            ...(authResult.access_token ? noRefreshSettings : {})
          });
          if (typeof remoteStorage._completeAuthorization === 'function') {
            remoteStorage._completeAuthorization(authResult.scope || options.scope);
          }
        });
      return;
    }

    Authorize.setLocation(url);
  }

  /**
   * Store a PKCE transaction before redirecting to the authorization server,
   * replacing any earlier one (e.g. from an abandoned authorization). The
   * current location hash is kept so it can be restored afterwards, since the
   * state parameter carries the random value instead.
   *
   * Throws when sessionStorage rejects the writes, after removing what it
   * can; nothing is written when the earlier transaction can't be removed.
   */
  static savePkceTransaction (transaction: PkceTransaction): void {
    const values: PkceTransaction = {
      appState: Authorize.getLocation().hash.substring(1),
      ...transaction
    };
    try {
      Authorize.clearPkceTransaction();
      for (const key of PKCE_KEYS) {
        if (values[key]) {
          sessionStorage.setItem(`remotestorage:${key}`, values[key]);
        }
      }
    } catch (err) {
      try {
        Authorize.clearPkceTransaction();
      } catch (cleanupErr) {
        log('[Authorize] Could not remove a partial PKCE transaction', cleanupErr);
      }
      throw err;
    }
  }

  /**
   * Read and remove the stored PKCE transaction, so a code is exchanged at
   * most once and nothing outlives it. Returns null when there is none.
   */
  static takePkceTransaction (): PkceTransaction | null {
    if (typeof sessionStorage === 'undefined') { return null; }
    const transaction = {} as PkceTransaction;
    for (const key of PKCE_KEYS) {
      transaction[key] = sessionStorage.getItem(`remotestorage:${key}`) || undefined;
    }
    Authorize.clearPkceTransaction();
    // Without a state, a callback without one would match it
    return (transaction.codeVerifier && transaction.state) ? transaction : null;
  }

  /** Remove any stored PKCE transaction. */
  static clearPkceTransaction (): void {
    if (typeof sessionStorage === 'undefined') { return; }
    for (const key of PKCE_KEYS) {
      sessionStorage.removeItem(`remotestorage:${key}`);
    }
  }

  /**
   * Refresh the access token for a remote, sharing one in-flight grant per
   * session. On success, updates the remote's tokens without emitting
   * `connected`, since the session continues.
   *
   * Resolves the new access token when it was refreshed for the session that
   * asked, or null when the session was replaced meanwhile (the caller must
   * not retry). Throws `Unauthorized` only when the server rejects the refresh
   * token (`invalid_grant`); transient failures keep the tokens so a later 401
   * can retry.
   */
  static async refreshAccessToken (rs: RemoteStorage, remote: Remote, refreshToken: string): Promise<string | null> {
    const tokenAtStart = remote.token;
    const existing = inflightRefreshes.get(remote);
    if (existing && existing.token === tokenAtStart && existing.refreshToken === refreshToken) {
      return existing.promise;
    }

    const entry: InflightRefresh = {
      token: tokenAtStart,
      refreshToken,
      promise: (async (): Promise<string | null> => {
        const sessionUnchanged = (): boolean =>
          (typeof remote.refreshToken === 'undefined' || remote.refreshToken === refreshToken) &&
          remote.token === tokenAtStart;

        try {
          const refreshed = await Authorize.requestRefreshedToken(remote.TOKEN_URL, remote.clientId, refreshToken);
          if (!sessionUnchanged()) {
            // Another path replaced the session while the request was in flight;
            // its tokens win. Don't overwrite them with this refresh's result.
            return null;
          }
          await storeRefreshedToken(remote, refreshed);
          return refreshed.token;
        } catch (err) {
          // Only a real invalid_grant means the refresh token is dead. Transient
          // failures (5xx, 429, network, a 200 without access_token) say nothing
          // about it, so keep it and let a later 401 retry.
          if (err instanceof UnauthorizedError && sessionUnchanged()) {
            await forgetRefreshToken(remote);
          }
          throw err;
        }
      })()
    };
    inflightRefreshes.set(remote, entry);
    const cleanup = (): void => {
      // A newer session's refresh may have replaced this entry; leave it alone
      if (inflightRefreshes.get(remote) === entry) {
        inflightRefreshes.delete(remote);
      }
    };
    entry.promise.then(cleanup, cleanup);
    return entry.promise;
  }

  /**
   * Exchange a refresh token for a new access token, without touching any
   * remote, so the caller decides whether the result still applies.
   *
   * Throws `Unauthorized` only when the server rejects the refresh token
   * (`invalid_grant`, RFC 6749 §5.2). Any other failure, such as a server
   * error, rate limiting or a network error, says nothing about the refresh
   * token, and throws a plain error.
   */
  static async requestRefreshedToken (tokenURL: string, clientId: string, refreshToken: string): Promise<RefreshedToken> {
    const xhr = await postRefreshGrant(tokenURL, clientId, refreshToken);
    const response = xhr?.response;
    if (xhr?.status === 200 && typeof response?.access_token === 'string' && response.access_token) {
      log(`[Authorize] access token good for ${response.expires_in} seconds`);
      return {
        token: response.access_token,
        tokenType: response.token_type,
        // Set only when the server rotates it
        refreshToken: response.refresh_token
      };
    }
    if (response?.error === 'invalid_grant') {
      throw new UnauthorizedError('refresh token rejected: ' + JSON.stringify(response));
    }
    throw new Error(`could not refresh the access token (${xhr?.status}): ${JSON.stringify(response)}`);
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
      document.location.href = location.href;
    } else {
      throw "Invalid location " + location;
    }
  }

  static _rs_supported (): boolean {
    return typeof(document) !== 'undefined';
  }

  static _rs_init = function (remoteStorage: RemoteStorage): void {
    const params = extractParams();
    const hasCallbackParams = hasAuthCallbackParams(params);
    let location: Location;

    if (hasCallbackParams) {
      location = Authorize.getLocation();
      location.hash = '';
    }

    // Give the app back the hash it had before the redirect
    function restoreAppState(transaction: PkceTransaction | null): void {
      if (transaction?.appState) {
        location = Authorize.getLocation();
        Authorize.setLocation(location.href.split('#')[0]+'#'+transaction.appState);
      }
    }

    // The code couldn't be exchanged: report it, and stop waiting for a token
    function failTokenRequest (error: Error): void {
      if (typeof remoteStorage._forgetPendingScope === 'function') {
        remoteStorage._forgetPendingScope();
      }
      remoteStorage._emit('error', error);
      remoteStorage.remote.stopWaitingForToken();
    }

    function handleCode(code: string, state: string | undefined): void {
      const transaction = Authorize.takePkceTransaction();
      if (!transaction) {
        log("[Authorize] Ignoring OAuth code parameter, because no PKCE code verifier found in sessionStorage");
        return;
      }
      restoreAppState(transaction);
      if (state !== transaction.state) {
        if (typeof remoteStorage._forgetPendingScope === 'function') {
          remoteStorage._forgetPendingScope();
        }
        remoteStorage._emit('error', new UnauthorizedError('Authorization failed: state mismatch'));
        return;
      }
      // remote.configure() is called asynchronously. Network errors, timeouts
      // and non-JSON bodies reject before fetchTokens() sees a status.
      fetchTokens(code, transaction).catch(failTokenRequest);
    }

    // eslint-disable-next-line
    onFeaturesLoaded = function(): void {
      let authParamsUsed = false;

      if (!hasCallbackParams) {
        remoteStorage.remote.stopWaitingForToken();
        return;
      }

      if (params.error) {
        // A denied or failed code flow: drop its transaction, and give the app
        // its hash back as a successful one would. A transaction with another
        // state is left from an abandoned attempt; drop it, but not its hash.
        const transaction = Authorize.takePkceTransaction();
        if (transaction?.state === params.state) {
          restoreAppState(transaction);
        }
        if (typeof remoteStorage._forgetPendingScope === 'function') {
          remoteStorage._forgetPendingScope();
        }
        if (params.error === 'access_denied') {
          throw new UnauthorizedError('Authorization failed: access denied', { code: 'access_denied' });
        } else {
          throw new UnauthorizedError(`Authorization failed: ${params.error}`);
        }
      }

      // rsDiscovery is only ever emitted by us when localStorage is
      // unavailable (see Authorize.authorize), and it carries endpoint
      // metadata, never a credential. Applying it over a remote that already
      // holds a stored token would retarget the endpoint while retaining the
      // token, leaking it to the substituted server. So only apply it when
      // there is no stored token to protect, or when the same callback also
      // hands us a fresh token (the server-initiated pre-authed flow).
      const hasFreshToken = !!params.access_token;

      if (params.rsDiscovery) {
        const hasStoredToken = !!(remoteStorage.remote && remoteStorage.remote.token);

        if (hasFreshToken) {
          // Apply the endpoint metadata and the fresh token in a single
          // configure() call. Otherwise the endpoint would be switched while
          // the previously stored token is still in place, and the
          // synchronous 'connected' event could leak that token to the new
          // endpoint before the next call installs the fresh one.
          remoteStorage.remote.configure({ ...params.rsDiscovery, token: params.access_token, ...noRefreshSettings });
        } else if (!hasStoredToken) {
          remoteStorage.remote.configure(params.rsDiscovery);
        } else {
          log('[Authorize] Ignoring rsDiscovery metadata for an already-authenticated remote');
        }
      }

      if (params.access_token) {
        if (!params.rsDiscovery) {
          // A new token, here and above, replaces any earlier refresh settings
          remoteStorage.remote.configure({ token: params.access_token, ...noRefreshSettings });
        }
        if (typeof remoteStorage._completeAuthorization === 'function') {
          remoteStorage._completeAuthorization(params.scope);
        }
        authParamsUsed = true;
      }

      if (params.remotestorage) {
        remoteStorage.connect(params.remotestorage);
        authParamsUsed = true;
      }

      if (params.code) {   // OAuth2 code or PKCE flow
        handleCode(params.code, params.state);
        authParamsUsed = true;
      } else if (params.state) {
        location = Authorize.getLocation();
        Authorize.setLocation(location.href.split('#')[0]+'#'+params.state);
      }

      if (!authParamsUsed) {
        remoteStorage.remote.stopWaitingForToken();
      }
    };

    // OAuth2 PKCE flow
    async function fetchTokens(code: string, transaction: PkceTransaction) {
      const codeVerifier = transaction.codeVerifier;
      // The token endpoint and client id were stored before the redirect (the
      // generic backend does not re-discover before this runs); fall back to the
      // remote for backends that set them directly, like Dropbox.
      const tokenURL = transaction.tokenURL || remoteStorage.remote.TOKEN_URL;
      const clientId = transaction.clientId || remoteStorage.remote.clientId;
      location = Authorize.getLocation();
      let redirectUri = location.origin;
      if (location.pathname !== '/') {
        redirectUri += location.pathname;
      }
      const formValues = new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      });
      const xhr = await requestWithTimeout(
          'POST',
          tokenURL,
          {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formValues.toString(),
            responseType: 'json'
          }
      );

      switch (xhr.status) {
        case 200: {
          log(`[Authorize] access token good for ${xhr?.response?.expires_in} seconds`);
          const settings = codeExchangeSettings(xhr?.response, transaction, tokenURL, clientId);
          if (settings.token) {
            remoteStorage.remote.configure(settings);
            if (typeof remoteStorage._completeAuthorization === 'function') {
              remoteStorage._completeAuthorization(xhr?.response?.scope);
            }
          } else {
            failTokenRequest(new Error(`no access_token in "successful" response: ${xhr.response}`));
          }
          break;
        }
        default:
          failTokenRequest(new Error(`${xhr.statusText}: ${xhr.response}`));
      }
    }

    remoteStorage.on('features-loaded', onFeaturesLoaded);
  };

  static _rs_cleanup (remoteStorage: RemoteStorage): void {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
  }
}

export default Authorize;
