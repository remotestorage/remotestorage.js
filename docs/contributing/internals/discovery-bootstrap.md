# Discovery bootstrap

*This section describes how connecting to a storage works internally.*

When the RemoteStorage instance is instantiated, it checks the fragment
of the URL to see if it contains an `access_token` or `remotestorage`
parameter. In the first case, the access token is given to the remote
using `remoteStorage.remote.configure()`. In the second case, WebFinger
discovery is triggered for the user address given (see [storage-first
section](https://tools.ietf.org/html/draft-dejong-remotestorage-09#section-11)
of the remoteStorage spec).

The user can also set the user address through the widget, or the app
can call
`remoteStorage.remote.configure({userAddress: 'user@host.com'})` to set
the user address.

When a user address is set, but no other remote parameters are known
yet, WebFinger discovery will be triggered. From the WebFinger response,
the library extract the storage base URL, the storage API, and the OAuth
dialog URL.

If no OAuth URL is given, Implied Auth is triggered:
<https://github.com/remotestorage/remotestorage.js/issues/782>

If an OAuth URL is known, but no token yet, the OAuth dance will be
started by setting the `location.href` of the window, redirecting the
user to that URL. When the dance comes back, the library will detect the
`access_token` from the window location during the page load, and from
that point onwards, the remote is connected.

If the WebFinger record advertises the PKCE code flow (spec §10.1: an
authorization endpoint, a token endpoint and the `S256` method), the
library uses it instead of the implicit flow, unless it runs in Cordova
or browser storage is unusable. Dropbox always uses it. Before the
redirect, the code verifier, a random `state`, the token endpoint, the
client id and the app's current location hash are saved together in
sessionStorage, replacing any earlier ones.

The window location then comes back with a `code` parameter instead of
`access_token`. The saved values are read and removed, the returned
`state` must match the saved one, and the app's hash is restored. RS
then makes a fetch to the saved token endpoint (or `remote.TOKEN_URL`
for Dropbox) with the code, to retrieve the access token, and possibly a
refresh token as well.

Only Dropbox uses that refresh token so far. The generic backend does
not keep the token endpoint or client id once the code is exchanged, so
when its access token expires the app gets an `Unauthorized` event and
the user has to connect again, as with the implicit flow.

## The `rsDiscovery` fallback

When `localStorage` is unavailable, the discovery data (storage base URL,
API version, properties) cannot be persisted across the OAuth redirect. In
that case `Authorize.authorize()` embeds it in the redirect fragment as an
`rsDiscovery` value inside the `state` parameter, and it is restored from
the callback on the way back.

Because `rsDiscovery` carries endpoint metadata but never a credential, it
must not be able to retarget a remote that already holds a stored access
token: doing so would send the (still valid) token to a substituted
endpoint. The callback handler therefore ignores `rsDiscovery` when the
remote already has a token, unless the same callback also delivers a fresh
`access_token` (as in server-initiated, pre-authenticated links). The
no-localStorage fallback is unaffected, because no token can be stored in
that case.

When a fresh `access_token` is present, the endpoint metadata and the token
are applied in a single `configure()` call. Applying them separately would
switch the endpoint while the previously stored token is still in place,
and the synchronous `connected` event could leak that token to the new
endpoint before the token is replaced.

