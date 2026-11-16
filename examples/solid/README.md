# Solid adapter lab

Interactive browser demo of the optional Solid backend. It uses the repository's
actual browser bundle and a local Community Solid Server 7.2.0, with the normal
local cache and synchronization enabled.

## Run

Requirements: Node.js 22 or 24 and a recent browser. From the repository root:

```sh
npm ci
npm run build:solid
npm ci --prefix examples/solid
npm start --prefix examples/solid
```

Open the browser address printed after the provider is ready. Select **Open
local account setup**, sign up, and create a pod. Keep **Use the WebID in the
Pod** and **Link to this storage from my WebID** selected. Return to the demo,
select **Connect**, and complete the provider login/consent flow.

The local provider stores data in memory. Stopping the demo discards its
accounts and pod data. No test credentials or tokens are committed. The app
writes only inside `/solid-demo/`.

## Checks

Try JSON save/read, binary SHA-256 verification, stale writes and deletes,
Turtle container listings, and deletion. The fixed sample filenames are read
before editing or deleting to establish the current cached revision. Writes
are verified against the pod after queued synchronization, rather than treating
the `startSync()` promise as proof that transfers finished.

The [recorded browser run](https://github.com/user-attachments/assets/201c12bc-5e4a-431e-b9ef-54f0a9325dfe) exercised all seven
checks against a real local provider. Other hosted providers and the separate
connect widget have not been tested by this demo.

You can enter an HTTPS provider for a disposable remote account if it permits
this app's localhost callback and exposes the ETag/conditional-request behavior
documented in the [Solid guide](../../docs/solid.md).

`SOLID_BUNDLE_DIRECTORY` optionally selects a directory containing a separately
built `remotestorage-solid.js`, its source map, and its license file.

## Two-browser regression test

After building the Solid bundle and installing this example's dependencies:

```sh
npm run test:install-browser --prefix examples/solid
npm run test:browser --prefix examples/solid
```

Run these from the repository root. Ports 3000 and 8787 must be free. The test
starts a fresh in-memory CSS 7.2.0 instance, creates temporary random credentials,
and logs in through the real browser OIDC flow in two isolated Chromium contexts.
The temporary account seed is removed when the server exits.

It observes multiple routine sync cycles with a stale subscribed file and asserts
that no file GET is sent. It then checks nested updates with polling slowed to ten
minutes, observes real WebSocket notification frames, discovers additions and deletions, then disconnects
one client's network and sockets while the other edits the pod. It verifies
recovery of a deliberately missed notification on channel renewal,
reconciliation after reconnect and reload, polling without notifications, stale
write/delete rejection, and disconnect cleanup. It reads the local cache when
asserting synchronization, rather than accidentally refreshing through test reads.
