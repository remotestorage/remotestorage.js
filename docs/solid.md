# Using Solid storage

The optional Solid backend lets existing remoteStorage data modules store files
on a [Solid Pod](https://solidproject.org/). It provides the remoteStorage file
API; it does not convert application JSON into interoperable RDF vocabularies.

## Choose the Solid build

Use `release/remotestorage-solid.js` **instead of** `release/remotestorage.js`.
Both browser bundles export the `RemoteStorage` constructor. The Solid build
includes the Inrupt authentication and RDF libraries; the default build does not.
For a source checkout, build it with `npm ci` and `npm run build:solid`.
The SDKs are development dependencies here and optional npm peers. A default
npm consumer installs only the existing core runtime dependencies, without the
Solid SDK tree or its Node engine requirements. The prebuilt Solid browser
bundle already contains the SDKs. Source/TypeScript consumers of the optional
entry point install its peers explicitly:

```sh
npm install @inrupt/solid-client@^4.0.0 @inrupt/solid-client-authn-browser@^5.0.2
```

The current SDK tooling supports Node 20/22/24, separately from the core's
Node 22/24/26 support. It does not supply Node-based Solid browser login.

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
`connected`. Before first selection, `null` remains a pending selection.
After a Pod is selected, changing or clearing it requires
calling `remoteStorage.disconnect()` and waiting for its `disconnected` event
before starting a new connection. The method itself returns immediately; register
the listener before calling it. This clears the previous account's cache before
selecting another Pod; otherwise local
edits could be sent to the wrong Pod. Selecting the same connected Pod is
idempotent. If a remembered Pod is no longer advertised, the adapter stays
disconnected and reports an error; it never silently rebinds the old cache.

`remoteStorage.disconnect()` clears the local cache and settings and awaits
the SDK's application logout before reinitializing and emitting `disconnected`.
It does not sign the user out of their identity provider in other apps.
Tokens and DPoP keys stay in the SDK's in-memory secure store. Non-secret login
state is kept separately in namespaced browser storage, not in app data.

## Notifications and recovery

With caching enabled, the Solid backend discovers `WebSocketChannel2023`
services through the pod's `describedby` / `solid:storageDescription` links.
Subscriptions use the existing authenticated session. Files and containers
are watched separately: a container subscription is not a recursive watch of
every descendant. File events trigger revalidation of that file; container
membership events trigger a fresh listing and normal cache synchronization.
Notifications never replace conditional writes or the existing conflict policy.

The adapter subscribes to at most **eight resources per tab**, with four
subscription requests in flight. Each topic needs its own WebSocket; this cost
also applies when multiple tabs are open. Existing subscriptions stay stable;
resources beyond the limit still synchronize through recovery polling.
Notifications are optional: failures do not prevent file operations.

Connecting, returning online, and returning to a visible tab request recovery.
These requests coalesce for one minute and drain at two cached paths per second,
checking containers and files whose parent is not cached. A container read
retrieves each child's metadata, so recovery does not also GET every unchanged
file. Each socket opening immediately revalidates its exact topic, closing the
read/subscribe gap. Renewal revalidates after 30 minutes or sooner if the server
expires the channel. Maintenance runs every ten seconds, with bounded retry
backoff. Channels are closed when their resource leaves the cache or the app
disconnects. CSS channel deletion is best effort; expiry is requested when
supported.

Solid container ETags do not certify all descendants. Routine recovery checks
every cached container, including nested ones even when parent revisions are
unchanged. Its per-child HEAD metadata selects changed documents for GET. A
file whose readable parent is not cached is checked directly, unless an open,
unexpired subscription covers it. Routine checks have a **60-second minimum**
interval (or the app's longer configured interval), rather than polling every
file every ten seconds. Foreground recovery is coalesced as above; a recovery
request inside that window can wait for polling or subscription reconnection.
These limits do not delay explicit reads, pending local writes, or actual
notification invalidations. Notification invalidations arriving during a
request remain queued. No descendant check is discarded because an ancestor
is queued. Solid's idle sync cycles schedule the next cycle so recovery resumes
if a subscription fails; idle event behavior is unchanged for other backends.

After a successful write without ETag, the next mutation or notification
revalidation compares readback with the acknowledged body and media type. Only
a matching representation supplies the missing validator, preserving any newer
local edit. A different remote representation remains a conflict with local,
remote and last-common values; it is never adopted as the validator for the
acknowledged bytes. Renewal bounds missed-notification staleness only when the
renewal and recovery requests succeed.

The implementation supports the compact JSON-LD subscription response and
ActivityStreams event shapes used by CSS 7.2.0. It does not implement legacy
`Updates-Via` notifications, arbitrary JSON-LD event compaction, or event replay.
Other providers require integration testing. Cache-disabled apps continue to
read directly from the pod and do not create notification subscriptions.

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
  ETags are opaque server values: some providers include a media type in the
  validator. The adapter preserves that whole value for conditional requests;
  it does not combine the Content-Type header with the ETag.
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

The [runnable adapter lab](https://github.com/remotestorage/remotestorage.js/tree/master/examples/solid) provides a local
Community Solid Server and a browser UI for these checks. The
[recorded Chromium run](https://github.com/user-attachments/assets/201c12bc-5e4a-431e-b9ef-54f0a9325dfe) passed login/pod selection,
JSON save/read, binary integrity, stale-write/delete protection, listing, and
deletion with cache and sync enabled against Community Solid Server 7.2.0.

Choose a current provider from the
[Solid provider directory](https://solidproject.org/users/get-a-pod).
Use a disposable account and the application's final callback route. Verify:

1. Login, returning to the application, and selecting one of the advertised pods.
2. Reloading the page and restoring the same Pod; disconnecting before changing Pods.
3. Storing and retrieving JSON and a binary file with identical bytes.
4. Listing folders, including empty folders and filenames with spaces.
5. Editing the same file from two clients and observing a conflict rather than
   silently overwriting a newer version; also exercise a stale deletion.
6. Disconnecting, reconnecting, and handling denied access or a failed login.

The automated adapter tests use the real RDF parser and controlled HTTP
responses. They do not certify a particular provider or exercise an interactive
identity-provider login. Complete the browser checks above before release.
