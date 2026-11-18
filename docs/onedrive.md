# OneDrive Personal

The OneDrive backend stores data in a shared `remotestorage` folder in the user's
OneDrive. Separate apps can access the same remoteStorage modules; this is not
Microsoft's isolated per-app folder. No Microsoft SDK or client secret is needed.

This backend is experimental. Its HTTP behavior is covered by automated fixtures,
but a real Microsoft account integration run is still required before release.
OneDrive for Business, SharePoint, sovereign-cloud endpoints, shared drives,
shortcuts, and empty-file uploads are not supported by this initial implementation.
It rejects Business accounts and zero-byte uploads explicitly. OneDrive filename
restrictions and case-insensitive names apply; paths differing only in letter case
cannot represent separate files.
Paths and listing keys use literal names: pass spaces, Unicode and percent signs
unchanged. The backend encodes them only when constructing Microsoft API URLs.
Folder lookups follow OneDrive's case-insensitive naming rules.

## Application registration

Register an application in Microsoft Entra with support for **personal Microsoft
accounts**. Add the exact app callback URL as a **Single-page application** redirect
URI, including its path. Use HTTPS, or localhost for development. Configure the
Microsoft Graph delegated `Files.ReadWrite` permission. The login also requests
`offline_access` so an expired access token can be refreshed.

A client secret must never be embedded in the app. The backend uses the existing
remoteStorage authorization-code flow with PKCE and validates OAuth state. Both
localStorage and sessionStorage must be available. Tokens are kept in browser
storage like the other cloud backends; disconnect removes the OneDrive session.
Temporary connection failures retain saved credentials for a later retry. Clearing
credentials, replacing the account or removing the application registration cancels
pending transfers; a delayed startup restore cannot revive cleared credentials.

```js
const remoteStorage = new RemoteStorage();
remoteStorage.setApiKeys({ onedrive: 'your-application-client-id' });
remoteStorage.access.claim('notes', 'rw');
remoteStorage.caching.enable('/notes/');

// Call from your app's connect button.
await remoteStorage.onedrive.connect();

remoteStorage.on('connected', () => {
  // Existing BaseClient/data-module operations can now use OneDrive.
});
```

The existing connect widget does not yet offer OneDrive. Apps should expose their
own connect button. On return from Microsoft, remoteStorage restores the selected
backend and completes the login. App hash state is preserved by PKCE. Conditional
writes and deletes keep the existing HTTP 412 conflict-handling behavior.

## Sync and concurrent edits

Microsoft's folder ETags do not provide recursive change tracking. The adapter
consumes the drive's delta feed before a periodic sync, publishes a new metadata
snapshot only after all pages succeed, and computes folder revisions from child
names and revisions. Changes to a nested file therefore invalidate every ancestor.
Moves and renames are resolved by item IDs, including when children do not appear
in the delta response. Expired delta tokens trigger a complete rebuild. A failed
or incomplete feed does not advance the cursor or allow sync to trust stale data.
The feed includes drive metadata beyond the shared folder; only descendants of
`/remotestorage` are exposed to remoteStorage clients.
Deleted subtrees are pruned after all pages are applied, preserving children moved
out of them. Missing file validators and ambiguous paths reject the snapshot
instead of publishing an incomplete listing.

File downloads use Microsoft's preauthenticated download URL without sending the
Graph access token to that host. Metadata is checked again after downloading so
a concurrent edit or replacement cannot associate a body with an older ETag. Request
timeouts and cancellation cover the response body as well as headers. Binary bodies remain
ArrayBuffers; textual MIME types are decoded as UTF-8. OneDrive chooses the stored
MIME type from its file metadata, so callers should use appropriate file extensions.
`getItemURL()` returns a temporary download capability, not a permanent public URL.
The remoteStorage `public/` path does not automatically publish OneDrive files.

Uploads use deferred upload sessions. The final commit sends the original
`If-Match` validator, or `conflictBehavior: fail` for an exclusive create. Checking
metadata before an unconditional upload would not protect against another writer.
The documented conditional explicit-commit path is currently limited to OneDrive
Personal, which is why Business accounts are not enabled. The browser sends chunks
without the Graph bearer token. On failure, temporary sessions are cancelled on a
best-effort basis; Microsoft expires abandoned sessions.
The explicit commit addresses the destination parent path, with the filename and
upload-session URL in its body, following Microsoft's documented Personal flow.
Its conditional behavior still needs the live acceptance test below.

Zero-byte files are rejected because there is no verified conditional empty-file
path in this implementation. Other uploads use sequential 3.125 MiB chunks and
buffer the full body in memory. Interrupted transfers are not resumed across page
reloads. Rate-limit and service failures are surfaced to sync for a later retry.

## Verification before release

Run the normal repository tests and `npm run test:mocha -- --grep OneDrive --exit`
after compiling with `npm run build:js`.

A live acceptance run needs a disposable personal Microsoft account and an Entra
application registered for the test app's SPA callback. Use two independently
signed-in browser contexts against the same shared folder. Verify JSON and binary
round trips, nested edits, pagination, moves, deletion, reload/token refresh, and
concurrent stale writes and deletes. In particular, confirm that the final upload
commit honors its ETag after another client edits the target during chunk upload.
This live check has not been performed by the fixture suite.

Official references:

- [Browser authentication and PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-single-page-app-sign-in)
- [OneDrive CORS and download URLs](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/working-with-cors?view=odsp-graph-online)
- [Delta feed](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0)
- [Deferred uploads and conditional explicit commits](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0)
- [Conditional deletion](https://learn.microsoft.com/en-us/graph/api/driveitem-delete?view=graph-rest-1.0)
