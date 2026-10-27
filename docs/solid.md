# Using Solid storage

The optional Solid backend lets existing remoteStorage data modules store files
on a [Solid Pod](https://solidproject.org/). It provides the remoteStorage file
API; it does not convert application JSON into interoperable RDF vocabularies.

## Choose the Solid build

Use `release/remotestorage-solid.js` **instead of** `release/remotestorage.js`.
Both browser bundles export the `RemoteStorage` constructor. The Solid build
includes the Inrupt authentication and RDF libraries; the default build does not.
For a source checkout, build it with `npm ci` and `npm run build:solid`.

```html
<script src="remotestorage-solid.js"></script>
```

The npm bundle can be imported as:

```js
import RemoteStorage from 'remotestoragejs/release/remotestorage-solid.js';
```

Solid support requires a browser with Fetch, Web Crypto, and accessible
localStorage, served over HTTPS (localhost HTTP is suitable for development).
Other backends continue working without the Solid SDKs in the default build.
This browser authentication adapter is not a Node.js login implementation.
TypeScript users of the Solid entry point need an ES2022 type library (or
`es2022.error` alongside their existing libraries) for the current Inrupt SDK
types. Those SDK types also reference Node's EventEmitter: install
`@types/node` as a development dependency and include `node` if your tsconfig
restricts `types`. The default entry point does not import those SDK types.

## Connect and select a pod

Register listeners immediately after constructing the instance. Start login
from a user action; do not schedule login with a timer on every page load.
The SDK handles its own OIDC callback and may redirect to restore a previous
session. The callback preserves the application's path and query parameters;
the saved application fragment is restored after successful authentication.
Keep this route available after the identity provider redirects back to it.

```js
const remoteStorage = new RemoteStorage();
remoteStorage.access.claim('notes', 'rw');
remoteStorage.caching.enable('/notes/');

remoteStorage.on('error', error => {
  showError(error.message);
});

remoteStorage.on('pod-not-selected', () => {
  const pods = remoteStorage.solid.getPodURLs();
  if (!pods || pods.length === 0) {
    showError('This account does not advertise a Solid Pod.');
    return;
  }
  if (pods.length === 1) {
    remoteStorage.solid.setPodURL(pods[0]);
    return;
  }
  // Render a chooser and call setPodURL with the selected advertised URL.
  showPodChooser(pods, pod => remoteStorage.solid.setPodURL(pod));
});

remoteStorage.on('connected', () => {
  showConnected(remoteStorage.remote.userAddress);
});

// Call in response to the user's Connect button, supplying their issuer URL.
function connectToSolid(issuerURL) {
  remoteStorage.solid.setAuthURL(issuerURL);
  return remoteStorage.solid.connect();
}
```

`showError`, `showPodChooser`, and `showConnected` are application UI functions.

`pod-not-selected` means authentication succeeded but no pod is selected. It
is a connection state rather than an authentication error. `getPodURLs()` returns
`null` before discovery, an empty array if there are no pods, or a list of
advertised URLs. A listener added after initialization also receives this
pending state, including the zero-pod case. Selecting a valid URL fires
`connected`; selecting `null` returns to pod selection. A remembered selection
is reused only if it is still advertised by the account.

`remoteStorage.disconnect()` clears the local cache and settings and awaits
the SDK's application logout before reinitializing and emitting `disconnected`.
It does not sign the user out of their identity provider in other apps.
Tokens and DPoP keys stay in the SDK's in-memory secure store. Non-secret login
state is kept separately in namespaced browser storage, not in app data.

## Server requirements and limitations

- The provider must support Solid-OIDC browser login and advertise pods with
  `pim:storage` in the WebID profile or linked profiles. The SDK uses public
  fetch for the public WebID and authenticated fetch for extended profiles.
- The pod must allow the app's origin to make authenticated GET, HEAD, PUT,
  and DELETE requests. Its CORS policy must allow `If-Match` and
  `If-None-Match`, and expose `ETag` response headers. Files require strong
  ETags so the server can enforce conditional writes. Missing or weak file
  validators produce a clear error instead of risking a lost update.
- Containers must be readable as Turtle with `ldp:contains` statements.
  Optional `stat:mtime`, file-size, and modification-date RDF properties are
  not required. Each listing retrieves child HTTP metadata, with at most four
  HEAD requests in flight, to obtain actual resource validators. Large
  containers therefore cost more requests than a remoteStorage listing.
- Conditional PUT and DELETE failures return HTTP 412 to the normal sync
  conflict handling. Creation uses `If-None-Match: *` on the PUT itself.
- Binary files remain binary. JSON and other text formats are returned as
  text for the usual data-module processing. `getItemURL()` returns the pod
  resource URL; it does not change the resource's access permissions.
- remoteStorage scope claims do not configure Solid access-control policies.
  Permissions depend on the provider, the user's grants, and pod policies.
- The connect widget needs its own Solid integration. See
  [widget PR #136](https://github.com/remotestorage/remotestorage-widget/pull/136).
  The custom UI above does not depend on that widget change being released.

## Validate a provider integration

Choose a current provider from the
[Solid provider directory](https://solidproject.org/users/get-a-pod).
Use a disposable account and the application's final callback route. Verify:

1. Login, returning to the application, and selecting one of the advertised pods.
2. Reloading the page, restoring login, and retaining or changing the pod selection.
3. Storing and retrieving JSON and a binary file with identical bytes.
4. Listing folders, including empty folders and filenames with spaces.
5. Editing the same file from two clients and observing a conflict rather than
   silently overwriting a newer version; also exercise a stale deletion.
6. Disconnecting, reconnecting, and handling denied access or a failed login.

The automated adapter tests use the real RDF parser and controlled HTTP
responses. They do not certify a particular provider or exercise an interactive
identity-provider login. Complete the browser checks above before release.
