(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("RemoteStorage", [], factory);
	else if(typeof exports === 'object')
		exports["RemoteStorage"] = factory();
	else
		root["RemoteStorage"] = factory();
})(this, function() {
return /******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/access.ts":
/*!***********************!*\
  !*** ./src/access.ts ***!
  \***********************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Access = void 0;
/**
 * @class
 *
 * This class is for requesting and managing access to modules/folders on the
 * remote. It gets initialized as `remoteStorage.access`.
 */
class Access {
    constructor(rs) {
        this.rs = rs;
        // Avoid emitting a spurious "empty scope" check while RS is still booting.
        this.reset(false);
    }
    /**
     * Holds an array of claimed scopes:
     *
     * ```javascript
     * [{ name: "<scope-name>", mode: "<mode>" }]
     * ```
     *
     * @ignore
     */
    get scopes() {
        return Object.keys(this.scopeModeMap).map((key) => {
            return { name: key, mode: this.scopeModeMap[key] };
        });
    }
    get scopeParameter() {
        return this.scopes.map((scope) => {
            return `${this._scopeNameForParameter(scope)}:${scope.mode}`;
        }).join(' ');
    }
    /**
     * Claim access on a given scope with given mode.
     *
     * @param scope - An access scope, such as `contacts` or `calendar`
     * @param mode - Access mode. Either `r` for read-only or `rw` for read/write
     *
     * @example
     * ```javascript
     * remoteStorage.access.claim('contacts', 'r');
     * remoteStorage.access.claim('pictures', 'rw');
     * ```
     *
     * Claiming root access, meaning complete access to all files and folders of a storage, can be done using an asterisk for the scope:
     *
     * ```javascript
     * remoteStorage.access.claim('*', 'rw');
     * ```
     */
    claim(scope, mode) {
        if (typeof scope !== 'string' || scope.indexOf('/') !== -1 || scope.length === 0) {
            throw new Error('Scope should be a non-empty string without forward slashes');
        }
        if (typeof mode !== 'string' || !mode.match(/^rw?$/)) {
            throw new Error('Mode should be either \'r\' or \'rw\'');
        }
        this._adjustRootPaths(scope);
        this.scopeModeMap[scope] = mode;
        this._notifyChange();
    }
    /**
     * Get the access mode for a given scope.
     *
     * @param scope - Access scope
     * @returns Access mode
     * @ignore
     */
    get(scope) {
        return this.scopeModeMap[scope];
    }
    /**
     * Remove access for the given scope.
     *
     * @param scope - Access scope
     * @ignore
     */
    remove(scope) {
        const savedMap = {};
        for (const name in this.scopeModeMap) {
            savedMap[name] = this.scopeModeMap[name];
        }
        this.reset(false);
        delete savedMap[scope];
        for (const name in savedMap) {
            this._adjustRootPaths(name);
            this.scopeModeMap[name] = savedMap[name];
        }
        this._notifyChange();
    }
    /**
     * Verify permission for a given scope.
     *
     * @param scope - Access scope
     * @param mode - Access mode
     * @returns `true` if the requested access mode is active, `false` otherwise
     * @ignore
     */
    checkPermission(scope, mode) {
        const actualMode = this.get(scope);
        return actualMode && (mode === 'r' || actualMode === 'rw');
    }
    /**
     * Verify permission for a given path.
     *
     * @param path - Path
     * @param mode - Access mode
     * @returns true if the requested access mode is active, false otherwise
     * @ignore
     */
    checkPathPermission(path, mode) {
        if (this.checkPermission('*', mode)) {
            return true;
        }
        // TODO check if this is reliable
        const scope = this._getModuleName(path);
        return !!this.checkPermission(scope, mode);
    }
    /**
     * Reset all access permissions.
     *
     * @ignore
     */
    reset(notifyChange = true) {
        this.rootPaths = [];
        this.scopeModeMap = {};
        if (notifyChange) {
            this._notifyChange();
        }
    }
    /**
     * Return the module name for a given path.
     */
    _getModuleName(path) {
        if (path[0] !== '/') {
            throw new Error('Path should start with a slash');
        }
        const moduleMatch = path.replace(/^\/public/, '').match(/^\/([^/]*)\//);
        return moduleMatch ? moduleMatch[1] : '*';
    }
    /**
     * TODO: document
     */
    _adjustRootPaths(newScope) {
        if ('*' in this.scopeModeMap || newScope === '*') {
            this.rootPaths = ['/'];
        }
        else if (!(newScope in this.scopeModeMap)) {
            this.rootPaths.push('/' + newScope + '/');
            this.rootPaths.push('/public/' + newScope + '/');
        }
    }
    /**
     * TODO: document
     */
    _scopeNameForParameter(scope) {
        if (scope.name === '*' && this.storageType) {
            if (this.storageType === '2012.04') {
                return '';
            }
            else if (this.storageType.match(/remotestorage-0[01]/)) {
                return 'root';
            }
        }
        return scope.name;
    }
    /**
     * Set the storage type of the remote.
     *
     * @param type - Storage type
     * @internal
     */
    setStorageType(type) {
        this.storageType = type;
    }
    _notifyChange() {
        if (this.rs && typeof this.rs._checkScopeChange === 'function') {
            this.rs._checkScopeChange();
        }
    }
    static _rs_init() {
        return;
    }
}
exports.Access = Access;
exports["default"] = Access;


/***/ }),

/***/ "./src/authorize.ts":
/*!**************************!*\
  !*** ./src/authorize.ts ***!
  \**************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Authorize = void 0;
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
// This is set in _rs_init and needed for removal in _rs_cleanup
let onFeaturesLoaded;
function hasAuthCallbackParams(params) {
    return typeof params.access_token === 'string' ||
        typeof params.code === 'string' ||
        typeof params.error === 'string' ||
        typeof params.remotestorage === 'string' ||
        typeof params.rsDiscovery === 'object';
}
function extractParams(url) {
    // FF already decodes the URL fragment in document.location.hash, so use this instead:
    // eslint-disable-next-line
    const location = url || Authorize.getLocation().href;
    const queryParam = {};
    for (const [key, value] of new URL(location).searchParams) {
        queryParam[key] = value;
    }
    const hashPos = location.indexOf('#');
    if (hashPos === -1) {
        return queryParam;
    }
    const urlFragment = location.substring(hashPos + 1);
    // if hash is not of the form #key=val&key=val, it's probably not for us
    if (!urlFragment.includes('=')) {
        return queryParam;
    }
    return urlFragment.split('&').reduce(function (params, kvs) {
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
        }
        else {
            params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
        }
        return params;
    }, queryParam);
}
function buildOAuthURL(options) {
    const redirect = new URL(options.redirectUri);
    if (!options.state) {
        options.state = redirect.hash ? redirect.hash.substring(1) : '';
    }
    if (!options.response_type) {
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
    /**
     * Navigates browser to provider's OAuth page. When user grants access,
     * browser will navigate back to redirectUri and OAuth will continue
     * with onFeaturesLoaded.
     */
    static authorize(remoteStorage, options) {
        (0, log_1.default)('[Authorize] authURL = ', options.authURL, 'scope = ', options.scope, 'redirectUri = ', options.redirectUri, 'clientId = ', options.clientId, 'response_type =', options.response_type);
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
        if (!(0, util_1.localStorageAvailable)() && remoteStorage.backend === 'remotestorage') {
            options.redirectUri += options.redirectUri.indexOf('#') > 0 ? '&' : '#';
            const discoveryData = {
                userAddress: remoteStorage.remote.userAddress,
                href: remoteStorage.remote.href,
                storageApi: remoteStorage.remote.storageApi,
                properties: remoteStorage.remote.properties
            };
            options.redirectUri += 'rsDiscovery=' + (0, util_1.toBase64)(JSON.stringify(discoveryData));
        }
        const url = buildOAuthURL(options);
        // FIXME declare potential `cordova` property on global somehow, so we don't have to
        // use a string accessor here.
        if (util_1.globalContext['cordova'] &&
            (Authorize.getLocation().href.startsWith('file:') ||
                (typeof config_1.default.cordovaRedirectUri === 'string' &&
                    options.redirectUri === config_1.default.cordovaRedirectUri))) {
            Authorize
                .openWindow(url, options.redirectUri, 'location=yes,clearsessioncache=yes,clearcache=yes')
                .then((authResult) => {
                remoteStorage.remote.configure({ token: authResult.access_token });
                if (typeof remoteStorage._completeAuthorization === 'function') {
                    remoteStorage._completeAuthorization(authResult.scope || options.scope);
                }
            });
            return;
        }
        Authorize.setLocation(url);
    }
    /** On success, calls remote.configure() with new access token */
    static refreshAccessToken(rs, remote, refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            yield remote.configure({ token: null, tokenType: null });
            const formValues = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: remote.clientId,
                refresh_token: refreshToken,
            });
            const xhr = yield (0, requests_1.requestWithTimeout)('POST', remote.TOKEN_URL, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formValues.toString(),
                responseType: 'json'
            });
            if ((xhr === null || xhr === void 0 ? void 0 : xhr.status) === 200) {
                (0, log_1.default)(`[Authorize] access token good for ${(_a = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _a === void 0 ? void 0 : _a.expires_in} seconds`);
                const settings = {
                    token: (_b = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _b === void 0 ? void 0 : _b.access_token,
                    tokenType: (_c = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _c === void 0 ? void 0 : _c.token_type,
                };
                if (settings.token) {
                    yield remote.configure(settings);
                }
                else {
                    throw new Error(`no access_token in "successful" refresh: ${xhr.response}`);
                }
            }
            else {
                yield remote.configure({ refreshToken: null });
                throw new unauthorized_error_1.default("refresh token rejected:" + JSON.stringify(xhr.response));
            }
        });
    }
    /**
     * Set current document location
     *
     * Override this method if access to document.location is forbidden
     */
    static setLocation(location) {
        if (typeof location === 'string') {
            document.location.href = location;
        }
        else if (typeof location === 'object') {
            document.location.href = location.href;
        }
        else {
            throw "Invalid location " + location;
        }
    }
    static _rs_supported() {
        return typeof (document) !== 'undefined';
    }
    static _rs_cleanup(remoteStorage) {
        remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
    }
}
exports.Authorize = Authorize;
Authorize.IMPLIED_FAKE_TOKEN = false;
/**
 * Get current document location
 *
 * Override this method if access to document.location is forbidden
 */
Authorize.getLocation = function () {
    return document.location;
};
/**
 * Open new InAppBrowser window for OAuth in Cordova
 */
Authorize.openWindow = function (url, redirectUri, options) {
    return new Promise((resolve, reject) => {
        const newWindow = open(url, '_blank', options);
        if (!newWindow || newWindow.closed) {
            reject('Authorization popup was blocked');
            return;
        }
        function handleExit() {
            reject('Authorization was canceled');
        }
        function handleLoadstart(event) {
            if (event.url.indexOf(redirectUri) !== 0) {
                return;
            }
            newWindow.removeEventListener('exit', handleExit);
            newWindow.close();
            const authResult = extractParams(event.url);
            if (!authResult) {
                reject('Authorization error');
                return;
            }
            resolve(authResult);
        }
        newWindow.addEventListener('loadstart', handleLoadstart);
        newWindow.addEventListener('exit', handleExit);
    });
};
Authorize._rs_init = function (remoteStorage) {
    const params = extractParams();
    const hasCallbackParams = hasAuthCallbackParams(params);
    let location;
    if (hasCallbackParams) {
        location = Authorize.getLocation();
        location.hash = '';
    }
    // eslint-disable-next-line
    onFeaturesLoaded = function () {
        let authParamsUsed = false;
        if (!hasCallbackParams) {
            remoteStorage.remote.stopWaitingForToken();
            return;
        }
        if (params.error) {
            if (typeof remoteStorage._forgetPendingScope === 'function') {
                remoteStorage._forgetPendingScope();
            }
            if (params.error === 'access_denied') {
                throw new unauthorized_error_1.default('Authorization failed: access denied', { code: 'access_denied' });
            }
            else {
                throw new unauthorized_error_1.default(`Authorization failed: ${params.error}`);
            }
        }
        // rsDiscovery came with the redirect, because it couldn't be
        // saved in localStorage
        if (params.rsDiscovery) {
            remoteStorage.remote.configure(params.rsDiscovery);
        }
        if (params.access_token) {
            remoteStorage.remote.configure({ token: params.access_token });
            if (typeof remoteStorage._completeAuthorization === 'function') {
                remoteStorage._completeAuthorization(params.scope);
            }
            authParamsUsed = true;
        }
        if (params.remotestorage) {
            remoteStorage.connect(params.remotestorage);
            authParamsUsed = true;
        }
        if (params.state) {
            location = Authorize.getLocation();
            Authorize.setLocation(location.href.split('#')[0] + '#' + params.state);
        }
        if (params.code) { // OAuth2 code or PKCE flow
            fetchTokens(params.code); // remote.configure() called asynchronously
            authParamsUsed = true;
        }
        if (!authParamsUsed) {
            remoteStorage.remote.stopWaitingForToken();
        }
    };
    // OAuth2 PKCE flow
    function fetchTokens(code) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const codeVerifier = sessionStorage.getItem('remotestorage:codeVerifier');
            if (!codeVerifier) {
                (0, log_1.default)("[Authorize] Ignoring OAuth code parameter, because no PKCE code verifier found in sessionStorage");
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
            const xhr = yield (0, requests_1.requestWithTimeout)('POST', remoteStorage.remote.TOKEN_URL, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formValues.toString(),
                responseType: 'json'
            });
            switch (xhr.status) {
                case 200: {
                    (0, log_1.default)(`[Authorize] access token good for ${(_a = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _a === void 0 ? void 0 : _a.expires_in} seconds`);
                    const settings = {
                        token: (_b = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _b === void 0 ? void 0 : _b.access_token,
                        refreshToken: (_c = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _c === void 0 ? void 0 : _c.refresh_token,
                        tokenType: (_d = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _d === void 0 ? void 0 : _d.token_type,
                    };
                    if (settings.token) {
                        remoteStorage.remote.configure(settings);
                        if (typeof remoteStorage._completeAuthorization === 'function') {
                            remoteStorage._completeAuthorization((_e = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _e === void 0 ? void 0 : _e.scope);
                        }
                    }
                    else {
                        remoteStorage._emit('error', new Error(`no access_token in "successful" response: ${xhr.response}`));
                    }
                    sessionStorage.removeItem('remotestorage:codeVerifier');
                    break;
                }
                default:
                    if (typeof remoteStorage._forgetPendingScope === 'function') {
                        remoteStorage._forgetPendingScope();
                    }
                    remoteStorage._emit('error', new Error(`${xhr.statusText}: ${xhr.response}`));
            }
        });
    }
    remoteStorage.on('features-loaded', onFeaturesLoaded);
};
exports["default"] = Authorize;


/***/ }),

/***/ "./src/baseclient.ts":
/*!***************************!*\
  !*** ./src/baseclient.ts ***!
  \***************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BaseClient = void 0;
const tv4_1 = __importDefault(__webpack_require__(/*! tv4 */ "./node_modules/tv4/tv4.js"));
const types_1 = __importDefault(__webpack_require__(/*! ./types */ "./src/types.ts"));
const schema_not_found_error_1 = __importDefault(__webpack_require__(/*! ./schema-not-found-error */ "./src/schema-not-found-error.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
function getModuleNameFromBase(path) {
    const parts = path.split('/');
    return path.length > 2 ? parts[1] : 'root';
}
/**
 * A `BaseClient` instance is the main endpoint you will use for interacting
 * with a connected storage: listing, reading, creating, updating and deleting
 * documents, as well as handling incoming changes.
 *
 * Base clients are usually used in [data modules](../../../data-modules/),
 * which are loaded with two `BaseClient` instances by default: one for private
 * and one for public documents.
 *
 * However, you can also instantiate a BaseClient outside of a data module using
 * the `remoteStorage.scope()` function. Similarly, you can create a new scoped
 * client within another client, using the `BaseClient`'s own {@link scope}.
 *
 * ## Read/write operations
 *
 * A `BaseClient` deals with three types of data: folders, objects and files.
 *
 * * {@link getListing} returns a mapping of all items within a folder.
 *
 * * {@link getObject} and {@link storeObject} operate on JSON objects. Each object
 *   has a type.
 *
 * * {@link getFile} and {@link storeFile} operates on files. Each file has a
 *   content/MIME type.
 *
 * * {@link getAll} returns all objects or files for the given folder path.
 *
 * * {@link remove} operates on either objects or files (but not folders; folders
 *   are created and removed implictly).
 *
 * ## Caching logic for read operations
 *
 * All functions requesting/reading data will immediately return data from the
 * local store, *as long as it is reasonably up-to-date*. If data is assumed to be
 * potentially outdated, they will check the remote storage for changes first, and then
 * return the requested data.
 *
 * The default maximum age of requested data is two times the periodic sync
 * interval (10 seconds by default).
 *
 * However, you can adjust this behavior by using the `maxAge` argument with any
 * of these functions, thereby changing the maximum age or removing the
 * requirement entirely.
 *
 * * If the `maxAge` requirement is set, and the last sync request for the path
 *   is further in the past than the maximum age given, the folder will first be
 *   checked for changes on the remote, and then the promise will be fulfilled
 *   with the up-to-date document or listing.
 *
 * * If the `maxAge` requirement is set, and cannot be met because of network
 *   problems, the promise will be rejected.
 *
 * * If the `maxAge` requirement is set to `false`, or the library is in
 *   offline mode, or no remote storage is connected (a.k.a.  "anonymous mode"),
 *   the promise will always be fulfilled with data from the local store.
 *
 * > [!NOTE]
 * > If {@link caching!Caching caching} for the folder is turned off, none of
 * > this applies and data will always be requested from the remote store
 * > directly.
 *
 * ## Change events
 *
 * A `BaseClient` emits only one type of event, named `change`, which you can add
 * a handler for using the `.on()` function (same as with {@link RemoteStorage}):
 *
 * ```js
 * client.on('change', function (evt) {
 *   console.log('data was added, updated, or removed:', evt)
 * });
 * ```
 *
 * Using this event, your app can stay informed about data changes, both remote
 * (from other devices or browsers), as well as locally (e.g. other browser tabs).
 *
 * In order to determine where a change originated from, look at the `origin`
 * property of the event. Possible values are `window`, `local`, `remote`, and
 * `conflict`, explained in detail below.
 *
 * #### Example
 *
 * ```js
 * {
 *   // Absolute path of the changed node, from the storage root
 *   path: path,
 *   // Path of the changed node, relative to this baseclient's scope root
 *   relativePath: relativePath,
 *   // See origin descriptions below
 *   origin: 'window|local|remote|conflict',
 *   // Old body of the changed node (local version in conflicts; undefined if creation)
 *   oldValue: oldBody,
 *   // New body of the changed node (remote version in conflicts; undefined if deletion)
 *   newValue: newBody,
 *   // Body when local and remote last agreed; only present in conflict events
 *   lastCommonValue: lastCommonBody,
 *   // Old contentType of the changed node (local version for conflicts; undefined if creation)
 *   oldContentType: oldContentType,
 *   // New contentType of the changed node (remote version for conflicts; undefined if deletion)
 *   newContentType: newContentType,
 *   // ContentType when local and remote last agreed; only present in conflict events
 *   lastCommonContentType: lastCommonContentType
 * }
 * ```
 *
 * ### `local`
 *
 * Events with origin `local` are fired conveniently during the page load, so
 * that you can fill your views when the page loads.
 *
 * Example:
 *
 * ```js
 * {
 *   path: '/public/design/color.txt',
 *   relativePath: 'color.txt',
 *   origin: 'local',
 *   oldValue: undefined,
 *   newValue: 'white',
 *   oldContentType: undefined,
 *   newContentType: 'text/plain'
 * }
 * ```
 *
 * > [!TIP]
 * > You may also use for example {@link getAll} instead, and choose to
 * > deactivate these.
 *
 * ### `remote`
 *
 * Events with origin `remote` are fired when remote changes are discovered
 * during sync.
 *
 * > [!NOTE]
 * > Automatically receiving remote changes depends on the
 * > {@link caching!Caching caching} settings for your module/paths.
 *
 * ### `window`
 *
 * Events with origin `window` are fired whenever you change a value by calling a
 * method on the `BaseClient`; these are disabled by default.
 *
 * > [!TIP]
 * > You can enable them by configuring `changeEvents` for your
 * > {@link RemoteStorage remoteStorage} instance.
 *
 * ### `conflict`
 *
 * Events with origin `conflict` are fired when a conflict occurs while pushing
 * out your local changes to the remote store.
 *
 * Let's say you changed the content of `color.txt` from `white` to `blue`; if
 * you have set `config.changeEvents.window` to `true` for your {@link
 * RemoteStorage} instance, then you will receive:
 *
 * ```js
 * {
 *   path: '/public/design/color.txt',
 *   relativePath: 'color.txt',
 *   origin: 'window',
 *   oldValue: 'white',
 *   newValue: 'blue',
 *   oldContentType: 'text/plain',
 *   newContentType: 'text/plain'
 * }
 * ```
 *
 * However, when this change is pushed out by the sync process, it will be
 * rejected by the server, if the remote version has changed in the meantime,
 * for example from `white` to `red`. This will lead to a change event with
 * origin `conflict`, usually a few seconds after the event with origin
 * `window`. Note that since you already changed it from `white` to `blue` in
 * the local version a few seconds ago, `oldValue` is now your local value of
 * `blue`:
 *
 * ```js
 * {
 *   path: '/public/design/color.txt',
 *   relativePath: 'color.txt',
 *   origin: 'conflict',
 *   oldValue: 'blue',
 *   newValue: 'red',
 *   oldContentType: 'text/plain',
 *   newContentType: 'text/plain',
 *   // Most recent known common ancestor body of local and remote
 *   lastCommonValue: 'white',
 *   // Most recent known common ancestor contentType of local and remote
 *   lastCommonContentType: 'text/plain'
 * }
 * ```
 *
 * #### Conflict Resolution
 *
 * Conflicts are resolved by calling {@link storeObject} or {@link storeFile} on
 * the device where the conflict surfaced. Other devices are not aware of the
 * conflict.
 *
 * If there is an algorithm to merge the differences between local and remote
 * versions of the data, conflicts may be automatically resolved.
 *
 * If no algorithm exists, conflict resolution typically involves displaying local
 * and remote versions to the user, and having the user merge them, or choose
 * which version to keep.
 */
class BaseClient {
    constructor(storage, base) {
        /**
         * TODO document
         *
         * @private
         */
        this.schemas = {
            configurable: true,
            get() {
                return BaseClient.Types.inScope(this.moduleName);
            }
        };
        if (base[base.length - 1] !== '/') {
            throw "Not a folder: " + base;
        }
        if (base === '/') {
            // allow absolute and relative paths for the root scope.
            this.makePath = (path) => {
                return (path[0] === '/' ? '' : '/') + path;
            };
        }
        this.storage = storage;
        this.base = base;
        this.moduleName = getModuleNameFromBase(this.base);
        this.addEvents(['change']);
        this.on = this.on.bind(this);
        storage.onChange(this.base, this._fireChange.bind(this));
    }
    /**
     * Instantiate a new client, scoped to a subpath of the current client's
     * path.
     *
     * @param path - The path to scope the new client to
     *
     * @returns A new `BaseClient` operating on a subpath of the current base path
     */
    scope(path) {
        return new BaseClient(this.storage, this.makePath(path));
    }
    /**
     * Get a list of child nodes below a given path.
     *
     * @param path   - The path to query. It must end with a forward slash.
     * @param maxAge - (optional) Either `false` or the maximum age of cached
     *                 listing in milliseconds. See [caching logic for read
     *                 operations](#caching-logic-for-read-operations).
     *
     * @returns A promise for a folder listing object
     *
     * @example
     * ```js
     * client.getListing().then(listing => console.log(listing));
     * ```
     *
     * The folder listing is returned as a JSON object, with the root keys
     * representing the pathnames of child nodes. Keys ending in a forward slash
     * represent _folder nodes_ (subdirectories), while all other keys represent
     * _data nodes_ (files/objects).
     *
     * Data node information contains the item's ETag, content type and -length.
     *
     * Example of a listing object:
     *
     * ```js
     * {
     *   "@context": "http://remotestorage.io/spec/folder-description",
     *   "items": {
     *     "thumbnails/": true,
     *     "screenshot-20170902-1913.png": {
     *       "ETag": "6749fcb9eef3f9e46bb537ed020aeece",
     *       "Content-Length": 53698,
     *       "Content-Type": "image/png;charset=binary"
     *     },
     *     "screenshot-20170823-0142.png": {
     *       "ETag": "92ab84792ef3f9e46bb537edac9bc3a1",
     *       "Content-Length": 412401,
     *       "Content-Type": "image/png;charset=binary"
     *     }
     *   }
     * }
     * ```
     *
     * > [!WARNING]
     * > At the moment, this function only returns detailed metadata, when
     * > caching is turned off. With caching turned on, it will only contain the
     * > item names as properties with `true` as value. See issues 721 and 1108 —
     * > contributions welcome!
     */
    // TODO add real return type
    getListing(path, maxAge) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                path = '';
            }
            else if (path.length > 0 && !(0, util_1.isFolder)(path)) {
                return Promise.reject("Not a folder: " + path);
            }
            return this.storage.get(this.makePath(path), maxAge).then((r) => {
                return r.statusCode === 404 ? {} : r.body;
            });
        });
    }
    /**
     * Get all objects directly below a given path.
     *
     * @param path   - (optional) Path to the folder. Must end in a forward slash.
     * @param maxAge - (optional) Either `false` or the maximum age of cached
     *                 objects in milliseconds. See [caching logic for read
     *                 operations](#caching-logic-for-read-operations).
  
     *
     * @returns A promise for a collection of items
     *
     * @example
     * ```js
     * client.getAll('example-subdirectory/').then(objects => {
     *   for (var path in objects) {
     *     console.log(path, objects[path]);
     *   }
     * });
     * ```
     *
     * Example response:
     *
     * ```js
     * {
     *   "27b8dc16483734625fff9de653a14e03": {
     *     "@context": "http://remotestorage.io/spec/modules/bookmarks/archive-bookmark",
     *     "id": "27b8dc16483734625fff9de653a14e03",
     *     "url": "https://unhosted.org/",
     *     "title": "Unhosted Web Apps",
     *     "description": "Freedom from web 2.0's monopoly platforms",
     *     "tags": [
     *       "unhosted",
     *       "remotestorage"
     *     ],
     *     "createdAt": "2017-11-02T15:22:25.289Z",
     *     "updatedAt": "2019-11-07T17:52:22.643Z"
     *   },
     *   "900a5ca174bf57c56b79af0653053bdc": {
     *     "@context": "http://remotestorage.io/spec/modules/bookmarks/archive-bookmark",
     *     "id": "900a5ca174bf57c56b79af0653053bdc",
     *     "url": "https://remotestorage.io/",
     *     "title": "remoteStorage",
     *     "description": "An open protocol for per-user storage on the Web",
     *     "tags": [
     *       "unhosted",
     *       "remotestorage"
     *     ],
     *     "createdAt": "2019-11-07T17:59:34.883Z"
     *   }
     * }
     * ```
     * > [!NOTE]
     * > For items that are not JSON-stringified objects (for example stored using
     * > {@link storeFile} instead of {@link storeObject}), the object's value is
     * > filled in with `true`.
     *
     */
    // TODO add real return type
    getAll(path, maxAge) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                path = '';
            }
            else if (path.length > 0 && !(0, util_1.isFolder)(path)) {
                return Promise.reject("Not a folder: " + path);
            }
            return this.storage.get(this.makePath(path), maxAge).then((r) => {
                if (r.statusCode === 404) {
                    return {};
                }
                if (typeof r.body === 'object') {
                    const keys = Object.keys(r.body);
                    // treat this like 404. it probably means a folder listing that
                    // has changes that haven't been pushed out yet.
                    if (keys.length === 0) {
                        return {};
                    }
                    const calls = keys.map((key) => {
                        return this.storage.get(this.makePath(path + key), maxAge)
                            .then((o) => {
                            if (typeof o.body === 'string') {
                                try {
                                    o.body = JSON.parse(o.body);
                                }
                                catch (e) { /* empty */ }
                            }
                            if (typeof o.body === 'object') {
                                r.body[key] = o.body;
                            }
                        });
                    });
                    return Promise.all(calls).then(() => { return r.body; });
                }
            });
        });
    }
    /**
     * Get the file at the given path. A file is raw data, as opposed to
     * a JSON object (use {@link getObject} for that).
     *
     *
     * @param path   - Relative path from the module root (without leading slash).
     * @param maxAge - (optional) Either ``false`` or the maximum age of
     *                 the cached file in milliseconds. See [caching logic for read
     *                 operations](#caching-logic-for-read-operations).
     *
     * @returns An object containing the content type as well as the file's content:
     *
     * * `contentType`<br>
     *    String containing the MIME Type of the document. (Usually just the
     *    MIME type, but can theoretically contain extra metadata such as `charset`
     *    for example.)
     * * `data`<br>
     *    Raw data of the document (either a string or an ArrayBuffer)
     *
     * @example
     * Displaying an image:
     *
     * ```js
     * client.getFile('path/to/some/image').then(file => {
     *   const blob = new Blob([file.data], { type: file.contentType });
     *   const targetElement = document.findElementById('my-image-element');
     *   targetElement.src = window.URL.createObjectURL(blob);
     * });
     * ```
     */
    getFile(path, maxAge) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.getFile must be a string');
            }
            return this.storage.get(this.makePath(path), maxAge).then((r) => {
                return {
                    data: r.body,
                    contentType: r.contentType,
                    revision: r.revision // (this is new)
                };
            });
        });
    }
    /**
     * Store raw data at a given path.
     *
     * @param contentType - Content type (MIME media type) of the data being stored
     * @param path        - Path relative to the module root
     * @param body        - Raw data to store. For binary data, use an `ArrayBuffer`
     *                      or `ArrayBufferView` (e.g. `Uint8Array`), not a binary string.
     *
     * @returns A promise for the created/updated revision (ETag)
     *
     * @example
     * UTF-8 data:
     *
     * ```js
     * client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>')
     *       .then(() => { console.log("File saved") });
     * ```
     *
     * Binary data:
     *
     * ```js
     * const input = document.querySelector('form#upload input[type=file]');
     * const file = input.files[0];
     * const fileReader = new FileReader();
     *
     * fileReader.onload = function () {
     *   client.storeFile(file.type, file.name, fileReader.result)
     *         .then(() => { console.log("File saved") });
     * };
     *
     * fileReader.readAsArrayBuffer(file);
     * ```
     */
    storeFile(contentType, path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof contentType !== 'string') {
                return Promise.reject('Argument \'contentType\' of baseClient.storeFile must be a string');
            }
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.storeFile must be a string');
            }
            if ((typeof body !== 'string') && (typeof body !== 'object')) {
                return Promise.reject('Argument \'body\' of baseClient.storeFile must be a string, ArrayBuffer, or ArrayBufferView');
            }
            if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
                console.warn('WARNING: Editing a document to which only read access (\'r\') was claimed');
            }
            return this.storage.put(this.makePath(path), body, contentType).then((r) => {
                if (r.statusCode === 200 || r.statusCode === 201) {
                    return r.revision;
                }
                else {
                    return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
                }
            });
        });
    }
    /**
     * Get a JSON object from the given path.
     *
     * @param path - Relative path from the module root (without leading slash).
     * @param maxAge - (optional) Either `false` or the maximum age of
     *                 cached object in milliseconds. See [caching logic for read
     *                 operations](#caching-logic-for-read-operations).
     *
     * @returns A promise, resolving with the requested object, or `null` if non-existent
     *
     * @example
     * client.getObject('/path/to/object').then(obj => console.log(obj));
     */
    // TODO add real return type
    getObject(path, maxAge) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.getObject must be a string');
            }
            return this.storage.get(this.makePath(path), maxAge).then((r) => {
                if (typeof r.body === 'object') { // will be the case for documents stored with rs.js <= 0.10.0-beta2
                    return r.body;
                }
                else if (typeof r.body === 'string') {
                    try {
                        return JSON.parse(r.body);
                    }
                    catch (e) {
                        throw new Error("Not valid JSON: " + this.makePath(path));
                    }
                }
                else if (typeof r.body !== 'undefined' && r.statusCode === 200) {
                    return Promise.reject("Not an object: " + this.makePath(path));
                }
            });
        });
    }
    /**
     * Store an object at given path. Triggers synchronization. See {@link
     * declareType} and
     * [Defining data types](../../../data-modules/defining-data-types)
     * for info on object types.
     *
     * Must not be called more than once per second for any given `path`.
     *
     * @param typeAlias - Unique type of this object within this module.
     * @param path      - Path relative to the module root.
     * @param object    - A JavaScript object to be stored at the given path.
     *                    Must be serializable as JSON.
     *
     * @returns Resolves with revision on success. Rejects with an error object,
     *          if schema validations fail.
     *
     * @example
     * const bookmark = {
     *   url: 'http://unhosted.org',
     *   description: 'Unhosted Adventures',
     *   tags: ['unhosted', 'remotestorage', 'no-backend']
     * }
     * const path = MD5Hash(bookmark.url);
  
     * client.storeObject('bookmark', path, bookmark)
     *       .then(() => console.log('bookmark saved'))
     *       .catch((err) => console.log(err));
     */
    storeObject(typeAlias, path, object) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof typeAlias !== 'string') {
                return Promise.reject('Argument \'typeAlias\' of baseClient.storeObject must be a string');
            }
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.storeObject must be a string');
            }
            if (typeof object !== 'object') {
                return Promise.reject('Argument \'object\' of baseClient.storeObject must be an object');
            }
            this._attachType(object, typeAlias);
            try {
                const validationResult = this.validate(object);
                if (!validationResult.valid) {
                    return Promise.reject(validationResult);
                }
            }
            catch (exc) {
                return Promise.reject(exc);
            }
            return this.storage.put(this.makePath(path), JSON.stringify(object), 'application/json; charset=UTF-8').then((r) => {
                if (r.statusCode === 200 || r.statusCode === 201) {
                    return r.revision;
                }
                else {
                    return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
                }
            });
        });
    }
    /**
     * Remove node at given path from storage. Triggers synchronization.
     *
     * @param path - Path relative to the module root.
     *
     * @example
     * client.remove('path/to/object').then(() => console.log('item deleted'));
     */
    // TODO Don't return the RemoteResponse directly, handle response properly
    remove(path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.remove must be a string');
            }
            if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
                console.warn('WARNING: Removing a document to which only read access (\'r\') was claimed');
            }
            return this.storage.delete(this.makePath(path), this.storage.connected);
        });
    }
    /**
     * Retrieve full URL of a document. Useful for example for sharing the public
     * URL of an item in the ``/public`` folder.
     *
     * @param path - Path relative to the module root.
     *
     * @returns A promise resolving to the full URL of the item, or `undefined`
     *          if no remote storage is connected. For standard remoteStorage
     *          backends the URL is derived from the server's base href. For
     *          cloud backends (Dropbox, Google Drive) a share link is fetched
     *          or created via the provider's API.
     */
    getItemURL(path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                throw 'Argument \'path\' of baseClient.getItemURL must be a string';
            }
            if (!this.storage.connected) {
                return undefined;
            }
            if (typeof this.storage.remote.getItemURL === 'function') {
                return this.storage.remote.getItemURL(this.makePath(path));
            }
            // Standard remoteStorage backend: href is a plain base URL
            return this.storage.remote.href + (0, util_1.cleanPath)(this.makePath(path));
        });
    }
    /**
     * Set caching strategy for a given path and its children.
     *
     * See [Caching strategies](../../caching/classes/Caching.html#caching-strategies)
     * for a detailed description of the available strategies.
     *
     * @param path - Path to cache
     * @param strategy - Caching strategy. One of 'ALL', 'SEEN', or FLUSH'.
     *                   Defaults to 'ALL'.
     *
     * @returns The same `BaseClient` instance this method is called on to allow
     *          for method chaining
     *
     * @example
     * client.cache('lists/', 'SEEN');
     */
    cache(path, strategy = 'ALL') {
        if (typeof path !== 'string') {
            throw 'Argument \'path\' of baseClient.cache must be a string';
        }
        if (typeof strategy !== 'string') {
            throw 'Argument \'strategy\' of baseClient.cache must be a string or undefined';
        }
        if (strategy !== 'FLUSH' &&
            strategy !== 'SEEN' &&
            strategy !== 'ALL') {
            throw 'Argument \'strategy\' of baseclient.cache must be one of '
                + '["FLUSH", "SEEN", "ALL"]';
        }
        this.storage.caching.set(this.makePath(path), strategy);
        return this;
    }
    /**
     * Declare a remoteStorage object type using a JSON Schema. Visit
     * [json-schema.org](http://json-schema.org) for details.
     *
     * See [Defining data types](../../../data-modules/defining-data-types) for more info.
     *
     * @param alias       - A type alias/shortname
     * @param uriOrSchema - JSON-LD URI of the schema, or a JSON Schema object.
     *                      The URI is automatically generated if none given.
     * @param schema      - (optional) A JSON Schema object describing the object type
     *
     * @example
     * client.declareType('todo-item', {
     *   "type": "object",
     *   "properties": {
     *     "id": {
     *       "type": "string"
     *     },
     *     "title": {
     *       "type": "string"
     *     },
     *     "finished": {
     *       "type": "boolean"
     *       "default": false
     *     },
     *     "createdAt": {
     *       "type": "date"
     *     }
     *   },
     *   "required": ["id", "title"]
     * })
     **/
    declareType(alias, uriOrSchema, schema) {
        let uri;
        if (schema && typeof uriOrSchema === 'string') {
            uri = uriOrSchema;
        }
        else if (!schema && typeof uriOrSchema !== 'string') {
            schema = uriOrSchema;
            uri = this._defaultTypeURI(alias);
        }
        else if (!schema && typeof uriOrSchema === 'string') {
            throw new Error('declareType() requires a JSON Schema object to be passed, in order to validate object types/formats');
        }
        BaseClient.Types.declare(this.moduleName, alias, uri, schema);
    }
    /**
     * Validate an object against the associated schema.
     *
     * @param object - JS object to validate. Must have a `@context` property.
     *
     * @returns An object containing information about the validation result
     *
     * @example
     * var result = client.validate(document);
     *
     * // result:
     * // {
     * //   error: null,
     * //   missing: [],
     * //   valid: true
     * // }
     **/
    validate(object) {
        const schema = BaseClient.Types.getSchema(object['@context']);
        if (schema) {
            return tv4_1.default.validateResult(object, schema);
        }
        else {
            throw new schema_not_found_error_1.default(object['@context']);
        }
    }
    /**
     * The default JSON-LD @context URL for RS types/objects/documents
     *
     * @private
     */
    _defaultTypeURI(alias) {
        return 'http://remotestorage.io/spec/modules/' + encodeURIComponent(this.moduleName) + '/' + encodeURIComponent(alias);
    }
    /**
     * Attaches the JSON-LD @context to an object
     *
     * @private
     */
    _attachType(object, alias) {
        object['@context'] = BaseClient.Types.resolveAlias(this.moduleName + '/' + alias) || this._defaultTypeURI(alias);
    }
    /**
     * TODO: document
     *
     * @private
     */
    makePath(path) {
        return this.base + (path || '');
    }
    /**
     * TODO: document
     *
     * @private
     */
    _fireChange(event) {
        if (config_1.default.changeEvents[event.origin]) {
            ['new', 'old', 'lastCommon'].forEach(function (fieldNamePrefix) {
                if ((!event[fieldNamePrefix + 'ContentType'])
                    || (/^application\/(.*)json(.*)/.exec(event[fieldNamePrefix + 'ContentType']))) {
                    if (typeof event[fieldNamePrefix + 'Value'] === 'string') {
                        try {
                            event[fieldNamePrefix + 'Value'] = JSON.parse(event[fieldNamePrefix + 'Value']);
                        }
                        catch (e) {
                            // empty
                        }
                    }
                }
            });
            this._emit('change', event);
        }
    }
    static _rs_init() {
        return;
    }
}
exports.BaseClient = BaseClient;
BaseClient.Types = types_1.default;
(0, util_1.applyMixins)(BaseClient, [eventhandling_1.default]);
exports["default"] = BaseClient;


/***/ }),

/***/ "./src/caching.ts":
/*!************************!*\
  !*** ./src/caching.ts ***!
  \************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Caching = void 0;
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
/**
 * @class
 *
 * The caching class gets initialized as `remoteStorage.caching`, unless the
 * {@link remotestorage!RemoteStorage RemoteStorage} instance is created with
 * the option `cache: false`, disabling caching entirely.
 *
 * In case your app hasn't explictly configured caching, the default setting is to
 * cache any documents that have been either created or requested since your app
 * loaded. For offline-capable apps, it usually makes sense to enable full,
 * automatic caching of all documents, which is what {@link enable} will do.
 *
 * Enabling full caching has several benefits:
 *
 * * Speed of access: locally cached data is available to the app a lot faster.
 * * Offline mode: when all data is cached, it can also be read when your app
 *   starts while being offline.
 * * Initial synchronization time: the amount of data your app caches can
 *   have a significant impact on its startup time.
 *
 * Caching can be configured on a per-path basis. When caching is enabled for a
 * folder, it causes all subdirectories to be cached as well.
 *
 * ## Caching strategies
 *
 * For each subtree, you can set the caching strategy to ``ALL``, ``SEEN``
 * (default), and ``FLUSH``.
 *
 * * `ALL` means that once all outgoing changes have been pushed, sync will
 *   start retrieving nodes to cache pro-actively. If a local copy exists
 *   of everything, it will check on each sync whether the ETag of the root
 *   folder changed, and retrieve remote changes if they exist.
 * * `SEEN` does this only for documents and folders that have been either
 *   read from or written to at least once since connecting to the current
 *   remote backend, plus their parent/ancestor folders up to the root (to
 *   make tree-based sync possible).
 * * `FLUSH` will only cache outgoing changes, and forget them as soon as
 *   they have been saved to remote successfully.
 **/
class Caching {
    constructor(remoteStorage) {
        this.pendingActivations = [];
        this._access = remoteStorage.access;
        this.reset();
    }
    /**
     * Configure caching for a given path explicitly.
     *
     * Not needed when using ``enable``/``disable``.
     *
     * @param path - Path to cache
     * @param strategy - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
     *
     * @example
     * ```js
     * remoteStorage.caching.set('/bookmarks/archive/', 'SEEN');
     * ```
     */
    set(path, strategy) {
        if (typeof path !== 'string') {
            throw new Error('path should be a string');
        }
        if (!(0, util_1.isFolder)(path)) {
            throw new Error('path should be a folder');
        }
        if (!this._access.checkPathPermission(path, 'r')) {
            throw new Error('No access to path "' + path + '". You must claim access to it first.');
        }
        if (typeof strategy === 'undefined' || !strategy.match(/^(FLUSH|SEEN|ALL)$/)) {
            throw new Error("strategy should be 'FLUSH', 'SEEN', or 'ALL'");
        }
        this._rootPaths[path] = strategy;
        if (strategy === 'ALL') {
            if (this.activateHandler) {
                this.activateHandler(path);
            }
            else {
                this.pendingActivations.push(path);
            }
        }
    }
    /**
     * Enable caching for a given path.
     *
     * Uses caching strategy ``ALL``.
     *
     * @param path - Path to enable caching for
     * @returns
     *
     * @example
     * ```js
     * remoteStorage.caching.enable('/bookmarks/');
     * ```
     */
    enable(path) {
        this.set(path, 'ALL');
    }
    /**
     * Disable caching for a given path.
     *
     * Uses caching strategy ``FLUSH`` (meaning items are only cached until
     * successfully pushed to the remote).
     *
     * @param path - Path to disable caching for
     *
     * @example
     * ```js
     * remoteStorage.caching.disable('/bookmarks/');
     * ```
     */
    disable(path) {
        this.set(path, 'FLUSH');
    }
    /**
     * Set a callback for when caching is activated for a path.
     *
     * @param cb - Callback function
     */
    onActivate(cb) {
        (0, log_1.default)('[Caching] Setting activate handler', cb, this.pendingActivations);
        this.activateHandler = cb;
        for (let i = 0; i < this.pendingActivations.length; i++) {
            cb(this.pendingActivations[i]);
        }
        this.pendingActivations = [];
    }
    /**
     * Reset activation state for sync lifecycle cleanup.
     *
     * @internal
     */
    resetActivationHandler() {
        this.activateHandler = undefined;
        this.pendingActivations = [];
    }
    /**
     * Retrieve caching setting for a given path, or its next parent
     * with a caching strategy set.
     *
     * @param path - Path to retrieve setting for
     * @returns caching strategy for the path
     *
     * @example
     * ```js
     * remoteStorage.caching.checkPath('documents/').then(strategy => {
     *   console.log(`caching strategy for 'documents/': ${strategy}`);
     *   // "caching strategy for 'documents/': SEEN"
     * });
     * ```
     **/
    checkPath(path) {
        if (this._rootPaths[path] !== undefined) {
            return this._rootPaths[path];
        }
        else if (path === '/') {
            return 'SEEN';
        }
        else {
            return this.checkPath((0, util_1.containingFolder)(path));
        }
    }
    /**
     * Reset the state of caching by deleting all caching information.
     *
     * @example
     * ```js
     * remoteStorage.caching.reset();
     * ```
     **/
    reset() {
        this._rootPaths = {};
    }
    /**
     * Setup function that is called on initialization.
     *
     * @internal
     **/
    static _rs_init( /*remoteStorage*/) {
        return;
    }
}
exports.Caching = Caching;
exports["default"] = Caching;


/***/ }),

/***/ "./src/cachinglayer.ts":
/*!*****************************!*\
  !*** ./src/cachinglayer.ts ***!
  \*****************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const env_1 = __importDefault(__webpack_require__(/*! ./env */ "./src/env.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
function getLatest(node) {
    if (typeof (node) !== 'object' || typeof (node.path) !== 'string') {
        return;
    }
    if ((0, util_1.isFolder)(node.path)) {
        if (node.local && node.local.itemsMap) {
            return node.local;
        }
        if (node.common && node.common.itemsMap) {
            return node.common;
        }
    }
    else {
        if (node.local) {
            if (node.local.body && node.local.contentType) {
                return node.local;
            }
            if (node.local.body === false) {
                return;
            }
        }
        if (node.common && node.common.body && node.common.contentType) {
            return node.common;
        }
    }
}
function isOutdated(nodes, maxAge) {
    for (const path in nodes) {
        if (nodes[path] && nodes[path].remote) {
            return true;
        }
        const nodeVersion = getLatest(nodes[path]);
        if (nodeVersion && nodeVersion.timestamp && (new Date().getTime()) - nodeVersion.timestamp <= maxAge) {
            return false;
        }
        else if (!nodeVersion) {
            return true;
        }
    }
    return true;
}
function makeNode(path) {
    const node = { path: path, common: {} };
    if ((0, util_1.isFolder)(path)) {
        node.common.itemsMap = {};
    }
    return node;
}
function updateFolderNodeWithItemName(node, itemName) {
    if (!node.common) {
        node.common = {
            itemsMap: {}
        };
    }
    if (!node.common.itemsMap) {
        node.common.itemsMap = {};
    }
    if (!node.local) {
        node.local = (0, util_1.deepClone)(node.common);
    }
    if (!node.local.itemsMap) {
        node.local.itemsMap = node.common.itemsMap;
    }
    node.local.itemsMap[itemName] = true;
    return node;
}
/**
 * This module defines functions that are mixed into remoteStorage.local when
 * it is instantiated (currently one of indexeddb.js, localstorage.js, or
 * inmemorystorage.js).
 *
 * All remoteStorage.local implementations should therefore implement
 * this.getNodes, this.setNodes, and this.forAllNodes. The rest is blended in
 * here to create a GPD (get/put/delete) interface which the BaseClient can
 * talk to.
 *
 * @interface
 */
class CachingLayer {
    constructor() {
        // FIXME
        // this process of updating nodes needs to be heavily documented first, then
        // refactored. Right now it's almost impossible to refactor as there's no
        // explanation of why things are implemented certain ways or what the goal(s)
        // of the behavior are. -slvrbckt (+1 -les)
        this._updateNodesRunning = false;
        this._updateNodesQueued = [];
        const env = new env_1.default();
        if (env.isBrowser() && !!util_1.globalContext["BroadcastChannel"]) {
            this.broadcastChannel = new BroadcastChannel('remotestorage:changes');
            // Listen for change events from other tabs, and re-emit here
            this.broadcastChannel.onmessage = (event) => {
                this.emitChange(event.data);
            };
        }
    }
    // --------------------------------------------------
    // TODO: improve our code structure so that this function
    // could call sync.queueGetRequest directly instead of needing
    // this hacky third parameter as a callback
    get(path, maxAge, queueGetRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof (maxAge) === 'number') {
                return this.getNodes((0, util_1.pathsFromRoot)(path))
                    .then((objs) => {
                    const item = getLatest(objs[path]);
                    if (isOutdated(objs, maxAge)) {
                        return queueGetRequest(path);
                    }
                    else if (item) {
                        return {
                            statusCode: 200,
                            body: item.body || item.itemsMap,
                            contentType: item.contentType
                        };
                    }
                    else {
                        return { statusCode: 404 };
                    }
                });
            }
            else {
                return this.getNodes([path])
                    .then((objs) => {
                    const item = getLatest(objs[path]);
                    if (item) {
                        if ((0, util_1.isFolder)(path)) {
                            for (const i in item.itemsMap) {
                                // the hasOwnProperty check here is only because our jshint settings require it:
                                if (item.itemsMap.hasOwnProperty(i) && item.itemsMap[i] === false) {
                                    delete item.itemsMap[i];
                                }
                            }
                        }
                        return {
                            statusCode: 200,
                            body: item.body || item.itemsMap,
                            contentType: item.contentType
                        };
                    }
                    else {
                        return { statusCode: 404 };
                    }
                });
            }
        });
    }
    put(path, body, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = (0, util_1.pathsFromRoot)(path);
            function _processNodes(nodePaths, nodes) {
                try {
                    for (let i = 0, len = nodePaths.length; i < len; i++) {
                        const nodePath = nodePaths[i];
                        let node = nodes[nodePath];
                        let previous;
                        if (!node) {
                            nodes[nodePath] = node = makeNode(nodePath);
                        }
                        // Document
                        if (i === 0) {
                            previous = getLatest(node);
                            node.local = {
                                body: body,
                                contentType: contentType,
                                previousBody: (previous ? previous.body : undefined),
                                previousContentType: (previous ? previous.contentType : undefined),
                            };
                        }
                        // Folder
                        else {
                            const itemName = nodePaths[i - 1].substring(nodePath.length);
                            node = updateFolderNodeWithItemName(node, itemName);
                        }
                    }
                    return nodes;
                }
                catch (e) {
                    (0, log_1.default)('[Cachinglayer] Error during PUT', nodes, e);
                    throw e;
                }
            }
            return this._updateNodes(paths, _processNodes);
        });
    }
    delete(path, remoteConnected) {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = (0, util_1.pathsFromRoot)(path);
            return this._updateNodes(paths, function (nodePaths, nodes) {
                for (let i = 0, len = nodePaths.length; i < len; i++) {
                    const nodePath = nodePaths[i];
                    const node = nodes[nodePath];
                    let previous;
                    if (!node) {
                        console.error('Cannot delete non-existing node ' + nodePath);
                        continue;
                    }
                    if (i === 0) {
                        // Document
                        previous = getLatest(node);
                        node.local = {
                            body: remoteConnected ? false : undefined,
                            previousBody: (previous ? previous.body : undefined),
                            previousContentType: (previous ? previous.contentType : undefined),
                        };
                    }
                    else {
                        // Folder
                        if (!node.local) {
                            node.local = (0, util_1.deepClone)(node.common);
                        }
                        const itemName = nodePaths[i - 1].substring(nodePath.length);
                        delete node.local.itemsMap[itemName];
                        if (Object.getOwnPropertyNames(node.local.itemsMap).length > 0) {
                            // This folder still contains other items, don't remove any further ancestors
                            break;
                        }
                    }
                }
                return nodes;
            });
        });
    }
    flush(path) {
        return this._getAllDescendentPaths(path).then((paths) => {
            return this.getNodes(paths);
        }).then((nodes) => {
            for (const nodePath in nodes) {
                const node = nodes[nodePath];
                if (node && node.common && node.local) {
                    this.emitChange({
                        path: node.path,
                        origin: 'local',
                        oldValue: (node.local.body === false ? undefined : node.local.body),
                        newValue: (node.common.body === false ? undefined : node.common.body)
                    });
                }
                nodes[nodePath] = undefined;
            }
            return this.setNodes(nodes);
        });
    }
    /**
     * Emit a change event
     */
    emitChange(obj) {
        if (config_1.default.changeEvents[obj.origin]) {
            this._emit('change', obj);
        }
    }
    fireInitial() {
        if (!config_1.default.changeEvents.local) {
            return;
        }
        this.forAllNodes((node) => {
            if ((0, util_1.isDocument)(node.path)) {
                const latest = getLatest(node);
                if (latest) {
                    this.emitChange({
                        path: node.path,
                        origin: 'local',
                        oldValue: undefined,
                        oldContentType: undefined,
                        newValue: latest.body,
                        newContentType: latest.contentType
                    });
                }
            }
        }).then(() => {
            this._emit('local-events-done');
        });
    }
    // TODO add proper type
    onDiff(diffHandler) {
        this.diffHandler = diffHandler;
    }
    _updateNodes(paths, _processNodes) {
        return new Promise((resolve, reject) => {
            this._doUpdateNodes(paths, _processNodes, {
                resolve: resolve,
                reject: reject
            });
        });
    }
    _doUpdateNodes(paths, _processNodes, promise) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._updateNodesRunning) {
                this._updateNodesQueued.push({
                    paths: paths,
                    cb: _processNodes,
                    promise: promise
                });
                return;
            }
            this._updateNodesRunning = true;
            try {
                let nodes = yield this.getNodes(paths);
                const existingNodes = (0, util_1.deepClone)(nodes);
                const changeEvents = [];
                nodes = _processNodes(paths, nodes);
                for (const path in nodes) {
                    const node = nodes[path];
                    if ((0, util_1.equal)(node, existingNodes[path])) {
                        delete nodes[path];
                    }
                    else if ((0, util_1.isDocument)(path)) {
                        if (!(0, util_1.equal)(node.local.body, node.local.previousBody) ||
                            node.local.contentType !== node.local.previousContentType) {
                            changeEvents.push({
                                path: path,
                                origin: 'window',
                                oldValue: node.local.previousBody,
                                newValue: node.local.body === false ? undefined : node.local.body,
                                oldContentType: node.local.previousContentType,
                                newContentType: node.local.contentType
                            });
                        }
                        if (node.local.body === undefined) {
                            // no remote connected, remove deleted node from cache immediately
                            nodes[path] = undefined;
                        }
                        else {
                            delete node.local.previousBody;
                            delete node.local.previousContentType;
                        }
                    }
                }
                yield this.setNodes(nodes);
                this._emitChangeEvents(changeEvents);
                promise.resolve({ statusCode: 200 });
            }
            catch (err) {
                promise.reject(err);
            }
            this._updateNodesRunning = false;
            const nextJob = this._updateNodesQueued.shift();
            if (nextJob) {
                yield this._doUpdateNodes(nextJob.paths, nextJob.cb, nextJob.promise);
            }
        });
    }
    _emitChangeEvents(events) {
        for (let i = 0, len = events.length; i < len; i++) {
            const change = events[i];
            this.emitChange(change);
            if (this.diffHandler) {
                this.diffHandler(change.path);
            }
            if (!!this.broadcastChannel && change.origin === "window") {
                this.broadcastChannel.postMessage(change); // Broadcast to other tabs
            }
        }
    }
    _getAllDescendentPaths(path) {
        if ((0, util_1.isFolder)(path)) {
            return this.getNodes([path]).then((nodes) => {
                const allPaths = [path];
                const latest = getLatest(nodes[path]);
                const itemNames = Object.keys(latest.itemsMap);
                const calls = itemNames.map((itemName) => {
                    return this._getAllDescendentPaths(path + itemName).then((paths) => {
                        for (let i = 0, len = paths.length; i < len; i++) {
                            allPaths.push(paths[i]);
                        }
                    });
                });
                return Promise.all(calls).then(() => {
                    return allPaths;
                });
            });
        }
        else {
            return Promise.resolve([path]);
        }
    }
    // treated as private but made public for unit testing
    _getInternals() {
        return {
            getLatest: getLatest,
            makeNode: makeNode,
            isOutdated: isOutdated
        };
    }
}
(0, util_1.applyMixins)(CachingLayer, [eventhandling_1.default]);
module.exports = CachingLayer;


/***/ }),

/***/ "./src/config.ts":
/*!***********************!*\
  !*** ./src/config.ts ***!
  \***********************/
/***/ (function(module) {

"use strict";

/**
 * The default config, merged with the object passed to the constructor of the
 * RemoteStorage object
 */
const config = {
    cache: true,
    changeEvents: {
        local: true,
        window: false,
        remote: true,
        conflict: true
    },
    cordovaRedirectUri: undefined,
    logging: false,
    modules: [],
    // the following are not public and will probably be moved away from the
    // default config
    backgroundSyncInterval: 60000,
    disableFeatures: [],
    discoveryTimeout: 5000,
    isBackground: false,
    requestTimeout: 30000,
    syncInterval: 10000
};
module.exports = config;


/***/ }),

/***/ "./src/discover.ts":
/*!*************************!*\
  !*** ./src/discover.ts ***!
  \*************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const webfinger_js_1 = __importDefault(__webpack_require__(/*! webfinger.js */ "./node_modules/webfinger.js/dist/webfinger.cjs"));
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
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
const Discover = function Discover(userAddress) {
    if (userAddress in cachedInfo) {
        return Promise.resolve(cachedInfo[userAddress]);
    }
    const webFinger = new webfinger_js_1.default({
        tls_only: false,
        uri_fallback: true,
        request_timeout: config_1.default.discoveryTimeout
    });
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error('timed out'));
        }, config_1.default.discoveryTimeout);
    });
    return Promise.race([
        webFinger.lookup(userAddress),
        timeoutPromise
    ]).then(response => {
        clearTimeout(timer);
        if ((typeof response.idx.links.remotestorage !== 'object') ||
            (typeof response.idx.links.remotestorage.length !== 'number') ||
            (response.idx.links.remotestorage.length <= 0)) {
            (0, log_1.default)("[Discover] WebFinger record for " + userAddress + " does not have remotestorage defined in the links section ", JSON.stringify(response.object));
            throw new Error("WebFinger record for " + userAddress + " does not have remotestorage defined in the links section.");
        }
        const rs = response.idx.links.remotestorage[0];
        const properties = rs.properties || {};
        const authURL = properties['http://tools.ietf.org/html/rfc6749#section-4.2'] ||
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
Discover.DiscoveryError = function (message) {
    this.name = 'DiscoveryError';
    this.message = message;
    this.stack = (new Error()).stack;
};
Discover.DiscoveryError.prototype = Object.create(Error.prototype);
Discover.DiscoveryError.prototype.constructor = Discover.DiscoveryError;
Discover._rs_init = function ( /*remoteStorage*/) {
    hasLocalStorage = (0, util_1.localStorageAvailable)();
    if (hasLocalStorage) {
        const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (settings) {
            cachedInfo = settings.cache;
        }
    }
};
Discover._rs_supported = function () {
    return Object.prototype.hasOwnProperty.call(util_1.globalContext, 'fetch') ||
        Object.prototype.hasOwnProperty.call(util_1.globalContext, 'XMLHttpRequest');
};
Discover._rs_cleanup = function () {
    if (hasLocalStorage) {
        localStorage.removeItem(SETTINGS_KEY);
    }
};
module.exports = Discover;


/***/ }),

/***/ "./src/dropbox.ts":
/*!************************!*\
  !*** ./src/dropbox.ts ***!
  \************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const revisioncache_1 = __importDefault(__webpack_require__(/*! ./revisioncache */ "./src/revisioncache.ts"));
const sync_error_1 = __importDefault(__webpack_require__(/*! ./sync-error */ "./src/sync-error.ts"));
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
const remote_1 = __webpack_require__(/*! ./remote */ "./src/remote.ts");
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
/**
 * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
 *
 * Dropbox backend for RemoteStorage.js
 * This file exposes a get/put/delete interface which is compatible with
 * <WireClient>.
 *
 * When remoteStorage.backend is set to 'dropbox', this backend will
 * initialize and replace remoteStorage.remote with remoteStorage.dropbox.
 *
 * Files stored under the ``/public/`` folder can be shared via
 * <BaseClient.getItemURL>, which returns a Dropbox shared link URL.
 *
 * To use this backend, you need to specify the Dropbox app key like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   dropbox: 'your-app-key'
 * });
 *
 * An app key can be obtained by registering your app at https://www.dropbox.com/developers/apps
 *
 * Known issues:
 *
 *   - Storing files larger than 150MB is not yet supported
 *   - Listing and deleting folders with more than 10'000 files will cause problems
 *   - Content-Type is not supported; TODO: use file_properties
 *   - Dropbox preserves cases but is not case-sensitive
 *   - Authorizing a new app requires the ``sharing.write`` OAuth scope
 */
let hasLocalStorage;
const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const OAUTH_SCOPE = 'account_info.read files.content.read files.content.write files.metadata.read files.metadata.write sharing.read sharing.write';
const SETTINGS_KEY = 'remotestorage:dropbox';
const FOLDER_URL = 'https://api.dropboxapi.com/2/files/list_folder';
const CONTINUE_URL = 'https://api.dropboxapi.com/2/files/list_folder/continue';
const DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';
const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DELETE_URL = 'https://api.dropboxapi.com/2/files/delete';
const METADATA_URL = 'https://api.dropboxapi.com/2/files/get_metadata';
const CREATE_SHARED_URL = 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings';
const LIST_SHARED_URL = 'https://api.dropbox.com/2/sharing/list_shared_links';
const PATH_PREFIX = '/remotestorage';
const NUM_RETRIES = 3;
/**
 * Maps a remoteStorage path to a path in Dropbox.
 *
 * @param {string} path - Path
 * @returns {string} Actual path in Dropbox
 *
 * @private
 */
function getDropboxPath(path) {
    return (PATH_PREFIX + '/' + path).replace(/\/+$/, '').replace(/\/+/g, '/');
}
// This function is simple and has OK performance compared to more
// complicated ones: https://jsperf.com/json-escape-unicode/4
const charsToEncode = /[\u007f-\uffff]/g;
function httpHeaderSafeJson(obj) {
    return JSON.stringify(obj).replace(charsToEncode, function (c) {
        return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
}
function compareApiError(response, expect) {
    return new RegExp('^' + expect.join('\\/') + '(\\/|$)').test(response.error_summary);
}
function isBinaryData(data) {
    return data instanceof ArrayBuffer || (0, requests_1.isArrayBufferView)(data);
}
/**
 * @class
 */
class Dropbox extends remote_1.RemoteBase {
    constructor(rs) {
        super(rs);
        this.online = true; // TODO implement offline detection on failed request
        this.storageApi = 'draft-dejong-remotestorage-19';
        this._initialFetchDone = false;
        this.addEvents(['connected', 'not-connected']);
        this.clientId = rs.apiKeys.dropbox.appKey;
        this.TOKEN_URL = TOKEN_URL;
        this._revCache = new revisioncache_1.default('rev');
        this._fetchDeltaCursor = null;
        this._fetchDeltaPromise = null;
        this._itemRefs = {};
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (hasLocalStorage) {
            const settings = (0, util_1.getJSONFromLocalStorage)(SETTINGS_KEY);
            if (settings) {
                this.configure(settings); // can't await in constructor
            }
            this._itemRefs = (0, util_1.getJSONFromLocalStorage)(`${SETTINGS_KEY}:shares`) || {};
        }
        if (this.connected) {
            setTimeout(this._emit.bind(this), 0, 'connected');
        }
    }
    /**
     * Set the backed to 'dropbox' and start the authentication flow in order
     * to obtain an API token from Dropbox.
     */
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO handling when token is already present
            try {
                this.rs.setBackend('dropbox');
                if (this.token) {
                    hookIt(this.rs);
                }
                else { // OAuth2 PKCE
                    const { codeVerifier, codeChallenge, state } = yield (0, util_1.generateCodeVerifier)();
                    sessionStorage.setItem('remotestorage:codeVerifier', codeVerifier);
                    sessionStorage.setItem('remotestorage:state', state);
                    this.rs.authorize({
                        authURL: AUTH_URL,
                        scope: OAUTH_SCOPE,
                        clientId: this.clientId,
                        response_type: 'code',
                        state: state,
                        code_challenge: codeChallenge,
                        code_challenge_method: 'S256',
                        token_access_type: 'offline'
                    });
                }
            }
            catch (err) {
                this.rs._emit('error', err);
                this.rs.setBackend(undefined);
                throw err;
            }
        });
    }
    /**
     * Sets the connected flag
     * Accepts its parameters according to the <WireClient>.
     * @param {Object} settings
     * @param {string} [settings.userAddress] - The user's email address
     * @param {string} [settings.token] - Authorization token
     * @param {string} [settings.refreshToken] - OAuth2 PKCE refresh token
     * @param {string} [settings.tokenType] - usually 'bearer' - no support for 'mac' tokens yet
     *
     * @protected
     **/
    configure(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            // We only update this.userAddress if settings.userAddress is set to a string or to null:
            if (typeof settings.userAddress !== 'undefined') {
                this.userAddress = settings.userAddress;
            }
            // Same for this.token. If only one of these two is set, we leave the other one at its existing value:
            if (typeof settings.token !== 'undefined') {
                this.token = settings.token;
            }
            if (typeof settings.refreshToken !== 'undefined') {
                this.refreshToken = settings.refreshToken;
            }
            if (typeof settings.tokenType !== 'undefined') {
                this.tokenType = settings.tokenType;
            }
            const writeSettingsToCache = () => {
                if (hasLocalStorage) {
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                        userAddress: this.userAddress,
                        token: this.token,
                        refreshToken: this.refreshToken,
                        tokenType: this.tokenType,
                    }));
                }
            };
            const handleError = () => {
                this.connected = false;
                if (hasLocalStorage) {
                    localStorage.removeItem(SETTINGS_KEY);
                }
                this.rs.setBackend(undefined);
            };
            if (this.refreshToken || this.token) {
                this.connected = true;
                if (this.userAddress) {
                    this._emit('connected');
                    writeSettingsToCache();
                }
                else {
                    try {
                        const info = yield this.info();
                        this.userAddress = info.email;
                        this._emit('connected');
                        writeSettingsToCache();
                    }
                    catch (err) {
                        this.connected = false;
                        this.rs._emit('error', new Error('Could not fetch user info.'));
                        writeSettingsToCache.apply(this);
                    }
                }
            }
            else {
                handleError();
            }
        });
    }
    /**
     * Get all items in a folder.
     *
     * @param path {string} - path of the folder to get, with leading slash
     * @return {Object}
     *         statusCode - HTTP status code
     *         body - array of the items found
     *         contentType - 'application/json; charset=UTF-8'
     *         revision - revision of the folder
     *
     * @private
     */
    _getFolder(path) {
        const revCache = this._revCache;
        const processResponse = (resp) => {
            let body;
            if (resp.status !== 200 && resp.status !== 409) {
                return Promise.reject('Unexpected response status: ' + resp.status);
            }
            try {
                body = JSON.parse(resp.responseText);
            }
            catch (e) {
                return Promise.reject(e);
            }
            if (resp.status === 409) {
                if (compareApiError(body, ['path', 'not_found'])) {
                    // if the folder is not found, handle it as an empty folder
                    return Promise.resolve({});
                }
                return Promise.reject(new Error('API returned an error: ' + body.error_summary));
            }
            const listing = body.entries.reduce((map, item) => {
                try {
                    const isDir = item['.tag'] === 'folder';
                    const itemName = item.path_display.split('/').slice(-1)[0] + (isDir ? '/' : '');
                    if (isDir) {
                        map[itemName] = { ETag: revCache.get(path + itemName) };
                    }
                    else {
                        const date = new Date(item.server_modified);
                        map[itemName] = { ETag: item.rev, 'Content-Length': item.size, 'Last-Modified': date.toUTCString() };
                        this._revCache.set(path + itemName, item.rev);
                    }
                }
                catch (err) {
                    console.error(`[Dropbox] folder “${path}” has entry ${JSON.stringify(item)}:`, err);
                }
                return map;
            }, {});
            if (body.has_more) {
                return loadNext(body.cursor).then(function (nextListing) {
                    return Object.assign(listing, nextListing);
                });
            }
            return Promise.resolve(listing);
        };
        const loadNext = (cursor) => {
            const params = {
                body: { cursor: cursor }
            };
            return this._request('POST', CONTINUE_URL, params).then(processResponse);
        };
        return this._request('POST', FOLDER_URL, {
            body: {
                path: getDropboxPath(path)
            }
        }).then(processResponse).then(function (listing) {
            return Promise.resolve({
                statusCode: 200,
                body: listing,
                contentType: 'application/json; charset=UTF-8',
                revision: revCache.get(path)
            });
        });
    }
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed. Calls ``_getFolder`` is the path points to a folder.
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * Compatible with ``WireClient.get``
     *
     * @param path {string} - path of the folder to get, with leading slash
     * @param options {Object}
     *
     * @protected
     */
    get(path, options = {}) {
        if (!this.connected) {
            return Promise.reject("not connected (path: " + path + ")");
        }
        const savedRev = this._revCache.get(path);
        if (savedRev === null) {
            // file was deleted server side
            return Promise.resolve({ statusCode: 404 });
        }
        if (options && options.ifNoneMatch) {
            // We must wait for local revision cache to be initialized before
            // checking if local revision is outdated
            if (!this._initialFetchDone) {
                return this.fetchDelta().then(() => {
                    return this.get(path, options);
                });
            }
            if (savedRev && (savedRev === options.ifNoneMatch)) {
                // nothing changed.
                return Promise.resolve({ statusCode: 304 });
            }
        }
        // use _getFolder for folders
        if (path.slice(-1) === '/') {
            return this._getFolder(path);
        }
        const params = {
            headers: {
                'Dropbox-API-Arg': httpHeaderSafeJson({ path: getDropboxPath(path) }),
            },
            responseType: 'arraybuffer'
        };
        if (options && options.ifNoneMatch) {
            params.headers['If-None-Match'] = options.ifNoneMatch;
        }
        return this._request('GET', DOWNLOAD_URL, params).then(resp => {
            const status = resp.status;
            let meta, body, mime, rev;
            if (status !== 200 && status !== 409) {
                return Promise.resolve({ statusCode: status });
            }
            meta = resp.getResponseHeader('Dropbox-API-Result');
            //first encode the response as text, and later check if
            //text appears to actually be binary data
            return (0, util_1.getTextFromArrayBuffer)(resp.response, 'UTF-8').then(responseText => {
                body = responseText;
                if (status === 409) {
                    meta = body;
                }
                try {
                    meta = JSON.parse(meta);
                }
                catch (e) {
                    return Promise.reject(e);
                }
                if (status === 409) {
                    if (compareApiError(meta, ['path', 'not_found'])) {
                        return { statusCode: 404 };
                    }
                    return Promise.reject(new Error('API error while downloading file ("' + path + '"): ' + meta.error_summary));
                }
                mime = resp.getResponseHeader('Content-Type');
                rev = meta.rev;
                this._revCache.set(path, rev);
                this._shareIfNeeded(path); // There doesn't appear to be a need to await this.
                if ((0, util_1.shouldBeTreatedAsBinary)(responseText, mime)) {
                    // return unprocessed response
                    body = resp.response;
                }
                else {
                    // handling json (always try)
                    try {
                        body = JSON.parse(body);
                        mime = 'application/json; charset=UTF-8';
                    }
                    catch (e) {
                        //Failed parsing Json, assume it is something else then
                    }
                }
                return {
                    statusCode: status,
                    body: body,
                    contentType: mime,
                    revision: rev
                };
            });
        });
    }
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed.
     *
     * Compatible with ``WireClient``
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * @param {string} path - path of the folder to put, with leading slash
     * @param {XMLHttpRequestBodyInit} body - Blob | BufferSource | FormData | URLSearchParams | string
     * @param {string} contentType - MIME type of body
     * @param {Object} options
     * @param {string} options.ifNoneMatch - When *, only create or update the file if it doesn't yet exist
     * @param {string} options.ifMatch - Only saves if this matches current revision
     * @returns {Promise} Resolves with an object containing the status code,
     *                    content-type and revision
     * @protected
     */
    put(path_1, body_1, contentType_1) {
        return __awaiter(this, arguments, void 0, function* (path, body, contentType, options = {}) {
            if (!this.connected) {
                throw new Error("not connected (path: " + path + ")");
            }
            // check if file has changed and return 412
            const savedRev = this._revCache.get(path);
            if (options && options.ifMatch &&
                savedRev && (savedRev !== options.ifMatch)) {
                return { statusCode: 412, revision: savedRev };
            }
            if (options && (options.ifNoneMatch === '*') &&
                savedRev && (savedRev !== 'rev')) {
                return { statusCode: 412, revision: savedRev };
            }
            if ((!contentType.match(/charset=/)) && isBinaryData(body)) {
                contentType += '; charset=binary';
            }
            if (body.length > 150 * 1024 * 1024) {
                //https://www.dropbox.com/developers/core/docs#chunked-upload
                throw new Error("Cannot upload file larger than 150MB");
            }
            const needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
            const uploadParams = {
                body: body,
                contentType: contentType,
                path: path
            };
            if (needsMetadata) {
                const metadata = yield this._getMetadata(path);
                if (options && (options.ifNoneMatch === '*') && metadata) {
                    // if !!metadata === true, the file exists
                    return {
                        statusCode: 412,
                        revision: metadata.rev
                    };
                }
                if (options && options.ifMatch && metadata && (metadata.rev !== options.ifMatch)) {
                    return {
                        statusCode: 412,
                        revision: metadata.rev
                    };
                }
            }
            const result = yield this._uploadSimple(uploadParams);
            this._shareIfNeeded(path); // There doesn't appear to be a need to await this.
            return result;
        });
    }
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed.
     *
     * Compatible with ``WireClient.delete``
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * @param {string} path - path of the folder to delete, with leading slash
     * @param {Object} options
     *
     * @protected
     */
    'delete'(path_1) {
        return __awaiter(this, arguments, void 0, function* (path, options = {}) {
            if (!this.connected) {
                throw new Error("not connected (path: " + path + ")");
            }
            // check if file has changed and return 412
            const savedRev = this._revCache.get(path);
            if ((options === null || options === void 0 ? void 0 : options.ifMatch) && savedRev && (options.ifMatch !== savedRev)) {
                return { statusCode: 412, revision: savedRev };
            }
            if (options === null || options === void 0 ? void 0 : options.ifMatch) {
                const metadata = yield this._getMetadata(path);
                if ((options === null || options === void 0 ? void 0 : options.ifMatch) && metadata && (metadata.rev !== options.ifMatch)) {
                    return {
                        statusCode: 412,
                        revision: metadata.rev
                    };
                }
            }
            return this._deleteSimple(path);
        });
    }
    /**
     * Calls share, if the provided path resides in a public folder.
     * @private
     */
    _shareIfNeeded(path) {
        if (path.match(/^\/public\/.*[^/]$/) && this._itemRefs[path] === undefined) {
            return this.share(path);
        }
    }
    /**
     * Retrieve the publicly-accessible URL for a path.
     *
     * For files under ``/public/``, returns a Dropbox shared link — fetching
     * one from the API if not yet cached. For all other paths returns
     * ``undefined`` because Dropbox has no concept of unauthenticated access
     * outside the public folder.
     *
     * Implements {@link Remote.getItemURL}.
     */
    getItemURL(path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!path.match(/^\/public\/.*[^/]$/)) {
                return undefined;
            }
            if (this._itemRefs[path]) {
                return this._itemRefs[path];
            }
            return this.share(path);
        });
    }
    /**
     * Gets a publicly-accessible URL for the path from Dropbox and stores it
     * in ``_itemRefs``.
     *
     * @return {Promise} a promise for the URL
     *
     * @private
     */
    share(path) {
        const options = {
            body: { path: getDropboxPath(path) }
        };
        return this._request('POST', CREATE_SHARED_URL, options).then((response) => {
            if (response.status !== 200 && response.status !== 409) {
                return Promise.reject(new Error('Invalid response status:' + response.status));
            }
            let body;
            try {
                body = JSON.parse(response.responseText);
            }
            catch (e) {
                return Promise.reject(new Error('Invalid response body: ' + response.responseText));
            }
            if (response.status === 409) {
                if (compareApiError(body, ['shared_link_already_exists'])) {
                    return this._getSharedLink(path);
                }
                return Promise.reject(new Error('API error: ' + body.error_summary));
            }
            return Promise.resolve(body.url);
        }).then((link) => {
            this._itemRefs[path] = link;
            if (hasLocalStorage) {
                localStorage.setItem(SETTINGS_KEY + ':shares', JSON.stringify(this._itemRefs));
            }
            return Promise.resolve(link);
        }, (error) => {
            error.message = 'Sharing Dropbox file or folder ("' + path + '") failed: ' + error.message;
            return Promise.reject(error);
        });
    }
    /**
     * Fetches the user's info from dropbox and returns a promise for it.
     *
     * @return {Promise} a promise for user info object (email - the user's email address)
     *
     * @protected
     */
    info() {
        return this._request('POST', ACCOUNT_URL, {}).then(function (response) {
            let email;
            try {
                const info = JSON.parse(response.responseText);
                email = info === null || info === void 0 ? void 0 : info.email;
            }
            catch (e) {
                return Promise.reject(new Error('Could not query current account info: Invalid API response: ' + response.responseText));
            }
            return Promise.resolve({
                email: email
            });
        });
    }
    /**
     * Makes a network request.
     *
     * @param {string} method - Request method
     * @param {string} url - Target URL
     * @param {object} options - Request options
     * @param {number} numAttempts - # of times same request repeated
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _request(method_1, url_1, options_1) {
        return __awaiter(this, arguments, void 0, function* (method, url, options, numAttempts = 1) {
            if (this.isForbiddenRequestMethod(method, url)) {
                throw `Don't use ${method} on directories!`;
            }
            if (!this.token) {
                throw new unauthorized_error_1.default("No access token");
            }
            if (!options.headers) {
                options.headers = {};
            }
            options.headers['Authorization'] = 'Bearer ' + this.token;
            if (typeof options.body === 'object' && !isBinaryData(options.body)) {
                options.body = JSON.stringify(options.body);
                options.headers['Content-Type'] = 'application/json; charset=UTF-8';
            }
            this.rs._emit('wire-busy', {
                method: method,
                isFolder: (0, util_1.isFolder)(url)
            });
            try {
                const xhr = yield (0, requests_1.requestWithTimeout)(method, url, options);
                if (!this.online) {
                    this.online = true;
                    this.rs._emit('network-online');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(url),
                    success: true
                });
                if ((xhr === null || xhr === void 0 ? void 0 : xhr.status) === 401 && this.refreshToken) {
                    if (numAttempts >= NUM_RETRIES) {
                        console.error(`Abandoned after ${numAttempts} attempts: ${method} ${url}`);
                        return xhr;
                    }
                    else {
                        this.rs._emit('wire-busy', {
                            method: method,
                            isFolder: (0, util_1.isFolder)(url)
                        });
                        yield authorize_1.default.refreshAccessToken(this.rs, this, this.refreshToken);
                        this.rs._emit('wire-done', {
                            method: method,
                            isFolder: (0, util_1.isFolder)(url),
                            success: true
                        });
                        // re-runs original request
                        return this._request(method, url, options, numAttempts + 1);
                    }
                }
                else if ([503, 429].includes(xhr === null || xhr === void 0 ? void 0 : xhr.status)) {
                    // 503 Service Unavailable; 429 Too Many Requests
                    if (this.online) {
                        this.online = false;
                        this.rs._emit('network-offline');
                    }
                    if (numAttempts >= NUM_RETRIES) {
                        console.warn(`Abandoned after ${numAttempts} attempts: ${method} ${url}`);
                        return xhr;
                    }
                    else {
                        yield new Promise(resolve => setTimeout(resolve, (0, requests_1.retryAfterMs)(xhr)));
                        // re-runs original request
                        return this._request(method, url, options, numAttempts + 1);
                    }
                }
                else {
                    return xhr;
                }
            }
            catch (error) {
                if (this.online) {
                    this.online = false;
                    this.rs._emit('network-offline');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(url),
                    success: false
                });
                throw error;
            }
        });
    }
    /**
     * Fetches the revision of all the files from dropbox API and puts them
     * into ``_revCache``. These values can then be used to determine if
     * something has changed.
     *
     * @private
     */
    fetchDelta(...args) {
        // If fetchDelta was already called, and didn't finish, return the existing
        // promise instead of calling Dropbox API again
        if (this._fetchDeltaPromise) {
            return this._fetchDeltaPromise;
        }
        /** This should resolve (with no value) on success, and reject on error. */
        const fetch = (cursor) => __awaiter(this, void 0, void 0, function* () {
            let url;
            let requestBody;
            if (typeof cursor === 'string') {
                url = CONTINUE_URL;
                requestBody = { cursor };
            }
            else {
                url = FOLDER_URL;
                requestBody = {
                    path: PATH_PREFIX,
                    recursive: true,
                    include_deleted: true
                };
            }
            try {
                const response = yield this._request('POST', url, { body: requestBody });
                if (response.status === 401) {
                    throw new unauthorized_error_1.default();
                }
                if (response.status !== 200 && response.status !== 409) {
                    throw new Error('Invalid response status: ' + response.status);
                }
                let responseBody;
                try {
                    responseBody = JSON.parse(response.responseText);
                }
                catch (e) {
                    throw new Error('Invalid response body: ' + response.responseText);
                }
                if (response.status === 409) {
                    if (compareApiError(responseBody, ['path', 'not_found'])) {
                        responseBody = {
                            cursor: null,
                            entries: [],
                            has_more: false
                        };
                    }
                    else {
                        throw new Error('API returned an error: ' + responseBody.error_summary);
                    }
                }
                if (!cursor) {
                    //we are doing a complete fetch, so propagation would introduce unnecessary overhead
                    this._revCache.deactivatePropagation();
                }
                responseBody.entries.forEach(entry => {
                    const path = entry.path_display.slice(PATH_PREFIX.length);
                    if (entry['.tag'] === 'deleted') {
                        // there's no way to know whether the entry was a file or a folder
                        this._revCache.delete(path);
                        this._revCache.delete(path + '/');
                    }
                    else if (entry['.tag'] === 'file') {
                        this._revCache.set(path, entry.rev);
                    }
                });
                this._fetchDeltaCursor = responseBody.cursor;
                if (responseBody.has_more) {
                    return fetch(responseBody.cursor);
                }
                else {
                    this._revCache.activatePropagation();
                    this._initialFetchDone = true;
                }
            }
            catch (error) {
                if (error === 'timeout') {
                    // Offline is handled elsewhere already, just ignore it here
                    return;
                }
                else {
                    throw error;
                }
            }
        });
        this._fetchDeltaPromise = fetch(this._fetchDeltaCursor).catch(error => {
            if (typeof (error) === 'object' && 'message' in error) {
                error.message = 'Dropbox: fetchDelta: ' + error.message;
            }
            else {
                error = `Dropbox: fetchDelta: ${error}`;
            }
            this.rs._emit('error', error);
            this._fetchDeltaPromise = null;
            return Promise.reject(error);
        }).then(() => {
            this._fetchDeltaPromise = null;
            return Promise.resolve(args);
        });
        return this._fetchDeltaPromise;
    }
    /**
     * Gets metadata for a path (can point to either a file or a folder).
     *
     * @param {string} path - the path to get metadata for
     *
     * @returns {Promise} A promise for the metadata
     *
     * @private
     */
    _getMetadata(path) {
        const requestBody = {
            path: getDropboxPath(path)
        };
        return this._request('POST', METADATA_URL, { body: requestBody }).then((response) => {
            if (response.status !== 200 && response.status !== 409) {
                return Promise.reject(new Error('Invalid response status:' + response.status));
            }
            let responseBody;
            try {
                responseBody = JSON.parse(response.responseText);
            }
            catch (e) {
                return Promise.reject(new Error('Invalid response body: ' + response.responseText));
            }
            if (response.status === 409) {
                if (compareApiError(responseBody, ['path', 'not_found'])) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('API error: ' + responseBody.error_summary));
            }
            return Promise.resolve(responseBody);
        }).then(undefined, (error) => {
            error.message = 'Could not load metadata for file or folder ("' + path + '"): ' + error.message;
            return Promise.reject(error);
        });
    }
    /**
     * Upload a simple file (the size is no more than 150MB).
     *
     * @param {Object} params
     * @param {string} params.ifMatch - Only update the file if its ETag
     *                                   matches this string
     * @param {string} params.path - path of the file
     * @param {string} params.body - contents of the file to upload
     * @param {string} params.contentType - mime type of the file   *
     * @return {Promise} A promise for an object with the following structure:
     *         statusCode - HTTP status code
     *         revision - revision of the newly-created file, if any
     *
     * @private
     */
    _uploadSimple(params) {
        const args = {
            path: getDropboxPath(params.path),
            mode: { '.tag': 'overwrite', update: undefined },
            mute: true
        };
        if (params.ifMatch) {
            args.mode = { '.tag': 'update', update: params.ifMatch };
        }
        return this._request('POST', UPLOAD_URL, {
            body: params.body,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': httpHeaderSafeJson(args)
            }
        }).then(response => {
            if (response.status !== 200 && response.status !== 409) {
                return Promise.resolve({ statusCode: response.status });
            }
            let body;
            try {
                body = JSON.parse(response.responseText);
            }
            catch (e) {
                return Promise.reject(new Error('Invalid API result: ' + response.responseText));
            }
            if (response.status === 409) {
                if (compareApiError(body, ['path', 'conflict'])) {
                    return this._getMetadata(params.path).then(function (metadata) {
                        return Promise.resolve({
                            statusCode: 412,
                            revision: metadata.rev
                        });
                    });
                }
                this.rs._emit('error', new Error(body.error_summary));
                return Promise.resolve({ statusCode: response.status });
            }
            this._revCache.set(params.path, body.rev);
            return Promise.resolve({ statusCode: response.status, revision: body.rev });
        });
    }
    /**
     * Deletes a file or a folder.
     *
     * @param {string} path - the path to delete
     *
     * @returns {Promise} A promise for an object with the following structure:
     *          statusCode - HTTP status code
     *
     * @private
     */
    _deleteSimple(path) {
        const requestBody = { path: getDropboxPath(path) };
        return this._request('POST', DELETE_URL, { body: requestBody }).then((response) => {
            if (response.status !== 200 && response.status !== 409) {
                return Promise.resolve({ statusCode: response.status });
            }
            let responseBody;
            try {
                responseBody = JSON.parse(response.responseText);
            }
            catch (e) {
                return Promise.reject(new Error('Invalid response body: ' + response.responseText));
            }
            if (response.status === 409) {
                if (compareApiError(responseBody, ['path_lookup', 'not_found'])) {
                    return Promise.resolve({ statusCode: 404 });
                }
                this.rs._emit('error', new Error(responseBody.error_summary));
            }
            return Promise.resolve({ statusCode: response.status });
        }).then(result => {
            if (result.statusCode === 200 || result.statusCode === 404) {
                this._revCache.delete(path);
                delete this._itemRefs[path];
            }
            return Promise.resolve(result);
        }, (error) => {
            error.message = 'Could not delete Dropbox file or folder ("' + path + '"): ' + error.message;
            return Promise.reject(error);
        });
    }
    /**
     * Requests the link for an already-shared file or folder.
     *
     * @param {string} path - path to the file or folder
     *
     * @returns {Promise} A promise for the shared link
     *
     * @private
     */
    _getSharedLink(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                body: {
                    path: getDropboxPath(path),
                    direct_only: true
                }
            };
            return this._request('POST', LIST_SHARED_URL, options).then((response) => {
                if (response.status !== 200 && response.status !== 409) {
                    return Promise.reject(new Error('Invalid response status: ' + response.status));
                }
                let body;
                try {
                    body = JSON.parse(response.responseText);
                }
                catch (e) {
                    return Promise.reject(new Error('Invalid response body: ' + response.responseText));
                }
                if (response.status === 409) {
                    return Promise.reject(new Error('API error: ' + (body === null || body === void 0 ? void 0 : body.error_summary) || 0));
                }
                if (!body.links.length) {
                    return Promise.reject(new Error('No links returned'));
                }
                return Promise.resolve(body.links[0].url);
            }, error => {
                error.message = 'Could not get link to a shared file or folder ("' + path + '"): ' + error.message;
                return Promise.reject(error);
            });
        });
    }
    /**
     * Initialize the Dropbox backend.
     *
     * @param {object} rs - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(rs) {
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (rs.apiKeys.dropbox) {
            rs.dropbox = new Dropbox(rs);
        }
        if (rs.backend === 'dropbox') {
            hookIt(rs);
        }
    }
    /**
     * Inform about the availability of the Dropbox backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        return true;
    }
    /**
     * Remove Dropbox as a backend.
     *
     * @param {object} rs - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(rs) {
        unHookIt(rs);
        if (hasLocalStorage) {
            localStorage.removeItem(SETTINGS_KEY);
        }
        rs.setBackend(undefined);
    }
}
/**
 * Hooking the sync
 *
 * TODO: document
 */
function hookSync(rs, ...args) {
    if (rs._dropboxOrigSync) {
        return;
    } // already hooked
    rs._dropboxOrigSync = rs.sync.sync.bind(rs.sync);
    rs.sync.sync = function () {
        return this.dropbox.fetchDelta(rs, ...args).
            then(rs._dropboxOrigSync, function (err) {
            rs._emit('error', new sync_error_1.default(err));
            rs._emit('sync-done', { completed: false });
        });
    }.bind(rs);
}
/**
 * Unhooking the sync
 *
 * TODO: document
 */
function unHookSync(rs) {
    if (!rs._dropboxOrigSync) {
        return;
    } // not hooked
    rs.sync.sync = rs._dropboxOrigSync;
    delete rs._dropboxOrigSync;
}
/**
 * Hook RemoteStorage.syncCycle as it's the first function called
 * after RemoteStorage.sync is initialized, so we can then hook
 * the sync function
 * @param {object} rs RemoteStorage instance
 * @param {array} args remaining arguments
 */
function hookSyncCycle(rs, ...args) {
    if (rs._dropboxOrigSyncCycle) {
        return;
    } // already hooked
    rs._dropboxOrigSyncCycle = rs.syncCycle;
    rs.syncCycle = () => {
        if (rs.sync) {
            hookSync(rs);
            rs._dropboxOrigSyncCycle(rs, ...args);
            unHookSyncCycle(rs);
        }
        else {
            throw new Error('expected sync to be initialized by now');
        }
    };
}
/**
 * Restore RemoteStorage's syncCycle original implementation
 * @param {object} rs RemoteStorage instance
 */
function unHookSyncCycle(rs) {
    if (!rs._dropboxOrigSyncCycle) {
        return;
    } // not hooked
    rs.syncCycle = rs._dropboxOrigSyncCycle;
    delete rs._dropboxOrigSyncCycle;
}
/**
 * TODO: document
 */
function hookRemote(rs) {
    if (rs._origRemote) {
        return;
    }
    rs._origRemote = rs.remote;
    rs.remote = rs.dropbox;
}
/**
 * TODO: document
 */
function unHookRemote(rs) {
    if (rs._origRemote) {
        rs.remote = rs._origRemote;
        delete rs._origRemote;
    }
}
/**
 * TODO: document
 */
function hookIt(rs) {
    hookRemote(rs);
    if (rs.sync) {
        hookSync(rs);
    }
    else {
        // when sync is not available yet, we hook the syncCycle function which is called
        // right after sync is initialized
        hookSyncCycle(rs);
    }
}
/**
 * TODO: document
 */
function unHookIt(rs) {
    unHookRemote(rs);
    unHookSync(rs);
    unHookSyncCycle(rs);
}
(0, util_1.applyMixins)(Dropbox, [eventhandling_1.default]);
module.exports = Dropbox;


/***/ }),

/***/ "./src/env.ts":
/*!********************!*\
  !*** ./src/env.ts ***!
  \********************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
class Env {
    constructor() {
        this.addEvents(["background", "foreground"]);
        this.mode = typeof (window) !== 'undefined' ? 'browser' : 'node';
        if (this.mode === 'browser') {
            this.setBrowserPrefixedNames();
            document.addEventListener(this.visibilityChangeEvent, this.setVisibility.bind(this), false);
            this.setVisibility();
        }
    }
    setBrowserPrefixedNames() {
        if (this.mode !== 'browser') {
            return;
        }
        if (typeof document.hidden !== "undefined") {
            this.hiddenProperty = "hidden";
            this.visibilityChangeEvent = "visibilitychange";
        }
        else if (typeof document["mozHidden"] !== "undefined") {
            this.hiddenProperty = "mozHidden";
            this.visibilityChangeEvent = "mozvisibilitychange";
        }
        else if (typeof document["msHidden"] !== "undefined") {
            this.hiddenProperty = "msHidden";
            this.visibilityChangeEvent = "msvisibilitychange";
        }
        else if (typeof document["webkitHidden"] !== "undefined") {
            this.hiddenProperty = "webkitHidden";
            this.visibilityChangeEvent = "webkitvisibilitychange";
        }
    }
    setVisibility() {
        if (document[this.hiddenProperty]) {
            (0, log_1.default)(`[Env] Going into background mode`);
            this.goBackground();
        }
        else {
            (0, log_1.default)(`[Env] Going into foreground mode`);
            this.goForeground();
        }
    }
    isBrowser() {
        return this.mode === "browser";
    }
    isNode() {
        return this.mode === "node";
    }
    goBackground() {
        this._emit("background");
    }
    goForeground() {
        this._emit("foreground");
    }
    static _rs_init( /* remoteStorage */) {
        return;
    }
    static _rs_cleanup( /* remoteStorage */) {
        return;
    }
}
(0, util_1.applyMixins)(Env, [eventhandling_1.default]);
module.exports = Env;


/***/ }),

/***/ "./src/eventhandling.ts":
/*!******************************!*\
  !*** ./src/eventhandling.ts ***!
  \******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EventHandling = void 0;
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
class EventHandling {
    /**
     * Register event names
     *
     * TODO see if necessary, or can be done on the fly in addEventListener
     *
     * @internal
     */
    addEvents(additionalEvents) {
        additionalEvents.forEach(evName => this._addEvent(evName));
    }
    /**
     * Install an event handler for the given event name
     *
     * Usually called via [`on()`](#on)
     */
    addEventListener(eventName, handler) {
        // Check type for public consumption of API
        if (typeof (eventName) !== 'string') {
            throw new Error('Argument eventName should be a string');
        }
        if (typeof (handler) !== 'function') {
            throw new Error('Argument handler should be a function');
        }
        (0, log_1.default)('[EventHandling] Adding event listener', eventName);
        this._validateEvent(eventName);
        this._handlers[eventName].push(handler);
    }
    /**
     * Register an event handler for the given event name
     *
     * Alias for {@link addEventListener}
     *
     * @param eventName - Name of the event
     * @param handler - Function to handle the event
     *
     * @example
     * remoteStorage.on('connected', function() {
     *   console.log('storage account has been connected');
     * });
     */
    on(eventName, handler) {
        return this.addEventListener(eventName, handler);
    }
    /**
     * Remove a previously installed event handler
     */
    removeEventListener(eventName, handler) {
        this._validateEvent(eventName);
        const hl = this._handlers[eventName].length;
        for (let i = 0; i < hl; i++) {
            if (this._handlers[eventName][i] === handler) {
                this._handlers[eventName].splice(i, 1);
                return;
            }
        }
    }
    /**
     * @internal
     */
    _emit(eventName, ...args) {
        this._validateEvent(eventName);
        this._handlers[eventName].slice().forEach((handler) => {
            handler(...args);
        });
    }
    /**
     * @internal
     */
    _validateEvent(eventName) {
        if (!(eventName in this._handlers)) {
            throw new Error("Unknown event: " + eventName);
        }
    }
    /**
     * @internal
     */
    _delegateEvent(eventName, target) {
        target.on(eventName, (event) => {
            this._emit(eventName, event);
        });
    }
    /**
     * @internal
     */
    _addEvent(eventName) {
        if (typeof this._handlers === 'undefined') {
            this._handlers = {};
        }
        this._handlers[eventName] = [];
    }
}
exports.EventHandling = EventHandling;
exports["default"] = EventHandling;


/***/ }),

/***/ "./src/features.ts":
/*!*************************!*\
  !*** ./src/features.ts ***!
  \*************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const env_1 = __importDefault(__webpack_require__(/*! ./env */ "./src/env.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const syncedgetputdelete_1 = __importDefault(__webpack_require__(/*! ./syncedgetputdelete */ "./src/syncedgetputdelete.ts"));
const access_1 = __importDefault(__webpack_require__(/*! ./access */ "./src/access.ts"));
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
const discover_1 = __importDefault(__webpack_require__(/*! ./discover */ "./src/discover.ts"));
const baseclient_1 = __importDefault(__webpack_require__(/*! ./baseclient */ "./src/baseclient.ts"));
const googledrive_1 = __importDefault(__webpack_require__(/*! ./googledrive */ "./src/googledrive.ts"));
const dropbox_1 = __importDefault(__webpack_require__(/*! ./dropbox */ "./src/dropbox.ts"));
const wireclient_1 = __importDefault(__webpack_require__(/*! ./wireclient */ "./src/wireclient.ts"));
const sync_1 = __importDefault(__webpack_require__(/*! ./sync */ "./src/sync.ts"));
// Caching
const caching_1 = __importDefault(__webpack_require__(/*! ./caching */ "./src/caching.ts"));
const indexeddb_1 = __importDefault(__webpack_require__(/*! ./indexeddb */ "./src/indexeddb.ts"));
const localstorage_1 = __importDefault(__webpack_require__(/*! ./localstorage */ "./src/localstorage.ts"));
const inmemorystorage_1 = __importDefault(__webpack_require__(/*! ./inmemorystorage */ "./src/inmemorystorage.ts"));
const Features = {
    features: [],
    featuresDone: 0,
    readyFired: false,
    loadFeatures() {
        this.features = [];
        this.featuresDone = 0;
        this.readyFired = false;
        this.featureModules = {
            'WireClient': wireclient_1.default,
            'Dropbox': dropbox_1.default,
            'GoogleDrive': googledrive_1.default,
            'Access': access_1.default,
            'Discover': discover_1.default,
            'Authorize': authorize_1.default,
            'BaseClient': baseclient_1.default,
            'Env': env_1.default
        };
        // enable caching related modules if needed
        if (config_1.default.cache) {
            // TODO replace util.extend with modern JS {...object, ...object}
            (0, util_1.extend)(this.featureModules, {
                'Caching': caching_1.default,
                'IndexedDB': indexeddb_1.default,
                'LocalStorage': localstorage_1.default,
                'InMemoryStorage': inmemorystorage_1.default,
                'Sync': sync_1.default
            });
        }
        // disable features set in the config object passed to the RemoteStorage
        // constructor
        // For example: ['IndexedDB']
        config_1.default.disableFeatures.forEach(feature => {
            if (this.featureModules[feature]) {
                // this.featureModules[feature] = undefined
                delete this.featureModules[feature];
            }
        });
        this._allLoaded = false;
        for (const featureName in this.featureModules) {
            // FIXME: this has to push the promised return value into an
            // array of promises and use Promise.all to emit `ready`
            // instead of increment a counter of loaded features. -les
            this.loadFeature(featureName);
        }
    },
    /**
     * Method: hasFeature
     *
     * Checks whether a feature is enabled or not within remoteStorage.
     * Returns a boolean.
     *
     * Parameters:
     *   name - Capitalized name of the feature. e.g. Authorize, or IndexedDB
     *
     * Example:
     *   (start code)
     *   if (remoteStorage.hasFeature('LocalStorage')) {
     *     console.log('LocalStorage is enabled!');
     *   }
     *   (end code)
     *
     */
    hasFeature(feature) {
        for (let i = this.features.length - 1; i >= 0; i--) {
            if (this.features[i].name === feature) {
                return this.features[i].supported;
            }
        }
        return false;
    },
    loadFeature(featureName) {
        const feature = this.featureModules[featureName];
        const supported = !feature._rs_supported || feature._rs_supported();
        (0, log_1.default)(`[RemoteStorage] [FEATURE ${featureName}] initializing ...`);
        if (typeof supported === 'object') {
            supported.then(() => {
                this.featureSupported(featureName, true);
                this.initFeature(featureName);
            }, () => {
                this.featureSupported(featureName, false);
            });
        }
        else if (typeof supported === 'boolean') {
            this.featureSupported(featureName, supported);
            if (supported) {
                this.initFeature(featureName);
            }
        }
        else {
            this.featureSupported(featureName, false);
        }
    },
    initFeature(featureName) {
        const feature = this.featureModules[featureName];
        let initResult;
        try {
            initResult = feature._rs_init(this);
        }
        catch (e) {
            this.featureFailed(featureName, e);
            return;
        }
        if (typeof (initResult) === 'object' && typeof (initResult.then) === 'function') {
            initResult.then(() => { this.featureInitialized(featureName); }, (err) => { this.featureFailed(featureName, err); });
        }
        else {
            this.featureInitialized(featureName);
        }
    },
    featureFailed(featureName, err) {
        (0, log_1.default)(`[RemoteStorage] [FEATURE ${featureName}] initialization failed (${err})`);
        this.featureDone();
    },
    featureSupported(featureName, success) {
        (0, log_1.default)(`[RemoteStorage] [FEATURE ${featureName}]${success ? '' : 'not '} supported`);
        if (!success) {
            this.featureDone();
        }
    },
    featureInitialized(featureName) {
        (0, log_1.default)(`[RemoteStorage] [FEATURE ${featureName}] initialized`);
        this.features.push({
            name: featureName,
            init: this.featureModules[featureName]._rs_init,
            supported: true,
            cleanup: this.featureModules[featureName]._rs_cleanup
        });
        this.featureDone();
    },
    featureDone() {
        this.featuresDone++;
        if (this.featuresDone === Object.keys(this.featureModules).length) {
            setTimeout(this.featuresLoaded.bind(this), 0);
        }
    },
    _setCachingModule() {
        const cachingModules = ['IndexedDB', 'LocalStorage', 'InMemoryStorage'];
        cachingModules.some(cachingLayer => {
            if (this.features.some(feature => feature.name === cachingLayer)) {
                this.features.local = this.featureModules[cachingLayer];
                return true;
            }
        });
    },
    _fireReady() {
        try {
            if (!this.readyFired) {
                this._emit('ready');
                this.readyFired = true;
            }
        }
        catch (e) {
            console.error("'ready' failed: ", e, e.stack);
            this._emit('error', e);
        }
    },
    featuresLoaded() {
        (0, log_1.default)(`[RemoteStorage] All features loaded`);
        this._setCachingModule();
        // eslint-disable-next-line new-cap
        this.local = config_1.default.cache && this.features.local && new this.features.local();
        // this.remote set by WireClient._rs_init as lazy property on
        // RS.prototype
        if (this.local && this.remote) {
            this._setGPD(syncedgetputdelete_1.default, this);
            this._bindChange(this.local);
        }
        else if (this.remote) {
            this._setGPD(this.remote, this.remote);
        }
        if (this.remote) {
            this.remote.on('connected', () => {
                this._fireReady();
                this._emit('connected');
            });
            this.remote.on('not-connected', () => {
                this._fireReady();
                this._emit('not-connected');
            });
            if (this.remote.connected) {
                this._fireReady();
                this._emit('connected');
            }
            if (!this.hasFeature('Authorize')) {
                this.remote.stopWaitingForToken();
            }
        }
        this._collectCleanupFunctions();
        try {
            this._allLoaded = true;
            this._emit('features-loaded');
        }
        catch (exc) {
            (0, util_1.logError)(exc);
            this._emit('error', exc);
        }
        this._processPending();
    },
    _collectCleanupFunctions() {
        this._cleanups = [];
        for (let i = 0; i < this.features.length; i++) {
            const cleanup = this.features[i].cleanup;
            if (typeof (cleanup) === 'function') {
                this._cleanups.push(cleanup);
            }
        }
    }
};
module.exports = Features;


/***/ }),

/***/ "./src/googledrive.ts":
/*!****************************!*\
  !*** ./src/googledrive.ts ***!
  \****************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
const remote_1 = __webpack_require__(/*! ./remote */ "./src/remote.ts");
const BASE_URL = 'https://www.googleapis.com';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';
const SETTINGS_KEY = 'remotestorage:googledrive';
const PATH_PREFIX = '/remotestorage';
const GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
const RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';
let hasLocalStorage;
/**
 * Produce a title from a filename for metadata.
 *
 * @param {string} filename
 * @returns {string} title
 *
 * @private
 */
function metaTitleFromFileName(filename) {
    if (filename.substr(-1) === '/') {
        filename = filename.substr(0, filename.length - 1);
    }
    return decodeURIComponent(filename);
}
/**
 * Get the parent directory for the given path.
 *
 * @param {string} path
 * @returns {string} parent directory
 *
 * @private
 */
function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
}
/**
 * Get only the filename from a full path.
 *
 * @param {string} path
 * @returns {string} filename
 *
 * @private
 */
function baseName(path) {
    const parts = path.split('/');
    if (path.substr(-1) === '/') {
        return parts[parts.length - 2] + '/';
    }
    else {
        return parts[parts.length - 1];
    }
}
/**
 * Prepend the path with the remoteStorage base directory.
 *
 * @param {string} path - Path
 * @returns {string} Actual path on Google Drive
 *
 * @private
 */
function googleDrivePath(path) {
    return (0, util_1.cleanPath)(`${PATH_PREFIX}/${path}`);
}
/**
 * Internal cache object for storing Google file IDs.
 *
 * @param {number} maxAge - Maximum age (in seconds) the content should be cached for
 */
class FileIdCache {
    constructor(maxAge) {
        this._items = {};
        this.maxAge = maxAge;
        this._items = {};
    }
    get(key) {
        const item = this._items[key];
        const now = new Date().getTime();
        return (item && item.t >= (now - this.maxAge)) ? item.v : undefined;
    }
    set(key, value) {
        this._items[key] = {
            v: value,
            t: new Date().getTime()
        };
    }
}
/**
 * @class GoogleDrive
 *
 * To use this backend, you need to specify the app's client ID like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   googledrive: 'your-client-id'
 * });
 *
 * A client ID can be obtained by registering your app in the Google
 * Developers Console: https://console.developers.google.com/flows/enableapi?apiid=drive
 *
 * Docs: https://developers.google.com/drive/v3/web/quickstart/js
**/
class GoogleDrive extends remote_1.RemoteBase {
    constructor(remoteStorage, clientId) {
        super(remoteStorage);
        this.online = true;
        this.storageApi = 'draft-dejong-remotestorage-19';
        this.addEvents(['connected', 'not-connected']);
        this.clientId = clientId;
        this._fileIdCache = new FileIdCache(60 * 5); // IDs expire after 5 minutes (is this a good idea?)
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (hasLocalStorage) {
            const settings = (0, util_1.getJSONFromLocalStorage)(SETTINGS_KEY);
            if (settings) {
                this.configure(settings);
            }
        }
    }
    /**
     * Configure the Google Drive backend.
     *
     * Fetches the user info from Google when no ``userAddress`` is given.
     *
     * @param {Object} settings
     * @param {string} [settings.userAddress] - The user's email address
     * @param {string} [settings.token] - Authorization token
     *
     * @protected
     */
    configure(settings) {
        // We only update this.userAddress if settings.userAddress is set to a string or to null
        if (typeof settings.userAddress !== 'undefined') {
            this.userAddress = settings.userAddress;
        }
        // Same for this.token. If only one of these two is set, we leave the other one at its existing value
        if (typeof settings.token !== 'undefined') {
            this.token = settings.token;
        }
        const writeSettingsToCache = function () {
            if (hasLocalStorage) {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                    userAddress: this.userAddress,
                    token: this.token
                }));
            }
        };
        const handleError = function () {
            this.connected = false;
            delete this.token;
            if (hasLocalStorage) {
                localStorage.removeItem(SETTINGS_KEY);
            }
        };
        if (this.token) {
            this.connected = true;
            if (this.userAddress) {
                this._emit('connected');
                writeSettingsToCache.apply(this);
            }
            else {
                this.info().then((info) => {
                    this.userAddress = info.user.emailAddress;
                    this._emit('connected');
                    writeSettingsToCache.apply(this);
                }).catch(() => {
                    handleError.apply(this);
                    this.rs._emit('error', new Error('Could not fetch user info.'));
                });
            }
        }
        else {
            handleError.apply(this);
        }
    }
    /**
     * Initiate the authorization flow's OAuth dance.
     */
    connect() {
        this.rs.setBackend('googledrive');
        this.rs.authorize({ authURL: AUTH_URL, scope: AUTH_SCOPE, clientId: this.clientId });
    }
    /**
     * Request a resource (file or directory).
     *
     * @param {string} path - Path of the resource
     * @param {Object} options - Request options
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body, content-type and revision
     *
     * @protected
     */
    get(path, options = {}) {
        if ((0, util_1.isFolder)(path)) {
            return this._getFolder(googleDrivePath(path));
        }
        else {
            return this._getFile(googleDrivePath(path), options);
        }
    }
    /**
     * Create or update a file.
     *
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @param {Object} options
     * @param {string} options.ifNoneMatch - Only create of update the file if the
     *                                       current ETag doesn't match this string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    content-type and revision
     *
     * @protected
     */
    put(path, body, contentType, options = {}) {
        const fullPath = googleDrivePath(path);
        function putDone(response) {
            if (response.status >= 200 && response.status < 300) {
                const meta = JSON.parse(response.responseText);
                const etagWithoutQuotes = this.stripQuotes(meta.etag);
                return Promise.resolve({ statusCode: 200, contentType: meta.mimeType, revision: etagWithoutQuotes });
            }
            else if (response.status === 412) {
                return Promise.resolve({ statusCode: 412, revision: 'conflict' });
            }
            else {
                return Promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
            }
        }
        return this._getFileId(fullPath).then((id) => {
            if (id) {
                if (options && (options.ifNoneMatch === '*')) {
                    return putDone({ status: 412 });
                }
                return this._updateFile(id, fullPath, body, contentType, options).then(putDone);
            }
            else {
                return this._createFile(fullPath, body, contentType).then(putDone);
            }
        });
    }
    /**
     * Delete a file.
     *
     * @param {string} path - File path
     * @param {Object} options
     * @param {string} options.ifMatch - only delete the file if it's ETag
     *                                   matches this string
     * @returns {Promise} Resolves with an object containing the status code
     *
     * @protected
     */
    delete(path, options = {}) {
        const fullPath = googleDrivePath(path);
        return this._getFileId(fullPath).then((id) => {
            if (!id) {
                // File doesn't exist. Ignore.
                return Promise.resolve({ statusCode: 200 });
            }
            return this._getMeta(id).then((meta) => {
                let etagWithoutQuotes;
                if ((typeof meta === 'object') && (typeof meta.etag === 'string')) {
                    etagWithoutQuotes = this.stripQuotes(meta.etag);
                }
                if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
                    return { statusCode: 412, revision: etagWithoutQuotes };
                }
                return this._request('DELETE', BASE_URL + '/drive/v2/files/' + id, {}).then((response) => {
                    if (response.status === 200 || response.status === 204) {
                        return { statusCode: 200 };
                    }
                    else {
                        return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
                    }
                });
            });
        });
    }
    /**
     * Fetch the user's info from Google.
     *
     * @returns {Promise} resolves with the user's info.
     *
     * @protected
     */
    info() {
        const url = BASE_URL + '/drive/v2/about?fields=user';
        // requesting user info(mainly for userAdress)
        return this._request('GET', url, {}).then(function (resp) {
            try {
                const info = JSON.parse(resp.responseText);
                return Promise.resolve(info);
            }
            catch (e) {
                return Promise.reject(e);
            }
        });
    }
    /**
     * Update an existing file.
     *
     * @param {string} id - File ID
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @param {Object} options
     * @param {string} options.ifMatch - Only update the file if its ETag
     *                                   matches this string
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _updateFile(id, path, body, contentType, options) {
        const metadata = {
            mimeType: contentType
        };
        const headers = {
            'Content-Type': 'application/json; charset=UTF-8'
        };
        if (options && options.ifMatch) {
            headers['If-Match'] = this.addQuotes(options.ifMatch);
        }
        return this._request('PUT', BASE_URL + '/upload/drive/v2/files/' + id + '?uploadType=resumable', {
            body: JSON.stringify(metadata),
            headers: headers
        }).then((response) => {
            if (response.status === 412) {
                return (response);
            }
            else {
                return this._request('PUT', response.getResponseHeader('Location'), {
                    body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
                });
            }
        });
    }
    /**
     * Create a new file.
     *
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _createFile(path, body, contentType) {
        return this._getParentId(path).then((parentId) => {
            const fileName = baseName(path);
            const metadata = {
                title: metaTitleFromFileName(fileName),
                mimeType: contentType,
                parents: [{
                        kind: "drive#fileLink",
                        id: parentId
                    }]
            };
            return this._request('POST', BASE_URL + '/upload/drive/v2/files?uploadType=resumable', {
                body: JSON.stringify(metadata),
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }).then((response) => {
                return this._request('POST', response.getResponseHeader('Location'), {
                    body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
                });
            });
        });
    }
    /**
     * Request a file.
     *
     * @param {string} path - File path
     * @param {Object} options
     * @param {string} [options.ifNoneMath] - Only return the file if its ETag
     *                                        doesn't match the given string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body, content-type and revision
     *
     * @private
     */
    _getFile(path, options) {
        return this._getFileId(path).then((id) => {
            return this._getMeta(id).then((meta) => {
                let etagWithoutQuotes;
                if (typeof (meta) === 'object' && typeof (meta.etag) === 'string') {
                    etagWithoutQuotes = this.stripQuotes(meta.etag);
                }
                if (options && options.ifNoneMatch && (etagWithoutQuotes === options.ifNoneMatch)) {
                    return Promise.resolve({ statusCode: 304 });
                }
                if (!meta.downloadUrl) {
                    if (meta.exportLinks && meta.exportLinks['text/html']) {
                        // Documents that were generated inside GoogleDocs have no
                        // downloadUrl, but you can export them to text/html instead:
                        meta.mimeType += ';export=text/html';
                        meta.downloadUrl = meta.exportLinks['text/html'];
                    }
                    else {
                        // empty file
                        return Promise.resolve({ statusCode: 200, body: '', contentType: meta.mimeType, revision: etagWithoutQuotes });
                    }
                }
                const params = {
                    responseType: 'arraybuffer'
                };
                return this._request('GET', meta.downloadUrl, params).then((response) => {
                    //first encode the response as text, and later check if
                    //text appears to actually be binary data
                    return (0, util_1.getTextFromArrayBuffer)(response.response, 'UTF-8').then(function (responseText) {
                        let body = responseText;
                        if (meta.mimeType.match(/^application\/json/)) {
                            try {
                                body = JSON.parse(body);
                            }
                            catch (e) {
                                // body couldn't be parsed as JSON, so we'll just return it as is
                            }
                        }
                        else if ((0, util_1.shouldBeTreatedAsBinary)(responseText, meta.mimeType)) {
                            //return unprocessed response
                            body = response.response;
                        }
                        return {
                            statusCode: 200,
                            body: body,
                            contentType: meta.mimeType,
                            revision: etagWithoutQuotes
                        };
                    });
                });
            });
        });
    }
    /**
     * Request a directory.
     *
     * @param {string} path - Directory path
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body and content-type
     *
     * @private
     */
    _getFolder(path) {
        return this._getFileId(path).then((id) => {
            let data, etagWithoutQuotes, itemsMap;
            if (!id) {
                return Promise.resolve({ statusCode: 404 });
            }
            const query = '\'' + id + '\' in parents';
            const fields = 'items(downloadUrl,etag,fileSize,id,mimeType,title,labels)';
            return this._request('GET', BASE_URL + '/drive/v2/files?'
                + 'q=' + encodeURIComponent(query)
                + '&fields=' + encodeURIComponent(fields)
                + '&maxResults=1000'
                + '&trashed=false', {})
                .then((response) => {
                var _a;
                if (response.status !== 200) {
                    return Promise.reject('request failed or something: ' + response.status);
                }
                try {
                    data = JSON.parse(response.responseText);
                }
                catch (e) {
                    return Promise.reject('non-JSON response from GoogleDrive');
                }
                itemsMap = {};
                for (const item of data.items) {
                    if ((_a = item.labels) === null || _a === void 0 ? void 0 : _a.trashed) {
                        continue;
                    } // ignore deleted files
                    etagWithoutQuotes = this.stripQuotes(item.etag);
                    if (item.mimeType === GD_DIR_MIME_TYPE) {
                        this._fileIdCache.set(path + (0, util_1.cleanPath)(item.title) + '/', item.id);
                        itemsMap[item.title + '/'] = {
                            ETag: etagWithoutQuotes
                        };
                    }
                    else {
                        this._fileIdCache.set(path + (0, util_1.cleanPath)(item.title), item.id);
                        itemsMap[item.title] = {
                            ETag: etagWithoutQuotes,
                            'Content-Type': item.mimeType,
                            'Content-Length': item.fileSize
                        };
                    }
                }
                // FIXME: add revision of folder!
                return Promise.resolve({ statusCode: 200, body: itemsMap, contentType: RS_DIR_MIME_TYPE, revision: undefined });
            });
        });
    }
    /**
     * Get the ID of a parent path.
     *
     * Creates the directory if it doesn't exist yet.
     *
     * @param {string} path - Full path of a directory or file
     * @returns {Promise} Resolves with ID of the parent directory.
     *
     * @private
     */
    _getParentId(path) {
        const foldername = parentPath(path);
        return this._getFileId(foldername).then((parentId) => {
            if (parentId) {
                return Promise.resolve(parentId);
            }
            else {
                return this._createFolder(foldername);
            }
        });
    }
    /**
     * Create a directory.
     *
     * Creates all parent directories as well if any of them didn't exist yet.
     *
     * @param {string} path - Directory path
     * @returns {Promise} Resolves with the ID of the new directory
     *
     * @private
     */
    _createFolder(path) {
        return this._getParentId(path).then((parentId) => {
            return this._request('POST', BASE_URL + '/drive/v2/files', {
                body: JSON.stringify({
                    title: metaTitleFromFileName(baseName(path)),
                    mimeType: GD_DIR_MIME_TYPE,
                    parents: [{
                            id: parentId
                        }]
                }),
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }).then((response) => {
                const meta = JSON.parse(response.responseText);
                return Promise.resolve(meta.id);
            });
        });
    }
    /**
     * Get the ID of a file.
     *
     * @param {string} path - File path
     * @returns {Promise} Resolves with the ID
     *
     * @private
     */
    _getFileId(path) {
        let id;
        if (path === '/') {
            // "root" is a special alias for the fileId of the root folder
            return Promise.resolve('root');
        }
        else if ((id = this._fileIdCache.get(path))) {
            // id is cached.
            return Promise.resolve(id);
        }
        // id is not cached (or file doesn't exist).
        // load parent folder listing to propagate / update id cache.
        return this._getFolder(parentPath(path)).then(() => {
            id = this._fileIdCache.get(path);
            if (!id) {
                if (path.substr(-1) === '/') {
                    return this._createFolder(path).then(() => {
                        return this._getFileId(path);
                    });
                }
                else {
                    return Promise.resolve();
                }
            }
            return Promise.resolve(id);
        });
    }
    /**
     * Get the metadata for a given file ID.
     *
     * @param {string} id - File ID
     * @returns {Promise} Resolves with an object containing the metadata
     *
     * @private
     */
    _getMeta(id) {
        return this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
            if (response.status === 200) {
                return Promise.resolve(JSON.parse(response.responseText));
            }
            else {
                return Promise.reject("request (getting metadata for " + id + ") failed with status: " + response.status);
            }
        });
    }
    /**
     * Make a network request.
     *
     * @param {string} method - Request method
     * @param {string} url - Target URL
     * @param {Object} options - Request options
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _request(method, url, options) {
        if (this.isForbiddenRequestMethod(method, url)) {
            return Promise.reject(`Don't use ${method} on directories!`);
        }
        if (!options.headers) {
            options.headers = {};
        }
        options.headers['Authorization'] = 'Bearer ' + this.token;
        this.rs._emit('wire-busy', {
            method: method,
            isFolder: (0, util_1.isFolder)(url)
        });
        return (0, requests_1.requestWithTimeout)(method, url, options).then((xhr) => {
            // Google tokens expire from time to time...
            if (xhr && xhr.status === 401) {
                this.connect();
                return;
            }
            else {
                if (!this.online) {
                    this.online = true;
                    this.rs._emit('network-online');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(url),
                    success: true
                });
                return Promise.resolve(xhr);
            }
        }, (error) => {
            if (this.online) {
                this.online = false;
                this.rs._emit('network-offline');
            }
            this.rs._emit('wire-done', {
                method: method,
                isFolder: (0, util_1.isFolder)(url),
                success: false
            });
            return Promise.reject(error);
        });
    }
    /**
     * Initialize the Google Drive backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    /**
     * Google Drive does not support unauthenticated public file access, so
     * this always resolves to ``undefined``. See GitHub issue #1051 for the
     * full discussion.
     *
     * Implements {@link Remote.getItemURL}.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getItemURL(_path) {
        return __awaiter(this, void 0, void 0, function* () {
            return undefined;
        });
    }
    static _rs_init(remoteStorage) {
        const config = remoteStorage.apiKeys.googledrive;
        if (config) {
            remoteStorage.googledrive = new GoogleDrive(remoteStorage, config.clientId);
            if (remoteStorage.backend === 'googledrive') {
                remoteStorage._origRemote = remoteStorage.remote;
                remoteStorage.remote = remoteStorage.googledrive;
            }
        }
    }
    /**
     * Inform about the availability of the Google Drive backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        return true;
    }
    /**
     * Remove Google Drive as a backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(remoteStorage) {
        remoteStorage.setBackend(undefined);
        if (remoteStorage._origRemote) {
            remoteStorage.remote = remoteStorage._origRemote;
            delete remoteStorage._origRemote;
        }
    }
}
(0, util_1.applyMixins)(GoogleDrive, [eventhandling_1.default]);
module.exports = GoogleDrive;


/***/ }),

/***/ "./src/indexeddb.ts":
/*!**************************!*\
  !*** ./src/indexeddb.ts ***!
  \**************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

/**
 * TODO rewrite, doesn't expose GPD anymore, it's in cachinglayer now
 *
 * This file exposes a get/put/delete interface, accessing data in an IndexedDB.
 *
 * There are multiple parts to this interface:
 *
 *   The RemoteStorage integration:
 *     - IndexedDB._rs_supported() determines if IndexedDB support
 *       is available. If it isn't, RemoteStorage won't initialize the feature.
 *     - IndexedDB._rs_init() initializes the feature. It returns
 *       a promise that is fulfilled as soon as the database has been opened and
 *       migrated.
 *
 *   The storage interface (IndexedDB object):
 *     - Usually this is accessible via "remoteStorage.local"
 *     - #get() takes a path and returns a promise.
 *     - #put() takes a path, body and contentType and also returns a promise.
 *     - #delete() takes a path and also returns a promise.
 *     - #on('change', ...) events, being fired whenever something changes in
 *       the storage. Change events roughly follow the StorageEvent pattern.
 *       They have "oldValue" and "newValue" properties, which can be used to
 *       distinguish create/update/delete operations and analyze changes in
 *       change handlers. In addition they carry a "origin" property, which
 *       is either "window", "local", or "remote". "remote" events are fired
 *       whenever a change comes in from Sync.
 *
 *   The sync interface (also on IndexedDB object):
 *     - #getNodes([paths]) returns the requested nodes in a promise.
 *     - #setNodes(map) stores all the nodes given in the (path -> node) map.
 *
 * @interface
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const cachinglayer_1 = __importDefault(__webpack_require__(/*! ./cachinglayer */ "./src/cachinglayer.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const DB_VERSION = 2;
const DEFAULT_DB_NAME = 'remotestorage';
// TODO very weird that this is re-assigned
let DEFAULT_DB;
class IndexedDB extends cachinglayer_1.default {
    constructor(database) {
        super();
        this.addEvents(['change', 'local-events-done']);
        this.db = database || DEFAULT_DB;
        if (!this.db) {
            // TODO shouldn't this throw an error?
            (0, log_1.default)("[IndexedDB] Failed to open DB");
            return undefined;
        }
        this.getsRunning = 0;
        this.putsRunning = 0;
        /**
         * Given a node for which uncommitted changes exist, this cache
         * stores either the entire uncommitted node, or false for a deletion.
         * The node's path is used as the key.
         *
         * changesQueued stores changes for which no IndexedDB transaction has
         * been started yet.
         */
        this.changesQueued = {};
        /**
         * Given a node for which uncommitted changes exist, this cache
         * stores either the entire uncommitted node, or false for a deletion.
         * The node's path is used as the key.
         *
         * At any time there is at most one IndexedDB transaction running.
         * changesRunning stores the changes that are included in that currently
         * running IndexedDB transaction, or if none is running, of the last one
         * that ran.
         */
        this.changesRunning = {};
        // TODO document
        this.commitSlownessWarning = null;
    }
    /**
     * TODO: Document
     */
    getNodes(paths) {
        return __awaiter(this, void 0, void 0, function* () {
            const misses = [], fromCache = {};
            for (let i = 0, len = paths.length; i < len; i++) {
                if (this.changesQueued[paths[i]] !== undefined) {
                    fromCache[paths[i]] = (0, util_1.deepClone)(this.changesQueued[paths[i]] || undefined);
                }
                else if (this.changesRunning[paths[i]] !== undefined) {
                    fromCache[paths[i]] = (0, util_1.deepClone)(this.changesRunning[paths[i]] || undefined);
                }
                else {
                    misses.push(paths[i]);
                }
            }
            if (misses.length > 0) {
                return this.getNodesFromDb(misses).then(function (nodes) {
                    for (const i in fromCache) {
                        nodes[i] = fromCache[i];
                    }
                    return nodes;
                });
            }
            else {
                return fromCache;
            }
        });
    }
    /**
     * TODO: Document
     */
    setNodes(nodes) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const i in nodes) {
                this.changesQueued[i] = nodes[i] || false;
            }
            this.maybeFlush();
        });
    }
    /**
     * TODO: Document
     */
    maybeFlush() {
        if (this.putsRunning === 0) {
            this.flushChangesQueued();
        }
        else {
            if (!this.commitSlownessWarning) {
                this.commitSlownessWarning = __webpack_require__.g.setInterval(function () {
                    console.warn('WARNING: waited more than 10 seconds for previous commit to finish');
                }, 10000);
            }
        }
    }
    /**
     * TODO: Document
     */
    flushChangesQueued() {
        if (this.commitSlownessWarning) {
            clearInterval(this.commitSlownessWarning);
            this.commitSlownessWarning = null;
        }
        if (Object.keys(this.changesQueued).length > 0) {
            this.changesRunning = this.changesQueued;
            this.changesQueued = {};
            this.setNodesInDb(this.changesRunning).then(this.flushChangesQueued.bind(this));
        }
    }
    /**
     * Retrieve nodes from the database
     *
     * @internal
     */
    getNodesFromDb(paths) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['nodes'], 'readonly');
            const nodes = transaction.objectStore('nodes');
            const retrievedNodes = {};
            this.getsRunning++;
            paths.map((path) => {
                nodes.get(path).onsuccess = (evt) => {
                    retrievedNodes[path] = evt.target.result;
                };
            });
            transaction.oncomplete = () => {
                resolve(retrievedNodes);
                this.getsRunning--;
            };
            transaction.onerror = transaction.onabort = () => {
                reject('get transaction error/abort');
                this.getsRunning--;
            };
        });
    }
    /**
     * Store nodes in the database
     *
     * @internal
     */
    setNodesInDb(nodes) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['nodes'], 'readwrite');
                const nodesStore = transaction.objectStore('nodes');
                const startTime = new Date().getTime();
                this.putsRunning++;
                (0, log_1.default)('[IndexedDB] Starting puts', nodes, this.putsRunning);
                for (const path in nodes) {
                    const node = nodes[path];
                    if (typeof (node) === 'object') {
                        try {
                            nodesStore.put(node);
                        }
                        catch (e) {
                            (0, log_1.default)('[IndexedDB] Error while putting', node, e);
                            throw e;
                        }
                    }
                    else {
                        try {
                            nodesStore.delete(path);
                        }
                        catch (e) {
                            (0, log_1.default)('[IndexedDB] Error while removing', nodesStore, node, e);
                            throw e;
                        }
                    }
                }
                transaction.oncomplete = () => {
                    this.putsRunning--;
                    (0, log_1.default)('[IndexedDB] Finished puts', nodes, this.putsRunning, (new Date().getTime() - startTime) + 'ms');
                    resolve();
                };
                transaction.onerror = () => {
                    this.putsRunning--;
                    reject('transaction error');
                };
                transaction.onabort = () => {
                    reject('transaction abort');
                    this.putsRunning--;
                };
            });
        });
    }
    /**
     * TODO: Document
     */
    // TODO add real types once known
    reset(callback) {
        const dbName = this.db.name;
        this.db.close();
        IndexedDB.clean(dbName, () => {
            IndexedDB.open(dbName, (err, other) => {
                if (err) {
                    (0, log_1.default)(`[IndexedDB] Error while resetting database ${dbName}:`, err);
                }
                else {
                    // hacky!
                    this.db = other;
                }
                if (typeof callback === 'function') {
                    callback(self);
                }
            });
        });
    }
    /**
     * TODO: Document
     */
    forAllNodes(cb) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve /*, reject*/) => {
                const transaction = this.db.transaction(['nodes'], 'readonly');
                const cursorReq = transaction.objectStore('nodes').openCursor();
                cursorReq.onsuccess = (evt) => {
                    const cursor = evt.target.result;
                    if (cursor) {
                        cb(cursor.value);
                        cursor.continue();
                    }
                    else {
                        resolve();
                    }
                };
            });
        });
    }
    closeDB() {
        if (this.putsRunning === 0) { // check if we are currently writing to the DB
            this.db.close();
        }
        else {
            setTimeout(this.closeDB.bind(this), 100); // try again a little later
        }
    }
    /**
     * TODO: Document
     */
    // TODO add real types once known
    static open(name, callback) {
        const timer = setTimeout(function () {
            callback("timeout trying to open db");
        }, 10000);
        try {
            const req = indexedDB.open(name, DB_VERSION);
            req.onerror = function () {
                (0, log_1.default)('[IndexedDB] Opening DB failed', req);
                clearTimeout(timer);
                callback(req.error);
            };
            req.onupgradeneeded = function (event) {
                const db = req.result;
                (0, log_1.default)("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);
                if (!db.objectStoreNames.contains('nodes')) {
                    (0, log_1.default)("[IndexedDB] Creating object store: nodes");
                    db.createObjectStore('nodes', { keyPath: 'path' });
                }
                if (!db.objectStoreNames.contains('changes')) {
                    (0, log_1.default)("[IndexedDB] Creating object store: changes");
                    db.createObjectStore('changes', { keyPath: 'path' });
                }
            };
            req.onsuccess = function () {
                clearTimeout(timer);
                // check if all object stores exist
                const db = req.result;
                if (!db.objectStoreNames.contains('nodes') || !db.objectStoreNames.contains('changes')) {
                    (0, log_1.default)("[IndexedDB] Missing object store. Resetting the database.");
                    db.close();
                    IndexedDB.clean(name, function () {
                        IndexedDB.open(name, callback);
                    });
                    return;
                }
                callback(null, req.result);
            };
        }
        catch (error) {
            (0, log_1.default)("[IndexedDB] Failed to open database: " + error);
            (0, log_1.default)("[IndexedDB] Resetting database and trying again.");
            clearTimeout(timer);
            IndexedDB.clean(name, function () {
                IndexedDB.open(name, callback);
            });
        }
    }
    /**
     * Cleanup: Delete IndexedDB database
     */
    static clean(databaseName, callback) {
        const req = indexedDB.deleteDatabase(databaseName);
        req.onblocked = function (evt) {
            console.warn(`Deleting IndexedDB database "${databaseName}" is blocked by another open connection`, evt);
        };
        req.onsuccess = function () {
            (0, log_1.default)(`[IndexedDB] Deleted database "${databaseName}"`);
            callback();
        };
        // TODO check if this does anything as onabort does not exist on type according to ts
        req.onerror = req.onabort = function (evt) {
            console.error('Failed to remove database "' + databaseName + '"', evt);
        };
    }
    /**
     * Initialize the IndexedDB backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(remoteStorage) {
        return new Promise((resolve, reject) => {
            IndexedDB.open(DEFAULT_DB_NAME, function (err, db) {
                if (err) {
                    reject(err);
                }
                else {
                    if (!db) {
                        reject(new Error('IndexedDB opened without a database instance'));
                        return;
                    }
                    DEFAULT_DB = db;
                    // TODO Use specific type
                    db.onerror = evt => {
                        remoteStorage._emit('error', IndexedDB.eventToError(evt));
                    };
                    resolve();
                }
            });
        });
    }
    /**
     * Inform about the availability of the IndexedDB backend.
     *
     * @param {Object} rs - RemoteStorage instance
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        return new Promise((resolve, reject) => {
            const context = (0, util_1.getGlobalContext)();
            // FIXME: this is causing an error in chrome
            // context.indexedDB = context.indexedDB    || context.webkitIndexedDB ||
            //                    context.mozIndexedDB || context.oIndexedDB      ||
            //                    context.msIndexedDB;
            // Detect browsers with known IndexedDb issues (e.g. Android pre-4.4)
            let poorIndexedDbSupport = false;
            if (typeof navigator !== 'undefined' &&
                navigator.userAgent.match(/Android (2|3|4\.[0-3])/)) {
                // Chrome and Firefox support IndexedDB
                if (!navigator.userAgent.match(/Chrome|Firefox/)) {
                    poorIndexedDbSupport = true;
                }
            }
            if ('indexedDB' in context && !poorIndexedDbSupport) {
                try {
                    const check = indexedDB.open("rs-check");
                    check.onerror = function ( /* event */) {
                        reject();
                    };
                    check.onsuccess = function ( /* event */) {
                        check.result.close();
                        indexedDB.deleteDatabase("rs-check");
                        resolve();
                    };
                }
                catch (e) {
                    reject();
                }
            }
            else {
                reject();
            }
        });
    }
    /**
     * Remove IndexedDB as a backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(remoteStorage) {
        return new Promise((resolve /*, reject*/) => {
            if (remoteStorage.local instanceof IndexedDB) {
                remoteStorage.local.closeDB();
            }
            IndexedDB.clean(DEFAULT_DB_NAME, resolve);
        });
    }
    static eventToError(evt) {
        var _a;
        const transaction = evt === null || evt === void 0 ? void 0 : evt.target;
        const error = transaction === null || transaction === void 0 ? void 0 : transaction.error;
        if (error) {
            return error;
        }
        else {
            if ((_a = transaction === null || transaction === void 0 ? void 0 : transaction.db) === null || _a === void 0 ? void 0 : _a.name) {
                const storeNamesList = transaction.objectStoreNames;
                const storeNames = storeNamesList
                    ? Array.from(storeNamesList).join(', ')
                    : '';
                return new Error(`Error in store(s) “${storeNames}” in database “${transaction.db.name}”`);
            }
            else {
                return new Error('Unknown IndexedDB error');
            }
        }
    }
    diffHandler() {
        // empty
    }
}
(0, util_1.applyMixins)(IndexedDB, [eventhandling_1.default]);
module.exports = IndexedDB;


/***/ }),

/***/ "./src/inmemorystorage.ts":
/*!********************************!*\
  !*** ./src/inmemorystorage.ts ***!
  \********************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const cachinglayer_1 = __importDefault(__webpack_require__(/*! ./cachinglayer */ "./src/cachinglayer.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
/**
 * In-memory caching adapter. Used when no IndexedDB or localStorage
 * available.
 *
 * @class
 **/
class InMemoryStorage extends cachinglayer_1.default {
    constructor() {
        super();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this._storage = {};
        this.addEvents(['change', 'local-events-done']);
    }
    getNodes(paths) {
        const nodes = {};
        for (let i = 0, len = paths.length; i < len; i++) {
            // Should use a clone of whatever we are retrieving to prevent
            // mutation, also to follow the same behavior as localStorage
            // and indexeddb.
            nodes[paths[i]] = (0, util_1.deepClone)(this._storage[paths[i]]);
        }
        return Promise.resolve(nodes);
    }
    setNodes(nodes) {
        for (const path in nodes) {
            if (nodes[path] === undefined) {
                delete this._storage[path];
            }
            else {
                this._storage[path] = nodes[path];
            }
        }
        return Promise.resolve();
    }
    forAllNodes(cb) {
        for (const path in this._storage) {
            cb(this._storage[path]);
        }
        return Promise.resolve();
    }
    diffHandler() {
        // empty
    }
    /**
     * Initialize the InMemoryStorage backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init() {
        // empty
    }
    /**
     * Inform about the availability of the InMemoryStorage backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        // In-memory storage is always supported
        return true;
    }
    /**
     * Remove InMemoryStorage as a backend.
     *
     * @protected
     */
    static _rs_cleanup() {
        // empty
    }
}
(0, util_1.applyMixins)(InMemoryStorage, [eventhandling_1.default]);
module.exports = InMemoryStorage;


/***/ }),

/***/ "./src/localstorage.ts":
/*!*****************************!*\
  !*** ./src/localstorage.ts ***!
  \*****************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const cachinglayer_1 = __importDefault(__webpack_require__(/*! ./cachinglayer */ "./src/cachinglayer.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
/**
 * localStorage caching adapter. Used when no IndexedDB available.
 **/
const NODES_PREFIX = "remotestorage:cache:nodes:";
const CHANGES_PREFIX = "remotestorage:cache:changes:";
function isRemoteStorageKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX ||
        key.substr(0, CHANGES_PREFIX.length) === CHANGES_PREFIX;
}
function isNodeKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX;
}
class LocalStorage extends cachinglayer_1.default {
    constructor() {
        super();
        this.addEvents(['change', 'local-events-done']);
    }
    // TODO use correct types
    diffHandler(...args) {
        return;
    }
    getNodes(paths) {
        const nodes = {};
        for (let i = 0, len = paths.length; i < len; i++) {
            try {
                const node = JSON.parse(localStorage.getItem(NODES_PREFIX + paths[i]));
                nodes[paths[i]] = node || undefined;
            }
            catch (e) {
                (0, log_1.default)(`[LocalStorage] Failed to get node: ${e.message}`);
                nodes[paths[i]] = undefined;
            }
        }
        return Promise.resolve(nodes);
    }
    setNodes(nodes) {
        for (const path in nodes) {
            localStorage.setItem(NODES_PREFIX + path, JSON.stringify(nodes[path]));
        }
        return Promise.resolve();
    }
    forAllNodes(cb) {
        let node;
        for (let i = 0, len = localStorage.length; i < len; i++) {
            if (isNodeKey(localStorage.key(i))) {
                try {
                    node = JSON.parse(localStorage.getItem(localStorage.key(i)));
                }
                catch (e) {
                    node = undefined;
                }
                if (node) {
                    cb(node);
                }
            }
        }
        return Promise.resolve();
    }
    /**
     * Initialize the LocalStorage backend.
     *
     * @protected
     */
    static _rs_init() {
        return;
    }
    /**
     * Inform about the availability of the LocalStorage backend.
     *
     * @protected
     */
    static _rs_supported() {
        return (0, util_1.localStorageAvailable)();
    }
    /**
     * Remove LocalStorage as a backend.
     *
     * @protected
     *
     * TODO: tests missing!
     */
    static _rs_cleanup() {
        const keys = [];
        (0, log_1.default)('[LocalStorage] Starting cleanup');
        for (let i = 0, len = localStorage.length; i < len; i++) {
            const key = localStorage.key(i);
            if (isRemoteStorageKey(key)) {
                keys.push(key);
            }
        }
        for (const key in keys) {
            (0, log_1.default)('[LocalStorage] Removing', key);
            localStorage.removeItem(key);
        }
        ;
    }
}
(0, util_1.applyMixins)(LocalStorage, [eventhandling_1.default]);
module.exports = LocalStorage;


/***/ }),

/***/ "./src/log.ts":
/*!********************!*\
  !*** ./src/log.ts ***!
  \********************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
/**
 * Log using console.log, when remoteStorage logging is enabled.
 *
 * You can enable logging with ``RemoteStorage#enableLog``.
 *
 * (You can also enable logging during remoteStorage object creation. See:
 * {@link RemoteStorage}).
 */
function log(...args) {
    if (config_1.default.logging) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
}
module.exports = log;


/***/ }),

/***/ "./src/remote.ts":
/*!***********************!*\
  !*** ./src/remote.ts ***!
  \***********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RemoteBase = void 0;
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
/**
 * The ancestor for WireClient, GoogleDrive & Dropbox
 */
class RemoteBase extends eventhandling_1.default {
    constructor(rs) {
        super();
        this.rs = rs;
        this.connected = false;
        // TODO: Should `online` be set true or false for all, here or in configure?
    }
    stopWaitingForToken() {
        if (!this.connected) {
            this._emit('not-connected');
        }
    }
    addQuotes(str) {
        if (typeof (str) !== 'string') {
            return str;
        }
        if (str === '*') {
            return '*';
        }
        return '"' + str + '"';
    }
    stripQuotes(str) {
        if (typeof (str) !== 'string') {
            return str;
        }
        return str.replace(/^["']|["']$/g, '');
    }
    isForbiddenRequestMethod(method, uri) {
        if (method === 'PUT' || method === 'DELETE') {
            return (0, util_1.isFolder)(uri);
        }
        else {
            return false;
        }
    }
}
exports.RemoteBase = RemoteBase;


/***/ }),

/***/ "./src/remotestorage.ts":
/*!******************************!*\
  !*** ./src/remotestorage.ts ***!
  \******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RemoteStorage = void 0;
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const access_1 = __importDefault(__webpack_require__(/*! ./access */ "./src/access.ts"));
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
const baseclient_1 = __importDefault(__webpack_require__(/*! ./baseclient */ "./src/baseclient.ts"));
const caching_1 = __importDefault(__webpack_require__(/*! ./caching */ "./src/caching.ts"));
const eventhandling_1 = __webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts");
const googledrive_1 = __importDefault(__webpack_require__(/*! ./googledrive */ "./src/googledrive.ts"));
const dropbox_1 = __importDefault(__webpack_require__(/*! ./dropbox */ "./src/dropbox.ts"));
const discover_1 = __importDefault(__webpack_require__(/*! ./discover */ "./src/discover.ts"));
const sync_error_1 = __importDefault(__webpack_require__(/*! ./sync-error */ "./src/sync-error.ts"));
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const features_1 = __importDefault(__webpack_require__(/*! ./features */ "./src/features.ts"));
// TODO this is assigned to RemoteStorage.util later; check if still needed
const util = __importStar(__webpack_require__(/*! ./util */ "./src/util.ts"));
const globalContext = (0, util_1.getGlobalContext)();
// declare global {
//   interface Window { cordova: any };
// }
let hasLocalStorage;
const AUTHORIZED_SCOPE_KEY = 'remotestorage:authorized-scope';
const PENDING_SCOPE_KEY = 'remotestorage:pending-scope';
function normalizeScope(scope) {
    if (typeof scope !== 'string') {
        return null;
    }
    const scopes = scope
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (scopes.length === 0) {
        return null;
    }
    return Array.from(new Set(scopes)).sort().join(' ');
}
function readStoredScopeSettings(key) {
    const settings = (0, util_1.getJSONFromLocalStorage)(key);
    if (typeof settings === 'object' && settings !== null) {
        return settings;
    }
    return null;
}
// TODO document and/or refactor (seems weird)
function emitUnauthorized(r) {
    if (r.statusCode === 403 || r.statusCode === 401) {
        this._emit('error', new unauthorized_error_1.default());
    }
    return Promise.resolve(r);
}
/**
* Check if interval is valid: numeric and between 2s and 1hr inclusive
*/
function isValidInterval(interval) {
    return (typeof interval === 'number' &&
        interval >= 2000 &&
        interval <= 3600000);
}
var ApiKeyType;
(function (ApiKeyType) {
    ApiKeyType["GOOGLE"] = "googledrive";
    ApiKeyType["DROPBOX"] = "dropbox";
})(ApiKeyType || (ApiKeyType = {}));
/**
 * Create a `remoteStorage` class instance so:
 *
 * ```js
 * const remoteStorage = new RemoteStorage();
 * ```
 *
 * The constructor can optionally be called with a configuration object. This
 * example shows all default values:
 *
 * ```js
 * const remoteStorage = new RemoteStorage({
 *   cache: true,
 *   changeEvents: {
 *     local:    true,
 *     window:   false,
 *     remote:   true,
 *     conflict: true
 *   },
 *   cordovaRedirectUri: undefined,
 *   logging: false,
 *   modules: []
 * });
 * ```
 *
 * > [!NOTE]
 * > In the current version, it is only possible to use a single `remoteStorage`
 * > instance. You cannot connect to two different remotes in parallel yet.
 * > We intend to support this eventually.
 *
 * > [!TIP]
 * > For the change events configuration, you have to set all events
 * > explicitly.  Otherwise it disables the unspecified ones.
 *
 * ## Events
 *
 * You can add event handlers to your `remoteStorage` instance by using the
 * {@link on} function. For example:
 *
 * ```js
 * remoteStorage.on('connected', function() {
 *   // Storage account has been connected, let’s roll!
 * });
 * ```
 *
 * ### `ready`
 *
 * Emitted when all features are loaded and the RS instance is ready to be used
 * in your app
 *
 * ### `not-connected`
 *
 * Emitted when ready, but no storage connected ("anonymous mode")
 *
 * > [!NOTE]
 * > In non-browser environments, this will always be emitted (before any
 * > potential `connected` events after)
 *
 * ### `connected`
 *
 * Emitted when a remote storage has been connected
 *
 * ### `disconnected`
 *
 * Emitted after disconnect
 *
 * ### `error`
 *
 * Emitted when an error occurs; receives an error object as argument
 *
 * There are a handful of known errors, which are identified by the `name`
 * property of the error object:
 *
 * * `Unauthorized`
 *
 *   Emitted when a network request resulted in a 401 or 403 response. You can
 *   use this event to handle invalid OAuth tokens in custom UI (i.e. when a
 *   stored token has been revoked or expired by the RS server).
 *
 * * `DiscoveryError`
 *
 *   A variety of storage discovery errors, e.g. from user address input
 *   validation, or user address lookup issues
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('error', err => console.log(err));
 *
 * // {
 * //   name: "Unauthorized",
 * //   message: "App authorization expired or revoked.",
 * //   stack: "Error↵  at new a.Unauthorized (vendor.js:65710:41870)"
 * // }
 * ```
 *
 * ### `connecting`
 *
 * Emitted before webfinger lookup
 *
 * ### `authing`
 *
 * Emitted before redirecting to the OAuth server
 *
 * ### `scope-change-required`
 *
 * Emitted when the currently claimed access scopes differ from the last
 * authorized scope stored in localStorage. The callback receives an object
 * containing the previously authorized scope, the currently requested scope,
 * and a `reauthorize()` helper.
 *
 * ### `wire-busy`
 *
 * Emitted when a network request starts
 *
 * ### `wire-done`
 *
 * Emitted when a network request completes
 *
 * ### `sync-started`
 *
 * Emitted when a sync procedure has started.
 *
 * ### `sync-req-done`
 *
 * Emitted when a single sync request has finished. Callback functions
 * receive an object as argument, informing the client of remaining items
 * in the current sync task queue.
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('sync-req-done', result => console.log(result));
 * // { tasksRemaining: 21 }
 * ```
 *
 * > [!NOTE]
 * > The internal task queue holds at most 100 items at the same time,
 * > regardless of the overall amount of items to sync. Therefore, this number
 * > is only an indicator of sync status, not a precise amount of items left
 * > to sync. It can be useful to determine if your app should display any
 * > kind of sync status/progress information for the cycle or not.
 *
 * ### `sync-done`
 *
 * Emitted when a sync cycle has been completed and a new sync is scheduled.
 *
 * The callback function receives an object as argument, informing the client
 * if the sync process has completed successfully or not.
 *
 * #### Example
 *
 * ```js
 * remoteStorage.on('sync-done', result => console.log(result));
 * // { completed: true }
 * ```
 *
 * If `completed` is `false`, it means that some of the sync requests have
 * failed and will be retried in the next sync cycle (usually a few seconds
 * later in this case). This is not an unusual scenario on mobile networks or
 * when doing a large initial sync for example.
 *
 * For an app's user interface, you may want to consider the sync process as
 * ongoing in this case, and wait until your app sees a positive `completed`
 * status before updating the UI.
 *
 * ### `network-offline`
 *
 * Emitted once when a wire request fails for the first time, and
 * `remote.online` is set to false
 *
 * ### `network-online`
 *
 * Emitted once when a wire request succeeds for the first time after a failed
 * one, and `remote.online` is set back to true
 *
 * ### `sync-interval-change`
 *
 * Emitted when the sync interval changes
 */
class RemoteStorage {
    constructor(cfg) {
        /**
         * Pending get/put/delete calls
         * @internal
         */
        this._pending = [];
        /**
         * TODO: document
         * @internal
         */
        this._cleanups = [];
        /**
         * TODO: document
         * @internal
         */
        this._pathHandlers = { change: {} };
        /**
         * Holds OAuth app keys for Dropbox, Google Drive
         * @internal
         */
        this.apiKeys = {};
        //
        // FEATURES INITIALIZATION
        //
        /**
         * @internal
         */
        this._init = features_1.default.loadFeatures;
        /**
         * @internal
         */
        this.features = features_1.default.features;
        /**
         * @internal
         */
        this.loadFeature = features_1.default.loadFeature;
        /**
         * @internal
         */
        this.featureSupported = features_1.default.featureSupported;
        /**
         * @internal
         */
        this.featureDone = features_1.default.featureDone;
        /**
         * @internal
         */
        this.featuresDone = features_1.default.featuresDone;
        /**
         * @internal
         */
        this.featuresLoaded = features_1.default.featuresLoaded;
        /**
         * @internal
         */
        this.featureInitialized = features_1.default.featureInitialized;
        /**
         * @internal
         */
        this.featureFailed = features_1.default.featureFailed;
        /**
         * @internal
         */
        this.hasFeature = features_1.default.hasFeature;
        /**
         * @internal
         */
        this._setCachingModule = features_1.default._setCachingModule;
        /**
         * @internal
         */
        this._collectCleanupFunctions = features_1.default._collectCleanupFunctions;
        /**
         * @internal
         */
        this._fireReady = features_1.default._fireReady;
        /**
         * @internal
         */
        this.initFeature = features_1.default.initFeature;
        // Initial configuration property settings.
        // TODO use modern JS to merge object properties
        if (typeof cfg === 'object') {
            (0, util_1.extend)(config_1.default, cfg);
        }
        this.addEvents([
            'ready', 'authing', 'connecting', 'connected', 'disconnected',
            'not-connected', 'conflict', 'error', 'features-loaded',
            'scope-change-required', 'sync-interval-change', 'sync-started', 'sync-req-done', 'sync-done',
            'wire-busy', 'wire-done', 'network-offline', 'network-online'
        ]);
        this._setGPD({
            get: this._pendingGPD('get'),
            put: this._pendingGPD('put'),
            delete: this._pendingGPD('delete')
        });
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (hasLocalStorage) {
            this.apiKeys = (0, util_1.getJSONFromLocalStorage)('remotestorage:api-keys') || {};
            const backendType = localStorage.getItem('remotestorage:backend');
            if (backendType === 'dropbox' || backendType === 'googledrive') {
                this.setBackend(backendType);
            }
            else {
                this.setBackend('remotestorage');
            }
        }
        this._authorizedScope = this._loadAuthorizedScope();
        this._scopeChangeRequired = false;
        this._scopeChangeEvent = null;
        // Keep a reference to the original `on` function
        const origOn = this.on;
        this.on = function (eventName, handler) {
            const registration = origOn.call(this, eventName, handler);
            if (eventName === 'scope-change-required' && this._scopeChangeRequired && this._scopeChangeEvent) {
                // Treat this as a sticky startup condition, so late listeners still see it.
                setTimeout(() => {
                    handler(this._scopeChangeEvent);
                }, 0);
            }
            if (this._allLoaded) {
                // check if the handler should be called immediately, because the
                // event has happened already
                switch (eventName) {
                    case 'features-loaded':
                        setTimeout(handler, 0);
                        break;
                    case 'ready':
                        if (this.remote) {
                            setTimeout(handler, 0);
                        }
                        break;
                    case 'connected':
                        if (this.remote && this.remote.connected) {
                            setTimeout(handler, 0);
                        }
                        break;
                    case 'not-connected':
                        if (this.remote && !this.remote.connected) {
                            setTimeout(handler, 0);
                        }
                        break;
                }
            }
            return registration;
        };
        // load all features and emit `ready`
        this._init();
        this.fireInitial = function () {
            // When caching is turned on, emit change events with origin "local" for
            // all cached documents
            if (this.local) {
                setTimeout(this.local.fireInitial.bind(this.local), 0);
            }
        }.bind(this);
        this.on('ready', this.fireInitial.bind(this));
        this.loadModules();
    }
    /**
     * Indicating if remoteStorage is currently connected.
     */
    get connected() {
        return this.remote.connected;
    }
    get scopeChangeRequired() {
        return this._scopeChangeRequired;
    }
    /**
     * Load all modules passed as arguments
     *
     * @internal
     */
    loadModules() {
        config_1.default.modules.forEach(this.addModule.bind(this));
    }
    /**
     * Initiate the OAuth authorization flow.
     *
     * @internal
     */
    authorize(options) {
        this.access.setStorageType(this.remote.storageApi);
        if (typeof options.scope === 'undefined') {
            options.scope = this.access.scopeParameter;
        }
        if (globalContext.cordova && typeof config_1.default.cordovaRedirectUri === 'string') {
            options.redirectUri = config_1.default.cordovaRedirectUri;
        }
        else {
            const location = authorize_1.default.getLocation();
            let redirectUri = location.origin;
            if (location.pathname !== '/') {
                redirectUri += location.pathname;
            }
            options.redirectUri = redirectUri;
        }
        if (typeof options.clientId === 'undefined') {
            options.clientId = options.redirectUri.match(/^(https?:\/\/[^/]+)/)[0];
        }
        authorize_1.default.authorize(this, options);
    }
    /**
     * TODO: document
     * @internal
     */
    impliedauth(storageApi, redirectUri) {
        // TODO shouldn't these be default argument values?
        storageApi = storageApi || this.remote.storageApi;
        redirectUri = redirectUri || String(document.location);
        (0, log_1.default)('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
        // Set a fixed access token, signalling to not send it as Bearer
        this.remote.configure({
            token: authorize_1.default.IMPLIED_FAKE_TOKEN
        });
        document.location.href = redirectUri;
    }
    /**
     * Connect to a remoteStorage server.
     *
     * Discovers the WebFinger profile of the given user address and initiates
     * the OAuth dance.
     *
     * This method must be called *after* all required access has been claimed.
     * When using the connect widget, it will call this method when the user
     * clicks/taps the "connect" button.
     *
     * Special cases:
     *
     * 1. If a bearer token is supplied as second argument, the OAuth dance
     *    will be skipped and the supplied token be used instead. This is
     *    useful outside of browser environments, where the token has been
     *    acquired in a different way.
     *
     * 2. If the Webfinger profile for the given user address doesn't contain
     *    an auth URL, the library will assume that client and server have
     *    established authorization among themselves, which will omit bearer
     *    tokens in all requests later on. This is useful for example when using
     *    Kerberos and similar protocols.
     *
     * @param userAddress - The user address (user@host) or URL to connect to.
     * @param token       - (optional) A bearer token acquired beforehand
     *
     * @example
     * remoteStorage.connect('user@example.com');
     */
    connect(userAddress, token) {
        this.setBackend('remotestorage');
        if (userAddress.indexOf('@') < 0 && !userAddress.match(/^(https?:\/\/)?[^\s\/$\.?#]+\.[^\s]*$/)) {
            this._emit('error', new RemoteStorage.DiscoveryError("Not a valid user address or URL."));
            return;
        }
        // Prefix URL with https:// if it's missing
        if (userAddress.indexOf('@') < 0 && !userAddress.match(/^https?:\/\//)) {
            userAddress = `https://${userAddress}`;
        }
        if (globalContext.cordova) {
            if (typeof config_1.default.cordovaRedirectUri !== 'string') {
                this._emit('error', new RemoteStorage.DiscoveryError("Please supply a custom HTTPS redirect URI for your Cordova app"));
                return;
            }
            if (!globalContext.cordova.InAppBrowser) {
                this._emit('error', new RemoteStorage.DiscoveryError("Please include the InAppBrowser Cordova plugin to enable OAuth"));
                return;
            }
        }
        this.remote.configure({
            userAddress: userAddress
        });
        this._emit('connecting');
        RemoteStorage.Discover(userAddress).then((info) => {
            this._emit('authing');
            info.userAddress = userAddress;
            this.remote.configure(info);
            if (!this.remote.connected) {
                if (info.authURL) {
                    if (typeof token === 'undefined') {
                        // Normal authorization step; the default way to connect
                        this.authorize({ authURL: info.authURL });
                    }
                    else if (typeof token === 'string') {
                        // Token supplied directly by app/developer/user
                        (0, log_1.default)('Skipping authorization sequence and connecting with known token');
                        this.remote.configure({ token: token });
                        this._rememberAuthorizedScope(this.access.scopeParameter);
                    }
                    else {
                        throw new Error("Supplied bearer token must be a string");
                    }
                }
                else {
                    // In lieu of an excplicit authURL, assume that the browser and
                    // server handle any authorization needs; for instance, TLS may
                    // trigger the browser to use a client certificate, or a 401 Not
                    // Authorized response may make the browser send a Kerberos ticket
                    // using the SPNEGO method.
                    this.impliedauth();
                }
            }
        }, ( /*err*/) => {
            this._emit('error', new RemoteStorage.DiscoveryError("No storage information found for this user address."));
        });
    }
    /**
     * Reconnect the remote server to get a new authorization.
     *
     * Useful when not using the connect widget and encountering an
     * `Unauthorized` event.
     */
    reconnect() {
        this.remote.configure({ token: null });
        if (this.backend === 'remotestorage') {
            this.connect(this.remote.userAddress);
        }
        else {
            this.remote.connect();
        }
    }
    /**
     * Alias for {@link reconnect}, intended for permission refresh flows.
     */
    reauthorize() {
        this.reconnect();
    }
    /**
     * "Disconnect" from remote server to terminate current session.
     *
     * This method clears all stored settings and deletes the entire local
     * cache.
     */
    disconnect() {
        if (this.remote) {
            this.remote.configure({
                userAddress: null,
                href: null,
                storageApi: null,
                token: null,
                properties: null
            });
        }
        this._forgetPendingScope();
        this._rememberAuthorizedScope(null);
        this._setGPD({
            get: this._pendingGPD('get'),
            put: this._pendingGPD('put'),
            delete: this._pendingGPD('delete')
        });
        const n = this._cleanups.length;
        let i = 0;
        const oneDone = () => {
            i++;
            if (i >= n) {
                this._init();
                (0, log_1.default)('Cleanups done, emitting "disconnected" event');
                this._emit('disconnected');
            }
        };
        if (n > 0) {
            this._cleanups.forEach((cleanup) => {
                const cleanupResult = cleanup(this);
                if (typeof (cleanupResult) === 'object' && typeof (cleanupResult.then) === 'function') {
                    cleanupResult.then(oneDone);
                }
                else {
                    oneDone();
                }
            });
        }
        else {
            oneDone();
        }
    }
    /**
     * @internal
     */
    setBackend(backendType) {
        this.backend = backendType;
        if (hasLocalStorage) {
            if (typeof backendType !== 'undefined') {
                localStorage.setItem('remotestorage:backend', backendType);
            }
            else {
                localStorage.removeItem('remotestorage:backend');
            }
        }
        if (typeof backendType === 'undefined') {
            // Clearing the active backend should also clear any in-memory scope drift
            // state, while leaving per-backend persisted scope snapshots untouched.
            this._authorizedScope = null;
            this._scopeChangeRequired = false;
            this._scopeChangeEvent = null;
            return;
        }
        this._authorizedScope = this._loadAuthorizedScope();
        this._checkScopeChange();
    }
    _rememberPendingScope(scope) {
        const normalizedScope = normalizeScope(scope);
        if (!hasLocalStorage) {
            return;
        }
        if (!normalizedScope || !this.backend) {
            localStorage.removeItem(PENDING_SCOPE_KEY);
            return;
        }
        localStorage.setItem(PENDING_SCOPE_KEY, JSON.stringify({
            backend: this.backend,
            scope: normalizedScope
        }));
    }
    _forgetPendingScope() {
        if (hasLocalStorage) {
            localStorage.removeItem(PENDING_SCOPE_KEY);
        }
    }
    _rememberAuthorizedScope(scope) {
        const normalizedScope = normalizeScope(scope);
        if (!hasLocalStorage) {
            this._authorizedScope = normalizedScope;
            this._checkScopeChange();
            return;
        }
        if (!normalizedScope || !this.backend) {
            localStorage.removeItem(AUTHORIZED_SCOPE_KEY);
            this._authorizedScope = null;
            this._checkScopeChange();
            return;
        }
        localStorage.setItem(AUTHORIZED_SCOPE_KEY, JSON.stringify({
            backend: this.backend,
            scope: normalizedScope
        }));
        this._authorizedScope = normalizedScope;
        this._checkScopeChange();
    }
    _completeAuthorization(scope) {
        // Prefer the stored pre-redirect request, because OAuth responses don't
        // always echo the granted scope back.
        const normalizedScope = this._loadPendingScope() || normalizeScope(scope);
        this._forgetPendingScope();
        if (normalizedScope) {
            this._rememberAuthorizedScope(normalizedScope);
        }
        else {
            this._checkScopeChange();
        }
    }
    _checkScopeChange() {
        const requestedScope = normalizeScope(this.access.scopeParameter);
        const authorizedScope = this._authorizedScope || this._loadAuthorizedScope();
        // Any normalized scope drift should prompt reauth, even when permissions shrink.
        const scopeChangeRequired = !!(requestedScope && authorizedScope && requestedScope !== authorizedScope);
        const shouldEmit = scopeChangeRequired && (!this._scopeChangeRequired ||
            !this._scopeChangeEvent ||
            this._scopeChangeEvent.requestedScope !== requestedScope ||
            this._scopeChangeEvent.authorizedScope !== authorizedScope);
        this._scopeChangeRequired = scopeChangeRequired;
        if (scopeChangeRequired) {
            this._scopeChangeEvent = this._buildScopeChangeEvent(requestedScope, authorizedScope);
            if (shouldEmit) {
                this._emit('scope-change-required', this._scopeChangeEvent);
            }
        }
        else {
            this._scopeChangeEvent = null;
        }
    }
    _loadAuthorizedScope() {
        if (!hasLocalStorage || !this.backend) {
            return null;
        }
        const settings = readStoredScopeSettings(AUTHORIZED_SCOPE_KEY);
        if (!settings || settings.backend !== this.backend) {
            return null;
        }
        return normalizeScope(settings.scope);
    }
    _loadPendingScope() {
        if (!hasLocalStorage || !this.backend) {
            return null;
        }
        const settings = readStoredScopeSettings(PENDING_SCOPE_KEY);
        if (!settings || settings.backend !== this.backend) {
            return null;
        }
        return normalizeScope(settings.scope);
    }
    _buildScopeChangeEvent(requestedScope = normalizeScope(this.access.scopeParameter), authorizedScope = this._authorizedScope) {
        return {
            requestedScope: requestedScope || '',
            authorizedScope: authorizedScope || '',
            reauthorize: this.reauthorize.bind(this)
        };
    }
    /**
     * Add a `change` event handler for the given path. Whenever a change
     * happens (as determined by the local backend, such as e.g.
     * `RemoteStorage.IndexedDB`), and the affected path is equal to or below the
     * given 'path', the given handler is called.
     *
     * > [!TIP]
     * > You should usually not use this method, but instead use the
     * > `change` events provided by {@link BaseClient}.
     *
     * @param path - Absolute path to attach handler to
     * @param handler - A function to handle the change
     *
     * @example
     * remoteStorage.onChange('/bookmarks/', function() {
     *   // your code here
     * })
     */
    onChange(path, handler) {
        if (!this._pathHandlers.change[path]) {
            this._pathHandlers.change[path] = [];
        }
        this._pathHandlers.change[path].push(handler);
    }
    /**
     * Enable remoteStorage debug logging.
     *
     * Usually done when instantiating remoteStorage:
     *
     * ```js
     * const remoteStorage = new RemoteStorage({ logging: true });
     * ```
     */
    enableLog() {
        config_1.default.logging = true;
    }
    /**
     * Disable remoteStorage debug logging
     */
    disableLog() {
        config_1.default.logging = false;
    }
    /**
     * Log something to the debug log
     *
     * @internal
     */
    log(...args) {
        log_1.default.apply(RemoteStorage, args);
    }
    /**
     * Set the OAuth key/ID for GoogleDrive and/or Dropbox backend support.
     *
     * @param apiKeys - A config object
     *
     * @example
     * remoteStorage.setApiKeys({
     *   dropbox: 'your-app-key',
     *   googledrive: 'your-client-id'
     * });
     */
    setApiKeys(apiKeys) {
        const validTypes = [ApiKeyType.GOOGLE, ApiKeyType.DROPBOX];
        if (typeof apiKeys !== 'object' || !Object.keys(apiKeys).every(type => validTypes.includes(type))) {
            console.error('setApiKeys() was called with invalid arguments');
            return false;
        }
        Object.keys(apiKeys).forEach(type => {
            const key = apiKeys[type];
            if (!key) {
                delete this.apiKeys[type];
                return;
            }
            switch (type) {
                case ApiKeyType.DROPBOX:
                    this.apiKeys[ApiKeyType.DROPBOX] = { appKey: key };
                    if (typeof this.dropbox === 'undefined' ||
                        this.dropbox.clientId !== key) {
                        dropbox_1.default._rs_init(this);
                    }
                    break;
                case ApiKeyType.GOOGLE:
                    this.apiKeys[ApiKeyType.GOOGLE] = { clientId: key };
                    if (typeof this.googledrive === 'undefined' ||
                        this.googledrive.clientId !== key) {
                        googledrive_1.default._rs_init(this);
                    }
                    break;
            }
            return true;
        });
        if (hasLocalStorage) {
            localStorage.setItem('remotestorage:api-keys', JSON.stringify(this.apiKeys));
        }
    }
    /**
     * Set redirect URI to be used for the OAuth redirect within the
     * in-app-browser window in Cordova apps. See
     * [Usage in Cordova apps](../../../cordova) for details.
     *
     * @param uri - A valid HTTP(S) URI
     *
     * @example
     * remoteStorage.setCordovaRedirectUri('https://app.example.com');
     */
    setCordovaRedirectUri(uri) {
        if (typeof uri !== 'string' || !uri.match(/http(s)?:\/\//)) {
            throw new Error("Cordova redirect URI must be a URI string");
        }
        config_1.default.cordovaRedirectUri = uri;
    }
    //
    // GET/PUT/DELETE INTERFACE HELPERS
    //
    /**
     * TODO: document
     * @internal
     */
    _setGPD(impl, context) {
        function wrap(func) {
            return function (...args) {
                return func.apply(context, args)
                    .then(emitUnauthorized.bind(this));
            };
        }
        this.get = wrap(impl.get);
        this.put = wrap(impl.put);
        this.delete = wrap(impl.delete);
    }
    /**
     * TODO: document
     * @internal
     */
    _pendingGPD(methodName) {
        return (...args) => {
            const methodArguments = Array.prototype.slice.call(args);
            return new Promise((resolve, reject) => {
                this._pending.push({
                    method: methodName,
                    args: methodArguments,
                    promise: {
                        resolve: resolve,
                        reject: reject
                    }
                });
            });
        };
    }
    /**
     * TODO: document
     * @internal
     */
    _processPending() {
        this._pending.forEach((pending) => {
            try {
                this[pending.method](...pending.args).then(pending.promise.resolve, pending.promise.reject);
            }
            catch (e) {
                pending.promise.reject(e);
            }
        });
        this._pending = [];
    }
    //
    // CHANGE EVENT HANDLING
    //
    /**
     * TODO: document
     * @internal
     */
    _bindChange(object) {
        object.on('change', this._dispatchEvent.bind(this, 'change'));
    }
    /**
     * TODO: document
     * @internal
     */
    _dispatchEvent(eventName, event) {
        Object.keys(this._pathHandlers[eventName]).forEach((path) => {
            const pl = path.length;
            if (event.path.substr(0, pl) === path) {
                this._pathHandlers[eventName][path].forEach((handler) => {
                    const ev = {};
                    for (const key in event) {
                        ev[key] = event[key];
                    }
                    ev.relativePath = event.path.replace(new RegExp('^' + path), '');
                    try {
                        handler(ev);
                    }
                    catch (e) {
                        console.error("'change' handler failed: ", e, e.stack);
                        this._emit('error', e);
                    }
                });
            }
        });
    }
    /**
     * This method allows you to quickly instantiate a BaseClient, which you can
     * use to directly read and manipulate data in the connected storage account.
     *
     * Please use this method only for debugging and development, and choose or
     * create a [data module](../../../data-modules/) for your app to use.
     *
     * @param path - The base directory of the BaseClient that will be returned
     *               (with a leading and a trailing slash)
     *
     * @returns A client with the specified scope (category/base directory)
     *
     * @example
     * remoteStorage.scope('/pictures/').getListing('');
     * remoteStorage.scope('/public/pictures/').getListing('');
     */
    scope(path) {
        if (typeof (path) !== 'string') {
            throw 'Argument \'path\' of baseClient.scope must be a string';
        }
        if (!this.access.checkPathPermission(path, 'r')) {
            console.warn('WARNING: Please use remoteStorage.access.claim() to ask for access permissions first: https://remotestorage.io/rs.js/docs/api/access/classes/Access.html#claim');
        }
        return new baseclient_1.default(this, path);
    }
    /**
     * Get the value of the sync interval when application is in the foreground
     *
     * @returns A number of milliseconds
     *
     * @example
     * remoteStorage.getSyncInterval();
     * // 10000
     */
    getSyncInterval() {
        return config_1.default.syncInterval;
    }
    /**
     * Set the value of the sync interval when application is in the foreground
     *
     * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
     *
     * @example
       remoteStorage.setSyncInterval(20000);
     */
    setSyncInterval(interval) {
        if (!isValidInterval(interval)) {
            throw interval + " is not a valid sync interval";
        }
        const oldValue = config_1.default.syncInterval;
        config_1.default.syncInterval = interval;
        this._emit('sync-interval-change', {
            oldValue: oldValue,
            newValue: interval
        });
    }
    /**
     * Get the value of the sync interval when application is in the background
     *
     * @returns A number of milliseconds
     *
     * @example
     * remoteStorage.getBackgroundSyncInterval();
     * // 60000
     */
    getBackgroundSyncInterval() {
        return config_1.default.backgroundSyncInterval;
    }
    /**
     * Set the value of the sync interval when the application is in the
     * background
     *
     * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
     *
     * @example
     * remoteStorage.setBackgroundSyncInterval(90000);
     */
    setBackgroundSyncInterval(interval) {
        if (!isValidInterval(interval)) {
            throw interval + " is not a valid sync interval";
        }
        const oldValue = config_1.default.backgroundSyncInterval;
        config_1.default.backgroundSyncInterval = interval;
        this._emit('sync-interval-change', {
            oldValue: oldValue,
            newValue: interval
        });
    }
    /**
     * Get the value of the current sync interval. Can be background or
     * foreground, custom or default.
     *
     * @returns number of milliseconds
     *
     * @example
     * remoteStorage.getCurrentSyncInterval();
     * // 15000
     */
    getCurrentSyncInterval() {
        return config_1.default.isBackground ? config_1.default.backgroundSyncInterval : config_1.default.syncInterval;
    }
    /**
     * Get the value of the current network request timeout
     *
     * @returns A number of milliseconds
     *
     * @example
     * remoteStorage.getRequestTimeout();
     * // 30000
     */
    getRequestTimeout() {
        return config_1.default.requestTimeout;
    }
    /**
     * Set the timeout for network requests.
     *
     * @param timeout - Timeout in milliseconds
     *
     * @example
     * remoteStorage.setRequestTimeout(30000);
     */
    setRequestTimeout(timeout) {
        if (typeof timeout !== 'number') {
            throw timeout + " is not a valid request timeout";
        }
        config_1.default.requestTimeout = timeout;
    }
    /**
     * Add a handler to schedule periodic sync if sync enabled
     *
     * @internal
     */
    setupSyncCycle() {
        if (!this.sync || this.sync.stopped) {
            return;
        }
        (0, log_1.default)('[Sync] Setting up sync cycle');
        this.on('sync-done', () => {
            (0, log_1.default)('[Sync] Sync done. Setting timer to', this.getCurrentSyncInterval());
            if (this.sync && !this.sync.stopped) {
                if (this._syncTimer) {
                    clearTimeout(this._syncTimer);
                }
                this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getCurrentSyncInterval());
            }
        });
        this.sync.sync();
    }
    /**
     * Start synchronization with remote storage, downloading and uploading any
     * changes within the cached paths.
     *
     * Please consider: local changes will attempt sync immediately, and remote
     * changes should also be synced timely when using library defaults. So
     * this is mostly useful for letting users sync manually, when pressing a
     * sync button for example. This might feel safer to them sometimes, esp.
     * when shifting between offline and online a lot.
     *
     * @returns A Promise which resolves when the sync has finished
     */
    startSync() {
        if (!config_1.default.cache) {
            console.warn('Nothing to sync, because caching is disabled.');
            return Promise.resolve();
        }
        this.sync.stopped = false;
        this.syncStopped = false;
        return this.sync.sync();
    }
    /**
     * Stop the periodic synchronization.
     */
    stopSync() {
        clearTimeout(this._syncTimer);
        this._syncTimer = undefined;
        if (this.sync) {
            (0, log_1.default)('[Sync] Stopping sync');
            this.sync.stopped = true;
        }
        else {
            // The sync class has not been initialized yet, so we make sure it will
            // not start the syncing process as soon as it's initialized.
            (0, log_1.default)('[Sync] Will instantiate sync stopped');
            this.syncStopped = true;
        }
    }
    /**
     * Add remoteStorage data module
     *
     * @param module - A data module object
     *
     * @example
     *
     * Usually, you will import your data module from either a package or a local path.
     * Let's say you want to use the
     * [bookmarks module](https://github.com/raucao/remotestorage-module-bookmarks)
     * in order to load data stored from [Webmarks](https://webmarks.5apps.com) for
     * example:
     *
     * ```js
     * import Bookmarks from 'remotestorage-module-bookmarks';
     *
     * remoteStorage.addModule(Bookmarks);
     * ```
     *
     * You can also forgo this function entirely and add modules when creating your
     * remoteStorage instance:
     *
     * ```js
     * const remoteStorage = new RemoteStorage({ modules: [ Bookmarks ] });
     * ```
     *
     * After the module has been added, it can be used like so:
     *
     * ```js
     * remoteStorage.bookmarks.archive.getAll(false)
     *   .then(bookmarks => console.log(bookmarks));
     * ```
     */
    addModule(module) {
        const moduleName = module.name;
        const moduleBuilder = module.builder;
        Object.defineProperty(this, moduleName, {
            configurable: true,
            get: function () {
                const instance = this._loadModule(moduleName, moduleBuilder);
                Object.defineProperty(this, moduleName, {
                    value: instance
                });
                return instance;
            }
        });
        if (moduleName.indexOf('-') !== -1) {
            const camelizedName = moduleName.replace(/\-[a-z]/g, function (s) {
                return s[1].toUpperCase();
            });
            Object.defineProperty(this, camelizedName, {
                get: function () {
                    return this[moduleName];
                }
            });
        }
    }
    /**
     * Load module
     *
     * @private
     */
    _loadModule(moduleName, moduleBuilder) {
        if (moduleBuilder) {
            const module = moduleBuilder(new baseclient_1.default(this, '/' + moduleName + '/'), new baseclient_1.default(this, '/public/' + moduleName + '/'));
            return module.exports;
        }
        else {
            throw "Unknown module: " + moduleName;
        }
    }
}
exports.RemoteStorage = RemoteStorage;
RemoteStorage.SyncError = sync_error_1.default;
RemoteStorage.Unauthorized = unauthorized_error_1.default;
RemoteStorage.Discover = discover_1.default;
RemoteStorage.DiscoveryError = discover_1.default.DiscoveryError;
RemoteStorage.util = util;
// At this point the remoteStorage object has not been created yet. Only
// its prototype exists so far, so we define self-constructing properties on
// it, in order for devs not having to wait for feature loading before managing
// access and caching settings
Object.defineProperty(RemoteStorage.prototype, 'access', {
    configurable: true,
    get: function () {
        const access = new access_1.default(this);
        Object.defineProperty(this, 'access', {
            // Keep this overrideable so tests and custom integrations can swap in fakes.
            value: access,
            writable: true,
            configurable: true
        });
        return access;
    },
});
Object.defineProperty(RemoteStorage.prototype, 'caching', {
    configurable: true,
    get: function () {
        const caching = new caching_1.default(this);
        Object.defineProperty(this, 'caching', {
            value: caching,
            writable: true,
            configurable: true
        });
        return caching;
    }
});
(0, util_1.applyMixins)(RemoteStorage, [eventhandling_1.EventHandling]);
exports["default"] = RemoteStorage;


/***/ }),

/***/ "./src/requests.ts":
/*!*************************!*\
  !*** ./src/requests.ts ***!
  \*************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/**
 * This file implements an HTTP request with timeout, on top of fetch or XHR.
 * The returned value always looks like an XHR.
 * It is used by authorize.ts, wireclient.ts, googledrive.ts and dropbox.ts.
 * The timeout is set by RemoteStorage#setRequestTimeout(timeout)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.isArrayBufferView = void 0;
exports.retryAfterMs = retryAfterMs;
exports.requestWithTimeout = requestWithTimeout;
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
/**
 * Extracts a retry interval from header,
 * defaulting to three tries and a pause, within sync interval
 * */
function retryAfterMs(xhr) {
    const serverMs = parseInt(xhr.getResponseHeader('Retry-After')) * 1000;
    if (serverMs >= 1000) { // sanity check
        return serverMs;
    }
    else { // value is NaN if no such header, or malformed
        // three tries and a pause, within sync interval,
        // with lower & upper bounds
        return Math.max(1500, Math.min(60000, Math.round(config_1.default.syncInterval / (2.9 + Math.random() * 0.2))));
    }
}
if (typeof ((__webpack_require__.g || window).ArrayBufferView) === 'function') {
    exports.isArrayBufferView = function (object) {
        return object && (object instanceof (__webpack_require__.g || window).ArrayBufferView);
    };
}
else {
    const arrayBufferViews = [
        Int8Array, Uint8Array, Int16Array, Uint16Array,
        Int32Array, Uint32Array, Float32Array, Float64Array
    ];
    exports.isArrayBufferView = function (object) {
        for (let i = 0; i < 8; i++) {
            if (object instanceof arrayBufferViews[i]) {
                return true;
            }
        }
        return false;
    };
}
function requestWithTimeout(method, url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof fetch === 'function') {
            return _fetchRequestWithTimeout(method, url, options);
        }
        else if (typeof XMLHttpRequest === 'function') {
            return _xhrRequestWithTimeout(method, url, options);
        }
        else {
            return Promise.reject('[Requests] You need to add a polyfill for fetch or XMLHttpRequest');
        }
    });
}
function _fetchRequestWithTimeout(method, url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const abortController = typeof AbortController === 'function' ?
            new AbortController() :
            null;
        let timeoutId;
        const timeoutPromise = new Promise((_resolve, reject) => {
            timeoutId = setTimeout(() => {
                if (abortController) {
                    abortController.abort();
                }
                reject('timeout');
            }, config_1.default.requestTimeout);
        });
        let syntheticXhr;
        const responseHeaders = {};
        const networkPromise = fetch(url, {
            method: method,
            headers: options.headers,
            body: options.body,
            signal: abortController ? abortController.signal : undefined
        }).then((response) => {
            (0, log_1.default)('[requests fetch]', response);
            response.headers.forEach((value, headerName) => {
                responseHeaders[headerName.toUpperCase()] = value;
            });
            syntheticXhr = {
                readyState: 4,
                status: response.status,
                statusText: response.statusText,
                response: undefined,
                getResponseHeader: (headerName) => {
                    return responseHeaders[headerName.toUpperCase()] || null;
                },
                // responseText: 'foo',
                responseType: options.responseType,
                responseURL: url,
            };
            switch (options.responseType) {
                case 'arraybuffer':
                    return response.arrayBuffer();
                case 'blob':
                    return response.blob();
                case 'json':
                    return response.json();
                case undefined:
                case '':
                case 'text':
                    return response.text();
                default: // document
                    throw new Error("responseType 'document' is not currently supported using fetch");
            }
        }).then((processedBody) => {
            syntheticXhr.response = processedBody;
            if (!options.responseType || options.responseType === 'text') {
                syntheticXhr.responseText = processedBody;
            }
            return syntheticXhr;
        }).finally(() => {
            clearTimeout(timeoutId);
        });
        return Promise.race([networkPromise, timeoutPromise]);
    });
}
function _xhrRequestWithTimeout(method, url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            (0, log_1.default)('[requests XHR]', method, url);
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                reject('timeout');
            }, config_1.default.requestTimeout);
            const xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
            if (options.responseType) {
                xhr.responseType = options.responseType;
            }
            if (options.headers) {
                for (const key in options.headers) {
                    xhr.setRequestHeader(key, options.headers[key]);
                }
            }
            xhr.onload = () => {
                if (timedOut) {
                    return;
                }
                clearTimeout(timer);
                resolve(xhr);
            };
            xhr.onerror = (error) => {
                if (timedOut) {
                    return;
                }
                clearTimeout(timer);
                reject(error);
            };
            let body = options.body;
            if (typeof (body) === 'object' && !(0, exports.isArrayBufferView)(body) && body instanceof ArrayBuffer) {
                body = new Uint8Array(body);
            }
            xhr.send(body);
        });
    });
}


/***/ }),

/***/ "./src/revisioncache.ts":
/*!******************************!*\
  !*** ./src/revisioncache.ts ***!
  \******************************/
/***/ (function(module) {

"use strict";

/**
 * A cache which can propagate changes up to parent folders and generate new
 * revision ids for them. The generated revision id is consistent across
 * different sessions.  The keys for the cache are case-insensitive.
 *
 * @param defaultValue {string} the value that is returned for all keys that
 *                              don't exist in the cache
 * @class
 */
class RevisionCache {
    constructor(defaultValue) {
        this._itemsRev = {};
        this._storage = {};
        this._canPropagate = false;
        this.defaultValue = defaultValue;
        this.activatePropagation();
    }
    /**
     * Get a value from the cache or defaultValue, if the key is not in the
     * cache
     */
    get(key) {
        key = key.toLowerCase();
        let stored = this._storage[key];
        if (typeof stored === 'undefined') {
            stored = this.defaultValue;
            this._storage[key] = stored;
        }
        return stored;
    }
    /**
     * Set a value
     */
    set(key, value) {
        key = key.toLowerCase();
        if (this._storage[key] === value) {
            return value;
        }
        this._storage[key] = value;
        if (!value) {
            delete this._itemsRev[key];
        }
        this._updateParentFolderItemRev(key, value);
        if (this._canPropagate) {
            this._propagate(key);
        }
        return value;
    }
    /**
     * Delete a value
     */
    delete(key) {
        return this.set(key, null);
    }
    /**
     * Disables automatic update of folder revisions when a key value is updated
     */
    deactivatePropagation() {
        this._canPropagate = false;
        return true;
    }
    /**
     * Enables automatic update of folder revisions when a key value is updated
     * and refreshes the folder revision ids for entire tree.
     */
    activatePropagation() {
        if (this._canPropagate) {
            return true;
        }
        this._generateFolderRev("/");
        this._canPropagate = true;
        return true;
    }
    /**
     * Returns a hash code for a string.
     */
    _hashCode(str) {
        let hash = 0;
        if (str.length === 0) {
            return hash;
        }
        for (let i = 0; i < str.length; i++) {
            const chr = str.charCodeAt(i);
            // eslint-disable-next-line no-bitwise
            hash = ((hash << 5) - hash) + chr;
            // eslint-disable-next-line no-bitwise
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
    /**
     * Takes an array of strings and returns a hash of the items
     */
    _generateHash(items) {
        // We sort the items before joining them to ensure correct hash generation
        // every time
        const files = items.sort().join('|');
        const hash = "" + this._hashCode(files);
        return hash;
    }
    /**
     * Update the revision of a key in it's parent folder data
     */
    _updateParentFolderItemRev(key, rev) {
        if (key !== '/') {
            const parentFolder = this._getParentFolder(key);
            if (!this._itemsRev[parentFolder]) {
                this._itemsRev[parentFolder] = {};
            }
            const parentFolderItemsRev = this._itemsRev[parentFolder];
            if (!rev) {
                delete parentFolderItemsRev[key];
            }
            else {
                parentFolderItemsRev[key] = rev;
            }
            //reset revision until root
            this._updateParentFolderItemRev(parentFolder, this.defaultValue);
        }
    }
    _getParentFolder(key) {
        return key.substr(0, key.lastIndexOf('/', key.length - 2) + 1);
    }
    /**
     * Propagate the changes to the parent folders and generate new revision ids
     * for them
     */
    _propagate(key) {
        if (key !== '/') {
            const parentFolder = this._getParentFolder(key);
            const parentFolderItemsRev = this._itemsRev[parentFolder];
            const hashItems = [];
            for (const path in parentFolderItemsRev) {
                hashItems.push(parentFolderItemsRev[path]);
            }
            const newRev = this._generateHash(hashItems);
            this.set(parentFolder, newRev);
        }
    }
    /**
     * Generate revision id for a folder and it's subfolders, by hashing it's
     * listing
     */
    _generateFolderRev(folder) {
        const itemsRev = this._itemsRev[folder];
        let hash = this.defaultValue;
        if (itemsRev) {
            const hashItems = [];
            for (const path in itemsRev) {
                const isDir = (path.substr(-1) === '/');
                let hashItem;
                if (isDir) {
                    hashItem = this._generateFolderRev(path);
                }
                else {
                    hashItem = itemsRev[path];
                }
                hashItems.push(hashItem);
            }
            if (hashItems.length > 0) {
                hash = this._generateHash(hashItems);
            }
        }
        this.set(folder, hash);
        return hash;
    }
}
module.exports = RevisionCache;


/***/ }),

/***/ "./src/schema-not-found-error.ts":
/*!***************************************!*\
  !*** ./src/schema-not-found-error.ts ***!
  \***************************************/
/***/ (function(module) {

"use strict";

class SchemaNotFound extends Error {
    constructor(uri) {
        super();
        const error = new Error("Schema not found: " + uri);
        error.name = "SchemaNotFound";
        return error;
    }
}
module.exports = SchemaNotFound;


/***/ }),

/***/ "./src/sync-error.ts":
/*!***************************!*\
  !*** ./src/sync-error.ts ***!
  \***************************/
/***/ (function(module) {

"use strict";

class SyncError extends Error {
    constructor(originalError) {
        super();
        this.name = 'SyncError';
        this.message = 'Sync failed: ';
        if (typeof originalError === 'string') {
            this.message += originalError;
        }
        else {
            this.message += originalError.message;
            this.stack = originalError.stack;
            this.originalError = originalError;
        }
    }
}
module.exports = SyncError;


/***/ }),

/***/ "./src/sync.ts":
/*!*********************!*\
  !*** ./src/sync.ts ***!
  \*********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Sync = void 0;
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const env_1 = __importDefault(__webpack_require__(/*! ./env */ "./src/env.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
const sync_error_1 = __importDefault(__webpack_require__(/*! ./sync-error */ "./src/sync-error.ts"));
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
let setupSync, syncOnConnect;
function taskFor(action, path, promise) {
    return { action, path, promise };
}
function nodeChanged(node, etag) {
    return node.common.revision !== etag &&
        (!node.remote || node.remote.revision !== etag);
}
function isStaleChild(node) {
    return !!node.remote && !!node.remote.revision &&
        !node.remote.itemsMap && !node.remote.body;
}
function hasCommonRevision(node) {
    return !!node.common && !!node.common.revision;
}
function hasNoRemoteChanges(node) {
    if (node.remote && node.remote.revision &&
        node.remote.revision !== node.common.revision) {
        return false;
    }
    return (node.common.body === undefined && node.remote.body === false) ||
        (node.remote.body === node.common.body &&
            node.remote.contentType === node.common.contentType);
}
function mergeMutualDeletion(node) {
    if (node.remote && node.remote.body === false &&
        node.local && node.local.body === false) {
        delete node.local;
    }
    return node;
}
function handleVisibility(env, rs) {
    function handleChange(isForeground) {
        const oldValue = rs.getCurrentSyncInterval();
        config_1.default.isBackground = !isForeground;
        const newValue = rs.getCurrentSyncInterval();
        rs._emit('sync-interval-change', { oldValue: oldValue, newValue: newValue });
    }
    env.on('background', () => handleChange(false));
    env.on('foreground', () => handleChange(true));
}
/**
 * This class basically does six things:
 *
 * - retrieve the remote version of relevant documents and folders
 * - add all local and remote documents together into one tree
 * - push local documents out if they don't exist remotely
 * - push local changes out to remote documents (conditionally, to avoid race
 *   conditions where both have changed)
 * - adopt the local version of a document to its remote version if both exist
 *   and they differ
 * - delete the local version of a document if it was deleted remotely
 * - if any GET requests were waiting for remote data, resolve them once this
 *   data comes in.
 *
 * It does this using requests to documents and folders. Whenever a folder GET
 * comes in, it gives information about all the documents it contains (this is
 * the `markChildren` function).
 */
class Sync {
    constructor(remoteStorage) {
        /**
         * Maximum number of parallel requests to execute
         */
        this.numThreads = 10;
        /**
         * Paths queued for sync, sometimes with callbacks
         */
        this._tasks = {};
        /**
         * Promises of currently running sync tasks per path
         */
        this._running = {};
        /**
         * Start times of current sync per path
         */
        this._timeStarted = {};
        /**
         * Holds finished tasks for orderly processing
         */
        this._finishedTasks = [];
        this.rs = remoteStorage;
        this.rs.local.onDiff(path => {
            this.addTask(path);
            this.doTasks();
        });
        this.rs.caching.onActivate((path) => {
            this.addTask(path);
            this.doTasks();
        });
        this.addEvents(['done', 'req-done']);
    }
    /**
     * Return current time
     */
    now() {
        return new Date().getTime();
    }
    /**
     * When getting a path from the caching layer, this function might be handed
     * in to first check if it was updated on the remote, in order to fulfill a
     * maxAge requirement
     */
    queueGetRequest(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (!this.rs.remote.connected) {
                    reject('cannot fulfill maxAge requirement - remote is not connected');
                }
                else if (!this.rs.remote.online) {
                    reject('cannot fulfill maxAge requirement - remote is not online');
                }
                else {
                    this.addTask(path, function () {
                        this.rs.local.get(path).then(r => resolve(r));
                    }.bind(this));
                    this.doTasks();
                }
            });
        });
    }
    corruptServerItemsMap(itemsMap) {
        if ((typeof (itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
            return true;
        }
        for (const itemName in itemsMap) {
            const item = itemsMap[itemName];
            if (typeof (item) !== 'object') {
                return true;
            }
            if (typeof (item.ETag) !== 'string') {
                return true;
            }
            if ((0, util_1.isFolder)(itemName)) {
                if (itemName.substring(0, itemName.length - 1).indexOf('/') !== -1) {
                    return true;
                }
            }
            else {
                if (itemName.indexOf('/') !== -1) {
                    return true;
                }
            }
        }
        return false;
    }
    corruptItemsMap(itemsMap) {
        if ((typeof (itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
            return true;
        }
        for (const path in itemsMap) {
            if (typeof itemsMap[path] !== 'boolean') {
                return true;
            }
        }
        return false;
    }
    corruptRevision(rev) {
        return ((typeof (rev) !== 'object') ||
            (Array.isArray(rev)) ||
            (rev.revision && typeof (rev.revision) !== 'string') ||
            (rev.body && typeof (rev.body) !== 'string' && typeof (rev.body) !== 'object') ||
            (rev.contentType && typeof (rev.contentType) !== 'string') ||
            (rev.contentLength && typeof (rev.contentLength) !== 'number') ||
            (rev.timestamp && typeof (rev.timestamp) !== 'number') ||
            (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
    }
    isCorrupt(node) {
        return ((typeof (node) !== 'object') ||
            (Array.isArray(node)) ||
            (typeof (node.path) !== 'string') ||
            (this.corruptRevision(node.common)) ||
            (node.local && this.corruptRevision(node.local)) ||
            (node.remote && this.corruptRevision(node.remote)) ||
            (node.push && this.corruptRevision(node.push)));
    }
    hasTasks() {
        return Object.keys(this._tasks).length > 0;
    }
    /**
     * Collect sync tasks for changed nodes
     */
    collectDiffTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            let num = 0;
            return this.rs.local.forAllNodes((node) => {
                if (num > 100) {
                    return;
                }
                if (this.isCorrupt(node)) {
                    (0, log_1.default)('[Sync] WARNING: corrupt node in local cache', node);
                    if (typeof (node) === 'object' && node.path) {
                        this.addTask(node.path);
                        num++;
                    }
                }
                else if (this.needsFetch(node) &&
                    this.rs.access.checkPathPermission(node.path, 'r')) {
                    this.addTask(node.path);
                    num++;
                }
                else if ((0, util_1.isDocument)(node.path) && this.needsPush(node) &&
                    this.rs.access.checkPathPermission(node.path, 'rw')) {
                    this.addTask(node.path);
                    num++;
                }
            })
                .then(() => num);
        });
    }
    inConflict(node) {
        return (!!node.local && !!node.remote &&
            (node.remote.body !== undefined || !!node.remote.itemsMap));
    }
    needsRefresh(node) {
        if (node.common) {
            if (!node.common.timestamp) {
                return true;
            }
            return (this.now() - node.common.timestamp > config_1.default.syncInterval);
        }
        return false;
    }
    needsFetch(node) {
        if (this.inConflict(node)) {
            return true;
        }
        if (node.common &&
            node.common.itemsMap === undefined &&
            node.common.body === undefined) {
            return true;
        }
        if (node.remote &&
            node.remote.itemsMap === undefined &&
            node.remote.body === undefined) {
            return true;
        }
        return false;
    }
    needsPush(node) {
        if (this.inConflict(node)) {
            return false;
        }
        if (node.local && !node.push) {
            return true;
        }
    }
    needsRemotePut(node) {
        return !!(node.local && node.local.body !== undefined && node.local.body !== false);
    }
    needsRemoteDelete(node) {
        return node.local && node.local.body === false;
    }
    getParentPath(path) {
        const parts = path.match(/^(.*\/)([^\/]+\/?)$/);
        if (parts) {
            return parts[1];
        }
        else {
            throw new Error('Not a valid path: "' + path + '"');
        }
    }
    deleteChildPathsFromTasks() {
        for (const path in this._tasks) {
            const paths = (0, util_1.pathsFromRoot)(path);
            for (let i = 1; i < paths.length; i++) {
                if (this._tasks[paths[i]]) {
                    // move pending promises to parent task
                    if (Array.isArray(this._tasks[path]) && this._tasks[path].length) {
                        Array.prototype.push.apply(this._tasks[paths[i]], this._tasks[path]);
                    }
                    delete this._tasks[path];
                }
            }
        }
    }
    /**
     * Collect tasks to refresh highest outdated folder in tree
     */
    collectRefreshTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.rs.local.forAllNodes((node) => {
                let parentPath;
                if (this.needsRefresh(node)) {
                    try {
                        parentPath = this.getParentPath(node.path);
                    }
                    catch (e) {
                        // node.path is already '/', can't take parentPath
                    }
                    if (parentPath && this.rs.access.checkPathPermission(parentPath, 'r')) {
                        this.addTask(parentPath);
                    }
                    else if (this.rs.access.checkPathPermission(node.path, 'r')) {
                        this.addTask(node.path);
                    }
                }
            });
            this.deleteChildPathsFromTasks();
        });
    }
    /**
     * Flush nodes from cache after sync to remote
     */
    flush(nodes) {
        for (const path in nodes) {
            // Strategy is 'FLUSH' and no local changes exist
            if (this.rs.caching.checkPath(path) === 'FLUSH' &&
                nodes[path] && !nodes[path].local) {
                (0, log_1.default)('[Sync] Flushing', path);
                nodes[path] = undefined; // Cause node to be flushed from cache
            }
        }
        return nodes;
    }
    /**
     * Sync one path
     */
    doTask(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rs.local.getNodes([path]).then((nodes) => {
                const node = nodes[path];
                // First fetch:
                if (typeof (node) === 'undefined') {
                    return taskFor('get', path, this.rs.remote.get(path));
                }
                // Fetch known-stale child:
                else if (isStaleChild(node)) {
                    return taskFor('get', path, this.rs.remote.get(path));
                }
                // Push PUT:
                else if (this.needsRemotePut(node)) {
                    node.push = (0, util_1.deepClone)(node.local);
                    node.push.timestamp = this.now();
                    return this.rs.local.setNodes(this.flush(nodes)).then(() => {
                        let options;
                        if (hasCommonRevision(node)) {
                            options = { ifMatch: node.common.revision };
                        }
                        else {
                            // Initial PUT (fail if something is already there)
                            options = { ifNoneMatch: '*' };
                        }
                        return taskFor('put', path, this.rs.remote.put(path, node.push.body, node.push.contentType, options));
                    });
                }
                // Push DELETE:
                else if (this.needsRemoteDelete(node)) {
                    node.push = { body: false, timestamp: this.now() };
                    return this.rs.local.setNodes(this.flush(nodes)).then(() => {
                        if (hasCommonRevision(node)) {
                            return taskFor('delete', path, this.rs.remote.delete(path, { ifMatch: node.common.revision }));
                        }
                        else { // Ascertain current common or remote revision first
                            return taskFor('get', path, this.rs.remote.get(path));
                        }
                    });
                }
                // Conditional refresh:
                else if (hasCommonRevision(node)) {
                    return taskFor('get', path, this.rs.remote.get(path, { ifNoneMatch: node.common.revision }));
                }
                else {
                    return taskFor('get', path, this.rs.remote.get(path));
                }
            });
        });
    }
    /**
     * Merge/process folder node items after updates from remote
     */
    autoMergeFolder(node) {
        if (node.remote.itemsMap) {
            node.common = node.remote;
            delete node.remote;
            if (node.common.itemsMap) {
                for (const itemName in node.common.itemsMap) {
                    if (!node.local.itemsMap[itemName]) {
                        // Indicates the node is either newly being fetched, or
                        // has been deleted locally (whether or not leading to
                        // conflict); before listing it in local listings, check
                        // if a local deletion exists.
                        node.local.itemsMap[itemName] = false;
                    }
                }
                for (const itemName in node.local.itemsMap) {
                    if (!node.common.itemsMap[itemName]) {
                        // When an item appears in a folder's local itemsMap, but
                        // not in remote/common, it may or may not have been
                        // changed or deleted locally. The local itemsMap may
                        // only contain it, beause the item existed when
                        // *another* local item was changed, so we need to make
                        // sure that it's checked/processed again, so it will be
                        // deleted if there's no local change waiting to be
                        // pushed out.
                        this.addTask(node.path + itemName);
                    }
                }
                if ((0, util_1.equal)(node.local.itemsMap, node.common.itemsMap)) {
                    delete node.local;
                }
            }
        }
        return node;
    }
    /**
     * Merge/process document node items after updates from remote
     */
    autoMergeDocument(node) {
        var _a;
        if (hasNoRemoteChanges(node)) {
            node = mergeMutualDeletion(node);
            delete node.remote;
        }
        else if (node.remote.body !== undefined) {
            if (node.remote.body === false && ((_a = node.local) === null || _a === void 0 ? void 0 : _a.body) === false) {
                // Deleted on both sides, nothing to do
            }
            else {
                (0, log_1.default)('[Sync] Emitting conflict event');
                setTimeout(this.rs.local.emitChange.bind(this.rs.local), 10, {
                    origin: 'conflict',
                    path: node.path,
                    oldValue: node.local.body,
                    newValue: node.remote.body,
                    lastCommonValue: node.common.body,
                    oldContentType: node.local.contentType,
                    newContentType: node.remote.contentType,
                    lastCommonContentType: node.common.contentType
                });
            }
            if (node.remote.body === false) {
                node.common = {};
            }
            else {
                node.common = node.remote;
            }
            delete node.remote;
            delete node.local;
        }
        return node;
    }
    /**
     * Merge/process node items after various updates from remote
     */
    autoMerge(node) {
        if (!node.remote) {
            if (node.common.body) {
                this.rs.local.emitChange({
                    origin: 'remote',
                    path: node.path,
                    oldValue: node.common.body,
                    newValue: undefined,
                    oldContentType: node.common.contentType,
                    newContentType: undefined
                });
            }
            return;
        }
        // Local changes
        if (node.local) {
            if ((0, util_1.isFolder)(node.path)) {
                return this.autoMergeFolder(node);
            }
            else {
                return this.autoMergeDocument(node);
            }
        }
        if ((0, util_1.isFolder)(node.path)) {
            if (node.remote.itemsMap !== undefined) {
                node.common = node.remote;
                delete node.remote;
            }
        }
        else {
            if (node.remote.body !== undefined) {
                const change = {
                    origin: 'remote',
                    path: node.path,
                    oldValue: (node.common.body === false ? undefined : node.common.body),
                    newValue: (node.remote.body === false ? undefined : node.remote.body),
                    oldContentType: node.common.contentType,
                    newContentType: node.remote.contentType
                };
                if (change.oldValue !== undefined || change.newValue !== undefined) {
                    this.rs.local.emitChange(change);
                }
                if (node.remote.body === false) {
                    return; // no remote, so delete
                }
                node.common = node.remote;
                delete node.remote;
            }
        }
        return node;
    }
    updateCommonTimestamp(path, revision) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rs.local.getNodes([path]).then((nodes) => {
                if (nodes[path] &&
                    nodes[path].common &&
                    nodes[path].common.revision === revision) {
                    nodes[path].common.timestamp = this.now();
                }
                return this.rs.local.setNodes(this.flush(nodes));
            });
        });
    }
    /**
     * After successful GET of a folder, mark its children/items for
     * changes and further processing
     */
    markChildren(path, itemsMap, changedNodes, missingChildren) {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = [];
            const meta = {};
            const recurse = {};
            for (const item in itemsMap) {
                paths.push(path + item);
                meta[path + item] = itemsMap[item];
            }
            for (const childName in missingChildren) {
                paths.push(path + childName);
            }
            const nodes = yield this.rs.local.getNodes(paths);
            let cachingStrategy;
            let node;
            for (const nodePath in nodes) {
                node = nodes[nodePath];
                if (meta[nodePath]) {
                    if (node && node.common) {
                        if (nodeChanged(node, meta[nodePath].ETag)) {
                            changedNodes[nodePath] = (0, util_1.deepClone)(node);
                            changedNodes[nodePath].remote = {
                                revision: meta[nodePath].ETag,
                                timestamp: this.now()
                            };
                            changedNodes[nodePath] = this.autoMerge(changedNodes[nodePath]);
                        }
                    }
                    else {
                        cachingStrategy = this.rs.caching.checkPath(nodePath);
                        if (cachingStrategy === 'ALL') {
                            changedNodes[nodePath] = {
                                path: nodePath,
                                common: {
                                    timestamp: this.now()
                                },
                                remote: {
                                    revision: meta[nodePath].ETag,
                                    timestamp: this.now()
                                }
                            };
                        }
                    }
                    if (changedNodes[nodePath] && meta[nodePath]['Content-Type']) {
                        changedNodes[nodePath].remote.contentType = meta[nodePath]['Content-Type'];
                    }
                    if (changedNodes[nodePath] && meta[nodePath]['Content-Length']) {
                        changedNodes[nodePath].remote.contentLength = meta[nodePath]['Content-Length'];
                    }
                }
                else if (missingChildren[nodePath.substring(path.length)] && node && node.common) {
                    if (node.common.itemsMap) {
                        for (const commonItem in node.common.itemsMap) {
                            recurse[nodePath + commonItem] = true;
                        }
                    }
                    if (node.local && node.local.itemsMap) {
                        for (const localItem in node.local.itemsMap) {
                            recurse[nodePath + localItem] = true;
                        }
                    }
                    if (node.remote || (0, util_1.isFolder)(nodePath)) {
                        changedNodes[nodePath] = undefined;
                    }
                    else {
                        changedNodes[nodePath] = this.autoMerge(node);
                        if (typeof changedNodes[nodePath] === 'undefined') {
                            const parentPath = this.getParentPath(nodePath);
                            const parentNode = changedNodes[parentPath];
                            const itemName = nodePath.substring(path.length);
                            if (parentNode && parentNode.local) {
                                delete parentNode.local.itemsMap[itemName];
                                if ((0, util_1.equal)(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
                                    delete parentNode.local;
                                }
                            }
                        }
                    }
                }
            }
            const changedNodes2 = yield this.markRemoteDeletions(Object.keys(recurse), changedNodes);
            if (changedNodes2) {
                yield this.rs.local.setNodes(this.flush(changedNodes2));
            }
        });
    }
    /**
     * Recursively process paths to mark documents as remotely deleted
     * where applicable
     */
    markRemoteDeletions(paths, changedNodes) {
        return __awaiter(this, void 0, void 0, function* () {
            if (paths.length === 0) {
                return changedNodes;
            }
            const nodes = yield this.rs.local.getNodes(paths);
            const subPaths = {};
            function collectSubPaths(folder, path) {
                if (folder && folder.itemsMap) {
                    for (const itemName in folder.itemsMap) {
                        subPaths[path + itemName] = true;
                    }
                }
            }
            for (const path in nodes) {
                const node = nodes[path];
                if (!node) {
                    continue;
                }
                if ((0, util_1.isFolder)(path)) {
                    collectSubPaths(node.common, path);
                    collectSubPaths(node.local, path);
                }
                else {
                    if (node.common && typeof (node.common.body) !== 'undefined') {
                        changedNodes[path] = (0, util_1.deepClone)(node);
                        changedNodes[path].remote = {
                            body: false,
                            timestamp: this.now()
                        };
                        changedNodes[path] = this.autoMerge(changedNodes[path]);
                    }
                }
            }
            // Recurse whole tree depth levels at once:
            const changedNodes2 = yield this.markRemoteDeletions(Object.keys(subPaths), changedNodes);
            if (changedNodes2) {
                yield this.rs.local.setNodes(this.flush(changedNodes2));
            }
        });
    }
    /**
     * Complete a successful GET request
     */
    completeFetch(path, bodyOrItemsMap, contentType, revision) {
        return __awaiter(this, void 0, void 0, function* () {
            let paths;
            let parentPath;
            const pathsFromRootArr = (0, util_1.pathsFromRoot)(path);
            if ((0, util_1.isFolder)(path)) {
                paths = [path];
            }
            else {
                parentPath = pathsFromRootArr[1];
                paths = [path, parentPath];
            }
            const nodes = yield this.rs.local.getNodes(paths);
            const parentNode = nodes[parentPath];
            const missingChildren = {};
            let node = nodes[path];
            let itemName;
            function collectMissingChildren(folder) {
                if (folder && folder.itemsMap) {
                    for (itemName in folder.itemsMap) {
                        if (!bodyOrItemsMap[itemName]) {
                            missingChildren[itemName] = true;
                        }
                    }
                }
            }
            if (typeof (node) !== 'object' ||
                node.path !== path ||
                typeof (node.common) !== 'object') {
                node = { path: path, common: {} };
                nodes[path] = node;
            }
            node.remote = {
                revision: revision,
                timestamp: this.now()
            };
            if ((0, util_1.isFolder)(path)) {
                collectMissingChildren(node.common);
                collectMissingChildren(node.remote);
                node.remote.itemsMap = {};
                for (itemName in bodyOrItemsMap) {
                    node.remote.itemsMap[itemName] = true;
                }
            }
            else {
                node.remote.body = bodyOrItemsMap;
                node.remote.contentType = contentType;
                if (parentNode && parentNode.local && parentNode.local.itemsMap) {
                    itemName = path.substring(parentPath.length);
                    if (bodyOrItemsMap !== false) {
                        parentNode.local.itemsMap[itemName] = true;
                    }
                    else {
                        if (parentNode.local.itemsMap[itemName]) {
                            // node is 404 on remote, can safely be removed from
                            // parent's local itemsMap now
                            delete parentNode.local.itemsMap[itemName];
                        }
                    }
                    if ((0, util_1.equal)(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
                        delete parentNode.local;
                    }
                }
            }
            nodes[path] = this.autoMerge(node);
            return { toBeSaved: nodes, missingChildren };
        });
    }
    /**
     * Handle successful PUT or DELETE request
     */
    completePush(path, action, conflict, revision) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodes = yield this.rs.local.getNodes([path]);
            const node = nodes[path];
            if (!node.push) {
                this.stopped = true;
                throw new Error('completePush called but no push version!');
            }
            if (conflict) {
                (0, log_1.default)('[Sync] We have a conflict');
                if (!node.remote || node.remote.revision !== revision) {
                    node.remote = {
                        revision: revision || 'conflict',
                        timestamp: this.now()
                    };
                    delete node.push;
                }
                nodes[path] = this.autoMerge(node);
            }
            else {
                node.common = {
                    revision: revision,
                    timestamp: this.now()
                };
                if (action === 'put') {
                    node.common.body = node.push.body;
                    node.common.contentType = node.push.contentType;
                    if ((0, util_1.equal)(node.local.body, node.push.body) &&
                        node.local.contentType === node.push.contentType) {
                        delete node.local;
                    }
                    delete node.push;
                }
                else if (action === 'delete') {
                    if (node.local.body === false) { // No new local changes since push; flush it.
                        nodes[path] = undefined;
                    }
                    else {
                        delete node.push;
                    }
                }
            }
            yield this.rs.local.setNodes(this.flush(nodes));
        });
    }
    /**
     * Remove push item from cached nodes that failed to sync
     */
    dealWithFailure(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodes = yield this.rs.local.getNodes([path]);
            if (nodes[path]) {
                delete nodes[path].push;
                return this.rs.local.setNodes(this.flush(nodes));
            }
        });
    }
    interpretStatus(statusCode) {
        const status = {
            statusCode: statusCode,
            successful: undefined,
            conflict: undefined,
            unAuth: undefined,
            notFound: undefined,
            changed: undefined,
            networkProblems: undefined
        };
        if (typeof statusCode === 'string' &&
            (statusCode === 'offline' || statusCode === 'timeout')) {
            status.successful = false;
            status.networkProblems = true;
            return status;
        }
        else if (typeof statusCode === 'number') {
            const series = Math.floor(statusCode / 100);
            status.successful = (series === 2 ||
                statusCode === 304 ||
                statusCode === 412 ||
                statusCode === 404);
            status.conflict = (statusCode === 412);
            status.unAuth = ((statusCode === 401 && this.rs.remote.token !== authorize_1.default.IMPLIED_FAKE_TOKEN) ||
                statusCode === 402 ||
                statusCode === 403);
            status.notFound = (statusCode === 404);
            status.changed = (statusCode !== 304);
            return status;
        }
    }
    /**
     * Handle successful GET request
     */
    handleGetResponse(path, status, bodyOrItemsMap, contentType, revision) {
        return __awaiter(this, void 0, void 0, function* () {
            if (status.notFound) {
                bodyOrItemsMap = (0, util_1.isFolder)(path) ? {} : false;
            }
            if (status.changed) {
                const data = yield this.completeFetch(path, bodyOrItemsMap, contentType, revision);
                if ((0, util_1.isFolder)(path)) {
                    if (this.corruptServerItemsMap(bodyOrItemsMap)) {
                        (0, log_1.default)('[Sync] WARNING: Discarding corrupt folder description from server for ' + path);
                        return false;
                    }
                    yield this.markChildren(path, bodyOrItemsMap, data.toBeSaved, data.missingChildren);
                }
                else {
                    yield this.rs.local.setNodes(this.flush(data.toBeSaved));
                }
            }
            else {
                yield this.updateCommonTimestamp(path, revision);
            }
            return true;
        });
    }
    /**
     * Handle response of executed request
     */
    handleResponse(path, action, r) {
        return __awaiter(this, void 0, void 0, function* () {
            const status = this.interpretStatus(r.statusCode);
            if (status.successful) {
                if (action === 'get') {
                    return this.handleGetResponse(path, status, r.body, r.contentType, r.revision);
                }
                else if (action === 'put' || action === 'delete') {
                    return this.completePush(path, action, status.conflict, r.revision).then(function () {
                        return true;
                    });
                }
                else {
                    throw new Error(`cannot handle response for unknown action ${action}`);
                }
            }
            else {
                // Unsuccessful
                let error;
                if (status.unAuth) {
                    error = new unauthorized_error_1.default();
                }
                else if (status.networkProblems) {
                    error = new sync_error_1.default('Network request failed.');
                }
                else {
                    error = new Error('HTTP response code ' + status.statusCode + ' received.');
                }
                return this.dealWithFailure(path).then(() => {
                    this.rs._emit('error', error);
                    throw error;
                });
            }
        });
    }
    /**
     * Execute/finish running tasks, one at a time
     */
    finishTask(task_1) {
        return __awaiter(this, arguments, void 0, function* (task, queueTask = true) {
            if (task.action === undefined) {
                delete this._running[task.path];
                return;
            }
            if (queueTask) {
                (0, log_1.default)("[Sync] queue finished task:", task.path);
                this._finishedTasks.push(task);
                if (this._finishedTasks.length > 1) {
                    (0, log_1.default)("[Sync] delaying finished task:", task.path);
                    return;
                }
            }
            (0, log_1.default)("[Sync] run task:", task.path);
            let res;
            try {
                res = yield task.promise;
            }
            catch (err) {
                (0, log_1.default)('[Sync] wire client rejects its promise', task.path, task.action, err);
                res = { statusCode: 'offline' };
            }
            try {
                const completed = yield this.handleResponse(task.path, task.action, res);
                this.finishSuccessfulTask(task, completed);
            }
            catch (err) {
                this.finishUnsuccessfulTask(task, err);
            }
        });
    }
    finishSuccessfulTask(task, completed) {
        return __awaiter(this, void 0, void 0, function* () {
            this._finishedTasks.shift();
            delete this._timeStarted[task.path];
            delete this._running[task.path];
            if (completed) {
                if (this._tasks[task.path]) {
                    for (let i = 0; i < this._tasks[task.path].length; i++) {
                        this._tasks[task.path][i]();
                    }
                    delete this._tasks[task.path];
                }
            }
            this.rs._emit('sync-req-done', {
                tasksRemaining: Object.keys(this._tasks).length
            });
            if (this._finishedTasks.length > 0) {
                yield this.finishTask(this._finishedTasks[0], false);
                return;
            }
            yield this.collectTasks(false).then(() => {
                // See if there are any more tasks that are not refresh tasks
                if (!this.hasTasks() || this.stopped) {
                    if (!this.done) {
                        this.done = true;
                    }
                    this.rs._emit('sync-done', { completed: true });
                }
                else {
                    // Use a 10ms timeout to let the JavaScript runtime catch its breath
                    // (and hopefully force an IndexedDB auto-commit?), and also to cause
                    // the threads to get staggered and get a good spread over time:
                    setTimeout(() => { this.doTasks(); }, 10);
                }
            });
        });
    }
    finishUnsuccessfulTask(task, err) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, log_1.default)('[Sync]', err.message);
            this._finishedTasks.shift();
            delete this._timeStarted[task.path];
            delete this._running[task.path];
            this.rs._emit('sync-req-done', {
                tasksRemaining: Object.keys(this._tasks).length
            });
            if (this._finishedTasks.length > 0) {
                yield this.finishTask(this._finishedTasks[0], false);
                return;
            }
            if (!this.done) {
                this.done = true;
                this.rs._emit('sync-done', { completed: false });
            }
        });
    }
    /**
     * Determine how many tasks we want to have
     */
    tasksWanted() {
        if (!this.rs.remote.connected) {
            // Nothing to sync if no remote connected
            return 0;
        }
        if (this.rs.remote.online) {
            // Run as many tasks as threads are available/configured
            return this.numThreads;
        }
        else {
            // Only run 1 task when we're offline
            return 1;
        }
    }
    /**
     * Check if more tasks can be queued, and start running
     * tasks
     *
     * @returns {Boolean} `true` when all tasks have been started or
     *                    there's nothing to do, `false` if we could
     *                    or want to run more
     */
    doTasks() {
        const numToHave = this.tasksWanted();
        const numToAdd = numToHave - Object.keys(this._running).length;
        if (numToAdd <= 0) {
            return true;
        }
        // `this.done` is `true` for immediate sync and `false` for
        // periodic sync
        if (this.hasTasks() && !this.done) {
            this.rs._emit('sync-started');
        }
        let numAdded = 0, path;
        for (path in this._tasks) {
            if (!this._running[path]) {
                this._timeStarted[path] = this.now();
                this._running[path] = this.doTask(path).then(this.finishTask.bind(this));
                numAdded++;
                if (numAdded >= numToAdd) {
                    break;
                }
            }
        }
        return (numAdded >= numToAdd);
    }
    /**
     * Collect any potential sync tasks if none are queued
     */
    collectTasks() {
        return __awaiter(this, arguments, void 0, function* (alsoCheckRefresh = true) {
            if (this.hasTasks() || this.stopped) {
                return;
            }
            const numDiffs = yield this.collectDiffTasks();
            if (numDiffs > 0) {
                return;
            }
            if (alsoCheckRefresh) {
                return this.collectRefreshTasks();
            }
        });
    }
    /**
     * Add a sync task for the given path
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addTask(path, cb) {
        if (!this._tasks[path]) {
            this._tasks[path] = [];
        }
        if (typeof (cb) === 'function') {
            this._tasks[path].push(cb);
        }
    }
    /**
     * Start a sync procedure
     */
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.done = false;
            if (!this.doTasks()) {
                try {
                    yield this.collectTasks();
                }
                catch (e) {
                    (0, log_1.default)('[Sync] Sync error', e);
                    throw new Error('Local cache unavailable');
                }
                ;
                this.doTasks();
            }
        });
    }
    static _rs_init(remoteStorage) {
        setupSync = function () {
            // if (!config.cache) return false
            const env = new env_1.default();
            if (env.isBrowser()) {
                handleVisibility(env, remoteStorage);
            }
            if (!remoteStorage.sync) {
                // Call this now that all other modules are also ready:
                remoteStorage.sync = new Sync(remoteStorage);
                if (remoteStorage.syncStopped) {
                    (0, log_1.default)('[Sync] Initializing with sync stopped');
                    remoteStorage.sync.stopped = true;
                    delete remoteStorage.syncStopped;
                }
            }
            remoteStorage.setupSyncCycle();
        };
        syncOnConnect = function () {
            remoteStorage.removeEventListener('connected', syncOnConnect);
            remoteStorage.startSync();
        };
        remoteStorage.on('ready', setupSync);
        remoteStorage.on('connected', syncOnConnect);
    }
    static _rs_cleanup(remoteStorage) {
        remoteStorage.stopSync();
        remoteStorage.removeEventListener('ready', setupSync);
        remoteStorage.removeEventListener('connected', syncOnConnect);
        remoteStorage.caching.resetActivationHandler();
        remoteStorage.sync = undefined;
        delete remoteStorage.sync;
    }
}
exports.Sync = Sync;
(0, util_1.applyMixins)(Sync, [eventhandling_1.default]);
exports["default"] = Sync;


/***/ }),

/***/ "./src/syncedgetputdelete.ts":
/*!***********************************!*\
  !*** ./src/syncedgetputdelete.ts ***!
  \***********************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
function shareFirst(path) {
    return (this.backend === 'dropbox' &&
        !!path.match(/^\/public\/.*[^\/]$/));
}
function defaultMaxAge(context) {
    if ((typeof context.remote === 'object') &&
        context.remote.connected && context.remote.online) {
        return 2 * context.getSyncInterval();
    }
    else {
        (0, log_1.default)('Not setting default maxAge, because remote is offline or not connected');
        return false;
    }
}
const SyncedGetPutDelete = {
    get: function (path, maxAge) {
        if (!this.local) {
            return this.remote.get(path);
        }
        else {
            if (typeof maxAge === 'undefined') {
                maxAge = defaultMaxAge(this);
            }
            else if (typeof maxAge !== 'number' && maxAge !== false) {
                return Promise.reject(`Argument 'maxAge' must be 'false' or a number`);
            }
            return this.local.get(path, maxAge, this.sync.queueGetRequest.bind(this.sync));
        }
    },
    put: function (path, body, contentType) {
        if (shareFirst.bind(this)(path)) {
            return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
        }
        else if (this.local) {
            return this.local.put(path, body, contentType);
        }
        else {
            return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
        }
    },
    'delete': function (path, remoteConnected) {
        if (this.local) {
            return this.local.delete(path, remoteConnected);
        }
        else {
            return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path, remoteConnected));
        }
    },
    _wrapBusyDone: function (result) {
        return __awaiter(this, void 0, void 0, function* () {
            this._emit('wire-busy');
            return result.then((r) => {
                this._emit('wire-done', { success: true });
                return Promise.resolve(r);
            }, (err) => {
                this._emit('wire-done', { success: false });
                return Promise.reject(err);
            });
        });
    }
};
module.exports = SyncedGetPutDelete;


/***/ }),

/***/ "./src/types.ts":
/*!**********************!*\
  !*** ./src/types.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BaseClientTypes = void 0;
/**
 * - Manages and validates types of remoteStorage objects, using JSON-LD and
 *   JSON Schema
 * - Adds schema declaration/validation methods to BaseClient instances.
 **/
class BaseClientTypes {
    constructor() {
        /**
         * <alias> -> <uri>
         */
        this.uris = {};
        /**
         * Contains schema objects of all types known to the BaseClient instance
         *
         * <uri> -> <schema>
         */
        this.schemas = {};
        /**
         * <uri> -> <alias>
         */
        this.aliases = {};
    }
    /**
     * Called via public function BaseClient.declareType()
     *
     * @private
     */
    declare(moduleName, alias, uri, schema) {
        const fullAlias = moduleName + '/' + alias;
        if (schema.extends) {
            const parts = schema.extends.split('/');
            const extendedAlias = (parts.length === 1)
                ? moduleName + '/' + parts.shift()
                : parts.join('/');
            const extendedUri = this.uris[extendedAlias];
            if (!extendedUri) {
                throw "Type '" + fullAlias + "' tries to extend unknown schema '" + extendedAlias + "'";
            }
            schema.extends = this.schemas[extendedUri];
        }
        this.uris[fullAlias] = uri;
        this.aliases[uri] = fullAlias;
        this.schemas[uri] = schema;
    }
    resolveAlias(alias) {
        return this.uris[alias];
    }
    getSchema(uri) {
        return this.schemas[uri];
    }
    inScope(moduleName) {
        const ml = moduleName.length;
        const schemas = {};
        for (const alias in this.uris) {
            if (alias.substr(0, ml + 1) === moduleName + '/') {
                const uri = this.uris[alias];
                schemas[uri] = this.schemas[uri];
            }
        }
        return schemas;
    }
}
exports.BaseClientTypes = BaseClientTypes;
const Types = new BaseClientTypes();
exports["default"] = Types;


/***/ }),

/***/ "./src/unauthorized-error.ts":
/*!***********************************!*\
  !*** ./src/unauthorized-error.ts ***!
  \***********************************/
/***/ (function(module) {

"use strict";

class UnauthorizedError extends Error {
    constructor(message, options = {}) {
        super();
        this.name = 'Unauthorized';
        if (typeof message === 'undefined') {
            this.message = 'App authorization expired or revoked.';
        }
        else {
            this.message = message;
        }
        if (typeof options.code !== 'undefined') {
            this.code = options.code;
        }
        this.stack = (new Error()).stack;
    }
}
module.exports = UnauthorizedError;


/***/ }),

/***/ "./src/util.ts":
/*!*********************!*\
  !*** ./src/util.ts ***!
  \*********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// Reusable utility functions
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toBase64 = exports.getTextFromArrayBuffer = exports.shouldBeTreatedAsBinary = exports.getJSONFromLocalStorage = exports.localStorageAvailable = exports.pathsFromRoot = exports.deepClone = exports.equal = exports.bindAll = exports.cleanPath = exports.baseName = exports.isDocument = exports.isFolder = exports.containingFolder = exports.extend = exports.getGlobalContext = exports.globalContext = exports.logError = void 0;
exports.generateCodeVerifier = generateCodeVerifier;
exports.applyMixins = applyMixins;
const logError = (error) => {
    if (typeof (error) === 'string') {
        console.error(error);
    }
    else {
        console.error(error.message, error.stack);
    }
};
exports.logError = logError;
exports.globalContext = (typeof (window) !== 'undefined' ? window : (typeof self === 'object' ? self : __webpack_require__.g));
const getGlobalContext = () => {
    return (typeof (window) !== 'undefined' ? window : (typeof self === 'object' ? self : __webpack_require__.g));
};
exports.getGlobalContext = getGlobalContext;
// TODO Remove in favor of modern JS:
// `const mergedObject = { ...obj1, ..obj2 }`
const extend = (...args) => {
    const target = args[0];
    const sources = Array.prototype.slice.call(args, 1);
    sources.forEach(function (source) {
        for (const key in source) {
            target[key] = source[key];
        }
    });
    return target;
};
exports.extend = extend;
const containingFolder = (path) => {
    if (path === '') {
        return '/';
    }
    if (!path) {
        throw "Path not given!";
    }
    return path.replace(/\/+/g, '/')
        .replace(/[^\/]+\/?$/, '');
};
exports.containingFolder = containingFolder;
const isFolder = (path) => {
    return path.slice(-1) === '/';
};
exports.isFolder = isFolder;
const isDocument = (path) => {
    return !(0, exports.isFolder)(path);
};
exports.isDocument = isDocument;
const baseName = (path) => {
    const parts = path.split('/');
    if ((0, exports.isFolder)(path)) {
        return parts[parts.length - 2] + '/';
    }
    else {
        return parts[parts.length - 1];
    }
};
exports.baseName = baseName;
const cleanPath = (path) => {
    return path.replace(/\/+/g, '/')
        .split('/').map(encodeURIComponent).join('/')
        .replace(/'/g, '%27');
};
exports.cleanPath = cleanPath;
const bindAll = (object) => {
    for (const key in this) {
        if (typeof (object[key]) === 'function') {
            object[key] = object[key].bind(object);
        }
    }
};
exports.bindAll = bindAll;
const equal = (a, b, seen = []) => {
    let key;
    if (typeof (a) !== typeof (b)) {
        return false;
    }
    if (typeof (a) === 'number' || typeof (a) === 'boolean' || typeof (a) === 'string') {
        return a === b;
    }
    if (typeof (a) === 'function') {
        return a.toString() === b.toString();
    }
    if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
        // Without the following conversion the browsers wouldn't be able to
        // tell the ArrayBuffer instances apart.
        a = new Uint8Array(a);
        b = new Uint8Array(b);
    }
    // typeof null is 'object'. If either is null, check if they are equal.
    if (a === null || b === null) {
        return a === b;
    }
    // If this point has been reached, a and b are either arrays or objects.
    if (a instanceof Array) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0, c = a.length; i < c; i++) {
            if (!(0, exports.equal)(a[i], b[i], seen)) {
                return false;
            }
        }
    }
    else {
        // Check that keys from a exist in b
        for (key in a) {
            if (a.hasOwnProperty(key) && !(key in b)) {
                return false;
            }
        }
        // Check that keys from b exist in a, and compare the values
        for (key in b) {
            if (!b.hasOwnProperty(key)) {
                continue;
            }
            if (!(key in a)) {
                return false;
            }
            let seenArg;
            if (typeof (b[key]) === 'object') {
                if (seen.indexOf(b[key]) >= 0) {
                    // Circular reference, don't attempt to compare this object.
                    // If nothing else returns false, the objects match.
                    continue;
                }
                seenArg = seen.slice();
                seenArg.push(b[key]);
            }
            if (!(0, exports.equal)(a[key], b[key], seenArg)) {
                return false;
            }
        }
    }
    return true;
};
exports.equal = equal;
const deepClone = (obj) => {
    if (obj === undefined) {
        return undefined;
    }
    else if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    else {
        return JSON.parse(JSON.stringify(obj));
    }
};
exports.deepClone = deepClone;
const pathsFromRoot = (path) => {
    const paths = [path];
    const parts = path.replace(/\/$/, '').split('/');
    while (parts.length > 1) {
        parts.pop();
        paths.push(parts.join('/') + '/');
    }
    return paths;
};
exports.pathsFromRoot = pathsFromRoot;
const localStorageAvailable = () => {
    const context = (0, exports.getGlobalContext)();
    if (!('localStorage' in context)) {
        return false;
    }
    try {
        context.localStorage.setItem('rs-check', '1');
        context.localStorage.removeItem('rs-check');
        return true;
    }
    catch (error) {
        return false;
    }
};
exports.localStorageAvailable = localStorageAvailable;
/**
 * Extract and parse JSON data from localStorage.
 *
 * @param {string} key - localStorage key
 *
 * @returns {object} parsed object or undefined
 */
const getJSONFromLocalStorage = (key) => {
    const context = (0, exports.getGlobalContext)();
    try {
        return JSON.parse(context.localStorage.getItem(key));
    }
    catch (e) {
        // no JSON stored
    }
};
exports.getJSONFromLocalStorage = getJSONFromLocalStorage;
/**
 * Decide if data should be treated as binary based on the content (presence of non-printable characters
 * or replacement character) and content-type.
 *
 * @param {string} content - The data
 * @param {string} mimeType - The data's content-type
 *
 * @returns {boolean}
 */
const shouldBeTreatedAsBinary = (content, mimeType) => {
    // eslint-disable-next-line no-control-regex
    return !!((mimeType && mimeType.match(/charset=binary/)) || /[\x00-\x08\x0E-\x1F\uFFFD]/.test(content));
};
exports.shouldBeTreatedAsBinary = shouldBeTreatedAsBinary;
/**
 * Read data from an ArrayBuffer and return it as a string
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} encoding
 * @returns {Promise} Resolves with a string containing the data
 */
const getTextFromArrayBuffer = (arrayBuffer, encoding) => {
    return new Promise((resolve /*, reject*/) => {
        if (typeof Blob === 'undefined' || typeof FileReader === 'undefined') {
            const buffer = Buffer.from(arrayBuffer);
            resolve(buffer.toString(encoding));
        }
        else {
            let blob;
            const gc = exports.globalContext;
            // TODO fix as BlobBuilder is not available in all browsers
            // @see https://developer.mozilla.org/en-US/docs/Web/API/BlobBuilder
            gc.BlobBuilder = gc.BlobBuilder || gc.WebKitBlobBuilder;
            if (typeof gc.BlobBuilder !== 'undefined') {
                const bb = new gc.BlobBuilder();
                bb.append(arrayBuffer);
                blob = bb.getBlob();
            }
            else {
                blob = new Blob([arrayBuffer]);
            }
            const fileReader = new FileReader();
            if (typeof fileReader.addEventListener === 'function') {
                fileReader.addEventListener('loadend', function (evt) {
                    resolve(evt.target.result);
                });
            }
            else {
                fileReader.onloadend = function (evt) {
                    resolve(evt.target.result);
                };
            }
            fileReader.readAsText(blob, encoding);
        }
    });
};
exports.getTextFromArrayBuffer = getTextFromArrayBuffer;
/**
 * Encode string in base64
 * @param {String} str
 * @returns {String} base64-encoded string
 */
const toBase64 = (str) => {
    const context = (0, exports.getGlobalContext)();
    if ('btoa' in context) {
        return context['btoa'](str);
    }
    else {
        return Buffer.from(str).toString('base64');
    }
};
exports.toBase64 = toBase64;
/**
 * Generates values required for OAuth2 PKCE in a cryptographically secure manner.
 * @param {number} [numChar=128] - length of codeVerifier to generate; from 43 to 128
 *
 * @typedef {Object} PkceValues
 * @property {string} codeVerifier - 43 to 128 chars from the 66-char set
 * @property {string} codeChallenge - verifier hashed & base-64 URL encoded
 * @property {string} state - a separate random value. Should be used to check redirect_uri.
 * @returns PkceValues
 */
function generateCodeVerifier() {
    return __awaiter(this, arguments, void 0, function* (numChar = 128) {
        const randomBytes = new Uint8Array(numChar);
        crypto.getRandomValues(randomBytes);
        const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const randomChar = Array.from(randomBytes).map(byte => charSet[byte % charSet.length]);
        const codeVerifier = randomChar.join('');
        const charsAsBytes = Uint8Array.from(randomChar.map(ch => ch.charCodeAt(0)));
        const sha256hash = yield crypto.subtle.digest('SHA-256', charsAsBytes);
        const codeChallenge = base64Urlencode(sha256hash);
        crypto.getRandomValues(randomBytes);
        const stateRandomChar = Array.from(randomBytes).map(byte => charSet[byte % charSet.length]);
        const state = stateRandomChar.join('');
        return { codeVerifier, codeChallenge, state };
    });
}
function base64Urlencode(str) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
/*
 * Apply mixins to an object
 *
 * https://www.typescriptlang.org/docs/handbook/mixins.html
 *
 * @param derivedConstructor Parent object
 * @param constructors Mixins to apply methods from
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMixins(derivedCtor, constructors) {
    constructors.forEach(baseCtor => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
            Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name));
        });
    });
}


/***/ }),

/***/ "./src/wireclient.ts":
/*!***************************!*\
  !*** ./src/wireclient.ts ***!
  \***************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
const remote_1 = __webpack_require__(/*! ./remote */ "./src/remote.ts");
let hasLocalStorage;
const SETTINGS_KEY = 'remotestorage:wireclient';
const API_2012 = 1;
const API_00 = 2;
const API_01 = 3;
const API_02 = 4;
const API_HEAD = 5;
const STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'draft-dejong-remotestorage-02': API_02,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
};
function readSettings() {
    const settings = (0, util_1.getJSONFromLocalStorage)(SETTINGS_KEY) || {};
    const { userAddress, href, storageApi, token, properties } = settings;
    return { userAddress, href, storageApi, token, properties };
}
function determineCharset(mimeType) {
    let charset = 'utf-8';
    let charsetMatch;
    if (mimeType) {
        charsetMatch = mimeType.match(/charset=(.+)$/);
        if (charsetMatch) {
            charset = charsetMatch[1];
        }
    }
    return charset;
}
function isFolderDescription(body) {
    return ((body['@context'] === 'http://remotestorage.io/spec/folder-description')
        && (typeof (body['items']) === 'object'));
}
function isSuccessStatus(status) {
    return [201, 204, 304].indexOf(status) >= 0;
}
function isErrorStatus(status) {
    return [401, 403, 404, 412].indexOf(status) >= 0;
}
class WireClient extends remote_1.RemoteBase {
    constructor(rs) {
        super(rs);
        this._revisionCache = {};
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        /**
         * Event: connected
         *   Fired when the wireclient connect method realizes that it is in
         *   possession of a token and href
         **/
        this.addEvents(['connected', 'not-connected']);
        if (hasLocalStorage) {
            const settings = readSettings();
            if (settings) {
                setTimeout(() => {
                    this.configure(settings);
                }, 0);
            }
        }
        if (this.connected) {
            setTimeout(this._emit.bind(this), 0, 'connected');
        }
    }
    _request(method, uri, token, headers, body, getEtag, fakeRevision) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isForbiddenRequestMethod(method, uri)) {
                return Promise.reject(`Don't use ${method} on directories!`);
            }
            let revision;
            if (token !== authorize_1.default.IMPLIED_FAKE_TOKEN) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            this.rs._emit('wire-busy', {
                method: method,
                isFolder: (0, util_1.isFolder)(uri)
            });
            return (0, requests_1.requestWithTimeout)(method, uri, {
                body: body,
                headers: headers,
                responseType: 'arraybuffer'
            }).then((response) => {
                if (!this.online) {
                    this.online = true;
                    this.rs._emit('network-online');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(uri),
                    success: true
                });
                if (isErrorStatus(response.status)) {
                    (0, log_1.default)('[WireClient] Error response status', response.status);
                    if (getEtag) {
                        revision = this.stripQuotes(response.getResponseHeader('ETag'));
                    }
                    else {
                        revision = undefined;
                    }
                    if (response.status === 401) {
                        this.rs._emit('error', new unauthorized_error_1.default());
                    }
                    return Promise.resolve({ statusCode: response.status, revision: revision });
                }
                else if (isSuccessStatus(response.status) ||
                    (response.status === 200 && method !== 'GET')) {
                    revision = this.stripQuotes(response.getResponseHeader('ETag'));
                    (0, log_1.default)('[WireClient] Successful request', revision);
                    return Promise.resolve({ statusCode: response.status, revision: revision });
                }
                else {
                    const mimeType = response.getResponseHeader('Content-Type');
                    if (getEtag) {
                        revision = this.stripQuotes(response.getResponseHeader('ETag'));
                    }
                    else {
                        revision = (response.status === 200) ? fakeRevision : undefined;
                    }
                    const charset = determineCharset(mimeType);
                    if ((0, util_1.shouldBeTreatedAsBinary)(response.response, mimeType)) {
                        (0, log_1.default)('[WireClient] Successful request with unknown or binary mime-type', revision);
                        return Promise.resolve({
                            statusCode: response.status,
                            body: response.response,
                            contentType: mimeType,
                            revision: revision
                        });
                    }
                    else {
                        return (0, util_1.getTextFromArrayBuffer)(response.response, charset)
                            .then((textContent) => {
                            (0, log_1.default)('[WireClient] Successful request', revision);
                            return Promise.resolve({
                                statusCode: response.status,
                                body: textContent,
                                contentType: mimeType,
                                revision: revision
                            });
                        });
                    }
                }
            }, error => {
                if (this.online) {
                    this.online = false;
                    this.rs._emit('network-offline');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(uri),
                    success: false
                });
                return Promise.reject(error);
            });
        });
    }
    /**
     * Sets the userAddress, href, storageApi, token, and properties of a
     * remote store. Also sets connected and online to true and emits the
     * 'connected' event, if both token and href are present.
     *
     * Parameters:
     *   settings - An object that may contain userAddress (string or null),
     *              href (string or null), storageApi (string or null), token (string
     *              or null), and/or properties (the JSON-parsed properties object
     *              from the user's WebFinger record, see section 10 of
     *              http://tools.ietf.org/html/draft-dejong-remotestorage-03
     *              or null).
     *              Fields that are not included (i.e. `undefined`), stay at
     *              their current value. To set a field, include that field
     *              with a `string` value. To reset a field, for instance when
     *              the user disconnected their storage, or you found that the
     *              token you have has expired, simply set that field to `null`.
     */
    configure(settings) {
        if (typeof settings !== 'object') {
            throw new Error('WireClient configure settings parameter should be an object');
        }
        if (typeof settings.userAddress !== 'undefined') {
            this.userAddress = settings.userAddress;
        }
        if (typeof settings.href !== 'undefined') {
            this.href = settings.href;
        }
        if (typeof settings.storageApi !== 'undefined') {
            this.storageApi = settings.storageApi;
        }
        if (typeof settings.token !== 'undefined') {
            this.token = settings.token;
        }
        if (typeof settings.properties !== 'undefined') {
            this.properties = settings.properties;
        }
        if (typeof this.storageApi === 'string') {
            const _storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
            this.supportsRevs = _storageApi >= API_00;
        }
        if (this.href && this.token) {
            this.connected = true;
            this.online = true;
            this._emit('connected');
        }
        else {
            this.connected = false;
        }
        if (hasLocalStorage) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                userAddress: this.userAddress,
                href: this.href,
                storageApi: this.storageApi,
                token: this.token,
                properties: this.properties
            }));
        }
    }
    get(path, options = {}) {
        if (!this.connected) {
            return Promise.reject('not connected (path: ' + path + ')');
        }
        const headers = {};
        if (this.supportsRevs) {
            if (options.ifNoneMatch) {
                headers['If-None-Match'] = this.addQuotes(options.ifNoneMatch);
            }
        }
        // commenting it out as this is doing nothing and jshint is complaining -les
        // else if (options.ifNoneMatch) {
        //   let oldRev = this._revisionCache[path];
        // }
        return this._request('GET', this.href + (0, util_1.cleanPath)(path), this.token, headers, undefined, this.supportsRevs, this._revisionCache[path])
            .then((r) => {
            if (!(0, util_1.isFolder)(path)) {
                return Promise.resolve(r);
            }
            let itemsMap = {};
            if (typeof (r.body) !== 'undefined') {
                try {
                    r.body = JSON.parse(r.body);
                }
                catch (e) {
                    return Promise.reject('Folder description at ' + this.href + (0, util_1.cleanPath)(path) + ' is not JSON');
                }
            }
            if (r.statusCode === 200 && typeof (r.body) === 'object') {
                // New folder listing received
                if (Object.keys(r.body).length === 0) {
                    // Empty folder listing of any spec
                    r.statusCode = 404;
                }
                else if (isFolderDescription(r.body)) {
                    // >= 02 spec
                    for (const item in r.body.items) {
                        this._revisionCache[path + item] = r.body.items[item].ETag;
                    }
                    itemsMap = r.body.items;
                }
                else {
                    // < 02 spec
                    Object.keys(r.body).forEach((key) => {
                        this._revisionCache[path + key] = r.body[key];
                        itemsMap[key] = { 'ETag': r.body[key] };
                    });
                }
                r.body = itemsMap;
                return Promise.resolve(r);
            }
            else {
                return Promise.resolve(r);
            }
        });
    }
    put(path, body, contentType, options = {}) {
        if (!this.connected) {
            return Promise.reject('not connected (path: ' + path + ')');
        }
        if ((!contentType.match(/charset=/)) && (body instanceof ArrayBuffer || (0, requests_1.isArrayBufferView)(body))) {
            contentType += '; charset=binary';
        }
        const headers = { 'Content-Type': contentType };
        if (this.supportsRevs) {
            if (options.ifMatch) {
                headers['If-Match'] = this.addQuotes(options.ifMatch);
            }
            if (options.ifNoneMatch) {
                headers['If-None-Match'] = this.addQuotes(options.ifNoneMatch);
            }
        }
        return this._request('PUT', this.href + (0, util_1.cleanPath)(path), this.token, headers, body, this.supportsRevs);
    }
    delete(path, options = {}) {
        if (!this.connected) {
            throw new Error('not connected (path: ' + path + ')');
        }
        if (!options) {
            options = {};
        }
        const headers = {};
        if (this.supportsRevs) {
            if (options.ifMatch) {
                headers['If-Match'] = this.addQuotes(options.ifMatch);
            }
        }
        return this._request('DELETE', this.href + (0, util_1.cleanPath)(path), this.token, headers, undefined, this.supportsRevs);
    }
    static _rs_init(remoteStorage) {
        remoteStorage.remote = new WireClient(remoteStorage);
        remoteStorage.remote.online = true;
    }
    static _rs_supported() {
        return typeof fetch === 'function' || typeof XMLHttpRequest === 'function';
    }
    static _rs_cleanup() {
        if (hasLocalStorage) {
            delete localStorage[SETTINGS_KEY];
        }
    }
}
(0, util_1.applyMixins)(WireClient, [eventhandling_1.default]);
module.exports = WireClient;


/***/ }),

/***/ "./node_modules/tv4/tv4.js":
/*!*********************************!*\
  !*** ./node_modules/tv4/tv4.js ***!
  \*********************************/
/***/ (function(module, exports) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/*
Author: Geraint Luff and others
Year: 2013

This code is released into the "public domain" by its author(s).  Anybody may use, alter and distribute the code without restriction.  The author makes no guarantees, and takes no liability of any kind for use of this code.

If you find a bug or make an improvement, it would be courteous to let the author know, but it is not compulsory.
*/
(function (global, factory) {
  if (true) {
    // AMD. Register as an anonymous module.
    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
		__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
		(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
  } else // removed by dead control flow
{}
}(this, function () {

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FObject%2Fkeys
if (!Object.keys) {
	Object.keys = (function () {
		var hasOwnProperty = Object.prototype.hasOwnProperty,
			hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
			dontEnums = [
				'toString',
				'toLocaleString',
				'valueOf',
				'hasOwnProperty',
				'isPrototypeOf',
				'propertyIsEnumerable',
				'constructor'
			],
			dontEnumsLength = dontEnums.length;

		return function (obj) {
			if (typeof obj !== 'object' && typeof obj !== 'function' || obj === null) {
				throw new TypeError('Object.keys called on non-object');
			}

			var result = [];

			for (var prop in obj) {
				if (hasOwnProperty.call(obj, prop)) {
					result.push(prop);
				}
			}

			if (hasDontEnumBug) {
				for (var i=0; i < dontEnumsLength; i++) {
					if (hasOwnProperty.call(obj, dontEnums[i])) {
						result.push(dontEnums[i]);
					}
				}
			}
			return result;
		};
	})();
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create
if (!Object.create) {
	Object.create = (function(){
		function F(){}

		return function(o){
			if (arguments.length !== 1) {
				throw new Error('Object.create implementation only accepts one parameter.');
			}
			F.prototype = o;
			return new F();
		};
	})();
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FArray%2FisArray
if(!Array.isArray) {
	Array.isArray = function (vArg) {
		return Object.prototype.toString.call(vArg) === "[object Array]";
	};
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FArray%2FindexOf
if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
		if (this === null) {
			throw new TypeError();
		}
		var t = Object(this);
		var len = t.length >>> 0;

		if (len === 0) {
			return -1;
		}
		var n = 0;
		if (arguments.length > 1) {
			n = Number(arguments[1]);
			if (n !== n) { // shortcut for verifying if it's NaN
				n = 0;
			} else if (n !== 0 && n !== Infinity && n !== -Infinity) {
				n = (n > 0 || -1) * Math.floor(Math.abs(n));
			}
		}
		if (n >= len) {
			return -1;
		}
		var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
		for (; k < len; k++) {
			if (k in t && t[k] === searchElement) {
				return k;
			}
		}
		return -1;
	};
}

// Grungey Object.isFrozen hack
if (!Object.isFrozen) {
	Object.isFrozen = function (obj) {
		var key = "tv4_test_frozen_key";
		while (obj.hasOwnProperty(key)) {
			key += Math.random();
		}
		try {
			obj[key] = true;
			delete obj[key];
			return false;
		} catch (e) {
			return true;
		}
	};
}
// Based on: https://github.com/geraintluff/uri-templates, but with all the de-substitution stuff removed

var uriTemplateGlobalModifiers = {
	"+": true,
	"#": true,
	".": true,
	"/": true,
	";": true,
	"?": true,
	"&": true
};
var uriTemplateSuffices = {
	"*": true
};

function notReallyPercentEncode(string) {
	return encodeURI(string).replace(/%25[0-9][0-9]/g, function (doubleEncoded) {
		return "%" + doubleEncoded.substring(3);
	});
}

function uriTemplateSubstitution(spec) {
	var modifier = "";
	if (uriTemplateGlobalModifiers[spec.charAt(0)]) {
		modifier = spec.charAt(0);
		spec = spec.substring(1);
	}
	var separator = "";
	var prefix = "";
	var shouldEscape = true;
	var showVariables = false;
	var trimEmptyString = false;
	if (modifier === '+') {
		shouldEscape = false;
	} else if (modifier === ".") {
		prefix = ".";
		separator = ".";
	} else if (modifier === "/") {
		prefix = "/";
		separator = "/";
	} else if (modifier === '#') {
		prefix = "#";
		shouldEscape = false;
	} else if (modifier === ';') {
		prefix = ";";
		separator = ";";
		showVariables = true;
		trimEmptyString = true;
	} else if (modifier === '?') {
		prefix = "?";
		separator = "&";
		showVariables = true;
	} else if (modifier === '&') {
		prefix = "&";
		separator = "&";
		showVariables = true;
	}

	var varNames = [];
	var varList = spec.split(",");
	var varSpecs = [];
	var varSpecMap = {};
	for (var i = 0; i < varList.length; i++) {
		var varName = varList[i];
		var truncate = null;
		if (varName.indexOf(":") !== -1) {
			var parts = varName.split(":");
			varName = parts[0];
			truncate = parseInt(parts[1], 10);
		}
		var suffices = {};
		while (uriTemplateSuffices[varName.charAt(varName.length - 1)]) {
			suffices[varName.charAt(varName.length - 1)] = true;
			varName = varName.substring(0, varName.length - 1);
		}
		var varSpec = {
			truncate: truncate,
			name: varName,
			suffices: suffices
		};
		varSpecs.push(varSpec);
		varSpecMap[varName] = varSpec;
		varNames.push(varName);
	}
	var subFunction = function (valueFunction) {
		var result = "";
		var startIndex = 0;
		for (var i = 0; i < varSpecs.length; i++) {
			var varSpec = varSpecs[i];
			var value = valueFunction(varSpec.name);
			if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) {
				startIndex++;
				continue;
			}
			if (i === startIndex) {
				result += prefix;
			} else {
				result += (separator || ",");
			}
			if (Array.isArray(value)) {
				if (showVariables) {
					result += varSpec.name + "=";
				}
				for (var j = 0; j < value.length; j++) {
					if (j > 0) {
						result += varSpec.suffices['*'] ? (separator || ",") : ",";
						if (varSpec.suffices['*'] && showVariables) {
							result += varSpec.name + "=";
						}
					}
					result += shouldEscape ? encodeURIComponent(value[j]).replace(/!/g, "%21") : notReallyPercentEncode(value[j]);
				}
			} else if (typeof value === "object") {
				if (showVariables && !varSpec.suffices['*']) {
					result += varSpec.name + "=";
				}
				var first = true;
				for (var key in value) {
					if (!first) {
						result += varSpec.suffices['*'] ? (separator || ",") : ",";
					}
					first = false;
					result += shouldEscape ? encodeURIComponent(key).replace(/!/g, "%21") : notReallyPercentEncode(key);
					result += varSpec.suffices['*'] ? '=' : ",";
					result += shouldEscape ? encodeURIComponent(value[key]).replace(/!/g, "%21") : notReallyPercentEncode(value[key]);
				}
			} else {
				if (showVariables) {
					result += varSpec.name;
					if (!trimEmptyString || value !== "") {
						result += "=";
					}
				}
				if (varSpec.truncate != null) {
					value = value.substring(0, varSpec.truncate);
				}
				result += shouldEscape ? encodeURIComponent(value).replace(/!/g, "%21"): notReallyPercentEncode(value);
			}
		}
		return result;
	};
	subFunction.varNames = varNames;
	return {
		prefix: prefix,
		substitution: subFunction
	};
}

function UriTemplate(template) {
	if (!(this instanceof UriTemplate)) {
		return new UriTemplate(template);
	}
	var parts = template.split("{");
	var textParts = [parts.shift()];
	var prefixes = [];
	var substitutions = [];
	var varNames = [];
	while (parts.length > 0) {
		var part = parts.shift();
		var spec = part.split("}")[0];
		var remainder = part.substring(spec.length + 1);
		var funcs = uriTemplateSubstitution(spec);
		substitutions.push(funcs.substitution);
		prefixes.push(funcs.prefix);
		textParts.push(remainder);
		varNames = varNames.concat(funcs.substitution.varNames);
	}
	this.fill = function (valueFunction) {
		var result = textParts[0];
		for (var i = 0; i < substitutions.length; i++) {
			var substitution = substitutions[i];
			result += substitution(valueFunction);
			result += textParts[i + 1];
		}
		return result;
	};
	this.varNames = varNames;
	this.template = template;
}
UriTemplate.prototype = {
	toString: function () {
		return this.template;
	},
	fillFromObject: function (obj) {
		return this.fill(function (varName) {
			return obj[varName];
		});
	}
};
var ValidatorContext = function ValidatorContext(parent, collectMultiple, errorReporter, checkRecursive, trackUnknownProperties) {
	this.missing = [];
	this.missingMap = {};
	this.formatValidators = parent ? Object.create(parent.formatValidators) : {};
	this.schemas = parent ? Object.create(parent.schemas) : {};
	this.collectMultiple = collectMultiple;
	this.errors = [];
	this.handleError = collectMultiple ? this.collectError : this.returnError;
	if (checkRecursive) {
		this.checkRecursive = true;
		this.scanned = [];
		this.scannedFrozen = [];
		this.scannedFrozenSchemas = [];
		this.scannedFrozenValidationErrors = [];
		this.validatedSchemasKey = 'tv4_validation_id';
		this.validationErrorsKey = 'tv4_validation_errors_id';
	}
	if (trackUnknownProperties) {
		this.trackUnknownProperties = true;
		this.knownPropertyPaths = {};
		this.unknownPropertyPaths = {};
	}
	this.errorReporter = errorReporter || defaultErrorReporter('en');
	if (typeof this.errorReporter === 'string') {
		throw new Error('debug');
	}
	this.definedKeywords = {};
	if (parent) {
		for (var key in parent.definedKeywords) {
			this.definedKeywords[key] = parent.definedKeywords[key].slice(0);
		}
	}
};
ValidatorContext.prototype.defineKeyword = function (keyword, keywordFunction) {
	this.definedKeywords[keyword] = this.definedKeywords[keyword] || [];
	this.definedKeywords[keyword].push(keywordFunction);
};
ValidatorContext.prototype.createError = function (code, messageParams, dataPath, schemaPath, subErrors, data, schema) {
	var error = new ValidationError(code, messageParams, dataPath, schemaPath, subErrors);
	error.message = this.errorReporter(error, data, schema);
	return error;
};
ValidatorContext.prototype.returnError = function (error) {
	return error;
};
ValidatorContext.prototype.collectError = function (error) {
	if (error) {
		this.errors.push(error);
	}
	return null;
};
ValidatorContext.prototype.prefixErrors = function (startIndex, dataPath, schemaPath) {
	for (var i = startIndex; i < this.errors.length; i++) {
		this.errors[i] = this.errors[i].prefixWith(dataPath, schemaPath);
	}
	return this;
};
ValidatorContext.prototype.banUnknownProperties = function (data, schema) {
	for (var unknownPath in this.unknownPropertyPaths) {
		var error = this.createError(ErrorCodes.UNKNOWN_PROPERTY, {path: unknownPath}, unknownPath, "", null, data, schema);
		var result = this.handleError(error);
		if (result) {
			return result;
		}
	}
	return null;
};

ValidatorContext.prototype.addFormat = function (format, validator) {
	if (typeof format === 'object') {
		for (var key in format) {
			this.addFormat(key, format[key]);
		}
		return this;
	}
	this.formatValidators[format] = validator;
};
ValidatorContext.prototype.resolveRefs = function (schema, urlHistory) {
	if (schema['$ref'] !== undefined) {
		urlHistory = urlHistory || {};
		if (urlHistory[schema['$ref']]) {
			return this.createError(ErrorCodes.CIRCULAR_REFERENCE, {urls: Object.keys(urlHistory).join(', ')}, '', '', null, undefined, schema);
		}
		urlHistory[schema['$ref']] = true;
		schema = this.getSchema(schema['$ref'], urlHistory);
	}
	return schema;
};
ValidatorContext.prototype.getSchema = function (url, urlHistory) {
	var schema;
	if (this.schemas[url] !== undefined) {
		schema = this.schemas[url];
		return this.resolveRefs(schema, urlHistory);
	}
	var baseUrl = url;
	var fragment = "";
	if (url.indexOf('#') !== -1) {
		fragment = url.substring(url.indexOf("#") + 1);
		baseUrl = url.substring(0, url.indexOf("#"));
	}
	if (typeof this.schemas[baseUrl] === 'object') {
		schema = this.schemas[baseUrl];
		var pointerPath = decodeURIComponent(fragment);
		if (pointerPath === "") {
			return this.resolveRefs(schema, urlHistory);
		} else if (pointerPath.charAt(0) !== "/") {
			return undefined;
		}
		var parts = pointerPath.split("/").slice(1);
		for (var i = 0; i < parts.length; i++) {
			var component = parts[i].replace(/~1/g, "/").replace(/~0/g, "~");
			if (schema[component] === undefined) {
				schema = undefined;
				break;
			}
			schema = schema[component];
		}
		if (schema !== undefined) {
			return this.resolveRefs(schema, urlHistory);
		}
	}
	if (this.missing[baseUrl] === undefined) {
		this.missing.push(baseUrl);
		this.missing[baseUrl] = baseUrl;
		this.missingMap[baseUrl] = baseUrl;
	}
};
ValidatorContext.prototype.searchSchemas = function (schema, url) {
	if (Array.isArray(schema)) {
		for (var i = 0; i < schema.length; i++) {
			this.searchSchemas(schema[i], url);
		}
	} else if (schema && typeof schema === "object") {
		if (typeof schema.id === "string") {
			if (isTrustedUrl(url, schema.id)) {
				if (this.schemas[schema.id] === undefined) {
					this.schemas[schema.id] = schema;
				}
			}
		}
		for (var key in schema) {
			if (key !== "enum") {
				if (typeof schema[key] === "object") {
					this.searchSchemas(schema[key], url);
				} else if (key === "$ref") {
					var uri = getDocumentUri(schema[key]);
					if (uri && this.schemas[uri] === undefined && this.missingMap[uri] === undefined) {
						this.missingMap[uri] = uri;
					}
				}
			}
		}
	}
};
ValidatorContext.prototype.addSchema = function (url, schema) {
	//overload
	if (typeof url !== 'string' || typeof schema === 'undefined') {
		if (typeof url === 'object' && typeof url.id === 'string') {
			schema = url;
			url = schema.id;
		}
		else {
			return;
		}
	}
	if (url === getDocumentUri(url) + "#") {
		// Remove empty fragment
		url = getDocumentUri(url);
	}
	this.schemas[url] = schema;
	delete this.missingMap[url];
	normSchema(schema, url);
	this.searchSchemas(schema, url);
};

ValidatorContext.prototype.getSchemaMap = function () {
	var map = {};
	for (var key in this.schemas) {
		map[key] = this.schemas[key];
	}
	return map;
};

ValidatorContext.prototype.getSchemaUris = function (filterRegExp) {
	var list = [];
	for (var key in this.schemas) {
		if (!filterRegExp || filterRegExp.test(key)) {
			list.push(key);
		}
	}
	return list;
};

ValidatorContext.prototype.getMissingUris = function (filterRegExp) {
	var list = [];
	for (var key in this.missingMap) {
		if (!filterRegExp || filterRegExp.test(key)) {
			list.push(key);
		}
	}
	return list;
};

ValidatorContext.prototype.dropSchemas = function () {
	this.schemas = {};
	this.reset();
};
ValidatorContext.prototype.reset = function () {
	this.missing = [];
	this.missingMap = {};
	this.errors = [];
};

ValidatorContext.prototype.validateAll = function (data, schema, dataPathParts, schemaPathParts, dataPointerPath) {
	var topLevel;
	schema = this.resolveRefs(schema);
	if (!schema) {
		return null;
	} else if (schema instanceof ValidationError) {
		this.errors.push(schema);
		return schema;
	}

	var startErrorCount = this.errors.length;
	var frozenIndex, scannedFrozenSchemaIndex = null, scannedSchemasIndex = null;
	if (this.checkRecursive && data && typeof data === 'object') {
		topLevel = !this.scanned.length;
		if (data[this.validatedSchemasKey]) {
			var schemaIndex = data[this.validatedSchemasKey].indexOf(schema);
			if (schemaIndex !== -1) {
				this.errors = this.errors.concat(data[this.validationErrorsKey][schemaIndex]);
				return null;
			}
		}
		if (Object.isFrozen(data)) {
			frozenIndex = this.scannedFrozen.indexOf(data);
			if (frozenIndex !== -1) {
				var frozenSchemaIndex = this.scannedFrozenSchemas[frozenIndex].indexOf(schema);
				if (frozenSchemaIndex !== -1) {
					this.errors = this.errors.concat(this.scannedFrozenValidationErrors[frozenIndex][frozenSchemaIndex]);
					return null;
				}
			}
		}
		this.scanned.push(data);
		if (Object.isFrozen(data)) {
			if (frozenIndex === -1) {
				frozenIndex = this.scannedFrozen.length;
				this.scannedFrozen.push(data);
				this.scannedFrozenSchemas.push([]);
			}
			scannedFrozenSchemaIndex = this.scannedFrozenSchemas[frozenIndex].length;
			this.scannedFrozenSchemas[frozenIndex][scannedFrozenSchemaIndex] = schema;
			this.scannedFrozenValidationErrors[frozenIndex][scannedFrozenSchemaIndex] = [];
		} else {
			if (!data[this.validatedSchemasKey]) {
				try {
					Object.defineProperty(data, this.validatedSchemasKey, {
						value: [],
						configurable: true
					});
					Object.defineProperty(data, this.validationErrorsKey, {
						value: [],
						configurable: true
					});
				} catch (e) {
					//IE 7/8 workaround
					data[this.validatedSchemasKey] = [];
					data[this.validationErrorsKey] = [];
				}
			}
			scannedSchemasIndex = data[this.validatedSchemasKey].length;
			data[this.validatedSchemasKey][scannedSchemasIndex] = schema;
			data[this.validationErrorsKey][scannedSchemasIndex] = [];
		}
	}

	var errorCount = this.errors.length;
	var error = this.validateBasic(data, schema, dataPointerPath)
		|| this.validateNumeric(data, schema, dataPointerPath)
		|| this.validateString(data, schema, dataPointerPath)
		|| this.validateArray(data, schema, dataPointerPath)
		|| this.validateObject(data, schema, dataPointerPath)
		|| this.validateCombinations(data, schema, dataPointerPath)
		|| this.validateHypermedia(data, schema, dataPointerPath)
		|| this.validateFormat(data, schema, dataPointerPath)
		|| this.validateDefinedKeywords(data, schema, dataPointerPath)
		|| null;

	if (topLevel) {
		while (this.scanned.length) {
			var item = this.scanned.pop();
			delete item[this.validatedSchemasKey];
		}
		this.scannedFrozen = [];
		this.scannedFrozenSchemas = [];
	}

	if (error || errorCount !== this.errors.length) {
		while ((dataPathParts && dataPathParts.length) || (schemaPathParts && schemaPathParts.length)) {
			var dataPart = (dataPathParts && dataPathParts.length) ? "" + dataPathParts.pop() : null;
			var schemaPart = (schemaPathParts && schemaPathParts.length) ? "" + schemaPathParts.pop() : null;
			if (error) {
				error = error.prefixWith(dataPart, schemaPart);
			}
			this.prefixErrors(errorCount, dataPart, schemaPart);
		}
	}

	if (scannedFrozenSchemaIndex !== null) {
		this.scannedFrozenValidationErrors[frozenIndex][scannedFrozenSchemaIndex] = this.errors.slice(startErrorCount);
	} else if (scannedSchemasIndex !== null) {
		data[this.validationErrorsKey][scannedSchemasIndex] = this.errors.slice(startErrorCount);
	}

	return this.handleError(error);
};
ValidatorContext.prototype.validateFormat = function (data, schema) {
	if (typeof schema.format !== 'string' || !this.formatValidators[schema.format]) {
		return null;
	}
	var errorMessage = this.formatValidators[schema.format].call(null, data, schema);
	if (typeof errorMessage === 'string' || typeof errorMessage === 'number') {
		return this.createError(ErrorCodes.FORMAT_CUSTOM, {message: errorMessage}, '', '/format', null, data, schema);
	} else if (errorMessage && typeof errorMessage === 'object') {
		return this.createError(ErrorCodes.FORMAT_CUSTOM, {message: errorMessage.message || "?"}, errorMessage.dataPath || '', errorMessage.schemaPath || "/format", null, data, schema);
	}
	return null;
};
ValidatorContext.prototype.validateDefinedKeywords = function (data, schema, dataPointerPath) {
	for (var key in this.definedKeywords) {
		if (typeof schema[key] === 'undefined') {
			continue;
		}
		var validationFunctions = this.definedKeywords[key];
		for (var i = 0; i < validationFunctions.length; i++) {
			var func = validationFunctions[i];
			var result = func(data, schema[key], schema, dataPointerPath);
			if (typeof result === 'string' || typeof result === 'number') {
				return this.createError(ErrorCodes.KEYWORD_CUSTOM, {key: key, message: result}, '', '', null, data, schema).prefixWith(null, key);
			} else if (result && typeof result === 'object') {
				var code = result.code;
				if (typeof code === 'string') {
					if (!ErrorCodes[code]) {
						throw new Error('Undefined error code (use defineError): ' + code);
					}
					code = ErrorCodes[code];
				} else if (typeof code !== 'number') {
					code = ErrorCodes.KEYWORD_CUSTOM;
				}
				var messageParams = (typeof result.message === 'object') ? result.message : {key: key, message: result.message || "?"};
				var schemaPath = result.schemaPath || ("/" + key.replace(/~/g, '~0').replace(/\//g, '~1'));
				return this.createError(code, messageParams, result.dataPath || null, schemaPath, null, data, schema);
			}
		}
	}
	return null;
};

function recursiveCompare(A, B) {
	if (A === B) {
		return true;
	}
	if (A && B && typeof A === "object" && typeof B === "object") {
		if (Array.isArray(A) !== Array.isArray(B)) {
			return false;
		} else if (Array.isArray(A)) {
			if (A.length !== B.length) {
				return false;
			}
			for (var i = 0; i < A.length; i++) {
				if (!recursiveCompare(A[i], B[i])) {
					return false;
				}
			}
		} else {
			var key;
			for (key in A) {
				if (B[key] === undefined && A[key] !== undefined) {
					return false;
				}
			}
			for (key in B) {
				if (A[key] === undefined && B[key] !== undefined) {
					return false;
				}
			}
			for (key in A) {
				if (!recursiveCompare(A[key], B[key])) {
					return false;
				}
			}
		}
		return true;
	}
	return false;
}

ValidatorContext.prototype.validateBasic = function validateBasic(data, schema, dataPointerPath) {
	var error;
	if (error = this.validateType(data, schema, dataPointerPath)) {
		return error.prefixWith(null, "type");
	}
	if (error = this.validateEnum(data, schema, dataPointerPath)) {
		return error.prefixWith(null, "type");
	}
	return null;
};

ValidatorContext.prototype.validateType = function validateType(data, schema) {
	if (schema.type === undefined) {
		return null;
	}
	var dataType = typeof data;
	if (data === null) {
		dataType = "null";
	} else if (Array.isArray(data)) {
		dataType = "array";
	}
	var allowedTypes = schema.type;
	if (!Array.isArray(allowedTypes)) {
		allowedTypes = [allowedTypes];
	}

	for (var i = 0; i < allowedTypes.length; i++) {
		var type = allowedTypes[i];
		if (type === dataType || (type === "integer" && dataType === "number" && (data % 1 === 0))) {
			return null;
		}
	}
	return this.createError(ErrorCodes.INVALID_TYPE, {type: dataType, expected: allowedTypes.join("/")}, '', '', null, data, schema);
};

ValidatorContext.prototype.validateEnum = function validateEnum(data, schema) {
	if (schema["enum"] === undefined) {
		return null;
	}
	for (var i = 0; i < schema["enum"].length; i++) {
		var enumVal = schema["enum"][i];
		if (recursiveCompare(data, enumVal)) {
			return null;
		}
	}
	return this.createError(ErrorCodes.ENUM_MISMATCH, {value: (typeof JSON !== 'undefined') ? JSON.stringify(data) : data}, '', '', null, data, schema);
};

ValidatorContext.prototype.validateNumeric = function validateNumeric(data, schema, dataPointerPath) {
	return this.validateMultipleOf(data, schema, dataPointerPath)
		|| this.validateMinMax(data, schema, dataPointerPath)
		|| this.validateNaN(data, schema, dataPointerPath)
		|| null;
};

var CLOSE_ENOUGH_LOW = Math.pow(2, -51);
var CLOSE_ENOUGH_HIGH = 1 - CLOSE_ENOUGH_LOW;
ValidatorContext.prototype.validateMultipleOf = function validateMultipleOf(data, schema) {
	var multipleOf = schema.multipleOf || schema.divisibleBy;
	if (multipleOf === undefined) {
		return null;
	}
	if (typeof data === "number") {
		var remainder = (data/multipleOf)%1;
		if (remainder >= CLOSE_ENOUGH_LOW && remainder < CLOSE_ENOUGH_HIGH) {
			return this.createError(ErrorCodes.NUMBER_MULTIPLE_OF, {value: data, multipleOf: multipleOf}, '', '', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateMinMax = function validateMinMax(data, schema) {
	if (typeof data !== "number") {
		return null;
	}
	if (schema.minimum !== undefined) {
		if (data < schema.minimum) {
			return this.createError(ErrorCodes.NUMBER_MINIMUM, {value: data, minimum: schema.minimum}, '', '/minimum', null, data, schema);
		}
		if (schema.exclusiveMinimum && data === schema.minimum) {
			return this.createError(ErrorCodes.NUMBER_MINIMUM_EXCLUSIVE, {value: data, minimum: schema.minimum}, '', '/exclusiveMinimum', null, data, schema);
		}
	}
	if (schema.maximum !== undefined) {
		if (data > schema.maximum) {
			return this.createError(ErrorCodes.NUMBER_MAXIMUM, {value: data, maximum: schema.maximum}, '', '/maximum', null, data, schema);
		}
		if (schema.exclusiveMaximum && data === schema.maximum) {
			return this.createError(ErrorCodes.NUMBER_MAXIMUM_EXCLUSIVE, {value: data, maximum: schema.maximum}, '', '/exclusiveMaximum', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateNaN = function validateNaN(data, schema) {
	if (typeof data !== "number") {
		return null;
	}
	if (isNaN(data) === true || data === Infinity || data === -Infinity) {
		return this.createError(ErrorCodes.NUMBER_NOT_A_NUMBER, {value: data}, '', '/type', null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateString = function validateString(data, schema, dataPointerPath) {
	return this.validateStringLength(data, schema, dataPointerPath)
		|| this.validateStringPattern(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateStringLength = function validateStringLength(data, schema) {
	if (typeof data !== "string") {
		return null;
	}
	if (schema.minLength !== undefined) {
		if (data.length < schema.minLength) {
			return this.createError(ErrorCodes.STRING_LENGTH_SHORT, {length: data.length, minimum: schema.minLength}, '', '/minLength', null, data, schema);
		}
	}
	if (schema.maxLength !== undefined) {
		if (data.length > schema.maxLength) {
			return this.createError(ErrorCodes.STRING_LENGTH_LONG, {length: data.length, maximum: schema.maxLength}, '', '/maxLength', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateStringPattern = function validateStringPattern(data, schema) {
	if (typeof data !== "string" || (typeof schema.pattern !== "string" && !(schema.pattern instanceof RegExp))) {
		return null;
	}
	var regexp;
	if (schema.pattern instanceof RegExp) {
	  regexp = schema.pattern;
	}
	else {
	  var body, flags = '';
	  // Check for regular expression literals
	  // @see http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.5
	  var literal = schema.pattern.match(/^\/(.+)\/([img]*)$/);
	  if (literal) {
	    body = literal[1];
	    flags = literal[2];
	  }
	  else {
	    body = schema.pattern;
	  }
	  regexp = new RegExp(body, flags);
	}
	if (!regexp.test(data)) {
		return this.createError(ErrorCodes.STRING_PATTERN, {pattern: schema.pattern}, '', '/pattern', null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateArray = function validateArray(data, schema, dataPointerPath) {
	if (!Array.isArray(data)) {
		return null;
	}
	return this.validateArrayLength(data, schema, dataPointerPath)
		|| this.validateArrayUniqueItems(data, schema, dataPointerPath)
		|| this.validateArrayItems(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateArrayLength = function validateArrayLength(data, schema) {
	var error;
	if (schema.minItems !== undefined) {
		if (data.length < schema.minItems) {
			error = this.createError(ErrorCodes.ARRAY_LENGTH_SHORT, {length: data.length, minimum: schema.minItems}, '', '/minItems', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxItems !== undefined) {
		if (data.length > schema.maxItems) {
			error = this.createError(ErrorCodes.ARRAY_LENGTH_LONG, {length: data.length, maximum: schema.maxItems}, '', '/maxItems', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateArrayUniqueItems = function validateArrayUniqueItems(data, schema) {
	if (schema.uniqueItems) {
		for (var i = 0; i < data.length; i++) {
			for (var j = i + 1; j < data.length; j++) {
				if (recursiveCompare(data[i], data[j])) {
					var error = this.createError(ErrorCodes.ARRAY_UNIQUE, {match1: i, match2: j}, '', '/uniqueItems', null, data, schema);
					if (this.handleError(error)) {
						return error;
					}
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateArrayItems = function validateArrayItems(data, schema, dataPointerPath) {
	if (schema.items === undefined) {
		return null;
	}
	var error, i;
	if (Array.isArray(schema.items)) {
		for (i = 0; i < data.length; i++) {
			if (i < schema.items.length) {
				if (error = this.validateAll(data[i], schema.items[i], [i], ["items", i], dataPointerPath + "/" + i)) {
					return error;
				}
			} else if (schema.additionalItems !== undefined) {
				if (typeof schema.additionalItems === "boolean") {
					if (!schema.additionalItems) {
						error = (this.createError(ErrorCodes.ARRAY_ADDITIONAL_ITEMS, {}, '/' + i, '/additionalItems', null, data, schema));
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (error = this.validateAll(data[i], schema.additionalItems, [i], ["additionalItems"], dataPointerPath + "/" + i)) {
					return error;
				}
			}
		}
	} else {
		for (i = 0; i < data.length; i++) {
			if (error = this.validateAll(data[i], schema.items, [i], ["items"], dataPointerPath + "/" + i)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObject = function validateObject(data, schema, dataPointerPath) {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return null;
	}
	return this.validateObjectMinMaxProperties(data, schema, dataPointerPath)
		|| this.validateObjectRequiredProperties(data, schema, dataPointerPath)
		|| this.validateObjectProperties(data, schema, dataPointerPath)
		|| this.validateObjectDependencies(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateObjectMinMaxProperties = function validateObjectMinMaxProperties(data, schema) {
	var keys = Object.keys(data);
	var error;
	if (schema.minProperties !== undefined) {
		if (keys.length < schema.minProperties) {
			error = this.createError(ErrorCodes.OBJECT_PROPERTIES_MINIMUM, {propertyCount: keys.length, minimum: schema.minProperties}, '', '/minProperties', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxProperties !== undefined) {
		if (keys.length > schema.maxProperties) {
			error = this.createError(ErrorCodes.OBJECT_PROPERTIES_MAXIMUM, {propertyCount: keys.length, maximum: schema.maxProperties}, '', '/maxProperties', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectRequiredProperties = function validateObjectRequiredProperties(data, schema) {
	if (schema.required !== undefined) {
		for (var i = 0; i < schema.required.length; i++) {
			var key = schema.required[i];
			if (data[key] === undefined) {
				var error = this.createError(ErrorCodes.OBJECT_REQUIRED, {key: key}, '', '/required/' + i, null, data, schema);
				if (this.handleError(error)) {
					return error;
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectProperties = function validateObjectProperties(data, schema, dataPointerPath) {
	var error;
	for (var key in data) {
		var keyPointerPath = dataPointerPath + "/" + key.replace(/~/g, '~0').replace(/\//g, '~1');
		var foundMatch = false;
		if (schema.properties !== undefined && schema.properties[key] !== undefined) {
			foundMatch = true;
			if (error = this.validateAll(data[key], schema.properties[key], [key], ["properties", key], keyPointerPath)) {
				return error;
			}
		}
		if (schema.patternProperties !== undefined) {
			for (var patternKey in schema.patternProperties) {
				var regexp = new RegExp(patternKey);
				if (regexp.test(key)) {
					foundMatch = true;
					if (error = this.validateAll(data[key], schema.patternProperties[patternKey], [key], ["patternProperties", patternKey], keyPointerPath)) {
						return error;
					}
				}
			}
		}
		if (!foundMatch) {
			if (schema.additionalProperties !== undefined) {
				if (this.trackUnknownProperties) {
					this.knownPropertyPaths[keyPointerPath] = true;
					delete this.unknownPropertyPaths[keyPointerPath];
				}
				if (typeof schema.additionalProperties === "boolean") {
					if (!schema.additionalProperties) {
						error = this.createError(ErrorCodes.OBJECT_ADDITIONAL_PROPERTIES, {key: key}, '', '/additionalProperties', null, data, schema).prefixWith(key, null);
						if (this.handleError(error)) {
							return error;
						}
					}
				} else {
					if (error = this.validateAll(data[key], schema.additionalProperties, [key], ["additionalProperties"], keyPointerPath)) {
						return error;
					}
				}
			} else if (this.trackUnknownProperties && !this.knownPropertyPaths[keyPointerPath]) {
				this.unknownPropertyPaths[keyPointerPath] = true;
			}
		} else if (this.trackUnknownProperties) {
			this.knownPropertyPaths[keyPointerPath] = true;
			delete this.unknownPropertyPaths[keyPointerPath];
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectDependencies = function validateObjectDependencies(data, schema, dataPointerPath) {
	var error;
	if (schema.dependencies !== undefined) {
		for (var depKey in schema.dependencies) {
			if (data[depKey] !== undefined) {
				var dep = schema.dependencies[depKey];
				if (typeof dep === "string") {
					if (data[dep] === undefined) {
						error = this.createError(ErrorCodes.OBJECT_DEPENDENCY_KEY, {key: depKey, missing: dep}, '', '', null, data, schema).prefixWith(null, depKey).prefixWith(null, "dependencies");
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (Array.isArray(dep)) {
					for (var i = 0; i < dep.length; i++) {
						var requiredKey = dep[i];
						if (data[requiredKey] === undefined) {
							error = this.createError(ErrorCodes.OBJECT_DEPENDENCY_KEY, {key: depKey, missing: requiredKey}, '', '/' + i, null, data, schema).prefixWith(null, depKey).prefixWith(null, "dependencies");
							if (this.handleError(error)) {
								return error;
							}
						}
					}
				} else {
					if (error = this.validateAll(data, dep, [], ["dependencies", depKey], dataPointerPath)) {
						return error;
					}
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateCombinations = function validateCombinations(data, schema, dataPointerPath) {
	return this.validateAllOf(data, schema, dataPointerPath)
		|| this.validateAnyOf(data, schema, dataPointerPath)
		|| this.validateOneOf(data, schema, dataPointerPath)
		|| this.validateNot(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateAllOf = function validateAllOf(data, schema, dataPointerPath) {
	if (schema.allOf === undefined) {
		return null;
	}
	var error;
	for (var i = 0; i < schema.allOf.length; i++) {
		var subSchema = schema.allOf[i];
		if (error = this.validateAll(data, subSchema, [], ["allOf", i], dataPointerPath)) {
			return error;
		}
	}
	return null;
};

ValidatorContext.prototype.validateAnyOf = function validateAnyOf(data, schema, dataPointerPath) {
	if (schema.anyOf === undefined) {
		return null;
	}
	var errors = [];
	var startErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
	}
	var errorAtEnd = true;
	for (var i = 0; i < schema.anyOf.length; i++) {
		if (this.trackUnknownProperties) {
			this.unknownPropertyPaths = {};
			this.knownPropertyPaths = {};
		}
		var subSchema = schema.anyOf[i];

		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["anyOf", i], dataPointerPath);

		if (error === null && errorCount === this.errors.length) {
			this.errors = this.errors.slice(0, startErrorCount);

			if (this.trackUnknownProperties) {
				for (var knownKey in this.knownPropertyPaths) {
					oldKnownPropertyPaths[knownKey] = true;
					delete oldUnknownPropertyPaths[knownKey];
				}
				for (var unknownKey in this.unknownPropertyPaths) {
					if (!oldKnownPropertyPaths[unknownKey]) {
						oldUnknownPropertyPaths[unknownKey] = true;
					}
				}
				// We need to continue looping so we catch all the property definitions, but we don't want to return an error
				errorAtEnd = false;
				continue;
			}

			return null;
		}
		if (error) {
			errors.push(error.prefixWith(null, "" + i).prefixWith(null, "anyOf"));
		}
	}
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (errorAtEnd) {
		errors = errors.concat(this.errors.slice(startErrorCount));
		this.errors = this.errors.slice(0, startErrorCount);
		return this.createError(ErrorCodes.ANY_OF_MISSING, {}, "", "/anyOf", errors, data, schema);
	}
};

ValidatorContext.prototype.validateOneOf = function validateOneOf(data, schema, dataPointerPath) {
	if (schema.oneOf === undefined) {
		return null;
	}
	var validIndex = null;
	var errors = [];
	var startErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
	}
	for (var i = 0; i < schema.oneOf.length; i++) {
		if (this.trackUnknownProperties) {
			this.unknownPropertyPaths = {};
			this.knownPropertyPaths = {};
		}
		var subSchema = schema.oneOf[i];

		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["oneOf", i], dataPointerPath);

		if (error === null && errorCount === this.errors.length) {
			if (validIndex === null) {
				validIndex = i;
			} else {
				this.errors = this.errors.slice(0, startErrorCount);
				return this.createError(ErrorCodes.ONE_OF_MULTIPLE, {index1: validIndex, index2: i}, "", "/oneOf", null, data, schema);
			}
			if (this.trackUnknownProperties) {
				for (var knownKey in this.knownPropertyPaths) {
					oldKnownPropertyPaths[knownKey] = true;
					delete oldUnknownPropertyPaths[knownKey];
				}
				for (var unknownKey in this.unknownPropertyPaths) {
					if (!oldKnownPropertyPaths[unknownKey]) {
						oldUnknownPropertyPaths[unknownKey] = true;
					}
				}
			}
		} else if (error) {
			errors.push(error);
		}
	}
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (validIndex === null) {
		errors = errors.concat(this.errors.slice(startErrorCount));
		this.errors = this.errors.slice(0, startErrorCount);
		return this.createError(ErrorCodes.ONE_OF_MISSING, {}, "", "/oneOf", errors, data, schema);
	} else {
		this.errors = this.errors.slice(0, startErrorCount);
	}
	return null;
};

ValidatorContext.prototype.validateNot = function validateNot(data, schema, dataPointerPath) {
	if (schema.not === undefined) {
		return null;
	}
	var oldErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
		this.unknownPropertyPaths = {};
		this.knownPropertyPaths = {};
	}
	var error = this.validateAll(data, schema.not, null, null, dataPointerPath);
	var notErrors = this.errors.slice(oldErrorCount);
	this.errors = this.errors.slice(0, oldErrorCount);
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (error === null && notErrors.length === 0) {
		return this.createError(ErrorCodes.NOT_PASSED, {}, "", "/not", null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateHypermedia = function validateCombinations(data, schema, dataPointerPath) {
	if (!schema.links) {
		return null;
	}
	var error;
	for (var i = 0; i < schema.links.length; i++) {
		var ldo = schema.links[i];
		if (ldo.rel === "describedby") {
			var template = new UriTemplate(ldo.href);
			var allPresent = true;
			for (var j = 0; j < template.varNames.length; j++) {
				if (!(template.varNames[j] in data)) {
					allPresent = false;
					break;
				}
			}
			if (allPresent) {
				var schemaUrl = template.fillFromObject(data);
				var subSchema = {"$ref": schemaUrl};
				if (error = this.validateAll(data, subSchema, [], ["links", i], dataPointerPath)) {
					return error;
				}
			}
		}
	}
};

// parseURI() and resolveUrl() are from https://gist.github.com/1088850
//   -  released as public domain by author ("Yaffle") - see comments on gist

function parseURI(url) {
	var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
	// authority = '//' + user + ':' + pass '@' + hostname + ':' port
	return (m ? {
		href     : m[0] || '',
		protocol : m[1] || '',
		authority: m[2] || '',
		host     : m[3] || '',
		hostname : m[4] || '',
		port     : m[5] || '',
		pathname : m[6] || '',
		search   : m[7] || '',
		hash     : m[8] || ''
	} : null);
}

function resolveUrl(base, href) {// RFC 3986

	function removeDotSegments(input) {
		var output = [];
		input.replace(/^(\.\.?(\/|$))+/, '')
			.replace(/\/(\.(\/|$))+/g, '/')
			.replace(/\/\.\.$/, '/../')
			.replace(/\/?[^\/]*/g, function (p) {
				if (p === '/..') {
					output.pop();
				} else {
					output.push(p);
				}
		});
		return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
	}

	href = parseURI(href || '');
	base = parseURI(base || '');

	return !href || !base ? null : (href.protocol || base.protocol) +
		(href.protocol || href.authority ? href.authority : base.authority) +
		removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
		(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
		href.hash;
}

function getDocumentUri(uri) {
	return uri.split('#')[0];
}
function normSchema(schema, baseUri) {
	if (schema && typeof schema === "object") {
		if (baseUri === undefined) {
			baseUri = schema.id;
		} else if (typeof schema.id === "string") {
			baseUri = resolveUrl(baseUri, schema.id);
			schema.id = baseUri;
		}
		if (Array.isArray(schema)) {
			for (var i = 0; i < schema.length; i++) {
				normSchema(schema[i], baseUri);
			}
		} else {
			if (typeof schema['$ref'] === "string") {
				schema['$ref'] = resolveUrl(baseUri, schema['$ref']);
			}
			for (var key in schema) {
				if (key !== "enum") {
					normSchema(schema[key], baseUri);
				}
			}
		}
	}
}

function defaultErrorReporter(language) {
	language = language || 'en';

	var errorMessages = languages[language];

	return function (error) {
		var messageTemplate = errorMessages[error.code] || ErrorMessagesDefault[error.code];
		if (typeof messageTemplate !== 'string') {
			return "Unknown error code " + error.code + ": " + JSON.stringify(error.messageParams);
		}
		var messageParams = error.params;
		// Adapted from Crockford's supplant()
		return messageTemplate.replace(/\{([^{}]*)\}/g, function (whole, varName) {
			var subValue = messageParams[varName];
			return typeof subValue === 'string' || typeof subValue === 'number' ? subValue : whole;
		});
	};
}

var ErrorCodes = {
	INVALID_TYPE: 0,
	ENUM_MISMATCH: 1,
	ANY_OF_MISSING: 10,
	ONE_OF_MISSING: 11,
	ONE_OF_MULTIPLE: 12,
	NOT_PASSED: 13,
	// Numeric errors
	NUMBER_MULTIPLE_OF: 100,
	NUMBER_MINIMUM: 101,
	NUMBER_MINIMUM_EXCLUSIVE: 102,
	NUMBER_MAXIMUM: 103,
	NUMBER_MAXIMUM_EXCLUSIVE: 104,
	NUMBER_NOT_A_NUMBER: 105,
	// String errors
	STRING_LENGTH_SHORT: 200,
	STRING_LENGTH_LONG: 201,
	STRING_PATTERN: 202,
	// Object errors
	OBJECT_PROPERTIES_MINIMUM: 300,
	OBJECT_PROPERTIES_MAXIMUM: 301,
	OBJECT_REQUIRED: 302,
	OBJECT_ADDITIONAL_PROPERTIES: 303,
	OBJECT_DEPENDENCY_KEY: 304,
	// Array errors
	ARRAY_LENGTH_SHORT: 400,
	ARRAY_LENGTH_LONG: 401,
	ARRAY_UNIQUE: 402,
	ARRAY_ADDITIONAL_ITEMS: 403,
	// Custom/user-defined errors
	FORMAT_CUSTOM: 500,
	KEYWORD_CUSTOM: 501,
	// Schema structure
	CIRCULAR_REFERENCE: 600,
	// Non-standard validation options
	UNKNOWN_PROPERTY: 1000
};
var ErrorCodeLookup = {};
for (var key in ErrorCodes) {
	ErrorCodeLookup[ErrorCodes[key]] = key;
}
var ErrorMessagesDefault = {
	INVALID_TYPE: "Invalid type: {type} (expected {expected})",
	ENUM_MISMATCH: "No enum match for: {value}",
	ANY_OF_MISSING: "Data does not match any schemas from \"anyOf\"",
	ONE_OF_MISSING: "Data does not match any schemas from \"oneOf\"",
	ONE_OF_MULTIPLE: "Data is valid against more than one schema from \"oneOf\": indices {index1} and {index2}",
	NOT_PASSED: "Data matches schema from \"not\"",
	// Numeric errors
	NUMBER_MULTIPLE_OF: "Value {value} is not a multiple of {multipleOf}",
	NUMBER_MINIMUM: "Value {value} is less than minimum {minimum}",
	NUMBER_MINIMUM_EXCLUSIVE: "Value {value} is equal to exclusive minimum {minimum}",
	NUMBER_MAXIMUM: "Value {value} is greater than maximum {maximum}",
	NUMBER_MAXIMUM_EXCLUSIVE: "Value {value} is equal to exclusive maximum {maximum}",
	NUMBER_NOT_A_NUMBER: "Value {value} is not a valid number",
	// String errors
	STRING_LENGTH_SHORT: "String is too short ({length} chars), minimum {minimum}",
	STRING_LENGTH_LONG: "String is too long ({length} chars), maximum {maximum}",
	STRING_PATTERN: "String does not match pattern: {pattern}",
	// Object errors
	OBJECT_PROPERTIES_MINIMUM: "Too few properties defined ({propertyCount}), minimum {minimum}",
	OBJECT_PROPERTIES_MAXIMUM: "Too many properties defined ({propertyCount}), maximum {maximum}",
	OBJECT_REQUIRED: "Missing required property: {key}",
	OBJECT_ADDITIONAL_PROPERTIES: "Additional properties not allowed",
	OBJECT_DEPENDENCY_KEY: "Dependency failed - key must exist: {missing} (due to key: {key})",
	// Array errors
	ARRAY_LENGTH_SHORT: "Array is too short ({length}), minimum {minimum}",
	ARRAY_LENGTH_LONG: "Array is too long ({length}), maximum {maximum}",
	ARRAY_UNIQUE: "Array items are not unique (indices {match1} and {match2})",
	ARRAY_ADDITIONAL_ITEMS: "Additional items not allowed",
	// Format errors
	FORMAT_CUSTOM: "Format validation failed ({message})",
	KEYWORD_CUSTOM: "Keyword failed: {key} ({message})",
	// Schema structure
	CIRCULAR_REFERENCE: "Circular $refs: {urls}",
	// Non-standard validation options
	UNKNOWN_PROPERTY: "Unknown property (not in schema)"
};

function ValidationError(code, params, dataPath, schemaPath, subErrors) {
	Error.call(this);
	if (code === undefined) {
		throw new Error ("No error code supplied: " + schemaPath);
	}
	this.message = '';
	this.params = params;
	this.code = code;
	this.dataPath = dataPath || "";
	this.schemaPath = schemaPath || "";
	this.subErrors = subErrors || null;

	var err = new Error(this.message);
	this.stack = err.stack || err.stacktrace;
	if (!this.stack) {
		try {
			throw err;
		}
		catch(err) {
			this.stack = err.stack || err.stacktrace;
		}
	}
}
ValidationError.prototype = Object.create(Error.prototype);
ValidationError.prototype.constructor = ValidationError;
ValidationError.prototype.name = 'ValidationError';

ValidationError.prototype.prefixWith = function (dataPrefix, schemaPrefix) {
	if (dataPrefix !== null) {
		dataPrefix = dataPrefix.replace(/~/g, "~0").replace(/\//g, "~1");
		this.dataPath = "/" + dataPrefix + this.dataPath;
	}
	if (schemaPrefix !== null) {
		schemaPrefix = schemaPrefix.replace(/~/g, "~0").replace(/\//g, "~1");
		this.schemaPath = "/" + schemaPrefix + this.schemaPath;
	}
	if (this.subErrors !== null) {
		for (var i = 0; i < this.subErrors.length; i++) {
			this.subErrors[i].prefixWith(dataPrefix, schemaPrefix);
		}
	}
	return this;
};

function isTrustedUrl(baseUrl, testUrl) {
	if(testUrl.substring(0, baseUrl.length) === baseUrl){
		var remainder = testUrl.substring(baseUrl.length);
		if ((testUrl.length > 0 && testUrl.charAt(baseUrl.length - 1) === "/")
			|| remainder.charAt(0) === "#"
			|| remainder.charAt(0) === "?") {
			return true;
		}
	}
	return false;
}

var languages = {};
function createApi(language) {
	var globalContext = new ValidatorContext();
	var currentLanguage;
	var customErrorReporter;
	var api = {
		setErrorReporter: function (reporter) {
			if (typeof reporter === 'string') {
				return this.language(reporter);
			}
			customErrorReporter = reporter;
			return true;
		},
		addFormat: function () {
			globalContext.addFormat.apply(globalContext, arguments);
		},
		language: function (code) {
			if (!code) {
				return currentLanguage;
			}
			if (!languages[code]) {
				code = code.split('-')[0]; // fall back to base language
			}
			if (languages[code]) {
				currentLanguage = code;
				return code; // so you can tell if fall-back has happened
			}
			return false;
		},
		addLanguage: function (code, messageMap) {
			var key;
			for (key in ErrorCodes) {
				if (messageMap[key] && !messageMap[ErrorCodes[key]]) {
					messageMap[ErrorCodes[key]] = messageMap[key];
				}
			}
			var rootCode = code.split('-')[0];
			if (!languages[rootCode]) { // use for base language if not yet defined
				languages[code] = messageMap;
				languages[rootCode] = messageMap;
			} else {
				languages[code] = Object.create(languages[rootCode]);
				for (key in messageMap) {
					if (typeof languages[rootCode][key] === 'undefined') {
						languages[rootCode][key] = messageMap[key];
					}
					languages[code][key] = messageMap[key];
				}
			}
			return this;
		},
		freshApi: function (language) {
			var result = createApi();
			if (language) {
				result.language(language);
			}
			return result;
		},
		validate: function (data, schema, checkRecursive, banUnknownProperties) {
			var def = defaultErrorReporter(currentLanguage);
			var errorReporter = customErrorReporter ? function (error, data, schema) {
				return customErrorReporter(error, data, schema) || def(error, data, schema);
			} : def;
			var context = new ValidatorContext(globalContext, false, errorReporter, checkRecursive, banUnknownProperties);
			if (typeof schema === "string") {
				schema = {"$ref": schema};
			}
			context.addSchema("", schema);
			var error = context.validateAll(data, schema, null, null, "");
			if (!error && banUnknownProperties) {
				error = context.banUnknownProperties(data, schema);
			}
			this.error = error;
			this.missing = context.missing;
			this.valid = (error === null);
			return this.valid;
		},
		validateResult: function () {
			var result = {toString: function () {
				return this.valid ? 'valid' : this.error.message;
			}};
			this.validate.apply(result, arguments);
			return result;
		},
		validateMultiple: function (data, schema, checkRecursive, banUnknownProperties) {
			var def = defaultErrorReporter(currentLanguage);
			var errorReporter = customErrorReporter ? function (error, data, schema) {
				return customErrorReporter(error, data, schema) || def(error, data, schema);
			} : def;
			var context = new ValidatorContext(globalContext, true, errorReporter, checkRecursive, banUnknownProperties);
			if (typeof schema === "string") {
				schema = {"$ref": schema};
			}
			context.addSchema("", schema);
			context.validateAll(data, schema, null, null, "");
			if (banUnknownProperties) {
				context.banUnknownProperties(data, schema);
			}
			var result = {toString: function () {
				return this.valid ? 'valid' : this.error.message;
			}};
			result.errors = context.errors;
			result.missing = context.missing;
			result.valid = (result.errors.length === 0);
			return result;
		},
		addSchema: function () {
			return globalContext.addSchema.apply(globalContext, arguments);
		},
		getSchema: function () {
			return globalContext.getSchema.apply(globalContext, arguments);
		},
		getSchemaMap: function () {
			return globalContext.getSchemaMap.apply(globalContext, arguments);
		},
		getSchemaUris: function () {
			return globalContext.getSchemaUris.apply(globalContext, arguments);
		},
		getMissingUris: function () {
			return globalContext.getMissingUris.apply(globalContext, arguments);
		},
		dropSchemas: function () {
			globalContext.dropSchemas.apply(globalContext, arguments);
		},
		defineKeyword: function () {
			globalContext.defineKeyword.apply(globalContext, arguments);
		},
		defineError: function (codeName, codeNumber, defaultMessage) {
			if (typeof codeName !== 'string' || !/^[A-Z]+(_[A-Z]+)*$/.test(codeName)) {
				throw new Error('Code name must be a string in UPPER_CASE_WITH_UNDERSCORES');
			}
			if (typeof codeNumber !== 'number' || codeNumber%1 !== 0 || codeNumber < 10000) {
				throw new Error('Code number must be an integer > 10000');
			}
			if (typeof ErrorCodes[codeName] !== 'undefined') {
				throw new Error('Error already defined: ' + codeName + ' as ' + ErrorCodes[codeName]);
			}
			if (typeof ErrorCodeLookup[codeNumber] !== 'undefined') {
				throw new Error('Error code already used: ' + ErrorCodeLookup[codeNumber] + ' as ' + codeNumber);
			}
			ErrorCodes[codeName] = codeNumber;
			ErrorCodeLookup[codeNumber] = codeName;
			ErrorMessagesDefault[codeName] = ErrorMessagesDefault[codeNumber] = defaultMessage;
			for (var langCode in languages) {
				var language = languages[langCode];
				if (language[codeName]) {
					language[codeNumber] = language[codeNumber] || language[codeName];
				}
			}
		},
		reset: function () {
			globalContext.reset();
			this.error = null;
			this.missing = [];
			this.valid = true;
		},
		missing: [],
		error: null,
		valid: true,
		normSchema: normSchema,
		resolveUrl: resolveUrl,
		getDocumentUri: getDocumentUri,
		errorCodes: ErrorCodes
	};
	api.language(language || 'en');
	return api;
}

var tv4 = createApi();
tv4.addLanguage('en-gb', ErrorMessagesDefault);

//legacy property
tv4.tv4 = tv4;

return tv4; // used by _header.js to globalise.

}));

/***/ }),

/***/ "./node_modules/webfinger.js/dist/webfinger.cjs":
/*!******************************************************!*\
  !*** ./node_modules/webfinger.js/dist/webfinger.cjs ***!
  \******************************************************/
/***/ (function(module) {

(function (root, factory) {
  if (true) {
    // CommonJS/Node.js environment
    const result = factory();
    module.exports = result;
    module.exports["default"] = result;
  } else // removed by dead control flow
{}
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';
// webfinger.js v3.0.4

// src/webfinger.ts
/*!
 * webfinger.js
 *   http://github.com/silverbucket/webfinger.js
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net>
 *
 * webfinger.js is released under the MIT License (see LICENSE).
 *
 * You are free to use, modify, and distribute this software under the terms
 * of the MIT License. All copyright information must remain.
 *
 */
var LINK_URI_MAPS = {
  "http://webfinger.net/rel/avatar": "avatar",
  remotestorage: "remotestorage",
  "http://tools.ietf.org/id/draft-dejong-remotestorage": "remotestorage",
  remoteStorage: "remotestorage",
  "http://www.packetizer.com/rel/share": "share",
  "http://webfinger.net/rel/profile-page": "profile",
  me: "profile",
  vcard: "vcard",
  blog: "blog",
  "http://packetizer.com/rel/blog": "blog",
  "http://schemas.google.com/g/2010#updates-from": "updates",
  "https://camlistore.org/rel/server": "camilstore"
};
var LINK_PROPERTIES = {
  avatar: [],
  remotestorage: [],
  blog: [],
  vcard: [],
  updates: [],
  share: [],
  profile: [],
  camlistore: []
};
var URIS = ["webfinger", "host-meta", "host-meta.json"];
var IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)";
var IPV4_REGEX = new RegExp(`^(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}$`);
var IPV4_CAPTURE_REGEX = new RegExp(`^(${IPV4_OCTET})\\.(${IPV4_OCTET})\\.(${IPV4_OCTET})\\.(${IPV4_OCTET})$`);
var LOCALHOST_REGEX = /^localhost(?:\.localdomain)?(?::\d+)?$/;
var NUMERIC_PORT_REGEX = /^\d+$/;
var HOSTNAME_REGEX = /^[a-zA-Z0-9.-]+$/;
var LOCALHOST_127_REGEX = /^127\.(?:\d{1,3}\.){2}\d{1,3}$/;

class WebFingerError extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.name = "WebFingerError";
    this.status = status;
  }
}

class WebFinger {
  static default;
  config;
  constructor(cfg = {}) {
    this.config = {
      tls_only: typeof cfg.tls_only !== "undefined" ? cfg.tls_only : true,
      uri_fallback: typeof cfg.uri_fallback !== "undefined" ? cfg.uri_fallback : false,
      request_timeout: typeof cfg.request_timeout !== "undefined" ? cfg.request_timeout : 1e4,
      allow_private_addresses: typeof cfg.allow_private_addresses !== "undefined" ? cfg.allow_private_addresses : false
    };
  }
  async fetchJRD(url, redirectCount = 0) {
    if (redirectCount > 3) {
      throw new WebFingerError("too many redirects");
    }
    const abortController = new AbortController;
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.request_timeout);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/jrd+json, application/json" },
        redirect: "manual",
        signal: abortController.signal
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new WebFingerError("redirect without location header");
        }
        let redirectUrl;
        try {
          redirectUrl = new URL(location, url);
        } catch {
          throw new WebFingerError("invalid redirect URL");
        }
        try {
          await this.resolveAndValidateHost(redirectUrl.host);
        } catch (err) {
          if (err instanceof WebFingerError) {
            throw new WebFingerError("redirect to private or internal address blocked");
          }
          throw err;
        }
        clearTimeout(timeoutId);
        return this.fetchJRD(redirectUrl.toString(), redirectCount + 1);
      }
      if (response.status === 404) {
        throw new WebFingerError("resource not found", 404);
      } else if (!response.ok) {
        throw new WebFingerError("error during request", response.status);
      }
      const contentType = response.headers.get("content-type") || "";
      const lowerContentType = contentType.toLowerCase();
      const mainType = lowerContentType.split(";")[0].trim();
      if (mainType === "application/jrd+json") {} else if (mainType === "application/json") {
        console.debug(`WebFinger: Server uses "application/json" instead of RFC 7033 recommended "application/jrd+json".`);
      } else {
        console.warn(`WebFinger: Server returned unexpected content-type "${contentType}". ` + 'Expected "application/jrd+json" per RFC 7033.');
      }
      const responseText = await response.text();
      if (WebFinger.isValidJSON(responseText)) {
        return responseText;
      } else {
        throw new WebFingerError("invalid json");
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new WebFingerError("request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  static isValidJSON(str) {
    try {
      JSON.parse(str);
    } catch {
      return false;
    }
    return true;
  }
  static isLocalhost(host) {
    return LOCALHOST_REGEX.test(host);
  }
  static isPrivateAddress(host) {
    let cleanHost = host;
    if (cleanHost.startsWith("[") && cleanHost.includes("]:")) {
      cleanHost = cleanHost.substring(1, cleanHost.lastIndexOf("]:"));
    } else if (cleanHost.startsWith("[") && cleanHost.endsWith("]")) {
      cleanHost = cleanHost.substring(1, cleanHost.length - 1);
    } else if (cleanHost.includes(":")) {
      const colonCount = (cleanHost.match(/:/g) || []).length;
      if (colonCount === 1) {
        const parts = cleanHost.split(":");
        const hostPart = parts[0];
        const portPart = parts[1];
        if (portPart && !NUMERIC_PORT_REGEX.test(portPart)) {
          throw new WebFingerError("invalid host format");
        }
        if (hostPart.match(IPV4_REGEX) || hostPart.match(HOSTNAME_REGEX)) {
          cleanHost = hostPart;
        }
      }
    }
    if (cleanHost === "localhost" || cleanHost === "127.0.0.1" || cleanHost.match(LOCALHOST_127_REGEX) || cleanHost === "::1" || cleanHost === "localhost.localdomain") {
      return true;
    }
    const ipv4Match = cleanHost.match(IPV4_CAPTURE_REGEX);
    if (ipv4Match) {
      const [, aStr, bStr, cStr, dStr] = ipv4Match;
      const a = Number(aStr);
      const b = Number(bStr);
      const c = Number(cStr);
      const d = Number(dStr);
      if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) {
        return true;
      }
      if (a === 10)
        return true;
      if (a === 172 && b >= 16 && b <= 31)
        return true;
      if (a === 192 && b === 168)
        return true;
      if (a === 169 && b === 254)
        return true;
      if (a >= 224 && a <= 239)
        return true;
      if (a >= 240)
        return true;
    }
    if (cleanHost.includes(":")) {
      const colonCount = (cleanHost.match(/:/g) || []).length;
      if (colonCount > 1 || colonCount === 1 && !cleanHost.match(/^[a-zA-Z0-9.-]+:\d+$/)) {
        if (cleanHost.match(/^(fc|fd)[0-9a-f]{2}:/i) || cleanHost.match(/^fe80:/i) || cleanHost.match(/^ff[0-9a-f]{2}:/i)) {
          return true;
        }
      }
    }
    return false;
  }
  static getExplicitPort(host) {
    if (host.startsWith("[")) {
      const ipv6PortSeparator = host.lastIndexOf("]:");
      if (ipv6PortSeparator !== -1) {
        const port = host.substring(ipv6PortSeparator + 2);
        if (!NUMERIC_PORT_REGEX.test(port)) {
          throw new WebFingerError("invalid host format");
        }
        return port;
      }
      return;
    }
    const colonCount = (host.match(/:/g) || []).length;
    if (colonCount === 1) {
      const [, port = ""] = host.split(":");
      if (!port || !NUMERIC_PORT_REGEX.test(port)) {
        throw new WebFingerError("invalid host format");
      }
      return port;
    }
    return;
  }
  static parseAddress(address) {
    const cleaned = address.replace(/ /g, "");
    if (cleaned.includes("://")) {
      let url;
      try {
        url = new URL(cleaned);
      } catch {
        throw new WebFingerError("invalid URI format");
      }
      if (!url.hostname) {
        throw new WebFingerError("could not determine host from address");
      }
      return { host: url.host };
    }
    const parts = cleaned.split("@");
    if (parts.length !== 2 || !parts[1]) {
      throw new WebFingerError("invalid useraddress format");
    }
    return { host: parts[1] };
  }
  async resolveAndValidateHost(rawHost) {
    const normalized = WebFinger.normalizeHost(rawHost);
    if (!this.config.allow_private_addresses) {
      if (WebFinger.isPrivateAddress(normalized.host)) {
        throw new WebFingerError("private or internal addresses are not allowed");
      }
      await this.validateDNSResolution(normalized.hostname);
    }
    return normalized;
  }
  static normalizeHost(host) {
    const hostParts = host.split("/");
    const cleanHost = hostParts[0];
    if (!cleanHost || cleanHost.length === 0) {
      throw new WebFingerError("invalid host format");
    }
    if (/[?# @]/.test(cleanHost)) {
      throw new WebFingerError("invalid characters in host");
    }
    const explicitPort = WebFinger.getExplicitPort(cleanHost);
    let parsedHost;
    try {
      parsedHost = new URL(`http://${cleanHost}`);
    } catch {
      throw new WebFingerError("invalid host format");
    }
    const hostname2 = parsedHost.hostname;
    const normalizedHost = explicitPort ? `${hostname2}:${explicitPort}` : parsedHost.host || hostname2;
    return {
      host: normalizedHost,
      hostname: hostname2
    };
  }
  static async processJRD(URL2, JRDstring) {
    const parsedJRD = JSON.parse(JRDstring);
    if (typeof parsedJRD !== "object" || typeof parsedJRD.links !== "object") {
      if (typeof parsedJRD.error !== "undefined") {
        throw new WebFingerError(parsedJRD.error);
      } else {
        throw new WebFingerError("unknown response from server");
      }
    }
    const result = {
      object: parsedJRD,
      idx: {
        properties: {
          name: undefined
        },
        links: JSON.parse(JSON.stringify(LINK_PROPERTIES))
      }
    };
    const links = Array.isArray(parsedJRD.links) ? parsedJRD.links : [];
    links.map(function(link) {
      if (Object.prototype.hasOwnProperty.call(LINK_URI_MAPS, String(link.rel))) {
        const mappedKey = LINK_URI_MAPS[String(link.rel)];
        if (result.idx.links[mappedKey]) {
          const entry = {
            href: String(link.href || ""),
            rel: String(link.rel || "")
          };
          Object.keys(link).map(function(item) {
            if (typeof link[item] === "object" && link[item] !== null) {
              entry[item] = link[item];
            } else {
              entry[item] = String(link[item]);
            }
          });
          result.idx.links[mappedKey].push(entry);
        }
      }
    });
    const props = parsedJRD.properties || {};
    for (const key in props) {
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        if (key === "http://packetizer.com/ns/name") {
          result.idx.properties.name = props[key];
        }
      }
    }
    return result;
  }
  async validateDNSResolution(hostname) {
    if (hostname.match(IPV4_REGEX) || hostname.includes(":") || hostname === "localhost") {
      return;
    }
    const isNodeJS = typeof process !== "undefined" && process.versions?.node;
    if (isNodeJS) {
      try {
        const dnsImport = eval('import("dns")');
        const dns = await dnsImport.then((m) => m.promises).catch(() => null);
        if (dns) {
          try {
            const [ipv4Results, ipv6Results] = await Promise.allSettled([
              dns.resolve4(hostname).catch(() => []),
              dns.resolve6(hostname).catch(() => [])
            ]);
            const ipv4Addresses = ipv4Results.status === "fulfilled" ? ipv4Results.value : [];
            const ipv6Addresses = ipv6Results.status === "fulfilled" ? ipv6Results.value : [];
            for (const ip of [...ipv4Addresses, ...ipv6Addresses]) {
              if (WebFinger.isPrivateAddress(ip)) {
                throw new WebFingerError(`hostname ${hostname} resolves to private address ${ip}`);
              }
            }
          } catch (error) {
            if (error instanceof WebFingerError) {
              throw error;
            }
          }
        }
      } catch (outerError) {
        if (outerError instanceof WebFingerError) {
          throw outerError;
        }
      }
    }
  }
  async lookup(address) {
    if (!address) {
      throw new WebFingerError("address is required");
    }
    const { host: rawHost } = WebFinger.parseAddress(address);
    const { host } = await this.resolveAndValidateHost(rawHost);
    let uri_index = 0;
    let protocol = "https";
    if (WebFinger.isLocalhost(host)) {
      protocol = "http";
    }
    const __buildURL = () => {
      let uri = "";
      if (!address.split("://")[1]) {
        uri = "acct:";
      }
      return protocol + "://" + host + "/.well-known/" + URIS[uri_index] + "?resource=" + uri + address;
    };
    const __fallbackChecks = async (err) => {
      if (this.config.uri_fallback && uri_index !== URIS.length - 1) {
        uri_index = uri_index + 1;
        return __call();
      } else if (!this.config.tls_only && protocol === "https") {
        uri_index = 0;
        protocol = "http";
        return __call();
      } else {
        throw err instanceof Error ? err : new WebFingerError(String(err));
      }
    };
    const __call = async () => {
      const URL2 = __buildURL();
      try {
        const JRD = await this.fetchJRD(URL2);
        return WebFinger.processJRD(URL2, JRD);
      } catch (err) {
        return await __fallbackChecks(err);
      }
    };
    return __call();
  }
  async lookupLink(address, rel) {
    if (Object.prototype.hasOwnProperty.call(LINK_PROPERTIES, rel)) {
      const p = await this.lookup(address);
      const links = p.idx.links[rel];
      if (links.length === 0) {
        return Promise.reject('no links found with rel="' + rel + '"');
      } else {
        return Promise.resolve(links[0]);
      }
    } else {
      return Promise.reject("unsupported rel " + rel);
    }
  }
}
WebFinger.default = WebFinger;

// Return the WebFinger class (defined above)
return WebFinger;

}));

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/global */
/******/ 	!function() {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	}();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/remotestorage.ts");
/******/ 	__webpack_exports__ = __webpack_exports__["default"];
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=remotestorage.js.map